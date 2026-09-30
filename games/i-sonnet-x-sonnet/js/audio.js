/* Deadlock Deck: El Reloj Anatómico — audio (W8)
 * Todo se sintetiza con Web Audio: sin archivos de sonido.
 * Las funciones de síntesis reciben el motor E (contexto + buses) y un destino, así que funcionan igual
 * sobre un AudioContext real que sobre un OfflineAudioContext (DD.Audio.create, usado para verificar).
 */
(function () {
  'use strict';
  var DD = window.DD = window.DD || {};

  /* ---------- Mezcla y límites ---------- */
  var MASTER = 0.9, MUSIC_LVL = 0.28, SFX_LVL = 1.0, ECHO_SEND = 0.5;
  var LOOK = 0.4, PUMP_MS = 60;            // planificación adelantada (s) e intervalo del planificador (ms)
  var MAX_SFX = 14, MAX_TRACKS = 3;        // efectos simultáneos; pista actual + las que se desvanecen
  var FADE_TC = 0.3, FADE_END = 2.2;       // fundido cruzado: constante de tiempo y cuándo se retira la saliente
  var AC = window.AudioContext || window.webkitAudioContext;

  /* ---------- Utilidades ---------- */
  function mtof(m) { return 440 * Math.pow(2, (m - 69) / 12); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function dots(n) { return new Array(n + 1).join('.'); }
  function sprinkle(n, at) { var a = dots(n).split(''), k; for (k in at) a[+k] = at[k]; return a.join(''); }
  function hash(n) {                        // ruido determinista por paso: el bucle suena igual cada vuelta
    n = (n ^ 61) ^ (n >>> 16); n = (n + (n << 3)) | 0; n ^= n >>> 4; n = Math.imul(n, 0x27d4eb2d); n ^= n >>> 15;
    return (n >>> 0) / 4294967296;
  }
  function lcg(seed) {
    var s = seed >>> 0;
    return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; };
  }

  /* ---------- Recursos generados por código ---------- */
  function makeNoise(ctx) {
    var n = (ctx.sampleRate * 2) | 0, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0), r = lcg(12345), i;
    for (i = 0; i < n; i++) d[i] = r() * 2 - 1;
    return b;
  }
  function makeImpulse(ctx, secs) {          // reverb de convolución: ruido estéreo que decae y se oscurece
    var sr = ctx.sampleRate, n = (sr * secs) | 0, b = ctx.createBuffer(2, n, sr), ch, i, d, r, lp, x;
    for (ch = 0; ch < 2; ch++) {
      d = b.getChannelData(ch); r = lcg(777 + ch * 91); lp = 0;
      for (i = 0; i < n; i++) {
        x = i / n;
        lp += ((r() * 2 - 1) - lp) * (0.06 + 0.7 * (1 - x) * (1 - x));
        d[i] = lp * Math.pow(1 - x, 3) * Math.min(1, i / (sr * 0.012));
      }
    }
    return b;
  }
  function gritCurve() {                     // saturación para gruñidos y golpes
    var n = 1024, c = new Float32Array(n), i, x;
    for (i = 0; i < n; i++) { x = i / (n - 1) * 2 - 1; c[i] = Math.tanh(3 * x) / Math.tanh(3); }
    return c;
  }
  function clipCurve() {                     // limitador suave final: nunca supera ~0.92
    var n = 2048, c = new Float32Array(n), k = 0.75, m = 0.2, i, x, ax;
    for (i = 0; i < n; i++) {
      x = i / (n - 1) * 2 - 1; ax = Math.abs(x);
      c[i] = ax <= k ? x : (x < 0 ? -1 : 1) * (k + m * Math.tanh((ax - k) / m));
    }
    return c;
  }
  function makeWave(ctx, amps) {             // amps[i] = amplitud del armónico i+1
    var re = new Float32Array(amps.length + 1), im = new Float32Array(amps.length + 1), i;
    for (i = 0; i < amps.length; i++) im[i + 1] = amps[i];
    return ctx.createPeriodicWave(re, im);
  }
  function makeWaves(ctx) {
    try {
      return {
        organ: makeWave(ctx, [1, 0.6, 0.4, 0.3, 0.1, 0.2, 0, 0.12]),
        brass: makeWave(ctx, [1, 0.9, 0.8, 0.65, 0.5, 0.4, 0.3, 0.2, 0.14, 0.1, 0.07, 0.05])
      };
    } catch (e) { return {}; }
  }

  /* ---------- Motor: cadena maestra ---------- */
  // sfxBus y musicBus -> compresor -> maestro -> limitador suave -> destino; reverb y eco como envíos.
  function createEngine(ctx, opt) {
    opt = opt || {};
    var E = { ctx: ctx, rng: opt.rng || Math.random, tension: 0, tensionFn: null, sink: null };
    var dest = opt.dest || ctx.destination, conv, vIn, vHp, vLp, vOut, dl, fb, eLp, eOut, comp, sh;
    function gain(v) { var g = ctx.createGain(); g.gain.value = v; return g; }
    E.noise = makeNoise(ctx); E.grit = gritCurve(); E.waves = makeWaves(ctx);

    comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -16; comp.knee.value = 14; comp.ratio.value = 5;
    comp.attack.value = 0.004; comp.release.value = 0.22;
    E.master = gain(MASTER); E.sfxBus = gain(SFX_LVL); E.musicBus = gain(MUSIC_LVL);
    E.sfxBus.connect(comp); E.musicBus.connect(comp); comp.connect(E.master);
    if (opt.clip === false) E.master.connect(dest);
    else { sh = ctx.createWaveShaper(); sh.curve = clipCurve(); try { sh.oversample = '2x'; } catch (e) { /* sin oversample */ } E.master.connect(sh); sh.connect(dest); }

    // reverb de convolución (graves recortados para no empastar los golpes)
    conv = ctx.createConvolver(); conv.buffer = makeImpulse(ctx, 2.6);
    vIn = gain(1); vHp = ctx.createBiquadFilter(); vHp.type = 'highpass'; vHp.frequency.value = 180;
    vLp = ctx.createBiquadFilter(); vLp.type = 'lowpass'; vLp.frequency.value = 5200; vOut = gain(0.9);
    E.sfxBus.connect(gain(0.14)).connect(vIn); E.musicBus.connect(gain(0.3)).connect(vIn);
    vIn.connect(vHp); vHp.connect(vLp); vLp.connect(conv); conv.connect(vOut); vOut.connect(comp);

    // eco oscuro con realimentación (arpegios y campanas)
    E.echoIn = gain(1); dl = ctx.createDelay(1); dl.delayTime.value = 0.34; fb = gain(0.4);
    eLp = ctx.createBiquadFilter(); eLp.type = 'lowpass'; eLp.frequency.value = 2200; eOut = gain(0.55);
    E.echoIn.connect(dl); dl.connect(eLp); eLp.connect(fb); fb.connect(dl); eLp.connect(eOut); eOut.connect(E.musicBus);

    E.comp = comp;
    E.sfxAt = function (name, vol, t) { return playSfx(E, name, vol, t); };
    E.renderMusic = function (name, secs, T) {     // programa de golpe secs segundos de pista (verificación offline)
      var inst = newInst(E, name, 0, true);
      E.tensionFn = typeof T === 'function' ? T : function () { return T || 0; };
      runSteps(E, inst, secs);
      return inst;
    };
    return E;
  }

  /* ---------- Primitivas de síntesis ---------- */
  function lfo(E, rate, depth, param, t, end) {
    var c = E.ctx, o = c.createOscillator(), g = c.createGain();
    o.frequency.value = rate; g.gain.value = depth; o.connect(g); g.connect(param);
    o.start(t); stopAt(E, o, end);
  }
  function stopAt(E, s, end) {
    s.stop(end + 0.03); s.ddEnd = end + 0.03;
    if (E.sink) E.sink.push(s);
  }
  function noiseNorm(flts, nyq) {           // iguala el nivel del ruido filtrado: vol ~ amplitud de pico aproximada
    var bw = nyq, i, s, f, w;
    for (i = 0; i < flts.length; i++) {
      s = flts[i]; f = s.f2 ? Math.sqrt(s.f * s.f2) : s.f;
      if (s.t === 'highpass') w = Math.max(nyq - f, 300);
      else if (s.t === 'bandpass') w = 1.57 * f / (s.q || 0.7);
      else if (s.t === 'peaking' || s.t === 'notch') continue;
      else w = 1.57 * f;
      if (w < bw) bw = w;
    }
    return Math.min(0.5 * Math.sqrt(nyq / bw), 8);
  }

  // Voz genérica: fuente (osciladores desafinados o ruido) -> filtros -> [saturador] -> [AM] -> envolvente -> [panorama] -> destino.
  // o: t, f, f2 (final), glide, type|wave, dets (cents), noise, vol; envolvente percusiva (d) o sostenida (dur, r);
  //    a (ataque), flt {t,f,f2,q,g,s} o array, dist, am [Hz, prof], fm [Hz, prof Hz], pan
  function voice(E, dest, o) {
    var c = E.ctx, t = o.t, a = o.a == null ? 0.004 : o.a, r = o.r == null ? 0.05 : o.r;
    var perc = o.d != null, dur = perc ? a + o.d : Math.max(o.dur, 0.02), end = perc ? t + dur : t + dur + r;
    var flts = o.flt ? [].concat(o.flt) : [], dets = o.dets || [o.det || 0], chain = [], peak = Math.max(o.vol, 0.0002);
    var i, s, node, g, f = o.f;
    if (o.noise) peak *= noiseNorm(flts, c.sampleRate / 2); else peak /= Math.sqrt(dets.length);
    for (i = 0; i < flts.length; i++) {
      s = flts[i]; node = c.createBiquadFilter(); node.type = s.t || 'lowpass';
      node.frequency.setValueAtTime(s.f, t);
      if (s.f2) node.frequency.exponentialRampToValueAtTime(s.f2, t + (s.s || end - t));
      node.Q.value = s.q == null ? 0.7 : s.q;
      if (s.g) node.gain.value = s.g;
      chain.push(node);
    }
    if (o.dist) { node = c.createWaveShaper(); node.curve = E.grit; chain.push(node); }
    if (o.am) { node = c.createGain(); node.gain.value = 1 - o.am[1] / 2; lfo(E, o.am[0], o.am[1] / 2, node.gain, t, end); chain.push(node); }
    g = c.createGain(); chain.push(g);
    if (perc) {
      g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, end);
    } else {
      a = Math.min(a, dur);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(peak, t + a);
      g.gain.setValueAtTime(peak, t + dur); g.gain.linearRampToValueAtTime(0, end);
    }
    if (o.pan && c.createStereoPanner) { node = c.createStereoPanner(); node.pan.value = o.pan; chain.push(node); }
    for (i = 0; i < chain.length - 1; i++) chain[i].connect(chain[i + 1]);
    chain[chain.length - 1].connect(dest);
    if (o.noise) {
      s = c.createBufferSource(); s.buffer = E.noise; s.loop = true;
      s.connect(chain[0]); s.start(t, E.rng() * 1.5); stopAt(E, s, end);
    } else {
      f = clamp(f, 10, 16000);
      for (i = 0; i < dets.length; i++) {
        s = c.createOscillator();
        if (o.wave && E.waves[o.wave]) s.setPeriodicWave(E.waves[o.wave]); else s.type = o.type || (o.wave ? 'sawtooth' : 'sine');
        s.frequency.setValueAtTime(f, t);
        if (o.f2) s.frequency.exponentialRampToValueAtTime(clamp(o.f2, 10, 16000), t + (o.glide || dur));
        s.detune.value = dets[i];
        if (o.fm) lfo(E, o.fm[0], o.fm[1], s.frequency, t, end);
        s.connect(chain[0]); s.start(t); stopAt(E, s, end);
      }
    }
    return end;
  }
  function tone(E, d, o) { return voice(E, d, o); }
  function noiseBurst(E, d, o) { o.noise = true; return voice(E, d, o); }
  function nb(E, d, t, type, dur, f, f2, q, vol, a) {       // ráfaga de ruido filtrado que decae
    return noiseBurst(E, d, { t: t, d: dur, a: a == null ? 0.003 : a, vol: vol, flt: { t: type, f: f, f2: f2, q: q } });
  }
  function thump(E, d, t, f, f2, dur, vol) {                // seno que cae de tono: golpe grave
    return tone(E, d, { t: t, f: f, f2: f2, glide: dur * 0.5, d: dur, a: 0.003, vol: vol });
  }
  function bubbles(E, d, t, n, base, gap, vol, dir) {       // burbujas: chirridos senoidales cortos
    for (var i = 0, f; i < n; i++) {
      f = base * (0.7 + E.rng() * 0.9);
      tone(E, d, { t: t + i * gap * (0.6 + E.rng() * 0.8), f: f, f2: f * (dir > 0 ? 1.8 : 0.55), glide: 0.05,
        d: 0.06 + E.rng() * 0.05, a: 0.004, vol: vol * (0.6 + E.rng() * 0.4) });
    }
  }
  function crackle(E, d, t, dur, n, vol, f) {               // chasquidos al azar (fuego, astillas)
    for (var i = 0; i < n; i++) nb(E, d, t + E.rng() * dur, 'bandpass', 0.012, f * (0.6 + E.rng()), 0, 3, vol * (0.4 + E.rng() * 0.6), 0.001);
  }
  var METAL = [1, 2.76, 5.4, 8.93];
  var BELL = [0.5, 1, 1.19, 1.5, 2, 2.5, 3, 4.2], BELL_A = [0.6, 1, 0.8, 0.5, 0.7, 0.3, 0.2, 0.1];
  function clang(E, d, t, f, dur, vol, ratios, amps) {      // parciales inarmónicos: metal o campana
    ratios = ratios || METAL;
    for (var i = 0; i < ratios.length; i++) {
      tone(E, d, { t: t, f: f * ratios[i], d: dur / (1 + i * 0.5), a: 0.002, vol: vol * (amps ? amps[i] : 1 / (1 + i * 0.7)) });
    }
    nb(E, d, t, 'bandpass', 0.03, f * 3, f * 3, 1.5, vol * 0.5, 0.001);
  }
  function growl(E, d, t, f, f2, dur, vol) {                // gruñido: sierra con AM rugosa por formante grave
    tone(E, d, { t: t, f: f, f2: f2, glide: dur, type: 'sawtooth', a: 0.03, dur: dur * 0.75, r: dur * 0.25, vol: vol,
      am: [34 + E.rng() * 12, 0.85], flt: { t: 'lowpass', f: 520, f2: 240, q: 5 }, dist: true });
    nb(E, d, t, 'bandpass', dur, 420, 240, 1, vol * 0.35, 0.05);
  }
  function clockTick(E, d, t, vel, tock, pan) {             // tic (agudo) / tac (grave) de reloj
    nb(E, d, t, 'bandpass', 0.016, tock ? 1500 : 2700, tock ? 1500 : 2700, 5, vel * 0.9, 0.001);
    tone(E, d, { t: t, f: tock ? 760 : 1350, f2: tock ? 520 : 900, glide: 0.02, d: 0.05, a: 0.001, vol: vel * 0.4, pan: pan });
    thump(E, d, t, tock ? 170 : 210, 100, 0.05, vel * 0.3);
  }

  /* ---------- Efectos (§9). fn(E, destino, t, r): r = variación de tono aleatoria ~0.89..1.11 ---------- */
  var SFX = {
    step: { v: 0.5, len: 0.2, gap: 0.07, max: 2, fn: function (E, d, t, r) {
      thump(E, d, t, 105 * r, 46 * r, 0.15, 0.9);
      nb(E, d, t, 'lowpass', 0.1, 480 * r, 130, 0.8, 0.9);
      if (E.rng() < 0.5) nb(E, d, t + 0.015, 'bandpass', 0.04, 1500 * r, 900, 2.5, 0.25);
    } },
    hit: { v: 0.6, len: 0.3, max: 3, fn: function (E, d, t, r) {
      thump(E, d, t, 150 * r, 52 * r, 0.22, 1);
      nb(E, d, t, 'lowpass', 0.16, 900 * r, 200, 0.8, 0.8);
      nb(E, d, t, 'bandpass', 0.03, 1600 * r, 900, 2, 0.4);
    } },
    hitHeavy: { v: 0.42, len: 0.7, pri: 1, max: 2, fn: function (E, d, t, r) {
      thump(E, d, t, 110 * r, 30 * r, 0.5, 1);
      tone(E, d, { t: t, f: 62 * r, f2: 26 * r, glide: 0.4, d: 0.6, vol: 0.7, dist: true });
      nb(E, d, t, 'lowpass', 0.3, 1200 * r, 140, 0.7, 1);
      nb(E, d, t, 'bandpass', 0.05, 2200 * r, 1000, 1.5, 0.45);
    } },
    block: { v: 0.52, len: 0.45, max: 3, fn: function (E, d, t, r) {
      clang(E, d, t, 420 * r, 0.35, 0.45);
      thump(E, d, t, 120 * r, 60 * r, 0.16, 1.1);
      nb(E, d, t, 'highpass', 0.03, 3000, 3000, 0.7, 0.25);
    } },
    card: { v: 0.68, len: 0.2, gap: 0.04, max: 3, fn: function (E, d, t, r) {
      nb(E, d, t, 'bandpass', 0.12, 1400 * r, 3800 * r, 1.2, 0.5, 0.02);
      thump(E, d, t + 0.06, 220 * r, 120 * r, 0.07, 0.6);
    } },
    cardHot: { v: 0.62, len: 0.5, max: 3, fn: function (E, d, t, r) {
      SFX.card.fn(E, d, t, r);
      nb(E, d, t + 0.02, 'highpass', 0.35, 4500, 2500, 0.7, 0.3, 0.05);
      tone(E, d, { t: t + 0.02, f: 110 * r, f2: 190 * r, glide: 0.3, d: 0.35, a: 0.02, type: 'sawtooth', vol: 0.3,
        flt: { t: 'lowpass', f: 500, f2: 1600, q: 3 }, dist: true });
    } },
    overheat: { v: 0.65, len: 1.5, pri: 2, max: 1, fn: function (E, d, t, r) {
      nb(E, d, t, 'highpass', 1.3, 3000, 5500, 0.7, 0.3, 0.25);
      nb(E, d, t + 0.05, 'bandpass', 1.0, 1200 * r, 400, 4, 0.45, 0.1);
      tone(E, d, { t: t, f: 210 * r, f2: 150 * r, glide: 1, type: 'sawtooth', a: 0.05, dur: 0.9, r: 0.3, vol: 0.35,
        fm: [23, 30], flt: { t: 'bandpass', f: 900, f2: 600, q: 8 }, dist: true });
      tone(E, d, { t: t + 0.1, f: 333 * r, f2: 280 * r, glide: 0.9, type: 'square', a: 0.1, dur: 0.7, r: 0.3, vol: 0.2,
        fm: [31, 40], flt: { t: 'bandpass', f: 1500, f2: 1100, q: 10 } });
      thump(E, d, t, 90 * r, 40 * r, 0.4, 1.2);
      nb(E, d, t, 'lowpass', 0.5, 300, 100, 0.8, 0.8, 0.02);
      crackle(E, d, t + 0.2, 0.8, 8, 0.5, 2400);
    } },
    break: { v: 0.6, len: 0.8, pri: 2, max: 2, fn: function (E, d, t, r) {
      nb(E, d, t, 'bandpass', 0.04, 2600 * r, 1800, 1.5, 0.9, 0.001);
      crackle(E, d, t + 0.02, 0.3, 6, 0.7, 1800);
      thump(E, d, t + 0.03, 130 * r, 45 * r, 0.35, 1);
      nb(E, d, t + 0.03, 'lowpass', 0.3, 700, 120, 0.8, 0.9);
      clang(E, d, t + 0.04, 310 * r, 0.4, 0.22);
    } },
    graft: { v: 0.75, len: 0.85, pri: 1, max: 2, fn: function (E, d, t, r) {
      for (var i = 0, tt; i < 3; i++) {
        tt = t + i * 0.085;
        nb(E, d, tt, 'bandpass', 0.09, (350 + i * 120) * r, (900 + i * 200) * r, 5, 0.6, 0.01);
        bubbles(E, d, tt, 1, 260 * r, 0.05, 0.25, 1);
      }
      thump(E, d, t + 0.3, 62 * r, 50 * r, 0.22, 1);
      thump(E, d, t + 0.46, 58 * r, 46 * r, 0.26, 0.85);
      nb(E, d, t + 0.3, 'lowpass', 0.15, 260, 100, 0.7, 0.6);
      tone(E, d, { t: t, f: 1800 * r, f2: 2800 * r, glide: 0.06, d: 0.07, vol: 0.08 });
    } },
    devour: { v: 0.75, len: 1.0, pri: 1, max: 1, fn: function (E, d, t, r) {
      var T = [0, 0.17, 0.31, 0.5, 0.64], i, tt;
      for (i = 0; i < T.length; i++) {
        tt = t + T[i] + E.rng() * 0.02;
        nb(E, d, tt, 'bandpass', 0.13, (300 + E.rng() * 200) * r, 120, 3, 0.8, 0.01);
        thump(E, d, tt, (170 - 10 * i) * r, 70 * r, 0.1, 0.6);
        bubbles(E, d, tt + 0.03, 2, 260 * r, 0.04, 0.25, 1);
      }
    } },
    pickup: { v: 0.6, len: 0.3, gap: 0.03, max: 3, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 196 * r, f2: 294 * r, glide: 0.08, type: 'triangle', d: 0.2, a: 0.004, vol: 0.7, flt: { t: 'lowpass', f: 1800 } });
      tone(E, d, { t: t + 0.06, f: 392 * r, d: 0.22, vol: 0.3 });
      thump(E, d, t, 120 * r, 70 * r, 0.18, 1);
      nb(E, d, t, 'bandpass', 0.04, 2200, 2200, 1.5, 0.25);
    } },
    vial: { v: 0.7, len: 0.6, max: 2, fn: function (E, d, t, r) {
      bubbles(E, d, t, 3, 220 * r, 0.09, 0.7, 1);
      tone(E, d, { t: t + 0.12, f: 2000 * r, d: 0.12, vol: 0.12 });
      nb(E, d, t, 'lowpass', 0.3, 500, 200, 1, 0.7, 0.04);
      thump(E, d, t + 0.25, 110 * r, 70 * r, 0.12, 0.7);
    } },
    coolant: { v: 0.65, len: 0.6, max: 2, fn: function (E, d, t, r) {
      nb(E, d, t, 'highpass', 0.45, 6000, 2200, 0.7, 0.5, 0.02);
      bubbles(E, d, t + 0.05, 3, 340 * r, 0.08, 0.5, -1);
      thump(E, d, t + 0.02, 120 * r, 60 * r, 0.25, 1.1);
    } },
    suture: { v: 0.72, len: 0.4, max: 2, fn: function (E, d, t, r) {
      nb(E, d, t, 'bandpass', 0.14, 3000 * r, 1200, 2, 0.6, 0.01);
      nb(E, d, t + 0.15, 'bandpass', 0.05, 500 * r, 300, 3, 0.7);
      nb(E, d, t + 0.24, 'bandpass', 0.05, 420 * r, 260, 3, 0.7);
      tone(E, d, { t: t, f: 1500 * r, f2: 2600 * r, glide: 0.12, d: 0.14, vol: 0.06 });
      nb(E, d, t + 0.14, 'lowpass', 0.16, 320, 120, 0.8, 0.8);
      thump(E, d, t + 0.15, 100 * r, 60 * r, 0.12, 0.7);
    } },
    ether: { v: 0.65, len: 0.8, max: 3, fn: function (E, d, t, r) {
      var f = 440 * r * [1, 1.2, 1.5, 1.8][Math.floor(E.rng() * 4)];
      clang(E, d, t, f, 0.6, 0.35, [1, 2.01, 3.0, 4.2], [1, 0.6, 0.35, 0.2]);
      tone(E, d, { t: t, f: 110 * r, d: 0.6, a: 0.02, vol: 0.4 });
    } },
    jar: { v: 0.7, len: 0.8, max: 2, fn: function (E, d, t, r) {
      clang(E, d, t, 1400 * r, 0.3, 0.14, [1, 2.3, 3.7]);
      nb(E, d, t + 0.08, 'lowpass', 0.3, 420, 220, 1, 0.8, 0.12);
      nb(E, d, t + 0.3, 'lowpass', 0.3, 380, 180, 1, 0.7, 0.1);
      bubbles(E, d, t + 0.1, 4, 240 * r, 0.1, 0.4, 1);
      tone(E, d, { t: t, f: 82 * r, d: 0.6, a: 0.05, vol: 0.45 });
    } },
    trap: { v: 0.7, len: 0.45, max: 3, fn: function (E, d, t, r) {
      nb(E, d, t, 'highpass', 0.05, 4000, 4000, 0.7, 0.6, 0.001);
      clang(E, d, t, 900 * r, 0.2, 0.3);
      thump(E, d, t, 130 * r, 55 * r, 0.25, 0.9);
      nb(E, d, t + 0.02, 'lowpass', 0.14, 800, 200, 0.8, 0.8);
      nb(E, d, t + 0.05, 'highpass', 0.3, 3500, 2200, 0.7, 0.25, 0.03);
    } },
    fire: { v: 0.7, len: 0.7, max: 2, fn: function (E, d, t, r) {
      nb(E, d, t, 'lowpass', 0.5, 300, 100, 0.7, 1, 0.03);
      nb(E, d, t, 'bandpass', 0.35, 400 * r, 1400, 1.5, 0.5, 0.08);
      crackle(E, d, t, 0.5, 10, 0.5, 3000);
      tone(E, d, { t: t, f: 70 * r, f2: 50 * r, glide: 0.4, type: 'sawtooth', d: 0.45, vol: 0.3, flt: { t: 'lowpass', f: 200 }, dist: true });
    } },
    gate: { v: 0.42, len: 1.0, max: 2, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 70 * r, f2: 55 * r, glide: 0.5, type: 'sawtooth', a: 0.04, dur: 0.45, r: 0.1, vol: 0.5,
        fm: [18, 6], flt: { t: 'lowpass', f: 300, q: 2 }, dist: true });
      nb(E, d, t, 'bandpass', 0.45, 500 * r, 1500, 6, 0.6, 0.05);
      clang(E, d, t + 0.42, 240 * r, 0.4, 0.5);
      thump(E, d, t + 0.42, 90 * r, 45 * r, 0.3, 0.9);
    } },
    gateWarn: { v: 0.6, len: 0.4, gap: 0.1, max: 2, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 330 * r, type: 'square', d: 0.1, vol: 0.4, flt: { t: 'lowpass', f: 900 } });
      tone(E, d, { t: t + 0.14, f: 277 * r, type: 'square', d: 0.12, vol: 0.4, flt: { t: 'lowpass', f: 800 } });
      clang(E, d, t, 600 * r, 0.12, 0.2);
      thump(E, d, t, 110 * r, 60 * r, 0.14, 0.7);
      thump(E, d, t + 0.14, 100 * r, 55 * r, 0.14, 0.6);
    } },
    stairs: { v: 0.7, len: 1.1, max: 1, fn: function (E, d, t, r) {
      for (var i = 0, tt; i < 4; i++) {
        tt = t + i * 0.11;
        thump(E, d, tt, (85 + i * 12) * r, 45 * r, 0.12, 0.8);
        nb(E, d, tt, 'lowpass', 0.08, 400 + i * 60, 140, 0.8, 0.6);
      }
      [98, 147, 196].forEach(function (f) {
        tone(E, d, { t: t + 0.3, f: f * r, wave: 'organ', a: 0.25, dur: 0.5, r: 0.3, vol: 0.22, flt: { t: 'lowpass', f: 1600 } });
      });
    } },
    enemyAttack: { v: 0.42, len: 0.55, max: 2, fn: function (E, d, t, r) {
      growl(E, d, t, 110 * r, 70 * r, 0.4, 0.6);
      nb(E, d, t + 0.1, 'bandpass', 0.2, 600, 2500, 1.2, 0.5, 0.06);
      thump(E, d, t + 0.25, 100 * r, 50 * r, 0.15, 0.5);
    } },
    enemyDie: { v: 0.5, len: 1.5, pri: 1, max: 2, fn: function (E, d, t, r) {
      growl(E, d, t, 120 * r, 45 * r, 1.0, 0.6);
      bubbles(E, d, t + 0.1, 7, 320 * r, 0.12, 0.5, -1);
      nb(E, d, t, 'lowpass', 1.0, 600, 120, 0.8, 0.9, 0.1);
      thump(E, d, t + 0.85, 70 * r, 35 * r, 0.3, 0.8);
    } },
    heal: { v: 0.45, len: 0.8, max: 2, fn: function (E, d, t, r) {
      [110, 165].forEach(function (f) {
        tone(E, d, { t: t, f: f * r, type: 'triangle', a: 0.15, dur: 0.4, r: 0.3, vol: 0.28, flt: { t: 'lowpass', f: 900 } });
      });
      bubbles(E, d, t + 0.05, 3, 300 * r, 0.09, 0.5, 1);
      nb(E, d, t + 0.1, 'highpass', 0.3, 4000, 4000, 0.7, 0.2, 0.1);
    } },
    burn: { v: 0.78, len: 0.8, max: 2, fn: function (E, d, t, r) {
      crackle(E, d, t, 0.6, 14, 0.7, 3500);
      nb(E, d, t, 'bandpass', 0.5, 2000, 700, 0.8, 0.45, 0.05);
      nb(E, d, t, 'lowpass', 0.5, 260, 100, 0.8, 0.9, 0.03);
      tone(E, d, { t: t, f: 80 * r, f2: 60 * r, glide: 0.5, type: 'sawtooth', d: 0.5, vol: 0.3, flt: { t: 'lowpass', f: 220 } });
    } },
    stun: { v: 0.7, len: 1.0, max: 2, fn: function (E, d, t, r) {
      thump(E, d, t, 80 * r, 40 * r, 0.3, 1);
      tone(E, d, { t: t + 0.03, f: 640 * r, f2: 450 * r, glide: 0.7, d: 0.8, vol: 0.25, am: [6, 0.6] });
      tone(E, d, { t: t + 0.03, f: 661 * r, f2: 465 * r, glide: 0.7, d: 0.8, vol: 0.25, am: [6, 0.6] });
      nb(E, d, t, 'bandpass', 0.12, 900, 900, 2, 0.4);
    } },
    buff: { v: 0.65, len: 0.7, max: 2, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 98 * r, f2: 196 * r, glide: 0.35, type: 'sawtooth', dets: [-8, 8], a: 0.05, dur: 0.4, r: 0.25, vol: 0.35,
        flt: { t: 'lowpass', f: 300, f2: 2400, q: 2 } });
      tone(E, d, { t: t + 0.12, f: 196 * r, wave: 'brass', a: 0.03, dur: 0.3, r: 0.2, vol: 0.3, flt: { t: 'lowpass', f: 700, f2: 2400, s: 0.2 } });
      clang(E, d, t + 0.1, 880 * r, 0.3, 0.12, [1, 2, 3]);
    } },
    debuff: { v: 0.65, len: 0.7, max: 2, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 220 * r, f2: 70 * r, glide: 0.5, type: 'sawtooth', dets: [-8, 8], a: 0.03, dur: 0.45, r: 0.15, vol: 0.35,
        flt: { t: 'lowpass', f: 1800, f2: 200, q: 3 } });
      tone(E, d, { t: t, f: 311 * r, f2: 99 * r, glide: 0.5, type: 'square', a: 0.03, dur: 0.4, r: 0.15, vol: 0.12, flt: { t: 'lowpass', f: 700 } });
      bubbles(E, d, t + 0.05, 3, 200 * r, 0.1, 0.35, -1);
      thump(E, d, t + 0.4, 70 * r, 42 * r, 0.2, 0.7);
    } },
    ui: { v: 0.45, len: 0.12, gap: 0.03, max: 3, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 560 * r, f2: 420 * r, glide: 0.04, d: 0.06, vol: 0.6 });
      nb(E, d, t, 'bandpass', 0.02, 2500, 2500, 2, 0.3, 0.001);
    } },
    uiBack: { v: 0.45, len: 0.14, gap: 0.03, max: 3, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 360 * r, f2: 240 * r, glide: 0.06, d: 0.09, vol: 0.6 });
      nb(E, d, t, 'bandpass', 0.02, 1500, 1500, 2, 0.25, 0.001);
    } },
    error: { v: 0.6, len: 0.35, gap: 0.1, max: 2, fn: function (E, d, t, r) {
      tone(E, d, { t: t, f: 150 * r, type: 'square', d: 0.09, vol: 0.4, flt: { t: 'lowpass', f: 900 }, dist: true });
      tone(E, d, { t: t + 0.11, f: 212 * r, type: 'square', d: 0.12, vol: 0.4, flt: { t: 'lowpass', f: 900 }, dist: true });
    } },
    tick: { v: 0.6, len: 0.15, gap: 0.05, max: 3, fn: function (E, d, t, r) {
      clockTick(E, d, t, 1, E.rng() < 0.5, 0);
    } },
    timeWarn: { v: 0.5, len: 1.6, pri: 2, max: 1, fn: function (E, d, t, r) {
      clang(E, d, t, 147 * r, 1.4, 0.5, BELL, BELL_A);
      [110, 82].forEach(function (f, i) {
        tone(E, d, { t: t + i * 0.2, f: f * r, wave: 'brass', a: 0.03, dur: 0.3, r: 0.2, vol: 0.3, flt: { t: 'lowpass', f: 500, f2: 1600, s: 0.15 } });
      });
    } },
    death: { v: 0.55, len: 1.8, pri: 3, max: 1, var: 0.1, fn: function (E, d, t, r) {
      thump(E, d, t, 90 * r, 22 * r, 0.9, 1);
      tone(E, d, { t: t, f: 110 * r, f2: 30 * r, glide: 1.2, type: 'sawtooth', a: 0.03, dur: 1.1, r: 0.3, vol: 0.4,
        flt: { t: 'lowpass', f: 500, f2: 60, q: 2 } });
      growl(E, d, t, 100 * r, 35 * r, 1.0, 0.5);
      bubbles(E, d, t + 0.3, 6, 280 * r, 0.11, 0.4, -1);
      nb(E, d, t, 'lowpass', 1.2, 800, 60, 0.8, 0.9, 0.05);
      [147, 175, 220].forEach(function (f) {
        tone(E, d, { t: t + 0.05, f: f * r, f2: f * r / 3, glide: 1.3, wave: 'organ', a: 0.05, dur: 1.2, r: 0.3, vol: 0.2, flt: { t: 'lowpass', f: 1200, f2: 150 } });
      });
    } },
    victory: { v: 0.7, len: 1.9, pri: 3, max: 1, var: 0.06, fn: function (E, d, t, r) {
      [[0, 110], [0.18, 165], [0.36, 220], [0.6, 277]].forEach(function (n) {
        tone(E, d, { t: t + n[0], f: n[1] * r, wave: 'brass', dets: [-6, 6], a: 0.04, dur: n[0] > 0.5 ? 0.8 : 0.25, r: 0.35, vol: 0.3,
          flt: { t: 'lowpass', f: 500, f2: 2800, s: 0.2 } });
      });
      [110, 165, 220, 277].forEach(function (f) {
        tone(E, d, { t: t + 0.6, f: f * r, wave: 'organ', a: 0.08, dur: 0.9, r: 0.4, vol: 0.2, flt: { t: 'lowpass', f: 2200 } });
      });
      clang(E, d, t + 0.6, 440 * r, 1.0, 0.25, BELL, BELL_A);
      nb(E, d, t + 0.6, 'highpass', 0.8, 5000, 5000, 0.7, 0.15, 0.05);
    } },
    explosion: { v: 0.4, len: 1.8, pri: 2, max: 1, fn: function (E, d, t, r) {
      nb(E, d, t, 'lowpass', 1.3, 3000, 80, 0.7, 1, 0.005);
      thump(E, d, t, 80 * r, 22 * r, 1.0, 1);
      nb(E, d, t, 'highpass', 0.08, 3500, 3500, 0.7, 0.6, 0.001);
      crackle(E, d, t + 0.1, 1.2, 14, 0.5, 1500);
      tone(E, d, { t: t, f: 60 * r, f2: 30 * r, glide: 0.9, type: 'sawtooth', d: 0.9, vol: 0.4, flt: { t: 'lowpass', f: 250 }, dist: true });
    } }
  };

  function playSfx(E, name, vol, t) {
    var def = SFX[name], g, r;
    if (!def) return null;
    g = E.ctx.createGain();
    g.gain.value = def.v * (vol == null ? 1 : clamp(+vol || 0, 0, 1)) * (0.92 + E.rng() * 0.16);
    g.connect(E.sfxBus);
    r = 1 + (E.rng() - 0.5) * (def.var == null ? 0.22 : def.var);
    def.fn(E, g, t, r);
    return { g: g, name: name, pri: def.pri || 0, end: t + def.len };
  }

  /* ---------- Voces musicales: fn(E, destino, t, c) con c = {fs:[Hz], vel, dur, sd, n, acc, L, pan} ---------- */
  var VOICES = {
    drone: function (E, d, t, c) {             // pedal grave: sierras desafinadas filtradas + seno
      var f = c.fs[0], cut = c.L.cut || 170, a = c.dur * 0.3, r = c.dur * 0.4;
      tone(E, d, { t: t, f: f, type: 'sawtooth', dets: [-9, 9], a: a, dur: c.dur, r: r, vol: c.vel * 0.4, flt: { t: 'lowpass', f: cut, f2: cut * 1.8, q: 1.5 } });
      tone(E, d, { t: t, f: f, a: a, dur: c.dur, r: r, vol: c.vel * 0.06 });
      tone(E, d, { t: t, f: f * 2, a: a, dur: c.dur, r: r, vol: c.vel * 0.28 });
    },
    strings: function (E, d, t, c) {           // cuerdas de sierra filtradas, el filtro se abre durante la nota
      var cut = c.L.cut || 800, a = Math.min(c.dur * 0.35, 1.4), r = Math.min(c.dur * 0.45, 1.8);
      c.fs.forEach(function (f, i) {
        tone(E, d, { t: t, f: f, type: 'sawtooth', dets: [-12, 0, 11], a: a, dur: c.dur, r: r, vol: c.vel * 0.3, pan: (i - 1) * 0.3,
          flt: { t: 'lowpass', f: cut, f2: cut * 2.2, q: 0.9 } });
      });
    },
    organ: function (E, d, t, c) {
      var r = Math.min(c.dur * 0.5, 0.7);
      c.fs.forEach(function (f, i) {
        tone(E, d, { t: t, f: f, wave: 'organ', dets: [-5, 5], a: 0.1, dur: c.dur, r: r, vol: c.vel * 0.3, flt: { t: 'lowpass', f: 2200 } });
        if (i === 0) tone(E, d, { t: t, f: f / 2, a: 0.1, dur: c.dur, r: r, vol: c.vel * 0.25 });
      });
    },
    brass: function (E, d, t, c) {             // «metales»: onda con armónicos y filtro que se abre en el ataque
      c.fs.forEach(function (f) {
        tone(E, d, { t: t, f: f, wave: 'brass', dets: [-7, 7], a: c.L.att || 0.05, dur: c.dur, r: Math.min(0.35, c.dur * 0.4), vol: c.vel * 0.48,
          flt: { t: 'lowpass', f: 450, f2: 2600, q: 1.6, s: Math.min(c.dur * 0.6, 0.45) } });
      });
    },
    choir: function (E, d, t, c) {             // coro: sierra con dos formantes vocálicos
      c.fs.forEach(function (f, i) {
        tone(E, d, { t: t, f: f, type: 'sawtooth', dets: [-9, 8], a: Math.min(c.dur * 0.4, 1.2), dur: c.dur, r: Math.min(c.dur * 0.5, 1.6),
          vol: c.vel * 0.22, pan: i % 2 ? 0.35 : -0.35,
          flt: [{ t: 'peaking', f: 650, g: 13, q: 4 }, { t: 'peaking', f: 1150, g: 10, q: 5 }, { t: 'lowpass', f: 2600 }] });
      });
    },
    bass: function (E, d, t, c) {
      var dec = c.dur * 1.4 + 0.05;
      tone(E, d, { t: t, f: c.fs[0], type: 'sawtooth', d: dec, a: 0.004, vol: c.vel * 0.5, dist: !!c.L.dist,
        flt: { t: 'lowpass', f: c.L.cut || 1100, f2: 130, q: 3, s: dec } });
      tone(E, d, { t: t, f: c.fs[0], d: dec, a: 0.004, vol: c.vel * 0.55 });
    },
    arp: function (E, d, t, c) {               // arpegio de sinte: pizzicato con filtro que cierra
      var dec = c.dur * 2 + 0.12;
      tone(E, d, { t: t, f: c.fs[0], type: c.L.type || 'sawtooth', dets: [-6, 6], d: dec, a: 0.003, vol: c.vel * 0.8, pan: c.pan,
        flt: { t: 'lowpass', f: 3800, f2: 420, q: 4, s: dec } });
    },
    timp: function (E, d, t, c) {              // timbal
      var f = c.fs[0], v = c.vel * 0.65;
      tone(E, d, { t: t, f: f * 1.12, f2: f, glide: 0.18, d: 1.1, a: 0.002, vol: v });
      tone(E, d, { t: t, f: f * 1.5, d: 0.45, a: 0.002, vol: v * 0.3 });
      tone(E, d, { t: t, f: f * 2, d: 0.3, a: 0.002, vol: v * 0.18 });
      nb(E, d, t, 'lowpass', 0.07, 600, 120, 0.8, v * 0.9, 0.001);
    },
    kick: function (E, d, t, c) {
      thump(E, d, t, 160, 42, 0.34, c.vel * 0.7);
      nb(E, d, t, 'highpass', 0.03, 1800, 1800, 0.7, c.vel * 0.25, 0.001);
    },
    snare: function (E, d, t, c) {
      nb(E, d, t, 'bandpass', 0.18, 1900, 1900, 0.9, c.vel * 0.7, 0.001);
      thump(E, d, t, 190, 140, 0.1, c.vel * 0.5);
      nb(E, d, t, 'highpass', 0.09, 6000, 6000, 0.7, c.vel * 0.25, 0.001);
    },
    hat: function (E, d, t, c) { nb(E, d, t, 'highpass', c.L.open ? 0.12 : 0.03, 7000, 7000, 0.7, c.vel * 1.1, 0.001); },
    tick: function (E, d, t, c) { clockTick(E, d, t, c.vel * 1.5, (c.n >> 2) & 1, ((c.n >> 2) & 1) ? 0.25 : -0.25); },
    gear: function (E, d, t, c) {              // engranaje: trinquete de chasquidos que se frena + clunk final
      var n = 7 + (c.n % 3), i, sp = c.dur / n, tt = t;
      for (i = 0; i < n; i++) {
        nb(E, d, tt, 'bandpass', 0.012, i % 2 ? 2200 : 3800, i % 2 ? 2200 : 3800, 6, c.vel, 0.001);
        tone(E, d, { t: tt, f: 2400, d: 0.015, a: 0.001, vol: c.vel * 0.16, pan: i % 2 ? 0.3 : -0.3 });
        tt += sp * (0.7 + i * 0.12);
      }
      clang(E, d, t + c.dur, 260, 0.18, c.vel * 0.4);
      thump(E, d, t + c.dur, 120, 70, 0.1, c.vel * 0.4);
    },
    metal: function (E, d, t, c) { clang(E, d, t, c.L.f || 440, c.L.dec || 0.3, c.vel * 0.6); },
    bell: function (E, d, t, c) { clang(E, d, t, c.fs[0], c.L.dec || 3.2, c.vel * 0.45, BELL, BELL_A); },
    drip: function (E, d, t, c) {              // gota de agua
      var f = c.fs[0];
      tone(E, d, { t: t, f: f, f2: f * 1.7, glide: 0.035, d: 0.22, a: 0.002, vol: c.vel * 0.7 });
      tone(E, d, { t: t + 0.05, f: f * 0.5, f2: f * 0.8, glide: 0.04, d: 0.15, a: 0.002, vol: c.vel * 0.2 });
    },
    heart: function (E, d, t, c) {             // latido: «lub» (X) y «dub» (x)
      var lub = c.acc > 0.9;
      thump(E, d, t, lub ? 72 : 62, lub ? 42 : 38, 0.22, c.vel * 0.85);
      nb(E, d, t, 'lowpass', 0.12, 240, 90, 0.7, c.vel * 0.5);
    },
    glug: function (E, d, t, c) { bubbles(E, d, t, 3, c.L.f || 180, c.sd * 0.6, c.vel, E.rng() < 0.5 ? 1 : -1); },
    squelch: function (E, d, t, c) {
      nb(E, d, t, 'bandpass', 0.22, 260, 720, 6, c.vel, 0.02);
      thump(E, d, t, 90, 55, 0.2, c.vel * 0.7);
    },
    rise: function (E, d, t, c) {
      noiseBurst(E, d, { t: t, a: c.dur * 0.92, dur: c.dur, r: 0.08, vol: c.vel * 0.7, flt: { t: 'bandpass', f: 300, f2: 4500, q: 2.5 } });
    }
  };

  /* ---------- Pistas: datos. Patrón = 16 pasos por compás (x normal, X acento, o fantasma, 0-9 = nota). ---------- */
  var SC = { phr: [0, 1, 3, 5, 7, 8, 10] };                 // frigia
  var CH = { m: [0, 3, 7], M: [0, 4, 7], d: [0, 3, 6], s: [0, 5, 7], p: [0, 7] };
  var BAR = 'x' + dots(15), ONE = 'x' + dots(31);
  // Capa: v voz, p patrón (su longitud divide el bucle), bars compases activos, g nivel, from tensión a la que entra,
  //       oct semitonos, tones notas del acorde que suenan a la vez, m:'s' dígitos = grados de la escala, pedal tónica fija,
  //       len pasos de duración (0 = hasta la siguiente nota), echo envío al eco, pan ancho estéreo
  var TRACKS = {
    title: { key: 38, bpm: 52, bars: 8, tempo: 0, sc: SC.phr, fade: 0.6,      // re frigio, solemne
      prog: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'm'], [5, 'm'], [10, 'M'], [1, 'M'], [7, 'p']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: -12, g: 0.4 },
        { v: 'organ', p: BAR, len: 16, tones: [0, 2], oct: 12, g: 0.5 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 1, 2], oct: 24, g: 0.55, bars: [2, 3, 4, 5, 6, 7] },
        { v: 'choir', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.5, bars: [4, 5, 6, 7] },
        { v: 'timp', p: 'X' + dots(127), oct: 12, g: 0.9 },
        { v: 'timp', p: 'X.......x.......', oct: 12, g: 0.8, bars: [4, 5, 6, 7] },
        { v: 'bell', p: 'x' + dots(63), oct: 24, g: 0.7, echo: 1 },
        { v: 'brass', p: dots(64) + '7.......5.......6.......4.......5...3...1...3...4.......3...1...', m: 's', oct: 24, len: 0, att: 0.35, g: 0.5 },
        { v: 'arp', p: '0.1.2.1.0.1.2.3.', oct: 36, g: 0.3, echo: 1, pan: 0.35, bars: [2, 3, 4, 5, 6, 7] }
      ] },
    table: { key: 36, bpm: 46, bars: 8, tempo: 0, sc: SC.phr, fade: 0.8,      // do frigio, goteo
      prog: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'm'], [8, 'M'], [1, 'M'], [0, 'm'], [6, 'd']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: -12, g: 0.35, cut: 150 },
        { v: 'strings', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.3, cut: 500 },
        { v: 'drip', p: sprinkle(128, { 5: '3', 14: '5', 22: '1', 35: '4', 41: '2', 58: '6', 63: '3', 77: '5', 84: '1', 97: '4', 103: '0', 118: '2' }),
          m: 's', oct: 36, g: 0.8, echo: 1 },
        { v: 'heart', p: sprinkle(32, { 0: 'X', 3: 'x' }), g: 0.6 },
        { v: 'bell', p: sprinkle(128, { 20: 'x', 84: 'x' }), oct: 48, dec: 2.5, g: 0.22, echo: 1 },
        { v: 'gear', p: sprinkle(128, { 38: 'x', 101: 'x' }), len: 6, g: 0.35 },
        { v: 'glug', p: sprinkle(128, { 60: 'x', 92: 'x' }), f: 150, g: 0.4 },
        { v: 'rise', p: sprinkle(128, { 112: 'x' }), len: 16, g: 0.3 }
      ] },
    explore: { key: 40, bpm: 76, bars: 8, tempo: 0.34, tense: 1, sc: SC.phr, fade: 0.5,   // mi frigio, pulso que crece
      prog: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'm'], [10, 'M'], [8, 'M'], [1, 'M'], [7, 'p']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: -12, g: 0.35 },
        { v: 'bass', p: 'X.x.x.x.x.x.x.x.X.x.x.x.x.x.xx..', g: 0.7, len: 1, cut: 700 },
        { v: 'tick', p: 'x...x...x...x...', g: 0.4 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 1, 2], oct: 24, g: 0.4, cut: 900 },
        { v: 'gear', p: sprinkle(32, { 26: 'x' }), len: 5, g: 0.35 },
        { v: 'arp', p: '0.2.1.2.0.2.3.2.', oct: 24, g: 0.35, echo: 1, pan: 0.35, from: 0.22 },
        { v: 'timp', p: 'X.......x.x.....', oct: 12, g: 0.85, from: 0.45 },
        { v: 'metal', p: '......x.......x.', f: 480, g: 0.35, from: 0.55 },
        { v: 'brass', p: 'X.....x.........', tones: [0, 2], oct: 12, len: 3, g: 0.5, from: 0.7 },
        { v: 'hat', p: 'x.x.x.x.x.x.x.x.', g: 0.4, from: 0.75 },
        { v: 'choir', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.45, from: 0.85, bars: [4, 5, 6, 7] },
        { v: 'kick', p: 'X...X...X...X...', g: 0.6, from: 0.8 }
      ] },
    combat: { key: 41, bpm: 118, bars: 8, tempo: 0.28, tense: 1, sc: SC.phr, fade: 0.12,  // fa frigio, percusivo
      prog: [[0, 'm'], [0, 'm'], [1, 'M'], [0, 'm'], [0, 'm'], [10, 'M'], [1, 'M'], [7, 'p']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: -12, g: 0.3 },
        { v: 'kick', p: 'X..x..x.X..x..x.', g: 0.9 },
        { v: 'timp', p: 'X.......x.......', g: 0.8 },
        { v: 'snare', p: '....X.......X..o', g: 0.6 },
        { v: 'tick', p: 'X.x.X.x.X.x.X.x.', g: 0.4 },
        { v: 'bass', p: 'x.x.xx.xx.x.xx.x', g: 0.6, len: 1, dist: 1, cut: 900 },
        { v: 'metal', p: sprinkle(32, { 10: 'x', 26: 'x', 30: 'x' }), f: 520, g: 0.4 },
        { v: 'gear', p: sprinkle(128, { 60: 'x', 124: 'x' }), len: 4, g: 0.4 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 2], oct: 12, g: 0.4, cut: 1400 },
        { v: 'brass', p: 'X..x..x.........', tones: [0, 2], oct: 12, len: 2, g: 0.45, bars: [4, 5, 6, 7] },
        { v: 'arp', p: '0120210301202103', oct: 24, g: 0.3, echo: 1, pan: 0.35, from: 0.2 },
        { v: 'brass', p: 'X..x..x.........', tones: [0, 2], oct: 12, len: 2, g: 0.45, from: 0.5, bars: [0, 1, 2, 3] },
        { v: 'choir', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.45, from: 0.4, bars: [4, 5, 6, 7] },
        { v: 'hat', p: 'x.xxx.xxx.xxx.xx', g: 0.4, from: 0.6 }
      ] },
    harvest: { key: 33, bpm: 58, bars: 8, tempo: 0.18, tense: 1, sc: SC.phr, fade: 0.4,   // la frigio, grave y carnal
      prog: [[0, 'm'], [1, 'M'], [0, 'm'], [10, 'M'], [0, 'm'], [8, 'M'], [1, 'M'], [0, 's']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: 0, g: 0.4, cut: 140 },
        { v: 'heart', p: 'X..x............', g: 0.9 },
        { v: 'glug', p: sprinkle(64, { 6: 'x', 21: 'x', 40: 'x', 52: 'x' }), f: 170, g: 0.5 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 1, 2], oct: 12, g: 0.45, cut: 500 },
        { v: 'organ', p: BAR, len: 16, tones: [0, 2], oct: 12, g: 0.4, bars: [4, 5, 6, 7] },
        { v: 'squelch', p: sprinkle(64, { 38: 'x' }), g: 0.5 },
        { v: 'tick', p: 'x...x...x...x...', g: 0.25, from: 0.3 },
        { v: 'timp', p: 'X' + dots(31), g: 0.8, from: 0.4 },
        { v: 'metal', p: sprinkle(64, { 44: 'x' }), f: 380, g: 0.3, from: 0.6 }
      ] },
    death: { key: 38, bpm: 46, bars: 4, tempo: 0, sc: SC.phr, fade: 0.25,      // re, descendente
      prog: [[0, 'm'], [-2, 'M'], [-4, 'M'], [-5, 's']],
      layers: [
        { v: 'drone', p: 'x' + dots(63), len: 64, pedal: 1, oct: -12, g: 0.45 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 1, 2], oct: 24, g: 0.55, cut: 600 },
        { v: 'choir', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.5 },
        { v: 'strings', p: '7.......6.......5.......4.......3.......2.......1.......0.......', m: 's', oct: 24, len: 0, g: 0.5, cut: 1000 },
        { v: 'bell', p: BAR, oct: 24, g: 0.7, echo: 1 },
        { v: 'timp', p: sprinkle(64, { 0: 'X', 32: 'x' }), oct: 0, g: 0.9 },
        { v: 'heart', p: sprinkle(64, { 32: 'X', 35: 'x' }), g: 0.6 }
      ] },
    win: { key: 38, bpm: 70, bars: 8, tempo: 0, sc: SC.phr, fade: 0.5,         // alivio sombrío (menor) -> luz (mayor)
      prog: [[0, 'm'], [8, 'M'], [5, 'm'], [7, 'M'], [0, 'M'], [5, 'M'], [2, 'm'], [7, 's']],
      layers: [
        { v: 'drone', p: ONE, len: 32, pedal: 1, oct: -12, g: 0.35 },
        { v: 'strings', p: BAR, len: 16, tones: [0, 1, 2], oct: 24, g: 0.5, cut: 900 },
        { v: 'organ', p: BAR, len: 16, tones: [0, 2], oct: 12, g: 0.45, bars: [0, 1, 2, 3] },
        { v: 'timp', p: 'X' + dots(63), oct: 12, g: 0.8 },
        { v: 'choir', p: BAR, len: 16, tones: [1, 2], oct: 24, g: 0.55, bars: [4, 5, 6, 7] },
        { v: 'arp', p: '0.1.2.1.0.1.2.3.', type: 'triangle', oct: 36, g: 0.4, echo: 1, pan: 0.35, bars: [4, 5, 6, 7] },
        { v: 'brass', p: sprinkle(128, { 64: '2', 72: '3', 80: '2', 92: '0', 96: '1', 104: '2', 112: '2', 120: '0' }), oct: 24, len: 0, att: 0.2, g: 0.45, bars: [4, 5, 6, 7] },
        { v: 'bell', p: sprinkle(128, { 64: 'x', 80: 'x', 96: 'x', 112: 'x' }), oct: 36, dec: 2.5, g: 0.35, echo: 1, bars: [4, 5, 6, 7] }
      ] }
  };

  /* ---------- Secuenciador ---------- */
  function chordNote(tones, i) { return tones[i % tones.length] + 12 * Math.floor(i / tones.length); }

  function layerNotes(D, L, ch, chord) {                   // notas (Hz) de una pulsación
    var base = D.key + (L.pedal ? 0 : chord[0]) + (L.oct || 0), tones = CH[chord[1]], out = [], i;
    if (L.tones) for (i = 0; i < L.tones.length; i++) out.push(mtof(base + chordNote(tones, L.tones[i])));
    else if (ch >= '0' && ch <= '9') {
      i = +ch;
      out.push(mtof(L.m === 's' ? D.key + (L.oct || 0) + D.sc[i % 7] + 12 * Math.floor(i / 7) : base + chordNote(tones, i)));
    } else out.push(mtof(base));
    return out;
  }

  function playStep(E, inst, gs, t, T) {                   // gs = paso dentro del bucle
    var D = inst.def, bar = gs >> 4, sd = 15 / (D.bpm * (1 + D.tempo * T)), li, L, ch, gate, k, len, acc;
    for (li = 0; li < D.layers.length; li++) {
      L = D.layers[li]; ch = L.p.charAt(gs % L.p.length);
      if (ch === '.' || (L.bars && L.bars.indexOf(bar) < 0)) continue;
      gate = L.from ? clamp((T - L.from) / 0.2, 0, 1) : 1;
      if (gate < 0.03) continue;
      acc = ch === 'X' ? 1 : (ch === 'o' ? 0.4 : 0.8);
      len = L.len == null ? 1 : L.len;
      if (len === 0) { len = 16; for (k = 1; k <= 64; k++) if (L.p.charAt((gs + k) % L.p.length) !== '.') { len = k; break; } }
      VOICES[L.v](E, L.echo ? inst.wet : inst.fade, t, {
        L: L, fs: layerNotes(D, L, ch, D.prog[bar]), vel: (L.g == null ? 1 : L.g) * gate * acc * (0.88 + 0.12 * hash(gs * 31 + li)),
        dur: len * sd, sd: sd, n: gs, acc: acc, pan: L.pan ? (gs & 1 ? L.pan : -L.pan) : 0
      });
    }
  }

  function newInst(E, name, t0, instant) {
    var c = E.ctx, inst = { name: name, def: TRACKS[name], step: 0, next: t0, srcs: [], dead: 0 }, tc = inst.def.fade || FADE_TC;
    inst.fade = c.createGain(); inst.wet = c.createGain(); inst.send = c.createGain();
    inst.wet.connect(inst.fade); inst.wet.connect(inst.send); inst.send.connect(E.echoIn); inst.fade.connect(E.musicBus);
    if (instant) { inst.fade.gain.value = 1; inst.send.gain.value = ECHO_SEND; }
    else {
      inst.fade.gain.value = 0; inst.send.gain.value = 0;
      inst.fade.gain.setTargetAtTime(1, t0, tc); inst.send.gain.setTargetAtTime(ECHO_SEND, t0, tc);
    }
    return inst;
  }

  function runSteps(E, inst, until) {                      // programa los pasos que caen antes de «until»
    var D = inst.def, now = E.ctx.currentTime, srcs = inst.srcs, rng = E.rng, loop = D.bars * 16, i, k = 0, T;
    for (i = 0; i < srcs.length; i++) if (srcs[i].ddEnd > now) srcs[k++] = srcs[i];
    srcs.length = k;
    if (inst.next < now - 0.1) inst.next = now + 0.03;     // tras un atasco no se recuperan notas pasadas
    E.sink = srcs;
    try {
      while (inst.next < until) {
        T = D.tense ? clamp(E.tensionFn ? E.tensionFn(inst.next) : E.tension, 0, 1) : 0;
        E.rng = lcg(hash(inst.step % loop) * 4294967296);   // azar por paso: el bucle se repite idéntico
        playStep(E, inst, inst.step % loop, inst.next, T);
        inst.next += 15 / (D.bpm * (1 + D.tempo * T));
        inst.step++;
      }
    } finally { E.sink = null; E.rng = rng; }
  }

  function fadeOut(inst, now, tc) {
    [inst.fade.gain, inst.send.gain].forEach(function (p) { p.cancelScheduledValues(now); p.setTargetAtTime(0, now, tc); });
  }
  function release(inst, now) {                            // libera fuentes y nodos de una pista ya muda
    var i, s;
    for (i = 0; i < inst.srcs.length; i++) { s = inst.srcs[i]; if (s.ddEnd > now) { try { s.stop(now + 0.02); } catch (e) { /* ya parada */ } } }
    inst.srcs.length = 0;
    try { inst.fade.disconnect(); inst.wet.disconnect(); inst.send.disconnect(); } catch (e2) { /* ya desconectada */ }
  }

  /* ---------- Gestor en tiempo real ---------- */
  var ctx = null, E = null, dead = false, wanted = null, tension = 0, localMuted = false, applied = null;
  var cur = null, old = [], live = [], last = {}, timer = null;

  function isMuted() { return DD.save && typeof DD.save.mute === 'boolean' ? DD.save.mute : localMuted; }
  function ready() { return !!(E && ctx && !dead); }

  function ensureTimer() { if (!timer) timer = setInterval(pump, PUMP_MS); }

  function pump() {
    try {
      var now, i;
      if (!ready()) return;
      syncMute();
      if (isMuted() || ctx.state !== 'running') return;
      now = ctx.currentTime;
      for (i = old.length - 1; i >= 0; i--) if (old[i].dead <= now) { release(old[i], now); old.splice(i, 1); }
      if (cur) runSteps(E, cur, now + LOOK);
      for (i = live.length - 1; i >= 0; i--) if (live[i].end < now) live.splice(i, 1);
      if (!cur && !old.length) { clearInterval(timer); timer = null; }
    } catch (e) { /* el audio nunca debe romper el juego */ }
  }

  function switchTrack(name) {
    var now = ctx.currentTime;
    if (cur) { fadeOut(cur, now, FADE_TC); cur.dead = now + FADE_END; old.push(cur); cur = null; }
    while (old.length > MAX_TRACKS - 1) { fadeOut(old[0], now, 0.01); release(old[0], now + 0.05); old.shift(); }
    if (name) cur = newInst(E, name, now + 0.06, false);
    ensureTimer();
  }

  function killAll() {                                     // silencio inmediato (mute)
    var now = ctx.currentTime, i;
    old.concat(cur ? [cur] : []).forEach(function (p) { fadeOut(p, now, 0.01); release(p, now + 0.05); });
    cur = null; old = [];
    for (i = 0; i < live.length; i++) live[i].g.gain.setTargetAtTime(0, now, 0.01);
    live = [];
  }

  function syncMute() {                                    // aplica el estado de mute (también si lo cambia el guardado)
    var m = isMuted(), now;
    if (!E || m === applied) return;
    applied = m; now = ctx.currentTime;
    E.master.gain.cancelScheduledValues(now);
    E.master.gain.setTargetAtTime(m ? 0 : MASTER, now, 0.015);
    if (m) killAll();
    else if (wanted && !cur) switchTrack(wanted);
  }

  function init() {
    try {
      if (dead) return;
      if (!ctx) {
        if (!AC) { dead = true; return; }
        try { ctx = new AC(); E = createEngine(ctx); } catch (e) { ctx = E = null; dead = true; return; }
        E.tension = tension;
        if (ctx.addEventListener) ctx.addEventListener('statechange', pump);
      }
      if (ctx.state !== 'running' && ctx.resume) { var p = ctx.resume(); if (p && p.catch) p.catch(function () { /* sin gesto aún */ }); }
      syncMute();
    } catch (e3) { /* silencio */ }
  }

  function music(name) {
    try {
      name = name && TRACKS[name] ? name : null;
      if (name === wanted) return;                         // misma pista: no reiniciar
      wanted = name;
      if (ready() && !isMuted()) switchTrack(name);
    } catch (e) { /* silencio */ }
  }

  function setTension(x) {
    tension = clamp(+x || 0, 0, 1);
    if (E) E.tension = tension;
  }

  function sfx(name, vol) {
    try {
      var def = SFX[name], now, i, n = 0, lo = null, inst;
      if (!def || !ready()) return;
      syncMute();
      if (isMuted() || ctx.state !== 'running') return;
      now = ctx.currentTime;
      if (last[name] != null && now - last[name] < (def.gap == null ? 0.03 : def.gap)) return;
      for (i = live.length - 1; i >= 0; i--) {
        if (live[i].end < now) { live.splice(i, 1); continue; }
        if (live[i].name === name) n++;
        if (!lo || live[i].pri < lo.pri) lo = live[i];
      }
      if (n >= (def.max || 3)) return;
      if (live.length >= MAX_SFX) {                        // límite de voces: solo entra quien pese más que la más débil
        if (!lo || (def.pri || 0) <= lo.pri) return;
        lo.g.gain.setTargetAtTime(0, now, 0.015); live.splice(live.indexOf(lo), 1);
      }
      inst = playSfx(E, name, vol, now + 0.005);
      if (inst) { live.push(inst); last[name] = now; }
    } catch (e) { /* silencio */ }
  }

  function setMuted(b) {
    localMuted = !!b;
    if (DD.save) DD.save.mute = localMuted;
    try { syncMute(); } catch (e) { /* silencio */ }
  }
  function toggleMute() { setMuted(!isMuted()); return isMuted(); }

  function stats() {                                       // para verificación: estado interno acotado
    var srcs = cur ? cur.srcs.length : 0;
    old.forEach(function (p) { srcs += p.srcs.length; });
    return { state: ctx ? ctx.state : null, dead: dead, track: cur ? cur.name : null, fading: old.length, sfx: live.length, musicSources: srcs };
  }

  if (typeof document !== 'undefined' && document.addEventListener) {
    document.addEventListener('visibilitychange', function () {   // pestaña oculta: el contexto se suspende (el planificador no se retrasa)
      try {
        if (!ctx) return;
        var p = document.hidden ? ctx.suspend() : (isMuted() ? null : ctx.resume());
        if (p && p.catch) p.catch(function () { /* sin gesto */ });
      } catch (e) { /* silencio */ }
    });
  }

  DD.Audio = {
    init: init, music: music, setTension: setTension, sfx: sfx, setMuted: setMuted, toggleMute: toggleMute,
    create: createEngine, stats: stats, tracks: Object.keys(TRACKS), sfxNames: Object.keys(SFX)
  };
  Object.defineProperty(DD.Audio, 'muted', { get: isMuted, set: setMuted, enumerable: true });
})();
