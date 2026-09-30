/*
 * DD.Core — main loop, scene stack, input, meta save, run state and shared game rules.
 *
 * Scene contract (register with DD.Core.registerScene(name, scene)):
 *   {
 *     ticksClock?: bool,  // the run clock runs while this scene is on top; `menu` pushes 'pause'
 *     touchPad?: bool,    // show the on-screen d-pad (touch devices) while this scene is on top
 *     enter(params),      // called by go() / push()
 *     exit(),             // called when the scene leaves the stack
 *     update(dt),         // only the top scene updates; read DD.Core.input / DD.Core.pointer here
 *     draw(ctx),          // every scene on the stack draws, bottom to top
 *     resume?()           // called on the scene below after pop()
 *   }
 */
(function () {
  window.DD = window.DD || {};

  const W = 384, H = 216;
  const META_KEY = 'deadlockdeck.meta.v1';
  const DT_MAX = 0.05;
  const REPEAT_DELAY = 0.35, REPEAT_RATE = 0.12;
  const PAD_DEADZONE = 0.5;
  const TOAST_SECS = 2, TOAST_VISIBLE = 3, TOAST_QUEUE = 6;
  const ACTIONS = ['up', 'down', 'left', 'right', 'confirm', 'cancel', 'menu'];
  const KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Enter: 'confirm', NumpadEnter: 'confirm', Space: 'confirm', KeyZ: 'confirm',
    Escape: 'menu', KeyP: 'menu', KeyX: 'cancel', Backspace: 'cancel'
  };
  // Standard gamepad mapping: A, B, Start, d-pad.
  const PAD_BUTTONS = { confirm: 0, cancel: 1, menu: 9, up: 12, down: 13, left: 14, right: 15 };

  const has = (obj, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(obj, k);
  const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

  // ---------------------------------------------------------------- scenes

  const scenes = {};
  const stack = [];                                   // [{ name, scene }]
  const top = () => stack[stack.length - 1] || null;

  // ---------------------------------------------------------------- input state

  const keysDown = new Set();
  let tapped = {};                                    // presses since last frame (catches taps shorter than a frame)
  const held = {}, pressed = {}, repeated = {}, repeatTimer = {};
  let padHeld = {}, touchHeld = {};
  let touchMode = false;
  let screenEl, dpadEl, pauseEl;
  let dpadPointer = null, canvasPointer = null;

  const input = {
    held: a => !!held[a],
    pressed: a => !!pressed[a],
    repeat: a => !!repeated[a]
  };
  const pointer = { x: 0, y: 0, down: false, pressed: false, released: false };

  // ---------------------------------------------------------------- effects state

  let toasts = [];                                    // [{ text, color, t }]
  let shakeMag = 0, shakeT = 0, shakeDur = 1;
  let uid = 0;
  let last = 0;

  // ---------------------------------------------------------------- meta save

  function loadMeta() {
    const m = {
      blueprints: [], essence: 0, skins: { classic: true }, skin: 'classic',
      runs: 0, escapes: 0, bestTime: 0,
      volumes: { master: 0.8, music: 0.6, sfx: 0.9 }, muted: false
    };
    let raw = null;
    try { raw = JSON.parse(localStorage.getItem(META_KEY)); } catch (e) { /* missing or corrupt save: defaults */ }
    if (!raw || typeof raw !== 'object') return m;

    const count = v => (Number.isFinite(v) && v >= 0 ? Math.floor(v) : 0);
    if (Array.isArray(raw.blueprints)) {
      raw.blueprints.forEach(id => { if (has(DD.Data.LIMBS, id) && m.blueprints.indexOf(id) < 0) m.blueprints.push(id); });
    }
    if (raw.skins && typeof raw.skins === 'object') {
      Object.keys(DD.Data.SKINS).forEach(id => { if (raw.skins[id] === true) m.skins[id] = true; });
    }
    if (has(m.skins, raw.skin)) m.skin = raw.skin;
    m.essence = count(raw.essence);
    m.runs = count(raw.runs);
    m.escapes = count(raw.escapes);
    m.bestTime = Number.isFinite(raw.bestTime) && raw.bestTime > 0 ? raw.bestTime : 0;
    if (raw.volumes && typeof raw.volumes === 'object') {
      Object.keys(m.volumes).forEach(k => { if (Number.isFinite(raw.volumes[k])) m.volumes[k] = clamp(raw.volumes[k], 0, 1); });
    }
    m.muted = raw.muted === true;
    return m;
  }

  // ---------------------------------------------------------------- page shell

  function fit() {
    const dpr = window.devicePixelRatio || 1;
    let s = Math.min(screenEl.clientWidth * dpr / W, screenEl.clientHeight * dpr / H);
    if (s >= 2) s = Math.floor(s);                    // crisp integer scale in device pixels when possible
    Core.canvas.style.width = (W * s / dpr) + 'px';
    Core.canvas.style.height = (H * s / dpr) + 'px';
  }

  function toggleMute() {
    const m = !DD.Audio.isMuted();
    DD.Audio.mute(m);
    Core.meta.muted = m;
    Core.saveMeta();
    Core.toast(m ? 'Sonido silenciado' : 'Sonido activado', 'parch');
  }

  function toggleFullscreen() {
    const d = document;
    if (d.fullscreenElement) {
      if (d.exitFullscreen) d.exitFullscreen().catch(() => {});
    } else if (d.documentElement.requestFullscreen) {
      d.documentElement.requestFullscreen().catch(() => {});
    }
  }

  function autoPause() {
    const t = top();
    if (Core.run && t && t.scene.ticksClock) Core.push('pause');
  }

  // ---------------------------------------------------------------- input

  function setPointer(e) {
    const r = Core.canvas.getBoundingClientRect();
    pointer.x = Math.floor((e.clientX - r.left) * W / r.width);
    pointer.y = Math.floor((e.clientY - r.top) * H / r.height);
  }

  // Direction from the finger position relative to the pad center; sliding changes direction.
  function steer(e) {
    const r = dpadEl.getBoundingClientRect();
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
    const dead = r.width / 8;
    touchHeld = {
      left: dx < -dead && -dx >= Math.abs(dy) / 2,
      right: dx > dead && dx >= Math.abs(dy) / 2,
      up: dy < -dead && -dy >= Math.abs(dx) / 2,
      down: dy > dead && dy >= Math.abs(dx) / 2
    };
    showDpad();
  }

  function clearDpad() {
    dpadPointer = null;
    touchHeld = {};
    showDpad();
  }

  function showDpad() {
    dpadEl.querySelectorAll('[data-act]').forEach(el => el.classList.toggle('on', !!touchHeld[el.dataset.act]));
  }

  function setupInput() {
    const canvas = Core.canvas;
    const unlock = () => DD.Audio.init();
    ['keydown', 'pointerdown', 'touchstart', 'touchend'].forEach(t => window.addEventListener(t, unlock, true));

    window.addEventListener('keydown', e => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      touchMode = false;
      const a = KEYMAP[e.code];
      if (a) {
        e.preventDefault();
        keysDown.add(e.code);
        if (!e.repeat) tapped[a] = true;
      } else if (e.code === 'KeyM') {
        e.preventDefault();
        if (!e.repeat) toggleMute();
      } else if (e.code === 'KeyF') {
        e.preventDefault();
        if (!e.repeat) toggleFullscreen();
      }
    });
    window.addEventListener('keyup', e => keysDown.delete(e.code));
    window.addEventListener('blur', () => keysDown.clear());

    canvas.addEventListener('pointerdown', e => {
      if (e.pointerType === 'touch') touchMode = true;
      if (canvasPointer !== null || (e.pointerType === 'mouse' && e.button !== 0)) return;
      canvasPointer = e.pointerId;
      canvas.setPointerCapture(e.pointerId);
      setPointer(e);
      pointer.down = true;
      pointer.pressed = true;
    });
    canvas.addEventListener('pointermove', e => {
      if (e.pointerId === canvasPointer || (canvasPointer === null && e.pointerType === 'mouse')) setPointer(e);
    });
    const release = e => {
      if (e.pointerId !== canvasPointer) return;
      canvasPointer = null;
      setPointer(e);
      pointer.down = false;
      pointer.released = true;
    };
    canvas.addEventListener('pointerup', release);
    canvas.addEventListener('pointercancel', release);

    dpadEl.addEventListener('pointerdown', e => {
      touchMode = true;
      if (dpadPointer !== null) return;
      dpadPointer = e.pointerId;
      dpadEl.setPointerCapture(e.pointerId);
      steer(e);
    });
    dpadEl.addEventListener('pointermove', e => { if (e.pointerId === dpadPointer) steer(e); });
    const lift = e => { if (e.pointerId === dpadPointer) clearDpad(); };
    dpadEl.addEventListener('pointerup', lift);
    dpadEl.addEventListener('pointercancel', lift);

    pauseEl.addEventListener('pointerdown', e => {
      e.preventDefault();
      touchMode = true;
      tapped.menu = true;
    });

    // No page scroll, bounce, pinch zoom or long-press menus.
    document.addEventListener('contextmenu', e => e.preventDefault());
    document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });
    document.addEventListener('gesturestart', e => e.preventDefault());
    document.addEventListener('visibilitychange', () => {
      keysDown.clear();
      if (document.hidden) autoPause();
    });
  }

  function pollGamepads() {
    const prev = padHeld;
    padHeld = {};
    let pads = [];
    try { pads = navigator.getGamepads ? navigator.getGamepads() : []; } catch (e) { /* gamepads not allowed here */ }
    for (let i = 0; i < pads.length; i++) {
      const gp = pads[i];
      if (!gp || !gp.connected) continue;
      ACTIONS.forEach(a => {
        const b = gp.buttons[PAD_BUTTONS[a]];
        if (b && b.pressed) padHeld[a] = true;
      });
      const ax = gp.axes[0] || 0, ay = gp.axes[1] || 0;
      if (ax < -PAD_DEADZONE) padHeld.left = true;
      if (ax > PAD_DEADZONE) padHeld.right = true;
      if (ay < -PAD_DEADZONE) padHeld.up = true;
      if (ay > PAD_DEADZONE) padHeld.down = true;
    }
    if (ACTIONS.some(a => padHeld[a] && !prev[a])) {
      touchMode = false;
      DD.Audio.init();
    }
  }

  function pollInput(dt) {
    pollGamepads();
    const keyHeld = {};
    keysDown.forEach(code => { keyHeld[KEYMAP[code]] = true; });
    ACTIONS.forEach(a => {
      const h = !!(keyHeld[a] || padHeld[a] || touchHeld[a]);
      const p = !!tapped[a] || (h && !held[a]);
      let r = p;
      if (p) {
        repeatTimer[a] = REPEAT_DELAY;
      } else if (h) {
        repeatTimer[a] -= dt;
        if (repeatTimer[a] <= 0) { repeatTimer[a] += REPEAT_RATE; r = true; }
      }
      held[a] = h;
      pressed[a] = p;
      repeated[a] = r;
    });
  }

  function updateTouchUi() {
    const t = top(), s = t && t.scene;
    const pad = !!(touchMode && s && s.touchPad);
    const pause = !!(touchMode && s && s.ticksClock && Core.run);
    if (dpadEl.hidden === pad) {
      dpadEl.hidden = !pad;
      if (!pad) clearDpad();
    }
    if (pauseEl.hidden === pause) pauseEl.hidden = !pause;
  }

  // ---------------------------------------------------------------- loop

  function tickClock(dt) {
    const run = Core.run;
    const minute = Math.floor(run.time / 60);
    run.time += dt;
    run.timeLeft -= dt;
    DD.Audio.setTension(clamp(run.time / DD.Data.CONST.RUN_SECONDS, 0, 1));
    if (Math.floor(run.time / 60) > minute) DD.Audio.sfx('bell');
    if (run.timeLeft <= 0) {
      run.timeLeft = 0;
      Core.endRun('timeout');
    }
  }

  function updateFx(dt) {
    shakeT = Math.max(0, shakeT - dt);
    const n = Math.min(TOAST_VISIBLE, toasts.length);
    for (let i = 0; i < n; i++) toasts[i].t += dt;
    toasts = toasts.filter(t => t.t < TOAST_SECS);
  }

  function drawToasts(ctx) {
    const n = Math.min(TOAST_VISIBLE, toasts.length);
    for (let i = 0; i < n; i++) {
      const t = toasts[i];
      const y = 24 + i * 11;
      const w = DD.Art.textWidth(t.text, 1) + 8;
      ctx.globalAlpha = Math.min(1, (TOAST_SECS - t.t) / 0.3);
      ctx.fillStyle = 'rgba(13, 10, 18, 0.8)';
      ctx.fillRect(Math.round((W - w) / 2), y - 2, w, 11);
      DD.Art.text(ctx, t.text, W / 2, y, t.color, 1, 'center', null);
    }
    ctx.globalAlpha = 1;
  }

  function draw() {
    const ctx = Core.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, W, H);
    if (shakeT > 0) {
      const k = shakeMag * shakeT / shakeDur;
      ctx.translate(Math.round((Math.random() * 2 - 1) * k), Math.round((Math.random() * 2 - 1) * k));
    }
    stack.forEach(e => {
      ctx.save();
      e.scene.draw(ctx);
      ctx.restore();
    });
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    drawToasts(ctx);
  }

  function frame(ts) {
    const dt = clamp((ts - last) / 1000, 0, DT_MAX);
    last = ts;
    pollInput(dt);

    const entry = top();
    if (entry) entry.scene.update(dt);
    const now = top();
    if (Core.run && now && now.scene.ticksClock) tickClock(dt);
    // Only when the same ticking scene is still on top, so a menu press that closed 'pause' does not reopen it.
    if (Core.run && entry && entry === top() && entry.scene.ticksClock && pressed.menu) Core.push('pause');

    updateFx(dt);
    draw();
    updateTouchUi();
    tapped = {};
    pointer.pressed = false;
    pointer.released = false;
    requestAnimationFrame(frame);
  }

  // ---------------------------------------------------------------- run helpers

  // Recompute max HP after the body changed: growth also heals, shrink clamps.
  function refreshMaxHp() {
    const p = Core.run.player, before = p.maxHp;
    p.maxHp = Core.getStats().maxHp;
    if (p.maxHp > before) p.hp += p.maxHp - before;
    p.hp = Math.min(p.hp, p.maxHp);
  }

  function eachLimb(slot, fn) {
    if (!Core.run) return;
    const limbs = Core.run.player.limbs;
    (slot ? [slot] : DD.Data.SLOTS).forEach(s => { if (limbs[s]) fn(limbs[s]); });
  }

  // ---------------------------------------------------------------- public API

  const Core = {
    W, H, canvas: null, ctx: null,
    input, pointer,
    meta: null,
    run: null,
    lastRun: null,

    boot() {
      Core.canvas = document.getElementById('game');
      Core.ctx = Core.canvas.getContext('2d');
      Core.ctx.imageSmoothingEnabled = false;
      screenEl = document.getElementById('screen');
      dpadEl = document.getElementById('dpad');
      pauseEl = document.getElementById('pause-btn');
      fit();
      window.addEventListener('resize', fit);
      touchMode = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      setupInput();

      Core.meta = loadMeta();
      DD.Audio.setVolumes(Object.assign({}, Core.meta.volumes));
      DD.Audio.mute(Core.meta.muted);

      Core.go('title');
      last = performance.now();
      requestAnimationFrame(frame);
    },

    // ---- scenes

    registerScene(name, scene) {
      scenes[name] = scene;
    },

    go(name, params) {
      while (stack.length) {
        const e = stack.pop();
        if (e.scene.exit) e.scene.exit();
      }
      Core.push(name, params);
    },

    push(name, params) {
      const scene = scenes[name];
      if (!scene) throw new Error('Unknown scene: ' + name);
      stack.push({ name, scene });
      scene.enter(params);
    },

    pop() {
      const e = stack.pop();
      if (e && e.scene.exit) e.scene.exit();
      const below = top();
      if (below && below.scene.resume) below.scene.resume();
    },

    sceneName() {
      const t = top();
      return t ? t.name : null;
    },

    // ---- meta

    saveMeta() {
      try { localStorage.setItem(META_KEY, JSON.stringify(Core.meta)); } catch (e) { /* storage unavailable: keep in memory */ }
    },

    discover(bpId) {
      const m = Core.meta;
      if (!has(DD.Data.LIMBS, bpId) || m.blueprints.indexOf(bpId) >= 0) return false;
      m.blueprints.push(bpId);
      if (Core.run) Core.run.found.push(bpId);
      Core.saveMeta();
      return true;
    },

    discoverRandom() {
      const left = Object.keys(DD.Data.LIMBS).filter(id => Core.meta.blueprints.indexOf(id) < 0);
      if (!left.length) return null;
      const id = left[Math.floor(Math.random() * left.length)];
      Core.discover(id);
      return id;
    },

    spendEssence(n) {
      if (!(n >= 0) || Core.meta.essence < n) return false;
      Core.meta.essence -= n;
      Core.saveMeta();
      return true;
    },

    buySkin(id) {
      if (!has(DD.Data.SKINS, id)) return false;
      if (Core.meta.skins[id]) return true;
      if (!Core.spendEssence(DD.Data.SKINS[id].cost)) return false;
      Core.meta.skins[id] = true;
      Core.saveMeta();
      return true;
    },

    equipSkin(id) {
      if (!has(Core.meta.skins, id)) return false;
      Core.meta.skin = id;
      Core.saveMeta();
      return true;
    },

    // ---- run lifecycle

    newRun() {
      Core.run = null;
      const limbs = Core.rollBaseBody();
      DD.Data.SLOTS.forEach(s => Core.discover(limbs[s].bp));
      Core.run = {
        seed: (Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0,
        time: 0, timeLeft: DD.Data.CONST.RUN_SECONDS, floor: 0,
        player: { hp: 0, maxHp: 0, block: 0, limbs },
        essence: 0, kills: 0, found: [], tower: null, bossDead: false
      };
      const p = Core.run.player;
      p.hp = p.maxHp = Core.getStats().maxHp;
      return Core.run;
    },

    startRun() {
      Core.run.tower = DD.Tower.generate(Core.run.seed);
      Core.run.floor = 0;
      Core.go('explore', { floor: 0 });
    },

    endRun(reason) {
      const run = Core.run;
      if (!run) return;                               // idempotent: the run is already over
      const bonus = reason === 'escape' ? DD.Data.CONST.ESCAPE_BONUS : 0;
      const limbs = {};
      DD.Data.SLOTS.forEach(s => { limbs[s] = run.player.limbs[s] ? run.player.limbs[s].bp : null; });
      const summary = {
        reason, timeUsed: run.time, floor: run.floor, kills: run.kills,
        essenceGained: run.essence, bonus, newBlueprints: run.found.slice(), limbs
      };

      const m = Core.meta;
      m.essence += run.essence + bonus;
      m.runs++;
      if (reason === 'escape') {
        m.escapes++;
        if (!m.bestTime || run.time < m.bestTime) m.bestTime = run.time;
      }
      Core.saveMeta();

      Core.lastRun = run;
      Core.run = null;
      DD.Audio.setTension(0);
      toasts = [];                                    // no stale toast over the end screen
      Core.go('end', summary);
    },

    // ---- body and deck

    rng(seed) {
      let a = seed >>> 0;
      const next = () => {                            // mulberry32
        a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      return {
        next,
        int: (lo, hi) => lo + Math.floor(next() * (hi - lo + 1)),
        pick: arr => arr[Math.floor(next() * arr.length)],
        chance: p => next() < p,
        shuffle(arr) {
          for (let i = arr.length - 1; i > 0; i--) {
            const j = Math.floor(next() * (i + 1));
            const tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
          }
          return arr;
        }
      };
    },

    makeLimb(bpId, frac) {
      const max = DD.Data.LIMBS[bpId].integrity;
      const f = frac === undefined ? 1 : frac;
      return { uid: ++uid, bp: bpId, integrity: clamp(Math.round(max * f), 1, max), maxIntegrity: max, heat: 0 };
    },

    rollBaseBody() {
      const limbs = {};
      DD.Data.SLOTS.forEach(slot => {
        const pool = DD.Data.commonLimbs(DD.Data.SLOT_TYPE[slot]);
        limbs[slot] = Core.makeLimb(pool[Math.floor(Math.random() * pool.length)].id);
      });
      return limbs;
    },

    rollDrops(enemyId) {
      return DD.Data.ENEMIES[enemyId].drops
        .filter(d => Math.random() < d.chance)
        .map(d => Core.makeLimb(d.limb, 0.6 + Math.random() * 0.4));
    },

    printLimb(slot, bpId) {
      const bp = DD.Data.LIMBS[bpId];
      if (!Core.run || !has(DD.Data.LIMBS, bpId) || bp.type !== DD.Data.SLOT_TYPE[slot]) return false;
      if (Core.meta.blueprints.indexOf(bpId) < 0) return false;
      if (!Core.spendEssence(DD.Data.CONST.PRINT_COST[bp.rarity])) return false;
      Core.graft(slot, Core.makeLimb(bpId));
      return true;
    },

    graft(slot, limbInst) {
      const limbs = Core.run.player.limbs, old = limbs[slot] || null;
      limbs[slot] = limbInst;
      refreshMaxHp();
      return old;
    },

    getStats() {
      const C = DD.Data.CONST, limbs = Core.run.player.limbs;
      const s = { maxHp: C.BASE_HP, energy: C.BASE_ENERGY, draw: C.BASE_DRAW, speed: 1, startBlock: 0, coolBonus: 0 };
      DD.Data.SLOTS.forEach(slot => {
        const l = limbs[slot];
        if (!l) {
          if (DD.Data.SLOT_TYPE[slot] === 'leg') s.speed -= 0.2;
          return;
        }
        const passive = DD.Data.LIMBS[l.bp].passive || {};
        Object.keys(s).forEach(k => { if (typeof passive[k] === 'number') s[k] += passive[k]; });
      });
      s.speed = Math.max(0.4, Math.round(s.speed * 100) / 100);
      return s;
    },

    buildDeck() {
      const deck = [], limbs = Core.run.player.limbs;
      DD.Data.SLOTS.forEach(slot => {
        const l = limbs[slot];
        if (l) DD.Data.LIMBS[l.bp].cards.forEach(card => deck.push({ card, slot }));
        else deck.push({ card: DD.Data.STUMP_CARD[DD.Data.SLOT_TYPE[slot]], slot });
      });
      return deck;
    },

    // ---- player HP and time

    damagePlayer(n, ignoreBlock) {
      if (!Core.run) return 0;
      const p = Core.run.player;
      let dmg = Math.max(0, n);
      if (!ignoreBlock) {
        const absorbed = Math.min(p.block, dmg);
        p.block -= absorbed;
        dmg -= absorbed;
      }
      const lost = Math.min(p.hp, dmg);
      if (lost > 0) {
        p.hp -= lost;
        Core.shake(3, 0.25);
        DD.Audio.sfx('player_hurt');
      }
      if (p.hp <= 0) Core.endRun('death');
      return lost;
    },

    healPlayer(n) {
      if (!Core.run) return 0;
      const p = Core.run.player, before = p.hp;
      p.hp = Math.min(p.maxHp, p.hp + n);
      return p.hp - before;
    },

    addTime(sec) {
      if (!Core.run) return;
      Core.run.timeLeft += sec;
      Core.toast('+' + Math.round(sec) + ' s al reloj', 'brass2');
    },

    // ---- thermal rule (3.3)

    heatLimb(slot, n) {
      const res = { overheated: false, wear: 0, broken: false };
      const l = Core.run && Core.run.player.limbs[slot];
      if (!l) return res;
      const heatMax = DD.Data.LIMBS[l.bp].heatMax;
      l.heat += Math.max(0, n);
      if (l.heat > heatMax) {
        res.wear = l.heat - heatMax;
        l.heat = heatMax;
        DD.Audio.sfx('overheat');
        res.broken = Core.wearLimb(slot, res.wear);
      }
      res.overheated = l.heat >= heatMax;
      return res;
    },

    wearLimb(slot, n) {
      const l = Core.run && Core.run.player.limbs[slot];
      if (!l) return false;
      l.integrity = Math.max(0, l.integrity - n);
      if (l.integrity > 0) return false;
      Core.breakLimb(slot);
      return true;
    },

    breakLimb(slot) {
      const limbs = Core.run && Core.run.player.limbs;
      const old = limbs && limbs[slot];
      if (!old) return null;
      limbs[slot] = null;
      refreshMaxHp();
      DD.Audio.sfx('limb_break');
      Core.toast('¡' + DD.Data.LIMBS[old.bp].name + ' se rompió!', 'blood2');
      Core.shake(4, 0.35);
      return old;
    },

    coolLimbs(amount, slot) {
      eachLimb(slot, l => { l.heat = Math.max(0, l.heat - amount); });
    },

    repairLimbs(amount, slot) {
      eachLimb(slot, l => { l.integrity = Math.min(l.maxIntegrity, l.integrity + amount); });
    },

    randomLimbSlot() {
      if (!Core.run) return null;
      const filled = DD.Data.SLOTS.filter(s => Core.run.player.limbs[s]);
      return filled.length ? filled[Math.floor(Math.random() * filled.length)] : null;
    },

    // ---- feedback

    fmtTime(sec) {
      const s = Math.max(0, Math.ceil(sec));
      return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
    },

    toast(text, colorKey) {
      toasts.push({ text: String(text), color: colorKey || 'bone', t: 0 });
      if (toasts.length > TOAST_QUEUE) toasts.splice(TOAST_VISIBLE, 1);   // drop the oldest waiting toast
    },

    shake(mag, secs) {
      const cur = shakeT > 0 ? shakeMag * shakeT / shakeDur : 0;
      if (mag < cur) return;
      shakeMag = mag;
      shakeDur = shakeT = secs || 0.25;
    }
  };

  DD.Core = Core;
})();
