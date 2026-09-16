/* Deadlock Deck: El Reloj Anatómico — sound effects.
 *
 * A small Web Audio synthesis toolkit (oscillators, filtered noise, a soft-clip
 * waveshaper) plus the frozen table of named sounds from SPEC 6.3. No samples,
 * no files, no dependencies.
 *
 * Everything is lazy. DD.Audio.init() is the only place an AudioContext is ever
 * constructed (it must be called from a user gesture) and it is safe to call
 * repeatedly. Every other entry point silently no-ops while the context is
 * missing, so a browser without Web Audio can never break the game. */
(function () {
  'use strict';
  var DD = window.DD;
  var A = DD.Audio = DD.Audio || {};

  /* ---------------------------------------------------------------- state */
  A.ctx = null;        // AudioContext — created by init() and by nothing else
  A.buses = null;      // {master, limiter, sfx, music}
  var noiseBuf = null; // cached white noise, shared with the music voices
  var shaper = null;   // cached soft-clip node, all grit goes through it
  var volMusic = 0.6, volSfx = 0.9, muted = false;
  var lastAt = {};     // name -> ctx time of the last play (per-name throttle)
  var THROTTLE = 0.03; // ~30 ms, so a burst of repeats does not turn into a buzz

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* ----------------------------------------------------------------- init */
  A.init = function () {
    if (A.ctx) {
      /* A browser may suspend the context again (tab switch, policy); resume. */
      if (A.ctx.state === 'suspended' && A.ctx.resume) {
        try { A.ctx.resume(); } catch (e) { /* ignore */ }
      }
    } else {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      try { A.ctx = new AC(); } catch (e) { A.ctx = null; return null; }
    }
    if (!A.buses) {
      try { buildBuses(); } catch (e) { A.buses = null; A.ctx = null; return null; }
    }
    applyVolume();
    /* Music may have been requested before the first gesture; let it start. */
    if (A.music && A.music._wake) {
      try { A.music._wake(); } catch (e) { /* ignore */ }
    }
    return A.ctx;
  };

  function buildBuses() {
    var ctx = A.ctx;
    var limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -10;
    limiter.knee.value = 6;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.003;
    limiter.release.value = 0.25;
    limiter.connect(ctx.destination);

    var master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(limiter);

    var sfx = ctx.createGain();
    sfx.gain.value = volSfx;
    sfx.connect(master);

    var music = ctx.createGain();
    music.gain.value = volMusic;
    music.connect(master);

    A.buses = { master: master, limiter: limiter, sfx: sfx, music: music };
    noiseBuf = makeNoise(2);
    shaper = makeShaper();
    shaper.connect(sfx);
  }

  function applyVolume() {
    if (!A.buses) return;
    var t = A.ctx.currentTime;
    A.buses.master.gain.setTargetAtTime(muted ? 0 : 1, t, 0.02);
    A.buses.sfx.gain.setTargetAtTime(volSfx, t, 0.02);
    A.buses.music.gain.setTargetAtTime(volMusic, t, 0.02);
  }

  A.setVolume = function (music, sfx) {
    if (typeof music === 'number') volMusic = clamp(music, 0, 1);
    if (typeof sfx === 'number') volSfx = clamp(sfx, 0, 1);
    applyVolume();
  };

  Object.defineProperty(A, 'muted', {
    configurable: true,
    get: function () { return muted; },
    set: function (v) { muted = !!v; applyVolume(); }
  });

  /* -------------------------------------------------------- shared buffers */
  function makeNoise(sec) {
    var ctx = A.ctx;
    var len = Math.max(1, Math.floor(ctx.sampleRate * sec));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }

  /* Soft clip. The curve is fixed, so one node serves every voice. */
  function makeShaper() {
    var n = 1024, k = 2.6, curve = new Float32Array(n), i, x, e;
    for (i = 0; i < n; i++) {
      x = (i / (n - 1)) * 2 - 1;
      e = Math.exp(2 * x * k);
      curve[i] = (e - 1) / (e + 1) * 0.86;
    }
    var ws = A.ctx.createWaveShaper();
    ws.curve = curve;
    ws.oversample = '2x';
    return ws;
  }

  /* Music (and anything else) may reuse the cached noise buffer. */
  A.noiseBuffer = function () { return noiseBuf; };

  /* --------------------------------------------------------- voice toolkit */
  /* An attack/decay envelope on a fresh GainNode. Every voice owns one so it can
   * schedule its own stop; nothing is ever left running. */
  function mkEnv(t, dur, peak, atk, rel) {
    var g = A.ctx.createGain();
    var p = g.gain;
    var a = Math.min(Math.max(atk, 0.001), dur * 0.5);
    var r = Math.min(Math.max(rel === undefined ? dur * 0.5 : rel, 0.008), Math.max(0.008, dur - a));
    peak = Math.max(0.0002, peak);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, t + dur - r);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  /* Free-running LFO added to any AudioParam: tremolo, growl wobble, vibrato. */
  function wobble(param, rate, depth, t, dur) {
    var lfo = A.ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = rate;
    var d = A.ctx.createGain();
    d.gain.value = depth;
    lfo.connect(d);
    d.connect(param);
    lfo.start(t);
    lfo.stop(t + dur + 0.05);
  }

  /* Pitched voice. o: {to, peak, atk, rel, detune, drive, vib, vibD}.
   * Returns its envelope GainNode so a caller can wobble it. */
  function tone(type, f0, t, dur, o) {
    o = o || {};
    var os = A.ctx.createOscillator();
    os.type = type;
    os.frequency.setValueAtTime(Math.max(1, f0), t);
    if (o.to) {
      os.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t + dur * (o.glide || 1));
    }
    if (o.detune) os.detune.setValueAtTime(o.detune, t);
    if (o.vib) wobble(os.frequency, o.vib, o.vibD || 3, t, dur);
    var g = mkEnv(t, dur, o.peak === undefined ? 0.3 : o.peak, o.atk === undefined ? 0.004 : o.atk, o.rel);
    os.connect(g);
    if (o.drive) g.connect(shaper); else g.connect(A.buses.sfx);
    os.start(t);
    os.stop(t + dur + 0.03);
    return g;
  }

  /* Noise voice. o: {filter, from, to, q, peak, atk, rel, sweep, rate, drive}.
   * Returns {f: BiquadFilterNode, g: GainNode}. */
  function noise(t, dur, o) {
    o = o || {};
    var src = A.ctx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    if (o.rate) src.playbackRate.value = o.rate;
    var f = A.ctx.createBiquadFilter();
    f.type = o.filter || 'lowpass';
    var from = Math.max(20, o.from === undefined ? 900 : o.from);
    f.frequency.setValueAtTime(from, t);
    if (o.to) {
      f.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur * (o.sweep || 1));
    }
    f.Q.value = o.q === undefined ? 0.9 : o.q;
    var g = mkEnv(t, dur, o.peak === undefined ? 0.35 : o.peak, o.atk === undefined ? 0.003 : o.atk, o.rel);
    src.connect(f);
    f.connect(g);
    if (o.drive) g.connect(shaper); else g.connect(A.buses.sfx);
    src.start(t, Math.random() * 1.5); // random offset: repeats never phase-lock
    src.stop(t + dur + 0.03);
    return { f: f, g: g, src: src };
  }

  /* A few inharmonic partials: metal, glass, bone. */
  function ring(t, freqs, dur, peak, r, type) {
    for (var i = 0; i < freqs.length; i++) {
      tone(type || 'sine', freqs[i] * (r || 1), t, dur * (1 - i * 0.13), {
        peak: peak * (1 - i * 0.24),
        atk: 0.002,
        rel: dur * 0.5
      });
    }
  }

  /*-------------------------------------------------------------------- sfx */
  var SFX = {};

  /* Soft wet scuff. */
  SFX.step = function (t, v, r) {
    noise(t, 0.09, { from: 900 * r, to: 220, peak: 0.16 * v, q: 0.8 });
    tone('sine', 96 * r, t, 0.07, { to: 58, peak: 0.16 * v });
  };

  /* Short percussive thud. */
  SFX.hit = function (t, v, r) {
    tone('sine', 180 * r, t, 0.13, { to: 58, peak: 0.55 * v, atk: 0.002 });
    noise(t, 0.1, { from: 1400 * r, to: 180, peak: 0.34 * v, q: 0.7, drive: true });
  };

  /* Deep bone-crack with a metallic ring. LOUD. */
  SFX.hit_heavy = function (t, v, r) {
    v *= 1.4;
    noise(t, 0.26, { from: 1300 * r, to: 95, peak: 0.5 * v, q: 0.6, drive: true });
    tone('sawtooth', 78 * r, t, 0.3, { to: 36, peak: 0.42 * v, atk: 0.003, drive: true });
    tone('triangle', 42 * r, t, 0.34, { to: 30, peak: 0.4 * v, atk: 0.003 });
    ring(t + 0.005, [1160, 1740, 2320], 0.55, 0.1 * v, r);
  };

  /* Metal clang. */
  SFX.block = function (t, v, r) {
    noise(t, 0.06, { from: 5200 * r, to: 2600, peak: 0.26 * v, filter: 'bandpass', q: 1.2, drive: true });
    ring(t, [523, 784, 1310, 1970], 0.45, 0.15 * v, r);
    tone('triangle', 150 * r, t, 0.12, { to: 96, peak: 0.22 * v });
  };

  /* Paper flick. */
  SFX.card = function (t, v, r) {
    noise(t, 0.055, { from: 4200 * r, to: 1500, peak: 0.2 * v, filter: 'highpass', q: 0.7 });
  };

  /* Paper flick, a little longer and lower — a card leaving the draw pile. */
  SFX.draw = function (t, v, r) {
    noise(t, 0.09, { from: 3200 * r, to: 900, peak: 0.22 * v, filter: 'highpass', q: 0.7, sweep: 0.7 });
    noise(t + 0.02, 0.07, { from: 5200, to: 2200, peak: 0.12 * v, filter: 'highpass' });
  };

  /* Whoosh plus a chime — a card being committed. */
  SFX.card_play = function (t, v, r) {
    noise(t, 0.3, { from: 300, to: 2600, peak: 0.24 * v, filter: 'bandpass', q: 1.6, sweep: 0.6 });
    noise(t + 0.06, 0.26, { from: 2600, to: 400, peak: 0.16 * v, filter: 'bandpass', q: 1.4 });
    ring(t + 0.12, [784 * r, 1176 * r, 1568 * r], 0.55, 0.13 * v, 1);
  };

  /* The signature sound: a wet squelch resolving into a low, satisfied hum. */
  SFX.graft = function (t, v, r) {
    var n = noise(t, 0.34, { from: 1100 * r, to: 140, peak: 0.42 * v, q: 3.2, drive: true });
    wobble(n.g.gain, 13, 0.16 * v, t, 0.34);
    wobble(n.f.frequency, 7, 260, t, 0.34);
    tone('sawtooth', 92 * r, t, 0.42, { to: 54, peak: 0.3 * v, atk: 0.006, drive: true });
    tone('sawtooth', 138 * r, t + 0.01, 0.42, { to: 81, peak: 0.2 * v, detune: 18, drive: true });
    tone('triangle', 82.4 * r, t + 0.3, 1.35, { peak: 0.22 * v, atk: 0.12, vib: 5.5, vibD: 1.6 });
    tone('triangle', 123.5 * r, t + 0.32, 1.3, { peak: 0.13 * v, atk: 0.14 });
  };

  /* Pure wet flesh. */
  SFX.squish = function (t, v, r) {
    var n = noise(t, 0.2, { from: 760 * r, to: 130, peak: 0.4 * v, q: 2.4 });
    wobble(n.f.frequency, 22, 190, t, 0.2);
    wobble(n.g.gain, 15, 0.14 * v, t, 0.2);
    tone('sawtooth', 120 * r, t, 0.16, { to: 60, peak: 0.2 * v, drive: true });
  };

  /* Brittle snap with debris. LOUD. */
  SFX.break = function (t, v, r) {
    v *= 1.35;
    noise(t, 0.03, { from: 6000 * r, to: 3800, peak: 0.4 * v, filter: 'highpass', q: 0.6 });
    noise(t, 0.16, { from: 2200 * r, to: 320, peak: 0.4 * v, filter: 'bandpass', q: 1.8, drive: true });
    tone('triangle', 320 * r, t, 0.12, { to: 90, peak: 0.3 * v });
    for (var i = 0; i < 5; i++) {
      noise(t + 0.05 + Math.random() * 0.32, 0.04, {
        from: 3400 + Math.random() * 2600, to: 1400,
        peak: 0.1 * v, filter: 'bandpass', q: 3
      });
    }
  };

  /* Ascending screech that clips. LOUD. */
  SFX.overheat = function (t, v, r) {
    v *= 1.4;
    tone('sawtooth', 300 * r, t, 0.95, { to: 2700, peak: 0.26 * v, atk: 0.05, drive: true, vib: 9, vibD: 22 });
    tone('square', 452 * r, t, 0.9, { to: 3300, peak: 0.12 * v, atk: 0.08, drive: true });
    noise(t, 0.95, { from: 700, to: 5200, peak: 0.2 * v, filter: 'bandpass', q: 2.2, atk: 0.1, drive: true });
    ring(t + 0.7, [3000 * r, 4400 * r], 0.4, 0.1 * v, 1, 'triangle');
  };

  /* Animal rumble. LOUD. */
  SFX.growl = function (t, v, r) {
    v *= 1.35;
    var dur = 1.1;
    var n = noise(t, dur, { from: 620 * r, to: 150, peak: 0.34 * v, q: 2.6, atk: 0.06, drive: true, rel: 0.5 });
    wobble(n.g.gain, 11, 0.2 * v, t, dur);
    wobble(n.f.frequency, 8, 120, t, dur);
    wobble(tone('sawtooth', 58 * r, t, dur, { to: 46, peak: 0.34 * v, atk: 0.08, drive: true }).gain, 10, 0.11 * v, t, dur);
    tone('sawtooth', 87 * r, t, dur, { to: 66, peak: 0.2 * v, atk: 0.1, detune: 24, drive: true });
    tone('triangle', 29 * r, t, dur, { peak: 0.3 * v, atk: 0.1 });
  };

  /* Long falling gurgle. LOUD. */
  SFX.death = function (t, v, r) {
    v *= 1.4;
    var dur = 2.2;
    var n = noise(t, dur, { from: 700 * r, to: 85, peak: 0.34 * v, q: 3, atk: 0.02, rel: 0.7, drive: true });
    wobble(n.f.frequency, 5.5, 240, t, dur);
    wobble(n.g.gain, 9, 0.14 * v, t, dur);
    wobble(tone('sawtooth', 168 * r, t, dur, { to: 34, peak: 0.34 * v, atk: 0.03, drive: true }).gain, 6.5, 0.12 * v, t, dur);
    tone('triangle', 84 * r, t + 0.05, dur * 0.9, { to: 24, peak: 0.3 * v, atk: 0.05 });
    tone('sawtooth', 250 * r, t, dur * 0.6, { to: 60, peak: 0.16 * v, detune: -22, drive: true });
  };

  /* Bright alchemical chime. */
  SFX.pickup = function (t, v, r) {
    var notes = [880, 1320, 1760], i, tt;
    for (i = 0; i < notes.length; i++) {
      tt = t + i * 0.055;
      tone('sine', notes[i] * r, tt, 0.75 - i * 0.12, { peak: 0.2 * v, atk: 0.004, rel: 0.6 });
      tone('sine', notes[i] * 2.76 * r, tt, 0.32, { peak: 0.05 * v, atk: 0.004 });
    }
    noise(t, 0.12, { from: 5000, to: 1800, peak: 0.07 * v, filter: 'highpass' });
  };

  /* Sharp mechanical snap. */
  SFX.trap = function (t, v, r) {
    noise(t, 0.025, { from: 7000 * r, to: 4200, peak: 0.3 * v, filter: 'highpass' });
    tone('square', 420 * r, t, 0.05, { to: 110, peak: 0.3 * v, atk: 0.001, drive: true });
    ring(t + 0.01, [1480 * r, 2210 * r], 0.22, 0.11 * v, 1);
    noise(t + 0.012, 0.07, { from: 1800, to: 500, peak: 0.16 * v, filter: 'bandpass', q: 2.5 });
  };

  /* Heavy stone and iron. */
  SFX.door = function (t, v, r) {
    var n = noise(t, 0.85, { from: 420 * r, to: 70, peak: 0.4 * v, q: 0.8, atk: 0.02, rel: 0.4, drive: true });
    wobble(n.f.frequency, 4.5, 130, t, 0.85);
    wobble(n.g.gain, 3.5, 0.1 * v, t, 0.85);
    tone('sawtooth', 62 * r, t, 0.8, { to: 40, peak: 0.26 * v, atk: 0.03, drive: true });
    noise(t + 0.1, 0.5, { from: 1100, to: 300, peak: 0.14 * v, filter: 'bandpass', q: 1.1, atk: 0.05 });
    ring(t + 0.42, [186 * r, 279 * r, 470 * r], 0.7, 0.13 * v, 1);
    tone('triangle', 128 * r, t + 0.42, 0.5, { to: 74, peak: 0.2 * v, atk: 0.01 });
  };

  /* A rising major triad — the way out. */
  SFX.escape = function (t, v, r) {
    var seq = [220, 277.2, 329.6, 440, 554.4, 659.2], i, tt;
    for (i = 0; i < seq.length; i++) {
      tt = t + i * 0.085;
      tone('triangle', seq[i] * r, tt, 0.9 - i * 0.06, { peak: 0.2 * v, atk: 0.006, rel: 0.5 });
      tone('sine', seq[i] * 2 * r, tt, 0.4, { peak: 0.07 * v, atk: 0.004 });
    }
    tone('sawtooth', 110 * r, t, 0.75, { peak: 0.1 * v, atk: 0.02, drive: true });
    noise(t, 0.5, { from: 900, to: 4200, peak: 0.07 * v, filter: 'bandpass', q: 1.4, atk: 0.2 });
  };

  /* Two-tone klaxon that cuts through the mix. */
  SFX.alarm = function (t, v, r) {
    var tones = [622, 466, 622, 466], i, tt, g;
    for (i = 0; i < tones.length; i++) {
      tt = t + i * 0.19;
      g = tone('square', tones[i] * r, tt, 0.17, { peak: 0.22 * v, atk: 0.008, drive: true });
      wobble(g.gain, 30, 0.03 * v, tt, 0.17);
      tone('sawtooth', tones[i] * 0.5 * r, tt, 0.17, { peak: 0.1 * v, atk: 0.008, drive: true });
    }
  };

  /* Short dry clicks. */
  SFX.ui_move = function (t, v, r) {
    noise(t, 0.018, { from: 2600 * r, to: 1500, peak: 0.16 * v, filter: 'highpass' });
    tone('sine', 1250 * r, t, 0.022, { to: 820, peak: 0.1 * v, atk: 0.001 });
  };

  SFX.ui_select = function (t, v, r) {
    noise(t, 0.03, { from: 2200 * r, to: 900, peak: 0.2 * v, filter: 'highpass' });
    tone('sine', 900 * r, t, 0.06, { to: 520, peak: 0.16 * v, atk: 0.001 });
    tone('triangle', 1350 * r, t, 0.05, { to: 900, peak: 0.07 * v, atk: 0.001 });
  };

  /* Woodblock. */
  SFX.tick = function (t, v, r) {
    tone('triangle', 1180 * r, t, 0.045, { to: 860, peak: 0.2 * v, atk: 0.001 });
    tone('sine', 520 * r, t, 0.07, { to: 430, peak: 0.12 * v, atk: 0.001 });
    noise(t, 0.016, { from: 3400, to: 1800, peak: 0.1 * v, filter: 'bandpass', q: 1.6 });
  };

  /* Double low thump. */
  SFX.heartbeat = function (t, v, r) { thump(t, v, r); thump(t + 0.3, v * 0.72, r); };
  function thump(t, v, r) {
    tone('sine', 62 * r, t, 0.19, { to: 34, peak: 0.55 * v, atk: 0.006 });
    noise(t, 0.12, { from: 420, to: 90, peak: 0.16 * v, q: 0.9 });
  }

  /* Coin-and-glass shimmer. */
  SFX.loot = function (t, v, r) {
    var f = [1568, 2093, 2637, 3136, 2794], i, tt;
    for (i = 0; i < f.length; i++) {
      tt = t + Math.random() * 0.09 + i * 0.02;
      tone('sine', f[i] * r, tt, 0.4 + Math.random() * 0.25, { peak: 0.09 * v, atk: 0.002, rel: 0.3 });
      tone('sine', f[i] * 2.76 * r, tt, 0.16, { peak: 0.03 * v, atk: 0.002 });
    }
    noise(t, 0.16, { from: 6000, to: 2200, peak: 0.08 * v, filter: 'highpass' });
    tone('triangle', 523 * r, t, 0.35, { peak: 0.1 * v, atk: 0.004 });
  };

  /* Triumphant organ chord. */
  SFX.levelup = function (t, v, r) {
    var chord = [110, 164.8, 220, 261.6, 329.6], i;
    for (i = 0; i < chord.length; i++) {
      tone('sawtooth', chord[i] * r, t, 1.9, { peak: 0.13 * v, atk: 0.07, rel: 0.9, drive: i > 2 });
      tone('sawtooth', chord[i] * r, t, 1.9, { peak: 0.1 * v, atk: 0.09, rel: 0.9, detune: 9 });
      tone('triangle', chord[i] * 0.5 * r, t, 1.9, { peak: 0.09 * v, atk: 0.06, rel: 0.9 });
    }
    tone('sine', 1760 * r, t + 0.05, 1.1, { peak: 0.06 * v, atk: 0.01, rel: 0.8 });
    noise(t, 0.5, { from: 3000, to: 8000, peak: 0.05 * v, filter: 'highpass', atk: 0.12 });
  };

  /* ---------------------------------------------------------------- player */
  function play(name, opts) {
    if (!A.ctx || muted) return;                 // no context yet, or silenced
    var fn = SFX[name];
    if (!fn) return;                             // unknown name: ignore, never throw
    var now = A.ctx.currentTime;
    if (lastAt[name] !== undefined && now - lastAt[name] < THROTTLE) return;
    lastAt[name] = now;
    opts = opts || {};
    var vol = (opts.vol === undefined ? 1 : Math.max(0, opts.vol)) * volSfx;
    if (vol <= 0) return;
    var rate = opts.rate > 0 ? opts.rate : 1;
    try {
      fn(now + 0.008, vol, rate);
    } catch (e) {
      /* A voice that fails must never take the game down with it. */
    }
  }

  A.sfx = { play: play };
})();
