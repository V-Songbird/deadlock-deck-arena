/* Deadlock Deck: El Reloj Anatomico - audio.js (W4)
 * Fully synthesized WebAudio: no files, no network.
 *  - Music: lookahead step sequencer, one mood per mode, crossfaded. Electronic layers (pulsing bass,
 *    arpeggios, kick/hats) over an orchestral bed (detuned saw string pads, low brass drone, bells, timpani).
 *  - SFX: filtered noise bursts, pitch-dropping growls, wet squelches, bone cracks, sizzle, clock tick.
 * Every entry point is wrapped so that audio problems can never throw into the game. */
(function () {
  'use strict';
  window.DD = window.DD || {};
  const DD = window.DD;

  // ------------------------------------------------------------------ state
  let ac = null;              // AudioContext (null before init or if unsupported)
  let failed = false;
  let master = null, sfxBus = null, musicBus = null, musicFilter = null;
  let revIn = null, delayIn = null, sfxRev = null;
  let noiseBuf = null;
  let muted = false;
  const MASTER_VOL = 0.85;
  let wantMode = 'silence';   // last requested music mode (remembered even before init)
  let curName = null;
  let cur = null;             // active mode state
  let timer = null;
  let tensionTarget = 0, tension = 0;
  let lastTickWasTock = false;
  const lastSfx = {};

  const LOOKAHEAD = 0.35;
  const TICK_MS = 40;

  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function pat(s) { return (s + '................').slice(0, 16); }

  // ------------------------------------------------------------------ node helpers
  function gainNode(v) { const g = ac.createGain(); g.gain.value = v; return g; }
  function osc(type, f, t, stop) {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(f, t);
    o.start(t);
    o.stop(stop);
    return o;
  }
  function noiseSrc(t, dur) {
    const s = ac.createBufferSource();
    s.buffer = noiseBuf;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur);
    return s;
  }
  // exponential attack/decay envelope on a gain node; returns the end time
  function env(g, t, att, peak, dur) {
    peak = Math.max(0.0002, peak);
    g.gain.cancelScheduledValues(t);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + Math.max(0.001, att));
    g.gain.exponentialRampToValueAtTime(0.0001, t + Math.max(att + 0.01, dur));
    return t + Math.max(att + 0.01, dur);
  }
  function biquad(type, f, q) {
    const b = ac.createBiquadFilter();
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q === undefined ? 1 : q;
    return b;
  }

  // filtered noise burst with a frequency sweep
  function nz(t, dur, type, f0, f1, q, peak, att, out) {
    const s = noiseSrc(t, dur + 0.05);
    const f = biquad(type, f0, q);
    f.frequency.setValueAtTime(f0, t);
    if (f1 && f1 !== f0) f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    const g = gainNode(0.0001);
    env(g, t, att || 0.004, peak, dur);
    s.connect(f); f.connect(g); g.connect(out || sfxBus);
    return g;
  }
  // oscillator with pitch drop
  function tn(t, dur, type, f0, f1, peak, att, out) {
    const o = osc(type, f0, t, t + dur + 0.05);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
    const g = gainNode(0.0001);
    env(g, t, att || 0.003, peak, dur);
    o.connect(g); g.connect(out || sfxBus);
    return o;
  }

  // ------------------------------------------------------------------ init
  function makeReverb(seconds) {
    const len = Math.floor(ac.sampleRate * seconds);
    const buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const cv = ac.createConvolver();
    cv.buffer = buf;
    return cv;
  }

  function readMuted() {
    try { return !!(DD.save && DD.save.data && DD.save.data.muted); } catch (e) { return false; }
  }

  function init() {
    try {
      if (ac) {
        if (ac.state === 'suspended' && ac.resume) ac.resume();
        return;
      }
      if (failed) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { failed = true; return; }
      ac = new AC();
      muted = readMuted();

      const comp = ac.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 18; comp.ratio.value = 5;
      comp.attack.value = 0.004; comp.release.value = 0.2;
      master = gainNode(muted ? 0 : MASTER_VOL);
      master.connect(comp); comp.connect(ac.destination);

      sfxBus = gainNode(0.95); sfxBus.connect(master);
      musicBus = gainNode(0.42); musicBus.connect(master);
      musicFilter = biquad('lowpass', 2400, 0.5); musicFilter.connect(musicBus);

      // noise source
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
      const nd = noiseBuf.getChannelData(0);
      for (let i = 0; i < nd.length; i++) nd[i] = Math.random() * 2 - 1;

      // shared reverb + tempo-less feedback echo (used by bells, pads and arps)
      const rev = makeReverb(2.6);
      revIn = gainNode(1);
      const revOut = gainNode(0.5);
      revIn.connect(rev); rev.connect(revOut); revOut.connect(master);
      sfxRev = gainNode(0.5); sfxRev.connect(revIn);
      const dly = ac.createDelay(1.0);
      dly.delayTime.value = 0.32;
      const fb = gainNode(0.36), dlp = biquad('lowpass', 2400, 0.7);
      delayIn = gainNode(1);
      delayIn.connect(dly); dly.connect(dlp); dlp.connect(fb); fb.connect(dly);
      dlp.connect(master);

      if (ac.state === 'suspended' && ac.resume) ac.resume();
      // start whatever the game already asked for
      if (wantMode && wantMode !== 'silence') startMode(wantMode);
      if (!timer) timer = setInterval(scheduler, TICK_MS);
    } catch (e) {
      failed = true;
      ac = null;
    }
  }

  function setMuted(b) {
    try {
      muted = !!b;
      try { if (DD.save && DD.save.data) DD.save.data.muted = muted; } catch (e) { /* ignore */ }
      if (ac && master) master.gain.setTargetAtTime(muted ? 0 : MASTER_VOL, ac.currentTime, 0.03);
    } catch (e) { /* ignore */ }
  }

  // ================================================================== MUSIC
  const MIN = [0, 2, 3, 5, 7, 8, 10], PHR = [0, 1, 3, 5, 7, 8, 10], LOC = [0, 1, 3, 5, 6, 8, 10], MAJ = [0, 2, 4, 5, 7, 9, 11];

  // Chords are [semitone offset from root, intervals]. Patterns are 16-step (one bar of 16ths) strings.
  const MODES = {
    title: {
      bpm: 56, root: 50, scale: MIN, cut: 2200, chordBars: 2,
      prog: [[0, [0, 3, 7]], [-4, [0, 4, 7]], [-7, [0, 3, 7]], [-5, [0, 4, 7, 10]]],
      pad: 0.17, padCut: 1200, drone: 0.22, brass: 0.11,
      bass: pat('1'), bassG: 0.15,
      kick: pat('1.....1'), kickG: 0.38,
      arp: pat('0...2...1...3'), arpG: 0.045, arpP: 0.7,
      bell: pat('1.......1.1'), bellP: 0.6, bellG: 0.16, bellOct: 12,
      urge: false
    },
    explore: {
      bpm: 84, root: 45, scale: MIN, cut: 2600, chordBars: 2,
      prog: [[0, [0, 3, 7]], [-4, [0, 4, 7]], [-7, [0, 3, 7]], [-5, [0, 4, 7]]],
      pad: 0.13, padCut: 1000, drone: 0.2, brass: 0.08,
      bass: pat('1.1.1.1.1.1.1.1.'), bassG: 0.17, bassAcc: pat('1.......2.......'),
      arp: pat('0.2.1.3.2.1.4.0.'), arpG: 0.06, arpP: 0.78,
      bell: pat('1.......1.....1'), bellP: 0.5, bellG: 0.13, bellOct: 12,
      tick: 4, tickG: 0.045
    },
    combat: {
      bpm: 120, root: 38, scale: PHR, cut: 4200, chordBars: 1,
      prog: [[0, [0, 3, 7]], [1, [0, 4, 7]], [-4, [0, 4, 7]], [-2, [0, 4, 7]]],
      pad: 0.11, padCut: 1800, drone: 0.24, brass: 0.1,
      bass: pat('1.11.1.11.11.1.1'), bassG: 0.21, bassAcc: pat('1...............'),
      arp: pat('0.1.2.1.0.1.2.3.'), arpG: 0.072, arpP: 0.92,
      kick: pat('1...1...1...1..1'), kickG: 0.55,
      snare: pat('....1.......1...'), snareG: 0.28,
      hat: pat('..1...1...1...1.'), hatG: 0.05,
      timp: pat('1.......1.......'), timpG: 0.45,
      stab: pat('1.......1.......'), stabG: 0.1,
      bell: pat('1...............'), bellP: 0.25, bellG: 0.1, bellOct: 0
    },
    boss: {
      bpm: 128, root: 36, scale: LOC, cut: 3800, chordBars: 1,
      prog: [[0, [0, 3, 7]], [1, [0, 4, 7]], [0, [0, 3, 6]], [7, [0, 4, 7, 10]]],
      pad: 0.15, padCut: 2600, drone: 0.3, brass: 0.16,
      bass: pat('1.1.11.1.1.1.11.'), bassG: 0.23, bassAcc: pat('1.......1.......'),
      arp: pat('0123210301232103'), arpG: 0.06, arpP: 0.85,
      kick: pat('1.....1.1.......'), kickG: 0.6,
      snare: pat('....1.......1..1'), snareG: 0.3,
      hat: pat('1111111111111111'), hatG: 0.028,
      timp: pat('1..1..1.1..1..1.'), timpG: 0.6,
      stab: pat('1.....1.1.......'), stabG: 0.13,
      bell: pat('1'), bellP: 0.9, bellG: 0.2, bellOct: -12, bellEvery: 2
    },
    table: {
      bpm: 50, root: 50, scale: MIN, cut: 1800, chordBars: 2,
      prog: [[0, [0, 3, 7]], [-4, [0, 4, 7]], [-7, [0, 3, 7]], [-5, [0, 4, 7]]],
      pad: 0.12, padCut: 900, drone: 0.22, brass: 0.06,
      kick: pat('1.1'), kickG: 0.32,
      bell: pat('1.1.1.1.1.1.1.1.'), bellP: 0.28, bellG: 0.12, bellOct: 24, bellShort: true,
      urge: false
    },
    victory: {
      bpm: 100, root: 50, scale: MAJ, cut: 5200, chordBars: 1,
      prog: [[0, [0, 4, 7]], [5, [0, 4, 7]], [7, [0, 4, 7]], [0, [0, 4, 7]]],
      pad: 0.15, padCut: 2800, drone: 0.16, brass: 0.12,
      bass: pat('1...2...1...2'), bassG: 0.2,
      arp: pat('0.1.2.3.2.1.0.1.'), arpG: 0.07, arpP: 0.95,
      timp: pat('1.......1...1'), timpG: 0.4,
      stab: pat('1...1...1'), stabG: 0.14,
      bell: pat('1.1.1.1.1.1.1.1.'), bellP: 0.5, bellG: 0.13, bellOct: 12,
      urge: false
    }
  };

  // ---- instruments (all take the mode state `s` so routing fades with the crossfade)
  function bassNote(s, t, midi, dur, vel) {
    const f = mtof(midi), end = t + dur + 0.12;
    const lp = biquad('lowpass', f * 2, 5);
    const top = Math.min(f * 8 + 300, 3200);
    lp.frequency.setValueAtTime(f * 2, t);
    lp.frequency.exponentialRampToValueAtTime(top, t + 0.015);
    lp.frequency.exponentialRampToValueAtTime(f * 1.4, t + dur);
    const g = gainNode(0.0001);
    env(g, t, 0.006, vel, dur + 0.04);
    const o1 = osc('sawtooth', f, t, end), o2 = osc('square', f * 1.004, t, end), sub = osc('sine', f / 2, t, end);
    const m2 = gainNode(0.5), ms = gainNode(0.9);
    o1.connect(lp); o2.connect(m2); m2.connect(lp); sub.connect(ms); ms.connect(g);
    lp.connect(g); g.connect(s.bus);
  }
  function pluck(s, t, midi, dur, vel) {
    const f = mtof(midi), end = t + dur + 0.1;
    const lp = biquad('lowpass', 3400, 2);
    lp.frequency.setValueAtTime(3400, t);
    lp.frequency.exponentialRampToValueAtTime(500, t + dur);
    const g = gainNode(0.0001);
    env(g, t, 0.003, vel, dur);
    const o1 = osc('sawtooth', f, t, end), o2 = osc('square', f * 1.006, t, end);
    const m2 = gainNode(0.4);
    o1.connect(lp); o2.connect(m2); m2.connect(lp); lp.connect(g);
    g.connect(s.bus);
    const send = gainNode(0.55); g.connect(send); send.connect(s.dly);
  }
  function bell(s, t, midi, dur, vel) {
    const f = mtof(midi), end = t + dur + 0.1;
    const car = osc('sine', f, t, end), mod = osc('sine', f * 3.51, t, end), p2 = osc('sine', f * 2.76, t, end);
    const mg = gainNode(0.0001);
    mg.gain.setValueAtTime(f * 1.7, t);
    mg.gain.exponentialRampToValueAtTime(Math.max(1, f * 0.05), t + dur * 0.6);
    mod.connect(mg); mg.connect(car.frequency);
    const g = gainNode(0.0001);
    env(g, t, 0.002, vel, dur);
    const pg = gainNode(0.25);
    car.connect(g); p2.connect(pg); pg.connect(g);
    g.connect(s.bus);
    const send = gainNode(0.8); g.connect(send); send.connect(s.rev);
  }
  function brassStab(s, t, midis, dur, vel) {
    const end = t + dur + 0.1;
    const lp = biquad('lowpass', 500, 1.2);
    lp.frequency.setValueAtTime(400, t);
    lp.frequency.exponentialRampToValueAtTime(2600, t + 0.07);
    lp.frequency.exponentialRampToValueAtTime(900, t + dur);
    const g = gainNode(0.0001);
    env(g, t, 0.05, vel, dur);
    midis.forEach(function (m) {
      const f = mtof(m);
      const a = osc('sawtooth', f, t, end), b = osc('sawtooth', f * 1.007, t, end);
      a.connect(lp); b.connect(lp);
    });
    lp.connect(g); g.connect(s.bus);
    const send = gainNode(0.3); g.connect(send); send.connect(s.rev);
  }
  function kick(s, t, vel) {
    const o = osc('sine', 150, t, t + 0.3);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
    const g = gainNode(0.0001);
    env(g, t, 0.002, vel, 0.26);
    o.connect(g); g.connect(s.bus);
    const c = nz(t, 0.02, 'highpass', 2500, 2500, 0.7, vel * 0.25, 0.001, s.bus);
    return c;
  }
  function snare(s, t, vel) {
    nz(t, 0.16, 'bandpass', 1900, 1100, 0.9, vel, 0.002, s.bus);
    const o = osc('triangle', 200, t, t + 0.12);
    o.frequency.exponentialRampToValueAtTime(120, t + 0.1);
    const g = gainNode(0.0001);
    env(g, t, 0.002, vel * 0.7, 0.1);
    o.connect(g); g.connect(s.bus);
  }
  function hat(s, t, vel) { nz(t, 0.045, 'highpass', 7500, 7500, 0.8, vel, 0.001, s.bus); }
  function timp(s, t, vel) {
    const o = osc('sine', 96, t, t + 0.6), o2 = osc('sine', 150, t, t + 0.4);
    o.frequency.exponentialRampToValueAtTime(50, t + 0.4);
    o2.frequency.exponentialRampToValueAtTime(70, t + 0.25);
    const g = gainNode(0.0001), g2 = gainNode(0.0001);
    env(g, t, 0.004, vel, 0.55); env(g2, t, 0.004, vel * 0.5, 0.3);
    o.connect(g); o2.connect(g2); g.connect(s.bus); g2.connect(s.bus);
    nz(t, 0.09, 'lowpass', 500, 120, 0.8, vel * 0.8, 0.002, s.bus);
    const send = gainNode(0.35); g.connect(send); send.connect(s.rev);
  }
  function clockTick(s, t, vel, tock) {
    const f = tock ? 900 : 1300;
    const o = osc('square', f, t, t + 0.05);
    o.frequency.exponentialRampToValueAtTime(f * 0.55, t + 0.03);
    const g = gainNode(0.0001);
    env(g, t, 0.001, vel, 0.035);
    const bp = biquad('bandpass', f, 4);
    o.connect(bp); bp.connect(g); g.connect(s.bus);
  }

  // pad chord: detuned saws with slow vibrato through a lowpass = synthetic strings
  function padChord(s, t, midis, dur, vel, cut) {
    const att = Math.min(1.6, dur * 0.35), rel = Math.min(2.0, dur * 0.45);
    const end = t + dur + rel + 0.2;
    const lp = biquad('lowpass', cut, 0.8);
    lp.frequency.setValueAtTime(cut * 0.55, t);
    lp.frequency.linearRampToValueAtTime(cut, t + dur * 0.5);
    lp.frequency.linearRampToValueAtTime(cut * 0.6, t + dur + rel);
    const g = gainNode(0.0001);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), t + att);
    g.gain.setValueAtTime(Math.max(0.0002, vel), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    const lfo = osc('sine', 5.3, t, end), lg = gainNode(7);
    lfo.connect(lg);
    midis.forEach(function (m) {
      const f = mtof(m);
      [-9, 8, 0].forEach(function (d, i) {
        const o = osc(i === 2 ? 'triangle' : 'sawtooth', f, t, end);
        o.detune.value = d;
        lg.connect(o.detune);
        o.connect(lp);
      });
    });
    lp.connect(g); g.connect(s.bus);
    const send = gainNode(0.5); g.connect(send); send.connect(s.rev);
  }
  // low brass swell (saw + square through a swelling lowpass)
  function brassSwell(s, t, midi, dur, vel) {
    const f = mtof(midi), att = Math.min(1.3, dur * 0.4), rel = Math.min(1.6, dur * 0.4), end = t + dur + rel + 0.2;
    const lp = biquad('lowpass', 250, 1.1);
    lp.frequency.setValueAtTime(220, t);
    lp.frequency.exponentialRampToValueAtTime(1100, t + att);
    lp.frequency.exponentialRampToValueAtTime(300, t + dur + rel);
    const g = gainNode(0.0001);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vel), t + att);
    g.gain.setValueAtTime(Math.max(0.0002, vel), t + dur);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + rel);
    const a = osc('sawtooth', f, t, end), b = osc('square', f * 1.003, t, end), c = osc('sawtooth', f * 2.005, t, end);
    const cg = gainNode(0.3);
    a.connect(lp); b.connect(lp); c.connect(cg); cg.connect(lp);
    lp.connect(g); g.connect(s.bus);
  }

  // ---- mode lifecycle
  function startDrone(s) {
    const cfg = s.cfg, t = ac.currentTime;
    const f = mtof(cfg.root - 12);
    const lp = biquad('lowpass', 260, 1.2);
    const lfo = ac.createOscillator(); lfo.frequency.value = 0.07; lfo.start();
    const lg = gainNode(120); lfo.connect(lg); lg.connect(lp.frequency);
    const g = gainNode(0.0001);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, cfg.drone), t + 2.5);
    const parts = [['sawtooth', 1, 0], ['sawtooth', 1.006, 0], ['sine', 0.5, 0], ['sine', 1.5, -6]];
    s.droneOscs = [];
    s.droneRatios = [];
    parts.forEach(function (p) {
      const o = ac.createOscillator();
      o.type = p[0]; o.frequency.value = f * p[1]; o.detune.value = p[2]; o.start();
      const m = gainNode(p[0] === 'sine' ? (p[1] < 1 ? 1.0 : 0.25) : 0.5);
      o.connect(m); m.connect(lp);
      s.droneOscs.push(o); s.droneRatios.push(p[1]);
    });
    lp.connect(g); g.connect(s.bus);
    s.allOscs = s.droneOscs.concat([lfo]);
  }

  function startMode(name) {
    const cfg = MODES[name];
    retire(cur);
    cur = null;
    curName = name;
    if (!cfg) return;
    const t = ac.currentTime;
    const bus = gainNode(0), rev = gainNode(0), dly = gainNode(0);
    bus.connect(musicFilter); rev.connect(revIn); dly.connect(delayIn);
    [bus, rev, dly].forEach(function (n) { n.gain.setTargetAtTime(1, t, 0.55); });
    cur = { name: name, cfg: cfg, bus: bus, rev: rev, dly: dly, next: t + 0.08, step: 0, droneOscs: [], droneRatios: [], allOscs: [] };
    startDrone(cur);
  }
  function retire(s) {
    if (!s || !ac) return;
    const t = ac.currentTime;
    [s.bus, s.rev, s.dly].forEach(function (n) { n.gain.cancelScheduledValues(t); n.gain.setTargetAtTime(0, t, 0.5); });
    setTimeout(function () {
      try {
        s.allOscs.forEach(function (o) { try { o.stop(); } catch (e) { /* ignore */ } });
        s.bus.disconnect(); s.rev.disconnect(); s.dly.disconnect();
      } catch (e) { /* ignore */ }
    }, 3600);
  }

  function music(mode) {
    try {
      wantMode = mode;
      if (!ac) return;
      if (mode === curName) return;
      if (!MODES[mode]) { retire(cur); cur = null; curName = mode; return; }
      startMode(mode);
    } catch (e) { /* ignore */ }
  }
  function setTension(x) {
    x = +x;
    tensionTarget = isNaN(x) ? 0 : clamp(x, 0, 1);
  }

  function stepDur(s) { return 60 / (s.cfg.bpm * (1 + 0.4 * tension)) / 4; }

  function chordTone(base, ints, k) {
    const n = ints.length;
    return base + ints[((k % n) + n) % n] + 12 * Math.floor(k / n);
  }

  function onChord(s, t, chord, chordDur) {
    const cfg = s.cfg, base = cfg.root + chord[0];
    const tones = chord[1].map(function (i) { return base + 12 + i; });
    tones.push(base + 24 + chord[1][0]);
    tones.push(base + chord[1][chord[1].length > 3 ? 3 : 2] + 0);
    padChord(s, t, tones, chordDur, cfg.pad, cfg.padCut);
    if (cfg.brass) brassSwell(s, t, base - 12, chordDur, cfg.brass);
    s.droneOscs.forEach(function (o, i) {
      o.frequency.setTargetAtTime(mtof(base - 12) * s.droneRatios[i], t, 0.5);
    });
  }

  function scheduleStep(s, t) {
    const cfg = s.cfg, sd = stepDur(s);
    const si = s.step % 16, bar = Math.floor(s.step / 16);
    const chord = cfg.prog[Math.floor(bar / cfg.chordBars) % cfg.prog.length];
    const base = cfg.root + chord[0];
    const ints = chord[1];
    if (si === 0 && bar % cfg.chordBars === 0) onChord(s, t, chord, sd * 16 * cfg.chordBars);

    // pulsing bass
    if (cfg.bass && cfg.bass[si] !== '.') {
      const acc = cfg.bassAcc && cfg.bassAcc[si] !== '.';
      const ch = cfg.bass[si];
      const midi = ch === '2' ? base + 7 : ch === '3' ? base + 12 : base;
      bassNote(s, t, midi, sd * (acc ? 1.8 : 0.9), cfg.bassG * (acc ? 1.25 : 1));
    }
    // arpeggio
    if (cfg.arp && cfg.arp[si] !== '.' && Math.random() < cfg.arpP) {
      const k = parseInt(cfg.arp[si], 10);
      const up = 12 + (tension > 0.6 ? 12 * (Math.random() < 0.3 ? 1 : 0) : 0);
      pluck(s, t, chordTone(base + up, ints, isNaN(k) ? 0 : k), sd * 1.6, cfg.arpG);
    }
    // bells (random scale/chord notes)
    if (cfg.bell && cfg.bell[si] !== '.' && (!cfg.bellEvery || bar % cfg.bellEvery === 0) && Math.random() < cfg.bellP) {
      const midi = Math.random() < 0.6
        ? chordTone(base + 12, ints, Math.floor(rnd(0, 6)))
        : base + 12 + cfg.scale[Math.floor(rnd(0, 7))];
      bell(s, t, midi + (cfg.bellOct || 0), cfg.bellShort ? 1.4 : 3.2, cfg.bellG);
    }
    // percussion
    if (cfg.kick && cfg.kick[si] !== '.') kick(s, t, cfg.kickG * (si % 4 === 0 ? 1 : 0.7));
    if (cfg.snare && cfg.snare[si] !== '.') snare(s, t, cfg.snareG);
    if (cfg.hat && cfg.hat[si] !== '.') hat(s, t, cfg.hatG * (si % 4 === 0 ? 1.4 : 1));
    if (cfg.timp && cfg.timp[si] !== '.') timp(s, t, cfg.timpG);
    if (cfg.stab && cfg.stab[si] !== '.') {
      brassStab(s, t, [base + 12, base + 12 + ints[1], base + 12 + ints[2], base + 24], sd * 3, cfg.stabG);
    }
    if (cfg.tick && s.step % cfg.tick === 0) {
      clockTick(s, t, cfg.tickG, (s.step / cfg.tick) % 2 === 1);
    }

    // urgency layers driven by the clock: ticking hats, heartbeat kick, alarm pings
    if (cfg.urge !== false && tension > 0.28) {
      if (si % 4 === 2 && !cfg.hat) hat(s, t, 0.02 + 0.06 * tension);
      if (tension > 0.5 && !cfg.kick && si % 8 === 0) kick(s, t, 0.18 + 0.3 * tension);
      if (tension > 0.55 && si % 2 === 1 && Math.random() < (tension - 0.5) * 0.9) hat(s, t, 0.02 + 0.04 * tension);
      if (tension > 0.8 && si === 0) {
        pluck(s, t, base + 36, sd * 2, 0.05 * tension);
        pluck(s, t + sd * 2, base + 42, sd * 2, 0.05 * tension);
      }
    }
    if (cfg.urge !== false && tension > 0.9 && si % 4 === 0) {
      snare(s, t, 0.06 + 0.1 * (tension - 0.9) * 10);
    }
  }

  function scheduler() {
    try {
      if (!ac) return;
      const now = ac.currentTime;
      tension += (tensionTarget - tension) * 0.06;
      if (musicFilter) {
        const cfg = cur && cur.cfg;
        const cut = (cfg ? cfg.cut : 2400) * (1 + tension * 2.6);
        musicFilter.frequency.setTargetAtTime(cut, now, 0.25);
      }
      if (cur) {
        cur.droneOscs.forEach(function (o) { o.detune.setTargetAtTime(tension * 70, now, 0.4); });
        if (cur.next < now - 0.4) cur.next = now + 0.05;
        let guard = 0;
        while (cur.next < now + LOOKAHEAD && guard++ < 64) {
          scheduleStep(cur, cur.next);
          cur.next += stepDur(cur);
          cur.step++;
        }
      }
    } catch (e) { /* never throw out of the timer */ }
  }

  // ================================================================== SFX
  function growl(t, dur, f0, f1, peak, rough, out) {
    const end = t + dur + 0.08;
    const o = osc('sawtooth', f0, t, end), o2 = osc('square', f0 * 0.5, t, end);
    o.frequency.exponentialRampToValueAtTime(Math.max(12, f1), t + dur);
    o2.frequency.exponentialRampToValueAtTime(Math.max(10, f1 * 0.5), t + dur);
    const am = gainNode(0.5), lfo = osc('sine', rough, t, end), lg = gainNode(0.5);
    lfo.connect(lg); lg.connect(am.gain);
    const lp = biquad('lowpass', 1100, 1.5);
    lp.frequency.setValueAtTime(1100, t);
    lp.frequency.exponentialRampToValueAtTime(240, t + dur);
    const fm = biquad('bandpass', 620, 2.2), fmg = gainNode(0.9);
    const g = gainNode(0.0001);
    env(g, t, 0.02, peak, dur);
    const m2 = gainNode(0.6);
    o.connect(am); o2.connect(m2); m2.connect(am);
    am.connect(lp); am.connect(fm); fm.connect(fmg); fmg.connect(lp);
    lp.connect(g); g.connect(out || sfxBus);
    nz(t, dur * 0.8, 'lowpass', 900, 200, 0.8, peak * 0.35, 0.02, out);
  }
  function squelch(t, dur, peak, out) {
    const s = noiseSrc(t, dur + 0.05);
    const bp = biquad('bandpass', 300, 10);
    bp.frequency.setValueAtTime(260, t);
    bp.frequency.exponentialRampToValueAtTime(1300, t + dur * 0.45);
    bp.frequency.exponentialRampToValueAtTime(220, t + dur);
    const lfo = osc('sine', 26, t, t + dur + 0.05), lg = gainNode(260);
    lfo.connect(lg); lg.connect(bp.frequency);
    const lp = biquad('lowpass', 2200, 0.7);
    const g = gainNode(0.0001);
    env(g, t, 0.01, peak, dur);
    s.connect(bp); bp.connect(lp); lp.connect(g); g.connect(out || sfxBus);
    for (let i = 0; i < 3; i++) {
      const bt = t + rnd(0, dur * 0.8), f = rnd(180, 420);
      tn(bt, 0.06, 'sine', f, f * rnd(1.6, 2.4), peak * 0.5, 0.004, out);
    }
  }
  function crack(t, peak, out) {
    nz(t, 0.03, 'highpass', 3000, 3000, 0.7, peak, 0.001, out);
    nz(t, 0.1, 'bandpass', 1500, 500, 3, peak * 0.8, 0.001, out);
    tn(t, 0.09, 'triangle', 230, 85, peak * 0.6, 0.001, out);
  }
  function sizzle(t, dur, peak, out) {
    const s = noiseSrc(t, dur + 0.05);
    const hp = biquad('highpass', 4200, 0.8);
    const am = gainNode(0.5), lfo = osc('sine', 33, t, t + dur + 0.05), lg = gainNode(0.45);
    lfo.connect(lg); lg.connect(am.gain);
    const g = gainNode(0.0001);
    env(g, t, 0.03, peak, dur);
    s.connect(hp); hp.connect(am); am.connect(g); g.connect(out || sfxBus);
    for (let i = 0; i < 14; i++) nz(t + rnd(0, dur * 0.9), 0.012, 'highpass', 6000, 6000, 1, peak * rnd(0.3, 0.9), 0.001, out);
  }
  function clang(t, peak, out) {
    [820, 1130, 1670].forEach(function (f, i) { tn(t, 0.32 - i * 0.07, 'sine', f, f * 0.98, peak * (0.6 - i * 0.15), 0.001, out); });
    nz(t, 0.05, 'highpass', 2500, 2500, 0.8, peak * 0.6, 0.001, out);
  }
  function chime(t, f, dur, peak) {
    tn(t, dur, 'sine', f, f, peak, 0.004, sfxBus);
    tn(t, dur * 0.6, 'sine', f * 2.76, f * 2.76, peak * 0.25, 0.003, sfxBus);
    const send = gainNode(0.5);
    const o = osc('sine', f, t, t + dur + 0.05), g = gainNode(0.0001);
    env(g, t, 0.004, peak * 0.4, dur);
    o.connect(g); g.connect(send); send.connect(sfxRev);
  }
  function clicks(t, n, spacing, peak, f) {
    for (let i = 0; i < n; i++) nz(t + i * spacing, 0.02, 'bandpass', f, f, 4, peak, 0.001);
  }

  const SFX = {
    step: function (t) {
      const f = rnd(230, 330);
      nz(t, 0.07, 'lowpass', f * 1.6, f * 0.6, 0.8, 0.22, 0.003);
      tn(t, 0.08, 'sine', rnd(85, 105), 55, 0.22, 0.002);
      nz(t, 0.02, 'highpass', 3500, 3500, 1, 0.05, 0.001);
    },
    hit: function (t) {
      nz(t, 0.16, 'bandpass', 950, 180, 1.2, 0.6, 0.002);
      tn(t, 0.18, 'sine', 170, 48, 0.6, 0.002);
      growl(t, 0.2, 120, 46, 0.22, 45);
      squelch(t + 0.03, 0.14, 0.16);
    },
    hurt: function (t) {
      growl(t, 0.38, 165, 62, 0.42, 38);
      nz(t, 0.12, 'bandpass', 1200, 300, 1.4, 0.4, 0.002);
      squelch(t + 0.04, 0.22, 0.22);
      tn(t, 0.14, 'sine', 120, 45, 0.45, 0.002);
    },
    block: function (t) {
      clang(t, 0.4);
      tn(t, 0.1, 'sine', 140, 60, 0.4, 0.002);
    },
    card: function (t) {
      nz(t, 0.07, 'highpass', 3200, 6500, 0.9, 0.22, 0.003);
      tn(t, 0.05, 'triangle', 1100, 700, 0.14, 0.002);
      nz(t + 0.05, 0.05, 'bandpass', 1800, 900, 2, 0.1, 0.002);
    },
    burn: function (t) {
      nz(t, 0.55, 'bandpass', 350, 1700, 1.1, 0.38, 0.05);
      nz(t, 0.6, 'lowpass', 500, 160, 0.8, 0.28, 0.04);
      sizzle(t + 0.05, 0.5, 0.16);
    },
    overheat: function (t) {
      sizzle(t, 0.95, 0.4);
      nz(t, 0.8, 'highpass', 3000, 5200, 0.8, 0.3, 0.04);
      tn(t, 0.7, 'sawtooth', 620, 210, 0.16, 0.01);
      tn(t + 0.05, 0.5, 'square', 1240, 420, 0.06, 0.01);
      growl(t + 0.1, 0.5, 110, 55, 0.2, 55);
    },
    break: function (t) {
      crack(t, 0.7); crack(t + 0.045, 0.55); crack(t + 0.11, 0.6);
      squelch(t + 0.06, 0.34, 0.4);
      tn(t, 0.32, 'sine', 120, 34, 0.7, 0.002);
      growl(t + 0.08, 0.7, 150, 34, 0.38, 32);
      nz(t + 0.1, 0.4, 'lowpass', 1400, 200, 0.8, 0.3, 0.01);
    },
    graft: function (t) {
      squelch(t, 0.42, 0.5);
      for (let i = 0; i < 3; i++) {
        const st = t + 0.18 + i * 0.11;
        nz(st, 0.03, 'highpass', 5000, 5000, 1, 0.3, 0.001);
        tn(st, 0.05, 'triangle', 1500, 900, 0.12, 0.001);
      }
      tn(t + 0.05, 0.4, 'sine', 100, 40, 0.5, 0.004);
      growl(t + 0.3, 0.45, 95, 52, 0.22, 26);
      chime(t + 0.62, 261.6, 0.9, 0.12);
    },
    squelch: function (t) {
      squelch(t, 0.32, 0.55);
      tn(t, 0.16, 'sine', 90, 45, 0.3, 0.004);
    },
    pickup: function (t) {
      chime(t, 880, 0.5, 0.2);
      chime(t + 0.07, 1318.5, 0.6, 0.16);
      nz(t, 0.05, 'highpass', 4500, 4500, 1, 0.08, 0.001);
    },
    trap: function (t) {
      nz(t, 0.05, 'highpass', 2600, 2600, 0.8, 0.5, 0.001);
      clang(t + 0.01, 0.3);
      tn(t, 0.16, 'sine', 160, 50, 0.6, 0.002);
      squelch(t + 0.05, 0.2, 0.3);
    },
    acid: function (t) {
      nz(t, 0.7, 'bandpass', 2400, 900, 5, 0.3, 0.02);
      sizzle(t, 0.7, 0.28);
      for (let i = 0; i < 6; i++) {
        const f = rnd(300, 700);
        tn(t + i * 0.09, 0.06, 'sine', f, f * 2, 0.16, 0.003);
      }
      squelch(t, 0.3, 0.3);
    },
    steam: function (t) {
      clang(t, 0.16);
      nz(t + 0.02, 0.75, 'bandpass', 3200, 1600, 0.7, 0.4, 0.05);
      nz(t + 0.02, 0.75, 'highpass', 2000, 4000, 0.6, 0.22, 0.08);
      tn(t, 0.12, 'sine', 110, 55, 0.3, 0.003);
    },
    door: function (t) {
      tn(t, 0.6, 'sawtooth', 85, 150, 0.1, 0.05);
      nz(t, 0.6, 'bandpass', 220, 340, 6, 0.18, 0.08);
      nz(t + 0.4, 0.3, 'lowpass', 400, 90, 0.8, 0.4, 0.005);
      tn(t + 0.42, 0.3, 'sine', 80, 35, 0.6, 0.003);
    },
    shift: function (t) {
      tn(t, 1.0, 'sawtooth', 58, 46, 0.14, 0.15);
      tn(t, 1.0, 'square', 29, 23, 0.16, 0.15);
      nz(t, 1.0, 'lowpass', 350, 160, 1, 0.3, 0.12);
      clicks(t + 0.05, 12, 0.075, 0.24, 1700);
      tn(t + 0.1, 0.8, 'sine', 300, 700, 0.05, 0.2);
      clang(t + 0.85, 0.18);
    },
    tick: function (t) {
      const tock = lastTickWasTock;
      lastTickWasTock = !lastTickWasTock;
      const f = tock ? 780 : 1150;
      tn(t, 0.05, 'square', f, f * 0.5, 0.24, 0.001);
      nz(t, 0.02, 'bandpass', f * 1.5, f * 1.5, 5, 0.4, 0.001);
      tn(t, 0.09, 'sine', tock ? 95 : 130, 60, 0.35, 0.002);
    },
    death: function (t) {
      growl(t, 1.7, 210, 26, 0.5, 30);
      tn(t, 1.4, 'sine', 90, 24, 0.6, 0.01);
      nz(t + 0.05, 1.2, 'lowpass', 1200, 90, 0.9, 0.4, 0.02);
      squelch(t + 0.15, 0.6, 0.35);
      crack(t + 0.3, 0.4);
      const send = gainNode(0.5);
      const o = osc('sawtooth', 70, t, t + 1.8), g = gainNode(0.0001);
      o.frequency.exponentialRampToValueAtTime(28, t + 1.6);
      env(g, t, 0.2, 0.2, 1.7);
      o.connect(g); g.connect(send); send.connect(sfxRev);
    },
    victory: function (t) {
      [[293.66, 0], [369.99, 0.16], [440, 0.32], [587.33, 0.5]].forEach(function (n) {
        const o1 = osc('sawtooth', n[0], t + n[1], t + n[1] + 1.3), o2 = osc('sawtooth', n[0] * 1.006, t + n[1], t + n[1] + 1.3);
        const lp = biquad('lowpass', 500, 1);
        lp.frequency.setValueAtTime(400, t + n[1]);
        lp.frequency.exponentialRampToValueAtTime(3000, t + n[1] + 0.1);
        lp.frequency.exponentialRampToValueAtTime(900, t + n[1] + 1.2);
        const g = gainNode(0.0001);
        env(g, t + n[1], 0.04, 0.16, 1.2);
        o1.connect(lp); o2.connect(lp); lp.connect(g); g.connect(sfxBus);
        const send = gainNode(0.5); g.connect(send); send.connect(sfxRev);
      });
      tn(t, 0.7, 'sine', 90, 50, 0.6, 0.004);
      tn(t + 0.5, 0.9, 'sine', 90, 50, 0.6, 0.004);
      chime(t + 0.5, 1174.7, 1.4, 0.12);
    },
    select: function (t) {
      tn(t, 0.05, 'square', 660, 520, 0.12, 0.001);
      nz(t, 0.02, 'bandpass', 2600, 2600, 3, 0.15, 0.001);
      tn(t, 0.06, 'sine', 120, 70, 0.2, 0.002);
    },
    heal: function (t) {
      [440, 554.4, 659.3, 880].forEach(function (f, i) { chime(t + i * 0.07, f, 0.6, 0.12); });
      nz(t, 0.5, 'bandpass', 1800, 3600, 1.2, 0.05, 0.1);
      tn(t, 0.3, 'sine', 110, 150, 0.16, 0.05);
    },
    enemyDie: function (t) {
      growl(t, 0.85, 190, 30, 0.5, 34);
      squelch(t + 0.1, 0.5, 0.5);
      tn(t, 0.5, 'sine', 100, 28, 0.6, 0.004);
      crack(t + 0.08, 0.45);
      nz(t + 0.15, 0.6, 'lowpass', 1500, 120, 0.8, 0.35, 0.02);
    },
    draw: function (t) {
      nz(t, 0.14, 'bandpass', 900, 3200, 1.2, 0.25, 0.01);
      nz(t + 0.1, 0.04, 'highpass', 4000, 4000, 1, 0.14, 0.001);
    },
    error: function (t) {
      tn(t, 0.2, 'sawtooth', 110, 96, 0.22, 0.004);
      tn(t, 0.2, 'sawtooth', 117, 100, 0.2, 0.004);
      tn(t, 0.12, 'sine', 90, 50, 0.3, 0.002);
    }
  };

  function sfx(name) {
    try {
      if (!ac || muted) return;
      const fn = SFX[name];
      if (!fn || !Object.prototype.hasOwnProperty.call(SFX, name)) return;
      const now = ac.currentTime;
      // guard against stacking identical sounds in the same instant
      if (lastSfx[name] !== undefined && now - lastSfx[name] < 0.03) return;
      lastSfx[name] = now;
      if (ac.state === 'suspended' && ac.resume) ac.resume();
      fn(now + 0.005);
    } catch (e) { /* never throw */ }
  }

  DD.audio = {
    init: init,
    setMuted: setMuted,
    isMuted: function () { return muted; },
    music: music,
    setTension: setTension,
    sfx: sfx
  };
})();
