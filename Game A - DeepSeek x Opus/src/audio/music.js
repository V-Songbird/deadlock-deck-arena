/* Deadlock Deck: El Reloj Anatómico — the score.
 *
 * Five tracks of generated music: detuned saw pads, a triangle bass, sine bells,
 * filtered-noise percussion, all fed into one generated convolution reverb so it
 * sounds like a cathedral instead of a MIDI file. No samples, no dependencies.
 *
 * A setInterval scheduler looks ~300 ms ahead and schedules every note at an
 * exact AudioContext time (never from rAF — that drifts and it sounds wrong).
 * Everything is lazy: no node is created until DD.Audio.init() has been called
 * from a user gesture, and every entry point no-ops until then. */
(function () {
  'use strict';
  var DD = window.DD;
  var A = DD.Audio = DD.Audio || {};

  var LOOKAHEAD = 0.3;   // seconds of score scheduled ahead of the clock
  var TICK = 100;        // scheduler period, ms
  var FADE = 1.5;        // cross-fade, seconds

  var ctx = null;        // the shared AudioContext (owned by sfx.js)
  var bus = null;        // music bus (owned by sfx.js)
  var verb = null;       // ConvolverNode, one shared bus
  var verbOut = null;
  var timer = null;
  var current = null;    // the playing instance
  var wanted = null;     // last track asked for, so init() can start it late
  var intensity = 0;

  function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

  /* --------------------------------------------------- context and reverb */
  /* Builds the context-dependent nodes once. False while init() has not run. */
  function ensure() {
    if (!A.ctx || !A.buses || !A.buses.music) return false;
    if (ctx === A.ctx) return true;
    ctx = A.ctx;
    bus = A.buses.music;
    verb = ctx.createConvolver();
    verb.buffer = makeIR(2.6, 2.4);
    verbOut = ctx.createGain();
    verbOut.gain.value = 0.85;
    verb.connect(verbOut);
    verbOut.connect(bus);
    return true;
  }

  /* Exponentially decaying noise: a cathedral tail, generated, not sampled. */
  function makeIR(sec, decay) {
    var rate = ctx.sampleRate;
    var len = Math.max(1, Math.floor(rate * sec));
    var pre = Math.floor(rate * 0.014);   // small pre-delay, a bigger room
    var buf = ctx.createBuffer(2, len, rate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) {
        if (i < pre) { d[i] = 0; continue; }
        var x = (i - pre) / (len - pre);
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - x, decay);
      }
    }
    return buf;
  }

  function noiseSrc() {
    var buf = A.noiseBuffer ? A.noiseBuffer() : null;
    if (!buf) return null;
    var s = ctx.createBufferSource();
    s.buffer = buf;
    s.loop = true;
    return s;
  }

  /* ------------------------------------------------------------ envelopes */
  /* Attack / hold / release on a fresh GainNode. Every voice schedules its own
   * stop, so nothing is left running. */
  function env(t, dur, atk, peak, rel) {
    var g = ctx.createGain();
    var p = g.gain;
    var a = Math.min(Math.max(atk, 0.002), dur * 0.6);
    var r = Math.min(Math.max(rel === undefined ? dur * 0.4 : rel, 0.02), Math.max(0.02, dur - a));
    peak = Math.max(0.0002, peak);
    p.setValueAtTime(0.0001, t);
    p.linearRampToValueAtTime(peak, t + a);
    p.setValueAtTime(peak, t + dur - r);
    p.exponentialRampToValueAtTime(0.0001, t + dur);
    return g;
  }

  /* ---------------------------------------------------------------- voices */
  /* Pad / strings: a detuned saw pair. The detune widens as the clock runs down. */
  function padNote(inst, t, f, dur, gain) {
    var det = 5 + intensity * 26;
    for (var i = 0; i < 2; i++) {
      var os = ctx.createOscillator();
      os.type = 'sawtooth';
      os.frequency.setValueAtTime(f, t);
      os.detune.setValueAtTime(i ? det : -det, t);
      var g = env(t, dur, Math.min(0.9, dur * 0.3), gain, dur * 0.45);
      os.connect(g);
      g.connect(inst.pad);
      os.start(t);
      os.stop(t + dur + 0.05);
    }
  }

  /* Bass: a triangle with a quiet saw for body. */
  function bassNote(inst, t, f, dur, gain) {
    var os = ctx.createOscillator();
    os.type = 'triangle';
    os.frequency.setValueAtTime(f, t);
    var g = env(t, dur, 0.012, gain, dur * 0.6);
    os.connect(g);
    g.connect(inst.mix);
    os.start(t);
    os.stop(t + dur + 0.03);

    var o2 = ctx.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.setValueAtTime(f, t);
    o2.detune.setValueAtTime(7, t);
    var g2 = env(t, dur, 0.014, gain * 0.32, dur * 0.6);
    o2.connect(g2);
    g2.connect(inst.mix);
    o2.start(t);
    o2.stop(t + dur + 0.03);
  }

  /* Bell: a sine with a fast attack plus one inharmonic partial. */
  function bellNote(inst, t, f, dur, gain) {
    var os = ctx.createOscillator();
    os.type = 'sine';
    os.frequency.setValueAtTime(f, t);
    var g = env(t, dur, 0.004, gain, dur * 0.8);
    os.connect(g);
    g.connect(inst.mix);
    os.start(t);
    os.stop(t + dur + 0.03);

    var o2 = ctx.createOscillator();
    o2.type = 'sine';
    o2.frequency.setValueAtTime(f * 2.76, t);
    var g2 = env(t, dur * 0.5, 0.004, gain * 0.3, dur * 0.4);
    o2.connect(g2);
    g2.connect(inst.mix);
    o2.start(t);
    o2.stop(t + dur * 0.5 + 0.03);
  }

  /* Pluck: short, dry, creeping. */
  function pluckNote(inst, t, f, dur, gain) {
    var os = ctx.createOscillator();
    os.type = 'triangle';
    os.frequency.setValueAtTime(f, t);
    var g = env(t, dur, 0.003, gain, dur * 0.85);
    os.connect(g);
    g.connect(inst.mix);
    os.start(t);
    os.stop(t + dur + 0.03);
  }

  /* Shrill lead: a saw through a narrow bandpass. */
  function leadNote(inst, t, f, dur, gain) {
    var os = ctx.createOscillator();
    os.type = 'sawtooth';
    os.frequency.setValueAtTime(f, t);
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(f * 2.2, t);
    bp.Q.value = 5;
    var g = env(t, dur, 0.008, gain, dur * 0.5);
    os.connect(bp);
    bp.connect(g);
    g.connect(inst.mix);
    os.start(t);
    os.stop(t + dur + 0.03);
  }

  /* Organ: three saws and a sub, filtered — the death track's voice. */
  function organNote(inst, t, f, dur, gain) {
    for (var i = 0; i < 3; i++) {
      var os = ctx.createOscillator();
      os.type = 'sawtooth';
      os.frequency.setValueAtTime(f, t);
      os.detune.setValueAtTime((i - 1) * 9, t);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(900 + i * 260, t);
      var g = env(t, dur, 0.35, gain * (i === 1 ? 1 : 0.7), dur * 0.4);
      os.connect(lp);
      lp.connect(g);
      g.connect(inst.mix);
      os.start(t);
      os.stop(t + dur + 0.05);
    }
    var sub = ctx.createOscillator();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(f / 2, t);
    var gs = env(t, dur, 0.4, gain * 0.4, dur * 0.4);
    sub.connect(gs);
    gs.connect(inst.mix);
    sub.start(t);
    sub.stop(t + dur + 0.05);
  }

  /* Dissonant cluster, used as a stab. */
  function stab(inst, t) {
    var f = nf(inst, 0, 1);
    for (var i = 0; i < 2; i++) {
      var os = ctx.createOscillator();
      os.type = 'sawtooth';
      os.frequency.setValueAtTime(f * (i ? 1.4142 : 1), t);   // a tritone apart
      os.detune.setValueAtTime(i ? 12 : -12, t);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(2400, t);
      lp.frequency.exponentialRampToValueAtTime(400, t + 0.7);
      var g = env(t, 0.8, 0.006, 0.11, 0.7);
      os.connect(lp);
      lp.connect(g);
      g.connect(inst.mix);
      os.start(t);
      os.stop(t + 0.85);
    }
  }

  /* Air: a filtered-noise swell, for space and dread. */
  function air(inst, t, dur, gain) {
    var src = noiseSrc();
    if (!src) return;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(300, t);
    bp.frequency.linearRampToValueAtTime(1600, t + dur);
    bp.Q.value = 0.8;
    var g = env(t, dur, dur * 0.8, gain, dur * 0.2);
    src.connect(bp);
    bp.connect(g);
    g.connect(inst.mix);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.05);
  }

  /* ----------------------------------------------------------- percussion */
  function kick(inst, t, gain) {
    var os = ctx.createOscillator();
    os.type = 'sine';
    os.frequency.setValueAtTime(130, t);
    os.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    var g = env(t, 0.2, 0.004, gain, 0.16);
    os.connect(g);
    g.connect(inst.mix);
    os.start(t);
    os.stop(t + 0.23);
  }

  function hat(inst, t, gain, open) {
    var dur = open ? 0.16 : 0.035;
    var src = noiseSrc();
    if (!src) return;
    var hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 6800;
    var g = env(t, dur, 0.002, gain, dur * 0.7);
    src.connect(hp);
    hp.connect(g);
    g.connect(inst.mix);
    src.start(t, Math.random() * 1.5);
    src.stop(t + dur + 0.03);
  }

  function snare(inst, t, gain) {
    var src = noiseSrc();
    if (!src) return;
    var bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1900;
    bp.Q.value = 1.1;
    var g = env(t, 0.13, 0.002, gain, 0.1);
    src.connect(bp);
    bp.connect(g);
    g.connect(inst.mix);
    src.start(t, Math.random() * 1.5);
    src.stop(t + 0.16);

    var os = ctx.createOscillator();
    os.type = 'triangle';
    os.frequency.setValueAtTime(196, t);
    os.frequency.exponentialRampToValueAtTime(150, t + 0.1);
    var g2 = env(t, 0.1, 0.002, gain * 0.5, 0.08);
    os.connect(g2);
    g2.connect(inst.mix);
    os.start(t);
    os.stop(t + 0.13);
  }

  /* ---------------------------------------------------------------- tracks */
  var TRACKS = {

    /* Slow, sparse: a lone bell over a low drone. A lot of space. */
    menu: {
      bpm: 60, root: 55.0, scale: [0, 2, 3, 5, 7, 8, 10],   // A1 aeolian
      step: function (inst, s, t) {
        var r = inst.rng;
        if (s % 64 === 0) {
          padNote(inst, t, nf(inst, 0, 0), inst.bar * 3.9, 0.16);
          padNote(inst, t + 0.4, nf(inst, 4, -1), inst.bar * 3.4, 0.09);
        }
        if (s % 32 === 0) bellNote(inst, t, nf(inst, r.int(0, 6) + 7, 2), 3.6, 0.13);
        else if (s % 32 === 18 && r.chance(0.5)) bellNote(inst, t, nf(inst, r.int(0, 6) + 7, 2), 2.6, 0.08);
        if (s === 0) air(inst, t, inst.bar * 4, 0.05);
      }
    },

    /* Tense and patient: a pulsing bass, a creeping arpeggio, rare stabs. */
    explore: {
      bpm: 84, root: 73.42, scale: [0, 1, 3, 5, 7, 8, 10],  // D2 phrygian
      step: function (inst, s, t) {
        var r = inst.rng, ph = s % 16, bar = Math.floor(s / 16);
        if (ph % 2 === 0) {
          bassNote(inst, t, nf(inst, (bar % 4 === 3) ? 4 : 0, -1), inst.d16 * 1.6, 0.13);
        }
        var creep = [0, 2, 3, 5, 4, 2, 1, 0];
        if (ph === 3 || ph === 7 || ph === 11 || ph === 14) {
          var i = (bar * 2 + (ph === 3 ? 0 : ph === 7 ? 1 : ph === 11 ? 2 : 3)) % creep.length;
          pluckNote(inst, t, nf(inst, creep[i], 1), 0.6, 0.07);
        }
        if (s % 64 === 0) padNote(inst, t, nf(inst, 0, 0), inst.bar * 1.9, 0.11);
        if (s % 64 === 32 && r.chance(0.7)) stab(inst, t);
        if (s % 128 === 64) air(inst, t, inst.bar * 4, 0.03);
      }
    },

    /* Driving and percussive: fast bass ostinato, kick on every beat, shrill lead. */
    combat: {
      bpm: 140, root: 82.41, scale: [0, 2, 3, 5, 7, 8, 11], // E2 harmonic minor
      step: function (inst, s, t) {
        var ph = s % 16;
        if (ph % 4 === 0) kick(inst, t, 0.42);
        if (ph % 4 === 2) hat(inst, t, 0.05, false);
        if (intensity > 0.45) {          // the clock is running out: extra layer
          if (ph % 2 === 1) hat(inst, t, 0.028, false);
          if (ph === 8) snare(inst, t, 0.24);
        }
        var ost = [0, 0, 12, 0, 7, 0, 10, 0, 0, 0, 12, 0, 8, 7, 5, 3];
        bassNote(inst, t, nf(inst, 0, -1) * Math.pow(2, ost[ph] / 12), inst.d16 * 0.9, 0.12);
        if (ph % 2 === 0) {
          var lead = [7, -1, 9, -1, 10, -1, 11, 12];
          var k = ((s / 2) % lead.length) | 0;
          if (lead[k] >= 0) leadNote(inst, t, nf(inst, lead[k], 2), inst.d16 * 1.6, 0.075);
        }
        if (s % 64 === 0) padNote(inst, t, nf(inst, 0, 0), inst.bar * 1.9, 0.1);
      }
    },

    /* Slow, descending, mournful: an organ line that never resolves. */
    death: {
      bpm: 52, root: 65.41, scale: [0, 2, 3, 5, 7, 8, 10],  // C2 aeolian
      step: function (inst, s, t) {
        var r = inst.rng, bar = Math.floor(s / 16);
        var line = [7, 5, 4, 2, 1, 0, -1, 3];               // falls, never lands
        if (s % 16 === 0) organNote(inst, t, nf(inst, line[bar % line.length], 0), inst.d16 * 15.5, 0.13);
        if (s % 16 === 8) organNote(inst, t, nf(inst, line[(bar + 1) % line.length], -1), inst.d16 * 7.5, 0.07);
        if (s % 128 === 0) {
          padNote(inst, t, nf(inst, 0, 0), inst.bar * 7.8, 0.1);
          air(inst, t, inst.bar * 7, 0.035);
        }
        if (s % 64 === 40) bellNote(inst, t, nf(inst, r.int(0, 3), 2), 3.2, 0.07);
      }
    },

    /* The one moment of release: a rising figure over a fast pulse. */
    escape: {
      bpm: 120, root: 98.0, scale: [0, 2, 3, 5, 7, 9, 10],  // G2 dorian, bright
      step: function (inst, s, t) {
        var ph = s % 16, bar = Math.floor(s / 16);
        if (ph % 4 === 0) kick(inst, t, 0.34);
        if (ph === 4 || ph === 12) snare(inst, t, 0.2);
        if (ph % 4 === 2) hat(inst, t, 0.045, false);
        if (ph % 2 === 0) bassNote(inst, t, nf(inst, (bar % 2) ? 4 : 0, -1), inst.d16 * 1.5, 0.11);
        if (ph % 4 === 0) {
          var deg = [3, 4, 5, 7, 8, 9, 10, 12][((s % 32) / 4) | 0];
          bellNote(inst, t, nf(inst, deg, 1), 1.5, 0.11);
          pluckNote(inst, t, nf(inst, deg, 2), 0.5, 0.05);
        }
        if (s % 32 === 0) {
          padNote(inst, t, nf(inst, 0, 0), inst.bar * 1.9, 0.12);
          padNote(inst, t, nf(inst, 2, 0), inst.bar * 1.9, 0.08);
        }
      }
    }
  };

  /* Scale degree -> frequency. Degrees may be negative (they wrap down an octave). */
  function nf(inst, degree, oct) {
    var sc = inst.def.scale, n = sc.length;
    var i = ((degree % n) + n) % n;
    var o = Math.floor(degree / n) + (oct || 0);
    return inst.def.root * Math.pow(2, (sc[i] + 12 * o) / 12);
  }

  /* -------------------------------------------------------------- instance */
  function makeInstance(id) {
    var def = TRACKS[id];
    var out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(bus);

    var send = ctx.createGain();       // post-fade, so a cross-fade takes the tail with it
    send.gain.value = 0.32;
    out.connect(send);
    send.connect(verb);

    var pad = ctx.createGain();
    var padLP = ctx.createBiquadFilter();
    padLP.type = 'lowpass';
    padLP.Q.value = 0.7;
    pad.connect(padLP);
    padLP.connect(out);

    var mix = ctx.createGain();
    mix.connect(out);

    return {
      id: id, def: def, out: out, send: send, pad: pad, padLP: padLP, mix: mix,
      d16: 60 / def.bpm / 4, bar: 60 / def.bpm * 4,
      step: 0, next: 0, rng: DD.rng(), dead: false, dying: false
    };
  }

  function applyIntensity(inst) {
    if (!inst || !inst.padLP) return;
    var f = 420 * Math.pow(6.5, intensity);   // ~420 Hz -> ~2730 Hz at full alarm
    inst.padLP.frequency.setTargetAtTime(f, ctx.currentTime, 0.25);
  }

  function fadeOut(inst) {
    var t = ctx.currentTime;
    inst.dying = true;
    inst.out.gain.cancelScheduledValues(t);
    inst.out.gain.setValueAtTime(Math.max(0.0001, inst.out.gain.value), t);
    inst.out.gain.linearRampToValueAtTime(0.0001, t + FADE);
    setTimeout(function () {
      try { inst.out.disconnect(); } catch (e) { /* ignore */ }
      inst.dead = true;
    }, (FADE + 0.5) * 1000);
  }

  /* ------------------------------------------------------------- scheduler */
  function ensureTimer() {
    if (!timer && ctx) timer = setInterval(schedule, TICK);
  }

  function dropTimer() {
    if (timer) { clearInterval(timer); timer = null; }
  }

  function schedule() {
    if (!ctx) { dropTimer(); return; }
    var inst = current;
    if (!inst) { dropTimer(); return; }
    var now = ctx.currentTime;
    if (inst.next < now - 0.05) {
      /* The tab was throttled. Skip the steps we missed, keeping bar alignment,
       * instead of firing a wall of notes all at once. */
      var missed = Math.max(1, Math.ceil((now - inst.next) / inst.d16));
      inst.step += missed;
      inst.next += missed * inst.d16;
      if (inst.next < now) inst.next = now + 0.02;
    }
    now = ctx.currentTime;
    var guard = 0;
    while (inst.next < now + LOOKAHEAD && guard++ < 64) {
      try {
        inst.def.step(inst, inst.step, inst.next);
      } catch (e) {
        /* one bad step must not stop the score */
      }
      inst.next += inst.d16;
      inst.step++;
    }
  }

  /* ------------------------------------------------------------------- api */
  var music = {
    play: function (track) {
      if (!TRACKS[track]) return;
      wanted = track;
      if (!ensure()) return;                                  // no gesture yet
      if (current && current.id === track && !current.dying) return;  // already playing
      if (current) fadeOut(current);
      current = makeInstance(track);
      applyIntensity(current);
      var t = ctx.currentTime;
      current.out.gain.setValueAtTime(0.0001, t);
      current.out.gain.linearRampToValueAtTime(1, t + FADE);
      current.next = t + 0.06;
      ensureTimer();
    },

    stop: function () {
      wanted = null;
      if (ctx && current) fadeOut(current);
      current = null;
      dropTimer();
    },

    /* 0..1: how close the clock is to zero. Raises the pad cutoff, widens the
     * detune and (above 0.45) brings in the combat percussion layer. */
    setIntensity: function (v) {
      intensity = clamp(typeof v === 'number' ? v : 0, 0, 1);
      if (ctx) applyIntensity(current);
    },

    /* Called by DD.Audio.init(): starts a track requested before the first gesture. */
    _wake: function () {
      if (!ensure()) return;
      if (wanted && !current) music.play(wanted);
      else if (current) ensureTimer();
    }
  };

  A.music = music;
})();
