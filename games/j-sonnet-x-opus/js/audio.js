// DD.Audio: fully synthesized music and SFX (WebAudio, no samples).
// Graph: voices -> mode gain / sfx bus -> master -> compressor -> destination.
(function () {
  window.DD = window.DD || {};

  var AC = window.AudioContext || window.webkitAudioContext;
  var MAX_SFX = 12;          // simultaneous SFX calls; newer ones are dropped
  var LOOKAHEAD = 0.4;       // seconds scheduled ahead by the music scheduler

  var ctx = null, master = null, musicBus = null, sfxBus = null, musicEcho = null, sfxEcho = null;
  var noiseBuf = null, SFX_OUT = null;
  var vol = { master: 0.8, music: 0.6, sfx: 0.9 };
  var muted = false, tension = 0, wanted = 'none', cur = null;
  var busy = [], lastPlayed = {};

  function N(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function pick(a) { return a[Math.floor(Math.random() * a.length)]; }
  function clamp01(x) { return Math.max(0, Math.min(1, x)); }

  // ---------------------------------------------------------------- graph

  function makeEcho(bus, time, fb) {
    var inp = ctx.createGain(), d = ctx.createDelay(1), f = ctx.createGain(), lp = ctx.createBiquadFilter();
    d.delayTime.value = time; f.gain.value = fb; lp.frequency.value = 1600;
    inp.connect(d); d.connect(lp); lp.connect(f); f.connect(d); lp.connect(bus);
    return inp;
  }

  function build() {
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : vol.master;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.knee.value = 10; comp.ratio.value = 8;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    master.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = vol.music * 0.8; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = vol.sfx; sfxBus.connect(master);
    musicEcho = makeEcho(musicBus, 0.37, 0.38);
    sfxEcho = makeEcho(sfxBus, 0.23, 0.25);
    SFX_OUT = { node: sfxBus, echo: sfxEcho };
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    var data = noiseBuf.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    setInterval(schedule, 100);
  }

  function applyVolumes() {
    if (!ctx) return;
    var now = ctx.currentTime;
    master.gain.setTargetAtTime(muted ? 0 : vol.master, now, 0.03);
    musicBus.gain.setTargetAtTime(vol.music * 0.8, now, 0.03);
    sfxBus.gain.setTargetAtTime(vol.sfx, now, 0.03);
  }

  // Modulating oscillator added onto an AudioParam (FM or filter LFO).
  function mod(rate, depth, param, t, end) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(param);
    o.start(t); o.stop(end + 0.02);
  }

  // One enveloped voice. o: { t, d, g, a?, h?, type?, f, f2?, fd?, det?, fmf?, fmd?,
  //   noise?, rate?, ft?, ff?, ff2?, ffd?, q?, lfo?, lfoD?, send? }; out: { node, echo }.
  function voice(out, o) {
    var t = o.t, end = t + o.d, a = o.a || 0.004, g = Math.max(o.g, 0.0002), src, node;
    if (o.noise) {
      src = node = ctx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    } else {
      src = node = ctx.createOscillator();
      src.type = o.type || 'sine';
      src.frequency.setValueAtTime(o.f, t);
      if (o.f2) src.frequency.exponentialRampToValueAtTime(o.f2, t + (o.fd || o.d));
      if (o.det) src.detune.value = o.det;
      if (o.fmf) mod(o.fmf, o.fmd, src.frequency, t, end);
    }
    if (o.ff) {
      node = ctx.createBiquadFilter();
      node.type = o.ft || 'lowpass';
      node.Q.value = o.q || 1;
      node.frequency.setValueAtTime(o.ff, t);
      if (o.ff2) node.frequency.exponentialRampToValueAtTime(o.ff2, t + (o.ffd || o.d));
      if (o.lfo) mod(o.lfo, o.lfoD, node.frequency, t, end);
      src.connect(node);
    }
    var env = ctx.createGain();
    env.gain.setValueAtTime(0, t);
    env.gain.linearRampToValueAtTime(g, t + a);
    if (o.h) env.gain.setValueAtTime(g, t + a + o.h);
    env.gain.exponentialRampToValueAtTime(0.0001, end);
    node.connect(env);
    env.connect(out.node);
    if (o.send) {
      var s = ctx.createGain();
      s.gain.value = o.send;
      env.connect(s); s.connect(out.echo);
    }
    if (o.noise) src.start(t, Math.random() * 1.5); else src.start(t);
    src.stop(end + 0.02);
  }

  // ---------------------------------------------------------------- SFX recipes
  // Recipes call s() with times relative to the sound start; s() applies the
  // current start time, pitch and volume. play() sets them and returns the end time.

  var st = 0, sp = 1, sv = 1, sOut = null, sEnd = 0;

  function s(o) {
    o.t = st + (o.t || 0);
    o.g *= sv;
    if (o.f) o.f *= sp;
    if (o.f2) o.f2 *= sp;
    if (o.ff) o.ff *= sp;
    if (o.ff2) o.ff2 *= sp;
    if (o.fmf) { o.fmf *= sp; o.fmd *= sp; }
    if (o.noise) o.rate = (o.rate || 1) * sp;
    sEnd = Math.max(sEnd, o.t + o.d);
    voice(sOut, o);
  }

  function play(name, t, p, v, out) {
    st = t; sp = p; sv = v; sOut = out; sEnd = t;
    SFX[name]();
    return sEnd;
  }

  // Nested recipe with a time offset and pitch factor.
  function sub(name, dt, p) {
    var t0 = st, p0 = sp;
    st += dt; sp *= p;
    SFX[name]();
    st = t0; sp = p0;
  }

  function tone(t, type, f, d, g, f2) { s({ t: t, type: type, f: f, f2: f2, d: d, g: g }); }
  function thump(t, f, f2, d, g) { s({ t: t, type: 'sine', f: f, f2: f2, fd: d * 0.6, d: d, g: g }); }
  function hiss(t, d, g, ft, ff, q, ff2, a) { s({ t: t, d: d, g: g, noise: 1, ft: ft, ff: ff, q: q, ff2: ff2, a: a }); }
  function squelch(t, d, g, ff, rate) {
    s({ t: t, d: d, g: g, noise: 1, ft: 'bandpass', ff: ff, q: 5, lfo: rate || 30, lfoD: ff * 0.5, a: 0.01 });
  }
  function crack(t, g) {
    hiss(t, 0.05, g, 'highpass', 1800);
    s({ t: t, type: 'square', f: 2200, f2: 300, d: 0.03, g: g * 0.5 });
  }
  function clang(t, f, d, g) {
    s({ t: t, type: 'sine', f: f, fmf: f * 2.76, fmd: f * 2.5, d: d, g: g, send: 0.3 });
    s({ t: t, type: 'sine', f: f * 1.53, fmf: f * 4.1, fmd: f, d: d * 0.6, g: g * 0.5 });
  }
  function ratchet(t, f, g) {
    s({ t: t, type: 'square', f: f, f2: f * 0.6, d: 0.025, g: g, ft: 'bandpass', ff: f * 1.3, q: 4 });
  }
  function roar(t, f, f2, d, g, fm) {
    s({ t: t, type: 'sawtooth', f: f, f2: f2, d: d, g: g, a: 0.06, fmf: fm, fmd: f * 1.5,
      ft: 'lowpass', ff: 700, q: 3, lfo: 6, lfoD: 250 });
  }

  var BELL = [[0.5, 0.5, 7], [1, 0.55, 5.5], [1.006, 0.3, 5], [1.19, 0.35, 4], [1.5, 0.2, 3.5],
    [2, 0.35, 3], [2.74, 0.15, 2], [3.36, 0.1, 1.4], [4.2, 0.07, 1]];

  var SFX = {
    // UI
    click: function () { ratchet(0, 1600, 0.25); thump(0, 300, 120, 0.04, 0.15); },
    confirm: function () {
      ratchet(0, 1800, 0.2); thump(0, 160, 60, 0.12, 0.3);
      tone(0, 'triangle', 294, 0.14, 0.18); tone(0.07, 'triangle', 440, 0.22, 0.18);
    },
    back: function () { ratchet(0, 1200, 0.2); tone(0, 'triangle', 392, 0.16, 0.16, 196); },
    error: function () {
      s({ type: 'square', f: 98, d: 0.12, g: 0.16, ft: 'lowpass', ff: 900 });
      s({ t: 0.14, type: 'square', f: 92, d: 0.16, g: 0.16, ft: 'lowpass', ff: 700 });
      roar(0, 60, 50, 0.3, 0.12, 25);
    },

    // Explore
    step: function () {
      var r = 0.85 + Math.random() * 0.3;
      thump(0, 110 * r, 50, 0.09, 0.3);
      squelch(0, 0.06, 0.1, 500 * r, 45);
    },
    pickup: function () {
      ratchet(0, 2400, 0.2);
      tone(0, 'triangle', 523, 0.12, 0.16, 1046); tone(0.06, 'triangle', 784, 0.2, 0.14, 1568);
    },
    elixir: function () {
      squelch(0, 0.35, 0.18, 600, 18);
      for (var k = 0; k < 4; k++) tone(k * 0.07, 'sine', 300 + Math.random() * 300, 0.06, 0.14, 900);
      tone(0.3, 'triangle', 660, 0.35, 0.08, 880);
    },
    gear: function () {
      for (var k = 0; k < 4; k++) ratchet(k * 0.045, 2600 - k * 200, 0.18);
      clang(0.18, 520, 0.5, 0.18);
    },
    essence: function () {
      hiss(0, 0.5, 0.18, 'bandpass', 700, 8, 3200, 0.1);
      tone(0, 'sine', 440, 0.6, 0.1, 880);
      s({ t: 0.05, type: 'triangle', f: 880, d: 0.7, g: 0.06, a: 0.1, send: 0.5 });
    },
    blueprint: function () {
      hiss(0, 0.05, 0.15, 'highpass', 3000);
      hiss(0.07, 0.06, 0.12, 'highpass', 3500);
      hiss(0.15, 0.05, 0.1, 'highpass', 3200);
      s({ t: 0.1, type: 'triangle', f: 659, d: 0.8, g: 0.12, send: 0.4 });
      s({ t: 0.18, type: 'triangle', f: 988, d: 0.9, g: 0.1, send: 0.4 });
    },
    stairs: function () {
      for (var k = 0; k < 4; k++) {
        thump(k * 0.16, 120 - k * 12, 45, 0.1, 0.3);
        hiss(k * 0.16, 0.08, 0.1, 'lowpass', 500);
      }
      hiss(0, 0.7, 0.08, 'bandpass', 300, 2);
    },
    shift: function () {
      s({ noise: 1, d: 2.4, g: 0.4, a: 0.3, ft: 'lowpass', ff: 180, ff2: 420, q: 3, lfo: 9, lfoD: 120 });
      s({ type: 'sawtooth', f: 42, f2: 33, d: 2.4, g: 0.25, a: 0.3, ft: 'lowpass', ff: 220, q: 4, lfo: 11, lfoD: 90 });
      s({ type: 'sawtooth', f: 55, f2: 45, d: 2.2, g: 0.12, a: 0.4, fmf: 17, fmd: 40, ft: 'lowpass', ff: 400 });
      for (var k = 0; k < 10; k++) ratchet(0.2 + k * 0.17, 900 + Math.random() * 400, 0.12);
      thump(2.1, 90, 35, 0.4, 0.5);
      hiss(2.1, 0.3, 0.2, 'lowpass', 500);
    },
    spikes: function () {
      clang(0, 900, 0.18, 0.14);
      hiss(0, 0.08, 0.3, 'bandpass', 2500, 2);
      squelch(0.02, 0.15, 0.25, 800, 50);
      thump(0.02, 160, 60, 0.15, 0.4);
    },
    steam: function () {
      hiss(0, 0.9, 0.28, 'highpass', 1800, 1, 4000, 0.03);
      hiss(0, 0.6, 0.12, 'bandpass', 6000, 3);
    },
    fire_hit: function () {
      hiss(0, 0.5, 0.35, 'lowpass', 3500, 1, 400, 0.01);
      for (var k = 0; k < 5; k++) hiss(Math.random() * 0.4, 0.02, 0.2, 'highpass', 3000);
      thump(0, 140, 50, 0.2, 0.4);
    },
    door: function () {
      s({ type: 'sawtooth', f: 65, f2: 52, d: 0.6, g: 0.22, a: 0.05, ft: 'bandpass', ff: 450, q: 8, lfo: 17, lfoD: 150 });
      thump(0.5, 85, 38, 0.35, 0.6);
      hiss(0.5, 0.25, 0.25, 'lowpass', 450);
      ratchet(0.5, 1200, 0.1);
    },

    // Combat
    card: function () { hiss(0, 0.07, 0.2, 'bandpass', 2600, 1.5, 5000); thump(0, 200, 90, 0.05, 0.12); },
    draw: function () { hiss(0, 0.12, 0.16, 'highpass', 1500, 1, 4500, 0.03); },
    hit: function () {
      thump(0, 170, 48, 0.16, 0.6);
      hiss(0, 0.08, 0.3, 'lowpass', 1400);
      squelch(0.01, 0.12, 0.3, 750, 40);
    },
    hit_big: function () {
      thump(0, 130, 34, 0.4, 0.85);
      hiss(0, 0.28, 0.4, 'lowpass', 2400, 1, 300);
      crack(0, 0.45);
      squelch(0.02, 0.3, 0.35, 600, 35);
      roar(0, 70, 45, 0.35, 0.18, 40);
    },
    block: function () {
      clang(0, 420, 0.4, 0.22);
      hiss(0, 0.05, 0.25, 'bandpass', 3000, 2);
      thump(0, 140, 70, 0.1, 0.35);
    },
    heal: function () {
      squelch(0, 0.45, 0.2, 450, 12);
      tone(0.05, 'sine', 330, 0.5, 0.12, 440);
      s({ t: 0.12, type: 'triangle', f: 660, d: 0.6, g: 0.07, a: 0.08, send: 0.4 });
    },
    burn: function () {
      s({ noise: 1, d: 0.7, g: 0.3, a: 0.02, ft: 'highpass', ff: 2500, lfo: 23, lfoD: 1500 });
      hiss(0, 0.4, 0.2, 'lowpass', 900, 1, 200);
    },
    buff: function () {
      s({ type: 'sawtooth', f: 110, f2: 220, d: 0.45, g: 0.15, ft: 'lowpass', ff: 400, ff2: 2200, q: 5 });
      ratchet(0, 2000, 0.15); ratchet(0.1, 2400, 0.12);
    },
    debuff: function () {
      s({ type: 'sawtooth', f: 220, f2: 80, d: 0.5, g: 0.14, det: -15, ft: 'lowpass', ff: 1600, ff2: 250, q: 5 });
      s({ type: 'sawtooth', f: 233, f2: 85, d: 0.5, g: 0.1, ft: 'lowpass', ff: 1400, ff2: 250 });
      squelch(0.1, 0.3, 0.15, 400, 20);
    },
    enemy_attack: function () {
      roar(0, 95, 60, 0.4, 0.28, 55);
      hiss(0, 0.22, 0.25, 'bandpass', 500, 2, 2200, 0.05);
    },
    enemy_die: function () {
      roar(0, 120, 38, 1.3, 0.35, 28);
      squelch(0.1, 1.0, 0.3, 450, 14);
      for (var k = 0; k < 4; k++) tone(0.3 + k * 0.15 + Math.random() * 0.05, 'sine', 200 + Math.random() * 200, 0.07, 0.12, 500);
      thump(1.0, 90, 32, 0.45, 0.6);
      hiss(1.0, 0.2, 0.2, 'lowpass', 400);
    },
    player_hurt: function () {
      s({ type: 'sawtooth', f: 190, f2: 95, d: 0.25, g: 0.25, a: 0.01, ft: 'bandpass', ff: 750, q: 3 });
      thump(0, 120, 40, 0.2, 0.6);
      hiss(0, 0.1, 0.3, 'lowpass', 1200);
      squelch(0.02, 0.15, 0.2, 650, 38);
    },
    turn_end: function () {
      ratchet(0, 1500, 0.2); ratchet(0.08, 1100, 0.2);
      tone(0.16, 'triangle', 220, 0.25, 0.15, 180);
      s({ t: 0.05, type: 'sawtooth', f: 50, d: 0.4, g: 0.12, ft: 'lowpass', ff: 250, lfo: 12, lfoD: 100 });
    },
    overheat: function () {
      hiss(0, 1.1, 0.32, 'bandpass', 1500, 3, 6500, 0.05);
      s({ noise: 1, d: 0.9, g: 0.18, ft: 'highpass', ff: 4000, lfo: 31, lfoD: 2500 });
      s({ type: 'sine', f: 400, f2: 1800, d: 1.0, g: 0.07, a: 0.2 });
      thump(0, 100, 50, 0.15, 0.3);
    },
    limb_break: function () {
      crack(0, 0.7); crack(0.045, 0.5);
      squelch(0.05, 0.4, 0.4, 900, 32);
      s({ t: 0.05, noise: 1, d: 0.35, g: 0.25, ft: 'bandpass', ff: 1200, ff2: 350, q: 3 });
      thump(0.22, 95, 32, 0.45, 0.8);
    },
    graft: function () {
      for (var k = 0; k < 3; k++) {
        squelch(k * 0.13, 0.1, 0.28, 500 + k * 200, 45);
        ratchet(k * 0.13 + 0.05, 3000, 0.08);
      }
      thump(0.42, 110, 40, 0.3, 0.6);
      clang(0.42, 300, 0.3, 0.1);
    },
    harvest: function () {
      s({ noise: 1, d: 0.5, g: 0.3, a: 0.05, ft: 'bandpass', ff: 350, ff2: 1300, q: 4, lfo: 22, lfoD: 200 });
      s({ t: 0.1, type: 'sawtooth', f: 80, f2: 160, d: 0.35, g: 0.12, ft: 'lowpass', ff: 500 });
      crack(0.38, 0.55);
      thump(0.4, 100, 40, 0.25, 0.4);
    },
    growl: function () {
      var f = 60 + Math.random() * 15;
      s({ type: 'sawtooth', f: f, f2: f * 0.85, d: 1.3, g: 0.35, a: 0.25, fmf: 23, fmd: f * 1.5,
        ft: 'lowpass', ff: 650, q: 3, lfo: 6, lfoD: 250 });
      s({ noise: 1, d: 1.2, g: 0.15, a: 0.2, ft: 'bandpass', ff: 320, q: 2, lfo: 7, lfoD: 150 });
    },

    // Clock
    tick: function () { s({ type: 'sine', f: 2300, d: 0.04, g: 0.16 }); hiss(0, 0.025, 0.22, 'bandpass', 3800, 6); },
    tock: function () { s({ type: 'sine', f: 1500, d: 0.05, g: 0.16 }); hiss(0, 0.03, 0.22, 'bandpass', 2200, 6); },
    bell: function () {
      BELL.forEach(function (p) { s({ type: 'sine', f: 130 * p[0], d: p[2], g: p[1] * 0.35, send: 0.35 }); });
      hiss(0, 0.08, 0.3, 'bandpass', 2200, 1.5);
      thump(0, 65, 55, 1.2, 0.25);
    },
    heartbeat: function () {
      s({ type: 'triangle', f: 70, f2: 40, fd: 0.12, d: 0.2, g: 0.8, ft: 'lowpass', ff: 300 });
      s({ t: 0.2, type: 'triangle', f: 60, f2: 36, fd: 0.12, d: 0.24, g: 0.55, ft: 'lowpass', ff: 260 });
    },

    // Endings
    death: function () {
      sub('bell', 0, 0.55);
      s({ type: 'sawtooth', f: 220, f2: 55, d: 2.2, g: 0.2, a: 0.05, ft: 'bandpass', ff: 700, ff2: 300, q: 3 });
      sub('heartbeat', 0.6, 1);
      sub('heartbeat', 1.6, 0.9);
      thump(2.4, 70, 28, 0.8, 0.7);
    },
    win: function () {
      [294, 370, 440, 587].forEach(function (f, k) {
        s({ t: k * 0.1, type: 'triangle', f: f, d: 1.4, g: 0.1, send: 0.4 });
      });
      sub('bell', 0.3, 1.6);
      for (var k = 0; k < 6; k++) ratchet(0.5 + k * 0.05, 2200, 0.1);
    },
    timeout: function () {
      for (var k = 0; k < 8; k++) sub(k % 2 ? 'tock' : 'tick', 1.2 * (1 - Math.pow(0.8, k)), 1);
      s({ t: 1.25, type: 'sine', f: 1800, f2: 60, d: 0.6, g: 0.2, fmf: 90, fmd: 600 });
      sub('bell', 1.3, 0.7);
      hiss(1.3, 0.5, 0.3, 'lowpass', 1500, 1, 200);
      thump(1.3, 80, 28, 0.7, 0.8);
    },

    // Internal (music only)
    clank: function () {
      clang(0, 190, 1.2, 0.25);
      thump(0, 90, 45, 0.2, 0.3);
      hiss(0, 0.05, 0.2, 'bandpass', 2000, 2);
    }
  };

  // ---------------------------------------------------------------- music
  // A mode instance: { name, def, gain, out, nodes, drones, filt, cut, step, next, tick, tn, beat }.

  function mv(m, o) { voice(m.out, o); }

  function filt(m, cut, q) {
    var f = ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = cut; f.Q.value = q;
    f.connect(m.gain);
    m.filt = f; m.cut = cut;
  }

  // Continuous oscillator for the lifetime of the mode.
  function drone(m, type, f, g, dest, det) {
    var o = ctx.createOscillator(), a = ctx.createGain();
    o.type = type; o.frequency.value = f; o.detune.value = det || 0;
    o._det = det || 0; o._g = a;
    a.gain.value = g;
    o.connect(a); a.connect(dest || m.filt || m.gain);
    o.start(); m.nodes.push(o);
    return o;
  }

  function lfo(m, rate, depth, params) {
    var o = ctx.createOscillator(), g = ctx.createGain();
    o.frequency.value = rate; g.gain.value = depth;
    o.connect(g);
    params.forEach(function (p) { g.connect(p); });
    o.start(); m.nodes.push(o);
  }

  // Brass-like pad: two detuned saws per note with an opening filter.
  function brass(m, t, notes, d, g, a) {
    notes.forEach(function (n) {
      mv(m, { t: t, d: d, a: a, h: d * 0.25, g: g, type: 'sawtooth', f: N(n), det: -9,
        ft: 'lowpass', ff: 220, ff2: 1300, ffd: a + 0.2, q: 1.2, send: 0.25 });
      mv(m, { t: t, d: d, a: a, h: d * 0.25, g: g, type: 'sawtooth', f: N(n), det: 9,
        ft: 'lowpass', ff: 220, ff2: 1300, ffd: a + 0.2, q: 1.2 });
    });
  }

  function glass(m, t, note, g) {
    mv(m, { t: t, a: 0.5, d: 3.5, g: g, type: 'sine', f: N(note), send: 0.6 });
    mv(m, { t: t, a: 0.5, d: 2.5, g: g * 0.3, type: 'sine', f: N(note) * 2.76 });
  }

  var CHORDS = [[50, 53, 57], [46, 50, 53], [43, 46, 50], [45, 48, 52]];   // Dm Bb Gm Am
  var CHOIR = [[50, 53, 57], [46, 50, 53], [49, 52, 56], [50, 53, 56]];
  var BASS = [0, 0, 12, 0, 0, 1, 0, 12, 0, 0, 12, 0, 3, 0, 1, 0];

  // Shared combat groove: bass ostinato, noise percussion, dissonant stabs.
  function groove(m, i, t) {
    var s16 = i % 16, bar = i >> 4, root = [38, 38, 34, 37][(bar >> 1) % 4], lift = 1 + 2 * tension;
    mv(m, { t: t, d: 0.12, g: 0.11, type: 'sawtooth', f: N(root + BASS[s16]),
      ft: 'lowpass', ff: 1100 * lift, ff2: 180, q: 7 });
    if (s16 === 0 || s16 === 8 || (s16 === 11 && Math.random() < 0.5)) {
      mv(m, { t: t, d: 0.2, g: 0.5, type: 'sine', f: 150, f2: 40, fd: 0.08 });
    }
    if (s16 === 4 || s16 === 12) {
      mv(m, { t: t, d: 0.14, g: 0.22, noise: 1, ft: 'bandpass', ff: 1800, q: 0.8 });
      mv(m, { t: t, d: 0.08, g: 0.1, type: 'triangle', f: 190, f2: 150 });
    }
    if (s16 % 2 === 1) mv(m, { t: t, d: 0.03, g: s16 % 4 === 3 ? 0.07 : 0.04, noise: 1, ft: 'highpass', ff: 7000 });
    if ((s16 === 0 && bar % 2 === 1) || (s16 === 14 && Math.random() < 0.15 + 0.5 * tension)) {
      [12, 13, 18].forEach(function (k) {
        mv(m, { t: t, d: 0.35, g: 0.035, type: 'sawtooth', f: N(root + k),
          ft: 'lowpass', ff: 1800 * lift, ff2: 400, send: 0.3 });
      });
    }
  }

  var MODES = {
    title: {
      bpm: 60, fade: 1.5,
      start: function (m) {
        filt(m, 240, 2);
        drone(m, 'sawtooth', N(26), 0.1, null, -7);
        drone(m, 'sawtooth', N(38), 0.07, null, 6);
        drone(m, 'sine', N(26), 0.18, m.gain);
        lfo(m, 0.07, 90, [m.filt.frequency]);
      },
      step: function (m, i, t) {
        var s16 = i % 16, bar = i >> 4, chord = CHORDS[(bar >> 1) % 4];
        if (s16 === 0 && bar % 2 === 0) brass(m, t, chord, 7.8, 0.03, 2.2);
        if (s16 % 2 === 0 && Math.random() < 0.45) {
          mv(m, { t: t, d: 1.4, g: 0.045, type: 'triangle', f: N(chord[(s16 >> 1) % 3] + (s16 < 8 ? 12 : 24)), send: 0.5 });
        }
        if (s16 === 8 && bar % 4 === 3) play('bell', t, 0.8, 0.22, m.out);
      }
    },

    table: {
      bpm: 50, fade: 1.5,
      start: function (m) {
        filt(m, 400, 1);
        drone(m, 'sine', N(38), 0.07);
        drone(m, 'triangle', N(45), 0.025, null, 4);
        lfo(m, 0.1, 150, [m.filt.frequency]);
      },
      step: function (m, i, t) {
        if (i % 8 === 0) {
          mv(m, { t: t, d: 0.3, g: 0.3, type: 'triangle', f: 70, f2: 42, fd: 0.2, ft: 'lowpass', ff: 220 });
          mv(m, { t: t + 0.22, d: 0.35, g: 0.2, type: 'triangle', f: 60, f2: 38, fd: 0.2, ft: 'lowpass', ff: 200 });
        }
        if (Math.random() < 0.1) glass(m, t, pick([81, 84, 86, 88, 89, 93]), 0.018);
      }
    },

    explore: {
      bpm: 84, fade: 1.5, tense: true,
      start: function (m) {
        filt(m, 320, 3);
        m.drones = [drone(m, 'sawtooth', N(38), 0.06, null, -8), drone(m, 'sawtooth', N(38), 0.06, null, 8),
          drone(m, 'sawtooth', N(45), 0.04), drone(m, 'sine', N(26), 0.12, m.gain)];
        m.fifth = m.drones[2];
        lfo(m, 0.05, 60, [m.filt.frequency]);
      },
      step: function (m, i, t) {
        var s16 = i % 16, bar = i >> 4, root = [38, 34, 36, 33][(bar >> 1) % 4];
        if (s16 === 0 && bar % 2 === 0) {
          [0, 0, 7, -12].forEach(function (k, j) { m.drones[j].frequency.setTargetAtTime(N(root + k), t, 0.8); });
        }
        if (s16 % 2 === 0) {
          mv(m, { t: t, d: 0.16, g: s16 % 8 === 0 ? 0.07 : 0.04, type: 'sawtooth', f: N(root + 12),
            ft: 'lowpass', ff: 700 * (1 + 2 * tension), ff2: 150, q: 4 });
        }
        var k = [0, 3, 6, 10].indexOf(s16);
        if (k >= 0 && bar % 2 === 1) {
          var note = [74, 77, 76, 69][k];
          if (k === 3 && Math.random() < tension) note = 68;   // flat fifth creeps in
          mv(m, { t: t, d: 0.3, g: 0.035, type: 'triangle', f: N(note), send: 0.4 });
        }
        if (s16 === 4 && Math.random() < 0.2) play('clank', t, 0.8 + Math.random() * 0.4, 0.2, m.out);
      }
    },

    combat: {
      bpm: 118, fade: 0.8, tense: true,
      start: function (m) {
        filt(m, 180, 2);
        m.drones = [drone(m, 'sawtooth', N(26), 0.08, null, 5)];
      },
      step: groove
    },

    boss: {
      bpm: 126, fade: 0.8, tense: true,
      start: function (m) {
        filt(m, 180, 2);
        var mix = ctx.createGain();
        [[700, 6, 2.5], [1150, 8, 1.5], [2800, 10, 0.8]].forEach(function (fm) {
          var b = ctx.createBiquadFilter(), g = ctx.createGain();
          b.type = 'bandpass'; b.frequency.value = fm[0]; b.Q.value = fm[1]; g.gain.value = fm[2];
          mix.connect(b); b.connect(g); g.connect(m.gain);
        });
        m.choir = CHOIR[0].map(function (n, k) { return drone(m, 'sawtooth', N(n), 0.1, mix, [-5, 6, 0][k]); });
        lfo(m, 5, 2.5, m.choir.map(function (o) { return o.frequency; }));
        m.drones = [drone(m, 'sawtooth', N(26), 0.08, null, 5)].concat(m.choir);
      },
      step: function (m, i, t) {
        groove(m, i, t);
        var s16 = i % 16, bar = i >> 4;
        if (s16 === 0 || s16 === 8) {
          mv(m, { t: t, d: 1.1, g: 0.5, type: 'sine', f: 58, f2: 30, fd: 0.5 });
          mv(m, { t: t, d: 0.9, g: 0.12, type: 'sawtooth', f: N(26), ft: 'lowpass', ff: 160, q: 2 });
        }
        if (s16 === 0 && bar % 2 === 0) {
          var c = CHOIR[(bar >> 1) % 4];
          m.choir.forEach(function (o, k) { o.frequency.setTargetAtTime(N(c[k]), t, 0.15); });
        }
      }
    },

    death: {
      bpm: 40, fade: 0.05,
      start: function (m, t) {
        [62, 61, 58, 57, 55, 53, 52, 50].forEach(function (n, k) {
          brass(m, t + k * 0.45, [n, n - 12], k === 7 ? 4 : 0.9, 0.05, 0.08);
        });
        play('bell', t + 3.6, 0.5, 0.4, m.out);
        filt(m, 200, 1);
        [drone(m, 'sawtooth', N(26), 0), drone(m, 'sawtooth', N(38), 0, null, 7)].forEach(function (o) {
          o._g.gain.setTargetAtTime(0.1, t + 3.5, 0.5);
          o._g.gain.setTargetAtTime(0.03, t + 7, 4);
        });
      },
      step: function () {}
    },

    win: {
      bpm: 60, fade: 0.05,
      start: function (m, t) {
        [[50, 53, 57], [46, 50, 53, 58], [45, 49, 52, 57], [50, 54, 57, 62]].forEach(function (c, k) {
          brass(m, t + k * 0.55, c, k === 3 ? 4.5 : 0.8, 0.035, 0.06);
        });
        play('bell', t + 1.65, 1.5, 0.35, m.out);
        play('bell', t + 2.2, 2, 0.2, m.out);
        filt(m, 500, 1);
        [drone(m, 'sine', N(38), 0), drone(m, 'triangle', N(45), 0, null, 4)].forEach(function (o, k) {
          o._g.gain.setTargetAtTime(k ? 0.03 : 0.07, t + 3, 1.5);
        });
      },
      step: function (m, i, t) {
        if (i % 4 === 0 && Math.random() < 0.15) glass(m, t, pick([69, 74, 76, 81]), 0.03);
      }
    }
  };

  function startMode(name) {
    var now = ctx.currentTime;
    if (cur) {
      var old = cur;
      old.gain.gain.setTargetAtTime(0, now, 0.5);
      old.nodes.forEach(function (n) { n.stop(now + 3); });
      setTimeout(function () { old.gain.disconnect(); }, 3500);
      cur = null;
    }
    var def = MODES.hasOwnProperty(name) ? MODES[name] : null;
    if (!def) return;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0, now);
    g.gain.setTargetAtTime(1, now, def.fade / 3);
    g.connect(musicBus);
    cur = { name: name, def: def, gain: g, out: { node: g, echo: musicEcho }, nodes: [], drones: [],
      step: 0, next: now + 0.1, tick: now + 0.5, tn: 0, beat: 0 };
    def.start(cur, now + 0.05);
    applyTension();
  }

  function applyTension() {
    if (!ctx || !cur || !cur.def.tense) return;
    var now = ctx.currentTime, m = cur, flat = -100 * clamp01((tension - 0.6) / 0.4);
    if (m.filt) m.filt.frequency.setTargetAtTime(m.cut * (1 + 3 * tension), now, 0.5);
    m.drones.forEach(function (o) {
      o.detune.setTargetAtTime(o._det * (1 + 2 * tension) + (o === m.fifth ? flat : 0), now, 0.8);
    });
  }

  // Tension clock: tick/tock every second (faster and louder near the end), heartbeat in the last minute.
  function clock(m, now, ahead) {
    var late = clamp01((tension - 0.7) / 0.3), last = clamp01((tension - 5 / 6) * 6);
    if (m.tick < now - 0.2) m.tick = now + 0.05;
    while (m.tick < ahead) {
      m.tn++;
      play(m.tn % 2 ? 'tick' : 'tock', m.tick, 1, 0.12 + 0.5 * tension, m.out);
      m.tick += 1 - 0.5 * late;
    }
    if (tension < 5 / 6) return;
    if (m.beat < now - 0.2) m.beat = now + 0.05;
    while (m.beat < ahead) {
      play('heartbeat', m.beat, 1, 0.35 + 0.65 * last, m.out);
      m.beat += 1 - 0.45 * last;
    }
  }

  function schedule() {
    if (!ctx || !cur) return;
    try {
      var m = cur, now = ctx.currentTime, ahead = now + LOOKAHEAD;
      var speed = m.def.tense ? 1 + 0.25 * tension : 1;
      if (m.next < now - 0.2) m.next = now + 0.05;   // skip notes missed while the tab was throttled
      while (m.next < ahead) {
        m.def.step(m, m.step, m.next);
        m.step++;
        m.next += 15 / (m.def.bpm * speed);
      }
      if (m.def.tense) clock(m, now, ahead);
    } catch (e) { /* audio must never break the game */ }
  }

  // ---------------------------------------------------------------- API

  DD.Audio = {
    init: function () {
      if (!AC) return;
      if (!ctx) {
        try { build(); } catch (e) { ctx = null; return; }   // no usable WebAudio: stay silent
      }
      try {
        if (!cur && wanted !== 'none') startMode(wanted);
        if (ctx.state !== 'running') {
          var p = ctx.resume();
          if (p && p.catch) p.catch(function () {});
          var b = ctx.createBufferSource();   // iOS unlock
          b.buffer = ctx.createBuffer(1, 1, 22050);
          b.connect(ctx.destination);
          b.start(0);
        }
      } catch (e) { /* no audio available */ }
    },

    sfx: function (name, opts) {
      if (!ctx || muted || ctx.state !== 'running' || !SFX.hasOwnProperty(name)) return;
      opts = opts || {};
      var v = typeof opts.vol === 'number' ? opts.vol : 1;
      var now = ctx.currentTime;
      if (v <= 0 || now - (lastPlayed[name] || -1) < 0.03) return;
      busy = busy.filter(function (e) { return e > now; });
      if (busy.length >= MAX_SFX) return;
      lastPlayed[name] = now;
      var p = (opts.pitch > 0 ? opts.pitch : 1) * (0.96 + Math.random() * 0.08);
      try { busy.push(play(name, now + 0.005, p, v, SFX_OUT)); } catch (e) { /* ignore */ }
    },

    music: function (mode) {
      if (mode === wanted) return;
      wanted = mode;
      if (ctx) startMode(mode);
    },

    setTension: function (t) {
      t = clamp01(+t || 0);
      if (Math.abs(t - tension) < 0.01) return;
      tension = t;
      applyTension();
    },

    setVolumes: function (v) {
      if (!v) return;
      ['master', 'music', 'sfx'].forEach(function (k) {
        if (typeof v[k] === 'number' && !isNaN(v[k])) vol[k] = clamp01(v[k]);
      });
      applyVolumes();
    },

    getVolumes: function () { return { master: vol.master, music: vol.music, sfx: vol.sfx }; },

    mute: function (flag) {
      muted = flag === undefined ? !muted : !!flag;
      applyVolumes();
    },

    isMuted: function () { return muted; }
  };
})();
