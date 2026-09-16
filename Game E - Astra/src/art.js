/* Pixel art original dibujado en lienzos de baja resolución. */
'use strict';

window.DDArt = class {
  constructor(game) {
    this.game = game;
    this.canvas = null;
    this.anatomy = null;
    this.effects = [];
    this.backgrounds = new Map();
    this.sprite = document.createElement('canvas');
    this.sprite.width = 100;
    this.sprite.height = 116;
    this.last = 0;
    game.addEventListener('effect', event => {
      this.effects.push({ ...event.detail, time: performance.now() });
    });
    const frame = now => {
      if (now - this.last > 40) {
        this.last = now;
        this.draw(now);
      }
      requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  bind() {
    this.canvas = document.getElementById('scene');
    this.anatomy = document.getElementById('body-canvas');
    this.draw(performance.now());
  }

  rect(c, x, y, w, h, color) {
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  line(c, x1, y1, x2, y2, color, width = 1) {
    c.strokeStyle = color;
    c.lineWidth = width;
    c.beginPath();
    c.moveTo(Math.round(x1) + 0.5, Math.round(y1) + 0.5);
    c.lineTo(Math.round(x2) + 0.5, Math.round(y2) + 0.5);
    c.stroke();
  }

  ellipse(c, x, y, rx, ry, color) {
    for (let py = -ry; py <= ry; py++) {
      const span = Math.floor(rx * Math.sqrt(Math.max(0, 1 - py * py / (ry * ry))));
      this.rect(c, x - span, y + py, span * 2 + 1, 1, color);
    }
  }

  arch(c, x, y, width, height) {
    const r = this.rect.bind(this, c);
    r(x - 3, y + 24, width + 6, height - 20, '#39372f');
    r(x + 2, y + 12, width - 4, height - 9, '#39372f');
    r(x + 10, y + 5, width - 20, height - 2, '#454035');
    r(x + 20, y, width - 40, 8, '#454035');
    r(x + 3, y + 27, width - 6, height - 25, '#0b1016');
    r(x + 7, y + 17, width - 14, height - 15, '#0b1016');
    r(x + 14, y + 10, width - 28, height - 8, '#0b1016');
    r(x + 23, y + 6, width - 46, 11, '#0b1016');
    for (let i = 0; i < 16; i++) {
      const px = x + 9 + (i * 17) % (width - 18);
      const py = y + 21 + (i * 19) % (height - 29);
      r(px, py, 1, 1, i % 4 === 0 ? '#ae9870' : '#484b53');
    }
    this.ellipse(c, x + width / 2 + 7, y + 34, 9, 9, '#aaa993');
    this.ellipse(c, x + width / 2 + 11, y + 30, 9, 9, '#0b1016');
    r(x + 5, y + height - 28, width - 10, 29, '#141a1c');
    for (let i = 0; i < 5; i++) {
      r(x + 7 + i * 10, y + height - 35 - (i % 2) * 7, 6, 24, '#141a1c');
      r(x + 9 + i * 10, y + height - 40 - (i % 2) * 7, 2, 10, '#141a1c');
    }
    r(x + width / 2 - 1, y + 9, 3, height - 5, '#504838');
    r(x + 4, y + 56, width - 8, 3, '#403c33');
    r(x - 6, y + height + 2, width + 12, 5, '#554b3c');
    r(x - 4, y + height + 7, width + 8, 3, '#262822');
  }

  background(floor, seed) {
    const key = `${floor}:${seed}`;
    if (this.backgrounds.has(key)) return this.backgrounds.get(key);
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 276;
    const c = canvas.getContext('2d');
    const r = this.rect.bind(this, c);
    r(0, 0, 512, 276, '#151817');
    const bricks = ['#202321', '#222522', '#252723', '#272924', '#1e2221'];
    for (let row = 0; row < 14; row++) {
      for (let col = -1; col < 18; col++) {
        const x = col * 32 + (row % 2) * 16;
        const y = row * 13;
        r(x, y, 30, 11, bricks[Math.abs((row * 31 + col * 17 + seed) % bricks.length)]);
        r(x + 2, y + 1, 25, 1, '#2b2d27');
      }
    }
    this.arch(c, 42, 26, 62, 109);
    this.arch(c, 224, 14, 64, 116);
    this.arch(c, 406, 26, 62, 109);
    for (const x of [16, 126, 196, 310, 382, 491]) {
      r(x, 0, 8, 178, '#1a1e1b');
      r(x + 1, 0, 2, 176, '#494337');
      r(x - 4, 167, 16, 13, '#38392f');
      r(x - 6, 178, 20, 5, '#444235');
      r(x - 3, 19, 14, 5, '#444235');
    }
    // Pipes, pressure gauges, gears and suspension chains.
    r(0, 8, 512, 5, '#554335');
    r(0, 8, 512, 1, '#816447');
    for (const x of [140, 362]) {
      r(x, 11, 5, 112, '#745539');
      r(x, 11, 1, 112, '#a07a4c');
      r(x - 2, 102, 9, 4, '#383a30');
      this.ellipse(c, x + 2, 57, 11, 11, '#161b18');
      this.ellipse(c, x + 2, 57, 8, 8, '#9f8050');
      this.ellipse(c, x + 2, 57, 6, 6, '#b8af8c');
      this.line(c, x + 2, 57, x + 5, 52, '#512f25');
      r(x - 3, 124, 16, 5, '#83633d');
    }
    for (const x of [170, 339]) {
      for (let y = 0; y < 62; y += 5) {
        r(x, y, 3, 4, '#645944');
        r(x + 1, y + 1, 1, 2, '#1a201d');
      }
      r(x - 10, 61, 23, 4, '#66533b');
      r(x - 6, 66, 14, 3, '#38372a');
    }
    // Stone floor, mosaic and ritual circle.
    r(0, 183, 512, 93, '#232620');
    for (let row = 0; row < 7; row++) {
      for (let col = -1; col < 13; col++) {
        const x = col * 48 + (row % 2) * 24;
        const y = 183 + row * 15;
        r(x, y, 46, 13, (row + col) % 3 === 0 ? '#2d2f26' : '#292c25');
        r(x + 2, y + 1, 39, 1, '#36372b');
      }
    }
    this.ellipse(c, 256, 230, 122, 31, '#41402d');
    this.ellipse(c, 256, 230, 120, 29, '#282c25');
    this.ellipse(c, 256, 230, 107, 25, '#514632');
    this.ellipse(c, 256, 230, 105, 24, '#282c25');
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2;
      const x = 256 + Math.cos(a) * 113;
      const y = 230 + Math.sin(a) * 27;
      this.line(c, x - 2, y - 2, x + 2, y + 2, '#89714a');
      r(x, y - 3, 1, 6, '#89714a');
    }
    this.line(c, 180, 216, 325, 240, '#574b32');
    this.line(c, 325, 216, 190, 240, '#574b32');
    this.line(c, 256, 205, 256, 254, '#574b32');
    // Alchemist's workbench.
    r(28, 164, 93, 8, '#675039');
    r(31, 171, 4, 27, '#443d2e');
    r(112, 171, 4, 27, '#443d2e');
    r(30, 166, 88, 2, '#9b7750');
    for (let i = 0; i < 5; i++) {
      const x = 37 + i * 16;
      r(x + 3, 142 - i % 2 * 8, 4, 8, '#606b58');
      r(x, 149 - i % 2 * 8, 11, 14 + i % 2 * 8, '#45594a');
      r(x + 2, 153, 7, 8, ['#78a28d', '#b48b52', '#a96d58'][i % 3]);
      r(x + 1, 148 - i % 2 * 8, 2, 7, '#9aab87');
    }
    // Holding tank with something imperfectly alive inside.
    r(423, 134, 39, 45, '#303b31');
    r(426, 137, 33, 39, '#35554a');
    r(430, 140, 2, 29, '#718b6a');
    r(419, 131, 47, 5, '#7d6544');
    r(419, 177, 47, 5, '#7d6544');
    this.ellipse(c, 444, 150, 7, 8, '#84947b');
    r(439, 157, 10, 13, '#6b806b');
    r(439, 148, 2, 2, '#232c24');
    r(446, 148, 2, 2, '#232c24');
    // Loose bones, books and rubble, deterministic rather than noisy.
    for (let i = 0; i < 30; i++) {
      const x = (i * 73 + seed % 51) % 508;
      const y = 192 + (i * 17) % 78;
      r(x, y, 3 + i % 4, 2, i % 4 === 0 ? '#79694b' : '#373a2e');
    }
    if (floor === 1) {
      r(218, 35, 75, 130, '#30271e');
      r(223, 40, 65, 120, '#796046');
      r(228, 48, 55, 104, '#261f18');
      r(233, 92, 45, 55, '#8b4127');
      r(238, 105, 35, 42, '#bd6a2e');
      for (const x of [234, 244, 254, 264, 274]) r(x, 51, 3, 99, '#3c3427');
    }
    if (floor === 2) {
      for (let i = 0; i < 8; i++) {
        const x = 150 + i * 29;
        r(x, 152 - i % 2 * 6, 18, 25, '#463331');
        r(x + 2, 156 - i % 2 * 6, 2, 17, '#a0814e');
      }
      r(146, 177, 246, 5, '#806345');
    }
    // Soft vignette applied at source resolution, never blurring the sprites.
    const vignette = c.createRadialGradient(256, 146, 85, 256, 146, 285);
    vignette.addColorStop(0, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.58)');
    c.fillStyle = vignette;
    c.fillRect(0, 0, 512, 276);
    if (this.backgrounds.size > 6) this.backgrounds.clear();
    this.backgrounds.set(key, canvas);
    return canvas;
  }

  flame(c, x, y, tick, big = false) {
    const r = this.rect.bind(this, c);
    const phase = Math.floor(tick / 140 + x) % 4;
    const height = big ? 32 : 17;
    r(x - 3, y - height + phase * 2, 4, height - phase * 2, '#8c482b');
    r(x + 2, y - height + 7 - phase, 6, height - 7 + phase, '#a1532a');
    r(x - 1, y - height + 6 + phase, 5, height - 6 - phase, '#d9913e');
    r(x, y - 7 - phase, 3, 8 + phase, '#edc477');
    r(x + 1, y - 2, 2, 3, '#f4dda1');
  }

  defaultBody() {
    const ids = { head: 'skull', torso: 'sutures', armL: 'bone', armR: 'scalpel', legL: 'legs', legR: 'legs' };
    return Object.fromEntries(Object.entries(ids).map(([key, id]) => [key, { id, heat: 0, integrity: 100 }]));
  }

  drawBody(target, cx, ground, scale, body, tick, skinId = 'suture', attack = false) {
    const sc = this.sprite.getContext('2d');
    sc.clearRect(0, 0, 100, 116);
    const r = this.rect.bind(this, sc);
    const skin = DDData.skins[skinId]?.color || '#8fa58e';
    const dark = '#3c4e43';
    const shadow = '#121b18';
    const light = '#b3ba92';
    const bob = this.game.meta.motion ? Math.floor(Math.sin(tick / 430)) : 0;
    const color = key => body[key]?.id ? DDData.parts[body[key].id].color : '#7f4e46';
    // Feet and legs are independent anatomical slots.
    for (const [key, x] of [['legL', 32], ['legR', 51]]) {
      const id = body[key]?.id;
      if (!id) {
        r(x, 77, 10, 6, shadow);
        r(x + 2, 78, 7, 4, '#8d5850');
        r(x + 5, 82, 3, 13, '#a69476');
        r(x + 2, 95, 8, 3, '#756b54');
      } else if (['pistons', 'spider'].includes(id)) {
        r(x - 1, 77, 13, 8, shadow);
        r(x, 78, 11, 6, color(key));
        r(x + 2, 84, 3, 14, '#a4aca0');
        r(x + 7, 84, 2, 14, '#645d47');
        r(x - 2, 98, 16, 6, shadow);
        r(x - 1, 99, 13, 3, color(key));
        if (id === 'spider') { r(x - 7, 89, 5, 3, color(key)); r(x - 8, 92, 3, 9, color(key)); }
      } else {
        r(x - 2, 75, 15, 19, shadow);
        r(x, 76, 10, 19, id === 'legs' ? skin : color(key));
        r(x + 7, 78, 3, 15, dark);
        r(x + 1, 91, 10, 9, '#454e41');
        r(x - 3, 99, 17, 6, shadow);
        r(x - 2, 99, 14, 3, '#5c6250');
        r(x + 1, 83, 8, 1, '#594d3e');
        r(x + 3, 81, 1, 5, light);
        r(x + 6, 81, 1, 5, light);
      }
    }
    // Torso.
    const torso = body.torso?.id;
    const ty = 39 + bob;
    r(26, ty + 2, 43, 34, shadow);
    r(30, ty - 3, 34, 45, shadow);
    if (!torso) {
      r(33, ty + 2, 26, 30, '#5b463d');
      for (let i = 0; i < 5; i++) r(32, ty + 3 + i * 6, 30, 2, '#a79f82');
      r(45, ty, 3, 33, '#bead8d');
      r(47, ty + 13, 6, 9, '#8e554c');
    } else if (['boiler', 'iron', 'mercury'].includes(torso)) {
      r(28, ty + 3, 39, 29, color('torso'));
      r(31, ty - 1, 32, 39, color('torso'));
      r(34, ty + 3, 25, 29, '#41483c');
      r(37, ty + 6, 20, 22, '#1c2622');
      if (torso === 'boiler') {
        this.flame(sc, 46, ty + 26, tick, false);
        for (let i = 0; i < 4; i++) r(37 + i * 6, ty + 5, 2, 24, '#816143');
      } else if (torso === 'mercury') {
        this.ellipse(sc, 47, ty + 16, 7, 9, '#5d9997');
        r(45, ty + 10, 4, 9, '#acd4ba');
      } else {
        r(37, ty + 8, 20, 4, '#85948d');
        r(37, ty + 18, 20, 4, '#85948d');
        r(44, ty + 6, 5, 21, '#b8b7a0');
      }
      for (const x of [31, 62]) for (const y of [ty + 3, ty + 31]) r(x, y, 2, 2, '#d2c39c');
    } else {
      r(29, ty + 3, 36, 29, skin);
      r(32, ty - 1, 29, 39, skin);
      r(54, ty + 3, 9, 31, dark);
      r(31, ty + 3, 3, 25, light);
      r(35, ty + 5, 11, 9, '#a0ae8c');
      r(48, ty + 5, 12, 9, '#728a70');
      r(35, ty + 16, 20, 2, '#536651');
      r(45, ty + 3, 2, 31, '#5a463d');
      for (let y = ty + 4; y < ty + 31; y += 6) r(42, y, 8, 1, '#c7ba98');
      r(35, ty + 24, 8, 1, '#567052');
    }
    r(30, ty + 36, 34, 6, '#4a4234');
    r(44, ty + 37, 7, 5, '#bd9c60');
    // Arms, including cannon and surgical attachments.
    for (const [key, x] of [['armL', 17], ['armR', 65]]) {
      const id = body[key]?.id;
      const ay = ty + (key === 'armR' && attack ? -7 : 5);
      r(x - 2, ay - 2, 15, 28, shadow);
      if (!id) {
        r(x, ay, 11, 9, '#83594b');
        r(x + 4, ay + 9, 4, 5, '#b9a283');
      } else if (id === 'cannon' || id === 'piston') {
        r(x - 2, ay + 1, 17, 29, '#756044');
        r(x - 1, ay + 2, 14, 6, '#c69f63');
        r(x, ay + 9, 12, 4, '#bdab7a');
        r(x - 3, ay + 15, 18, 13, color(key));
        r(x - 1, ay + 18, 14, 8, '#34443c');
        r(x + 2, ay + 20, 8, 5, '#80b5a5');
        if (id === 'piston') r(x - 4, ay + 23, 20, 10, '#a59775');
      } else {
        r(x, ay, 11, 23, id === 'bone' ? skin : color(key));
        r(x + 8, ay + 2, 3, 20, '#5c6652');
        r(x + 1, ay + 6, 8, 2, '#b6b995');
        r(x - 1, ay + 21, 13, 6, '#b4aa85');
        if (id === 'scalpel') {
          r(x + 3, ay + 24, 3, 18, '#c4ccbe');
          r(x + 6, ay + 27, 2, 12, '#869891');
          r(x - 1, ay + 25, 2, 11, '#bec9c0');
        } else if (id === 'claw') {
          for (let i = 0; i < 3; i++) { r(x + i * 4, ay + 26, 2, 9 + i * 2, '#c2b18c'); r(x + i * 4 + 1, ay + 33 + i * 2, 3, 2, '#c2b18c'); }
        } else {
          r(x, ay + 27, 10, 7, '#8e9d7d');
          r(x + 1, ay + 30, 8, 2, '#4a5545');
        }
      }
    }
    // Head, neck bolts and eyes.
    const head = body.head?.id;
    const hy = 13 + bob;
    r(40, hy + 19, 15, 12, shadow);
    r(42, hy + 20, 11, 10, skin);
    if (!head) {
      r(44, hy + 14, 7, 10, '#b7a489');
      this.ellipse(sc, 47, hy + 5, 7, 8, '#436d65');
      r(43, hy + 3, 2, 2, '#9fcfba');
      r(49, hy + 3, 2, 2, '#9fcfba');
    } else {
      r(32, hy, 30, 22, shadow);
      r(35, hy - 3, 24, 28, shadow);
      r(34, hy + 1, 26, 20, head === 'skull' ? skin : color('head'));
      r(37, hy - 1, 20, 25, head === 'skull' ? skin : color('head'));
      r(54, hy + 2, 5, 18, dark);
      r(36, hy + 3, 19, 2, light);
      r(37, hy + 8, 8, 6, '#29382f');
      r(48, hy + 8, 8, 6, '#29382f');
      r(39, hy + 10, 4, 2, '#e6c379');
      r(49, hy + 10, 4, 2, '#e6c379');
      r(45, hy + 13, 2, 4, dark);
      r(39, hy + 20, 15, 1, '#544538');
      r(29, hy + 13, 5, 4, '#ab9e74');
      r(60, hy + 13, 5, 4, '#ab9e74');
      if (head === 'surgeon') {
        r(36, hy + 16, 20, 9, '#b2b6a0');
        r(38, hy + 18, 16, 1, '#738a7d');
        r(35, hy - 3, 24, 6, '#c1b9a0');
        r(43, hy - 5, 7, 8, '#886557');
      } else if (head === 'jaw') {
        r(34, hy + 17, 25, 10, '#59352f');
        for (let i = 0; i < 5; i++) r(36 + i * 4, hy + 18, 2, 5 + i % 2 * 2, '#cec2a2');
      } else if (head === 'oracle' || head === 'ash') {
        r(34, hy - 5, 26, 5, '#aa945e');
        for (let i = 0; i < 5; i++) r(35 + i * 5, hy - 12 + i % 2 * 4, 3, 9, '#b1a077');
        r(45, hy + 2, 4, 5, head === 'ash' ? '#e7ad65' : '#a8d3ba');
      } else {
        r(39, hy - 1, 1, 9, '#564b3a');
        for (let i = 0; i < 3; i++) r(37, hy + i * 3, 5, 1, '#d0c59e');
      }
    }
    // Overheated grafts have localized incandescent stitches.
    for (const slot of DDData.slots) {
      if ((body[slot.id]?.heat || 0) < 60) continue;
      const positions = { head: [35, 20], torso: [31, 50], armL: [18, 57], armR: [66, 57], legL: [34, 87], legR: [52, 87] };
      const [x, y] = positions[slot.id];
      r(x, y, 3, 2, '#f0a55b');
      r(x + 2, y + 5, 2, 2, '#c76c44');
    }
    target.imageSmoothingEnabled = false;
    target.drawImage(this.sprite, Math.round(cx - 48 * scale), Math.round(ground - 105 * scale), Math.round(100 * scale), Math.round(116 * scale));
  }

  drawEnemy(c, cx, ground, scale, id, tick) {
    const def = DDData.enemies[id];
    if (!def) return;
    if (['brute', 'stitched', 'furnace', 'boss'].includes(def.sprite)) {
      const config = def.sprite === 'furnace' ? ['jaw', 'boiler', 'cannon', 'piston', 'pistons', 'pistons']
        : def.sprite === 'boss' ? ['oracle', 'mercury', 'claw', 'piston', 'spider', 'pistons']
        : def.sprite === 'brute' ? ['jaw', 'sutures', 'claw', 'bone', 'legs', 'funeral']
        : ['skull', 'sutures', 'claw', 'claw', 'spider', 'legs'];
      const body = Object.fromEntries(DDData.slots.map((s, i) => [s.id, { id: config[i], heat: 0 }]));
      c.save();
      c.translate(cx * 2, 0);
      c.scale(-1, 1);
      this.drawBody(c, cx, ground, scale * (def.boss ? 1.35 : 1.08), body, tick + 800, def.boss ? 'crimson' : 'copper');
      c.restore();
      if (def.boss) {
        this.ellipse(c, cx, ground - 151, 22, 3, '#9a7845');
        this.ellipse(c, cx, ground - 151, 20, 2, '#222721');
      }
      return;
    }
    const sc = this.sprite.getContext('2d');
    sc.clearRect(0, 0, 100, 116);
    const r = this.rect.bind(this, sc);
    const ash = def.sprite === 'ash';
    const oracle = def.sprite === 'oracle';
    const bob = this.game.meta.motion ? Math.floor(Math.sin(tick / 470)) : 0;
    const robe = ash ? '#826349' : oracle ? '#70647e' : '#8b8880';
    r(35, 93, 12, 13, '#1c2220');
    r(53, 93, 12, 13, '#1c2220');
    r(31, 103, 17, 5, '#494c40');
    r(52, 103, 18, 5, '#494c40');
    r(26, 36 + bob, 45, 60, '#131b19');
    r(30, 34 + bob, 37, 62, robe);
    r(25, 62 + bob, 49, 33, robe);
    r(44, 39 + bob, 6, 54, '#393b35');
    r(32, 42 + bob, 4, 46, '#a2a396');
    r(62, 43 + bob, 7, 49, '#565f54');
    r(25, 94 + bob, 48, 3, '#baac8b');
    r(22, 37 + bob, 12, 37, '#181f1c');
    r(23, 39 + bob, 9, 31, robe);
    r(64, 38 + bob, 13, 37, '#181f1c');
    r(65, 40 + bob, 10, 29, robe);
    r(21, 70 + bob, 10, 8, '#b6ad8e');
    r(68, 70 + bob, 10, 8, '#b6ad8e');
    r(34, 10 + bob, 29, 27, '#141d19');
    r(37, 12 + bob, 23, 23, '#c0b499');
    r(37, 9 + bob, 24, 5, robe);
    r(31, 12 + bob, 36, 3, '#bbb198');
    if (oracle || ash) {
      r(36, 18 + bob, 26, 7, '#242c28');
      r(40, 20 + bob, 3, 2, ash ? '#e8b25d' : '#7fb9b0');
      r(53, 20 + bob, 3, 2, ash ? '#e8b25d' : '#7fb9b0');
      r(33, 6 + bob, 31, 5, '#b09663');
    } else {
      r(33, 17 + bob, 28, 10, '#564b37');
      r(35, 19 + bob, 8, 6, '#a4b4a0');
      r(50, 19 + bob, 8, 6, '#a4b4a0');
      r(33, 29 + bob, 27, 5, '#9f967b');
      r(29, 25 + bob, 13, 6, '#9f967b');
    }
    // Long syringe and an illuminated flask.
    r(22, 75 + bob, 3, 21, '#bbb7a2');
    r(20, 78 + bob, 7, 10, '#649185');
    r(22, 94 + bob, 1, 12, '#c4c9b5');
    r(70, 78 + bob, 5, 5, '#b7a87a');
    r(67, 83 + bob, 11, 12, '#426e60');
    r(69, 88 + bob, 7, 5, '#8dc4a1');
    c.imageSmoothingEnabled = false;
    c.drawImage(this.sprite, Math.round(cx - 48 * scale), Math.round(ground - 108 * scale), Math.round(100 * scale), Math.round(116 * scale));
  }

  draw(tick) {
    const state = this.game.state;
    const motion = this.game.meta.motion;
    const time = motion ? tick : 0;
    if (this.canvas) {
      const c = this.canvas.getContext('2d');
      c.imageSmoothingEnabled = false;
      c.clearRect(0, 0, 512, 276);
      c.drawImage(this.background(state?.floor || 0, state?.seed || 119), 0, 0);
      const overlay = c.createRadialGradient(70, 171, 3, 70, 171, 80);
      overlay.addColorStop(0, 'rgba(168,119,53,0.15)');
      overlay.addColorStop(1, 'rgba(168,119,53,0)');
      c.fillStyle = overlay;
      c.fillRect(0, 80, 170, 170);
      this.flame(c, 168, 61, time);
      this.flame(c, 337, 61, time + 400);
      this.flame(c, 10, 210, time + 400, true);
      this.flame(c, 498, 217, time + 600, true);
      const currentRoom = state?.map[state.current];
      const fight = state?.phase === 'combat';
      const hasEnemy = fight || state?.phase === 'loot';
      const playerX = hasEnemy ? 146 : 232;
      const recentAttack = this.effects.some(e => e.type === 'hit' && e.target === 'enemy' && tick - e.time < 180);
      this.ellipse(c, playerX, 234, 35, 7, '#111b17');
      if (state?.phase !== 'dead') {
        this.drawBody(c, playerX + (recentAttack && motion ? 6 : 0), 230, 1.3, state?.body || this.defaultBody(), time, this.game.meta.skin, recentAttack);
      } else {
        for (let i = 0; i < 8; i++) {
          const y = 215 - ((time / 30 + i * 16) % 95);
          this.rect(c, playerX - 12 + (i * 11) % 25, y, 4, 4, '#789e8a');
        }
      }
      if (fight) {
        this.ellipse(c, 373, 235, 39, 8, '#111b17');
        this.drawEnemy(c, 373, 230, 1.16, state.enemy.id, time);
        if (state.enemy.burn) this.flame(c, 397, 224, time + 900, true);
        if (state.enemy.stun) {
          for (let i = 0; i < 3; i++) this.rect(c, 359 + i * 10, 82 + Math.sin(time / 180 + i) * 3, 3, 3, '#a6c9bf');
        }
      } else if (state?.phase === 'loot') {
        this.ellipse(c, 373, 232, 37, 9, '#4f3830');
        this.rect(c, 348, 226, 42, 8, '#6c6850');
        this.rect(c, 388, 219, 12, 12, '#a39676');
        this.rect(c, 361, 222, 21, 3, '#a58559');
      } else if (currentRoom?.type === 'stairs' || currentRoom?.type === 'boss') {
        for (let i = 0; i < 8; i++) {
          this.rect(c, 336 + i * 3, 207 - i * 7, 47, 5, '#5f6552');
          this.rect(c, 337 + i * 3, 208 - i * 7, 46, 2, '#a2a283');
        }
        this.rect(c, 354, 115, 38, 40, '#759483');
        this.rect(c, 360, 119, 26, 31, '#c3cfab');
      } else if (currentRoom?.type === 'cache') {
        this.rect(c, 356, 201, 41, 28, '#4c3c2c');
        this.rect(c, 359, 198, 36, 6, '#997042');
        this.rect(c, 359, 209, 36, 2, '#ad8a51');
        this.rect(c, 371, 201, 8, 27, '#b28f56');
        this.rect(c, 374, 210, 3, 5, '#352c22');
      } else if (currentRoom?.type === 'trap') {
        this.rect(c, 331, 223, 78, 5, '#645940');
        for (let i = 0; i < 5; i++) {
          const y = 224 - ((time / 28 + i * 13) % 56);
          this.rect(c, 334 + i * 14, y, 6, 13, '#758577');
          this.rect(c, 331 + i * 14, y + 3, 12, 5, '#758577');
        }
      }
      // Embers and low-lying fog.
      for (let i = 0; i < 20; i++) {
        const x = (i * 97 + Math.floor(time / 80)) % 512;
        const y = 266 - ((time / (40 + i % 5 * 6) + i * 37) % 270);
        this.rect(c, x, y, i % 4 === 0 ? 2 : 1, 1, i % 3 ? '#8f7044' : '#dbae62');
      }
      c.globalAlpha = 0.13;
      for (let i = 0; i < 4; i++) {
        const x = ((time / 120 + i * 160) % 650) - 120;
        this.rect(c, x, 246 + i % 2 * 7, 146, 3, '#9aa48a');
        this.rect(c, x + 12, 243 + i % 2 * 7, 98, 3, '#9aa48a');
      }
      c.globalAlpha = 1;
      this.effects = this.effects.filter(e => tick - e.time < 1000);
      for (const e of this.effects) {
        if (e.type !== 'hit') continue;
        const elapsed = tick - e.time;
        c.globalAlpha = Math.max(0, 1 - elapsed / 1000);
        c.font = 'bold 15px monospace';
        c.textAlign = 'center';
        c.fillStyle = e.target === 'enemy' ? '#f1d195' : '#ef9884';
        c.fillText(e.amount ? `−${e.amount}` : 'BLOQUEADO', e.target === 'enemy' ? 373 : 146, 116 - (motion ? elapsed / 55 : 0));
        c.globalAlpha = 1;
      }
    }
    if (this.anatomy) {
      const c = this.anatomy.getContext('2d');
      c.clearRect(0, 0, 200, 148);
      c.imageSmoothingEnabled = false;
      c.globalAlpha = 0.35;
      this.line(c, 100, 6, 100, 141, '#5a614c');
      this.line(c, 27, 70, 173, 70, '#5a614c');
      this.ellipse(c, 100, 77, 54, 58, '#272e25');
      this.ellipse(c, 100, 77, 53, 57, '#111713');
      c.globalAlpha = 1;
      this.drawBody(c, 100, 133, 1.1, state?.body || this.defaultBody(), time, this.game.meta.skin);
      for (const [x, y, right] of [[72, 31, false], [120, 64, true], [65, 87, false], [134, 87, true], [81, 119, false], [121, 119, true]]) {
        this.line(c, x, y, right ? 181 : 19, y - 8, '#6d7355');
        this.rect(c, right ? 181 : 18, y - 10, 3, 3, '#bd9b57');
      }
    }
  }
};
