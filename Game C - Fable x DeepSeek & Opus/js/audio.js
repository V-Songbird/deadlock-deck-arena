// Synthesized ominous soundtrack and guttural SFX with Web Audio. Owner: AUDIO worker. Browser only.
// Spec: PRODUCT.md §10. No audio files: oscillators, noise buffers, filters, waveshapers, gain envelopes.
const Snd = {
  ctx: null,
  muted: false,
  mode: 'off',

  /** Create or resume the single AudioContext. Must be called from a user gesture; safe to call repeatedly. */
  init() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;                                   // no Web Audio: the game still runs, silently
        const ctx = new AC();
        const comp = ctx.createDynamicsCompressor();       // keeps drones + stacked SFX from clipping
        comp.threshold.value = -6; comp.knee.value = 12; comp.ratio.value = 4;
        comp.attack.value = 0.006; comp.release.value = 0.3;
        const sfx = ctx.createGain(); sfx.gain.value = 0.75;
        const mus = ctx.createGain(); mus.gain.value = 1;
        const master = ctx.createGain(); master.gain.value = this.muted ? 0 : this._VOL;
        sfx.connect(comp); mus.connect(comp); comp.connect(master); master.connect(ctx.destination);
        const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);   // 1 s of white noise
        const d = buf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        this.ctx = ctx; this._sfxBus = sfx; this._musicBus = mus;
        this._master = master; this._noiseBuf = buf;
      }
      if (this.ctx.state !== 'running') {
        const p = this.ctx.resume();                       // promise on suspended contexts
        if (p && p.catch) p.catch(function () {});
      }
      // A music request that arrived before the first gesture (§5.4) starts now.
      if (this.mode !== 'off' && !this._loop) this._start(this.mode);
    } catch (e) { /* audio is optional: never break the game */ }
  },

  /**
   * Switch the music loop. Same mode = no-op. Previous loop stops within ~1 s.
   * @param {'title'|'table'|'explore'|'combat'|'off'} mode
   */
  music(mode) {
    try {
      if (!this._has(this._CFG, mode) && mode !== 'off') return;   // unknown mode: ignored
      if (mode === this.mode) return;                      // same mode: no-op
      this.mode = mode;
      if (!this.ctx) return;                               // before init(): remembered, started by init()
      this._stop();
      if (mode !== 'off') this._start(mode);
    } catch (e) { /* never throw */ }
  },

  /**
   * One-shot effect. Names: click, card, hit, hurt, growl, break, graft, pickup, trap, step, stairs, tick,
   * shift, death, escape, buy, heal, cool. Unknown names are ignored. No-op before init().
   * @param {string} name
   */
  sfx(name) {
    if (!this.ctx || !this._has(this._fx, name)) return;
    try { this._fx[name].call(this, this.ctx.currentTime); } catch (e) { /* never throw */ }
  },

  /** Master gain to 0 (true) or back (false); loops keep running. @param {boolean} flag */
  setMuted(flag) {
    this.muted = !!flag;
    if (!this.ctx || !this._master) return;
    try {
      const g = this._master.gain, t = this.ctx.currentTime;
      g.cancelScheduledValues(t);
      g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(this.muted ? 0 : this._VOL, t + 0.06);
    } catch (e) { /* never throw */ }
  },

  // ---------------------------------------------------------------------------------------------
  // Private state and helpers. Only js/audio.js touches these.
  // ---------------------------------------------------------------------------------------------

  _VOL: 0.9,          // master level when unmuted
  _master: null,      // master gain -> destination
  _sfxBus: null,      // effects bus
  _musicBus: null,    // music bus
  _noiseBuf: null,    // shared white noise
  _shaper: null,      // shared waveshaper (guttural distortion)
  _loop: null,        // running music loop, or null

  /** @private Own-property lookup: prototype names ('toString', ...) are not modes or effects. */
  _has(table, key) { return typeof key === 'string' && Object.prototype.hasOwnProperty.call(table, key); },

  /** @private Loop recipes: tempo, detuned drone, minor arpeggio, pulse and noise swell. */
  _CFG: {
    title: {
      bpm: 56, root: 55.00, vol: 0.32, drone: [0.5, 1, 1.5], cut: 240, breath: 0.05, droneVol: 0.7,
      arp: 4, oct: 4, seq: [0, 3, 7, 10, 12, 10, 7, 3], note: 3.4, arpVol: 0.22,
      pulse: 8, pulseVol: 0.5, swell: 32, swellDur: 7, noiseVol: 0.13,
    },
    table: {
      bpm: 64, root: 61.74, vol: 0.28, drone: [0.5, 1, 1.5], cut: 260, breath: 0.07, droneVol: 0.65,
      arp: 4, oct: 4, seq: [0, 3, 7, 10, 12, 15], note: 3.0, arpVol: 0.2,
      pulse: 8, pulseVol: 0.45, swell: 24, swellDur: 6, noiseVol: 0.12,
    },
    explore: {
      bpm: 76, root: 49.00, vol: 0.34, drone: [0.5, 1, 1.5], cut: 280, breath: 0.09, droneVol: 0.7,
      arp: 2, oct: 4, seq: [0, 3, 7, 10, 12, 15, 12, 10], note: 2.2, arpVol: 0.22,
      pulse: 4, pulseVol: 0.5, swell: 16, swellDur: 5.5, noiseVol: 0.15,
    },
    combat: {
      bpm: 116, root: 43.65, vol: 0.42, drone: [0.5, 1, 1.5], cut: 340, breath: 0.3, droneVol: 0.75,
      arp: 1, oct: 4, seq: [0, 3, 7, 10, 12, 15, 12, 10, 7, 3], note: 1.1, arpVol: 0.2,
      pulse: 2, pulseVol: 0.6, swell: 8, swellDur: 2.6, noiseVol: 0.18,
    },
  },

  /** @private Build a loop: persistent detuned drone plus a step scheduler. */
  _start(mode) {
    const ctx = this.ctx, t = ctx.currentTime, cfg = this._CFG[mode];
    const out = ctx.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(cfg.vol, t + 1.4);          // fade in
    out.connect(this._musicBus);
    const loop = {
      cfg: cfg, out: out, dead: false, step: 0, next: t + 0.15,
      stepDur: 30 / cfg.bpm, oscs: [], nodes: [out], timer: null,
    };
    // Low detuned drone: sub, root and fifth through a murky lowpass that breathes.
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = cfg.cut; lp.Q.value = 4;
    const dg = ctx.createGain(); dg.gain.value = cfg.droneVol;
    lp.connect(dg); dg.connect(out);
    loop.nodes.push(lp, dg);
    for (let i = 0; i < cfg.drone.length; i++) {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = i === 1 ? 'triangle' : 'sawtooth';
      o.frequency.value = cfg.root * cfg.drone[i];
      o.detune.value = (i - 1) * 9;                                   // slow beating between partials
      g.gain.value = i === 1 ? 0.55 : 0.45;
      o.connect(g); g.connect(lp); o.start(t);
      loop.oscs.push(o); loop.nodes.push(g);
    }
    const lfo = ctx.createOscillator(), lg = ctx.createGain();
    lfo.type = 'sine'; lfo.frequency.value = cfg.breath;
    lg.gain.value = cfg.cut * 0.45;
    lfo.connect(lg); lg.connect(lp.frequency); lfo.start(t);
    loop.oscs.push(lfo); loop.nodes.push(lg);
    loop.timer = setInterval(() => this._schedule(loop), 150);
    this._loop = loop;
    this._schedule(loop);
  },

  /** @private Fade the running loop out and tear it down within ~0.5 s. */
  _stop() {
    const loop = this._loop;
    this._loop = null;
    if (!loop || !this.ctx) return;
    loop.dead = true;
    clearInterval(loop.timer);
    const t = this.ctx.currentTime, stopAt = t + 0.45;
    try {
      const g = loop.out.gain;
      g.cancelScheduledValues(t);
      g.setValueAtTime(Math.max(0.0001, g.value), t);
      g.exponentialRampToValueAtTime(0.0001, stopAt);
    } catch (e) {}
    for (let i = 0; i < loop.oscs.length; i++) { try { loop.oscs[i].stop(stopAt); } catch (e) {} }
    setTimeout(function () {
      for (let i = 0; i < loop.nodes.length; i++) { try { loop.nodes[i].disconnect(); } catch (e) {} }
    }, 700);
  },

  /** @private Schedule every step that falls inside the look-ahead window. */
  _schedule(loop) {
    try {
      if (!this.ctx || loop.dead) return;
      const now = this.ctx.currentTime, horizon = now + 0.8;
      if (loop.next < now) loop.next = now + 0.05;                    // recover after a long stall
      let guard = 0;
      while (loop.next < horizon && guard++ < 40) {
        this._step(loop, loop.next, loop.step);
        loop.next += loop.stepDur;
        loop.step = (loop.step + 1) % 64;
      }
    } catch (e) { /* never throw */ }
  },

  /** @private One step: arpeggio note, percussive pulse, noise swell. */
  _step(loop, t, i) {
    const cfg = loop.cfg;
    if (i % cfg.arp === 0) {                                          // slow minor arpeggio
      const semi = cfg.seq[(i / cfg.arp) % cfg.seq.length];
      const f = cfg.root * cfg.oct * Math.pow(2, semi / 12);
      this._blip('triangle', f, f * 0.997, t, cfg.note, cfg.arpVol, loop.out, 0.35);
      this._blip('sine', f * 2.004, f * 2, t, cfg.note * 0.6, cfg.arpVol * 0.3, loop.out, 0.5);
    }
    if (i % cfg.pulse === 0) {                                        // sparse percussive pulse
      this._blip('sine', 118, 44, t, 0.2, cfg.pulseVol, loop.out, 0.004);
      this._noise(t, 0.08, { f: 1700, f2: 480, q: 0.9, vol: cfg.pulseVol * 0.3, dest: loop.out });
    }
    if (i % cfg.swell === 0) {                                        // filtered noise swell
      this._noise(t, cfg.swellDur, {
        type: 'lowpass', f: cfg.cut * 0.7, f2: cfg.cut * 3, q: 1.4,
        vol: cfg.noiseVol, atk: cfg.swellDur * 0.45, rate: 0.6, dest: loop.out,
      });
    }
  },

  /** @private Shared waveshaper for guttural distortion, wired to the SFX bus. */
  _ws() {
    if (!this._shaper) {
      const ctx = this.ctx, n = 1024, k = 7, curve = new Float32Array(n);
      for (let i = 0; i < n; i++) curve[i] = Math.tanh(k * ((i / (n - 1)) * 2 - 1)) / Math.tanh(k);
      const ws = ctx.createWaveShaper();
      ws.curve = curve; ws.oversample = '2x';
      ws.connect(this._sfxBus);
      this._shaper = ws;
    }
    return this._shaper;
  },

  /** @private One-shot oscillator with an attack/decay envelope. */
  _blip(type, f0, f1, t, dur, vol, dest, atk) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, f0), t);
    if (f1 && f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    const a = atk == null ? Math.min(0.02, dur * 0.25) : Math.min(atk, dur * 0.5);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest || this._sfxBus);
    o.start(t); o.stop(t + dur + 0.02);
  },

  /** @private One-shot filtered noise burst. opts: {type,f,f2,q,vol,atk,rate,dest} */
  _noise(t, dur, o) {
    const ctx = this.ctx;
    const src = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = this._noiseBuf; src.loop = true; src.playbackRate.value = o.rate || 1;
    f.type = o.type || 'bandpass';
    f.frequency.setValueAtTime(Math.max(20, o.f || 800), t);
    if (o.f2 && o.f2 !== o.f) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.f2), t + dur);
    f.Q.value = o.q == null ? 1 : o.q;
    const a = Math.min(o.atk == null ? 0.006 : o.atk, dur * 0.6);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, o.vol || 0.2), t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(o.dest || this._sfxBus);
    src.start(t, Math.random() * 0.9); src.stop(t + dur + 0.02);
  },

  /** @private The 18 effects (§10). Called with this = Snd and t = ctx.currentTime. */
  _fx: {
    click(t) {                                     // UI button
      this._blip('square', 880, 620, t, 0.05, 0.09);
      this._noise(t, 0.03, { type: 'highpass', f: 2600, vol: 0.05 });
    },
    card(t) {                                      // a card is played
      this._noise(t, 0.15, { type: 'highpass', f: 1100, f2: 2800, q: 0.6, vol: 0.16 });
      this._blip('triangle', 520, 720, t + 0.012, 0.1, 0.1);
    },
    hit(t) {                                       // a card lands on the enemy
      this._blip('sine', 200, 52, t, 0.17, 0.5, this._ws(), 0.003);
      this._noise(t, 0.11, { f: 900, f2: 240, q: 1.4, vol: 0.28 });
    },
    hurt(t) {                                      // the player is wounded
      this._blip('sawtooth', 300, 88, t, 0.34, 0.34, this._ws(), 0.008);
      this._blip('square', 148, 66, t, 0.3, 0.18, this._ws(), 0.01);
      this._noise(t, 0.22, { f: 700, f2: 190, q: 1.2, vol: 0.2 });
    },
    growl(t) {                                     // an enemy attacks
      const d = 0.62, ws = this._ws();
      this._blip('sawtooth', 72, 57, t, d, 0.4, ws, 0.05);
      this._blip('sawtooth', 73.4, 58, t, d, 0.34, ws, 0.06);
      this._blip('sawtooth', 108, 86, t, d * 0.85, 0.2, ws, 0.07);
      this._noise(t, d, { type: 'lowpass', f: 340, f2: 140, q: 2, vol: 0.18, atk: 0.08 });
    },
    break(t) {                                     // a limb overheats and snaps
      for (let i = 0; i < 5; i++) {
        this._noise(t + i * 0.035 + Math.random() * 0.012, 0.06,
          { f: 1500 - i * 170, f2: 480, q: 2.6, vol: 0.26 - i * 0.03 });
      }
      this._blip('sawtooth', 240, 66, t, 0.22, 0.26, this._ws(), 0.004);
    },
    graft(t) {                                     // a new limb is sewn on
      this._noise(t, 0.34, { type: 'lowpass', f: 200, f2: 1500, q: 7, vol: 0.24, atk: 0.05 });
      this._noise(t + 0.14, 0.22, { type: 'lowpass', f: 1300, f2: 240, q: 6, vol: 0.2, atk: 0.03 });
      this._blip('sine', 110, 300, t + 0.03, 0.24, 0.24, this._ws(), 0.02);
      this._blip('triangle', 320, 170, t + 0.22, 0.22, 0.14, this._ws(), 0.02);
    },
    pickup(t) {                                    // a resource is taken
      const n = [660, 880, 1320];
      for (let i = 0; i < n.length; i++) this._blip('triangle', n[i], n[i], t + i * 0.07, 0.2, 0.15, null, 0.006);
      this._noise(t, 0.14, { type: 'highpass', f: 3000, vol: 0.07 });
    },
    trap(t) {                                      // a trap snaps shut
      this._noise(t, 0.09, { f: 3200, f2: 900, q: 3, vol: 0.3 });
      this._blip('sawtooth', 430, 170, t, 0.28, 0.26, this._ws(), 0.003);
      this._blip('square', 310, 130, t + 0.02, 0.22, 0.16, this._ws(), 0.003);
    },
    step(t) {                                      // a step on the floor
      this._noise(t, 0.07, { f: 420, f2: 150, q: 1.2, vol: 0.13 });
      this._blip('sine', 132, 58, t, 0.09, 0.15);
    },
    stairs(t) {                                    // climbing to the next floor
      for (let i = 0; i < 4; i++) {
        const f = 220 * Math.pow(2, (i * 3) / 12);
        this._blip('triangle', f, f, t + i * 0.11, 0.34, 0.14, null, 0.012);
      }
      this._noise(t, 0.5, { type: 'lowpass', f: 300, f2: 1500, q: 1, vol: 0.11, atk: 0.2 });
    },
    tick(t) {                                      // the last thirty seconds
      this._blip('square', 1500, 1150, t, 0.035, 0.08);
      this._blip('sine', 3000, 3000, t, 0.02, 0.05);
    },
    shift(t) {                                     // the labyrinth twists
      this._noise(t, 1, { type: 'bandpass', f: 1800, f2: 170, q: 3, vol: 0.3, atk: 0.25, rate: 0.6 });
      this._blip('sawtooth', 180, 42, t, 1, 0.26, this._ws(), 0.12);
      this._blip('sawtooth', 181.5, 43, t + 0.04, 0.92, 0.2, this._ws(), 0.15);
    },
    death(t) {                                     // the run ends badly
      const d = 1.6, ws = this._ws();
      this._blip('sawtooth', 110, 28, t, d, 0.4, ws, 0.05);
      this._blip('sawtooth', 111.6, 28.6, t, d, 0.32, ws, 0.08);
      this._blip('square', 55, 20, t, d, 0.2, ws, 0.1);
      this._noise(t, d * 0.8, { type: 'lowpass', f: 500, f2: 90, q: 2, vol: 0.16, atk: 0.3 });
      this._noise(t + d * 0.9, 0.5, { f: 900, f2: 200, q: 1, vol: 0.12 });
    },
    escape(t) {                                    // out of the tower alive
      const n = [0, 3, 7, 12, 15, 19];
      for (let i = 0; i < n.length; i++) {
        const f = 220 * Math.pow(2, n[i] / 12);
        this._blip('triangle', f, f, t + i * 0.13, 0.7, 0.15, null, 0.012);
      }
      this._blip('sine', 110, 55, t, 1.4, 0.2, this._ws(), 0.2);
      this._noise(t, 1.2, { type: 'highpass', f: 2200, f2: 5200, q: 0.8, vol: 0.09, atk: 0.5 });
    },
    buy(t) {                                       // a simulated purchase
      this._blip('triangle', 1180, 1180, t, 0.1, 0.14, null, 0.004);
      this._blip('triangle', 1560, 1560, t + 0.09, 0.22, 0.13, null, 0.004);
      this._blip('sine', 3120, 3120, t + 0.09, 0.18, 0.05, null, 0.004);
    },
    heal(t) {                                      // HP restored
      this._blip('sine', 330, 660, t, 0.5, 0.2, null, 0.08);
      this._blip('sine', 495, 990, t + 0.06, 0.45, 0.12, null, 0.08);
      this._noise(t, 0.4, { type: 'highpass', f: 2600, q: 0.7, vol: 0.06, atk: 0.15 });
    },
    cool(t) {                                      // heat bled off
      this._noise(t, 0.55, { type: 'highpass', f: 1200, f2: 4200, q: 0.8, vol: 0.16, atk: 0.12 });
      this._blip('sine', 2400, 1500, t, 0.5, 0.09, null, 0.01);
      this._blip('sine', 1600, 900, t + 0.05, 0.45, 0.06, null, 0.01);
    },
  },
};
