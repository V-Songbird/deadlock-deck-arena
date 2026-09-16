/**
 * audio.js - Deadlock Deck: El Reloj Anatomico
 *
 * Fully synthesized soundtrack and guttural SFX built on the raw Web Audio API:
 * oscillators, filters and a single reusable white-noise buffer. No audio files,
 * no dependencies, no imports.
 *
 * Every public method is defensive: if Web Audio is unavailable (server side,
 * old browser) or init() has not been called yet, calls are silent no-ops and
 * never throw.
 */

const MASTER_LEVEL = 0.85;
const MUSIC_LEVEL = 0.26;
const SFX_LEVEL = 0.55;

const ROOT = 55;                        // low minor root (~D, 55 Hz)
const TRITONE = Math.SQRT2;             // dissonant interval multiplier
const SCALE = [0, 2, 3, 5, 7, 8, 11];   // harmonic minor degrees, in semitones
const ARP = [0, 3, 4, 6, 4, 3, 2, 0];   // pattern of indices into SCALE
const LOOKAHEAD = 0.12;                 // seconds of music scheduled ahead
const TICK_MS = 25;                     // lookahead clock period
const SFX_GAP_MS = 30;                  // per-name retrigger guard

let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let noiseBuffer = null;

let music = null;        // { oscs:[], filter, tritoneGain, lfo }
let clock = 0;           // setInterval id of the lookahead scheduler
let nextArpTime = 0;
let nextBeatTime = 0;
let arpIndex = 0;
let tension = 0;

const lastFired = Object.create(null);

/* ------------------------------------------------------------------ */
/* Low level helpers (only ever called once a context exists)          */
/* ------------------------------------------------------------------ */

/** Semitone offset above the low root, in Hz. */
function hz(semitones) {
  return ROOT * Math.pow(2, semitones / 12);
}

/** Click-free ramp of an AudioParam towards a value. */
function ramp(param, value, time) {
  const now = ctx.currentTime;
  param.cancelScheduledValues(now);
  param.setValueAtTime(param.value, now);
  param.linearRampToValueAtTime(value, now + time);
}

/** Percussive attack/decay envelope on a gain node. */
function env(gain, t, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.linearRampToValueAtTime(peak, t + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
}

/** Two seconds of white noise, generated once and shared by every SFX. */
function getNoise() {
  if (!noiseBuffer) {
    const len = Math.floor(ctx.sampleRate * 2);
    noiseBuffer = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/**
 * One filtered noise burst. Every source gets a scheduled stop() so nodes
 * are released instead of piling up.
 */
function burst(t, dur, peak, type, f0, f1, q, dest) {
  const src = ctx.createBufferSource();
  src.buffer = getNoise();
  src.loop = true;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(Math.max(20, f0), t);
  filter.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
  const gain = ctx.createGain();
  env(gain, t, peak, Math.min(0.012, dur * 0.25), dur);
  src.connect(filter).connect(gain).connect(dest || sfxGain);
  src.start(t, Math.random() * 1.5);
  src.stop(t + dur + 0.06);
  return gain;
}

/** One pitched voice with an optional glide. */
function tone(t, dur, peak, type, f0, f1, dest, detune) {
  const osc = ctx.createOscillator();
  osc.type = type;
  if (detune) osc.detune.value = detune;
  osc.frequency.setValueAtTime(Math.max(10, f0), t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(10, f1), t + dur);
  const gain = ctx.createGain();
  env(gain, t, peak, Math.min(0.02, dur * 0.2), dur);
  osc.connect(gain).connect(dest || sfxGain);
  osc.start(t);
  osc.stop(t + dur + 0.06);
  return gain;
}

/** Cheap fake reverb: parallel delays with feedback, torn down after the tail. */
function reverbSend(t, tail) {
  const wet = ctx.createGain();
  wet.gain.setValueAtTime(0.5, t);
  wet.gain.linearRampToValueAtTime(0.0001, t + tail);
  const delays = [0.077, 0.123, 0.191];
  for (let i = 0; i < delays.length; i++) {
    const d = ctx.createDelay(1);
    d.delayTime.value = delays[i];
    const fb = ctx.createGain();
    fb.gain.value = 0.52 - i * 0.08;
    const damp = ctx.createBiquadFilter();
    damp.type = 'lowpass';
    damp.frequency.value = 1600;
    wet.connect(d);
    d.connect(damp).connect(fb).connect(d);
    d.connect(sfxGain);
  }
  // Break the feedback loops once the tail is inaudible.
  setTimeout(() => { try { wet.disconnect(); } catch (e) { /* ignore */ } },
    Math.round((tail + 0.6) * 1000));
  return wet;
}

/* ------------------------------------------------------------------ */
/* Music                                                               */
/* ------------------------------------------------------------------ */

/** Bell-ish arpeggio note, slightly detuned. */
function arpNote(t) {
  const step = SCALE[ARP[arpIndex % ARP.length] % SCALE.length];
  arpIndex++;
  const f = hz(step + 36);           // three octaves above the root
  const dur = 0.45 + tension * 0.1;
  const out = ctx.createGain();
  out.gain.value = 0.12 + tension * 0.06;
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.Q.value = 2.5;
  filter.frequency.setValueAtTime(f * 2, t);
  filter.frequency.exponentialRampToValueAtTime(f, t + dur);
  out.connect(filter).connect(musicGain);
  tone(t, dur, 0.5, 'triangle', f, f * 0.995, out, -8);
  tone(t, dur * 0.6, 0.22, 'sine', f * 2, f * 2, out, 9);
}

/** Two-thump heartbeat: pum-pum, low sine with a fast decay. */
function heartbeat(t) {
  const punch = 0.5 + tension * 0.4;
  tone(t, 0.16, 0.9 * punch, 'sine', 62, 34, musicGain);
  burst(t, 0.05, 0.12 * punch, 'lowpass', 400, 120, 1, musicGain);
  const second = t + 0.2 - tension * 0.05;
  tone(second, 0.13, 0.62 * punch, 'sine', 55, 30, musicGain);
}

/** Lookahead clock: schedules notes against ctx.currentTime, never per-note timers. */
function scheduler() {
  try {
    if (!ctx || !music) return;
    const horizon = ctx.currentTime + LOOKAHEAD;
    const arpStep = 0.34 - tension * 0.21;          // faster arpeggio with tension
    const beatStep = 60 / (60 + tension * 105);     // ~60 bpm -> ~165 bpm
    if (nextArpTime < ctx.currentTime) nextArpTime = ctx.currentTime;
    if (nextBeatTime < ctx.currentTime) nextBeatTime = ctx.currentTime;
    while (nextArpTime < horizon) {
      arpNote(nextArpTime);
      nextArpTime += arpStep;
    }
    while (nextBeatTime < horizon) {
      heartbeat(nextBeatTime);
      nextBeatTime += beatStep;
    }
  } catch (e) { /* never let the clock throw into the page */ }
}

/** Push the stored tension into the sustained music layers, always ramped. */
function applyTension() {
  if (!music) return;
  ramp(music.filter.frequency, 220 + tension * 1500, 0.6);
  ramp(music.tritoneGain.gain, tension > 0.5 ? (tension - 0.5) * 2 * 0.2 : 0.0001, 0.9);
}

/* ------------------------------------------------------------------ */
/* SFX                                                                 */
/* ------------------------------------------------------------------ */

function playSfx(name, t) {
  switch (name) {
    case 'card':               // paper rustle
      burst(t, 0.12, 0.3, 'highpass', 2600, 4200, 0.7, null);
      burst(t + 0.05, 0.09, 0.2, 'bandpass', 5200, 3000, 1.2, null);
      break;

    case 'hit':                // dry impact: noise crack + low body
      burst(t, 0.09, 0.85, 'lowpass', 2600, 500, 1, null);
      tone(t, 0.16, 0.8, 'sine', 160, 42, null);
      break;

    case 'hurt':               // guttural groan: falling bandpassed noise + formant
      burst(t, 0.42, 0.6, 'bandpass', 780, 150, 6, null);
      tone(t, 0.38, 0.35, 'sawtooth', 128, 74, null, -14);
      burst(t + 0.04, 0.3, 0.22, 'bandpass', 420, 300, 9, null);
      break;

    case 'graft':              // wet slap plus suction
      burst(t, 0.13, 0.75, 'lowpass', 1800, 260, 2, null);
      burst(t + 0.06, 0.34, 0.45, 'bandpass', 320, 1500, 7, null);
      tone(t + 0.06, 0.3, 0.2, 'sine', 90, 190, null);
      break;

    case 'squelch':            // short visceral squelch
      burst(t, 0.15, 0.6, 'bandpass', 950, 240, 5, null);
      tone(t, 0.1, 0.25, 'sine', 210, 80, null);
      break;

    case 'break':              // bone snap: clicks through a high bandpass
      for (let i = 0; i < 5; i++) {
        burst(t + i * 0.018 + Math.random() * 0.01, 0.035, 0.55,
          'bandpass', 2400 + Math.random() * 1800, 1800, 12, null);
      }
      tone(t, 0.2, 0.5, 'triangle', 190, 48, null);
      break;

    case 'trap':               // steel and steam
      tone(t, 0.3, 0.32, 'square', 1870, 1720, null, 11);
      tone(t, 0.26, 0.24, 'square', 2530, 2380, null, -13);
      burst(t + 0.05, 0.5, 0.3, 'highpass', 3000, 5200, 0.8, null);
      break;

    case 'step':               // muffled footfall
      burst(t, 0.06, 0.3, 'lowpass', 900, 260, 1, null);
      tone(t, 0.1, 0.4, 'sine', 95, 48, null);
      break;

    case 'heat':               // pressurized steam hiss
      burst(t, 0.75, 0.42, 'bandpass', 1100, 3200, 1.6, null);
      burst(t + 0.1, 0.55, 0.2, 'highpass', 4200, 6000, 0.7, null);
      break;

    case 'death': {            // descending fall into fake reverb
      const wet = reverbSend(t, 2.2);
      tone(t, 1.7, 0.6, 'sawtooth', 240, 28, wet, -20);
      tone(t, 1.7, 0.45, 'sawtooth', 238, 27, null, 16);
      burst(t + 0.2, 1.2, 0.25, 'lowpass', 1400, 180, 1.2, wet);
      tone(t + 0.6, 1.2, 0.3, 'sine', 70, 26, null);
      break;
    }

    case 'escape': {           // hopeful but sickly rising chord
      const steps = [0, 7, 12, 15, 19];
      for (let i = 0; i < steps.length; i++) {
        const f = hz(steps[i] + 24);
        tone(t + i * 0.13, 0.9, 0.3, 'triangle', f, f * 0.985, null, i % 2 ? 14 : -11);
      }
      burst(t, 1.1, 0.12, 'bandpass', 600, 2400, 2, null);
      break;
    }

    case 'select':             // brass click
      tone(t, 0.07, 0.45, 'triangle', 920, 700, null);
      burst(t, 0.035, 0.25, 'bandpass', 2100, 1600, 8, null);
      break;

    case 'deny':               // low detuned buzz
      tone(t, 0.32, 0.45, 'sawtooth', 74, 66, null, -18);
      tone(t, 0.32, 0.4, 'sawtooth', 70, 63, null, 22);
      break;

    case 'enemy': {            // long guttural roar
      const body = ctx.createGain();
      body.gain.value = 1;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.Q.value = 3;
      lp.frequency.setValueAtTime(1500, t);
      lp.frequency.exponentialRampToValueAtTime(300, t + 1.1);
      body.connect(lp).connect(sfxGain);
      // Tremolo gives the roar its animal wobble.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 22;
      const lfoGain = ctx.createGain();
      lfoGain.gain.value = 0.35;
      lfo.connect(lfoGain).connect(body.gain);
      lfo.start(t);
      lfo.stop(t + 1.3);
      tone(t, 1.1, 0.55, 'sawtooth', 96, 52, body, -25);
      tone(t, 1.1, 0.4, 'sawtooth', 92, 49, body, 19);
      burst(t + 0.05, 0.9, 0.35, 'bandpass', 620, 180, 5, body);
      break;
    }

    default:
      break;
  }
}

/* ------------------------------------------------------------------ */
/* Public API                                                          */
/* ------------------------------------------------------------------ */

export const audio = {
  muted: false,

  /** Lazily build the graph. Idempotent; call it from the first user gesture. */
  init() {
    try {
      if (ctx) {
        if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
        return;
      }
      const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 8;
      comp.attack.value = 0.004;
      comp.release.value = 0.22;
      master = ctx.createGain();
      master.gain.value = audio.muted ? 0.0001 : MASTER_LEVEL;
      musicGain = ctx.createGain();
      musicGain.gain.value = 0.0001;
      sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_LEVEL;
      musicGain.connect(master);
      sfxGain.connect(master);
      master.connect(comp).connect(ctx.destination);
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
    } catch (e) {
      ctx = null;
    }
  },

  /** Drone + arpeggio + heartbeat. Idempotent. */
  startMusic() {
    try {
      if (!ctx) audio.init();
      if (!ctx || music) return;
      const t = ctx.currentTime;

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 6;
      filter.frequency.value = 220 + tension * 1500;
      filter.connect(musicGain);

      // Slow LFO wandering over the drone cutoff.
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.value = 0.06;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 130;
      lfo.connect(lfoDepth).connect(filter.frequency);
      lfo.start(t);

      // Three detuned oscillators on the low minor root.
      const oscs = [];
      const layers = [
        { type: 'sawtooth', mul: 1, detune: -9, gain: 0.32 },
        { type: 'triangle', mul: 2, detune: 7, gain: 0.22 },
        { type: 'sawtooth', mul: 1, detune: 14, gain: 0.18 },
      ];
      for (const l of layers) {
        const osc = ctx.createOscillator();
        osc.type = l.type;
        osc.frequency.value = ROOT * l.mul;
        osc.detune.value = l.detune;
        const g = ctx.createGain();
        g.gain.value = l.gain;
        osc.connect(g).connect(filter);
        osc.start(t);
        oscs.push(osc);
      }

      // Dissonant tritone drone, faded in by setTension above t > 0.5.
      const tritoneGain = ctx.createGain();
      tritoneGain.gain.value = 0.0001;
      tritoneGain.connect(filter);
      const tri = ctx.createOscillator();
      tri.type = 'sawtooth';
      tri.frequency.value = ROOT * TRITONE;
      tri.detune.value = -6;
      tri.connect(tritoneGain);
      tri.start(t);
      oscs.push(tri);

      music = { oscs, filter, tritoneGain, lfo };
      nextArpTime = t + 0.1;
      nextBeatTime = t + 0.1;
      ramp(musicGain.gain, MUSIC_LEVEL, 1.5);
      applyTension();
      clock = setInterval(scheduler, TICK_MS);
    } catch (e) { /* stay silent rather than break the game loop */ }
  },

  /** Fade out and release every music node. Idempotent. */
  stopMusic() {
    try {
      if (clock) { clearInterval(clock); clock = 0; }
      if (!ctx || !music) { music = null; return; }
      const dying = music;
      music = null;
      ramp(musicGain.gain, 0.0001, 0.5);
      const end = ctx.currentTime + 0.6;
      for (const osc of dying.oscs) { try { osc.stop(end); } catch (e) { /* already stopped */ } }
      try { dying.lfo.stop(end); } catch (e) { /* already stopped */ }
    } catch (e) { /* ignore */ }
  },

  /** t in 0..1: heartbeat tempo, drone cutoff, tritone and arpeggio speed. */
  setTension(t) {
    try {
      const v = Number(t);
      tension = Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0;
      if (!ctx) return;
      applyTension();
    } catch (e) { /* ignore */ }
  },

  /** One-shot effect by name. Same name twice within 30 ms is ignored. */
  sfx(name) {
    try {
      if (!ctx) audio.init();
      if (!ctx || !name) return;
      const now = Date.now();
      if (lastFired[name] && now - lastFired[name] < SFX_GAP_MS) return;
      lastFired[name] = now;
      playSfx(name, ctx.currentTime + 0.005);
    } catch (e) { /* ignore */ }
  },

  /** Flip mute; returns the new state and mirrors it on audio.muted. */
  toggleMute() {
    try {
      audio.muted = !audio.muted;
      if (ctx && master) ramp(master.gain, audio.muted ? 0.0001 : MASTER_LEVEL, 0.08);
    } catch (e) { /* ignore */ }
    return audio.muted;
  },
};
