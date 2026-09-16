// Rendering (320x180 pixel canvas + DOM panel) and input (keyboard, mouse, touch). Owner: UI worker.
// Spec: PRODUCT.md §7. Reads Game.G, calls Game.* actions, Sprites.*, Snd.init() and Snd.sfx('click').
const UI = {
  canvas: null,
  ctx: null,
  panel: null,

  /** Canvas palette, echoing Sprites.PAL. */
  COL: {
    bg: '#0b0710', dark: '#2a1a33', purple: '#4a2f5e', bone: '#c9b58e', boneL: '#efe6c8',
    verd: '#3f8f7c', verdL: '#7fd0b5', brass: '#b08a3a', brassL: '#e6c25a',
    blood: '#8e1b2b', red: '#d93a3a', fire: '#f08a1e', flame: '#ffd23f',
    grey: '#5a5a6a', acid: '#9ad13a', white: '#e9e2f0',
  },
  /** Slot -> accent colour for card buttons and the body strip. */
  SLOT_COL: {
    head: '#e6c25a', torso: '#7fd0b5', armL: '#d93a3a', armR: '#f08a1e', legL: '#9ad13a', legR: '#e9e2f0',
  },

  /** Grab #scene and #panel, bind input, call Snd.init() on the first gesture, start the rAF loop (Game.tick then UI.render). */
  start() {
    this.canvas = document.getElementById('scene');
    this.panel = document.getElementById('panel');
    this.ctx = this.canvas.getContext('2d');
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.textBaseline = 'top';
    this._sig = null;
    this._t = 0;
    this._errs = {};
    this._primary = null;
    this._scale = 0;
    this._fit();
    window.addEventListener('resize', () => this._fit());
    window.addEventListener('orientationchange', () => this._fit());
    window.addEventListener('keydown', (e) => this._key(e));
    // Capture phase: the audio context must be unlocked by the very first gesture, button or not.
    window.addEventListener('pointerdown', () => this._wake(), true);
    let last = 0;
    const frame = (now) => {
      const dt = last ? Math.min(0.1, (now - last) / 1000) : 0;
      last = now;
      this._t += dt;
      this._guard('tick', () => Game.tick(dt));
      this._guard('render', () => this.render());
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  },

  /** Draw the canvas scene and sync the DOM panel for Game.G.screen. */
  render() {
    const G = Game.G;
    if (!G) return;
    const ctx = this.ctx;
    ctx.imageSmoothingEnabled = false;
    ctx.textBaseline = 'top';
    ctx.fillStyle = this.COL.bg;
    ctx.fillRect(0, 0, 320, 180);
    switch (G.screen) {
      case 'title': this._sceneTitle(G); break;
      case 'table': this._sceneTable(G); break;
      case 'shop': this._sceneShop(G); break;
      case 'explore': this._sceneExplore(G); break;
      case 'combat': this._sceneCombat(G); break;
      case 'harvest': this._sceneHarvest(G); break;
      case 'death': this._sceneDeath(G); break;
      case 'escape': this._sceneEscape(G); break;
      default: this._txt('...', 160, 86, this.COL.bone, 10, 'center');
    }
    const sig = this._sigOf(G);
    if (sig !== this._sig) {
      this._sig = sig;
      this._build(G);
    }
  },

  // ------------------------------------------------------------------ input

  /** Unlock/resume the audio context from a user gesture. Snd.init is safe to call repeatedly. */
  _wake() {
    try { Snd.init(); } catch (err) { /* audio is optional */ }
  },

  /** Keyboard: WASD/arrows move, 1..5 play, E/Space end turn, Enter primary button, M mute. */
  _key(e) {
    this._wake();
    const G = Game.G;
    if (!G || e.ctrlKey || e.altKey || e.metaKey) return;
    const k = e.key;
    const onButton = e.target && e.target.tagName === 'BUTTON';
    // A focused button handles Enter and Space natively; never steal those.
    if (onButton && (k === 'Enter' || k === ' ' || k === 'Spacebar')) return;
    const dir = this._DIRS[k];
    if (dir) {
      e.preventDefault();
      if (G.screen === 'explore') this._guard('move', () => Game.move(dir));
      return;
    }
    if (k >= '1' && k <= '5') {
      e.preventDefault();
      if (G.screen === 'combat') this._guard('play', () => Game.playCard(Number(k) - 1));
      return;
    }
    if (k === 'e' || k === 'E' || k === ' ' || k === 'Spacebar') {
      e.preventDefault();
      if (G.screen === 'combat') this._guard('endTurn', () => Game.endTurn());
      return;
    }
    if (k === 'Enter') {
      e.preventDefault();
      if (this._primary && !this._primary.disabled) this._primary.click();
      return;
    }
    if (k === 'm' || k === 'M') {
      e.preventDefault();
      this._guard('mute', () => Game.toggleMute());
    }
  },

  /** Arrow/WASD key -> compass direction. */
  _DIRS: {
    ArrowUp: 'n', ArrowRight: 'e', ArrowDown: 's', ArrowLeft: 'w',
    w: 'n', W: 'n', d: 'e', D: 'e', s: 's', S: 's', a: 'w', A: 'w',
  },

  /** CSS-scale the canvas to the largest integer multiple that fits the viewport (min 1x). */
  _fit() {
    const doc = document.documentElement;
    const w = doc.clientWidth || window.innerWidth || 320;
    const h = doc.clientHeight || window.innerHeight || 180;
    // Width decides, but the panel below must stay on screen, so the height caps the multiple too.
    const byW = Math.floor((w - 16) / 320);
    const byH = Math.floor((h * 0.6) / 180);
    const scale = Math.max(1, Math.min(byW, byH));
    if (scale === this._scale) return;
    this._scale = scale;
    this.canvas.style.width = (320 * scale) + 'px';
    this.canvas.style.height = (180 * scale) + 'px';
    this.panel.style.maxWidth = (320 * scale) + 'px';
  },

  /** Run fn; report the first error of each kind once so one bad frame never kills the loop. */
  _guard(tag, fn) {
    try {
      fn();
    } catch (err) {
      const key = tag + ':' + (err && err.message);
      if (!this._errs[key]) {
        this._errs[key] = 1;
        console.error('[UI]', tag, err);
      }
    }
  },

  // --------------------------------------------------------- canvas helpers

  /** @param {string} align 'left'|'center'|'right' */
  _txt(str, x, y, col, size, align) {
    const ctx = this.ctx;
    ctx.fillStyle = col || this.COL.bone;
    ctx.font = (size || 8) + 'px "Courier New", monospace';
    ctx.textAlign = align || 'left';
    ctx.fillText(str, x, y);
    ctx.textAlign = 'left';
  },

  /** Draw a 16x16 Sprites tile, optionally scaled. */
  _tile(name, x, y, scale) {
    const s = scale || 1;
    this.ctx.drawImage(Sprites.get(name), x, y, 16 * s, 16 * s);
  },

  _box(x, y, w, h, fill, stroke) {
    const ctx = this.ctx;
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fillRect(x, y, w, h);
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    }
  },

  /** mm:ss for a float number of seconds. */
  _mmss(sec) {
    const s = Math.max(0, Math.floor(sec || 0));
    const m = Math.floor(s / 60);
    const r = s % 60;
    return m + ':' + (r < 10 ? '0' : '') + r;
  },

  /** A row of fire tiles along the bottom edge, bobbing with time. */
  _flames(y, alpha, step) {
    const ctx = this.ctx;
    const fire = Sprites.get('fire');
    ctx.globalAlpha = Math.max(0.15, Math.min(1, alpha));
    for (let x = -8; x < 320; x += (step || 16)) {
      const bob = Math.round(Math.sin(this._t * 5 + x * 0.35) * 2);
      ctx.drawImage(fire, x, y + bob);
    }
    ctx.globalAlpha = 1;
  },

  /** Burning frame around the scene; intensity 0..1, pulsing red when the clock is short. */
  _frame(intensity, danger) {
    const ctx = this.ctx;
    const i = Math.max(0, Math.min(1, intensity));
    const pulse = danger ? 0.55 + 0.45 * Math.sin(this._t * 7) : 1;
    ctx.globalAlpha = (0.25 + 0.65 * i) * pulse;
    ctx.strokeStyle = danger ? this.COL.red : this.COL.fire;
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, 317, 177);
    ctx.globalAlpha = (0.15 + 0.5 * i) * pulse;
    ctx.strokeStyle = danger ? this.COL.blood : this.COL.flame;
    ctx.lineWidth = 1;
    ctx.strokeRect(4.5, 4.5, 311, 171);
    ctx.globalAlpha = 1;
    const fire = Sprites.get('fire');
    const alpha = (0.2 + 0.8 * i) * pulse;
    ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));
    for (let x = -8; x < 320; x += 48) {
      const bob = Math.round(Math.sin(this._t * 5 + x * 0.3) * 2);
      ctx.drawImage(fire, x, 164 + bob);
      ctx.drawImage(fire, x + 24, -6 - bob);
    }
    ctx.globalAlpha = 1;
  },

  /** The anatomical clock: analog face with a bone hand, plus mm:ss under it. */
  _clock(cx, cy, r, timeLeft, danger) {
    const ctx = this.ctx;
    const total = DATA.RUN_SECONDS || 360;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = '#140c1c';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = danger ? this.COL.red : this.COL.brass;
    ctx.stroke();
    ctx.lineWidth = 1;
    ctx.strokeStyle = this.COL.purple;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      ctx.beginPath();
      ctx.moveTo(cx + Math.sin(a) * (r - 5), cy - Math.cos(a) * (r - 5));
      ctx.lineTo(cx + Math.sin(a) * (r - 2), cy - Math.cos(a) * (r - 2));
      ctx.stroke();
    }
    const frac = Math.max(0, Math.min(1, (timeLeft || 0) / total));
    const a = (1 - frac) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(a) * (r - 7), cy - Math.cos(a) * (r - 7));
    ctx.lineWidth = 2;
    ctx.strokeStyle = danger && Math.sin(this._t * 7) > 0 ? this.COL.red : this.COL.boneL;
    ctx.stroke();
    ctx.fillStyle = this.COL.brassL;
    ctx.fillRect(cx - 1, cy - 1, 3, 3);
    this._txt(this._mmss(timeLeft), cx, cy + r + 4, danger ? this.COL.red : this.COL.boneL, 11, 'center');
  },

  /** One-line summary of a status block, '' when clean. */
  _statusText(st) {
    if (!st) return '';
    const out = [];
    if (st.vuln > 0) out.push(I18N.t('Vuln {0}', st.vuln));
    if (st.weak > 0) out.push(I18N.t('Débil {0}', st.weak));
    if (st.poison > 0) out.push(I18N.t('Veneno {0}', st.poison));
    if (st.stun > 0) out.push(I18N.t('Aturd {0}', st.stun));
    return out.join('  ');
  },

  /** A dissection slab: bone surface on iron legs, centred on cx. */
  _slab(cx, y, w) {
    const ctx = this.ctx;
    const x = Math.round(cx - w / 2);
    ctx.fillStyle = this.COL.bone;
    ctx.fillRect(x, y, w, 3);
    ctx.fillStyle = '#6b5c44';
    ctx.fillRect(x, y + 3, w, 2);
    ctx.fillStyle = this.COL.grey;
    [x + 3, Math.round(cx) - 2, x + w - 6].forEach((lx) => ctx.fillRect(lx, y + 5, 3, 13));
    ctx.fillStyle = this.COL.dark;
    ctx.fillRect(x, y + 18, w, 2);
  },

  /** Slots of the creature shown on the title screen (no run in progress yet). */
  _titleSlots() {
    const base = (DATA.baseBodies && DATA.baseBodies[0]) || null;
    return base ? base.slots : {};
  },

  // ---------------------------------------------------------------- scenes

  _sceneTitle(G) {
    const ctx = this.ctx;
    for (let y = 0; y < 180; y += 4) {
      ctx.fillStyle = y < 120 ? '#0b0710' : '#140a12';
      ctx.fillRect(0, y, 320, 4);
    }
    this._txt('DEADLOCK DECK', 160, 10, this.COL.boneL, 22, 'center');
    this._txt(I18N.t('El Reloj Anatómico'), 160, 38, this.COL.verdL, 11, 'center');
    const cre = Sprites.creature(this._titleSlots(), G.meta && G.meta.tint);
    ctx.save();
    ctx.translate(160, 93);
    ctx.rotate(-Math.PI / 2);
    ctx.drawImage(cre, -32, -40, 64, 80);
    ctx.restore();
    this._slab(160, 114, 180);
    this._flames(142, 0.9, 16);
    this._flames(156, 0.7, 24);
  },

  _sceneTable(G) {
    const t = G.table;
    this._txt(I18N.t('LA MESA DE DISECCIÓN'), 160, 10, this.COL.boneL, 12, 'center');
    const slots = t ? t.slots : {};
    const cre = Sprites.creature(slots, G.meta && G.meta.tint);
    this.ctx.drawImage(cre, 128, 32, 64, 80);
    this._slab(160, 112, 150);
    this._txt(t ? t.baseName : '', 160, 140, this.COL.bone, 10, 'center');
    this._flames(162, 0.5, 48);
  },

  _sceneShop(G) {
    this._txt(I18N.t('TIENDA DE LA TORRE'), 160, 10, this.COL.boneL, 12, 'center');
    this._txt(I18N.t('Compras simuladas: sin dinero real.'), 160, 28, this.COL.grey, 8, 'center');
    const slots = G.table ? G.table.slots : this._titleSlots();
    this.ctx.drawImage(Sprites.creature(slots, G.meta && G.meta.tint), 144, 52, 64, 80);
    this._tile('esencia', 128, 140);
    this._txt(I18N.t('{0} de esencia', G.meta ? G.meta.essence : 0), 148, 146, this.COL.verdL, 10, 'left');
  },

  _sceneExplore(G) {
    const F = G.tower && G.tower.floors ? G.tower.floors[G.floor] : null;
    if (!F) return;
    const ctx = this.ctx;
    const mx = 8;
    const my = Math.max(8, Math.floor((180 - F.h * 16) / 2));
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const cell = F.cells[y][x];
        const px = mx + x * 16;
        const py = my + y * 16;
        if (!cell.seen) {
          ctx.drawImage(Sprites.get('fog'), px, py);
          continue;
        }
        ctx.drawImage(Sprites.get('floor'), px, py);
        if (cell.type === DATA.ROOM.START) ctx.drawImage(Sprites.get('start'), px, py);
        else if (cell.type === DATA.ROOM.STAIRS) ctx.drawImage(Sprites.get('stairs'), px, py);
        else if (cell.type === DATA.ROOM.EXIT) ctx.drawImage(Sprites.get('exit'), px, py);
        else if (cell.type === DATA.ROOM.TRAP) ctx.drawImage(Sprites.get('trap'), px, py);
        else if (cell.type === DATA.ROOM.ENEMY) ctx.drawImage(Sprites.get('enemy'), px, py);
        else if (cell.type === DATA.ROOM.RESOURCE && cell.content) ctx.drawImage(Sprites.get(cell.content), px, py);
        if (!cell.visited) {
          ctx.fillStyle = 'rgba(11,7,16,0.35)';
          ctx.fillRect(px, py, 16, 16);
        }
      }
    }
    // Walls last, so they sit on top of every tile edge.
    ctx.fillStyle = this.COL.bone;
    for (let y = 0; y < F.h; y++) {
      for (let x = 0; x < F.w; x++) {
        const cell = F.cells[y][x];
        if (!cell.seen) continue;
        const px = mx + x * 16;
        const py = my + y * 16;
        if (cell.walls.n) ctx.fillRect(px, py, 16, 1);
        if (cell.walls.s) ctx.fillRect(px, py + 15, 16, 1);
        if (cell.walls.w) ctx.fillRect(px, py, 1, 16);
        if (cell.walls.e) ctx.fillRect(px + 15, py, 1, 16);
      }
    }
    this._box(mx - 2, my - 2, F.w * 16 + 4, F.h * 16 + 4, null, this.COL.purple);
    const cre = Sprites.creature(Body.spriteSlots(G.body), G.meta && G.meta.tint);
    ctx.drawImage(cre, mx + G.pos.x * 16, my + G.pos.y * 16 - 4, 16, 20);

    const cx = Math.round((mx + F.w * 16 + 8 + 312) / 2);
    const danger = G.timeLeft < 30;
    this._txt(I18N.t('Piso {0}/{1}', G.floor + 1, DATA.FLOORS), cx, 12, this.COL.brassL, 10, 'center');
    this._clock(cx, 72, 30, G.timeLeft, danger);
    this._tile('heart', cx - 30, 122);
    this._txt(G.body.hp + '/' + G.body.maxHp, cx - 10, 128, this.COL.boneL, 10, 'left');
    this._tile('esencia', cx - 30, 140);
    this._txt(String(G.run ? G.run.essence : 0), cx - 10, 146, this.COL.verdL, 10, 'left');
    this._frame(1 - Math.max(0, Math.min(1, G.timeLeft / (DATA.RUN_SECONDS || 360))), danger);
  },

  _sceneCombat(G) {
    const C = G.combat;
    if (!C) return;
    const ctx = this.ctx;
    const danger = G.timeLeft < 30;
    this._txt(I18N.t('Turno {0}', C.turn), 10, 8, this.COL.grey, 9, 'left');

    const cre = Sprites.creature(Body.spriteSlots(C.body), G.meta && G.meta.tint);
    ctx.drawImage(cre, 24, 62, 64, 80);
    this._txt(I18N.t('Tú'), 56, 18, this.COL.boneL, 10, 'center');
    this._txt(I18N.t('{0}/{1} PV', C.body.hp, C.body.maxHp), 56, 32, this.COL.red, 9, 'center');
    if (C.player.block > 0) this._txt(I18N.t('Bloqueo {0}', C.player.block), 56, 44, this.COL.verdL, 9, 'center');
    this._txt(this._statusText(C.player.status), 56, 148, this.COL.acid, 8, 'center');

    const foe = Sprites.creature(C.enemy.limbs, 'default');
    ctx.save();
    ctx.translate(296, 62);
    ctx.scale(-1, 1);
    ctx.drawImage(foe, 0, 0, 64, 80);
    ctx.restore();
    this._txt(C.enemy.name, 264, 18, this.COL.boneL, 9, 'center');
    this._txt(I18N.t('{0}/{1} PV', C.enemy.hp, C.enemy.maxHp), 264, 32, this.COL.red, 9, 'center');
    if (C.enemy.block > 0) this._txt(I18N.t('Bloqueo {0}', C.enemy.block), 264, 44, this.COL.verdL, 9, 'center');
    this._txt(this._statusText(C.enemy.status), 264, 148, this.COL.acid, 8, 'center');

    this._clock(160, 62, 22, G.timeLeft, danger);
    const intent = Combat.intent(C);
    this._txt(I18N.t('Intención'), 160, 106, this.COL.grey, 8, 'center');
    this._txt(intent && intent.text ? intent.text : '—', 160, 118, this.COL.brassL, 10, 'center');
    if (danger) this._frame(1, true);
  },

  _sceneHarvest(G) {
    const h = G.harvest;
    if (!h) return;
    const ctx = this.ctx;
    this._txt(I18N.t('COSECHA'), 160, 10, this.COL.boneL, 14, 'center');
    this._txt(I18N.t('de {0}', h.enemyName), 160, 30, this.COL.blood, 10, 'center');
    const ids = h.limbs || [];
    const total = ids.length * 40;
    let x = Math.round(160 - total / 2);
    for (let i = 0; i < ids.length; i++) {
      const lim = DATA.limbs[ids[i]];
      this._box(x, 50, 36, 36, '#140c1c', this.COL.purple);
      if (lim) ctx.drawImage(Sprites.limb(lim.sprite), x + 2, 52, 32, 32);
      x += 40;
    }
    this._txt(I18N.t('+{0} de esencia', h.essence || 0), 160, 94, this.COL.verdL, 9, 'center');
    this._clock(160, 128, 22, G.timeLeft, G.timeLeft < 30);
  },

  _sceneDeath(G) {
    const ctx = this.ctx;
    ctx.drawImage(Sprites.get('skull'), 128, 34, 64, 64);
    const timeOut = G.run && G.run.cause === I18N.t('el reloj');
    this._txt(timeOut ? I18N.t('EL RELOJ LLEGÓ A CERO') : I18N.t('HAS MUERTO'), 160, 108, this.COL.red, timeOut ? 13 : 18, 'center');
    if (!timeOut) this._txt(G.run ? String(G.run.cause || '') : '', 160, 132, this.COL.bone, 10, 'center');
    this._flames(158, 1, 16);
    this._frame(1, true);
  },

  _sceneEscape(G) {
    const ctx = this.ctx;
    ctx.drawImage(Sprites.get('exit'), 112, 40, 64, 64);
    ctx.drawImage(Sprites.creature(Body.spriteSlots(G.body), G.meta && G.meta.tint), 188, 44, 48, 60);
    this._txt(I18N.t('¡HAS ESCAPADO!'), 160, 114, this.COL.verdL, 16, 'center');
    this._txt(I18N.t('La torre arde a tu espalda.'), 160, 138, this.COL.bone, 9, 'center');
    this._flames(160, 0.8, 24);
  },

  // ------------------------------------------------------------ DOM panel

  /** Panel signature: rebuild only when something the panel shows actually changed. */
  _sigOf(G) {
    const meta = G.meta || {};
    const p = [G.screen, meta.muted ? 1 : 0, meta.essence, meta.tint, G.message ? G.message.text : ''];
    switch (G.screen) {
      case 'title':
        p.push(meta.runs, meta.escapes);
        break;
      case 'table':
        p.push(G.table ? G.table.baseName : '');
        p.push(G.table ? DATA.SLOTS.map((s) => G.table.slots[s]).join(',') : '');
        break;
      case 'shop':
        p.push((meta.cosmetics || []).join(','), (meta.unlocks || []).join(','));
        break;
      case 'explore':
        p.push(G.floor, G.body.hp, G.body.maxHp, G.run ? G.run.essence : 0, this._bodySig(G.body));
        break;
      case 'combat': {
        const C = G.combat;
        if (!C) break;
        p.push(C.phase, C.turn, C.player.energy, C.body.hp, C.enemy.hp, C.log.length);
        p.push(C.hand.map((e, i) => e.uid + ':' + (Combat.canPlay(C, i) ? 1 : 0)).join(','));
        p.push(this._bodySig(C.body));
        break;
      }
      case 'harvest':
        p.push(G.harvest ? G.harvest.enemyName : '', G.harvest ? (G.harvest.limbs || []).join(',') : '');
        p.push(this._bodySig(G.body));
        break;
      case 'death':
        p.push(G.floor, G.run ? [G.run.cause, G.run.kills, G.run.grafts, G.run.essence].join(',') : '');
        break;
      case 'escape':
        p.push(Math.floor(G.timeLeft), G.run ? G.run.essence : 0);
        break;
      default:
        break;
    }
    return p.join('|');
  },

  _bodySig(body) {
    if (!body) return '';
    return DATA.SLOTS.map((s) => {
      const l = body.slots[s];
      return l ? l.id + (l.broken ? '!' : '') + l.heat : '-';
    }).join(',');
  },

  _el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined && text !== null) e.textContent = text;
    return e;
  },

  /**
   * A real <button>: click plays Snd.sfx('click') and then runs the action.
   * @param {Object} [opt] { cls, key, primary, disabled, title }
   */
  _btn(label, fn, opt) {
    const o = opt || {};
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'btn' + (o.cls ? ' ' + o.cls : '') + (o.primary ? ' primary' : '');
    if (typeof label === 'string') b.textContent = label;
    else b.appendChild(label);
    b.dataset.k = o.key || (typeof label === 'string' ? label : 'b');
    if (o.title) b.title = o.title;
    if (o.disabled) b.disabled = true;
    b.addEventListener('click', () => {
      try { Snd.sfx('click'); } catch (err) { /* audio is optional */ }
      this._guard('action', fn);
    });
    if (o.primary) this._primary = b;
    return b;
  },

  /** A fresh copy of a cached Sprites canvas (the cached node must never be moved into the DOM). */
  _icon(src, scale) {
    const cv = document.createElement('canvas');
    cv.width = src.width;
    cv.height = src.height;
    const c = cv.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.drawImage(src, 0, 0);
    cv.className = 'icon';
    cv.style.width = (src.width * (scale || 2)) + 'px';
    cv.style.height = (src.height * (scale || 2)) + 'px';
    return cv;
  },

  /** Six slots with limb name and heat bar; stumps read 'Muñón'. */
  _strip(body) {
    const wrap = this._el('div', 'strip');
    DATA.SLOTS.forEach((slot) => {
      const limb = body.slots[slot];
      const data = limb ? DATA.limbs[limb.id] : null;
      const stump = Body.isStump(body, slot);
      const cell = this._el('div', 'sl');
      cell.style.borderBottomColor = this.SLOT_COL[slot];
      cell.appendChild(this._icon(stump ? Sprites.get('stump') : Sprites.limb(data.sprite), 2));
      cell.appendChild(this._el('span', 'sn', DATA.SLOT_NAMES[slot]));
      const name = stump ? I18N.t('Muñón') : data.name;
      const label = this._el('span', 'sv', name);
      if (stump && data) label.title = data.name;
      cell.appendChild(label);
      const bar = this._el('div', 'bar');
      const fill = this._el('i');
      const ratio = Body.heatRatio(body, slot);
      fill.style.width = Math.round(ratio * 100) + '%';
      fill.style.background = ratio >= 0.75 ? this.COL.red : (ratio >= 0.5 ? this.COL.fire : this.COL.brass);
      bar.appendChild(fill);
      bar.title = stump ? I18N.t('Muñón') : I18N.t('Calor {0}/{1}', limb.heat, data.maxHeat);
      cell.appendChild(bar);
      wrap.appendChild(cell);
    });
    return wrap;
  },

  /** Mute toggle, present on every screen so touch players always have it. */
  _muteBtn(G) {
    const muted = !!(G.meta && G.meta.muted);
    return this._btn(muted ? I18N.t('Sonido: no') : I18N.t('Sonido: sí'), () => Game.toggleMute(), { cls: 'small', key: 'mute' });
  },

  /** Language switch, next to the mute toggle so it is reachable on every screen. */
  _langBtn(code, name) {
    return this._btn(code.toUpperCase(), () => I18N.set(code), {
      cls: 'small', key: 'lang-' + code, disabled: I18N.lang() === code, title: name,
    });
  },

  /** Replace the panel contents, keeping keyboard focus on the same control when possible. */
  _build(G) {
    const active = document.activeElement;
    const keep = active && active.dataset && this.panel.contains(active) ? active.dataset.k : null;
    this._primary = null;
    const frag = document.createDocumentFragment();
    switch (G.screen) {
      case 'title': this._panelTitle(G, frag); break;
      case 'table': this._panelTable(G, frag); break;
      case 'shop': this._panelShop(G, frag); break;
      case 'explore': this._panelExplore(G, frag); break;
      case 'combat': this._panelCombat(G, frag); break;
      case 'harvest': this._panelHarvest(G, frag); break;
      case 'death': this._panelDeath(G, frag); break;
      case 'escape': this._panelEscape(G, frag); break;
      default: break;
    }
    if (G.message && G.message.text) {
      const msg = this._el('div', 'msg', G.message.text);
      msg.setAttribute('role', 'status');
      frag.appendChild(msg);
    }
    const foot = this._el('div', 'row foot');
    foot.appendChild(this._langBtn('es', 'Español'));
    foot.appendChild(this._langBtn('en', 'English'));
    foot.appendChild(this._muteBtn(G));
    frag.appendChild(foot);
    this.panel.textContent = '';
    this.panel.appendChild(frag);
    if (keep) {
      const again = this.panel.querySelector('[data-k="' + keep.replace(/"/g, '') + '"]');
      if (again && !again.disabled) again.focus();
    }
  },

  _panelTitle(G, frag) {
    const meta = G.meta || {};
    frag.appendChild(this._el('p', 'lead', I18N.t('Despiertas en la mesa. La torre arde. Tienes seis minutos.')));
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Despertar'), () => Game.newRun(), { primary: true, key: 'wake' }));
    frag.appendChild(row);
    frag.appendChild(this._el('p', 'dim', I18N.t('Despertares: {0}  ·  Huidas: {1}  ·  Esencia: {2}',
      meta.runs || 0, meta.escapes || 0, meta.essence || 0)));
    frag.appendChild(this._el('p', 'dim', I18N.t('Teclas: WASD/flechas moverse · 1-5 cartas · E terminar turno · M sonido')));
  },

  _panelTable(G, frag) {
    const t = G.table;
    if (!t) return;
    frag.appendChild(this._el('h1', 'h', I18N.t('Mesa de disección')));
    frag.appendChild(this._el('p', 'dim', I18N.t('Cuerpo base: {0}', t.baseName)));
    const list = this._el('div', 'slots');
    DATA.SLOTS.forEach((slot) => {
      const id = t.slots[slot];
      const limb = DATA.limbs[id];
      const row = this._el('div', 'slotrow');
      row.style.borderLeftColor = this.SLOT_COL[slot];
      row.appendChild(this._btn('◀', () => Game.tableCycle(slot, -1), { cls: 'cyc', key: slot + '-', title: I18N.t('Anterior') }));
      const mid = this._el('div', 'mid');
      if (limb) mid.appendChild(this._icon(Sprites.limb(limb.sprite), 2));
      const txt = this._el('div', 'txt');
      txt.appendChild(this._el('span', 'sn', DATA.SLOT_NAMES[slot]));
      txt.appendChild(this._el('span', 'sv', limb ? limb.name : I18N.t('Muñón')));
      txt.appendChild(this._el('span', 'dim', limb
        ? limb.cards.map((c) => (DATA.cards[c] ? DATA.cards[c].name : c)).join(', ')
        : I18N.t('Golpe de muñón')));
      mid.appendChild(txt);
      row.appendChild(mid);
      row.appendChild(this._btn('▶', () => Game.tableCycle(slot, 1), { cls: 'cyc', key: slot + '+', title: I18N.t('Siguiente') }));
      list.appendChild(row);
    });
    frag.appendChild(list);
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Levantarse'), () => Game.rise(), { primary: true, key: 'rise' }));
    row.appendChild(this._btn(I18N.t('Tienda'), () => Game.openShop(), { key: 'shop' }));
    frag.appendChild(row);
  },

  _panelShop(G, frag) {
    const meta = G.meta || {};
    const owned = meta.cosmetics || [];
    frag.appendChild(this._el('h1', 'h', I18N.t('Tienda · {0} de esencia', meta.essence || 0)));
    frag.appendChild(this._el('p', 'dim', I18N.t('Compras simuladas: sin dinero real.')));
    // The free default skin is always owned; offer it so a bought tint can be reverted.
    const base = this._el('div', 'shoprow');
    const baseTxt = this._el('div', 'txt');
    baseTxt.appendChild(this._el('span', 'sv', I18N.t('Piel de cadáver')));
    baseTxt.appendChild(this._el('span', 'dim', I18N.t('El tinte con el que despertaste. Gratis.')));
    base.appendChild(baseTxt);
    base.appendChild(meta.tint === 'default'
      ? this._btn(I18N.t('Equipado'), () => {}, { key: 'on-default', disabled: true })
      : this._btn(I18N.t('Equipar'), () => Game.equip('default'), { key: 'eq-default' }));
    frag.appendChild(base);
    Object.keys(DATA.cosmetics).forEach((id) => {
      const c = DATA.cosmetics[id];
      const has = owned.indexOf(id) >= 0 || owned.indexOf(c.tint) >= 0;
      const on = meta.tint === c.tint;
      const row = this._el('div', 'shoprow');
      const txt = this._el('div', 'txt');
      txt.appendChild(this._el('span', 'sv', c.name));
      txt.appendChild(this._el('span', 'dim', c.desc));
      txt.appendChild(this._el('span', 'price' + ((meta.essence || 0) < c.price ? ' low' : ''), I18N.t('{0} de esencia', c.price)));
      row.appendChild(txt);
      if (!has) {
        row.appendChild(this._btn(I18N.t('Comprar'), () => Game.buy(id), { key: 'buy-' + id }));
      } else if (on) {
        row.appendChild(this._btn(I18N.t('Equipado'), () => {}, { key: 'on-' + id, disabled: true }));
      } else {
        row.appendChild(this._btn(I18N.t('Equipar'), () => Game.equip(id), { key: 'eq-' + id }));
      }
      frag.appendChild(row);
    });
    Object.keys(DATA.unlocks).forEach((id) => {
      const u = DATA.unlocks[id];
      const has = (meta.unlocks || []).indexOf(id) >= 0;
      const row = this._el('div', 'shoprow');
      const txt = this._el('div', 'txt');
      txt.appendChild(this._el('span', 'sv', u.name));
      txt.appendChild(this._el('span', 'dim', u.desc));
      txt.appendChild(this._el('span', 'price' + ((meta.essence || 0) < u.price ? ' low' : ''), I18N.t('{0} de esencia', u.price)));
      row.appendChild(txt);
      row.appendChild(has
        ? this._btn(I18N.t('Desbloqueado'), () => {}, { key: 'un-' + id, disabled: true })
        : this._btn(I18N.t('Comprar'), () => Game.buy(id), { key: 'buy-' + id }));
      frag.appendChild(row);
    });
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Volver'), () => Game.closeShop(), { primary: true, key: 'back' }));
    frag.appendChild(row);
  },

  _panelExplore(G, frag) {
    const pad = this._el('div', 'dpad');
    pad.appendChild(this._btn('▲', () => Game.move('n'), { cls: 'up', key: 'n', title: I18N.t('Norte') }));
    pad.appendChild(this._btn('◀', () => Game.move('w'), { cls: 'lf', key: 'w', title: I18N.t('Oeste') }));
    pad.appendChild(this._btn('▶', () => Game.move('e'), { cls: 'rt', key: 'e', title: I18N.t('Este') }));
    pad.appendChild(this._btn('▼', () => Game.move('s'), { cls: 'dn', key: 's', title: I18N.t('Sur') }));
    frag.appendChild(pad);
    frag.appendChild(this._strip(G.body));
  },

  _panelCombat(G, frag) {
    const C = G.combat;
    if (!C) return;
    const head = this._el('div', 'row head');
    head.appendChild(this._el('span', 'energy', I18N.t('Energía {0}/{1}', C.player.energy, DATA.ENERGY)));
    head.appendChild(this._btn(I18N.t('Terminar turno'), () => Game.endTurn(), {
      primary: true, key: 'end', disabled: C.phase !== 'player',
    }));
    frag.appendChild(head);
    const hand = this._el('div', 'hand');
    C.hand.forEach((entry, i) => {
      const card = DATA.cards[entry.cardId] || { name: entry.cardId, desc: '', cost: 0, heat: 0 };
      const face = this._el('span', 'face');
      face.appendChild(this._el('span', 'ckey', String(i + 1)));
      face.appendChild(this._el('span', 'cname', card.name));
      const stat = this._el('span', 'cstat');
      stat.appendChild(this._el('b', null, I18N.t('Coste {0}', card.cost)));
      stat.appendChild(this._el('b', null, I18N.t('Calor {0}', card.heat)));
      face.appendChild(stat);
      face.appendChild(this._el('span', 'cdesc', card.desc));
      const b = this._btn(face, () => Game.playCard(i), {
        cls: 'card', key: 'card-' + entry.uid, disabled: !Combat.canPlay(C, i),
        title: DATA.SLOT_NAMES[entry.slot],
      });
      b.style.borderLeftColor = this.SLOT_COL[entry.slot] || this.COL.bone;
      hand.appendChild(b);
    });
    frag.appendChild(hand);
    frag.appendChild(this._strip(C.body));
    const log = this._el('div', 'log');
    C.log.slice(-4).forEach((line) => log.appendChild(this._el('p', null, line)));
    frag.appendChild(log);
  },

  _panelHarvest(G, frag) {
    const h = G.harvest;
    if (!h) return;
    frag.appendChild(this._el('h1', 'h', I18N.t('Cosecha de {0}', h.enemyName)));
    (h.limbs || []).forEach((id) => {
      const lim = DATA.limbs[id];
      if (!lim) return;
      const row = this._el('div', 'shoprow');
      row.appendChild(this._icon(Sprites.limb(lim.sprite), 2));
      const txt = this._el('div', 'txt');
      txt.appendChild(this._el('span', 'sv', lim.name));
      txt.appendChild(this._el('span', 'dim', I18N.t('{0} · calor máx. {1}', DATA.TYPE_NAMES[lim.type] || lim.type, lim.maxHeat)
        + (lim.hp ? I18N.t(' · +{0} PV', lim.hp) : '')));
      txt.appendChild(this._el('span', 'dim', lim.cards.map((c) => (DATA.cards[c] ? DATA.cards[c].name : c)).join(', ')));
      row.appendChild(txt);
      const acts = this._el('div', 'acts');
      if (lim.type === 'arm' || lim.type === 'leg') {
        const l = lim.type === 'arm' ? 'armL' : 'legL';
        const r = lim.type === 'arm' ? 'armR' : 'legR';
        acts.appendChild(this._btn(I18N.t('Izq'), () => Game.harvestPick(id, l), { key: 'g-' + id + '-l' }));
        acts.appendChild(this._btn(I18N.t('Der'), () => Game.harvestPick(id, r), { key: 'g-' + id + '-r' }));
      } else {
        acts.appendChild(this._btn(I18N.t('Injertar'), () => Game.harvestPick(id, lim.type), { key: 'g-' + id }));
      }
      row.appendChild(acts);
      frag.appendChild(row);
    });
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Seguir sin injertar'), () => Game.harvestSkip(), { primary: true, key: 'skip' }));
    frag.appendChild(row);
    frag.appendChild(this._strip(G.body));
  },

  _panelDeath(G, frag) {
    const run = G.run || {};
    const timeOut = run.cause === I18N.t('el reloj');
    frag.appendChild(this._el('h1', 'h dead', timeOut ? I18N.t('El reloj llegó a cero') : I18N.t('Has muerto: {0}', run.cause || '')));
    frag.appendChild(this._el('p', 'dim', I18N.t('Piso {0}/{1}  ·  Enemigos: {2}  ·  Injertos: {3}  ·  Esencia: {4}',
      (G.floor || 0) + 1, DATA.FLOORS, run.kills || 0, run.grafts || 0, run.essence || 0)));
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Volver a la mesa'), () => Game.afterEnd(), { primary: true, key: 'again' }));
    frag.appendChild(row);
  },

  _panelEscape(G, frag) {
    const run = G.run || {};
    frag.appendChild(this._el('h1', 'h esc', I18N.t('¡Has escapado de la torre!')));
    frag.appendChild(this._el('p', 'dim', I18N.t('Tiempo restante: {0}  ·  Esencia: {1}  ·  Huidas: {2}',
      this._mmss(G.timeLeft), run.essence || 0, (G.meta && G.meta.escapes) || 0)));
    const row = this._el('div', 'row');
    row.appendChild(this._btn(I18N.t('Volver a la mesa'), () => Game.afterEnd(), { primary: true, key: 'again' }));
    frag.appendChild(row);
  },
};
