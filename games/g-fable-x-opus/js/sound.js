// P4 sound: 100% Web Audio synthesis (oscillators, noise buffers, filters, envelopes).
// No audio files, no libraries. Every public call is a safe no-op before unlock().
window.Sound = (function () {
  'use strict';

  var AC = window.AudioContext || window.webkitAudioContext;
  var ac = null, master = null, musicGain = null, sfxGain = null;
  var whiteBuf = null, brownBuf = null;
  var MASTER = 0.75;        // previous master level, restored when unmuting
  var muted = false;
  var pending = null;       // music mode requested before unlock()
  var timer = null;         // scheduler interval id
  var lastSfx = {};         // per-name throttle timestamps

  // ---------- context and master chain ----------

  function unlock() {
    try {
      if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
      if (!AC) return;
      ac = new AC();
      if (ac.state === 'suspended') ac.resume();
      master = ac.createGain();
      master.gain.value = muted ? 0 : MASTER;
      master.connect(ac.destination);
      musicGain = ac.createGain();
      musicGain.gain.value = 0.3;
      musicGain.connect(master);
      sfxGain = ac.createGain();
      sfxGain.gain.value = 0.85;
      sfxGain.connect(master);
      whiteBuf = makeNoise(false);
      brownBuf = makeNoise(true);
      if (timer === null) timer = setInterval(scheduler, 50);
      if (pending !== null) { var m = pending; pending = null; music(m); }
    } catch (e) { ac = null; }
  }

  // 2 s of looping noise, generated once and reused by every noise voice.
  function makeNoise(brown) {
    var len = Math.floor(ac.sampleRate * 2), buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0), last = 0, i, w;
    for (i = 0; i < len; i++) {
      w = Math.random() * 2 - 1;
      if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else { d[i] = w; }
    }
    return buf;
  }

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }   // MIDI note -> Hz

  // ---------- voice helpers ----------

  // Percussive envelope: silence -> peak (attack) -> silence (exponential decay).
  function env(param, t, dur, peak, atk) {
    atk = Math.min(atk || 0.005, dur * 0.5);
    param.setValueAtTime(0.0001, t);
    param.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + atk);
    param.exponentialRampToValueAtTime(0.0001, t + dur);
    param.setValueAtTime(0, t + dur + 0.01);
  }

  function attachFilter(src, f, t, dur) {
    var b = ac.createBiquadFilter();
    b.type = f.type || 'lowpass';
    b.frequency.setValueAtTime(f.freq, t);
    if (f.to) b.frequency.exponentialRampToValueAtTime(Math.max(30, f.to), t + dur);
    if (f.q) b.Q.setValueAtTime(f.q, t);
    src.connect(b);
    return b;
  }

  // o = { t, type, freq, to, dur, peak, atk, detune, filter: { type, freq, to, q }, dest }
  function tone(o) {
    if (!ac) return;
    try {
      var t = o.t || ac.currentTime, dur = o.dur || 0.2;
      var osc = ac.createOscillator();
      osc.type = o.type || 'sine';
      osc.frequency.setValueAtTime(o.freq, t);
      if (o.to) osc.frequency.exponentialRampToValueAtTime(Math.max(20, o.to), t + dur);
      if (o.detune) osc.detune.setValueAtTime(o.detune, t);
      var out = o.filter ? attachFilter(osc, o.filter, t, dur) : osc;
      var g = ac.createGain();
      env(g.gain, t, dur, o.peak == null ? 0.25 : o.peak, o.atk);
      out.connect(g);
      g.connect(o.dest || sfxGain);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    } catch (e) { /* audio must never throw at the call site */ }
  }

  // o = { t, dur, peak, atk, brown, filter: { type, freq, to, q }, dest }
  function noise(o) {
    if (!ac) return;
    try {
      var t = o.t || ac.currentTime, dur = o.dur || 0.2;
      var src = ac.createBufferSource();
      src.buffer = o.brown ? brownBuf : whiteBuf;
      src.loop = true;
      var out = o.filter ? attachFilter(src, o.filter, t, dur) : src;
      var g = ac.createGain();
      env(g.gain, t, dur, o.peak == null ? 0.25 : o.peak, o.atk);
      out.connect(g);
      g.connect(o.dest || sfxGain);
      src.start(t, Math.random() * 1.5);
      src.stop(t + dur + 0.05);
    } catch (e) { }
  }

  // ---------- SFX table (section 4.5) ----------

  var SFX = {
    click: function (t) {
      tone({ t: t, type: 'square', freq: 900, to: 700, dur: 0.035, peak: 0.12 });
    },
    card: function (t) {   // soft paper-like tick
      noise({ t: t, dur: 0.07, peak: 0.13, filter: { type: 'bandpass', freq: 2600, to: 1500, q: 1.2 } });
    },
    hit: function (t) {    // noise burst + low thud
      noise({ t: t, dur: 0.13, peak: 0.34, filter: { type: 'lowpass', freq: 1600, to: 300, q: 1 } });
      tone({ t: t, type: 'sine', freq: 170, to: 48, dur: 0.2, peak: 0.42 });
    },
    block: function (t) {  // short metallic tone
      tone({ t: t, type: 'square', freq: 740, dur: 0.12, peak: 0.13, filter: { type: 'bandpass', freq: 1500, q: 6 } });
      tone({ t: t, type: 'triangle', freq: 1180, dur: 0.16, peak: 0.09 });
    },
    growl: function (t) {  // noise + low saw dropping through a resonant lowpass
      tone({ t: t, type: 'sawtooth', freq: 115, to: 42, dur: 0.45, peak: 0.3, filter: { type: 'lowpass', freq: 900, to: 180, q: 9 } });
      noise({ t: t, dur: 0.4, peak: 0.2, brown: true, filter: { type: 'lowpass', freq: 700, to: 160, q: 3 } });
    },
    graft: function (t) {  // wet squelch: filtered noise blips with pitch wobble
      for (var i = 0; i < 3; i++) {
        var s = t + i * 0.09;
        noise({ t: s, dur: 0.085, peak: 0.2, filter: { type: 'bandpass', freq: 500 + i * 250, to: 1500 + i * 300, q: 4 } });
        tone({ t: s, type: 'sine', freq: 180 + i * 45, to: 95 + i * 30, dur: 0.09, peak: 0.12 });
      }
    },
    break: function (t) {  // snap + low thud
      noise({ t: t, dur: 0.05, peak: 0.4, filter: { type: 'highpass', freq: 3200 } });
      tone({ t: t + 0.01, type: 'sine', freq: 210, to: 40, dur: 0.24, peak: 0.4 });
    },
    overheat: function (t) {
      noise({ t: t, dur: 0.4, peak: 0.16, atk: 0.06, filter: { type: 'highpass', freq: 2200, to: 4200 } });
    },
    step: function (t) {
      noise({ t: t, dur: 0.06, peak: 0.12, filter: { type: 'lowpass', freq: 420, q: 1 } });
      tone({ t: t, type: 'sine', freq: 95, to: 58, dur: 0.08, peak: 0.16 });
    },
    pickup: function (t) {
      tone({ t: t, type: 'triangle', freq: 660, dur: 0.08, peak: 0.16 });
      tone({ t: t + 0.07, type: 'triangle', freq: 990, dur: 0.14, peak: 0.16 });
    },
    trap: function (t) {   // harsh metallic clang (inharmonic partials)
      noise({ t: t, dur: 0.1, peak: 0.25, filter: { type: 'highpass', freq: 2500 } });
      [523, 761, 1157].forEach(function (f, i) {
        tone({ t: t, type: 'square', freq: f, dur: 0.34 - i * 0.06, peak: 0.12, filter: { type: 'bandpass', freq: f, q: 9 } });
      });
    },
    tick: function (t) {
      tone({ t: t, type: 'square', freq: 1500, dur: 0.02, peak: 0.1 });
    },
    alarm: function (t) {  // two harsh beeps
      tone({ t: t, type: 'sawtooth', freq: 880, dur: 0.1, peak: 0.16, filter: { type: 'bandpass', freq: 1400, q: 4 } });
      tone({ t: t + 0.15, type: 'sawtooth', freq: 830, dur: 0.1, peak: 0.16, filter: { type: 'bandpass', freq: 1400, q: 4 } });
    },
    shift: function (t) {  // low rumble
      noise({ t: t, dur: 0.8, peak: 0.36, atk: 0.12, brown: true, filter: { type: 'lowpass', freq: 220, to: 90, q: 2 } });
    },
    death: function (t) {  // long guttural descending growl
      tone({ t: t, type: 'sawtooth', freq: 140, to: 32, dur: 0.8, peak: 0.34, filter: { type: 'lowpass', freq: 800, to: 110, q: 8 } });
      tone({ t: t, type: 'square', freq: 70, to: 24, dur: 0.8, peak: 0.16 });
      noise({ t: t, dur: 0.8, peak: 0.18, brown: true, filter: { type: 'lowpass', freq: 500, to: 120, q: 2 } });
    },
    victory: function (t) {   // short bright arpeggio
      [0, 4, 7, 12].forEach(function (semi, i) {
        tone({ t: t + i * 0.09, type: 'triangle', freq: mtof(74 + semi), dur: 0.3, peak: 0.16 });
      });
    },
    heal: function (t) {      // soft warm chord
      [62, 65, 69].forEach(function (n) {
        tone({ t: t, type: 'sine', freq: mtof(n), dur: 0.5, peak: 0.12, atk: 0.06 });
      });
    },
    poison: function (t) {    // bubbly noise
      for (var i = 0; i < 4; i++) {
        noise({ t: t + i * 0.07, dur: 0.06, peak: 0.16, filter: { type: 'bandpass', freq: 300 + i * 200, to: 900 + i * 260, q: 8 } });
      }
    },
    flee: function (t) {      // quick whoosh
      noise({ t: t, dur: 0.3, peak: 0.24, atk: 0.08, filter: { type: 'bandpass', freq: 300, to: 3200, q: 1.5 } });
    },
    unlock: function (t) {    // bright chime
      tone({ t: t, type: 'sine', freq: 1046, dur: 0.7, peak: 0.16 });
      tone({ t: t + 0.06, type: 'sine', freq: 1568, dur: 0.6, peak: 0.12 });
    }
  };

  function sfx(name) {
    if (!ac || muted) return;
    var fn = SFX[name];
    if (!fn) return;
    var t = ac.currentTime;
    if (t - (lastSfx[name] || -1) < 0.03) return;   // at most one start per 30 ms per name
    lastSfx[name] = t;
    try { fn(t + 0.002); } catch (e) { }
  }

  // ---------- music ----------

  var ROOT = 38;                                  // D2
  var PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
  var mode = 'off', urg = 0, step = 0, nextTime = 0, drone = null;

  function urgency(u) {                           // stored only; applied at scheduling time
    urg = u < 0 ? 0 : (u > 1 ? 1 : u);
  }

  function music(m) {
    if (!ac) { pending = m; return; }
    if (m === mode) return;                       // idempotent
    mode = m;
    step = 0;
    nextTime = ac.currentTime + 0.05;
    if (m === 'title' || m === 'run' || m === 'combat') {
      if (!drone) startDrone();                   // the drone is shared by these three modes
      return;
    }
    stopDrone(0.3);
    if (m === 'death') deathChord();
    else if (m === 'victory') victoryChord();
    // 'off' (and anything else) leaves silence; the scheduler ignores non-loop modes
  }

  // Detuned saw drone -> lowpass (slow LFO on the cutoff) -> tremolo -> musicGain.
  function startDrone() {
    try {
      var t = ac.currentTime, i;
      var g = ac.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.5, t + 0.8);
      var filt = ac.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 320;
      filt.Q.value = 3;
      var trem = ac.createGain();
      trem.gain.value = 1;
      var cutLfo = ac.createOscillator(), cutAmt = ac.createGain();
      cutLfo.type = 'sine'; cutLfo.frequency.value = 0.08; cutAmt.gain.value = 140;
      cutLfo.connect(cutAmt); cutAmt.connect(filt.frequency); cutLfo.start(t);
      var tremLfo = ac.createOscillator(), tremAmt = ac.createGain();
      tremLfo.type = 'sine'; tremLfo.frequency.value = 4; tremAmt.gain.value = 0.05;
      tremLfo.connect(tremAmt); tremAmt.connect(trem.gain); tremLfo.start(t);
      var voices = [[ROOT, -7], [ROOT, 8], [ROOT + 7, -4], [ROOT + 12, 5]], oscs = [cutLfo, tremLfo];
      for (i = 0; i < voices.length; i++) {
        var o = ac.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = mtof(voices[i][0]);
        o.detune.value = voices[i][1];
        o.connect(filt);
        o.start(t);
        oscs.push(o);
      }
      filt.connect(trem); trem.connect(g); g.connect(musicGain);
      drone = { gain: g, filt: filt, tremAmt: tremAmt, tremLfo: tremLfo, oscs: oscs };
    } catch (e) { drone = null; }
  }

  function stopDrone(fade) {
    if (!drone) return;
    var d = drone, t = ac.currentTime, i;
    drone = null;
    try {
      d.gain.gain.cancelScheduledValues(t);
      d.gain.gain.setValueAtTime(Math.max(0.0001, d.gain.gain.value), t);
      d.gain.gain.exponentialRampToValueAtTime(0.0001, t + fade);
      for (i = 0; i < d.oscs.length; i++) d.oscs[i].stop(t + fade + 0.05);
    } catch (e) { }
  }

  // 'death': dissonant chord (tritone + minor ninth) sliding down, then silence.
  function deathChord() {
    var t = ac.currentTime + 0.05, notes = [38, 44, 49], i;
    for (i = 0; i < notes.length; i++) {
      tone({
        t: t, type: 'sawtooth', freq: mtof(notes[i]), to: mtof(notes[i] - 12), dur: 2.5,
        peak: 0.22 - i * 0.04, atk: 0.15, dest: musicGain,
        filter: { type: 'lowpass', freq: 900, to: 180, q: 3 }
      });
    }
    noise({ t: t, dur: 2.5, peak: 0.1, atk: 0.3, brown: true, dest: musicGain, filter: { type: 'lowpass', freq: 300, to: 90 } });
  }

  // 'victory': resolved brighter chord with bells, then silence.
  function victoryChord() {
    var t = ac.currentTime + 0.05, notes = [50, 57, 62, 66], i;
    for (i = 0; i < notes.length; i++) {
      tone({
        t: t, type: 'triangle', freq: mtof(notes[i]), dur: 3, peak: 0.16, atk: 0.08,
        dest: musicGain, filter: { type: 'lowpass', freq: 2400, q: 1 }
      });
    }
    for (i = 0; i < 3; i++) bell(t + 0.4 + i * 0.35, mtof(74 + [0, 4, 7][i]), 1.6, 0.12);
  }

  // ---------- music instruments ----------

  function bell(t, f, dur, peak) {
    tone({ t: t, type: 'triangle', freq: f, dur: dur, peak: peak, atk: 0.01, dest: musicGain });
    tone({ t: t, type: 'sine', freq: f * 2.02, dur: dur * 0.5, peak: peak * 0.4, atk: 0.008, dest: musicGain });
  }

  function bass(t, f, dur, peak) {
    tone({
      t: t, type: 'sawtooth', freq: f, dur: dur, peak: peak, atk: 0.02, dest: musicGain,
      filter: { type: 'lowpass', freq: 260 + urg * 600, q: 7 }
    });
  }

  function stab(t) {   // minor-second cluster
    var cut = { type: 'lowpass', freq: 1200 + urg * 1400, q: 5 };
    tone({ t: t, type: 'sawtooth', freq: mtof(ROOT + 24), dur: 0.45, peak: 0.1, atk: 0.01, dest: musicGain, filter: cut });
    tone({ t: t, type: 'sawtooth', freq: mtof(ROOT + 25), dur: 0.45, peak: 0.09, atk: 0.01, dest: musicGain, filter: cut });
  }

  function kick(t) {
    tone({ t: t, type: 'sine', freq: 150, to: 42, dur: 0.18, peak: 0.5, dest: musicGain });
  }

  function snare(t) {
    noise({ t: t, dur: 0.16, peak: 0.2, dest: musicGain, filter: { type: 'highpass', freq: 1400 } });
    tone({ t: t, type: 'triangle', freq: 190, to: 130, dur: 0.1, peak: 0.12, dest: musicGain });
  }

  function hat(t, peak) {
    noise({ t: t, dur: 0.04, peak: peak, dest: musicGain, filter: { type: 'highpass', freq: 6500 } });
  }

  // ---------- scheduler (50 ms interval, ~150 ms lookahead) ----------

  function beatLen() {
    return (mode === 'title' ? 0.7 : 0.5) / (1 + 0.8 * urg);   // urgency: 1x -> 1.8x tempo
  }

  function applyUrgency() {
    if (!drone) return;
    try {
      var t = ac.currentTime;
      drone.filt.frequency.setTargetAtTime(320 + urg * 1500, t, 0.3);
      drone.tremAmt.gain.setTargetAtTime(0.05 + urg * 0.4, t, 0.3);
      drone.tremLfo.frequency.setTargetAtTime(4 + urg * 6, t, 0.3);
    } catch (e) { }
  }

  function scheduler() {
    if (!ac || (mode !== 'title' && mode !== 'run' && mode !== 'combat')) return;
    applyUrgency();
    var beat = beatLen(), t = ac.currentTime;
    if (nextTime < t) nextTime = t + 0.02;        // catch up after a throttled/background tab
    while (nextTime < t + 0.15) {
      try { scheduleStep(step, nextTime, beat); } catch (e) { }
      step++;
      nextTime += beat;
    }
  }

  // One eighth-note step of the pattern.
  function scheduleStep(i, t, beat) {
    var b = i % 8;
    if (mode === 'title') {   // sparse bells over the drone
      if (b === 0 && Math.random() < 0.45) bell(t, mtof(ROOT + 24 + PHRYGIAN[(Math.random() * 7) | 0]), 2.4, 0.12);
      if (b === 5 && Math.random() < 0.2) bell(t, mtof(ROOT + 36 + PHRYGIAN[(Math.random() * 4) | 0]), 1.8, 0.07);
      return;
    }
    if (b % 2 === 0) bass(t, mtof(ROOT + (b === 6 ? PHRYGIAN[1] : 0)), beat * 0.9, 0.26);
    if (i % 32 === 24) stab(t);
    if (i % 16 === 8 && Math.random() < 0.5) bell(t, mtof(ROOT + 24 + PHRYGIAN[1 + ((Math.random() * 5) | 0)]), 1.6, 0.08);
    if (mode !== 'combat') return;
    if (b === 0 || b === 6) kick(t);
    if (b === 4) snare(t);
    if (b % 2 === 1) hat(t, b === 3 ? 0.06 : 0.04);
  }

  // ---------- mute ----------

  function toggleMute() {
    muted = !muted;
    if (ac && master) {
      try { master.gain.setTargetAtTime(muted ? 0 : MASTER, ac.currentTime, 0.02); }
      catch (e) { master.gain.value = muted ? 0 : MASTER; }
    }
    return muted;
  }

  var api = { unlock: unlock, music: music, urgency: urgency, sfx: sfx, toggleMute: toggleMute };
  Object.defineProperty(api, 'muted', { get: function () { return muted; }, enumerable: true });
  return api;
})();
