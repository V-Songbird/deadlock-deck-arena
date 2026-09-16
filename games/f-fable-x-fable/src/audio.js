// Deadlock Deck: El Reloj Anatómico — procedural audio (Web Audio API).
// Everything is synthesized at runtime: an ominous minor-key synth score
// (electronic + orchestral flavours) and guttural noise/oscillator SFX.
// No audio files. Attaches DD.audio; every public function is a safe no-op
// when Web Audio is unavailable and never throws.
(function () {
  'use strict';
  const LOOK = 0.15;        // scheduler lookahead (s)
  const TICK_MS = 40;       // scheduler interval (ms)
  const FADE = 1.0;         // music crossfade (s)
  const MAX_VOICES = 96;    // cap on simultaneous one-shot voices (music + sfx)

  let ctx = null, unavailable = false, lastResume = 0;
  let master, musicBus, sfxBus, noiseBuf;
  let muted = false, intensity = 0, appliedIntensity = -1;
  let live = 0;             // one-shot voices currently sounding
  let cur = null;           // current music track
  let pending = null;       // music requested before the context runs

  const hz = m => 440 * Math.pow(2, (m - 69) / 12);          // MIDI note -> Hz
  const clamp01 = v => v < 0 ? 0 : v > 1 ? 1 : v;
  const ramp = (v, a, b) => clamp01((v - a) / (b - a));       // 0..1 as v goes a..b
  const vary = () => 0.92 + Math.random() * 0.16;             // per-play pitch variation
  const safe = fn => function () { try { return fn.apply(null, arguments); } catch (e) { /* audio never breaks the game */ } };

  // ---------------------------------------------------------------- graph

  function build() {
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    const lp = ctx.createBiquadFilter();       // gentle lowpass: tames harsh saws/noise
    lp.type = 'lowpass'; lp.frequency.value = 12000; lp.Q.value = 0.5;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 12; comp.ratio.value = 4;
    comp.attack.value = 0.004; comp.release.value = 0.2;
    master.connect(lp); lp.connect(comp); comp.connect(ctx.destination);
    musicBus = ctx.createGain(); musicBus.gain.value = 0.55; musicBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 0.9; sfxBus.connect(master);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);   // 2 s of white noise, reused by every noise voice
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }

  function init() {
    if (unavailable) return;
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { unavailable = true; return; }
      try { ctx = new AC(); build(); } catch (e) { ctx = null; unavailable = true; return; }
      ctx.onstatechange = flush;
    }
    if (ctx.state === 'running') { flush(); return; }
    if (ctx.state !== 'closed' && Date.now() - lastResume > 250) {   // suspended/interrupted: retry resume() at most 4x per second
      lastResume = Date.now();
      const p = ctx.resume();
      if (p && p.then) p.then(flush, () => {});
    }
  }

  // Starts the track requested while the context was not running yet.
  function flush() { if (pending && ctx.state === 'running') { const n = pending; pending = null; music(n); } }

  // ---------------------------------------------------------------- voice helpers

  // Routes src -> mid[] -> envelope gain -> dest. Holds `vol` from t0+atk to
  // t0+dur, releases over `rel`, then stops and disconnects everything.
  function play(src, mid, dest, t0, dur, vol, atk, rel) {
    if (live >= MAX_VOICES || !(vol > 0)) return null;
    if (dur < atk) dur = atk;
    const g = ctx.createGain(), p = g.gain;
    p.setValueAtTime(0.0001, t0);
    p.linearRampToValueAtTime(vol, t0 + atk);
    p.setValueAtTime(vol, t0 + dur);
    p.exponentialRampToValueAtTime(0.0001, t0 + dur + rel);
    let n = src;
    for (const m of mid) { n.connect(m); n = m; }
    n.connect(g); g.connect(dest);
    src.start(t0); src.stop(t0 + dur + rel + 0.02);
    live++;
    src.onended = () => { live--; src.disconnect(); for (const m of mid) m.disconnect(); g.disconnect(); };
    return g;
  }

  // Oscillator voice. o: { atk, rel, to (glide target Hz), glide (s), det (cents), mid: [nodes] }
  function tone(dest, type, f, t0, dur, vol, o) {
    o = o || {};
    const s = ctx.createOscillator();
    s.type = type;
    s.frequency.setValueAtTime(f, t0);
    if (o.to) s.frequency.exponentialRampToValueAtTime(o.to, t0 + (o.glide || dur));
    if (o.det) s.detune.value = o.det;
    return play(s, o.mid || [], dest, t0, dur, vol, o.atk || 0.004, o.rel || 0.05);
  }

  // White-noise voice. o: { rate (playbackRate, < 1 = pitched down), atk, rel, mid }
  function noise(dest, t0, dur, vol, o) {
    o = o || {};
    const s = ctx.createBufferSource();
    s.buffer = noiseBuf; s.loop = true;
    s.playbackRate.value = o.rate || 1;
    return play(s, o.mid || [], dest, t0, dur, vol, o.atk || 0.004, o.rel || 0.05);
  }

  function flt(type, f, q) {
    const b = ctx.createBiquadFilter();
    b.type = type; b.frequency.value = f; b.Q.value = q || 1;
    return b;
  }

  function sweep(param, f0, f1, t0, dur) {
    param.setValueAtTime(f0, t0);
    param.exponentialRampToValueAtTime(f1, t0 + dur);
  }

  // Modulates an AudioParam with an oscillator between t0 and t1.
  function lfo(param, rate, depth, t0, t1, type) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type || 'sine'; o.frequency.value = rate; g.gain.value = depth;
    o.connect(g); g.connect(param);
    o.start(t0); o.stop(t1);
    o.onended = () => { o.disconnect(); g.disconnect(); };
  }

  // ---------------------------------------------------------------- instruments

  // Tolling bell: sine partials with fast-decaying overtones.
  function bell(dest, f, t0, vol) {
    const P = [[1, 1, 2.5], [2.0, 0.5, 1.4], [3.01, 0.25, 0.8], [4.2, 0.12, 0.35]];   // ratio, level, decay
    for (const [r, l, d] of P) tone(dest, 'sine', f * r, t0, 0.01, vol * l, { rel: d, det: r > 1 ? 6 : 0 });
  }
  function kick(dest, t0, vol) { tone(dest, 'sine', 150, t0, 0.02, vol, { to: 40, glide: 0.09, rel: 0.22 }); }
  function snare(dest, t0, vol) {
    noise(dest, t0, 0.02, vol, { rel: 0.16, mid: [flt('bandpass', 1800, 0.6)] });
    tone(dest, 'triangle', 190, t0, 0.01, vol * 0.7, { to: 120, glide: 0.06, rel: 0.09 });
  }
  function hat(dest, t0, vol, rel) { noise(dest, t0, 0.005, vol, { rel: rel || 0.03, mid: [flt('highpass', 7000, 0.7)] }); }
  function bass(dest, f, t0, dur, vol) { tone(dest, 'sawtooth', f, t0, dur, vol, { rel: 0.06, mid: [flt('lowpass', 420, 1.2)] }); }
  // Slow chord: two detuned voices per note through a lowpass, long attack/release.
  function pad(dest, notes, t0, len, vol, type, cut) {
    for (const m of notes) for (const det of [-7, 7]) {
      tone(dest, type, hz(m), t0, len * 0.7, vol, { det, atk: len * 0.25, rel: len * 0.35, mid: [flt('lowpass', cut, 0.7)] });
    }
  }
  // Low brass-like stab: detuned saws through a resonant lowpass.
  function stab(dest, notes, t0, vol) {
    for (const m of notes) for (const det of [-8, 8]) {
      tone(dest, 'sawtooth', hz(m), t0, 0.22, vol, { det, atk: 0.02, rel: 0.25, mid: [flt('lowpass', 1100, 2)] });
    }
  }
  // Metallic clank: inharmonic partials plus a bright click.
  function clank(dest, t0, vol) {
    const f = 700 * vary();
    for (const [r, l, d] of [[1, 1, 0.5], [1.51, 0.6, 0.35], [2.37, 0.35, 0.25]]) tone(dest, 'triangle', f * r, t0, 0.01, vol * l, { rel: d });
    noise(dest, t0, 0.01, vol * 0.5, { rel: 0.05, mid: [flt('highpass', 3000, 0.7)] });
  }
  function hiss(dest, t0, vol, len) { noise(dest, t0, len, vol, { atk: 0.08, rel: 0.5, mid: [flt('highpass', 2500, 0.7)] }); }
  // Dry clock tick.
  function tickTock(dest, t0, vol, k) {
    k = k || 1;
    tone(dest, 'square', 1800 * k, t0, 0.006, vol, { rel: 0.02 });
    tone(dest, 'triangle', 900 * k, t0, 0.008, vol * 0.7, { rel: 0.03 });
    noise(dest, t0, 0.004, vol * 0.6, { rel: 0.015, mid: [flt('highpass', 5000, 0.7)] });
  }
  // Persistent drone: detuned saw/triangle pair per note through a slowly
  // breathing lowpass; lives until the track stops. Returns its gain node.
  function drone(t, midis, vol, cut) {
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(vol, now + 2.5);
    const f = flt('lowpass', cut, 1.5);
    g.connect(f); f.connect(t.in);
    const l = ctx.createOscillator(), lg = ctx.createGain();
    l.frequency.value = 0.07; lg.gain.value = cut * 0.5;
    l.connect(lg); lg.connect(f.frequency); l.start(now);
    t.nodes.push(l); t.all.push(g, f, lg);
    for (const m of midis) for (const [type, det] of [['sawtooth', -6], ['triangle', 7]]) {
      const o = ctx.createOscillator();
      o.type = type; o.frequency.value = hz(m); o.detune.value = det;
      o.connect(g); o.start(now); t.nodes.push(o);
    }
    return g;
  }

  // ---------------------------------------------------------------- music

  // Every track is a step sequencer: step() is called once per sixteenth note
  // with the absolute start time `at`, the step length `d` (s) and the clock
  // intensity `v` (0..1). Voices go to t.in (through the track lowpass),
  // t.dry (bypassing it) or t.echoIn (dry + dotted-eighth feedback echo).
  // Reactive tracks speed up (x1.0 -> x1.35), open their lowpass (cut[0] ->
  // cut[1]) and fade in extra layers as v grows.
  const TITLE_PAD = [[50, 53, 57], [46, 50, 53], [43, 50, 55], [45, 49, 52]];       // Dm Bb Gm A
  const EXP_CHORD = [[62, 65, 69, 74], [62, 65, 69, 75], [58, 62, 65, 70], [63, 67, 70, 75]];   // Dm, Dm+Eb, Bb, Eb (phrygian)
  const EXP_ARP = [0, 1, 2, 3, 2, 1, 0, 1];
  const CBT_ROOT = [38, 38, 34, 36];                                                 // D D Bb C
  const CBT_RIFF = [62, 0, 62, 0, 65, 62, 0, 63, 62, 0, 0, 69, 0, 68, 0, 65,
                    62, 0, 62, 0, 65, 62, 0, 63, 60, 0, 63, 0, 62, 0, 0, 0];
  const DIRGE = [62, 60, 58, 57, 55, 53, 51, 50, 50, 48, 46, 45, 43, 41, 39, 38];
  const ESC_CHORD = [[50, 53, 57], [53, 57, 60], [53, 58, 62], [55, 60, 64]];       // Dm F Bb C (rising)
  const ESC_ROOT = [38, 41, 46, 48];

  const DEFS = {
    // Slow dark drone, sparse tolling bells, distant choir-like pad. D minor.
    title: {
      bpm: 60, cut: [900, 900],
      start(t) { drone(t, [38, 45], 0.11, 240); },
      step(t, i, at, d) {
        const j = i % 64;
        if (j === 0 || j === 28 || j === 44) bell(t.echoIn, hz(DD.pick([50, 57, 62, 53])), at, 0.16);
        if (j === 8) pad(t.in, TITLE_PAD[((i / 64) | 0) % 4], at, d * 64, 0.05, 'triangle', 700);
      },
    },
    // Tense D phrygian arpeggio over a heartbeat; clanks and steam; ticking,
    // hats and a kick creep in as the clock runs out.
    explore: {
      bpm: 92, reactive: true, cut: [700, 5000],
      step(t, i, at, d, v) {
        const j = i % 64, bar = (j / 16) | 0, s = j % 16, ch = EXP_CHORD[bar];
        if (s === 0) tone(t.in, 'sine', 62, at, 0.03, 0.55, { to: 38, glide: 0.1, rel: 0.18 });     // heartbeat: lub
        if (s === 3) tone(t.in, 'sine', 56, at, 0.03, 0.35, { to: 36, glide: 0.1, rel: 0.15 });     // dub
        if (s % 2 === 0) tone(t.echoIn, 'sawtooth', hz(ch[EXP_ARP[s / 2]]), at, 0.03, 0.07, { rel: d * 1.6 });
        if (s === 0) tone(t.in, 'sawtooth', hz(ch[0] - 24), at, d * 14, 0.06, { atk: 0.4, rel: 0.5, mid: [flt('lowpass', 300, 1)] });   // cello-like root
        if (s === 8 && Math.random() < 0.15) clank(t.dry, at, 0.12);
        if (s === 12 && Math.random() < 0.1) hiss(t.dry, at, 0.05, 0.4);
        const tk = ramp(v, 0.25, 0.7), hh = ramp(v, 0.5, 0.9), kk = ramp(v, 0.6, 1);
        if (tk > 0 && s % 4 === 0) tickTock(t.dry, at, 0.14 * tk);
        if (hh > 0 && s % 2 === 1) hat(t.dry, at, 0.05 * hh);
        if (kk > 0 && (s === 0 || s === 8 || s === 14)) kick(t.dry, at, 0.4 * kk);
      },
    },
    // Driving bass, kick/snare/hats from noise, aggressive saw+square riff,
    // low brass stabs on the Bb and C bars.
    combat: {
      bpm: 132, reactive: true, cut: [900, 7000],
      step(t, i, at, d, v) {
        const j = i % 64, bar = (j / 16) | 0, s = j % 16, root = CBT_ROOT[bar], n = CBT_RIFF[j % 32];
        if (s % 2 === 0) bass(t.in, hz(root), at, d * 1.2, 0.22);
        if (s % 4 === 0 || (bar === 3 && s === 14)) kick(t.dry, at, 0.6);
        if (s === 4 || s === 12) snare(t.dry, at, 0.3);
        if (s % 2 === 0) hat(t.dry, at, 0.07);
        if (n) {
          tone(t.echoIn, 'sawtooth', hz(n), at, d * 0.7, 0.09, { rel: 0.08, mid: [flt('lowpass', 2600, 3)] });
          tone(t.in, 'square', hz(n - 12), at, d * 0.7, 0.04, { rel: 0.08, det: 8 });
        }
        if (bar >= 2 && (s === 0 || s === 6 || s === 10)) stab(t.in, [root + 12, root + 19, root + 24], at, 0.07);
        const hh = ramp(v, 0.4, 0.9), tk = ramp(v, 0.6, 1);
        if (hh > 0 && s % 2 === 1) hat(t.dry, at, 0.06 * hh, 0.05);
        if (tk > 0 && s % 4 === 2) tickTock(t.dry, at, 0.12 * tk);
      },
    },
    // Descending dirge in detuned saws, tolling bells, a drone that fades away.
    death: {
      bpm: 46, cut: [600, 600],
      start(t) { drone(t, [38, 45], 0.1, 220).gain.setTargetAtTime(0.025, ctx.currentTime + 6, 12); },
      step(t, i, at, d) {
        const j = i % 64, m = DIRGE[(j / 4) | 0];
        if (j % 4 === 0) for (const det of [-12, 12]) tone(t.in, 'sawtooth', hz(m), at, d * 3, 0.05, { det, atk: 0.2, rel: 0.8, mid: [flt('lowpass', 700, 1)] });
        if (j % 16 === 0) bell(t.echoIn, hz(m - 12), at, 0.14);
      },
    },
    // Dark but triumphant: rising Dm F Bb C, pads, bells, light drums.
    escape: {
      bpm: 108, cut: [3500, 3500],
      step(t, i, at, d) {
        const j = i % 64, bar = (j / 16) | 0, s = j % 16, ch = ESC_CHORD[bar];
        if (s === 0) pad(t.in, ch, at, d * 16, 0.05, 'sawtooth', 1200);
        if (s % 2 === 0) bass(t.in, hz(ESC_ROOT[bar]), at, d * 1.1, 0.16);
        if (s === 0 || s === 8) kick(t.dry, at, 0.4);
        if (s === 4 || s === 12) snare(t.dry, at, 0.18);
        if (s % 2 === 0) hat(t.dry, at, 0.04);
        if (s % 4 === 0) bell(t.echoIn, hz([ch[0], ch[1], ch[2], ch[0] + 12][s / 4] + 12), at, 0.12);
      },
    },
  };

  function cutoffFor(def) { return def.cut[0] * Math.pow(def.cut[1] / def.cut[0], def.reactive ? intensity : 1); }

  function applyIntensity(t) {
    appliedIntensity = intensity;
    t.filter.frequency.setTargetAtTime(cutoffFor(t.def), ctx.currentTime, 0.4);
  }

  // Scheduler: fills the lookahead window with steps at AudioContext time.
  function tick(t) {
    try {
      if (!ctx || ctx.state === 'closed') return;
      const now = ctx.currentTime;
      if (t.next < now - 0.1) t.next = now + 0.02;      // fell behind (hidden tab): skip ahead instead of bursting
      while (t.next < now + LOOK) {
        const d = 15 / (t.def.bpm * (t.def.reactive ? 1 + 0.35 * intensity : 1));   // sixteenth note length
        t.def.step(t, t.step, t.next, d, intensity);
        t.step++; t.next += d;
      }
    } catch (e) { /* context closed or node error: skip this window */ }
  }

  function startTrack(name) {
    const def = DEFS[name], now = ctx.currentTime;
    const t = { name, def, step: 0, next: now + 0.05, nodes: [], all: [] };
    t.gain = ctx.createGain();
    t.gain.gain.setValueAtTime(0.0001, now);
    t.gain.gain.linearRampToValueAtTime(1, now + FADE);
    t.gain.connect(musicBus);
    t.filter = ctx.createBiquadFilter();
    t.filter.type = 'lowpass'; t.filter.Q.value = 0.7; t.filter.frequency.value = cutoffFor(def);
    t.filter.connect(t.gain);
    t.in = t.filter;
    t.dry = ctx.createGain(); t.dry.connect(t.gain);
    t.echoIn = ctx.createGain(); t.echoIn.connect(t.in);
    const dl = ctx.createDelay(1), fb = ctx.createGain(), wet = ctx.createGain();
    dl.delayTime.value = 45 / def.bpm;                 // three sixteenths at the base tempo
    fb.gain.value = 0.35; wet.gain.value = 0.3;
    t.echoIn.connect(dl); dl.connect(fb); fb.connect(dl); dl.connect(wet); wet.connect(t.in);
    t.all.push(t.gain, t.filter, t.dry, t.echoIn, dl, fb, wet);
    if (def.start) def.start(t);
    t.timer = setInterval(() => tick(t), TICK_MS);
    tick(t);
    return t;
  }

  function stopTrack(t) {
    clearInterval(t.timer);
    for (const n of t.nodes) { try { n.stop(); n.disconnect(); } catch (e) { /* already stopped */ } }
    for (const n of t.all) { try { n.disconnect(); } catch (e) { /* already gone */ } }
  }

  function fadeOut(t) {
    const now = ctx.currentTime, g = t.gain.gain;
    g.cancelScheduledValues(now);
    g.setValueAtTime(Math.max(g.value, 0.0001), now);
    g.linearRampToValueAtTime(0.0001, now + FADE);
    setTimeout(() => stopTrack(t), (FADE + 0.15) * 1000);   // keep sequencing during the fade
  }

  function music(name) {
    if (name !== 'off' && !DEFS[name]) return;
    if (!ctx) { pending = name === 'off' ? null : name; return; }
    if (cur && cur.name === name) return;
    if (cur) { fadeOut(cur); cur = null; }
    if (name === 'off') { pending = null; return; }
    if (ctx.state !== 'running') { pending = name; return; }    // init() flushes it once the context runs
    cur = startTrack(name);
    applyIntensity(cur);
  }

  function setIntensity(v) {
    intensity = clamp01(+v || 0);
    if (cur && cur.def.reactive && Math.abs(intensity - appliedIntensity) > 0.01) applyIntensity(cur);
  }

  // ---------------------------------------------------------------- sfx

  // Each entry receives the start time and a per-play pitch factor k (0.92..1.08).
  const SFX = {
    click(t, k) {                                                        // dry UI tick
      tone(sfxBus, 'square', 1900 * k, t, 0.008, 0.1, { rel: 0.03 });
      noise(sfxBus, t, 0.004, 0.06, { rel: 0.02, mid: [flt('highpass', 4000, 0.7)] });
    },
    card(t, k) {                                                         // paper/flesh flick
      noise(sfxBus, t, 0.03, 0.22, { rate: 0.9 * k, atk: 0.003, rel: 0.09, mid: [flt('bandpass', 1300 * k, 1.5)] });
      tone(sfxBus, 'sine', 190 * k, t, 0.03, 0.14, { to: 90, glide: 0.06, rel: 0.06 });
    },
    hit(t, k) {                                                          // wet impact: thump + noise burst + splat
      tone(sfxBus, 'sine', 150 * k, t, 0.02, 0.7, { to: 42, glide: 0.1, rel: 0.22 });
      noise(sfxBus, t, 0.02, 0.4, { rate: 0.6 * k, rel: 0.15, mid: [flt('lowpass', 900, 1)] });
      noise(sfxBus, t + 0.01, 0.03, 0.3, { rate: 0.5 * k, rel: 0.25, mid: [flt('bandpass', 420 * k, 2.5)] });
    },
    block(t, k) {                                                        // metallic clang
      const f = 540 * k;
      for (const [r, l, d] of [[1, 0.3, 0.5], [1.48, 0.2, 0.4], [2.21, 0.12, 0.3], [3.03, 0.08, 0.2]]) tone(sfxBus, r < 2 ? 'triangle' : 'sine', f * r, t, 0.01, l, { rel: d });
      noise(sfxBus, t, 0.008, 0.2, { rel: 0.04, mid: [flt('highpass', 2500, 0.7)] });
    },
    heal(t, k) {                                                         // soft rising shimmer
      [587, 880, 1175].forEach((f, i) => tone(sfxBus, 'sine', f * k, t + i * 0.07, 0.1, 0.12, { atk: 0.02, rel: 0.5 }));
      const b = flt('highpass', 3000, 0.7); sweep(b.frequency, 3000, 9000, t, 0.5);
      noise(sfxBus, t, 0.2, 0.04, { atk: 0.1, rel: 0.4, mid: [b] });
    },
    break(t, k) {                                                        // guttural crack + wet tear, pitched down
      noise(sfxBus, t, 0.03, 0.7, { rate: 0.35 * k, atk: 0.002, rel: 0.12, mid: [flt('bandpass', 300 * k, 3)] });
      tone(sfxBus, 'sine', 95 * k, t, 0.02, 0.5, { to: 30, glide: 0.12, rel: 0.2 });
      const b = flt('bandpass', 1500 * k, 2.5); sweep(b.frequency, 1500 * k, 300, t + 0.06, 0.35);
      noise(sfxBus, t + 0.06, 0.25, 0.35, { rate: 0.5 * k, atk: 0.01, rel: 0.2, mid: [b] });
      tone(sfxBus, 'sawtooth', 70 * k, t + 0.05, 0.3, 0.2, { to: 35, glide: 0.4, atk: 0.03, rel: 0.2, mid: [flt('lowpass', 200, 1)] });
    },
    graft(t, k) {                                                        // wet squelch + stitching zip
      const b = flt('bandpass', 520 * k, 4); sweep(b.frequency, 520 * k, 180, t, 0.25);
      noise(sfxBus, t, 0.15, 0.4, { rate: 0.4 * k, atk: 0.01, rel: 0.15, mid: [b] });
      tone(sfxBus, 'sine', 160 * k, t, 0.05, 0.25, { to: 60, glide: 0.2, rel: 0.1 });
      for (let i = 0; i < 8; i++) tone(sfxBus, 'square', (2200 + i * 180) * k, t + 0.26 + i * 0.028, 0.005, 0.06, { rel: 0.012 });
    },
    growl(t, k) {                                                        // pitched-down noise through wobbling formants + low saw
      const b1 = flt('bandpass', 180 * k, 6); lfo(b1.frequency, 22 * k, 60, t, t + 0.9);
      noise(sfxBus, t, 0.5, 0.55, { rate: 0.25 * k, atk: 0.05, rel: 0.3, mid: [b1] });
      const b2 = flt('bandpass', 700 * k, 4); lfo(b2.frequency, 22 * k, 180, t, t + 0.9);
      noise(sfxBus, t, 0.5, 0.25, { rate: 0.3 * k, atk: 0.05, rel: 0.3, mid: [b2] });
      tone(sfxBus, 'sawtooth', 58 * k, t, 0.5, 0.25, { to: 40 * k, glide: 0.7, atk: 0.05, rel: 0.3, mid: [flt('lowpass', 260, 1.5)] });
    },
    death(t, k) {                                                        // long guttural moan + collapse
      const b = flt('bandpass', 350 * k, 3); lfo(b.frequency, 6 * k, 90, t, t + 1.2);
      tone(sfxBus, 'sawtooth', 110 * k, t, 0.7, 0.35, { to: 45 * k, glide: 1.0, atk: 0.08, rel: 0.4, mid: [b] });
      const b2 = flt('bandpass', 250 * k, 5); lfo(b2.frequency, 18 * k, 70, t, t + 1.2);
      noise(sfxBus, t, 0.7, 0.4, { rate: 0.3 * k, atk: 0.08, rel: 0.4, mid: [b2] });
      tone(sfxBus, 'sine', 120 * k, t + 0.85, 0.02, 0.6, { to: 35, glide: 0.12, rel: 0.3 });
      noise(sfxBus, t + 0.85, 0.03, 0.4, { rate: 0.5 * k, rel: 0.3, mid: [flt('lowpass', 600, 1)] });
    },
    trap(t, k) {                                                         // mechanical snap + steam blast
      tone(sfxBus, 'square', 900 * k, t, 0.03, 0.3, { to: 300 * k, glide: 0.04, rel: 0.05 });
      noise(sfxBus, t, 0.01, 0.4, { rel: 0.04, mid: [flt('highpass', 3000, 0.7)] });
      const b = flt('highpass', 1500, 0.7); sweep(b.frequency, 1500, 4000, t + 0.05, 0.5);
      noise(sfxBus, t + 0.05, 0.3, 0.35, { rate: k, atk: 0.02, rel: 0.4, mid: [b] });
    },
    pickup(t, k) {                                                       // glassy vial clink (double tap)
      for (const [f, l, d] of [[2400, 0.2, 0.25], [3600, 0.1, 0.18], [5000, 0.06, 0.12]]) {
        tone(sfxBus, 'sine', f * k, t, 0.005, l, { rel: d });
        tone(sfxBus, 'sine', f * k * 1.2, t + 0.09, 0.005, l * 0.5, { rel: d });
      }
    },
    step(t, k) {                                                         // short stone footstep
      noise(sfxBus, t, 0.02, 0.3, { rate: 0.7 * k, atk: 0.002, rel: 0.07, mid: [flt('lowpass', 700 * k, 1)] });
      tone(sfxBus, 'sine', 90 * k, t, 0.03, 0.25, { to: 50, glide: 0.05, rel: 0.06 });
    },
    mutate(t, k) {                                                       // deep rumble + grinding stone (~1 s)
      noise(sfxBus, t, 0.7, 0.9, { rate: 0.15 * k, atk: 0.05, rel: 0.3, mid: [flt('lowpass', 120, 1)] });
      tone(sfxBus, 'sawtooth', 42 * k, t, 0.7, 0.4, { to: 30, glide: 1.0, atk: 0.05, rel: 0.3, mid: [flt('lowpass', 100, 1)] });
      const b = flt('bandpass', 900 * k, 2); lfo(b.frequency, 9 * k, 400, t, t + 1.1, 'square');
      noise(sfxBus, t + 0.05, 0.6, 0.25, { rate: 0.6 * k, atk: 0.1, rel: 0.3, mid: [b] });
      tone(sfxBus, 'square', 220 * k, t + 0.4, 0.1, 0.1, { to: 110, glide: 0.15, rel: 0.1, mid: [flt('lowpass', 800, 1)] });
    },
    tick(t, k) { tickTock(sfxBus, t, 0.15, k); },                        // dry clock tick
    escape(t, k) {                                                       // bells + rising chord + shimmer
      [587, 880, 1175].forEach((f, i) => bell(sfxBus, f * k, t + i * 0.25, 0.28));
      for (const m of [62, 65, 69, 76]) tone(sfxBus, 'sawtooth', hz(m) * k, t + 0.1, 0.6, 0.05, { atk: 0.3, rel: 0.5, mid: [flt('lowpass', 1500, 1)] });
      const b = flt('highpass', 4000, 0.7); sweep(b.frequency, 4000, 10000, t, 1.0);
      noise(sfxBus, t, 0.6, 0.03, { atk: 0.3, rel: 0.5, mid: [b] });
    },
    heat(t, k) {                                                         // sizzle/hiss with crackle
      noise(sfxBus, t, 0.25, 0.3, { rate: k, atk: 0.02, rel: 0.3, mid: [flt('highpass', 3000 * k, 0.7)] });
      const am = ctx.createGain(); am.gain.value = 0.5; lfo(am.gain, 28 * k, 0.5, t, t + 0.7, 'square');
      noise(sfxBus, t, 0.25, 0.3, { rate: 1.5 * k, atk: 0.01, rel: 0.3, mid: [flt('bandpass', 5000 * k, 2), am] });
    },
    stairs(t, k) {                                                       // creaking iron + three metallic steps
      const b = flt('bandpass', 900 * k, 5); lfo(b.frequency, 35 * k, 250, t, t + 0.6);
      tone(sfxBus, 'sawtooth', 180 * k, t, 0.35, 0.2, { to: 250 * k, glide: 0.3, atk: 0.05, rel: 0.15, mid: [b] });
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.22;
        noise(sfxBus, s, 0.02, 0.25, { rate: 0.8, rel: 0.08, mid: [flt('lowpass', 1200, 1)] });
        tone(sfxBus, 'triangle', 820 * k * (1 + i * 0.05), s, 0.01, 0.1, { rel: 0.2 });
      }
    },
    harvest(t, k) {                                                      // wet tearing + bone snap
      const b = flt('bandpass', 1200 * k, 3); sweep(b.frequency, 1200 * k, 250, t, 0.45);
      noise(sfxBus, t, 0.35, 0.45, { rate: 0.45 * k, atk: 0.02, rel: 0.2, mid: [b] });
      tone(sfxBus, 'sine', 120 * k, t, 0.1, 0.3, { to: 50, glide: 0.3, rel: 0.2 });
      noise(sfxBus, t + 0.42, 0.01, 0.7, { rate: 0.5 * k, rel: 0.1, mid: [flt('bandpass', 700 * k, 6)] });
      tone(sfxBus, 'square', 500 * k, t + 0.42, 0.03, 0.25, { to: 140, glide: 0.05, rel: 0.08 });
      tone(sfxBus, 'sine', 100 * k, t + 0.42, 0.02, 0.4, { to: 40, glide: 0.1, rel: 0.2 });
    },
    error(t, k) {                                                        // short dull buzz (beating squares)
      for (const f of [110, 116]) tone(sfxBus, 'square', f * k, t, 0.12, 0.13, { rel: 0.05, mid: [flt('lowpass', 500, 1)] });
    },
  };

  function sfx(name) {
    const fn = SFX[name];
    if (!fn || !ctx || ctx.state !== 'running') return;     // unknown names ignored; nothing queued while suspended
    fn(ctx.currentTime, vary());
  }

  // ---------------------------------------------------------------- public API

  function setMuted(v) {
    muted = !!v;
    if (master) master.gain.setTargetAtTime(muted ? 0 : 1, ctx.currentTime, 0.04);   // ramp, never suspend
  }

  const A = {
    init: safe(init),
    music: safe(music),
    setIntensity: safe(setIntensity),
    sfx: safe(sfx),
    toggleMute: safe(() => { setMuted(!muted); return muted; }),
  };
  Object.defineProperty(A, 'muted', { enumerable: true, get: () => muted, set: safe(setMuted) });
  (window.DD = window.DD || {}).audio = A;
})();
