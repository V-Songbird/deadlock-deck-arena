/* Interfaz en español: ratón, teclado, pantalla táctil y mando. */
'use strict';

(() => {
  const D = window.DDData;
  const paths = {
    heart: '<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/>',
    bolt: '<path d="m13 2-9 12h7l-1 8 10-12h-7l1-8Z"/>',
    flame: '<path d="M12 3c1 5-5 6-5 10a5 5 0 0 0 10 0c0-2-1-5-3-6 0 3-2 4-2 4 2-4 1-6 0-8Z"/>',
    snow: '<path d="M12 2v20M3.3 7l17.4 10M3.3 17 20.7 7M9 4l3 3 3-3M9 20l3-3 3 3M4 10l4-1-1-4M20 14l-4 1 1 4M7 19l1-4-4-1M17 5l-1 4 4 1"/>',
    shield: '<path d="M12 3 3 7v5c0 5 9 9 9 9s9-4 9-9V7l-9-4Z"/><path d="m8 12 3 3 5-6"/>',
    blade: '<path d="m14 4 7-1-1 7-9 9-5-5 8-10ZM4 14l6 6M3 21l4-4M15 9l3-3"/>',
    bone: '<path d="M7 5a3 3 0 1 0-4 4l12 12a3 3 0 0 0 4-4 3 3 0 0 0-4-4L7 5ZM8 8l8 8"/>',
    eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/>',
    fang: '<path d="M4 4v8l4 8 2-7h4l2 7 4-8V4l-4 5H8L4 4Z"/>',
    foot: '<path d="M9 3h6v10l5 3v5H5v-4l4-5V3ZM6 17h13"/>',
    bag: '<path d="M5 7h14l2 14H3L5 7ZM8 7V5a4 4 0 0 1 8 0v2M8 12h8"/>',
    book: '<path d="M3 3h7l2 2 2-2h7v17h-7l-2 2-2-2H3V3ZM12 5v17M6 7h3M15 7h3M6 11h3M15 11h3"/>',
    skull: '<path d="M7 19v-3c-3-1-4-3-4-6a9 9 0 0 1 18 0c0 3-1 5-4 6v3H7ZM9 19v3M15 19v3"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><path d="m11 15 1-2 1 2"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2M9 1h6"/>',
    tower: '<path d="M5 21V10l7-7 7 7v11M3 21h18M8 8h8M10 21v-5h4v5M11 10h2v3h-2z"/>',
    up: '<path d="M12 20V4m-7 7 7-7 7 7"/>',
    down: '<path d="M12 4v16m-7-7 7 7 7-7"/>',
    left: '<path d="M20 12H4m7-7-7 7 7 7"/>',
    right: '<path d="M4 12h16m-7-7 7 7-7 7"/>',
    close: '<path d="m6 6 12 12M6 18 18 6"/>',
    sound: '<path d="m11 4-6 5H2v6h3l6 5V4ZM15 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14"/>',
    mute: '<path d="m11 4-6 5H2v6h3l6 5V4Zm5 5 5 6m0-6-5 6"/>',
    help: '<circle cx="12" cy="12" r="9"/><path d="M9 8a3 3 0 0 1 6 0c0 2-3 2-3 5M12 17h.01"/>',
    settings: '<path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2 2m8.8 8.8 2 2M5.6 18.4l2-2m8.8-8.8 2-2"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    coin: '<path d="m12 2 9 10-9 10L3 12 9 2Z"/><path d="m12 6 5 6-5 6-5-6 5-6Z"/>',
    lock: '<rect x="5" y="10" width="14" height="11" rx="1"/><path d="M8 10V6a4 4 0 0 1 8 0v4M12 14v3"/>',
    check: '<path d="m4 12 5 5L20 6"/>',
    map: '<path d="m2 5 6-3 8 3 6-3v17l-6 3-8-3-6 3V5ZM8 2v17M16 5v17"/>',
    flask: '<path d="M9 2h6M10 2v7L4 19c-1 2 0 3 2 3h12c2 0 3-1 2-3L14 9V2M7 15h10"/>',
    fullscreen: '<path d="M3 9V3h6m6 0h6v6M3 15v6h6m6 0h6v-6"/>',
    log: '<path d="M5 3h14v18H5V3ZM8 7h8M8 11h8M8 15h5"/>',
    gear: '<path d="M12 2v4m0 12v4M2 12h4m12 0h4M5 5l3 3m8 8 3 3M5 19l3-3m8-8 3-3"/><circle cx="12" cy="12" r="7"/><circle cx="12" cy="12" r="2"/>',
    gamepad: '<path d="M7 7h10c3 0 5 12 3 13-2 1-4-4-5-4H9c-1 0-3 5-5 4-2-1 0-13 3-13ZM6 11h4M8 9v4M16 10h.01M18 13h.01"/>'
  };
  const icon = (name, cls = '') => `<svg class="icon ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.gear}</svg>`;
  const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const timeLabel = ms => {
    const seconds = Math.ceil(Math.max(0, ms) / 1000);
    return `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  };
  const kindLabel = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  const tierLabel = { 1: 'Común', 2: 'Inusual', 3: 'Singular' };
  const roomIcon = { start: 'skull', corridor: 'gear', combat: 'blade', cache: 'bag', trap: 'flame', workshop: 'flask', stairs: 'up', boss: 'skull', archive: 'book' };

  function pixelArt(type, color) {
    const figures = {
      blade: '<path d="M41 6h8v15h-4v6h-5v5h-5v5h-5v5h-5v-9h5v-5h5v-5h4V12h2Z" fill="#c3c7ad"/><path d="M17 29h5v5h5v5h5v5h-6v-4h-5v-5h-4Z" fill="#b9945a"/><path d="m21 38 5 5-12 12H8v-6Z" fill="#6c604d"/><path d="M41 12h3v11h-4v7h-5v5h-3v-7h5v-8h4Z" fill="#f0e9c8"/>',
      bone: '<path d="M10 8h10v5h5v8h-5v4l21 21h4v-5h8v5h5v10H47v-4h-8L17 30h-4v4H5V23h5v-4H6v-7h4Z" fill="#c6bd9c"/><path d="M17 17h4v7l24 24v5h-4L16 28h-4v-5h5Z" fill="#938a72"/>',
      eye: '<path d="M6 29h7v-7h8v-5h22v5h8v7h7v9h-7v7h-8v5H21v-5h-8v-7H6Z" fill="#465b50"/><path d="M13 29h8v-7h22v7h8v9h-8v7H21v-7h-8Z" fill="#bdc3a1"/><path d="M25 23h15v21H25Z" fill="#829d84"/><path d="M29 26h7v15h-7Z" fill="#252f29"/><path d="M30 27h4v4h-4Z" fill="#e9d9a0"/><path d="M30 5h4v8h-4ZM9 13h4v4H9Zm43 0h4v4h-4Z" fill="#b29358"/>',
      heart: '<path d="M7 15h7v-5h12v6h11v-6h12v5h7v19h-6v7h-6v6h-6v6H25v-6h-6v-6h-6v-7H7Z" fill="#9d6255"/><path d="M12 19h10v-4h5v10H15v12h-3Z" fill="#cf9a80"/><path d="M33 20h4v28h-4ZM27 26h15v2H27Zm0 9h15v2H27Z" fill="#ddd1a9"/>',
      shield: '<path d="M30 5h5v5h9v5h13v22h-6v10h-7v7h-9v5h-6v-5h-9v-7h-7V37H7V15h14v-5h9Z" fill="#b29360"/><path d="M29 13h7v5h14v17h-6v9h-9v8h-6v-8h-9v-9h-6V22h15Z" fill="#4f6250"/><path d="M29 18h6v27h-6ZM20 28h25v5H20Z" fill="#c3c19b"/>',
      flame: '<path d="M31 4h7v15h7v9h7v18h-7v8H20v-8h-8V29h7v8h6V20h6Z" fill="#a65c35"/><path d="M32 17h5v14h8v13h-7v7H24v-7h-5v-9h7v5h6Z" fill="#df9c43"/><path d="M31 33h6v9h4v7H28v-8h3Z" fill="#f0d88c"/>',
      snow: '<path d="M30 5h5v14h6v-6h5v10h-6v6h14v5H40v6h6v10h-5v-6h-6v14h-5V44h-6v6h-5V40h6v-6H11v-5h14v-6h-6V13h5v6h6Z" fill="#8cb0a4"/><path d="M28 27h9v9h-9Z" fill="#d8ddbb"/>',
      bolt: '<path d="M33 4h17L36 25h13L21 59l6-25H13Z" fill="#b59351"/><path d="M36 7h8L30 29h12L27 49l5-19H21Z" fill="#eee0a0"/><path d="M4 19h8v3H4ZM50 46h9v3h-9ZM8 46h4v5H8Z" fill="#9fb8a1"/>',
      foot: '<path d="M24 7h19v21h-5v13h11v5h9v10H13V43h5V28h6Z" fill="#9caa8c"/><path d="M31 11h5v17h-5Zm-8 22h10v4H23Zm-5 13h27v4H18Z" fill="#dde0b8"/><path d="M12 55h46v4H12Z" fill="#555f4f"/>',
      fang: '<path d="M9 12h12v7h22v-7h12v27h-6v14h-7V38H22v15h-7V39H9Z" fill="#a26758"/><path d="M13 18h7v14h-7Zm31 0h7v14h-7ZM17 32h6v15h-6Zm24 0h6v15h-6Z" fill="#d3c7a3"/><path d="M26 23h12v7H26Z" fill="#543e32"/>'
    };
    return `<svg viewBox="0 0 64 64" class="pixel-symbol" aria-hidden="true" shape-rendering="crispEdges"><path d="M5 5h8v1H6v7H5ZM51 5h8v8h-1V6h-7ZM5 51h1v7h7v1H5Zm53 0h1v8h-8v-1h7Z" fill="${color}" opacity=".5"/>${figures[type] || figures.bone}</svg>`;
  }

  class UI {
    constructor() {
      this.game = new DDGame();
      this.art = new DDArt(this.game);
      this.audio = new DDAudio(this.game);
      this.root = document.getElementById('app');
      this.modal = this.game.state ? (this.game.active() ? null : 'end') : 'intro';
      this.part = 'head';
      this.filter = 'all';
      this.lastPhase = this.game.state?.phase;
      this.previousVolume = this.game.meta.volume || 0.3;
      this.game.addEventListener('change', () => {
        const phase = this.game.state?.phase;
        if (['dead', 'won'].includes(phase) && phase !== this.lastPhase) this.modal = 'end';
        this.lastPhase = phase;
        this.render();
      });
      this.game.addEventListener('clock', () => this.updateClock());
      this.game.addEventListener('notice', event => this.toast(event.detail));
      this.game.addEventListener('effect', event => {
        if (event.detail.type === 'shake' && this.game.meta.motion) {
          document.getElementById('scene-wrap')?.animate([
            { transform: 'translateX(0)' }, { transform: 'translateX(-4px)' },
            { transform: 'translateX(4px)' }, { transform: 'translateX(-2px)' },
            { transform: 'translateX(0)' }
          ], { duration: 430 });
        }
      });
      this.root.addEventListener('click', event => this.handleClick(event));
      this.root.addEventListener('input', event => this.handleInput(event));
      document.addEventListener('keydown', event => this.handleKey(event));
      document.addEventListener('pointerdown', () => this.audio.unlock(), { once: true });
      window.addEventListener('beforeunload', () => this.game.save());
      this.render();
      this.game.tick();
      this.setupGamepad();
      if (this.game.state && this.game.active()) this.toast({ text: 'Partida restaurada. El reloj siguió corriendo mientras no estabas.', tone: 'warning' });
      if (!this.game.storageAvailable) this.toast({ text: 'El guardado local no está disponible en este navegador.', tone: 'warning' });
    }

    button(action, label, iconName, cls = '', attrs = '') {
      return `<button type="button" class="btn ${cls}" data-action="${action}" ${attrs}>${iconName ? icon(iconName) : ''}<span>${label}</span></button>`;
    }

    toast({ text, tone = 'info' }) {
      const root = document.getElementById('notifications');
      const item = document.createElement('div');
      item.className = `toast ${tone}`;
      item.setAttribute('role', tone === 'danger' ? 'alert' : 'status');
      item.textContent = text;
      root.appendChild(item);
      while (root.children.length > 1) root.firstElementChild.remove();
      setTimeout(() => item.remove(), tone === 'danger' ? 7000 : 4500);
    }

    header() {
      return `<header class="topbar">
        <a class="brand" href="#" data-action="home" aria-label="Deadlock Deck: inicio">
          <span class="brand-mark">${icon('skull')}</span>
          <span><strong>DEADLOCK DECK<span class="brand-dot">.</span></strong><small>EL RELOJ ANATÓMICO</small></span>
        </a>
        <div class="header-middle"><span class="live-dot"></span> LA TORRE ESTÁ ARDIENDO</div>
        <nav class="header-actions" aria-label="Menú del juego">
          ${this.button('archive', 'Archivo', 'book', 'quiet desktop-label')}
          ${this.button('shop', 'Relicario', 'coin', 'quiet desktop-label')}
          ${this.button('sound', '', this.game.meta.volume > 0 ? 'sound' : 'mute', 'icon-only quiet', `aria-label="${this.game.meta.volume > 0 ? 'Silenciar sonido' : 'Activar sonido'}" title="Sonido"`)}
          ${this.button('help', '', 'help', 'icon-only quiet', 'aria-label="Cómo jugar y controles" title="Cómo jugar"')}
          ${this.button('settings', '', 'settings', 'icon-only quiet', 'aria-label="Ajustes" title="Ajustes"')}
        </nav>
      </header>`;
    }

    statusBar() {
      const s = this.game.state;
      const hp = s ? Math.max(0, s.hp) : 80;
      const maxHp = s?.maxHp || 80;
      return `<section class="status-bar" aria-label="Estado del intento">
        <div class="subject-block"><span class="eyebrow">SUJETO REANIMADO</span><strong>N.º ${String(this.game.meta.runs || 1).padStart(3, '0')} <span class="subtle">/ ${s?.origin || 'El ensamblado'}</span></strong></div>
        <div class="health-block"><div class="stat-line"><span>${icon('heart')} VITALIDAD</span><strong>${hp}<span> / ${maxHp}</span></strong></div><div class="health-track"><span style="width:${hp / maxHp * 100}%"></span></div></div>
        <div class="clock-block" id="clock-block"><span class="clock-label">${icon('clock')} TIEMPO HASTA EL COLAPSO</span><strong id="clock" aria-label="Tiempo restante">${timeLabel(this.game.remaining())}</strong><div class="clock-track"><span id="clock-fill"></span></div></div>
        <div class="resource-block"><span class="eyebrow">${icon('gear')} CHATARRA</span><strong>${s?.scraps ?? 0}</strong></div>
        <div class="resource-block echoes-stat"><span class="eyebrow">${icon('coin')} ECOS</span><strong>${this.game.meta.souls}</strong></div>
      </section>`;
    }

    anatomyMarkup(modal = false) {
      const s = this.game.state;
      const body = s?.body || this.art.defaultBody();
      const cardsCount = D.slots.reduce((n, slot) => n + (body[slot.id].id ? 2 : 1), 0);
      return `<div class="panel-title"><h2>Tu anatomía</h2><span>${cardsCount} CARTAS</span></div>
        <div class="anatomy-illustration"><canvas id="${modal ? 'modal-body' : 'body-canvas'}" width="200" height="148" aria-label="Tu cuerpo con los seis injertos actuales"></canvas><span class="specimen-tag">FIG. ${String(this.game.meta.runs || 1).padStart(3, '0')}</span></div>
        <div class="anatomy-slots">${D.slots.map(slot => {
          const p = body[slot.id];
          const def = p.id ? D.parts[p.id] : null;
          const warning = p.heat >= 75 || (p.integrity < 25 && def);
          return `<button type="button" class="body-slot ${!def ? 'broken' : warning ? 'hot' : ''}" data-action="part" data-slot="${slot.id}" aria-label="${slot.label}: ${def?.name || 'Muñón'}. Calor ${p.heat} grados. Integridad ${p.integrity} por ciento.">
            <span class="slot-glyph">${icon(slot.kind === 'head' ? 'skull' : slot.kind === 'torso' ? 'heart' : slot.kind === 'arm' ? 'bone' : 'foot')}</span>
            <span class="slot-content"><span class="slot-heading">${slot.label}<b>${def ? `${p.heat}°` : 'ROTO'}</b></span><strong>${def?.name || 'Muñón · busca un reemplazo'}</strong>
            <span class="limb-meter"><i style="width:${p.integrity}%;background:${def?.color || '#b97567'}"></i></span><span class="heat-meter"><i style="width:${p.heat}%"></i></span></span>
          </button>`;
        }).join('')}</div>
        <div class="anatomy-legend"><span><i class="integrity-dot"></i> Integridad</span><span><i class="heat-dot"></i> Calor</span></div>
        ${this.button('bag', `Bolsa de injertos <b>${s?.inventory.length || 0}</b>`, 'bag', 'wide bag-button')}
        <div class="consumables"><button type="button" class="consumable" data-action="heal" ${!this.game.active() ? 'disabled' : ''} title="Recupera 28 de vida · Q">${icon('flask')}<span>Suero<small>+28 vida</small></span><b>×${s?.potions || 0}</b></button><button type="button" class="consumable coolant" data-action="cool" ${!this.game.active() ? 'disabled' : ''} title="−38° y +12 integridad en todos los injertos intactos · E">${icon('snow')}<span>Refrigerante<small>−38° · repara</small></span><b>×${s?.coolants || 0}</b></button></div>`;
    }

    mapMarkup(large = false) {
      const s = this.game.state;
      const floor = s?.floor || 0;
      let map;
      if (s) map = s.map;
      else {
        map = Array.from({ length: 16 }, (_, id) => ({ id, links: [], seen: id === 12 || id === 3, type: id === 12 ? 'start' : id === 3 ? 'stairs' : 'corridor', visited: id === 12 }));
        for (const [a, b] of [[12, 8], [8, 4], [4, 5], [5, 1], [1, 2], [2, 3], [8, 9], [9, 10], [10, 6], [6, 7], [10, 11], [11, 15], [15, 14], [14, 13], [4, 0]]) {
          map[a].links.push(b); map[b].links.push(a);
        }
      }
      const current = s?.current ?? 12;
      const canMove = s?.phase === 'explore';
      const coordinates = id => [25 + (id % 4) * 50, 25 + Math.floor(id / 4) * 50];
      let edges = '';
      for (const room of map) for (const next of room.links) {
        if (next < room.id) continue;
        const [x1, y1] = coordinates(room.id);
        const [x2, y2] = coordinates(next);
        edges += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" class="${room.visited && map[next].visited ? 'visited-link' : ''}"/>`;
      }
      return `<div class="panel-title"><h2>La torre</h2><span>${icon('tower')}</span></div>
        <div class="floor-stack">${[2, 1, 0].map(i => `<div class="floor-row ${floor === i ? 'active' : floor > i ? 'completed' : ''}"><span class="floor-numeral">${D.floors[i].roman}</span><span>${D.floors[i].small}</span>${floor === i ? '<i class="live-dot"></i>' : floor > i ? icon('check') : icon('lock')}</div>`).join('')}</div>
        <div class="map-heading"><span>PLANO DEL PISO ${D.floors[floor].roman}</span><span>N ↑</span></div>
        <div class="tower-map ${large ? 'large-map' : ''}" aria-label="Plano de pasillos. Puedes entrar en las salas conectadas a tu posición.">
          <svg viewBox="0 0 200 200" class="map-links" aria-hidden="true">${edges}</svg>
          ${map.map(room => {
            const [x, y] = coordinates(room.id);
            const accessible = canMove && map[current].links.includes(room.id);
            const name = room.seen ? D.roomNames[room.type] : 'Sala desconocida';
            return `<button type="button" class="map-node ${room.id === current ? 'current' : ''} ${room.visited ? 'visited' : ''} ${room.seen ? 'seen' : ''} ${accessible ? 'reachable' : ''} ${room.id === 3 ? 'exit-node' : ''}" style="left:${x / 2}%;top:${y / 2}%" data-action="move" data-id="${room.id}" ${accessible ? '' : 'disabled'} aria-label="${name}${room.id === current ? ', estás aquí' : accessible ? ', entrar' : ''}" title="${name}">${room.id === current ? '<span class="you-dot"></span>' : room.seen ? icon(roomIcon[room.type]) : '<span class="unknown-dot"></span>'}</button>`;
          }).join('')}
        </div>
        <div class="map-legend"><span><i class="you-dot"></i> Tú</span><span>${icon('up')} ${floor === 2 ? 'Salida' : 'Escalera'}</span><span><i class="unknown-dot"></i> Oculta</span></div>
        <div class="objective"><span class="eyebrow">OBJETIVO ACTUAL</span><p>${floor === 2 ? 'Derrota al Rector y cruza la última puerta.' : 'Encuentra la escalera y asciende al siguiente piso.'}</p></div>
        <div class="map-tip">${icon('flame')}<span>Los pasillos cambian a los 2 y 4 minutos. El reloj no se detiene.</span></div>`;
    }

    sceneMarkup() {
      const s = this.game.state;
      const phase = s?.phase || 'explore';
      const room = s?.map[s.current];
      const floor = D.floors[s?.floor || 0];
      const fight = phase === 'combat';
      const enemy = s?.enemy;
      const intent = fight ? this.game.intent() : null;
      return `<section class="scene-panel panel">
        <div class="scene-heading"><div><span class="eyebrow">PISO ${floor.roman} <span class="separator">/</span> ${floor.name}</span><h1>${room ? D.roomNames[room.type] : 'Mesa de disección'}</h1></div><span class="phase-badge ${fight ? 'combat-badge' : ''}">${icon(fight ? 'blade' : phase === 'loot' ? 'bag' : 'eye')}${fight ? `COMBATE · TURNO ${s.turn}` : phase === 'loot' ? 'COSECHA' : phase === 'dead' ? 'EL ESPÍRITU PERMANECE' : phase === 'won' ? 'LIBERTAD' : 'EXPLORACIÓN'}</span></div>
        <div class="scene-wrap" id="scene-wrap"><canvas id="scene" width="512" height="276" aria-label="Laboratorio gótico en pixel art. Tu abominación cambia de aspecto con cada injerto."></canvas>
          <div class="scene-topline"><span class="location-label">${icon('tower')} TORRE DE LA MISERICORDIA</span><span class="scene-coordinates">${String(s?.current ?? 12).padStart(2, '0')} : ${floor.roman}</span></div>
          ${fight ? `<div class="combat-info"><div class="player-chip"><span>${icon('shield')} ${s.block} DEFENSA</span></div><div class="enemy-chip"><span class="enemy-kind">${D.enemies[enemy.id].tag}</span><h3>${D.enemies[enemy.id].name}</h3><div class="enemy-health"><i style="width:${enemy.hp / enemy.maxHp * 100}%"></i></div><div class="enemy-numbers"><span>${enemy.hp} / ${enemy.maxHp} PV</span><span>${enemy.block ? `◈ ${enemy.block}` : ''}${enemy.burn ? ` · ${enemy.burn} quemadura` : ''}${enemy.weak ? ' · débil' : ''}</span></div></div></div><div class="enemy-intent ${intent.kind}">${icon(intent.icon)}<span>${intent.label}</span></div>` : ''}
          <div class="scene-bottomline"><span>${s ? `${s.stats.rooms} salas recorridas` : 'UN NUEVO CUERPO. UNA ÚLTIMA OPORTUNIDAD.'}</span><span>${s ? `SEMILLA ${s.seed.toString(16).slice(0, 6).toUpperCase()}` : '06:00'}</span></div>
        </div>
        ${this.eventMarkup()}
      </section>`;
    }

    eventMarkup() {
      const s = this.game.state;
      if (!s) return `<div class="room-event"><div class="event-copy"><h3>Algo dentro de ti se niega a morir.</h3><p>Tu cuerpo es tu mazo. Cada injerto, una nueva posibilidad.</p></div>${this.button('start', 'Reanimar', 'bolt', 'primary')}</div>`;
      if (s.phase === 'combat') {
        const intent = this.game.intent();
        const projected = ['attack', 'fury'].includes(intent.kind) ? Math.max(0, intent.value - s.block) : null;
        return `<div class="combat-guidance"><span>${icon('eye')} <strong>Tu turno.</strong> Juega cartas; después, termina el turno.</span><span>${projected !== null ? `Recibirías <b class="${projected ? 'text-red' : 'text-green'}">${projected}</b> de daño.` : intent.kind === 'heat' ? 'El vapor puede romper tus injertos.' : intent.kind === 'stunned' ? 'La intención enemiga está cancelada.' : 'El enemigo prepara su defensa.'}</span></div>`;
      }
      if (s.phase === 'loot') {
        const reward = s.reward;
        return `<div class="room-event loot-event"><span class="event-emblem">${icon('bag')}</span><div class="event-copy"><span class="eyebrow text-green">ENEMIGO COSECHADO</span><h3>${D.parts[reward.id].name}</h3><p>En tu bolsa · +${reward.scraps} chatarra · +5 vida. El plano es permanente.</p></div><div class="event-actions">${this.button('bag', 'Injertar', 'bone', 'primary')}${this.button('continue-loot', reward.boss ? 'Hacia la salida' : 'Continuar', 'right')}</div></div>`;
      }
      if (s.phase === 'dead' || s.phase === 'won') {
        return `<div class="room-event"><div class="event-copy"><h3>${s.phase === 'won' ? 'Has escapado de la torre.' : 'La carne falla. El espíritu no.'}</h3><p>${s.reason}</p></div>${this.button('end', 'Ver resultado', 'right')}</div>`;
      }
      const room = s.map[s.current];
      if (s.phase === 'event') {
        if (room.type === 'cache') return `<div class="room-event"><div class="event-copy"><span class="eyebrow text-gold">SUMINISTROS</span><h3>Alguien no llegó a usarlos.</h3><p>Un injerto, chatarra, suero y refrigerante. Todo puede servir.</p></div><div class="event-actions">${this.button('cache', 'Recoger todo', 'bag', 'primary')}</div></div>`;
        if (room.type === 'archive') return `<div class="room-event"><div class="event-copy"><span class="eyebrow text-green">CONOCIMIENTO PERMANENTE</span><h3>El conocimiento sobrevive a la carne.</h3><p>Descubre un plano. Podrás fabricarlo en las estaciones de injertos.</p></div><div class="event-actions">${this.button('search-archive', 'Guardar plano', 'book', 'primary')}</div></div>`;
        if (room.type === 'workshop') return `<div class="room-event workshop-event"><div class="event-copy"><span class="eyebrow text-green">ESTACIÓN DE INJERTOS</span><h3>La mesa aún está tibia.</h3><p>Fabrica planos o repara +40 de integridad y enfría todos tus injertos intactos.</p></div><div class="event-actions">${this.button('archive', 'Fabricar', 'flask', 'primary')}${this.button('repair', 'Reparar · 8 chatarra', 'gear')}${this.button('leave-workshop', 'Continuar', 'right', 'quiet')}</div></div>`;
        if (room.type === 'trap') return `<div class="room-event trap-event"><div class="event-copy"><span class="eyebrow text-red">TRAMPA · VAPOR A PRESIÓN</span><h3>El pasillo está a punto de estallar.</h3><p>Desvía la válvula, fuerza tus piernas o acepta las quemaduras.</p></div><div class="event-actions">${this.button('trap-scraps', 'Desviar · 5 chatarra', 'gear', 'primary', s.scraps < 5 ? 'disabled' : '')}${this.button('trap-legs', 'Saltar · +30° / −12 integridad', 'foot', '', !s.body.legL.id && !s.body.legR.id ? 'disabled' : '')}${this.button('trap-cross', `Cruzar · −${9 + s.floor * 2} vida`, 'flame', 'danger-outline')}</div></div>`;
      }
      if (room.type === 'stairs') return `<div class="room-event"><div class="event-copy"><span class="eyebrow text-green">HACIA ARRIBA</span><h3>La salida está un poco más cerca.</h3><p>Subir enfría tus injertos 15°. No hay vuelta al piso anterior.</p></div><div class="event-actions">${this.button('ascend', `Subir al piso ${D.floors[s.floor + 1].roman}`, 'up', 'primary')}</div></div>${this.movementMarkup()}`;
      if (room.type === 'boss' && room.resolved) return `<div class="room-event"><div class="event-copy"><span class="eyebrow text-green">LA PUERTA ESTÁ ABIERTA</span><h3>El aire de afuera no huele a muerte.</h3><p>Cruza antes de que el reloj llegue a cero.</p></div><div class="event-actions">${this.button('escape', 'Escapar de la torre', 'right', 'primary escape-button')}</div></div>`;
      return `<div class="room-event exploration-event"><div class="event-copy"><h3>${room.type === 'start' ? 'Levántate. Todavía queda tiempo.' : room.type === 'workshop' ? 'Aún puedes usar la estación.' : 'Sigue avanzando.'}</h3><p>${room.type === 'workshop' ? 'Los planos descubiertos se fabrican con chatarra.' : 'Escoge un pasillo conectado. La escalera está marcada en el plano.'}</p></div>${room.type === 'workshop' ? this.button('archive', 'Fabricar', 'flask') : ''}</div>${this.movementMarkup()}`;
    }

    movementMarkup() {
      const s = this.game.state;
      const directions = [['north', 'Norte', 'up', -4], ['west', 'Oeste', 'left', -1], ['east', 'Este', 'right', 1], ['south', 'Sur', 'down', 4]];
      return `<nav class="movement" aria-label="Pasillos disponibles">${directions.map(([id, label, symbol, delta]) => {
        const target = s.current + delta;
        const enabled = s.phase === 'explore' && s.map[s.current].links.includes(target);
        return this.button('direction', label, symbol, 'direction-button', `data-direction="${id}" ${enabled ? '' : 'disabled'} aria-label="Ir al ${label.toLowerCase()}${enabled ? '' : ', no hay pasillo'}"`);
      }).join('')}<span class="movement-hint">W A S D <span>/</span> FLECHAS</span></nav>`;
    }

    cardMarkup(card, index = 0, preview = false, detail = false) {
      const def = D.cards[card.id];
      const part = card.part ? D.parts[card.part] : null;
      const slot = D.slots.find(v => v.id === card.slot);
      const s = this.game.state;
      const bodyPart = s?.body[card.slot];
      const color = part?.color || '#bc8471';
      const affordable = !s || def.cost <= s.energy;
      const overheats = bodyPart?.id && (Math.max(0, bodyPart.heat - (def.cool || 0)) + def.heat >= 100
        || bodyPart.integrity <= def.wear + (bodyPart.heat + def.heat >= 75 ? 7 : 0));
      const tag = detail ? 'div' : 'button';
      return `<${tag} ${detail ? '' : 'type="button"'} class="anatomy-card ${preview ? 'preview-card' : ''} ${overheats && !preview ? 'will-break' : ''} ${!part ? 'stump-card' : ''}" style="--part-color:${color}" ${detail ? '' : `data-action="play" data-id="${card.uid}" ${preview || !affordable ? 'disabled' : ''}`} ${detail ? '' : `aria-label="${def.name}. ${def.cost} energía. ${def.text} Calor más ${def.heat}, desgaste ${def.wear}.${overheats ? ' Atención: se romperá el injerto.' : ''}"`}>
        <div class="card-top"><span class="energy-cost">${def.cost}</span><span class="card-origin">${slot?.short || kindLabel[part?.kind] || 'MUÑÓN'}</span><kbd>${index + 1}</kbd></div>
        <div class="card-art">${pixelArt(def.icon, color)}</div>
        <h3>${def.name}</h3><p>${def.text}</p>
        <div class="card-bottom">${def.heat ? `<span>${icon('flame')} +${def.heat}°</span><span>${overheats && !preview ? '¡ROTURA!' : `−${def.wear}%`}</span>` : '<span>MUÑÓN</span><span>Sin injerto</span>'}</div>
      </${tag}>`;
    }

    handMarkup() {
      const s = this.game.state;
      const combat = s?.phase === 'combat';
      const body = s?.body || this.art.defaultBody();
      const previews = ['armL', 'torso', 'head', 'armR', 'legR'].map(slot => {
        const part = body[slot];
        const fallback = { head: 'stumpHead', torso: 'stumpTorso', armL: 'stumpArm', armR: 'stumpArm', legR: 'stumpLeg' };
        return { id: part.id ? D.parts[part.id].cards[0] : fallback[slot], part: part.id, slot, uid: 0 };
      });
      const cards = combat ? s.hand : previews;
      return `<section class="hand-section" aria-label="${combat ? 'Tu mano de cartas' : 'Cartas de tu cuerpo'}">
        <div class="hand-header"><div><h2>${combat ? 'Tu mano' : 'Tu cuerpo es tu mazo'}</h2><span>${combat ? `${s.hand.length} CARTAS · ROBA ${s.draw.length} · DESCARTE ${s.discard.length}` : 'CADA INJERTO CAMBIA TUS CARTAS'}</span></div><button type="button" data-action="deck" class="text-button">Ver mazo ${icon('book')}</button></div>
        <div class="hand ${cards.length > 5 ? 'many-cards' : ''}">${cards.map((card, i) => this.cardMarkup(card, i, !combat)).join('') || '<div class="empty-hand">No quedan cartas en tu mano. Termina el turno para robar otras cinco.</div>'}</div>
        <div class="turn-bar"><div class="energy-display">${icon('bolt')}<strong>${combat ? s.energy : '—'}<small> / 3</small></strong><div><b>ENERGÍA</b><span>${combat ? 'Se recupera al terminar el turno' : 'Disponible durante el combate'}</span></div></div>${this.button('end-turn', 'Terminar turno <kbd>ESPACIO</kbd>', 'right', combat ? 'primary turn-button' : 'turn-button', combat ? '' : 'disabled')}</div>
      </section>`;
    }

    modalShell(title, eyebrow, body, extraClass = '') {
      return `<div class="modal-backdrop" data-overlay="true"><section class="modal ${extraClass}" role="dialog" aria-modal="true" aria-labelledby="modal-title"><header class="modal-header"><div><span class="eyebrow">${eyebrow}</span><h2 id="modal-title">${title}</h2></div>${this.button('close', '', 'close', 'icon-only quiet', 'aria-label="Cerrar ventana"')}</header>${this.game.active() ? '<div class="modal-clock-note">El reloj sigue corriendo. <strong class="modal-live-clock"></strong></div>' : ''}<div class="modal-body">${body}</div></section></div>`;
    }

    modalMarkup() {
      const s = this.game.state;
      if (!this.modal) return '';
      if (this.modal === 'intro') return `<div class="modal-backdrop intro-backdrop"><section class="intro-modal" role="dialog" aria-modal="true" aria-labelledby="intro-title"><div class="intro-kicker"><span></span> UN ROGUELIKE ANATÓMICO <span></span></div><div class="intro-sigil">${icon('skull')}</div><h2 id="intro-title">Un cuerpo prestado.<br><em>Seis minutos de vida.</em></h2><p>La torre arde. Cosecha a quienes te detengan.<br>Injerta sus extremidades. Escapa antes del colapso.</p><div class="intro-pillars"><span>${icon('bone')} TU CUERPO ES TU MAZO</span><span>${icon('clock')} 06:00 REALES</span></div>${this.button('start', 'Reanimar', 'bolt', 'primary intro-start')}<div class="intro-footer">${this.button('help', 'Cómo sobrevivir', 'help', 'quiet')}<span>Ratón · teclado · táctil · mando</span></div><small class="content-note">Horror anatómico estilizado · audio activado al interactuar</small></section></div>`;
      if (this.modal === 'bag') {
        const content = s?.inventory.length ? s.inventory.map(item => this.inventoryItem(item)).join('') : `<div class="empty-state">${icon('bag')}<h3>La bolsa está vacía.</h3><p>Derrota enemigos, recoge suministros o fabrica un plano en una estación de injertos.</p></div>`;
        return this.modalShell('Bolsa de injertos', `${s?.inventory.length || 0} EXTREMIDADES RECUPERADAS`, `<p class="modal-intro">${s?.phase === 'combat' ? '<strong>Injertar cuesta 1 de energía.</strong> Las cartas del injerto anterior desaparecen de inmediato.' : 'Elige dónde injertar. La pieza que reemplaces vuelve a la bolsa con su calor y desgaste actuales.'}</p><div class="inventory-list">${content}</div>`);
      }
      if (this.modal === 'part') {
        const slot = D.slots.find(v => v.id === this.part);
        const part = (s?.body || this.art.defaultBody())[this.part];
        const def = part.id ? D.parts[part.id] : null;
        const fallback = { head: 'stumpHead', torso: 'stumpTorso', arm: 'stumpArm', leg: 'stumpLeg' };
        const ids = def ? def.cards : [fallback[slot.kind]];
        const available = s?.inventory.filter(p => D.parts[p.id].kind === slot.kind) || [];
        return this.modalShell(def?.name || 'Solo queda un muñón', slot.label.toUpperCase(), `<p class="lore">${def?.lore || 'El injerto se ha roto. Todas sus cartas han desaparecido de tu mazo.'}</p><div class="part-stats"><span>${icon('flame')} Calor <b>${part.heat}° / 100°</b></span><span>${icon('shield')} Integridad <b>${part.integrity}%</b></span></div><p class="modal-intro">A 100° o 0% de integridad, el injerto se rompe. Desde 75°, cada uso causa 7 de desgaste adicional. Terminar turno enfría 12°; cambiar de sala, 7°.</p><div class="detail-cards">${ids.map((id, i) => this.cardMarkup({ id, slot: slot.id, part: part.id, uid: 0 }, i, true, true)).join('')}</div><h3 class="section-caption">Reemplazos disponibles</h3>${available.length ? available.map(item => this.inventoryItem(item, slot.id)).join('') : '<p class="muted">No tienes un reemplazo compatible. Busca enemigos o suministros.</p>'}`);
      }
      if (this.modal === 'body') return this.modalShell('Tu cuerpo', 'SEIS RANURAS · UN SOLO ESPÍRITU', `<div class="mobile-anatomy">${this.anatomyMarkup(true)}</div>`);
      if (this.modal === 'map') return this.modalShell('Camino a la salida', 'LOS PASILLOS NUNCA SON LOS MISMOS', this.mapMarkup(true), 'map-modal');
      if (this.modal === 'archive') {
        const known = this.game.meta.blueprints.length;
        const station = this.game.atWorkshop();
        const entries = Object.entries(D.parts).filter(([, part]) => this.filter === 'all' || part.kind === this.filter);
        return this.modalShell('Archivo anatómico', `${known} / ${Object.keys(D.parts).length} PLANOS DESCUBIERTOS`, `<p class="modal-intro">Los planos sobreviven a la muerte. ${station ? '<strong>Estás en una estación: puedes fabricar con chatarra.</strong>' : 'Para fabricar, visita una estación de injertos en la torre.'}</p><div class="filter-tabs" role="group" aria-label="Filtrar planos">${[['all', 'Todos'], ['head', 'Cabezas'], ['torso', 'Torsos'], ['arm', 'Brazos'], ['leg', 'Piernas']].map(([id, label]) => `<button type="button" class="${this.filter === id ? 'selected' : ''}" data-action="filter" data-filter="${id}" aria-pressed="${this.filter === id}">${label}</button>`).join('')}</div><div class="blueprint-grid">${entries.map(([id, part]) => {
          const unlocked = this.game.meta.blueprints.includes(id);
          const cost = 6 + part.tier * 5;
          return `<article class="blueprint ${unlocked ? '' : 'locked'}"><div class="blueprint-top"><span class="tier tier-${part.tier}">${unlocked ? tierLabel[part.tier] : 'DESCONOCIDO'}</span>${icon(unlocked ? (part.kind === 'head' ? 'skull' : part.kind === 'torso' ? 'heart' : part.kind === 'arm' ? 'bone' : 'foot') : 'lock')}</div><h3>${unlocked ? part.name : part.expansion && !this.game.meta.expansion ? 'Plano del ala prohibida' : `${kindLabel[part.kind]} sin descubrir`}</h3><p>${unlocked ? part.cards.map(card => D.cards[card].name).join(' · ') : part.expansion && !this.game.meta.expansion ? 'Desbloquea el ala en el relicario.' : 'Explora, cosecha o consulta los archivos de la torre.'}</p>${unlocked ? this.button('craft', `Fabricar · ${cost}`, 'gear', 'small', `data-id="${id}" ${!station || s.scraps < cost ? 'disabled' : ''}`) : '<span class="locked-label">EL CONOCIMIENTO PERDURA</span>'}</article>`;
        }).join('')}</div>`, 'wide-modal');
      }
      if (this.modal === 'deck') {
        const body = s?.body || this.art.defaultBody();
        const cards = D.slots.flatMap(slot => {
          const part = body[slot.id];
          const fallback = { head: 'stumpHead', torso: 'stumpTorso', arm: 'stumpArm', leg: 'stumpLeg' };
          return (part.id ? D.parts[part.id].cards : [fallback[slot.kind]]).map(id => ({ id, slot: slot.id, part: part.id, uid: 0 }));
        });
        return this.modalShell('Tu mazo anatómico', `${cards.length} CARTAS · CADA UNA PERTENECE A UN INJERTO`, `<p class="modal-intro">Empiezas cada combate con 5 cartas y 3 de energía. Al terminar turno descartas la mano, enfrías 12° y robas 5. El descarte se baraja cuando se acaba el mazo. Máximo 7 cartas en mano.</p><div class="deck-grid">${cards.map((card, i) => this.cardMarkup(card, i, true, true)).join('')}</div>`, 'wide-modal');
      }
      if (this.modal === 'shop') return this.modalShell('El relicario', `${this.game.meta.souls} ECOS DEL ESPÍRITU`, `<div class="shop-notice">${icon('coin')}<p><strong>Sin compras con dinero real.</strong> Este prototipo usa ecos ganados al completar intentos. Los cosméticos no alteran tus estadísticas.</p></div><div class="skin-grid">${Object.entries(D.skins).map(([id, skin]) => {
        const owned = this.game.meta.skins.includes(id);
        const active = this.game.meta.skin === id;
        return `<article class="skin-card"><div class="skin-swatch" style="--skin:${skin.color}">${pixelArt('heart', skin.color)}<span>${icon('skull')}</span></div><h3>${skin.name}</h3><p>${skin.description}</p>${this.button('buy', active ? 'Equipada' : owned ? 'Equipar' : `Desbloquear · ${skin.cost} ecos`, active ? 'check' : 'coin', active ? 'small equipped' : 'small', `data-id="${id}" ${active || (!owned && this.game.meta.souls < skin.cost) ? 'disabled' : ''}`)}</article>`;
      }).join('')}</div><article class="expansion-card"><div><span class="eyebrow">CONTENIDO ADICIONAL</span><h3>El ala prohibida</h3><p>Abre los encuentros del Archivista de ceniza y su cráneo exclusivo, con dos nuevas cartas. Disponible en los próximos encuentros.</p></div>${this.button('buy', this.game.meta.expansion ? 'Ala desbloqueada' : 'Abrir · 30 ecos', this.game.meta.expansion ? 'check' : 'lock', 'primary small', `data-id="expansion" ${this.game.meta.expansion || this.game.meta.souls < 30 ? 'disabled' : ''}`)}</article>`, 'wide-modal');
      if (this.modal === 'settings') return this.modalShell('Ajustes', 'LA TORRE NO ESPERA', `<div class="setting-row"><label for="volume">Volumen general<small>Música sintetizada y efectos viscerales.</small></label><div class="volume-control"><input type="range" id="volume" min="0" max="100" value="${Math.round(this.game.meta.volume * 100)}" data-preference="volume"><output id="volume-output">${Math.round(this.game.meta.volume * 100)}%</output></div></div><div class="setting-row"><label for="sfx">Efectos de sonido<small>Impactos, injertos y señales del laboratorio.</small></label><input type="checkbox" id="sfx" data-preference="sfx" ${this.game.meta.sfx ? 'checked' : ''}></div><div class="setting-row"><label for="motion">Animaciones ambientales<small>Desactiva movimiento, partículas animadas y sacudidas.</small></label><input type="checkbox" id="motion" data-preference="motion" ${this.game.meta.motion ? 'checked' : ''}></div><div class="setting-row"><div>Pantalla completa<small>Disponible cuando el navegador lo permite.</small></div>${this.button('fullscreen', 'Alternar', 'fullscreen', 'small')}</div><div class="save-note">${icon('check')} ${this.game.storageAvailable ? 'Guardado automático en este navegador. El reloj continúa al cerrar o recargar.' : 'El guardado está bloqueado. Puedes jugar, pero se perderá el progreso al cerrar.'}</div>${this.game.active() ? `<div class="abandon-row">${this.button('confirm-abandon', 'Abandonar este cuerpo', 'skull', 'danger-outline')}<p>Conservarás los planos descubiertos.</p></div>` : ''}`);
      if (this.modal === 'confirm-abandon') return this.modalShell('¿Abandonar este cuerpo?', 'ESTE INTENTO TERMINARÁ', `<p class="modal-intro">Perderás tus injertos, suministros y chatarra de este intento. Los planos descubiertos y los ecos permanecen.</p><div class="confirm-actions">${this.button('close', 'Seguir luchando', 'shield', 'primary')}${this.button('abandon', 'Abandonar y volver a la mesa', 'skull', 'danger-outline')}</div>`);
      if (this.modal === 'help') return this.modalShell('Cómo sobrevivir', 'EL RELOJ ANATÓMICO', `<div class="help-lead">No necesitas un mazo mejor.<br><em>Necesitas un cuerpo mejor.</em></div><div class="help-grid"><article><span>01</span><h3>Explora y asciende</h3><p>Recorre los pasillos conectados. Llega a la escalera del noreste en los pisos I y II. En el III, derrota al Rector y pulsa <strong>Escapar de la torre</strong>.</p></article><article><span>02</span><h3>Combate por turnos</h3><p>Tienes <strong>3 de energía</strong>. Las cartas muestran su coste arriba a la izquierda. La intención enemiga te dice qué ocurrirá al terminar turno. La defensa dura hasta entonces.</p></article><article><span>03</span><h3>Cosecha e injerta</h3><p>Los enemigos derrotados dejan extremidades en tu bolsa. Cada injerto aporta <strong>2 cartas</strong>. Cambiarlo quita las anteriores; en combate cuesta 1 de energía.</p></article><article><span>04</span><h3>No te consumas</h3><p>A <strong>100° o 0% de integridad</strong>, el injerto se rompe y solo te queda una carta de muñón. Desde 75°, cada uso añade 7 de desgaste. Enfría 12° por turno o 7° al moverte.</p></article><article><span>05</span><h3>Usa lo que encuentres</h3><p>Suero: +28 vida. Refrigerante: −38° y +12 integridad. Fabrica los planos descubiertos con chatarra en las estaciones de injertos.</p></article><article><span>06</span><h3>Muere, aprende, vuelve</h3><p>Son <strong>6 minutos de tiempo real</strong>, incluso en menús o fuera de la pestaña. Al morir vuelves a una mesa con otro cuerpo y otra torre. Los planos y ecos permanecen.</p></article></div><div class="controls-grid"><div>${icon('settings')}<h3>Teclado y ratón</h3><p>WASD / flechas: moverse<br>1–7: jugar carta · Espacio: terminar turno<br>Q: suero · E: refrigerante<br>I: injertos · M: mapa · Esc: cerrar</p></div><div>${icon('gamepad')}<h3>Táctil y mando</h3><p>Toca las cartas, pasillos y botones.<br>Mando estándar: cruceta / stick para moverte o elegir · A: confirmar · B: cerrar<br>RB: terminar turno · X / Y: suministros</p></div></div><p class="help-fineprint">Quemadura: daño al terminar turno, baja 1 por turno. Debilidad: reduce un 40% el ataque. Aturdimiento: cancela la siguiente intención. El tiempo no se pausa.</p>`,'wide-modal');
      if (this.modal === 'log') return this.modalShell('Bitácora del cuerpo', 'LOS ÚLTIMOS 24 ACONTECIMIENTOS', `<ol class="journal-list">${(s?.log || ['Aún no has despertado.']).map(line => `<li>${escapeHtml(line)}</li>`).join('')}</ol>`);
      if (this.modal === 'end' && s) {
        const won = s.phase === 'won';
        return `<div class="modal-backdrop end-backdrop"><section class="end-modal ${won ? 'won' : ''}" role="dialog" aria-modal="true" aria-labelledby="end-title"><div class="end-symbol">${icon(won ? 'tower' : 'skull')}</div><span class="eyebrow">${won ? 'EL CIELO TODAVÍA EXISTE' : 'EL ESPÍRITU HA ENCONTRADO OTRA MESA'}</span><h2 id="end-title">${won ? 'Este cuerpo es tuyo.' : 'La carne no era eterna.'}</h2><p>${s.reason}</p><div class="result-grid"><div><strong>${s.stats.kills}</strong><span>ENEMIGOS COSECHADOS</span></div><div><strong>${s.stats.grafts}</strong><span>INJERTOS REALIZADOS</span></div><div><strong>${s.stats.discovered}</strong><span>PLANOS DESCUBIERTOS</span></div><div><strong>+${s.earnedSouls || 0}</strong><span>ECOS CONSERVADOS</span></div></div><div class="result-clock">${icon('clock')} ${won ? `Escapaste en ${timeLabel(360000 - s.remainingAtEnd)} · ${timeLabel(s.remainingAtEnd)} restantes` : `Piso ${D.floors[s.floor].roman} · ${s.stats.rooms} salas recorridas`}</div><div class="end-actions">${this.button('start', 'Reanimar otro cuerpo', 'bolt', 'primary')}${this.button('shop', 'Abrir relicario', 'coin')}</div><small>Tus ${this.game.meta.blueprints.length} planos permanecen. Tu próxima torre será distinta.</small></section></div>`;
      }
      return '';
    }

    inventoryItem(item, onlySlot = null) {
      const part = D.parts[item.id];
      const slots = D.slots.filter(slot => slot.kind === part.kind && (!onlySlot || slot.id === onlySlot));
      const energy = this.game.state?.phase !== 'combat' || this.game.state.energy >= 1;
      return `<article class="inventory-item"><div class="inventory-symbol" style="color:${part.color}">${icon(part.kind === 'head' ? 'skull' : part.kind === 'torso' ? 'heart' : part.kind === 'arm' ? 'bone' : 'foot')}</div><div class="inventory-description"><span class="eyebrow">${kindLabel[part.kind]} · ${tierLabel[part.tier]} <span class="inventory-condition">${item.integrity}% / ${item.heat}°</span></span><h3>${part.name}</h3><p>${part.cards.map(id => D.cards[id].name).join(' · ')}</p><div class="inventory-actions">${slots.map(slot => this.button('equip', `Injertar: ${slot.short}`, 'bone', 'small', `data-id="${item.uid}" data-slot="${slot.id}" ${energy ? '' : 'disabled'}`)).join('')}${this.button('salvage', `Desguazar +${part.tier * 3}`, 'gear', 'small quiet', `data-id="${item.uid}"`)}</div></div></article>`;
    }

    render() {
      const active = document.activeElement;
      const focus = active?.dataset?.action ? { action: active.dataset.action, id: active.dataset.id, slot: active.dataset.slot, direction: active.dataset.direction, filter: active.dataset.filter } : null;
      const oldModal = this.root.querySelector('.modal-body');
      const scroll = oldModal?.scrollTop || 0;
      const s = this.game.state;
      document.body.classList.toggle('reduce-motion', !this.game.meta.motion);
      document.body.classList.toggle('has-modal', Boolean(this.modal));
      this.root.innerHTML = `${this.header()}<main class="game-shell" ${this.modal ? 'inert' : ''}>${this.statusBar()}<div class="game-grid"><aside class="panel anatomy-panel">${this.anatomyMarkup()}</aside><div class="center-column">${this.sceneMarkup()}${this.handMarkup()}</div><aside class="panel map-panel">${this.mapMarkup()}<div class="run-record"><span class="eyebrow">EL ESPÍRITU RECUERDA</span><div><span>Planos</span><strong>${this.game.meta.blueprints.length} / ${Object.keys(D.parts).length}</strong></div><div><span>Escapes</span><strong>${this.game.meta.wins}</strong></div>${this.game.meta.best ? `<div><span>Mejor tiempo</span><strong>${timeLabel(this.game.meta.best)}</strong></div>` : ''}</div></aside></div><footer class="game-footer"><button type="button" class="journal-preview" data-action="log">${icon('log')}<span>${escapeHtml(s?.log[0] || 'La muerte es solo el principio del procedimiento.')}</span>${icon('right')}</button><span class="version-label">PROTOTIPO 1.0 <i></i> GUARDADO ${this.game.storageAvailable ? 'LOCAL' : 'NO DISPONIBLE'}</span></footer></main><nav class="mobile-toolbar" aria-label="Paneles del juego" ${this.modal ? 'inert' : ''}>${this.button('body', 'Cuerpo', 'skull', 'quiet')}${this.button('bag', `Injertos${s?.inventory.length ? ` · ${s.inventory.length}` : ''}`, 'bag', 'quiet')}${this.button('map', 'Mapa', 'map', 'quiet')}${this.button('archive', 'Planos', 'book', 'quiet')}</nav>${this.modalMarkup()}`;
      this.root.querySelector('.topbar')?.toggleAttribute('inert', Boolean(this.modal));
      this.art.bind();
      if (this.root.querySelector('#modal-body')) this.art.anatomy = this.root.querySelector('#modal-body');
      this.updateClock();
      const modalBody = this.root.querySelector('.modal-body');
      if (modalBody && oldModal) modalBody.scrollTop = scroll;
      if (focus) {
        const candidates = [...this.root.querySelectorAll('[data-action]')];
        const target = candidates.find(el => el.dataset.action === focus.action && el.dataset.id === focus.id
          && el.dataset.slot === focus.slot && el.dataset.direction === focus.direction && el.dataset.filter === focus.filter
          && !el.disabled && !el.closest('[inert]'));
        if (target) target.focus({ preventScroll: true });
      }
    }

    updateClock() {
      const remaining = this.game.remaining();
      const clock = document.getElementById('clock');
      if (clock) clock.textContent = timeLabel(remaining);
      const fill = document.getElementById('clock-fill');
      if (fill) fill.style.width = `${Math.max(0, Math.min(100, remaining / 360000 * 100))}%`;
      const clockBlock = document.getElementById('clock-block');
      if (clockBlock) clockBlock.classList.toggle('critical', remaining < 60000 && this.game.active());
      for (const element of document.querySelectorAll('.modal-live-clock')) element.textContent = timeLabel(remaining);
      const header = this.root.querySelector('.header-middle');
      if (header && !this.game.active() && this.game.state) header.innerHTML = `<span class="live-dot"></span> ${this.game.state.phase === 'won' ? 'HAS ESCAPADO DE LA TORRE' : 'EL ESPÍRITU PERMANECE'}`;
    }

    openModal(name) {
      this.modal = name;
      this.render();
      const primary = this.root.querySelector('.modal-backdrop .primary:not(:disabled)');
      (primary || this.root.querySelector('.modal-backdrop button'))?.focus({ preventScroll: true });
    }

    closeModal() {
      this.modal = !this.game.state ? 'intro' : this.game.active() ? null : 'end';
      this.render();
    }

    handleClick(event) {
      const el = event.target.closest('[data-action]');
      if (!el || el.disabled) return;
      event.preventDefault();
      this.audio.unlock();
      const action = el.dataset.action;
      const g = this.game;
      if (action === 'start') { this.modal = null; g.start(); return; }
      if (action === 'home') { this.openModal(g.state ? 'help' : 'intro'); return; }
      if (action === 'close') { this.closeModal(); return; }
      if (['bag', 'body', 'map', 'archive', 'shop', 'settings', 'help', 'deck', 'log', 'end', 'confirm-abandon'].includes(action)) { this.openModal(action); return; }
      if (action === 'part') { this.part = el.dataset.slot; this.openModal('part'); return; }
      if (action === 'filter') { this.filter = el.dataset.filter; this.render(); return; }
      if (action === 'sound') {
        if (g.meta.volume) { this.previousVolume = g.meta.volume; g.setPreference('volume', 0); }
        else g.setPreference('volume', this.previousVolume || 0.3);
        this.render(); return;
      }
      if (action === 'fullscreen') {
        if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
        else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => this.toast({ text: 'Este navegador no permite pantalla completa aquí.' }));
        else this.toast({ text: 'Este navegador no ofrece pantalla completa.' });
        return;
      }
      if (action === 'buy') { g.buy(el.dataset.id); return; }
      if (action === 'move') { if (g.active()) this.modal = null; g.move(Number(el.dataset.id)); return; }
      if (action === 'direction') { g.moveDirection(el.dataset.direction); return; }
      if (action === 'play') { g.play(Number(el.dataset.id)); return; }
      if (action === 'equip') { g.equip(Number(el.dataset.id), el.dataset.slot); return; }
      if (action === 'salvage') { g.salvage(Number(el.dataset.id)); return; }
      if (action === 'craft') { g.craft(el.dataset.id); return; }
      if (action === 'end-turn') { g.endTurn(); return; }
      if (action === 'heal') { g.useItem('heal'); return; }
      if (action === 'cool') { g.useItem('cool'); return; }
      if (action === 'cache') { g.collectCache(); return; }
      if (action === 'search-archive') { g.searchArchive(); return; }
      if (action.startsWith('trap-')) { g.resolveTrap(action.slice(5)); return; }
      if (action === 'repair') { g.repair(); return; }
      if (action === 'leave-workshop') { g.leaveWorkshop(); return; }
      if (action === 'continue-loot') { g.continueAfterLoot(); return; }
      if (action === 'ascend') { g.ascend(); return; }
      if (action === 'escape') { g.escape(); return; }
      if (action === 'abandon') { this.modal = null; g.finish(false, 'Has dejado atrás este cuerpo. Tu espíritu encuentra otra mesa de disección.'); }
    }

    handleInput(event) {
      const name = event.target.dataset.preference;
      if (!name) return;
      this.audio.unlock();
      this.game.setPreference(name, name === 'volume' ? Number(event.target.value) / 100 : event.target.checked);
      if (name === 'volume') document.getElementById('volume-output').textContent = `${event.target.value}%`;
      if (name === 'motion') document.body.classList.toggle('reduce-motion', !event.target.checked);
    }

    handleKey(event) {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(event.target.tagName)) return;
      if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
      const key = event.key.toLowerCase();
      if (this.modal) {
        if (key === 'escape') { event.preventDefault(); this.closeModal(); }
        if (key === 'tab') {
          const focusables = [...this.root.querySelectorAll('.modal-backdrop button:not(:disabled), .modal-backdrop input')].filter(el => el.getClientRects().length);
          const first = focusables[0];
          const last = focusables[focusables.length - 1];
          if (event.shiftKey && (document.activeElement === first || !this.root.querySelector('.modal-backdrop')?.contains(document.activeElement))) { event.preventDefault(); last?.focus(); }
          else if (!event.shiftKey && (document.activeElement === last || !this.root.querySelector('.modal-backdrop')?.contains(document.activeElement))) { event.preventDefault(); first?.focus(); }
        }
        return;
      }
      const directions = { w: 'north', arrowup: 'north', s: 'south', arrowdown: 'south', a: 'west', arrowleft: 'west', d: 'east', arrowright: 'east' };
      if (directions[key] && this.game.state?.phase === 'explore') { event.preventDefault(); this.audio.unlock(); this.game.moveDirection(directions[key]); }
      else if (/^[1-7]$/.test(key) && this.game.state?.phase === 'combat') {
        event.preventDefault(); this.audio.unlock();
        const card = this.game.state.hand[Number(key) - 1];
        if (card) this.game.play(card.uid);
      } else if (key === ' ' && this.game.state?.phase === 'combat') { event.preventDefault(); this.audio.unlock(); this.game.endTurn(); }
      else if (key === 'q') { event.preventDefault(); this.game.useItem('heal'); }
      else if (key === 'e') { event.preventDefault(); this.game.useItem('cool'); }
      else if (key === 'i') this.openModal('bag');
      else if (key === 'm') this.openModal('map');
      else if (key === 'escape') this.openModal('settings');
    }

    setupGamepad() {
      let previous = [];
      let directionAt = 0;
      let connected = false;
      const navigate = direction => {
        if (!this.modal && this.game.state?.phase === 'explore') { this.game.moveDirection(direction); return; }
        const scope = this.modal ? '.modal-backdrop' : '.game-shell';
        const buttons = [...this.root.querySelectorAll(`${scope} button:not(:disabled), ${scope} input`)]
          .filter(el => el.getClientRects().length && !el.closest('[inert]'));
        if (!buttons.length) return;
        const focused = document.activeElement;
        if (focused?.matches('input[type=range]') && ['east', 'west'].includes(direction)) {
          direction === 'east' ? focused.stepUp(5) : focused.stepDown(5);
          focused.dispatchEvent(new Event('input', { bubbles: true }));
          return;
        }
        if (!buttons.includes(focused)) {
          (this.root.querySelector(`${scope} .anatomy-card:not(:disabled)`) || buttons[0]).focus();
          return;
        }
        const bounds = focused.getBoundingClientRect();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        const candidates = buttons.filter(el => el !== focused).map(el => {
          const r = el.getBoundingClientRect();
          const dx = r.x + r.width / 2 - x;
          const dy = r.y + r.height / 2 - y;
          const primary = direction === 'east' ? dx : direction === 'west' ? -dx : direction === 'south' ? dy : -dy;
          const secondary = direction === 'east' || direction === 'west' ? Math.abs(dy) : Math.abs(dx);
          return { el, primary, score: primary + secondary * 2.2 };
        }).filter(item => item.primary > 2).sort((a, b) => a.score - b.score);
        (candidates[0]?.el || buttons[direction === 'north' || direction === 'west' ? buttons.length - 1 : 0]).focus();
      };
      const poll = now => {
        let pads = [];
        try { pads = navigator.getGamepads ? [...navigator.getGamepads()] : []; } catch (_) { /* Some embedded browsers disable this API. */ }
        const pad = pads.find(Boolean);
        if (pad) {
          if (!connected) { connected = true; this.toast({ text: 'Mando conectado · A confirma · B cierra · RB termina turno', tone: 'good' }); }
          const pressed = pad.buttons.map(button => button.pressed);
          const edge = i => pressed[i] && !previous[i];
          const axisX = pad.axes[0] || 0;
          const axisY = pad.axes[1] || 0;
          const direction = pressed[12] || axisY < -0.55 ? 'north' : pressed[13] || axisY > 0.55 ? 'south' : pressed[14] || axisX < -0.55 ? 'west' : pressed[15] || axisX > 0.55 ? 'east' : null;
          if (direction && now - directionAt > 230) { directionAt = now; navigate(direction); }
          if (edge(0)) {
            this.audio.unlock();
            const scope = this.modal ? '.modal-backdrop' : '.game-shell';
            const focused = document.activeElement;
            if (focused?.matches('button:not(:disabled), input') && focused.closest(scope)) focused.click();
            else this.root.querySelector(`${scope} .primary:not(:disabled)`)?.click();
          }
          if (edge(1) && this.modal) this.closeModal();
          if (edge(2) && !this.modal) this.game.useItem('heal');
          if (edge(3) && !this.modal) this.game.useItem('cool');
          if (edge(5) && !this.modal) this.game.endTurn();
          if (edge(9)) this.modal ? this.closeModal() : this.openModal('settings');
          previous = pressed;
        } else { connected = false; previous = []; }
        requestAnimationFrame(poll);
      };
      requestAnimationFrame(poll);
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    try {
      new UI();
    } catch (error) {
      console.error('Deadlock Deck:', error);
      const root = document.getElementById('app');
      root.innerHTML = '<main class="boot-error"><h1>No se pudo reanimar el juego.</h1><p>Recarga la página en un navegador actualizado. No se han borrado tus planos.</p><button type="button" id="retry-boot">Recargar</button></main>';
      document.getElementById('retry-boot').addEventListener('click', () => location.reload());
    }
  });
})();
