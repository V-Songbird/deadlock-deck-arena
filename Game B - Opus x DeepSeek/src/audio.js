// DD.Audio — synthesized soundtrack and guttural SFX (PRODUCT.md §5.6).
// Web Audio only: nothing is loaded, nothing is fetched, and nothing in this file
// may ever throw. No audio files, no DOM, no dependencies.
window.DD = window.DD || {};

(function () {
  'use strict';

  var KEY = 'dd_sound';        // localStorage key for the mute toggle
  var ZERO = 0.0001;           // exponential ramps cannot reach 0
  var LOOKAHEAD = 0.14;        // seconds of music scheduled ahead of the clock
  var TICK_MS = 25;            // scheduler period
  var MAX_VOICES = 128;        // hard cap so a long session cannot pile up nodes
  var BPM_MIN = 58;            // tempo at tension 0
  var BPM_MAX = 142;           // tempo at tension 1

  // ---------------------------------------------------------------- module state
  var ctx = null, master = null, musicBus = null, sfxBus = null, musicFilter = null;
  var enabled = readEnabled();
  var musicWanted = false, musicOn = false, tension = 0;
  var timer = null, nextTime = 0, step = 0;
  var droneNodes = [], droneSrcs = [];
  var voices = [];             // live scheduled voices { nodes, srcs, end, dead }
  var noiseBuf = null;

  // A minor, four bars: Am — F — Dm — Em (never resolved properly, on purpose).
  var CHORDS = [
    [110.00, 130.81, 164.81],
    [87.31, 110.00, 130.81],
    [146.83, 174.61, 220.00],
    [164.81, 196.00, 246.94]
  ];
  var SCALE = [220.00, 246.94, 261.63, 293.66, 329.63, 392.00, 440.00, 523.25];
  var ARP = [0, -1, 2, -1, 4, 3, -1, 5];   // -1 = rest; sparse by design

  // ---------------------------------------------------------------- small helpers
  function noop() {}

  function band(f) { return Math.min(20000, Math.max(20, f)); }

  function clamp01(v) { return v > 0 ? (v < 1 ? v : 1) : 0; }

  function now() { return ctx ? ctx.currentTime : 0; }

  function readEnabled() {
    try {
      var v = window.localStorage ? window.localStorage.getItem(KEY) : null;
      return v === '0' ? false : true;
    } catch (e) { return true; }
  }

  function active() { return !!(ctx && enabled); }

  function resumeCtx() {
    try {
      if (!ctx || !ctx.resume) return;
      var p = ctx.resume();
      if (p && p.catch) p.catch(noop);
    } catch (e) {}
  }

  function noiseBuffer() {
    if (noiseBuf) return noiseBuf;
    var len = Math.max(1, Math.floor(ctx.sampleRate * 1.5));
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseBuf = buf;
    return noiseBuf;
  }

  // Exponential attack/decay. `dur` is returned so callers can schedule the stop
  // with the same value the envelope really reaches zero at.
  function span(dur, atk) {
    var a = Math.max(0.004, atk || 0.006);
    return dur > a * 1.05 ? dur : a * 1.05;
  }

  function envTo(p, t, peak, atk, dur) {
    var a = Math.max(0.004, atk || 0.006);
    p.setValueAtTime(ZERO, t);
    p.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + a);
    p.exponentialRampToValueAtTime(ZERO, t + dur);
  }

  // ---------------------------------------------------------------- voice tracking
  function kill(v) {
    if (!v || v.dead) return;
    v.dead = true;
    var i = voices.indexOf(v);
    if (i >= 0) voices.splice(i, 1);
    for (var j = 0; j < v.nodes.length; j++) {
      try { v.nodes[j].disconnect(); } catch (e) {}
    }
  }

  function stopVoice(v) {
    if (!v || v.dead) return;
    for (var i = 0; i < v.srcs.length; i++) {
      try { v.srcs[i].stop(0); } catch (e) {}
    }
    kill(v);
  }

  function track(v) {
    voices.push(v);
    var lead = v.srcs[0];
    if (lead) { try { lead.onended = function () { kill(v); }; } catch (e) {} }
    if (voices.length > MAX_VOICES) stopVoice(voices[0]);
    return v;
  }

  function stopAllVoices() {
    for (var i = voices.length - 1; i >= 0; i--) stopVoice(voices[i]);
    voices.length = 0;
  }

  function prune() {
    var t = now();
    for (var i = voices.length - 1; i >= 0; i--) {
      if (voices[i].end + 0.5 < t) stopVoice(voices[i]);
    }
  }

  // ---------------------------------------------------------------- voice builders
  // Oscillator layer with an optional fast pitch drop and an optional sweeping filter.
  function tone(t, type, f0, f1, dur, peak, atk, filt, detune) {
    dur = span(dur, atk);
    var o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(band(f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(band(f1), t + dur);
    if (detune) o.detune.value = detune;

    var g = ctx.createGain();
    g.gain.value = ZERO;
    envTo(g.gain, t, peak, atk, dur);
    o.connect(g);

    var nodes = [o, g], tail = g;
    if (filt) {
      var f = ctx.createBiquadFilter();
      f.type = filt[0];
      f.Q.value = filt[3] === undefined ? 1 : filt[3];
      f.frequency.setValueAtTime(band(filt[1]), t);
      if (filt[2] && filt[2] !== filt[1]) {
        f.frequency.exponentialRampToValueAtTime(band(filt[2]), t + dur);
      }
      g.connect(f);
      tail = f;
      nodes.push(f);
    }
    return { nodes: nodes, srcs: [o], tail: tail, end: t + dur };
  }

  // White noise layer through a sweeping filter — the wet part of every impact.
  function hiss(t, dur, peak, atk, filt) {
    dur = span(dur, atk);
    var s = ctx.createBufferSource();
    s.buffer = noiseBuffer();
    s.loop = true;

    var f = ctx.createBiquadFilter();
    f.type = filt ? filt[0] : 'lowpass';
    f.Q.value = filt && filt[3] !== undefined ? filt[3] : 1;
    var f0 = filt ? filt[1] : 1200, f1 = filt ? filt[2] : 400;
    f.frequency.setValueAtTime(band(f0), t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(band(f1), t + dur);

    var g = ctx.createGain();
    g.gain.value = ZERO;
    envTo(g.gain, t, peak, atk, dur);
    s.connect(f);
    f.connect(g);
    return { nodes: [s, f, g], srcs: [s], tail: g, end: t + dur };
  }

  // Wire the layers into one short-lived bus, run them, and remember them for cleanup.
  function launch(parts, bus) {
    try {
      var t = now();
      var out = ctx.createGain();
      out.gain.value = 1;
      out.connect(bus || sfxBus);

      var nodes = [out], srcs = [], end = t;
      for (var i = 0; i < parts.length; i++) {
        var p = parts[i];
        if (!p) continue;
        p.tail.connect(out);
        for (var n = 0; n < p.nodes.length; n++) nodes.push(p.nodes[n]);
        for (var m = 0; m < p.srcs.length; m++) srcs.push(p.srcs[m]);
        if (p.end > end) end = p.end;
      }
      for (var k = 0; k < srcs.length; k++) {
        try { srcs[k].start(t); srcs[k].stop(end); } catch (e) {}
      }
      track({ nodes: nodes, srcs: srcs, end: end });
    } catch (e) {}
  }

  // ---------------------------------------------------------------- sound effects
  // Every entry is a list of layers started at t. Peaks are kept low: the sfx bus
  // and the master gain still have to fit under 1.0.
  var SFX = {
    // wet flesh impact: low thump + a noise burst dropping through a low-pass
    hit: function (t) {
      return [
        tone(t, 'sine', 190, 46, 0.20, 0.50, 0.004),
        hiss(t, 0.15, 0.40, 0.003, ['lowpass', 2400, 180, 1.2]),
        hiss(t + 0.015, 0.11, 0.18, 0.004, ['bandpass', 1100, 320, 5])
      ];
    },
    // the same, gorier and slower, with a brass undertone behind it
    heavy: function (t) {
      return [
        tone(t, 'sine', 150, 32, 0.42, 0.55, 0.005),
        tone(t, 'triangle', 96, 40, 0.34, 0.26, 0.006),
        hiss(t, 0.26, 0.42, 0.003, ['lowpass', 1800, 120, 1.0]),
        hiss(t + 0.03, 0.20, 0.15, 0.010, ['bandpass', 700, 200, 3])
      ];
    },
    // brass: detuned square and saw stabs plus a metal ring
    block: function (t) {
      return [
        tone(t, 'square', 320, 190, 0.14, 0.20, 0.002, ['bandpass', 1400, 900, 6]),
        tone(t, 'sawtooth', 214, 160, 0.24, 0.15, 0.002, ['lowpass', 2600, 700, 2], 12),
        tone(t + 0.010, 'square', 486, 380, 0.30, 0.06, 0.003),
        hiss(t, 0.09, 0.20, 0.002, ['highpass', 900, 2500, 1])
      ];
    },
    // the player is hit: a guttural groan, two detuned saws falling
    hurt: function (t) {
      return [
        tone(t, 'sawtooth', 165, 62, 0.44, 0.26, 0.020, ['lowpass', 900, 300, 3]),
        tone(t, 'sawtooth', 168, 64, 0.44, 0.18, 0.030, ['lowpass', 900, 300, 3], -14),
        hiss(t, 0.30, 0.24, 0.020, ['bandpass', 500, 220, 2])
      ];
    },
    // flesh knitting back together: a wet rising sweep and a soft chime
    heal: function (t) {
      return [
        hiss(t, 0.55, 0.18, 0.15, ['bandpass', 300, 2200, 4]),
        tone(t, 'triangle', 220, 330, 0.60, 0.14, 0.10),
        tone(t + 0.08, 'sine', 330, 494, 0.55, 0.09, 0.10)
      ];
    },
    // bone snapping
    break: function (t) {
      return [
        tone(t, 'square', 420, 90, 0.13, 0.22, 0.001, ['lowpass', 2000, 300, 2]),
        hiss(t, 0.07, 0.45, 0.001, ['highpass', 1800, 600, 1]),
        hiss(t + 0.07, 0.16, 0.30, 0.002, ['lowpass', 1400, 200, 2]),
        tone(t + 0.05, 'sine', 130, 40, 0.28, 0.26, 0.004)
      ];
    },
    // a jet of scalding vapour: filtered noise sweeping up, then away
    steam: function (t) {
      return [
        hiss(t, 0.85, 0.30, 0.09, ['bandpass', 400, 4200, 1.4]),
        hiss(t + 0.10, 0.75, 0.18, 0.12, ['highpass', 1200, 300, 0.9]),
        tone(t, 'triangle', 140, 70, 0.85, 0.09, 0.15)
      ];
    },
    // wet ripping of a limb off a corpse
    harvest: function (t) {
      return [
        hiss(t, 0.45, 0.30, 0.030, ['bandpass', 900, 220, 2.5]),
        hiss(t + 0.12, 0.35, 0.22, 0.050, ['lowpass', 1200, 260, 1.5]),
        tone(t, 'sawtooth', 120, 55, 0.45, 0.18, 0.05, ['lowpass', 700, 240, 3]),
        tone(t + 0.10, 'sine', 260, 120, 0.30, 0.09, 0.05)
      ];
    },
    // a card leaves the hand
    card: function (t) {
      return [
        hiss(t, 0.06, 0.14, 0.002, ['highpass', 1800, 3000, 1]),
        tone(t, 'square', 620, 480, 0.07, 0.06, 0.002, ['lowpass', 3000, 1200, 2])
      ];
    },
    // a footstep on wet stone
    step: function (t) {
      return [
        tone(t, 'sine', 120, 52, 0.11, 0.22, 0.003),
        hiss(t, 0.09, 0.18, 0.004, ['lowpass', 1100, 250, 1.4])
      ];
    },
    // a sprung trap: metal snap, then meat
    trap: function (t) {
      return [
        tone(t, 'square', 900, 260, 0.10, 0.18, 0.001, ['bandpass', 2400, 900, 8]),
        hiss(t, 0.10, 0.36, 0.001, ['highpass', 1400, 4000, 1]),
        tone(t + 0.03, 'sawtooth', 200, 60, 0.40, 0.22, 0.010, ['lowpass', 1000, 200, 3]),
        hiss(t + 0.06, 0.30, 0.18, 0.020, ['lowpass', 900, 180, 2])
      ];
    },
    // the long fall: everything drops away
    death: function (t) {
      return [
        tone(t, 'sawtooth', 150, 26, 1.60, 0.30, 0.05, ['lowpass', 900, 130, 3]),
        tone(t, 'sawtooth', 154, 28, 1.60, 0.20, 0.07, ['lowpass', 800, 120, 3], -18),
        tone(t, 'sine', 70, 22, 1.80, 0.24, 0.02),
        hiss(t, 1.20, 0.20, 0.10, ['lowpass', 1200, 150, 1.2]),
        hiss(t + 0.80, 0.90, 0.11, 0.40, ['bandpass', 300, 140, 2])
      ];
    },
    // the way out: a brass stab that opens upward
    escape: function (t) {
      return [
        tone(t, 'sawtooth', 147, 147, 0.90, 0.16, 0.02, ['lowpass', 1200, 3400, 2]),
        tone(t, 'sawtooth', 220, 220, 0.90, 0.14, 0.03, ['lowpass', 1200, 3400, 2], 9),
        tone(t, 'square', 294, 294, 0.85, 0.09, 0.03),
        tone(t + 0.18, 'sine', 587, 880, 0.80, 0.10, 0.05),
        hiss(t, 0.90, 0.14, 0.05, ['bandpass', 500, 5000, 1.2])
      ];
    },
    // buttons, menus, toasts
    ui: function (t) {
      return [
        tone(t, 'square', 440, 880, 0.06, 0.09, 0.001, ['lowpass', 3000, 3000, 1]),
        hiss(t, 0.03, 0.07, 0.001, ['highpass', 2500, 4000, 1])
      ];
    }
  };

  // ---------------------------------------------------------------- music
  // The drone is the only permanent part of the soundtrack: it lives from
  // startMusic to stopMusic. Everything else is scheduled note by note.
  function buildDrone(t) {
    var voices3 = [[55, 'sawtooth'], [82.41, 'sawtooth'], [110, 'triangle']];
    var filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 260;
    filt.Q.value = 0.7;

    var bus = ctx.createGain();
    bus.gain.value = ZERO;
    bus.gain.exponentialRampToValueAtTime(0.5, t + 2.5);   // slow swell in
    filt.connect(bus);
    bus.connect(musicFilter);

    droneNodes = [filt, bus];
    droneSrcs = [];

    for (var i = 0; i < voices3.length; i++) {
      for (var d = -1; d <= 1; d += 2) {
        var o = ctx.createOscillator();
        o.type = voices3[i][1];
        o.frequency.value = voices3[i][0];
        o.detune.value = d * 8;
        var g = ctx.createGain();
        g.gain.value = 0.22;
        o.connect(g);
        g.connect(filt);
        o.start(t);
        droneNodes.push(o, g);
        droneSrcs.push(o);
      }
    }

    // slow breathing of the drone filter
    var lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 0.06;
    var lg = ctx.createGain();
    lg.gain.value = 110;
    lfo.connect(lg);
    lg.connect(filt.frequency);
    lfo.start(t);
    droneNodes.push(lfo, lg);
    droneSrcs.push(lfo);
  }

  function pad(t, dur, chordIdx) {
    var chord = CHORDS[chordIdx], parts = [];
    for (var i = 0; i < chord.length; i++) {
      for (var d = -1; d <= 1; d += 2) {
        parts.push(tone(t, 'sawtooth', chord[i], 0, dur, 0.085, dur * 0.35, null, d * 9));
      }
    }
    launch(parts, musicFilter);
  }

  function arp(t, freq, k) {
    launch([tone(t, 'square', freq, freq, 0.26, 0.075 * k, 0.005,
      ['lowpass', freq * 8, freq * 2, 3])], musicFilter);
  }

  function pulse(t, k) {
    launch([
      tone(t, 'sine', 92, 44, 0.34, 0.44 * k, 0.008),
      hiss(t, 0.05, 0.08 * k, 0.002, ['lowpass', 900, 300, 1])
    ], musicFilter);
  }

  // Two thumps under the ribs; only audible once the clock is running out.
  function heartbeat(t) {
    var a = clamp01((tension - 0.35) / 0.65) * 0.45;
    if (a <= 0) return;
    launch([
      tone(t, 'sine', 62, 30, 0.20, a, 0.010),
      tone(t + 0.17, 'sine', 54, 26, 0.16, a * 0.6, 0.010)
    ], musicBus);
  }

  function scheduleStep(s, t, stepDur) {
    var beat = s % 8;
    var bar = Math.floor(s / 8);
    if (beat === 0) {
      pad(t, stepDur * 8, bar % CHORDS.length);
      heartbeat(t);
    }
    if (beat % (tension > 0.5 ? 2 : 4) === 0) pulse(t, beat === 0 ? 1 : 0.65);

    var deg = ARP[beat];
    if (deg < 0 && tension > 0.5 && Math.random() < 0.4) deg = ARP[(beat + 4) % 8];
    if (deg >= 0) arp(t, SCALE[deg], 0.55 + 0.45 * tension);
  }

  // Lookahead scheduler: never one giant buffer, always a few steps ahead.
  function tick() {
    try {
      prune();
      if (!ctx || !musicOn) return;
      if (ctx.state === 'suspended' || ctx.state === 'closed') return;
      var dur = 30 / (BPM_MIN + (BPM_MAX - BPM_MIN) * tension);   // one 8th note
      var horizon = ctx.currentTime + LOOKAHEAD;
      if (nextTime < ctx.currentTime) nextTime = ctx.currentTime + 0.05;
      var guard = 0;
      while (nextTime < horizon && guard++ < 64) {
        scheduleStep(step, nextTime, dur);
        nextTime += dur;
        step++;
      }
    } catch (e) {}
  }

  function killMusic() {
    musicOn = false;
    if (timer) { try { window.clearInterval(timer); } catch (e) {} timer = null; }
    for (var i = 0; i < droneSrcs.length; i++) { try { droneSrcs[i].stop(0); } catch (e) {} }
    for (var j = 0; j < droneNodes.length; j++) { try { droneNodes[j].disconnect(); } catch (e) {} }
    droneSrcs = [];
    droneNodes = [];
    stopAllVoices();
  }

  // ---------------------------------------------------------------- public API

  function init() {
    try {
      if (!ctx) {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        ctx = new AC();

        master = ctx.createGain();
        master.gain.value = enabled ? 1 : 0;
        master.connect(ctx.destination);

        musicBus = ctx.createGain();
        musicBus.gain.value = 0.45;
        sfxBus = ctx.createGain();
        sfxBus.gain.value = 0.85;

        musicFilter = ctx.createBiquadFilter();
        musicFilter.type = 'lowpass';
        musicFilter.Q.value = 1.1;
        musicFilter.frequency.value = 420 + 2800 * tension;

        musicFilter.connect(musicBus);
        musicBus.connect(master);
        sfxBus.connect(master);
      }
      if (enabled) {
        resumeCtx();
        if (musicWanted) startMusic();
      }
    } catch (e) {}
  }

  function setEnabled(on) {
    enabled = !!on;
    try {
      if (window.localStorage) window.localStorage.setItem(KEY, enabled ? '1' : '0');
    } catch (e) {}
    try { if (master) master.gain.value = enabled ? 1 : 0; } catch (e) {}
    if (!ctx) return;
    try {
      if (enabled) {
        resumeCtx();
        if (musicWanted) startMusic();
      } else {
        killMusic();
      }
    } catch (e) {}
  }

  function isEnabled() { return enabled; }

  function startMusic() {
    musicWanted = true;
    if (!active() || musicOn) return;
    try {
      resumeCtx();
      var t = now();
      musicFilter.frequency.value = 420 + 2800 * tension;
      buildDrone(t);
      musicOn = true;
      step = 0;
      nextTime = t + 0.1;
      if (!timer) timer = window.setInterval(tick, TICK_MS);
    } catch (e) { try { killMusic(); } catch (e2) {} }
  }

  function stopMusic() {
    musicWanted = false;
    if (!ctx) return;
    try { killMusic(); } catch (e) {}
  }

  function setTension(t) {
    tension = clamp01(t);
    if (!active() || !musicFilter) return;
    try {
      var cut = 420 + 2800 * tension;
      if (musicFilter.frequency.setTargetAtTime) {
        musicFilter.frequency.setTargetAtTime(cut, now(), 1.2);
      } else {
        musicFilter.frequency.value = cut;
      }
    } catch (e) {}
  }

  function sfx(name) {
    if (!active() || !name) return;
    if (!Object.prototype.hasOwnProperty.call(SFX, name)) return;
    try {
      if (ctx.state === 'suspended') resumeCtx();
      launch(SFX[name](now() + 0.001), sfxBus);
    } catch (e) {}
  }

  DD.Audio = {
    init: init,
    setEnabled: setEnabled,
    isEnabled: isEnabled,
    startMusic: startMusic,
    stopMusic: stopMusic,
    setTension: setTension,
    sfx: sfx
  };
})();
