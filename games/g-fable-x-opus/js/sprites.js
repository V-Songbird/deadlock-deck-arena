// P2 sprites: all hand-defined pixel art for Deadlock Deck.
// Sprite format: { w, h, rows: [string], pal: { char: '#hex' } }, '.' is transparent.
window.Sprites = (function () {
  'use strict';

  // ---------------------------------------------------------------- helpers
  // Builds a sprite, derives w/h and validates rows so mistakes throw at load time.
  function spr(name, pal, rows) {
    var w = rows[0].length, i, j, c;
    for (i = 0; i < rows.length; i++) {
      if (rows[i].length !== w) {
        throw new Error('Sprite "' + name + '": row ' + i + ' has length ' + rows[i].length + ', expected ' + w);
      }
      for (j = 0; j < w; j++) {
        c = rows[i].charAt(j);
        if (c !== '.' && !pal[c]) {
          throw new Error('Sprite "' + name + '": unknown palette char "' + c + '" at row ' + i + ', col ' + j);
        }
      }
    }
    return { w: w, h: rows.length, rows: rows, pal: pal };
  }

  // Exact Core.PAL hex strings (literals so this file has no load-order dependency).
  var INK = '#080508', BG = '#0b0710', PANEL = '#160e1f', WALL = '#2a1b3d', WALL_LIT = '#3d2a55',
    FLOOR = '#1a1226', FLOOR2 = '#1f1630', BRASS = '#b08d57', COPPER = '#8c4a2f', BLOOD = '#7a1f2b',
    BONE = '#e8dcc8', DIM = '#8a7f8f', SICK = '#6fbf3f', POISON = '#9c4dcc',
    FIRE1 = '#ff9a2a', FIRE2 = '#ff3b1f', FIRE3 = '#ffd25a', HEAT = '#ff5a36', HP = '#c0392b',
    SKIN = '#9aa77a', SKIN_D = '#5f6b4a', STITCH = '#d9c9a5', WHITE = '#ffffff';

  // Extra shades with no Core.PAL name (kept few, 3-5 shades per material).
  var PINK = '#d9899b', PINK_D = '#8f4a5c', ROT = '#6b5a72', ROT_D = '#3a3044',
    COAT = '#ddd7c2', OLIVE = '#7c8352', BRASS_L = '#d8b878', BRASS_D = '#6e5533',
    STEEL = '#b9c0c8', STEEL_D = '#6c757e', RED = '#c2442f', PALE = '#cfc3a8',
    PALE_D = '#a3937a', GREY = '#4a4453', CYAN = '#2f8f8f', CYAN_L = '#7fe3d0', GREEN_D = '#2f5f22';

  // ---------------------------------------------------------- family palettes
  var P_BASE = { o: INK, s: SKIN, d: SKIN_D, t: STITCH, w: WHITE, b: BLOOD };
  var P_HOMU = { o: INK, s: PINK, d: PINK_D, t: STITCH, w: WHITE, b: BLOOD, n: BONE };
  var P_GHOUL = { o: INK, s: ROT, d: ROT_D, t: STITCH, w: WHITE, b: BLOOD, m: BRASS, g: DIM, p: WALL_LIT };

  var parts = {};

  // --------------------------------------------------------------- base body
  parts.base = {
    head: spr('base_head', P_BASE, [
      '....oooo....',
      '..oossssoo..',
      '.osssssssso.',
      '.osstttttso.',
      '.osdwssdwso.',
      '.ossdssdsso.',
      '.osssssssso.',
      '.ossototoso.',
      '..osssssso..',
      '..ossddsso..',
      '...ooossoo..',
      '....oooo....'
    ]),
    torso: spr('base_torso', P_BASE, [
      '....oooooooo....',
      '..oossssssssoo..',
      '.osssssssssssso.',
      '.osstttttttssso.',
      '.osssssssssssso.',
      '.osdsssssssssdo.',
      '.osssssttssssso.',
      '.osdssstsssssdo.',
      '.osddsstssddsso.',
      '.osssssttssssso.',
      '.osddsstssddsso.',
      '.osssssttssssso.',
      '.osddsstssddsso.',
      '.ossbssttssbsso.',
      '.osssssttssssso.',
      '.osssssssssssso.',
      '.osstttttttssso.',
      '.osssssssssssso.',
      '..oossssssssoo..',
      '....oooooooo....'
    ]),
    arm: spr('base_arm', P_BASE, [
      '..oooo..',
      '.osssso.',
      '.osttso.',
      '.ossdso.',
      '.osssso.',
      '.osdsso.',
      '.osttso.',
      '.osddso.',
      '.osssso.',
      '.ossdso.',
      '.osssso.',
      '.osttso.',
      '.osssso.',
      'osssssso',
      'ossoosso',
      '.oo..oo.'
    ]),
    leg: spr('base_leg', P_BASE, [
      '.oooooo.',
      'osssssso',
      'ostttsso',
      'osssssso',
      'ossdddso',
      'osssssso',
      '.osttso.',
      '.osddso.',
      '.osssso.',
      '.ossdso.',
      '.osssso.',
      '.osttso.',
      '.osssso.',
      'oossssoo'
    ])
  };

  // ---------------------------------------------------------- homunculo body
  parts.homunculo = {
    head: spr('homunculo_head', P_HOMU, [
      '....oooo....',
      '...osssso...',
      '..osssssso..',
      '.osssttssso.',
      '.oooossoooo.',
      '.oowossowoo.',
      '.oooossoooo.',
      '.osssssssso.',
      '.oswswswsso.',
      '.osddddddso.',
      '..ostddtso..',
      '...oossoo...'
    ]),
    torso: spr('homunculo_torso', P_HOMU, [
      '....oooooooo....',
      '..oossssssssoo..',
      '.osssssssssssso.',
      '.ossttttttttsso.',
      '.osssssssssssso.',
      '.osdsssttsssdso.',
      '.osddssttssddso.',
      '.osssssttssssso.',
      '.osddssttssddso.',
      '.osssssttssssso.',
      '.osddssttssddso.',
      '.ossbssttssbsso.',
      '.osssssttssssso.',
      '.osdsssttsssdso.',
      '.osssssssssssso.',
      '.ossttttttttsso.',
      '.osssssssssssso.',
      '.osdssssssssdso.',
      '..oossssssssoo..',
      '....oooooooo....'
    ]),
    arm: spr('homunculo_arm', P_HOMU, [
      '..oooo..',
      '.osssso.',
      '.osttso.',
      '.ossdso.',
      '.osssso.',
      '.osdsso.',
      '.osttso.',
      '.osddso.',
      '.osssso.',
      '.ossdso.',
      '.osttso.',
      '.osssso.',
      'osssssso',
      'osssssso',
      'onsnnsno',
      '.n.nn.n.'
    ]),
    leg: spr('homunculo_leg', P_HOMU, [
      '.oooooo.',
      'osssssso',
      'osttttso',
      'osssssso',
      'ossdddso',
      '.osssso.',
      '.osttso.',
      '.osddso.',
      '.osssso.',
      '.ossdso.',
      '.osssso.',
      '.osttso.',
      'osssssso',
      'onnoonno'
    ])
  };

  // -------------------------------------------------------------- ghoul body
  parts.ghoul = {
    head: spr('ghoul_head', P_GHOUL, [
      '..oooooooo..',
      '.osssssssso.',
      'osssssssssso',
      'osddddddddso',
      'osdwsddswdso',
      'ossdssssdsso',
      'ossttttttsso',
      'osssssssssso',
      'ossowowowsso',
      'osbssssssbso',
      '.ommmmmmmmo.',
      '..oooooooo..'
    ]),
    torso: spr('ghoul_torso', P_GHOUL, [
      '...oooooooooo...',
      '.oossssssssssoo.',
      'osssssssssssssso',
      'ossttttttttttsso',
      'osssssssssssssso',
      'osdssmmmmmmssdso',
      'osddssssssssddso',
      'osddssttttssddso',
      'osssssttttssssso',
      'osddssssssssddso',
      'ossbssssssssbsso',
      'osddssssssssddso',
      'osssmmmmmmmmssso',
      'osddssssssssddso',
      'osssssttttssssso',
      'osssssssssssssso',
      'ossttttttttttsso',
      '.osssssssssssso.',
      '.oossssssssssoo.',
      '...oooooooooo...'
    ]),
    arm: spr('ghoul_arm', P_GHOUL, [
      '.oooooo.',
      'osssssso',
      'osttttso',
      'ossddsso',
      'osssssso',
      'ommmmmmo',
      'osssssso',
      'ossddsso',
      '.osssso.',
      '.osttso.',
      '.ossdso.',
      '.ommmmo.',
      '.osssso.',
      'osssssso',
      'ossddsso',
      '.oooooo.'
    ]),
    leg: spr('ghoul_leg', P_GHOUL, [
      '.oooooo.',
      'osssssso',
      'osttttso',
      'ossddsso',
      'osssssso',
      'ommmmmmo',
      'osssssso',
      'ossddsso',
      '.osssso.',
      '.osttso.',
      '.ossdso.',
      '.osssso.',
      'osssssso',
      'oossssoo'
    ])
  };

  // --------------------------------------------------------- alquimista body
  var P_ALQ = { o: INK, s: PALE, e: PALE_D, c: COAT, d: OLIVE, t: STITCH, m: BRASS, k: BRASS_D, g: SICK, b: BLOOD, w: WHITE };
  parts.alquimista = {
    head: spr('alquimista_head', P_ALQ, [
      '....oooo....',
      '..oossssoo..',
      '.osssssssso.',
      '.osstttssso.',
      '.ommmmmmmmo.',
      '.omgmmmmgmo.',
      '.ommmmmmmmo.',
      '.osssssssso.',
      '.osseooesso.',
      '.osseeeesso.',
      '..octcctco..',
      '...ooccoo...'
    ]),
    torso: spr('alquimista_torso', P_ALQ, [
      '....oooooooo....',
      '..ooccccccccoo..',
      '.occccccccccco..',
      '.octtttttttttco.',
      '.occcccccccccco.',
      '.occdccccccdcco.',
      '.occmgmccccccco.',
      '.occmgmccttccco.',
      '.occmgmccccccco.',
      '.occcmcccttccco.',
      '.occcccddccccco.',
      '.occccttcccccco.',
      '.obbccccccccbbo.',
      '.occcccccccccco.',
      '.occdccccttccco.',
      '.occcccccccccco.',
      '.octtttttttttco.',
      '.occcccccccccco.',
      '..ooccccccccoo..',
      '....oooooooo....'
    ]),
    arm: spr('alquimista_arm', P_ALQ, [
      '..oooo..',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.ocdcco.',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.occdco.',
      '.occcco.',
      '.octtco.',
      '.osssso.',
      'osssssso',
      'osmggmso',
      '.omggmo.',
      '..oggo..'
    ]),
    leg: spr('alquimista_leg', P_ALQ, [
      '.oooooo.',
      'occcccco',
      'octtttco',
      'occcccco',
      'ocdccdco',
      'occcccco',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.ocddco.',
      '.occcco.',
      '.okkkko.',
      'okkkkkko',
      'ookkkkoo'
    ])
  };

  // ----------------------------------------------------------- automata body
  var P_AUTO = { o: INK, s: BRASS, d: BRASS_D, l: BRASS_L, c: COPPER, t: STITCH, g: DIM, e: FIRE1, w: WHITE };
  parts.automata = {
    head: spr('automata_head', P_AUTO, [
      '....oooo....',
      '..oolllloo..',
      '.osllllllso.',
      '.osdttttdso.',
      '.osdssssdso.',
      '.osdeeeedso.',
      '.osddddddso.',
      '.osccccccso.',
      '.osococosso.',
      '.ossccccsso.',
      '..ostddtso..',
      '...oossoo...'
    ]),
    torso: spr('automata_torso', P_AUTO, [
      '....oooooooo....',
      '..oolllllllloo..',
      '.osllllllllllso.',
      '.osdttttttttdso.',
      '.osssssssssssso.',
      '.ossdsssssssdso.',
      '.ossssccccsssso.',
      '.ossssccccsssso.',
      '.ossscollocssso.',
      '.ossscollocssso.',
      '.ossssccccsssso.',
      '.osdssstssssdso.',
      '.ossgosssssogso.',
      '.ossgosssssogso.',
      '.osssssttssssso.',
      '.osccccccccccso.',
      '.ostttttttttsso.',
      '.osssssssssssso.',
      '..oossssssssoo..',
      '....oooooooo....'
    ]),
    arm: spr('automata_arm', P_AUTO, [
      '..oooo..',
      '.ollllo.',
      '.osttso.',
      '.osddso.',
      '.osooso.',
      '.osccso.',
      '.osttso.',
      '.osooso.',
      '.osssso.',
      '.osddso.',
      '.osttso.',
      '.osccso.',
      'osssssso',
      'osccccso',
      'oso..oso',
      '.o....o.'
    ]),
    leg: spr('automata_leg', P_AUTO, [
      '.oooooo.',
      'ollllllo',
      'osttttso',
      'ossddsso',
      'osooooso',
      'osccccso',
      '.osttso.',
      '.osddso.',
      '.osooso.',
      '.osssso.',
      '.osttso.',
      'osccccso',
      'osssssso',
      'ooccccoo'
    ])
  };

  // ----------------------------------------------------------- cirujano body
  var P_CIR = { o: INK, s: PALE, d: PALE_D, c: COAT, b: BLOOD, t: STITCH, m: STEEL, k: STEEL_D, w: WHITE };
  parts.cirujano = {
    head: spr('cirujano_head', P_CIR, [
      '....oooo....',
      '..ooccccoo..',
      '.occcccccco.',
      '.octtttttco.',
      '.osssssssso.',
      '.oswdssdwso.',
      '.ossdssdsso.',
      '.occcccccco.',
      '.octtttttco.',
      '.occbbbbcco.',
      '..occcccco..',
      '...oossoo...'
    ]),
    torso: spr('cirujano_torso', P_CIR, [
      '....oooooooo....',
      '..ooccccccccoo..',
      '.occcccccccccco.',
      '.octtttttttttco.',
      '.occcccccccccco.',
      '.occkccccccckco.',
      '.occckcccckccco.',
      '.occcckbbkcccco.',
      '.occcbbbbbbccco.',
      '.occcbbccbbccco.',
      '.occccbccbcccco.',
      '.occccttttcccco.',
      '.occcccccccccco.',
      '.obcccccccccbco.',
      '.occcccbbccccco.',
      '.occcccccccccco.',
      '.octtttttttttco.',
      '.occcccccccccco.',
      '..ooccccccccoo..',
      '....oooooooo....'
    ]),
    arm: spr('cirujano_arm', P_CIR, [
      '..oooo..',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.ocbcco.',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.osssso.',
      '.osdsso.',
      '.osttso.',
      'osssssso',
      'ossddsso',
      '.ommmmo.',
      '..okko..',
      '...oo...'
    ]),
    leg: spr('cirujano_leg', P_CIR, [
      '.oooooo.',
      'occcccco',
      'octtttco',
      'occcccco',
      'ocbccbco',
      '.occcco.',
      '.octtco.',
      '.occcco.',
      '.occbco.',
      '.occcco.',
      '.okkkko.',
      'okkkkkko',
      'okkkkkko',
      'ookkkkoo'
    ])
  };

  // ------------------------------------------------------------ quimera body
  var P_QUI = { o: INK, r: RED, b: BLOOD, n: BONE, t: STITCH, s: SKIN, d: SKIN_D, p: WALL_LIT, w: WHITE, g: SICK };
  parts.quimera = {
    head: spr('quimera_head', P_QUI, [
      '..o..oo..o..',
      '..on.oo.no..',
      '.onrroorrno.',
      '.orrrrrrrro.',
      '.orwrbbrgro.',
      '.orrbbbbrro.',
      '.orttttttro.',
      '.onrrrrrrno.',
      '.onwnwnwnno.',
      '.obrrrrrrbo.',
      '..optddtpo..',
      '...oorroo...'
    ]),
    torso: spr('quimera_torso', P_QUI, [
      '...oooooooooo...',
      '..onrrrrrrrrno..',
      '.onrrrrrrrrrrno.',
      '.orttttttttttro.',
      '.orrrrrrrrrrrro.',
      '.onrrnnnnnnrrno.',
      '.orrnrrrrrrnrro.',
      '.oprrrbbbbrrrpo.',
      '.oprrrbbbbrrrpo.',
      '.orrrrrttttrrro.',
      '.osrrrrrrrrrrdo.',
      '.osrrnrrrrnrrdo.',
      '.oprrrrrrrrrrpo.',
      '.orrrrrttttrrro.',
      '.orbrrrrrrrrbro.',
      '.orrrrrrrrrrrro.',
      '.orttttttttttro.',
      '.onrrrrrrrrrrno.',
      '..oorrrrrrrroo..',
      '....oooooooo....'
    ]),
    arm: spr('quimera_arm', P_QUI, [
      '..oooo..',
      '.onrrno.',
      '.orttro.',
      '.orrrro.',
      '.oprrro.',
      '.orrrro.',
      '.orttro.',
      '.onrrno.',
      '.orrrro.',
      '.osrrro.',
      '.orttro.',
      '.orrrro.',
      'orrrrrro',
      'orbrrbro',
      'onrnnrno',
      '.n.nn.n.'
    ]),
    leg: spr('quimera_leg', P_QUI, [
      '.oooooo.',
      'onrrrrno',
      'orttttro',
      'orrrrrro',
      'oprrrrpo',
      'orrrrrro',
      '.orttro.',
      '.orbbro.',
      '.orrrro.',
      '.osrrdo.',
      '.orttro.',
      'orrrrrro',
      'onrrrrno',
      'nnoooonn'
    ])
  };

  // ------------------------------------------------------------------ stumps
  var P_STUMP = { o: INK, s: SKIN, d: SKIN_D, t: STITCH, b: BLOOD, n: BONE };
  var stumps = {
    head: spr('stump_head', P_STUMP, [
      '............',
      '............',
      '............',
      '............',
      '....oooo....',
      '...obbbbo...',
      '..obbnnbbo..',
      '..onnnnnno..',
      '..ontnntno..',
      '..onnnnnno..',
      '...osssso...',
      '....oooo....'
    ]),
    torso: spr('stump_torso', P_STUMP, [
      '....oooooooo....',
      '..oobbbbbbbboo..',
      '.obnnnnnnnnnnbo.',
      '.onnttttttttnno.',
      '.onnnnnnnnnnnno.',
      '.obnnnnnnnnnnbo.',
      '.onnnnbbbbnnnno.',
      '.onnnbbbbbbnnno.',
      '.onntbbbbbbtnno.',
      '.onnnbbbbbbnnno.',
      '.onnnnbbbbnnnno.',
      '.obnnnnnnnnnnbo.',
      '.onnttttttttnno.',
      '.onnnnnnnnnnnno.',
      '.obnnnnnnnnnnbo.',
      '.onnnnnnnnnnnno.',
      '.onnttttttttnno.',
      '.obbnnnnnnnnbbo.',
      '..oobbbbbbbboo..',
      '....oooooooo....'
    ]),
    arm: spr('stump_arm', P_STUMP, [
      '..oooo..',
      '.osssso.',
      '.osttso.',
      '.ossdso.',
      '.obbbbo.',
      '.onnnno.',
      '.ontnto.',
      '.onnnno.',
      '..obbo..',
      '...bb...',
      '....b...',
      '........',
      '........',
      '........',
      '........',
      '........'
    ]),
    leg: spr('stump_leg', P_STUMP, [
      '.oooooo.',
      'osssssso',
      'osttttso',
      'ossdddso',
      'obbbbbbo',
      'onnnnnno',
      'ontnntno',
      'onnnnnno',
      '.obbbbo.',
      '..obbo..',
      '...bb...',
      '....b...',
      '........',
      '........'
    ])
  };

  // ------------------------------------------------------------ body drawing
  var BODY = { w: 40, h: 48, head: [14, 2], torso: [12, 14], armL: [4, 16], armR: [28, 16], legL: [12, 33], legR: [20, 33] };
  var SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  var DRAW_ORDER = ['legL', 'legR', 'torso', 'armL', 'armR', 'head'];
  var MIRRORED = { armR: 1, legR: 1 };          // right limbs reuse the left sprite flipped
  var BOBBED = { head: 1, torso: 1, armL: 1, armR: 1 };  // legs stay planted while idling

  function partFor(family, slotType) {
    var fam = family && parts[family];
    return fam ? fam[slotType] : stumps[slotType];
  }

  // family = null draws the stump for that slot type.
  function drawPart(family, slotType, x, y, opt) {
    opt = opt || {};
    Core.gfx.sprite(partFor(family, slotType), x, y, {
      scale: opt.scale || 1, flip: !!opt.flip, tint: opt.tint || null, alpha: opt.alpha == null ? 1 : opt.alpha
    });
  }

  function drawBody(fams, x, y, opt) {
    opt = opt || {};
    fams = fams || {};
    var scale = opt.scale || 1, flip = !!opt.flip, tint = opt.tint || null, bob = opt.bob || 0,
      alpha = opt.alpha == null ? 1 : opt.alpha, i, slot, off, s, f, px, py;
    for (i = 0; i < DRAW_ORDER.length; i++) {
      slot = DRAW_ORDER[i];
      off = BODY[slot];
      s = partFor(fams[slot], SLOT_TYPE[slot]);
      f = !!MIRRORED[slot];
      px = off[0];
      py = off[1] - (BOBBED[slot] ? bob : 0);
      if (flip) { px = BODY.w - off[0] - s.w; f = !f; }   // mirror the whole layout
      Core.gfx.sprite(s, x + px * scale, y + py * scale, { scale: scale, flip: f, tint: tint, alpha: alpha });
    }
  }

  // ------------------------------------------------------------------- tiles
  var P_TILE = {
    o: INK, f: FLOOR, g: FLOOR2, h: WALL, l: WALL_LIT, k: GREY, x: PANEL,
    m: BRASS, c: COPPER, d: BRASS_D, u: STEEL, v: STEEL_D, i: DIM,
    n: BONE, b: BLOOD, t: STITCH, s: SICK, j: GREEN_D, a: CYAN, q: CYAN_L, p: POISON,
    y: FIRE3, e: FIRE1, r: FIRE2, w: WHITE
  };
  var tiles = {
    floor: spr('tile_floor', P_TILE, [
      'gggggggggggggggg',
      'gfffffffffffffff',
      'gfffffffffffffff',
      'gfffofffffffffff',
      'gfffffofffffffff',
      'gfffffffofffffff',
      'gfffffffffffffff',
      'gfffffffffffffgf',
      'gfffffffffffffff',
      'gfofffffffffffff',
      'gfffffffffffffff',
      'gfffffffffgfffff',
      'gfffffffffffffff',
      'gfffffofffffffff',
      'gfffffffffffffff',
      'gfffffffffffffff'
    ]),
    floor2: spr('tile_floor2', P_TILE, [
      'ffffffffffffffff',
      'fggggggggggggggg',
      'fgggggghgggggggg',
      'gggggggggggggggg',
      'fgggoggggggggggg',
      'fggogggggggggggg',
      'fogggggggggggggg',
      'fggggggggggggggg',
      'fgggggggggghgggg',
      'fggggggggggggggg',
      'fggggggggggggoog',
      'fggggggggggggggg',
      'fggghggggggggggg',
      'fggggggggggggggg',
      'fggggggggggggggg',
      'fggggggggggggggg'
    ]),
    floor3: spr('tile_floor3', P_TILE, [
      'gggggggggggggggg',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhghhhhhhhhh',
      'ghhhhhhghhhhhhhh',
      'ghhhhhhhghhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghghhhhhhhhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhhhhhhhhggh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhghhhhhhhhhh',
      'ghhhhhhhhhhhhhhh',
      'ghhhhhhhhhhhhhhh'
    ]),
    wall: spr('tile_wall', P_TILE, [
      'llllllllllllllll',
      'hhhhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhhhh',
      'hhhhhhhhhhhhhhhh',
      'oooooooooooooooo',
      'lhhhhhhohhhhhhho',
      'hhhhhhhohhhhhhho',
      'hhhhhhhohhhhhhho',
      'oooooooooooooooo',
      'lhhohhhhhhhohhhh',
      'hhhohhhhhhhohhhh',
      'hhhohhhhhhhohhhh',
      'oooooooooooooooo',
      'lhhhhhhohhhhhhho',
      'hhhhhhhohhhhhhho',
      'hhhhhhhohhhhhhho'
    ]),
    exit: spr('tile_exit', P_TILE, [
      'hhhhmmmmmmmmhhhh',
      'hhmmjjjjjjjjmmhh',
      'hmmjssssssssjmmh',
      'hmjssssssssssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjsssnnnnsssjmh',
      'hmjssssssssssjmh',
      'hmjssssssssssjmh',
      'hmmmmmmmmmmmmmmh',
      'hhoooooooooooohh'
    ]),
    stairs: spr('tile_stairs', P_TILE, [
      'hhhhhhhhhhhhhhhh',
      'hhhlllllllllhhhh',
      'hhhkkkkkkkkkhhhh',
      'hhoooooooooooohh',
      'hhllllllllllllhh',
      'hhkkkkkkkkkkkkhh',
      'hooooooooooooooh',
      'hllllllllllllllh',
      'hkkkkkkkkkkkkkkh',
      'oooooooooooooooo',
      'llllllllllllllll',
      'kkkkkkkkkkkkkkkk',
      'oooooooooooooooo',
      'llllllllllllllll',
      'kkkkkkkkkkkkkkkk',
      'oooooooooooooooo'
    ]),
    chest: spr('tile_chest', P_TILE, [
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffooooooooooooff',
      'fommmmmmmmmmmmof',
      'foccccccccccccof',
      'foccccmmmmccccof',
      'foooooooooooooof',
      'focmmmccccmmmcof',
      'foccccmmmmccccof',
      'focccmoooomcccof',
      'focccmoyyomcccof',
      'focccmoooomcccof',
      'foccccccccccccof',
      'fommmmmmmmmmmmof',
      'ffooooooooooooff',
      'ffffffffffffffff'
    ]),
    coolant: spr('tile_coolant', P_TILE, [
      'ffffffffffffffff',
      'ffffffooooffffff',
      'ffffffmmmmffffff',
      'ffffffommoffffff',
      'fffooaaaaaaoofff',
      'fffoaaaaaaaaofff',
      'fffoqaaaaaaqofff',
      'fffoaaaaaaaaofff',
      'fffoaqaaaaqaofff',
      'fffoaaaaaaaaofff',
      'fffoqaaaaaaqofff',
      'fffoaaaaaaaaofff',
      'fffoooooooooofff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    suture: spr('tile_suture', P_TILE, [
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffuuff',
      'ffffffffffuuffff',
      'ffffffffuuffffff',
      'ffooooooooooooff',
      'fonnnnnnnnnnnnof',
      'fonnttnnnnttnnof',
      'fonnnnnnnnnnnnof',
      'fonnttnnnnttnnof',
      'fonnnnnnnnnnnnof',
      'ffooooooooooooff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    clockwork: spr('tile_clockwork', P_TILE, [
      'ffffffffffffffff',
      'fffffoommoofffff',
      'ffffommmmmmoffff',
      'ffoommmmmmmmooff',
      'fommmmdmmdmmmmof',
      'fommmmoooommmmof',
      'fommmoooooommmof',
      'ommmmoooooommmmo',
      'ommmmoooooommmmo',
      'fommmoooooommmof',
      'fommmmoooommmmof',
      'fommmmdmmdmmmmof',
      'ffoommmmmmmmooff',
      'ffffommmmmmoffff',
      'fffffoommoofffff',
      'ffffffffffffffff'
    ]),
    ichor: spr('tile_ichor', P_TILE, [
      'ffffffffffffffff',
      'ffffffffffffffff',
      'fffffffoofffffff',
      'ffffffojjoffffff',
      'ffffffossoffffff',
      'fffffojssjofffff',
      'fffffosnnsofffff',
      'fffojssnnssjofff',
      'fffossssssssofff',
      'fffojssssssjofff',
      'fffossssssssofff',
      'ffffojssssjoffff',
      'fffffoooooofffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    spikes: spr('tile_spikes', P_TILE, [
      'ffffffffffffffff',
      'ffnfffnfffnfffnf',
      'ffnfffnfffnfffnf',
      'fnnnfnnnfnnnfnnn',
      'fnnnfnnnfnnnfnnn',
      'fnbnfnbnfnbnfnbn',
      'fnnnfnnnfnnnfnnn',
      'oooooooooooooooo',
      'kkkkkkkkkkkkkkkk',
      'okkookkookkookko',
      'oooooooooooooooo',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    acid: spr('tile_acid', P_TILE, [
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffjssjffffff',
      'ffooooooooooooff',
      'fojssssssssssjof',
      'ojsssnssssnsssjo',
      'ojssssssssssssjo',
      'ojssnssssssnssjo',
      'ojssssssssssssjo',
      'ojsssssnnsssssjo',
      'ojssssssssssssjo',
      'fojssssssssssjof',
      'ffooooooooooooff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    fire0: spr('tile_fire0', P_TILE, [
      'ffffffffffffffff',
      'ffffffffffffffff',
      'fffffffyffffffff',
      'ffffffeyefffffff',
      'fffffeyyyeffffef',
      'fffffreyyerfffff',
      'ffffreeyyeerffff',
      'ffffrreyyerrffff',
      'fffrreeyyeerrfff',
      'fffrrreeeerrrfff',
      'ffforrrrrrrrofff',
      'ffffoorrrrooffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    fire1: spr('tile_fire1', P_TILE, [
      'ffffffffffffffff',
      'ffffffyfffffffff',
      'fffffeyfffffffff',
      'ffeffeyyefffffff',
      'ffffeyyyyeffffff',
      'ffffreyyerffefff',
      'ffffreeyyeerffff',
      'fffrreeyyerrffff',
      'fffrreeyyeerrfff',
      'fffrrreeeerrrfff',
      'fforrrrrrrrrroff',
      'ffforrrerrroffff',
      'ffffooroofffffff',
      'ffffffffffffffff',
      'ffffffffffffffff',
      'ffffffffffffffff'
    ]),
    table: spr('tile_table', P_TILE, [
      'oooooooooooooooo',
      'ouuuuuuuuuuuuuuo',
      'ovuuuuuuuuuuuuvo',
      'ouuuuuuuuuuuuuuo',
      'occcccmmmmccccco',
      'occcccmmmmccccco',
      'ouuuuuuuuuuuuuuo',
      'ovuuuubbuuuuuuvo',
      'ouuuuubbuuuuuuuo',
      'ouuuuuuuuuuuuuuo',
      'occcccmmmmccccco',
      'occcccmmmmccccco',
      'ouuuuuuuuuuuuuuo',
      'ovuuuuuuuuuuuuvo',
      'ouuuuuuuuuuuuuuo',
      'oooooooooooooooo'
    ]),
    alembic: spr('tile_alembic', P_TILE, [
      '......omo.......',
      '......omo.......',
      '......omo.......',
      '.....ommmo......',
      '....oxxxxxo.....',
      '...oxxxxxxxo....',
      '...oxxqxxxxo....',
      '..oxxxxxxxxxo...',
      '..oxsssssssxo...',
      '..ossssssssso...',
      '..osjsssssjso...',
      '..ossssssssso...',
      '...ossssssso....',
      '....oosssoo.....',
      '.....ommmo......',
      '....ommmmmo.....'
    ]),
    shelf: spr('tile_shelf', P_TILE, [
      '................',
      '..oooooooooooo..',
      '..occcccccccco..',
      '..oooooooooooo..',
      '...ooo.ooo.ooo..',
      '...oso.oqo.obo..',
      '...oso.oqo.obo..',
      '...oso.oqo.obo..',
      '...ooo.ooo.ooo..',
      '..oooooooooooo..',
      '..occcccccccco..',
      '..oooooooooooo..',
      '...ooo.ooo.ooo..',
      '...ono.omo.ono..',
      '...ooo.ooo.ooo..',
      '................'
    ])
  };

  // ------------------------------------------------------------------- icons
  var P_ICON = { o: INK, n: BONE, h: HP, y: FIRE3, e: FIRE1, r: FIRE2, s: SICK, m: BRASS, i: DIM, w: WHITE, b: BLOOD };
  var icons = {
    heart: spr('icon_heart', P_ICON, [
      '.oo..oo.',
      'ohhoohho',
      'owhhhhho',
      'ohhhhhho',
      '.ohhhho.',
      '..ohho..',
      '...oo...',
      '........'
    ]),
    bolt: spr('icon_bolt', P_ICON, [
      '...oo...',
      '..oyo...',
      '.oyyo...',
      'oyyyoyo.',
      '.oyyyyyo',
      '...oyyo.',
      '....oyo.',
      '.....oo.'
    ]),
    flame: spr('icon_flame', P_ICON, [
      '...o....',
      '...oyo..',
      '..oyeo..',
      '..oyyeo.',
      '.oyeero.',
      'oreeyero',
      'orrrrrro',
      '.oooooo.'
    ]),
    clock: spr('icon_clock', P_ICON, [
      '..oooo..',
      '.onnnno.',
      'onnonnno',
      'onnonnno',
      'onnooono',
      'onnnnnno',
      '.onnnno.',
      '..oooo..'
    ]),
    skull: spr('icon_skull', P_ICON, [
      '.oooooo.',
      'onnnnnno',
      'ooonnooo',
      'ooonnooo',
      'onnoonno',
      '.onnnno.',
      '.nonono.',
      '.oooooo.'
    ]),
    card: spr('icon_card', P_ICON, [
      '.oooooo.',
      '.onnnno.',
      '.onbbno.',
      '.onnnno.',
      '.onnnno.',
      '.onbbno.',
      '.onnnno.',
      '.oooooo.'
    ]),
    ichor: spr('icon_ichor', P_ICON, [
      '...oo...',
      '..osso..',
      '..osso..',
      '.osssso.',
      'osssssso',
      'ossnssso',
      '.osssso.',
      '..oooo..'
    ]),
    lock: spr('icon_lock', P_ICON, [
      '..oooo..',
      '..oiio..',
      '.oiooio.',
      'ommmmmmo',
      'ommommmo',
      'ommommmo',
      'ommmmmmo',
      '.oooooo.'
    ]),
    sound: spr('icon_sound', P_ICON, [
      '...o....',
      '..oo.o..',
      'ooon.o.o',
      'onnn.o.o',
      'onnn.o.o',
      'ooon.o.o',
      '..oo.o..',
      '...o....'
    ]),
    mute: spr('icon_mute', P_ICON, [
      '...o....',
      '..oo.h.h',
      'ooon.h.h',
      'onnn..h.',
      'onnn.h.h',
      'ooon....',
      '..oo....',
      '...o....'
    ]),
    check: spr('icon_check', P_ICON, [
      '........',
      '......oo',
      '.....oso',
      '....oso.',
      'o..oso..',
      'ososo...',
      '.oso....',
      '..o.....'
    ]),
    cross: spr('icon_cross', P_ICON, [
      '........',
      'oh....ho',
      '.oh..ho.',
      '..ohho..',
      '..ohho..',
      '.oh..ho.',
      'oh....ho',
      '........'
    ]),
    arrowU: spr('icon_arrowU', P_ICON, [
      '........',
      '...oo...',
      '..onno..',
      '.onnnno.',
      'onnnnnno',
      '.oooooo.',
      '........',
      '........'
    ]),
    arrowD: spr('icon_arrowD', P_ICON, [
      '........',
      '........',
      '.oooooo.',
      'onnnnnno',
      '.onnnno.',
      '..onno..',
      '...oo...',
      '........'
    ]),
    arrowL: spr('icon_arrowL', P_ICON, [
      '........',
      '......o.',
      '....ono.',
      '...onno.',
      '...onno.',
      '....ono.',
      '......o.',
      '........'
    ]),
    arrowR: spr('icon_arrowR', P_ICON, [
      '........',
      '.o......',
      '.ono....',
      '.onno...',
      '.onno...',
      '.ono....',
      '.o......',
      '........'
    ])
  };

  // ------------------------------------------------------------------ tokens
  var P_PLAYER = { o: INK, s: SKIN, d: SKIN_D, t: STITCH, y: FIRE3, b: BLOOD, n: BONE };
  var tokens = {
    player: spr('token_player', P_PLAYER, [
      '................',
      '.....oooo.......',
      '....osssso......',
      '....osttso......',
      '....oyssdo......',
      '....osssso......',
      '...osssssso.....',
      '.ososssttsssoso.',
      '.osossssssssoso.',
      '.ososssttsssoso.',
      '.osossssssssoso.',
      '.osossssssssoso.',
      '.odossssssssodo.',
      '...osssoossso...',
      '...osssoossso...',
      '...oooo.oooo....'
    ]),
    homunculo: spr('token_homunculo', P_HOMU, [
      '................',
      '................',
      '................',
      '.....oooo.......',
      '....osssso......',
      '....owsswo......',
      '....osttso......',
      '...osssssso.....',
      '..osossssoso....',
      '..ososttsoso....',
      '..osossssoso....',
      '..onossssono....',
      '....osssso......',
      '....osooso......',
      '....osooso......',
      '...ooo.ooo......'
    ]),
    ghoul: spr('token_ghoul', P_GHOUL, [
      '................',
      '....oooooo......',
      '...osssssso.....',
      '...oddddddo.....',
      '...odwddwdo.....',
      '...osttttso.....',
      '..ommmmmmmmo....',
      '.ossossssssosso.',
      '.ossossttssosso.',
      '.ossommmmmmosso.',
      '.ossossssssosso.',
      '.oddossttssoddo.',
      '...osssssso.....',
      '...ossoosso.....',
      '...ossoosso.....',
      '..oooo.oooo.....'
    ]),
    alquimista: spr('token_alquimista', P_ALQ, [
      '................',
      '.....oooo.......',
      '....osssso......',
      '....ommmmo......',
      '....omggmo......',
      '....osssso......',
      '...occcccco.....',
      '..ococcccoco....',
      '..ococttcoco....',
      '..ococggcoco....',
      '..ogoccccoco....',
      '...occcccco.....',
      '...occcccco.....',
      '...occoocco.....',
      '...okkookko.....',
      '..oooo.oooo.....'
    ]),
    automata: spr('token_automata', P_AUTO, [
      '................',
      '....oooooo......',
      '...ollllllo.....',
      '...oseessso.....',
      '...osssssso.....',
      '...occcccco.....',
      '..ollllllllo....',
      '.ossossccssosso.',
      '.ossossccssosso.',
      '.ossossssssosso.',
      '.occossttssocco.',
      '...osssssso.....',
      '...ossoosso.....',
      '...ossoosso.....',
      '...occoocco.....',
      '..oooo.oooo.....'
    ]),
    cirujano: spr('token_cirujano', P_CIR, [
      '................',
      '.....oooo.......',
      '....occcco......',
      '....osddso......',
      '....occcco......',
      '....ocbbco......',
      '...occcccco.....',
      '..ococcccoco....',
      '..ococbbcoco....',
      '..ococcccoco....',
      '..omoccccoco....',
      '..okoccccoco....',
      '...occcccco.....',
      '...occoocco.....',
      '...okkookko.....',
      '..oooo.oooo.....'
    ]),
    quimera: spr('token_quimera', P_QUI, [
      '...o........o...',
      '..on........no..',
      '....oooooo......',
      '...orrrrrro.....',
      '...orwrrgro.....',
      '...onrrrrno.....',
      '..onorrrrrrono..',
      '.onnorrttrronno.',
      '.orrorrrrrrorro.',
      '..ororrnnrroro..',
      '..osorrrrrrodo..',
      '...orrrrrro.....',
      '...orroorro.....',
      '...orroorro.....',
      '...orroorro.....',
      '..onno.onno.....'
    ])
  };

  // -------------------------------------------------------------- fire + logo
  var FAMILIES = ['base', 'homunculo', 'ghoul', 'alquimista', 'automata', 'cirujano', 'quimera'];

  // Deterministic 0..1 noise from a column index and a time value (no allocations).
  function hash01(i, t) {
    var n = Math.sin(i * 12.9898 + t * 3.7) * 43758.5453;
    return n - Math.floor(n);
  }

  function fireOverlay(intensity, t) {
    var W = Core.W, H = Core.H;
    var inten = intensity < 0 ? 0 : intensity > 1 ? 1 : intensity;
    var base = 4 + inten * 36, step = 12;
    var x, i, n, h, y, rows, reach, wide;
    for (x = 0; x < W; x += step) {
      i = x / step;
      n = hash01(i, Math.floor(t * 12) / 12);                      // 12 fps flicker
      h = base * (0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 5 + i * 0.9))) + n * base * 0.4;
      h = (h / 2 | 0) * 2;
      if (h < 2) h = 2;
      Core.gfx.rect(x, H - h, step, h, FIRE2);
      if (h > 4) Core.gfx.rect(x + 2, H - (h - 2), step - 4, h - 2, FIRE1);
      if (h > 8 && n > 0.35) Core.gfx.rect(x + 4, H - h - 4, 4, 4, FIRE3);   // floating ember
    }
    if (inten > 0.55) {                                            // flames creep up the sides
      reach = (inten - 0.55) / 0.45;
      rows = 2 + (reach * 10 | 0);
      for (i = 0; i < rows; i++) {
        y = H - 8 - i * 8;
        n = hash01(i + 77, Math.floor(t * 10) / 10);
        wide = 4 + (n * 8 | 0);
        Core.gfx.rect(0, y, wide, 8, i % 2 ? FIRE2 : FIRE1);
        Core.gfx.rect(W - wide, y, wide, 8, i % 2 ? FIRE1 : FIRE2);
      }
    }
  }

  // Title with a drop shadow and an alembic on each side. HP red reads better than
  // BLOOD on the dark background, so BLOOD is used for the shadow instead of INK.
  function logo(x, y) {
    var title = 'DEADLOCK DECK';
    Core.gfx.text(title, x + 2, y + 2, { color: BLOOD, size: 16, align: 'center' });
    Core.gfx.text(title, x, y, { color: HP, size: 16, align: 'center' });
    Core.gfx.sprite(tiles.alembic, x - 132, y - 2, { scale: 1 });
    Core.gfx.sprite(tiles.alembic, x + 116, y - 2, { scale: 1 });
  }

  return {
    FAMILIES: FAMILIES,
    parts: parts,
    stumps: stumps,
    BODY: BODY,
    drawBody: drawBody,
    drawPart: drawPart,
    tiles: tiles,
    icons: icons,
    tokens: tokens,
    fireOverlay: fireOverlay,
    logo: logo
  };
})();
