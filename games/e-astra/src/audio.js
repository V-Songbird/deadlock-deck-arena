/* Banda sonora y foley originales sintetizados con Web Audio. */
'use strict';

window.DDAudio = class {
  constructor(game) {
    this.game = game;
    this.context = null;
    this.master = null;
    this.music = null;
    this.fx = null;
    this.sequence = 0;
    this.nextNote = 0;
    this.interval = null;
    this.noiseBuffer = null;
    game.addEventListener('sound', event => this.effect(event.detail.name));
    game.addEventListener('preference', () => this.update());
    document.addEventListener('visibilitychange', () => {
      if (this.context && document.hidden) this.context.suspend().catch(() => {});
      else if (this.context && this.unlocked) this.context.resume().catch(() => {});
    });
  }

  unlock() {
    try {
      if (!this.context) {
        const Audio = window.AudioContext || window.webkitAudioContext;
        if (!Audio) return;
        this.context = new Audio();
        this.master = this.context.createGain();
        this.music = this.context.createGain();
        this.fx = this.context.createGain();
        const compressor = this.context.createDynamicsCompressor();
        compressor.threshold.value = -16;
        compressor.ratio.value = 5;
        this.music.gain.value = 0.33;
        this.music.connect(this.master);
        this.fx.connect(this.master);
        this.master.connect(compressor);
        compressor.connect(this.context.destination);
        const buffer = this.context.createBuffer(1, this.context.sampleRate * 2, this.context.sampleRate);
        const data = buffer.getChannelData(0);
        let last = 0;
        for (let i = 0; i < data.length; i++) {
          last = (last + Math.random() * 0.05 - 0.025) / 1.02;
          data[i] = last * 8;
        }
        this.noiseBuffer = buffer;
        this.nextNote = this.context.currentTime;
        this.interval = setInterval(() => this.schedule(), 180);
      }
      this.unlocked = true;
      this.context.resume().catch(() => {});
      this.update();
    } catch (_) {
      this.game.notice(window.DDLang.t('El audio no está disponible en este navegador. El juego puede continuar.'));
    }
  }

  update() {
    if (!this.context) return;
    const now = this.context.currentTime;
    this.master.gain.setTargetAtTime(this.game.meta.volume, now, 0.08);
    this.fx.gain.setTargetAtTime(this.game.meta.sfx ? 0.75 : 0, now, 0.04);
  }

  tone(freq, start, duration, type = 'sine', volume = 0.1, output = null, endFrequency = null) {
    if (!this.context) return;
    const oscillator = this.context.createOscillator();
    const gain = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(freq, start);
    if (endFrequency) oscillator.frequency.exponentialRampToValueAtTime(Math.max(1, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.002, volume), start + Math.min(0.04, duration / 4));
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(output || this.fx);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.03);
  }

  noise(duration, cutoff, volume = 0.25, resonance = 1, endCutoff = null) {
    if (!this.context || !this.noiseBuffer) return;
    const source = this.context.createBufferSource();
    const filter = this.context.createBiquadFilter();
    const gain = this.context.createGain();
    const now = this.context.currentTime;
    source.buffer = this.noiseBuffer;
    source.playbackRate.value = 0.75 + Math.random() * 0.3;
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(cutoff, now);
    if (endCutoff) filter.frequency.exponentialRampToValueAtTime(endCutoff, now + duration);
    filter.Q.value = resonance;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.fx);
    source.start(now);
    source.stop(now + duration);
  }

  schedule() {
    if (!this.context || this.context.state !== 'running') return;
    const now = this.context.currentTime;
    if (this.nextNote < now - 1) this.nextNote = now;
    const danger = this.game.active() && this.game.remaining() < 60000;
    const combat = this.game.state?.phase === 'combat';
    const beat = danger ? 0.3 : combat ? 0.41 : 0.59;
    while (this.nextNote < now + 0.4) {
      const t = this.nextNote;
      const step = this.sequence++;
      const roots = [55, 55, 51.913, 58.27];
      const root = roots[Math.floor(step / 16) % roots.length];
      if (step % 8 === 0) {
        // Low string-like pad, a fifth and a dissonant upper layer.
        this.tone(root, t, beat * 9, 'triangle', 0.14, this.music);
        this.tone(root * 1.498, t + 0.04, beat * 8.5, 'sine', 0.065, this.music);
        this.tone(root * 2.012, t + 0.08, beat * 7.7, 'triangle', 0.035, this.music);
      }
      const arpeggio = [4, 3, 4.7568, 3.5636, 4, 5.0397, 3, 2.8284];
      if (step % 2 === 0 || combat) {
        this.tone(root * arpeggio[step % arpeggio.length], t, 0.55, 'sine', 0.075, this.music);
        this.tone(root * arpeggio[step % arpeggio.length] * 2, t, 0.2, 'triangle', 0.018, this.music);
      }
      if (step % 4 === 0 && this.game.active()) {
        this.tone(76, t, 0.3, 'sine', 0.22, this.music, 28);
        this.tone(49, t + 0.17, 0.17, 'sine', 0.13, this.music, 30);
      }
      // Mechanical clock ticks intensify as the tower approaches collapse.
      if (this.game.active()) this.tone(step % 2 ? 1530 : 1970, t, 0.025, 'square', danger ? 0.034 : 0.013, this.music);
      this.nextNote += beat;
    }
  }

  effect(name) {
    if (!this.context || this.context.state !== 'running' || !this.game.meta.sfx) return;
    const t = this.context.currentTime;
    const tone = (freq, duration, type, gain, end) => this.tone(freq, t, duration, type, gain, this.fx, end);
    if (name === 'attack') {
      this.noise(0.16, 1200, 0.5, 0.6, 130);
      tone(145, 0.18, 'sawtooth', 0.14, 45);
      tone(52, 0.21, 'sine', 0.3, 25);
    } else if (['hurt', 'death', 'break'].includes(name)) {
      this.noise(name === 'death' ? 1.2 : 0.4, 600, 0.65, 3.5, 90);
      tone(99, name === 'death' ? 1.3 : 0.38, 'sawtooth', 0.15, 28);
      tone(148, 0.35, 'triangle', 0.15, 52);
      if (name === 'break') this.noise(0.18, 3200, 0.6, 0.5);
    } else if (name === 'graft') {
      this.noise(0.45, 480, 0.7, 5, 1300);
      tone(83, 0.45, 'sawtooth', 0.12, 156);
      this.tone(660, t + 0.3, 0.2, 'sine', 0.12);
    } else if (['heal', 'cool'].includes(name)) {
      this.noise(0.5, name === 'cool' ? 2600 : 620, 0.22, 0.8, 1400);
      tone(330, 0.45, 'sine', 0.1, 660);
    } else if (name === 'guard') {
      tone(440, 0.23, 'triangle', 0.18, 220);
      tone(713, 0.21, 'sine', 0.1, 510);
    } else if (['loot', 'discover', 'victory', 'escape', 'revive', 'stairs'].includes(name)) {
      const notes = name === 'escape' ? [220, 261.63, 329.63, 440, 523.25] : [164.81, 220, 261.63, 329.63];
      notes.forEach((freq, i) => this.tone(freq, t + i * 0.09, 0.65, 'triangle', 0.105));
      if (name === 'revive') this.noise(0.8, 210, 0.35, 4, 960);
    } else if (['collapse', 'boss', 'combat', 'burn'].includes(name)) {
      this.noise(name === 'collapse' ? 1.6 : 0.55, 170, 0.8, 0.4);
      tone(59, 0.9, 'sawtooth', 0.16, 29);
    } else if (name === 'step') {
      this.noise(0.07, 460, 0.25, 0.8);
      tone(79, 0.08, 'sine', 0.12, 45);
    } else {
      this.noise(0.06, 1600, 0.12, 0.6);
      tone(520, 0.07, 'triangle', 0.06, 340);
    }
  }
};
