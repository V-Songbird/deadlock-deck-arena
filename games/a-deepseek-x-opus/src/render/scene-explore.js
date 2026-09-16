/* DD.View.explore — the tower from above. SPEC.md 5.6 / 6.7.
 * 24 px tiles with a torch falloff, the socket-assembled avatar, telegraphing
 * traps, floating messages and the shift warning. Everything is drawn through
 * DD.Pixel; every read of game state is guarded so a frame can never throw. */
(function () {
  'use strict';
  var DD = window.DD;
  var V = DD.View = DD.View || { hud: {}, explore: {}, combat: {}, ui: {} };
  var E = V.explore = V.explore || {};

  /* ------------------------------------------------------------- layout */
  var TILE = DD.TILE || 24;
  var VW = DD.VW || 640;
  var VH = DD.VH || 360;

  var CAM_LEAD = 12;          // px of lead in the direction of travel
  var CAM_SMOOTH = 11;        // camera catch-up, per second
  var CAM_SNAP = TILE * 4;    // lag past this snaps instead of gliding

  var SHAKE_TIME = 0.3;       // seconds
  var SHAKE_TRAP = 2;         // px, a trap going off
  var SHAKE_SHIFT = 3;        // px, while the tower reorders
  var HIT_HEAT = 12;          // heat jump in one frame that counts as a hit

  var LIT_NEAR = 5.5;         // tiles at full brightness
  var LIT_FAR = 13.5;         // tiles swallowed by the dark
  var LIT_GAMMA = 0.7;        // falloff curve: the ambient floor of the lighting
  var LOS_MAX = 13;           // past this the line of sight is not queried
  var UNSEEN = 0.45;          // brightness kept outside the line of sight
  var MIN_VIS = 0.07;         // darker than this, a tile is not drawn at all
  var FOG = '#0a0812';        // the colour the dark falls towards

  /* What the torch does to a surface once it is drawn. The gap between a lit
   * floor, a dark wall and a black void is what makes the room's shape
   * readable; the wall variants and the void take no light at all. */
  var WARM = '#ffd9a8';       // torchlight pooling on stone
  var COLD = '#9fb0c8';       // a wall top catching the dark
  var WARM_LIT = { a: 0.10, c: WARM };
  var COLD_LIT = { a: 0.06, c: COLD };
  var SURFACE = {
    tile_void: null, tile_wall: null, tile_wall_crack: null, tile_wall_top: COLD_LIT
  };
  var FLAME = { prop_candle: 1, prop_brazier: 1, prop_crystal: 1 };   // carry their own light

  var SPOT_RANGE = 7.5;       // tiles an enemy needs to notice the player
  var FLOAT_LIFE = 1.5;       // seconds a floater lives
  var FLOAT_RISE = 15;        // px it rises over that life

  var MINI = { x: 492, y: 44, w: 140, h: 92 };   // minimap frame, top right
  var PAD_C = { x: 66, y: 292, b: 34 };          // touch d-pad centre and cell
  var ACT_B = { x: 556, y: 272, w: 56, h: 56 };  // touch action button
  var PROMPT_Y = 296;

  /* Avatar assembly, SPEC.md 4.4: a 24x32 box, back to front. */
  var AVATAR_H = 32;
  var PARTS = [
    { s: 'legL', x: 4, y: 24, w: 8, h: 8, part: 'leg', mirror: false },
    { s: 'legR', x: 12, y: 24, w: 8, h: 8, part: 'leg', mirror: true },
    { s: 'torso', x: 4, y: 8, w: 16, h: 16, part: 'torso', mirror: false },
    { s: 'armL', x: 0, y: 10, w: 8, h: 12, part: 'arm', mirror: false },
    { s: 'armR', x: 16, y: 10, w: 8, h: 12, part: 'arm', mirror: true },
    { s: 'head', x: 4, y: 0, w: 16, h: 16, part: 'head', mirror: false }
  ];

  /* --------------------------------------------------------------- clock */
  var lastNow = 0;
  var clock = 0;              // view seconds; every animation hangs off it
  var shake = { t: 0, amp: 0 };

  function frame() {
    var n = (DD.now ? DD.now() : Date.now()) / 1000;
    var d = lastNow ? n - lastNow : 0;
    lastNow = n;
    if (!(d > 0)) d = 0;
    if (d > 0.06) d = 0.06;
    clock += d;
    if (shake.t > 0) shake.t = Math.max(0, shake.t - d);
    return d;
  }

  function kick(amp) {
    shake.amp = amp;
    shake.t = SHAKE_TIME;
  }

  /* --------------------------------------------------------- state access */
  E.camera = E.camera || { x: 0, y: 0 };      // world px, read by other code
  var cam = E.camera;
  var lead = { x: 0, y: 0 };
  var lastTile = { x: -1, y: -1 };
  var lastHp = -1, lastHeat = -1;

  function tileAt(map, x, y) {
    if (DD.Tower && DD.Tower.at) return DD.Tower.at(map, x, y);
    if (!map || !map.tiles || x < 0 || y < 0 || x >= map.w || y >= map.h) return DD.TILE_WALL;
    return map.tiles[y * map.w + x];
  }

  function walkableAt(map, x, y) {
    if (DD.Tower && DD.Tower.walkable) return !!DD.Tower.walkable(map, x, y);
    var id = tileAt(map, x, y);
    return id !== DD.TILE_VOID && id !== DD.TILE_WALL;
  }

  /* Returns true when the tower does not implement line of sight: an absent
   * implementation must not blind the whole floor. */
  function los(map, ax, ay, bx, by) {
    if (!DD.Tower || !DD.Tower.lineOfSight) return true;
    var v = DD.Tower.lineOfSight(map, ax, ay, bx, by);
    return v === undefined || v === null ? true : !!v;
  }

  function heatTotal(body) {
    if (!body || !body.heat) return 0;
    var sum = 0;
    for (var i = 0; i < DD.SOCKETS.length; i++) sum += body.heat[DD.SOCKETS[i]] || 0;
    return sum;
  }

  /* The result screen reports what the run added to the codex, and this view is
   * the only thing that draws on the first frame of every run, so the tally it
   * is measured against is taken here. DD.View.ui.end reads V._codexBase. */
  function snapshotCodex(st) {
    if (!DD.Run || (V._codexBase && V._codexBase.key === st.runIndex)) return;
    var m = DD.Run.meta || {};
    var limbs = 0, enemies = 0, k;
    for (k in (m.codexLimbs || {})) if (m.codexLimbs[k]) limbs++;
    for (k in (m.codexEnemies || {})) if (m.codexEnemies[k]) enemies++;
    V._codexBase = { key: st.runIndex, limbs: limbs, enemies: enemies };
  }

  /* The view cannot hook DD.Explore, so a trap going off is read from the
   * state it leaves behind: lost HP or a jump in total heat. */
  function detectHit(st) {
    var hp = st.hp || 0;
    var heat = heatTotal(st.body);
    if (lastHp >= 0 && (hp < lastHp || heat > lastHeat + HIT_HEAT)) kick(SHAKE_TRAP);
    lastHp = hp;
    lastHeat = heat;
  }

  function trackMove(px, py, d) {
    if (px === lastTile.x && py === lastTile.y) {
      lead.x = DD.approach(lead.x, 0, 26 * d);
      lead.y = DD.approach(lead.y, 0, 26 * d);
      return;
    }
    if (lastTile.x >= 0) {
      lead.x = DD.clamp(px - lastTile.x, -1, 1) * CAM_LEAD;
      lead.y = DD.clamp(py - lastTile.y, -1, 1) * CAM_LEAD;
    }
    lastTile.x = px;
    lastTile.y = py;
  }

  function updateCamera(map, px, py, d) {
    var mapW = (map.w || 0) * TILE, mapH = (map.h || 0) * TILE;
    var tx = px * TILE + TILE / 2 - VW / 2 + lead.x;
    var ty = py * TILE + TILE / 2 - VH / 2 + lead.y;
    if (mapW <= VW) tx = (mapW - VW) / 2; else tx = DD.clamp(tx, 0, mapW - VW);
    if (mapH <= VH) ty = (mapH - VH) / 2; else ty = DD.clamp(ty, 0, mapH - VH);
    if (!(cam.x) && !(cam.y)) { cam.x = tx; cam.y = ty; return; }
    if (Math.abs(tx - cam.x) > CAM_SNAP || Math.abs(ty - cam.y) > CAM_SNAP) { cam.x = tx; cam.y = ty; return; }
    var k = DD.clamp(d * CAM_SMOOTH, 0, 1);
    cam.x = DD.lerp(cam.x, tx, k);
    cam.y = DD.lerp(cam.y, ty, k);
  }

  /* ------------------------------------------------------------ tile keys */
  /* Deterministic from DD.hash(x, y) so the floor has texture but never
   * flickers between frames. */
  function floorKey(x, y) {
    var h = DD.hash ? DD.hash(x + 7, y + 13) : ((x * 31 + y * 17) | 0);
    var m = h % 101;
    if (m === 0) return 'tile_rune';
    if (m === 17) return 'tile_pipe';
    if (m === 41) return 'tile_bones';
    if (m === 73) return 'tile_blood';
    return (h & 1) ? 'tile_floor_alt' : 'tile_floor';
  }

  function wallKey(map, x, y) {
    if (walkableAt(map, x, y - 1)) return 'tile_wall_top';
    var h = DD.hash ? DD.hash(x * 3 + 1, y * 5 + 2) : 0;
    return (h % 47 === 0) ? 'tile_wall_crack' : 'tile_wall';
  }

  function tileKey(map, x, y) {
    var id = tileAt(map, x, y);
    if (id === DD.TILE_WALL) return wallKey(map, x, y);
    if (id === DD.TILE_DOOR) return 'tile_door';
    if (id === DD.TILE_STAIRS) return 'tile_stairs';
    if (id === DD.TILE_EXIT) return 'tile_exit';
    if (id === DD.TILE_GRATE) return 'tile_grate';
    if (id === DD.TILE_BLOOD) return 'tile_blood';
    if (id === DD.TILE_VOID) return 'tile_void';
    return floorKey(x, y);
  }

  /* Only the rim of the void is drawn: the deep dark is the backdrop itself. */
  function voidRim(map, x, y) {
    return tileAt(map, x - 1, y) !== DD.TILE_VOID || tileAt(map, x + 1, y) !== DD.TILE_VOID ||
      tileAt(map, x, y - 1) !== DD.TILE_VOID || tileAt(map, x, y + 1) !== DD.TILE_VOID;
  }

  function visibility(map, x, y, px, py) {
    var d = DD.dist(x, y, px, py);
    if (d >= LIT_FAR) return 0;
    var a = d <= LIT_NEAR ? 1 : 1 - (d - LIT_NEAR) / (LIT_FAR - LIT_NEAR);
    a = Math.pow(a, LIT_GAMMA);             // the far end of a room stays readable
    if (a <= MIN_VIS) return 0;
    if (d >= 1.5 && d < LOS_MAX && a > 0.25 && !los(map, px, py, x, y)) a *= UNSEEN;
    return a;
  }

  /* --------------------------------------------------------------- ground */
  function drawTiles(map, camX, camY, px, py) {
    var x0 = Math.max(0, Math.floor(camX / TILE) - 1);
    var y0 = Math.max(0, Math.floor(camY / TILE) - 1);
    var x1 = Math.min((map.w || 0) - 1, x0 + Math.ceil(VW / TILE) + 2);
    var y1 = Math.min((map.h || 0) - 1, y0 + Math.ceil(VH / TILE) + 2);
    for (var y = y0; y <= y1; y++) {
      var sy = y * TILE - camY;
      for (var x = x0; x <= x1; x++) {
        var id = tileAt(map, x, y);
        if (id === DD.TILE_VOID && !voidRim(map, x, y)) continue;
        var vis = visibility(map, x, y, px, py);
        if (vis <= 0) continue;
        var dx = x * TILE - camX;
        var key = tileKey(map, x, y);
        DD.Pixel.sprite(key, dx, sy);
        var pool = SURFACE[key] === undefined ? WARM_LIT : SURFACE[key];
        if (pool) DD.Pixel.dim(dx, sy, TILE, TILE, pool.a * vis, pool.c);
        if (vis < 1) DD.Pixel.dim(dx, sy, TILE, TILE, 1 - vis, FOG);
      }
    }
  }

  /* Warm pool of light around the player, drawn over the floor. */
  function torch(camX, camY, px, py) {
    var cx = px * TILE + TILE / 2 - camX, cy = py * TILE + TILE / 2 - camY;
    var r = [64, 46, 30], a = [0.07, 0.08, 0.09];
    for (var i = 0; i < r.length; i++) {
      DD.Pixel.dim(cx - r[i], cy - r[i] - 6, r[i] * 2, r[i] * 2, a[i], '#ff8a2a');
    }
  }

  /* --------------------------------------------------------------- edges */
  function edges(color, strength) {
    var n = 10, band = 3, i, a;
    for (i = 0; i < n; i++) {
      a = strength * Math.pow(1 - i / n, 2);
      if (a <= 0.005) continue;
      DD.Pixel.dim(0, i * band, VW, band, a, color);
      DD.Pixel.dim(0, VH - (i + 1) * band, VW, band, a, color);
      DD.Pixel.dim(i * band, 0, band, VH, a, color);
      DD.Pixel.dim(VW - (i + 1) * band, 0, band, VH, a, color);
    }
  }

  /* ------------------------------------------------------------- entities */
  function entityKey(e, prefix) {
    var d = e.data;
    var k = (d && d.sprite) || e.id || e.kind || '';
    if (DD.Pixel.hasSprite(k)) return k;
    if (prefix && DD.Pixel.hasSprite(prefix + k)) return prefix + k;
    return k;   // unknown keys fall through to the magenta placeholder
  }

  function byId(table, id) {
    var t = DD.Data && DD.Data[table];
    return (t && t[id]) || null;
  }

  function drawEntities(map, camX, camY, px, py, st) {
    var list = map.entities;
    if (!list || !list.length) return;
    var i, e, sx, sy;
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || e.dead || e.kind === 'enemy') continue;   // enemies draw last
      sx = e.x * TILE - camX;
      sy = e.y * TILE - camY;
      if (sx < -48 || sy < -64 || sx > VW + 48 || sy > VH + 64) continue;
      var vis = visibility(map, e.x, e.y, px, py);
      if (vis <= 0.12) continue;
      drawGround(e, sx, sy, vis, map, px, py);
    }
    for (i = 0; i < list.length; i++) {
      e = list[i];
      if (!e || e.dead || e.kind !== 'enemy') continue;
      sx = e.x * TILE - camX;
      sy = e.y * TILE - camY;
      if (sx < -64 || sy < -96 || sx > VW + 64 || sy > VH + 96) continue;
      var ev = visibility(map, e.x, e.y, px, py);
      if (ev <= 0.12) continue;
      drawEnemy(e, sx, sy, ev, map, px, py);
    }
  }

  function drawGround(e, sx, sy, vis, map, px, py) {
    if (e.kind === 'trap') {
      var td = byId('trapById', e.id);
      var on = !!e.active;
      /* Trap sprite names (trap_spike/trap_vent/trap_acid) do not match the trap
       * ids, so the definition is the only source of the art key. */
      var key = (on && td && td.spriteOn) ? td.spriteOn : ((td && td.sprite) || entityKey(e, 'trap_'));
      DD.Pixel.sprite(key, sx, sy, { alpha: vis });
      /* DD.Explore arms a trap into phase 1 for exactly `telegraph` seconds
       * before it fires; without it, fall back to the timer. */
      var phase = (e.data && e.data.phase !== undefined) ? e.data.phase : -1;
      var tel = (td && td.telegraph) || 0.45;
      if (phase === 1 || (phase < 0 && on && e.timer > 0 && e.timer <= tel)) trapWarn(sx, sy, vis);
      return;
    }
    if (e.kind === 'resource') {
      var bob = Math.round(Math.sin(clock * 3 + (e.x + e.y)) * 2);
      DD.Pixel.dim(sx + 2, sy + 4 + bob, TILE - 4, TILE - 8, 0.16 * vis, '#ffd27a');
      DD.Pixel.sprite(entityKey(e, 'res_'), sx + (TILE - 16) / 2, sy + 4 + bob, { alpha: vis });
      return;
    }
    if (e.kind === 'altar') {
      DD.Pixel.dim(sx + 1, sy + 1, TILE - 2, TILE - 2, 0.22 * vis, DD.C.gold);
      DD.Pixel.sprite('prop_altar', sx, sy, { alpha: vis });
      return;
    }
    if (e.kind === 'prop') {
      var pk = entityKey(e, 'prop_');
      var flick = 1 + Math.sin(clock * 7 + e.x * 3) * 0.08;
      if (FLAME[pk]) {
        var glow = (0.08 + 0.02 * Math.sin(clock * 6 + e.x)) * vis;
        DD.Pixel.dim(sx - 12, sy - 12, TILE + 24, TILE + 24, glow, WARM);
      }
      DD.Pixel.sprite(pk, sx, sy, { alpha: vis * flick });
    }
  }

  function trapWarn(sx, sy, vis) {
    var pulse = 0.35 + 0.3 * Math.sin(clock * 18);
    DD.Pixel.dim(sx, sy, TILE, TILE, pulse * vis, DD.C.blood);
    DD.Pixel.frame(sx, sy, TILE, TILE, DD.C.bloodHi);
    DD.Pixel.text('!', sx + TILE / 2, sy - 4 + Math.round(Math.sin(clock * 12) * 1), {
      scale: 2, align: 'center', color: DD.C.bloodHi
    });
  }

  function drawEnemy(e, sx, sy, vis, map, px, py) {
    var def = byId('enemyById', e.id);
    var d = e.data || {};
    var max = d.maxHp || (def && def.hp) || 0;
    var hp = d.hp === undefined ? max : d.hp;
    var cx = sx + TILE / 2, bottom = sy + TILE - 1;

    DD.Pixel.dim(sx + 2, sy + TILE - 6, TILE - 4, 5, 0.4 * vis, '#000000');
    DD.Pixel.sprite(entityKey(e, 'enemy_'), cx, bottom, { anchor: 'bottom', alpha: vis });

    if (max > 0) {
      DD.Pixel.bar(sx + 1, sy - 5, TILE - 2, 3, DD.clamp(hp / max, 0, 1), {
        fg: DD.C.hp, borderColor: DD.C.ink
      });
    }
    if (spotted(map, e, px, py)) {
      DD.Pixel.text('!', cx, sy - 8 + Math.round(Math.sin(clock * 9) * 1), {
        scale: 2, align: 'center', color: DD.C.bloodHi
      });
    }
  }

  /* DD.Explore owns the sight flag on every enemy; only guess when it is absent. */
  function spotted(map, e, px, py) {
    if (DD.Explore && typeof e.active === 'boolean') return e.active;
    if (DD.dist(e.x, e.y, px, py) > SPOT_RANGE) return false;
    return los(map, e.x, e.y, px, py);
  }

  /* --------------------------------------------------------------- player */
  function cosmeticPalette() {
    if (!DD.Progress || !DD.Progress.cosmetic) return null;
    var c = DD.Progress.cosmetic();
    if (!c || c.id === 'default' || !c.palette || c.palette.length < 3) return null;
    return c.palette;
  }

  function partKey(socket, limb, dir) {
    if (!limb) {
      if (socket === 'armL' || socket === 'armR') return 'av_stump_arm_' + dir;
      if (socket === 'legL' || socket === 'legR') return 'av_stump_leg_' + dir;
      return null;                        // head and torso have no stump art
    }
    var p = socket === 'head' ? 'head' : (socket === 'torso' ? 'torso' : (socket.charAt(0) === 'a' ? 'arm' : 'leg'));
    return 'av_' + p + '_' + (limb.form || 'gaunt') + '_' + dir;
  }

  function facing(p) {
    var d = (p && p.dir) || 'down';
    var flip = false;
    if (d === 'left') { d = 'side'; flip = true; }
    else if (d === 'right') { d = 'side'; }
    else if (d !== 'up' && d !== 'down') { d = 'side'; }
    if (d === 'side' && lead.x < 0) flip = true;
    return { dir: d, flip: flip };
  }

  function heatTier(body, socket) {
    if (DD.Heat && DD.Heat.tier) return DD.Heat.tier(socket);
    if (!body || !body.heatCap || !body.heatCap[socket]) return 0;
    var f = (body.heat[socket] || 0) / body.heatCap[socket];
    if (f >= 0.85) return 3;
    if (f >= 0.6) return 2;
    if (f >= 0.3) return 1;
    return 0;
  }

  function drawPlayer(st, p, camX, camY) {
    var body = st.body;
    var f = facing(p);
    var flip = f.flip;
    var bob = p.moving ? Math.round(Math.sin(clock * 11) * 1) : 0;
    var px = p.x * TILE - camX;
    var py = p.y * TILE + TILE - AVATAR_H - camY + bob;
    var flash = (p.flash > 0) ? DD.clamp(p.flash * 2, 0, 1) : 0;
    var cosPal = cosmeticPalette();
    var i, part, limb, key, pal;

    /* shadow */
    DD.Pixel.dim(px + 4, py + AVATAR_H - 4, 16, 3, 0.42, '#000000');
    DD.Pixel.dim(px + 6, py + AVATAR_H - 5, 12, 1, 0.3, '#000000');

    for (i = 0; i < PARTS.length; i++) {
      part = PARTS[i];
      limb = (body && DD.Body && DD.Body.limbOf) ? DD.Body.limbOf(body, part.s) : null;
      key = partKey(part.s, limb, f.dir);
      if (!key) {
        DD.Pixel.dim(px + part.x, py + part.y, part.w, part.h, 0.3, '#1a1020');
        continue;
      }
      pal = cosPal || (limb && limb.palette) || null;
      DD.Pixel.sprite(key, px + part.x, py + part.y, {
        flip: part.mirror ? !flip : flip,
        palette: pal,
        flash: flash
      });
    }
    /* Heat shimmer: the socket is cooking and it shows. */
    if (body) {
      for (i = 0; i < PARTS.length; i++) {
        part = PARTS[i];
        if (heatTier(body, part.s) < 3) continue;
        var a = 0.22 + 0.16 * Math.sin(clock * 9 + i);
        DD.Pixel.dim(px + part.x, py + part.y, part.w, part.h, a, '#ff5a1e');
        DD.Pixel.rect(px + part.x + 1 + ((i * 5 + Math.floor(clock * 14)) % Math.max(1, part.w - 2)),
          py + part.y - 2 - (Math.floor(clock * 9 + i * 3) % 5), 1, 2, '#ffb347');
      }
    }
  }

  /* -------------------------------------------------------------- floaters */
  /* DD.Explore.messages are {text, x, y, t, color} in tile coordinates, with t
   * counting DOWN from the message's life, so alpha rises as it fades. */
  function floaters(st, camX, camY, px, py) {
    var list = DD.Explore && DD.Explore.messages;
    if (!list || !list.length) return;
    var i, m, left, life, a, color;
    for (i = 0; i < list.length; i++) {
      m = list[i];
      if (!m || !m.text) continue;
      left = typeof m.t === 'number' ? m.t : FLOAT_LIFE;
      if (left <= 0) continue;
      life = m.life || FLOAT_LIFE;
      a = DD.clamp(left / life, 0, 1);
      color = m.color;
      if (typeof color === 'string' && color.charAt(0) !== '#') color = DD.C[color] || null;
      else if (typeof color !== 'string') color = null;
      DD.Pixel.text(m.text, ((typeof m.x === 'number' ? m.x : px) * TILE) + TILE / 2 - camX,
        ((typeof m.y === 'number' ? m.y : py) * TILE) - camY - 8 - (1 - a) * FLOAT_RISE - (i % 3) * 9, {
        align: 'center', color: color || DD.C.text, alpha: a, shadowColor: '#000000'
      });
    }
  }

  /* --------------------------------------------------------- shift warning */
  function shiftWarn(st) {
    var pulse = 0.55 + 0.45 * Math.abs(Math.sin(clock * 6));
    edges(DD.C.blood, 0.85 * pulse);
    var w = 320, h = 34, x = (VW - w) / 2, y = 150;
    DD.Pixel.dim(x, y, w, h, 0.72 * pulse, '#1a0308');
    DD.Pixel.frame(x, y, w, h, DD.C.bloodHi);
    DD.Pixel.text('LA TORRE SE REORDENA', VW / 2, y + 16, {
      scale: 2, align: 'center', color: DD.C.bloodHi
    });
    DD.Pixel.text('no te quedes quieto', VW / 2, y + 30, {
      align: 'center', color: DD.C.textDim
    });
  }

  /* -------------------------------------------------------------- minimap */
  /* The minimap is the player's memory, not the tower's plan: a tile is drawn
   * only once the player has been close enough to see it. */
  var MINI_R = 7;                 // tiles of sight the player reveals, per tile
  var seen = null;                // Uint8Array(map.w * map.h), 1 = explored
  var seenMap = null, seenRun = -1, seenFloor = -1, seenWarn = 0;

  /* A new array for a new run, a new floor or a rebuilt map. DD.Run.shiftFloor
   * re-carves the same array in place, so the tell is shiftWarn falling back to
   * zero: the tower has just finished rearranging itself. */
  function ensureSeen(st, map) {
    var warn = st.shiftWarn > 0 ? 1 : 0;
    var size = (map.w || 0) * (map.h || 0);
    if (!seen || map !== seenMap || st.runIndex !== seenRun || st.floor !== seenFloor ||
        seen.length !== size || (seenWarn > 0 && warn === 0)) {
      seen = new Uint8Array(size);
      seenMap = map;
      seenRun = st.runIndex;
      seenFloor = st.floor;
    }
    seenWarn = warn;
    return seen;
  }

  function seenAt(map, x, y) {
    if (!seen || x < 0 || y < 0 || x >= map.w || y >= map.h) return false;
    return !!seen[y * map.w + x];
  }

  /* Mark what the player can see from here: the same information the main view
   * already gives, so the minimap cannot outrun the screen. */
  function reveal(map, px, py) {
    var x0 = Math.max(0, px - MINI_R), x1 = Math.min(map.w - 1, px + MINI_R);
    var y0 = Math.max(0, py - MINI_R), y1 = Math.min(map.h - 1, py + MINI_R);
    for (var y = y0; y <= y1; y++) {
      for (var x = x0; x <= x1; x++) {
        if (DD.dist(x, y, px, py) > MINI_R) continue;
        if (!los(map, px, py, x, y)) continue;
        seen[y * map.w + x] = 1;
      }
    }
  }

  E.drawMinimap = function (x, y, w, h) {
    var st = DD.Run && DD.Run.state;
    var map = st && st.map;
    DD.Pixel.panel(x, y, w, h, { alpha: 0.86 });
    if (!map || !map.tiles || !map.w || !map.h) {
      DD.Pixel.text('sin mapa', x + w / 2, y + h / 2, { align: 'center', color: DD.C.textFaint });
      return;
    }
    ensureSeen(st, map);
    if (st.player) reveal(map, st.player.x | 0, st.player.y | 0);
    var bs = Math.floor(Math.min((w - 10) / map.w, (h - 10) / map.h));
    if (bs < 1) bs = 1;
    var mw = map.w * bs, mh = map.h * bs;
    var ox = Math.round(x + (w - mw) / 2), oy = Math.round(y + (h - mh) / 2);
    var tx, ty, id, i, e;
    DD.Pixel.clipPush(ox, oy, mw, mh);
    for (ty = 0; ty < map.h; ty++) {
      for (tx = 0; tx < map.w; tx++) {
        if (!seen[ty * map.w + tx]) continue;      // unexplored: the panel's own dark
        id = tileAt(map, tx, ty);
        if (id === DD.TILE_VOID) continue;
        DD.Pixel.rect(ox + tx * bs, oy + ty * bs, bs, bs,
          id === DD.TILE_WALL ? '#221a2e' : (id === DD.TILE_DOOR ? '#4a3a1e' : '#3b3050'));
      }
    }
    if (map.exit && seenAt(map, map.exit.x, map.exit.y)) {
      DD.Pixel.rect(ox + map.exit.x * bs - 1, oy + map.exit.y * bs - 1, bs + 2, bs + 2, DD.C.gold);
    }
    var list = map.entities;
    for (i = 0; list && i < list.length; i++) {
      e = list[i];
      if (!e || e.dead || e.kind !== 'altar' || !seenAt(map, e.x, e.y)) continue;
      DD.Pixel.rect(ox + e.x * bs, oy + e.y * bs, bs + 1, bs + 1, DD.C.bile);
    }
    if (st.player) {
      var pulse = 0.6 + 0.4 * Math.sin(clock * 5);
      DD.Pixel.rect(ox + st.player.x * bs - 1, oy + st.player.y * bs - 1, bs + 2, bs + 2, DD.C.text);
      DD.Pixel.rect(ox + st.player.x * bs, oy + st.player.y * bs, bs, bs, pulse > 0.8 ? DD.C.gold : DD.C.bloodHi);
    }
    DD.Pixel.clipPop();
    DD.Pixel.frame(ox - 1, oy - 1, mw + 2, mh + 2, DD.C.line);
    if (st.shiftWarn > 0) DD.Pixel.frame(x, y, w, h, DD.C.bloodHi);
  };

  /* -------------------------------------------------------- touch controls */
  function padButton(r, held) {
    if (DD.Pixel.hasSprite('ui_button')) {
      DD.Pixel.sprite('ui_button', r.x + (r.w - 32) / 2, r.y + (r.h - 32) / 2, { scale: 2 });
    } else {
      DD.Pixel.rect(r.x, r.y, r.w, r.h, DD.C.panelHi);
    }
    if (held) {
      DD.Pixel.dim(r.x, r.y, r.w, r.h, 0.3, DD.C.gold);
      DD.Pixel.frame(r.x, r.y, r.w, r.h, DD.C.gold);
    }
  }

  /* Pixel triangle: a one-pixel tip growing to a seven-pixel base. */
  function arrow(cx, cy, dx, dy) {
    for (var i = 0; i < 4; i++) {
      var w = 1 + i * 2;
      if (dy) DD.Pixel.rect(cx - w / 2, cy - dy * (-3 + i) - 2, w, 1, DD.C.text);
      else DD.Pixel.rect(cx - dx * (-3 + i) - 1, cy - w / 2, 1, w, DD.C.text);
    }
  }

  function touch() {
    var I = DD.Input;
    if (!I || !I.button) return;
    if (!I.virtual) {
      if (I.vaxis) { I.vaxis.x = 0; I.vaxis.y = 0; }
      return;
    }
    var b = PAD_C.b, half = b / 2;
    var rects = {
      vup: { x: PAD_C.x - half, y: PAD_C.y - half - b, w: b, h: b },
      vdown: { x: PAD_C.x - half, y: PAD_C.y + half, w: b, h: b },
      vleft: { x: PAD_C.x - half - b, y: PAD_C.y - half, w: b, h: b },
      vright: { x: PAD_C.x + half, y: PAD_C.y - half, w: b, h: b }
    };
    var ids = ['vup', 'vdown', 'vleft', 'vright'], i, id, r, st, held = {};
    for (i = 0; i < ids.length; i++) {
      id = ids[i];
      r = rects[id];
      I.button(id, r.x, r.y, r.w, r.h);
      st = I.btns && I.btns[id];
      held[id] = !!(st && (st.held || st.active));
      padButton(r, held[id]);
      arrow(r.x + r.w / 2, r.y + r.h / 2, id === 'vleft' ? -1 : (id === 'vright' ? 1 : 0), id === 'vup' ? -1 : (id === 'vdown' ? 1 : 0));
    }
    if (I.vaxis) {
      I.vaxis.x = (held.vright ? 1 : 0) - (held.vleft ? 1 : 0);
      I.vaxis.y = (held.vdown ? 1 : 0) - (held.vup ? 1 : 0);
    }
    var act = ACT_B;
    var tapped = I.button('vact', act.x, act.y, act.w, act.h);
    var ast = I.btns && I.btns.vact;
    padButton(act, !!(ast && (ast.held || ast.active)));
    DD.Pixel.text('ACTUAR', act.x + act.w / 2, act.y + act.h / 2 + 3, {
      align: 'center', scale: 1, color: DD.C.text
    });
    if (tapped) {
      /* DD.Explore.update also reads btns.vact.active; clear it here so the tap
       * fires exactly once instead of again on its next update. */
      if (ast) ast.active = false;
      if (DD.Explore && DD.Explore.interact) DD.Explore.interact();
    }
  }

  /* --------------------------------------------------------------- prompt */
  function prompt(st, map, px, py) {
    var text = null;
    var id = tileAt(map, px, py);
    if (id === DD.TILE_STAIRS) text = 'E - Subir';
    else if (id === DD.TILE_EXIT) text = 'E - ESCAPAR';
    else {
      /* DD.Explore lets an altar be used from any adjacent tile. */
      var list = map.entities;
      for (var i = 0; list && i < list.length; i++) {
        var e = list[i];
        if (e && !e.dead && e.kind === 'altar' &&
            Math.abs(e.x - px) <= 1 && Math.abs(e.y - py) <= 1) { text = 'E - Usar altar'; break; }
      }
    }
    if (!text) return;
    var w = DD.Pixel.textW(text, 1) + 20;
    var x = Math.round((VW - w) / 2);
    DD.Pixel.panel(x, PROMPT_Y, w, 18, { alpha: 0.9 });
    DD.Pixel.text(text, VW / 2, PROMPT_Y + 13, { align: 'center', color: DD.C.gold });
  }

  function empty() {
    DD.Pixel.rect(0, 0, VW, VH, DD.C.void);
    edges(DD.C.void, 0.6);
    DD.Pixel.text('La torre aún no existe.', VW / 2, VH / 2, {
      align: 'center', color: DD.C.textFaint
    });
  }

  /* ----------------------------------------------------------------- frame */
  E.draw = function () {
    if (!DD.Canvas || !DD.Canvas.ctx) return;
    var d = frame();
    var st = DD.Run && DD.Run.state;
    if (!st || !st.map || !st.map.tiles) { empty(); return; }
    var map = st.map;
    var p = st.player;
    var px = p ? (p.x | 0) : (map.start ? map.start.x | 0 : 0);
    var py = p ? (p.y | 0) : (map.start ? map.start.y | 0 : 0);

    snapshotCodex(st);
    if (p) { detectHit(st); trackMove(px, py, d); }
    updateCamera(map, px, py, d);

    var amp = shake.t > 0 ? shake.amp : 0;
    if (st.shiftWarn > 0) amp = Math.max(amp, SHAKE_SHIFT);
    var sx = 0, sy = 0;
    if (amp > 0 && DD.Pixel.shake) { var s = DD.Pixel.shake(clock, amp); sx = s.x; sy = s.y; }
    var camX = Math.round(cam.x) + sx, camY = Math.round(cam.y) + sy;

    DD.Pixel.rect(0, 0, VW, VH, DD.C.void);
    drawTiles(map, camX, camY, px, py);
    torch(camX, camY, px, py);
    drawEntities(map, camX, camY, px, py, st);
    if (p) drawPlayer(st, p, camX, camY);
    floaters(st, camX, camY, px, py);
    if (st.shiftWarn > 0) shiftWarn(st); else edges(DD.C.void, 0.45);
    E.drawMinimap(MINI.x, MINI.y, MINI.w, MINI.h);
    touch();
    prompt(st, map, px, py);
  };
})();
