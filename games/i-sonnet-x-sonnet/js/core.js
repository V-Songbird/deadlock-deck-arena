/* Deadlock Deck: El Reloj Anatómico — núcleo
 * Fuente de píxeles, UI de modo inmediato, entrada, escenas, guardado y efectos.
 */
(function () {
  'use strict';
  var DD = window.DD = window.DD || {};

  DD.time = 0;                       // segundos de reloj de pared (lo suma main, también en pausa)
  DD.scenes = {};
  DD.scene = null;
  DD.sceneName = null;

  var seenErrors = {}, seenCount = 0;
  DD.reportError = function (e) {    // muestra cada error distinto una sola vez
    var key = String(e && e.message ? e.message : e);
    if (seenErrors[key] || seenCount >= 20) return;
    seenErrors[key] = true; seenCount++;
    try { console.error(e && e.stack ? e.stack : e); } catch (_) { /* sin consola */ }
  };

  var screenEl = null;
  function canvasEl() {
    if (!screenEl) screenEl = document.getElementById('screen');
    return screenEl;
  }

  /* =====================================================================
   * 1. Fuente de píxeles 5x7 (celda 6x8). Filas de 5 caracteres, '#' = píxel.
   *    Las minúsculas con cola (g j p q y , ;) usan la 8.ª fila de la celda.
   *    MAYÚSCULAS ACENTUADAS (Á É Í Ó Ú Ñ Ü): el cuerpo es idéntico al de la mayúscula
   *    sin tilde (7 filas) y la marca se dibuja POR ENCIMA de la celda, en las filas
   *    -2 y -1 (Ü: solo la -1); a tamaño n son 2n y n píxeles sobre la celda. Usa el hueco
   *    entre líneas (paso 9·n): no choca con la línea de arriba salvo que justo encima haya
   *    la cola de una g j p q y. Un texto en y<2·n pierde lo que cae fuera del canvas (se
   *    recorta sin error). textWidth, wrap y la celda no cambian. En un glifo, lo que va
   *    antes de « / » son las filas de marca sobre la celda.
   * ===================================================================== */
  var GLYPHS = {
    'A': '.###. #...# #...# ##### #...# #...# #...#',
    'B': '####. #...# #...# ####. #...# #...# ####.',
    'C': '.###. #...# #.... #.... #.... #...# .###.',
    'D': '###.. #..#. #...# #...# #...# #..#. ###..',
    'E': '##### #.... #.... ####. #.... #.... #####',
    'F': '##### #.... #.... ####. #.... #.... #....',
    'G': '.###. #...# #.... #.### #...# #...# .####',
    'H': '#...# #...# #...# ##### #...# #...# #...#',
    'I': '.###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',
    'J': '..### ...#. ...#. ...#. ...#. #..#. .##..',
    'K': '#...# #..#. #.#.. ##... #.#.. #..#. #...#',
    'L': '#.... #.... #.... #.... #.... #.... #####',
    'M': '#...# ##.## #.#.# #.#.# #...# #...# #...#',
    'N': '#...# ##..# #.#.# #..## #...# #...# #...#',
    'O': '.###. #...# #...# #...# #...# #...# .###.',
    'P': '####. #...# #...# ####. #.... #.... #....',
    'Q': '.###. #...# #...# #...# #.#.# #..#. .##.#',
    'R': '####. #...# #...# ####. #.#.. #..#. #...#',
    'S': '.#### #.... #.... .###. ....# ....# ####.',
    'T': '##### ..#.. ..#.. ..#.. ..#.. ..#.. ..#..',
    'U': '#...# #...# #...# #...# #...# #...# .###.',
    'V': '#...# #...# #...# #...# #...# .#.#. ..#..',
    'W': '#...# #...# #...# #.#.# #.#.# ##.## #...#',
    'X': '#...# #...# .#.#. ..#.. .#.#. #...# #...#',
    'Y': '#...# #...# .#.#. ..#.. ..#.. ..#.. ..#..',
    'Z': '##### ....# ...#. ..#.. .#... #.... #####',
    '0': '.###. #...# #..## #.#.# ##..# #...# .###.',
    '1': '..#.. .##.. ..#.. ..#.. ..#.. ..#.. .###.',
    '2': '.###. #...# ....# ...#. ..#.. .#... #####',
    '3': '.###. #...# ....# ..##. ....# #...# .###.',
    '4': '...#. ..##. .#.#. #..#. ##### ...#. ...#.',
    '5': '##### #.... ####. ....# ....# #...# .###.',
    '6': '..##. .#... #.... ####. #...# #...# .###.',
    '7': '##### ....# ...#. ..#.. .#... .#... .#...',
    '8': '.###. #...# #...# .###. #...# #...# .###.',
    '9': '.###. #...# #...# .#### ....# ...#. .##..',
    'a': '..... ..... .###. ....# .#### #...# .####',
    'b': '#.... #.... ####. #...# #...# #...# ####.',
    'c': '..... ..... .###. #...# #.... #...# .###.',
    'd': '....# ....# .#### #...# #...# #...# .####',
    'e': '..... ..... .###. #...# ##### #.... .###.',
    'f': '..##. .#..# .#... ###.. .#... .#... .#...',
    'g': '..... ..... .#### #...# #...# .#### ....# .###.',
    'h': '#.... #.... #.##. ##..# #...# #...# #...#',
    'i': '..#.. ..... .##.. ..#.. ..#.. ..#.. .###.',
    'j': '...#. ..... ..##. ...#. ...#. ...#. #..#. .##..',
    'k': '#.... #.... #..#. #.#.. ##... #.#.. #..#.',
    'l': '.##.. ..#.. ..#.. ..#.. ..#.. ..#.. ..##.',
    'm': '..... ..... ##.#. #.#.# #.#.# #.#.# #.#.#',
    'n': '..... ..... #.##. ##..# #...# #...# #...#',
    'o': '..... ..... .###. #...# #...# #...# .###.',
    'p': '..... ..... ####. #...# #...# ####. #.... #....',
    'q': '..... ..... .#### #...# #...# .#### ....# ....#',
    'r': '..... ..... #.##. ##..# #.... #.... #....',
    's': '..... ..... .#### #.... .###. ....# ####.',
    't': '..... .#... ###.. .#... .#... .#..# ..##.',
    'u': '..... ..... #...# #...# #...# #..## .##.#',
    'v': '..... ..... #...# #...# #...# .#.#. ..#..',
    'w': '..... ..... #...# #...# #.#.# #.#.# .#.#.',
    'x': '..... ..... #...# .#.#. ..#.. .#.#. #...#',
    'y': '..... ..... #...# #...# #...# .#### ....# .###.',
    'z': '..... ..... ##### ...#. ..#.. .#... #####',
    'á': '...#. ..#.. .###. ....# .#### #...# .####',   // á
    'é': '...#. ..#.. .###. #...# ##### #.... .###.',   // é
    'í': '...#. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',   // í
    'ó': '...#. ..#.. .###. #...# #...# #...# .###.',   // ó
    'ú': '...#. ..#.. #...# #...# #...# #..## .##.#',   // ú
    'ü': '.#.#. ..... #...# #...# #...# #..## .##.#',   // ü
    'ñ': '.##.# #.##. ..... #.##. ##..# #...# #...#',   // ñ
    'Á': '...#. ..#.. / .###. #...# #...# ##### #...# #...# #...#',   // Á
    'É': '...#. ..#.. / ##### #.... #.... ####. #.... #.... #####',   // É
    'Í': '...#. ..#.. / .###. ..#.. ..#.. ..#.. ..#.. ..#.. .###.',   // Í
    'Ó': '...#. ..#.. / .###. #...# #...# #...# #...# #...# .###.',   // Ó
    'Ú': '...#. ..#.. / #...# #...# #...# #...# #...# #...# .###.',   // Ú
    'Ü': '.#.#. / #...# #...# #...# #...# #...# #...# .###.',   // Ü
    'Ñ': '.##.# #.##. / #...# ##..# #.#.# #..## #...# #...# #...#',   // Ñ
    '¡': '..#.. ..... ..#.. ..#.. ..#.. ..#.. ..#..',   // ¡
    '¿': '..#.. ..... ..#.. .#... #.... #...# .###.',   // ¿
    '.': '..... ..... ..... ..... ..... .##.. .##..',
    ',': '..... ..... ..... ..... ..... .##.. .##.. .#...',
    ':': '..... ..... .##.. .##.. ..... .##.. .##..',
    ';': '..... ..... .##.. .##.. ..... .##.. .##.. .#...',
    '!': '..#.. ..#.. ..#.. ..#.. ..#.. ..... ..#..',
    '?': '.###. #...# ....# ...#. ..#.. ..... ..#..',
    '-': '..... ..... ..... .###. ..... ..... .....',
    '+': '..... ..#.. ..#.. ##### ..#.. ..#.. .....',
    '(': '...#. ..#.. .#... .#... .#... ..#.. ...#.',
    ')': '.#... ..#.. ...#. ...#. ...#. ..#.. .#...',
    '/': '....# ...#. ...#. ..#.. .#... .#... #....',
    '%': '##... ##..# ...#. ..#.. .#... #..## ...##',
    "'": '..#.. ..#.. .#... ..... ..... ..... .....',
    '"': '.#.#. .#.#. .#.#. ..... ..... ..... .....',
    '·': '..... ..... ..... .##.. .##.. ..... .....',   // ·
    '…': '..... ..... ..... ..... ..... ..... #.#.#',   // …
    '×': '..... ..... .#.#. ..#.. .#.#. ..... .....',   // ×
    '→': '..... ..#.. ...#. ##### ...#. ..#.. .....',   // →
    '←': '..... ..#.. .#... ##### .#... ..#.. .....',   // ←
    '↑': '..#.. .###. #.#.# ..#.. ..#.. ..#.. ..#..',   // ↑
    '↓': '..#.. ..#.. ..#.. ..#.. #.#.# .###. ..#..',   // ↓
    '[': '.###. .#... .#... .#... .#... .#... .###.',
    ']': '.###. ...#. ...#. ...#. ...#. ...#. .###.',
    '=': '..... ..... ##### ..... ##### ..... .....',
    '<': '...#. ..#.. .#... #.... .#... ..#.. ...#.',
    '>': '.#... ..#.. ...#. ....# ...#. ..#.. .#...',
    '*': '..... ..#.. #.#.# .###. #.#.# ..#.. .....',
    '_': '..... ..... ..... ..... ..... ..... ..... #####',
    '#': '.#.#. .#.#. ##### .#.#. ##### .#.#. .#.#.',
    ' ': '..... ..... ..... ..... ..... ..... .....'
  };
  var BOX = '##### #...# #...# #...# #...# #...# #####';     // carácter desconocido
  // Signos tipográficos parecidos que se dibujan con su equivalente simple
  var ALIAS = {
    '–': '-', '—': '-', '−': '-', '‘': "'", '’': "'", '´': "'",
    '“': '"', '”': '"', '„': '"', '«': '"', '»': '"', '•': '·', ' ': ' ', '\t': ' '
  };

  var CW = 6, CH = 8, LH = 9, COLS = 16, ABOVE = 2;   // ABOVE: filas sobre la celda que usan las marcas de las mayúsculas
  var CHA = CH + ABOVE;                                // alto de una celda en el atlas
  DD.FONT = { W: CW, H: CH, LINE: LH, ABOVE: ABOVE };  // celda, paso de línea y filas de marca sobre la celda (tamaño 1)

  var ORDER = [null].concat(Object.keys(GLYPHS));   // 0 = recuadro
  var INDEX = {};
  var atlas = document.createElement('canvas');
  (function buildAtlas() {
    atlas.width = COLS * CW;
    atlas.height = Math.ceil(ORDER.length / COLS) * CHA;
    var g = atlas.getContext('2d');
    g.fillStyle = '#fff';
    for (var i = 0; i < ORDER.length; i++) {
      var parts = (i === 0 ? BOX : GLYPHS[ORDER[i]]).split(' / ');      // [marca sobre la celda / ] cuerpo
      var above = parts.length > 1 ? parts[0].split(' ') : [];
      var rows = above.concat(parts[parts.length - 1].split(' '));
      var ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CHA + ABOVE - above.length;
      if (i) INDEX[ORDER[i]] = i;
      for (var r = 0; r < rows.length; r++) {
        for (var c = 0; c < 5; c++) if (rows[r].charAt(c) === '#') g.fillRect(ox + c, oy + r, 1, 1);
      }
    }
  })();

  var tints = {}, tintCount = 0;
  function tinted(color) {             // copia del atlas teñida; se cachea por color
    var t = tints[color];
    if (t) return t;
    if (tintCount > 96) { tints = {}; tintCount = 0; }
    t = document.createElement('canvas');
    t.width = atlas.width; t.height = atlas.height;
    var g = t.getContext('2d');
    g.drawImage(atlas, 0, 0);
    g.globalCompositeOperation = 'source-in';
    g.fillStyle = color;
    g.fillRect(0, 0, t.width, t.height);
    tints[color] = t; tintCount++;
    return t;
  }

  function glyphIndex(ch) {
    var i = INDEX[ch];
    if (i) return i;
    var a = ALIAS[ch];
    return a && INDEX[a] ? INDEX[a] : 0;
  }

  function drawRun(ctx, img, line, px, py, size) {
    for (var i = 0; i < line.length; i++) {
      var ch = line.charAt(i);
      if (ch === ' ') continue;
      var idx = glyphIndex(ch);
      ctx.drawImage(img, (idx % COLS) * CW, Math.floor(idx / COLS) * CHA, CW, CHA,
        px + i * CW * size, py - ABOVE * size, CW * size, CHA * size);
    }
  }

  // Cada línea (texto+color+tamaño+sombra) se compone una vez en un lienzo pequeño y luego se estampa
  // de un solo golpe: dibujar carácter a carácter era lo más caro de cada fotograma en móviles lentos.
  // Caché de dos generaciones: al llenarse, la actual pasa a «vieja» y lo que siga en uso se rescata de ella.
  var lineCache = {}, lineOld = {}, lineCount = 0, LINE_MAX = 400;
  function lineBitmap(line, color, shadow, size) {
    var key = size + '\u0001' + color + '\u0001' + (shadow || '') + '\u0001' + line;
    var b = lineCache[key];
    if (b) return b;
    b = lineOld[key];
    if (!b) {
      b = document.createElement('canvas');
      b.width = line.length * CW * size + (shadow ? size : 0);
      b.height = CHA * size + (shadow ? size : 0);
      var g = b.getContext('2d');
      g.imageSmoothingEnabled = false;
      if (shadow) drawRun(g, tinted(shadow), line, size, (ABOVE + 1) * size, size);
      drawRun(g, tinted(color), line, 0, ABOVE * size, size);
    }
    if (lineCount >= LINE_MAX) { lineOld = lineCache; lineCache = {}; lineCount = 0; }
    lineCache[key] = b; lineCount++;
    return b;
  }

  // opt: {color, size:1|2|3, align:'left'|'center'|'right', shadow:color|null, alpha}
  DD.text = function (ctx, str, x, y, opt) {
    opt = opt || {};
    str = str == null ? '' : String(str).replace(/\r/g, '');
    var size = Math.max(1, Math.round(opt.size || 1));
    var align = opt.align || 'left';
    var color = opt.color || DD.C.ink;
    var prevA = ctx.globalAlpha;
    if (opt.alpha != null && opt.alpha !== 1) ctx.globalAlpha = prevA * opt.alpha;
    ctx.imageSmoothingEnabled = false;
    x = Math.round(x); y = Math.round(y);
    var lines = str.split('\n');
    for (var l = 0; l < lines.length; l++) {
      if (!lines[l].length) continue;
      var w = lines[l].length * CW * size;
      var px = align === 'center' ? x - Math.floor(w / 2) : (align === 'right' ? x - w : x);
      var py = y + l * LH * size;
      ctx.drawImage(lineBitmap(lines[l], color, opt.shadow || null, size), px, py - ABOVE * size);
    }
    ctx.globalAlpha = prevA;
  };

  // Ancho en píxeles de la línea más larga (celdas de 6 px por tamaño)
  DD.textWidth = function (str, size) {
    var lines = (str == null ? '' : String(str)).split('\n'), m = 0;
    for (var i = 0; i < lines.length; i++) if (lines[i].length > m) m = lines[i].length;
    return m * CW * (size || 1);
  };

  // Parte por palabras en líneas que caben en maxW píxeles; respeta '\n'
  DD.wrap = function (str, maxW, size) {
    size = size || 1;
    var maxC = Math.max(1, Math.floor((maxW + size) / (CW * size)));   // n celdas ocupan 6n-1 px visibles
    var out = [];
    (str == null ? '' : String(str)).split('\n').forEach(function (para) {
      var words = para.split(' '), line = '';
      words.forEach(function (w) {
        while (w.length > maxC) {      // palabra más larga que la línea: se corta
          if (line) { out.push(line); line = ''; }
          out.push(w.slice(0, maxC));
          w = w.slice(maxC);
        }
        if (!line) line = w;
        else if (line.length + 1 + w.length <= maxC) line += ' ' + w;
        else { out.push(line); line = w; }
      });
      out.push(line);
    });
    return out;
  };

  /* =====================================================================
   * 2. Entrada unificada: teclado, ratón/táctil (un puntero) y mando
   * ===================================================================== */
  var KEYS = {                          // e.code -> acciones
    ArrowUp: ['up'], KeyW: ['up'], ArrowDown: ['down'], KeyS: ['down'],
    ArrowLeft: ['left'], KeyA: ['left'], ArrowRight: ['right'], KeyD: ['right'],
    Enter: ['ok'], NumpadEnter: ['ok'], Space: ['ok'], Backspace: ['back'],
    Escape: ['back', 'pause'], KeyE: ['endTurn'], KeyP: ['pause'], KeyM: ['mute']
  };
  var ACTIONS = ['up', 'down', 'left', 'right', 'ok', 'back', 'endTurn', 'pause', 'mute'];
  var ACTION_KEYS = {};
  ACTIONS.forEach(function (a) { ACTION_KEYS[a] = []; });
  Object.keys(KEYS).forEach(function (code) {
    KEYS[code].forEach(function (a) { ACTION_KEYS[a].push(code); });
  });
  var MODS = { ShiftLeft: 1, ShiftRight: 1, ControlLeft: 1, ControlRight: 1, AltLeft: 1, AltRight: 1, MetaLeft: 1, MetaRight: 1, CapsLock: 1, ContextMenu: 1 };
  var DIGIT = /^(?:Digit|Numpad)([1-9])$/;

  var keysDown = {};                    // códigos físicos pulsados
  var latched = {};                     // acciones con flanco en este fotograma
  var padHeld = {};                     // acciones mantenidas con el mando
  var charLatch = {};                   // teclas (e.key) con flanco en este fotograma
  var numLatch = 0, anyLatch = false;
  var locked = false;

  var isDown = false, downLatch = false, clickLatch = false, movedLatch = false;
  var ignoreDown = false;               // puntero ya gastado por un cambio de escena: hay que soltar y volver a pulsar
  var insideFlag = false, touchPtr = false, ptrId = null;

  var mouse = { x: -1, y: -1, touch: false };
  Object.defineProperty(mouse, 'down', { enumerable: true, get: function () { return !locked && ((isDown && !ignoreDown) || downLatch); } });
  Object.defineProperty(mouse, 'clicked', { enumerable: true, get: function () { return !locked && clickLatch; } });
  Object.defineProperty(mouse, 'moved', { enumerable: true, get: function () { return !locked && movedLatch; } });
  Object.defineProperty(mouse, 'inside', { enumerable: true, get: function () { return !locked && insideFlag; } });

  function gesture() {                  // el primer gesto del usuario despierta el audio
    if (DD.Audio && DD.Audio.init) {
      try { DD.Audio.init(); } catch (e) { DD.reportError(e); }
    }
  }

  function codeOf(e) {
    if (e.code) return e.code;
    var k = e.key || '';
    if (k.length === 1) {
      if (k === ' ') return 'Space';
      if (/[a-z]/i.test(k)) return 'Key' + k.toUpperCase();
      if (/[0-9]/.test(k)) return 'Digit' + k;
    }
    return k === 'Esc' ? 'Escape' : k;
  }

  function onKeyDown(e) {
    if (!e.repeat) gesture();
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    var code = codeOf(e);
    if (MODS[code]) return;
    var acts = KEYS[code], digit = DIGIT.exec(code);
    if (acts || digit) e.preventDefault();      // sin scroll, sin «atrás» con Backspace
    if (e.repeat || keysDown[code]) return;
    keysDown[code] = true;
    anyLatch = true;
    if (acts) for (var i = 0; i < acts.length; i++) latched[acts[i]] = true;
    if (digit && !numLatch) numLatch = +digit[1];
    if (e.key) charLatch[String(e.key).toLowerCase()] = true;
  }

  function onKeyUp(e) { delete keysDown[codeOf(e)]; }

  function setPos(e) {                  // coordenadas del lienzo lógico usando la caja real del canvas
    var cv = canvasEl();
    if (!cv) return;
    var r = cv.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var nx = Math.floor((e.clientX - r.left) * DD.W / r.width);
    var ny = Math.floor((e.clientY - r.top) * DD.H / r.height);
    if (nx !== mouse.x || ny !== mouse.y) movedLatch = true;
    mouse.x = nx; mouse.y = ny;
  }

  function onPointerDown(e) {
    gesture();
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    try { window.focus(); } catch (_) { /* iframe sin foco */ }
    ptrId = e.pointerId;
    touchPtr = mouse.touch = e.pointerType !== 'mouse';
    setPos(e);
    insideFlag = true;
    isDown = true; ignoreDown = false;
    downLatch = true; clickLatch = true; anyLatch = true;
  }

  function onPointerMove(e) {
    if (e.pointerType === 'mouse') {
      if (touchPtr && isDown) return;
      touchPtr = mouse.touch = false;
      insideFlag = true;
      setPos(e);
    } else if (e.pointerId === ptrId && isDown) {
      setPos(e);
    }
  }

  function onPointerUp(e) {
    gesture();
    if (e.pointerId !== ptrId) return;
    setPos(e);
    isDown = false; ignoreDown = false;
    // el dedo no deja «hover»; se apaga al acabar el fotograma (un toque rápido aún cuenta en el actual)
  }

  function onPointerCancel(e) {
    if (e.pointerId !== ptrId) return;
    isDown = false; ignoreDown = false;
    if (touchPtr) insideFlag = false;
  }

  function releaseAll() {
    keysDown = {};
    padHeld = {};
    isDown = false; ignoreDown = false;
    insideFlag = false;
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerCancel);
  window.addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', function () { if (document.hidden) releaseAll(); });
  document.documentElement.addEventListener('mouseleave', function () { if (!touchPtr) insideFlag = false; });
  ['touchend', 'click', 'mousedown'].forEach(function (n) { window.addEventListener(n, gesture); });

  function pollPad() {                  // mando: stick izq./cruceta, A, B, X, Start
    var pads = null;
    try { pads = navigator.getGamepads ? navigator.getGamepads() : null; } catch (_) { /* sin Gamepad API */ }
    var now = {};
    for (var i = 0; pads && i < pads.length; i++) {
      var p = pads[i];
      if (!p || !p.connected) continue;
      var b = p.buttons, ax = p.axes[0] || 0, ay = p.axes[1] || 0;
      var bt = function (n) { return !!(b[n] && (b[n].pressed || b[n].value > 0.5)); };
      if (ay < -0.5 || bt(12)) now.up = true;
      if (ay > 0.5 || bt(13)) now.down = true;
      if (ax < -0.5 || bt(14)) now.left = true;
      if (ax > 0.5 || bt(15)) now.right = true;
      if (bt(0)) now.ok = true;
      if (bt(1)) now.back = true;
      if (bt(2)) now.endTurn = true;
      if (bt(9)) now.pause = true;
    }
    var fresh = false;
    for (var k = 0; k < ACTIONS.length; k++) {
      var a = ACTIONS[k];
      if (now[a] && !padHeld[a]) { latched[a] = true; fresh = true; }
    }
    padHeld = now;
    if (fresh) { anyLatch = true; gesture(); }
  }

  DD.Input = {
    mouse: mouse,                       // {x, y, down, clicked, moved, inside, touch}
    pressed: function (a) { return !locked && !!latched[a]; },
    down: function (a) {
      if (locked) return false;
      if (latched[a] || padHeld[a]) return true;
      var codes = ACTION_KEYS[a] || [];
      for (var i = 0; i < codes.length; i++) if (keysDown[codes[i]]) return true;
      return false;
    },
    num: function () { return locked ? 0 : numLatch; },
    keyPressed: function (name) { return !locked && !!charLatch[String(name).toLowerCase()]; },
    anyPressed: function () { return !locked && anyLatch; },
    lock: function (b) { locked = !!b; },
    // Gasta la entrada del fotograma (lo hace setScene para que la nueva escena no reciba el mismo clic)
    consume: function () {
      latched = {}; charLatch = {};
      numLatch = 0; anyLatch = false;
      clickLatch = false; downLatch = false;
      if (isDown) ignoreDown = true;
    },
    endFrame: function () {
      latched = {}; charLatch = {};
      numLatch = 0; anyLatch = false;
      clickLatch = false; downLatch = false; movedLatch = false;
      if (touchPtr && !isDown) insideFlag = false;
      pollPad();
    }
  };

  /* =====================================================================
   * 3. UI de modo inmediato
   * ===================================================================== */
  var shades = {};
  function shade(color, f) {            // f>0 aclara, f<0 oscurece (solo colores #rrggbb)
    var key = color + '|' + f;
    if (shades[key]) return shades[key];
    var m = /^#([0-9a-f]{6})$/i.exec(color);
    if (!m) return color;
    var n = parseInt(m[1], 16);
    function ch(c) { return Math.max(0, Math.min(255, Math.round(f < 0 ? c * (1 + f) : c + (255 - c) * f))); }
    var v = (1 << 24) | (ch(n >> 16) << 16) | (ch((n >> 8) & 255) << 8) | ch(n & 255);
    return (shades[key] = '#' + v.toString(16).slice(1));
  }

  function rect(ctx, c, x, y, w, h) {
    if (w <= 0 || h <= 0) return;
    ctx.fillStyle = c;
    ctx.fillRect(x, y, w, h);
  }

  function cham(ctx, c, x, y, w, h, k) {   // rectángulo con las esquinas cortadas k píxeles
    ctx.fillStyle = c;
    for (var i = 0; i <= k; i++) ctx.fillRect(x + k - i, y + i, w - 2 * (k - i), h - 2 * i);
  }

  function rivet(ctx, x, y, hi, base, dk) {   // remache 4x4 (paneles pequeños)
    rect(ctx, hi, x + 1, y, 2, 1);
    rect(ctx, hi, x, y + 1, 1, 2);
    rect(ctx, base, x + 1, y + 1, 2, 2);
    rect(ctx, dk, x + 3, y + 1, 1, 2);
    rect(ctx, dk, x + 1, y + 3, 2, 1);
  }

  function plate(ctx, x, y, hi, base, dk) {   // placa de esquina 7x7 con perno
    cham(ctx, DD.C.bg, x, y, 7, 7, 2);
    cham(ctx, base, x + 1, y + 1, 5, 5, 1);
    rect(ctx, hi, x + 2, y + 1, 3, 1);
    rect(ctx, hi, x + 1, y + 2, 1, 3);
    rect(ctx, dk, x + 2, y + 5, 3, 1);
    rect(ctx, dk, x + 5, y + 2, 1, 3);
    rect(ctx, shade(hi, 0.7), x + 3, y + 3, 1, 1);
    rect(ctx, shade(dk, -0.7), x + 4, y + 4, 1, 1);
  }

  function stud(ctx, x, y, hi, base, dk) {    // tachuela 2x2 del borde
    rect(ctx, base, x, y, 2, 2);
    rect(ctx, shade(hi, 0.7), x, y, 1, 1);
    rect(ctx, shade(dk, -0.7), x + 1, y + 1, 1, 1);
  }

  var ui = DD.ui = {};

  // Marco de latón con remaches. opt: {title, fill, border, alpha}
  // El título ocupa y+6..y+13, con la línea en y+17 y el rombo hasta y+19: el contenido puede empezar en y+22.
  ui.panel = function (ctx, x, y, w, h, opt) {
    opt = opt || {};
    var C = DD.C;
    x = Math.round(x); y = Math.round(y);
    w = Math.max(14, Math.round(w)); h = Math.max(14, Math.round(h));
    var br = opt.border || C.brass;
    var hi = shade(br, 0.4), dk = opt.border ? shade(br, -0.5) : C.brassDk;
    var prevA = ctx.globalAlpha;
    if (opt.alpha != null) ctx.globalAlpha = prevA * opt.alpha;

    cham(ctx, C.bg, x, y, w, h, 2);                      // contorno oscuro
    cham(ctx, hi, x + 1, y + 1, w - 2, h - 2, 1);        // aro exterior (luz arriba-izquierda)
    rect(ctx, dk, x + 2, y + h - 2, w - 4, 1);           // sombra abajo
    rect(ctx, dk, x + w - 2, y + 2, 1, h - 4);           // sombra a la derecha
    rect(ctx, br, x + 2, y + 2, w - 4, h - 4);           // aro de latón
    rect(ctx, dk, x + 3, y + 3, w - 6, h - 6);           // ranura interior
    rect(ctx, opt.fill || C.panel, x + 4, y + 4, w - 8, h - 8);
    rect(ctx, C.bg2, x + 4, y + 4, w - 8, 1);            // sombra interior arriba e izquierda
    rect(ctx, C.bg2, x + 4, y + 5, 1, h - 10);

    if (w >= 24 && h >= 24) {
      plate(ctx, x, y, hi, br, dk);
      plate(ctx, x + w - 7, y, hi, br, dk);
      plate(ctx, x, y + h - 7, hi, br, dk);
      plate(ctx, x + w - 7, y + h - 7, hi, br, dk);
    } else {
      rivet(ctx, x + 1, y + 1, hi, br, dk);
      rivet(ctx, x + w - 5, y + 1, hi, br, dk);
      rivet(ctx, x + 1, y + h - 5, hi, br, dk);
      rivet(ctx, x + w - 5, y + h - 5, hi, br, dk);
    }
    var n, i;
    if (w >= 72) {                                        // tachuelas en los bordes largos
      n = Math.floor((w - 24) / 48) + 1;
      for (i = 0; i < n; i++) {
        var sx = x + Math.round((w - 2) * (i + 1) / (n + 1));
        stud(ctx, sx, y + 2, hi, br, dk);
        stud(ctx, sx, y + h - 4, hi, br, dk);
      }
    }
    if (h >= 72) {
      n = Math.floor((h - 24) / 48) + 1;
      for (i = 0; i < n; i++) {
        var sy = y + Math.round((h - 2) * (i + 1) / (n + 1));
        stud(ctx, x + 2, sy, hi, br, dk);
        stud(ctx, x + w - 4, sy, hi, br, dk);
      }
    }
    if (opt.title) {
      var cx = x + (w >> 1);
      DD.text(ctx, opt.title, cx, y + 6, { align: 'center', color: C.bone, shadow: C.bg });
      rect(ctx, C.line, x + 10, y + 17, w - 20, 1);
      rect(ctx, C.panel, cx - 5, y + 15, 11, 5);            // adorno central en rombo
      rect(ctx, br, cx, y + 15, 1, 1);
      rect(ctx, br, cx - 1, y + 16, 3, 1);
      rect(ctx, br, cx - 2, y + 17, 5, 1);
      rect(ctx, br, cx - 1, y + 18, 3, 1);
      rect(ctx, br, cx, y + 19, 1, 1);
      rect(ctx, hi, cx, y + 17, 1, 1);
    }
    ctx.globalAlpha = prevA;
  };

  ui.hit = function (x, y, w, h) {
    var m = mouse;
    return m.inside && m.x >= x && m.y >= y && m.x < x + w && m.y < y + h;
  };

  function hotkeyPressed(hk) {
    var In = DD.Input;
    if (In.pressed(hk)) return true;                                   // nombre de acción
    if (/^[1-9]$/.test(hk)) return In.num() === +hk;                   // dígito
    return In.keyPressed(hk);                                          // cualquier otra tecla
  }

  // Devuelve true el fotograma en que se activa. opt: {disabled, selected, hotkey, size, color}
  ui.button = function (ctx, x, y, w, h, label, opt) {
    opt = opt || {};
    var C = DD.C;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    var dis = !!opt.disabled, sel = !!opt.selected, size = opt.size || 1;
    var slop = mouse.touch && (w < 28 || h < 24) ? 2 : 0;       // con el dedo, los botones pequeños aceptan 2 px de margen
    var hov = !dis && ui.hit(x - slop, y - slop, w + 2 * slop, h + 2 * slop);
    var prs = hov && mouse.down;
    var fired = !dis && ((hov && mouse.clicked) || (opt.hotkey != null && hotkeyPressed(String(opt.hotkey))));
    var lit = hov || sel;

    var accent = opt.color || C.brass;
    var face, edge, txt;
    if (dis) { face = C.bg2; edge = C.line; txt = C.dim; }
    else if (prs) { face = C.bg; edge = accent; txt = opt.color ? shade(accent, 0.3) : C.heatHi; }
    else if (lit) { face = C.panelHi; edge = accent; txt = opt.color ? shade(accent, 0.3) : C.heatHi; }
    else { face = C.panel; edge = shade(accent, -0.45); txt = opt.color || C.ink; }

    cham(ctx, C.bg, x, y, w, h, 1);
    cham(ctx, edge, x + 1, y + 1, w - 2, h - 2, 0);
    rect(ctx, face, x + 2, y + 2, w - 4, h - 4);
    if (!dis) {
      rect(ctx, shade(face, prs ? -0.5 : 0.35), x + 2, y + 2, w - 4, 1);       // bisel
      rect(ctx, shade(face, prs ? 0.2 : -0.5), x + 2, y + h - 3, w - 4, 1);
      if (w >= 36 && h >= 16) {                                                 // remaches
        var rc = lit ? shade(accent, 0.3) : shade(accent, -0.15);
        rect(ctx, rc, x + 3, y + 3, 1, 1);
        rect(ctx, rc, x + w - 4, y + 3, 1, 1);
        rect(ctx, rc, x + 3, y + h - 4, 1, 1);
        rect(ctx, rc, x + w - 4, y + h - 4, 1, 1);
      }
    }

    var lines = String(label == null ? '' : label).split('\n');
    var th = 7 * size + (lines.length - 1) * LH * size;
    var ty = y + Math.floor((h - th) / 2) + (prs ? 1 : 0);
    var maxLen = 0;
    for (var i = 0; i < lines.length; i++) {
      var tw = lines[i].length * CW * size - size;
      if (lines[i].length > maxLen) maxLen = lines[i].length;
      DD.text(ctx, lines[i], x + Math.floor((w - tw) / 2), ty + i * LH * size, { color: txt, size: size });
    }
    if (sel && !dis && (w - (maxLen * CW * size - size)) >= 28) {              // cursor ▶ ◀ si hay sitio
      var cy = y + (h >> 1) - 2 + (prs ? 1 : 0), mk = C.heatHi;
      rect(ctx, mk, x + 6, cy, 1, 5); rect(ctx, mk, x + 7, cy + 1, 1, 3); rect(ctx, mk, x + 8, cy + 2, 1, 1);
      rect(ctx, mk, x + w - 7, cy, 1, 5); rect(ctx, mk, x + w - 8, cy + 1, 1, 3); rect(ctx, mk, x + w - 9, cy + 2, 1, 1);
    }
    return fired;
  };

  // Barra rellena con borde. color = relleno, bg = fondo (por defecto el más oscuro)
  ui.bar = function (ctx, x, y, w, h, frac, color, bg) {
    var C = DD.C;
    x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
    frac = frac > 0 ? (frac < 1 ? frac : 1) : 0;       // NaN -> 0
    var b = h >= 5 && w >= 5 ? 1 : 0;
    if (b) rect(ctx, C.line, x, y, w, h);
    rect(ctx, bg || C.bg, x + b, y + b, w - 2 * b, h - 2 * b);
    var iw = w - 2 * b, ih = h - 2 * b;
    var fw = Math.round(iw * frac);
    if (frac > 0 && fw < 1) fw = 1;
    if (fw > 0) {
      rect(ctx, color, x + b, y + b, fw, ih);
      if (ih >= 3) rect(ctx, shade(color, 0.35), x + b, y + b, fw, 1);
      if (ih >= 5) rect(ctx, shade(color, -0.3), x + b, y + b + ih - 1, fw, 1);
    }
  };

  /* =====================================================================
   * 4. Efectos (sacudida, destello) y fundido entre escenas
   *    Los calcula aquí y los aplica/dibuja main.js.
   * ===================================================================== */
  var shakeMag = 0, shakeDur = 1, shakeT = 0;
  var flashColor = '#fff', flashDur = 1, flashT = 0, flashMax = 0.5;
  var FADE_HALF = 0.1, fadeT = FADE_HALF * 2, snap = null, hasSnap = false;

  var fx = DD.fx = { ox: 0, oy: 0 };

  // prefers-reduced-motion: sin sacudidas y con destellos muy atenuados
  var reduceMotion = false;
  try {
    var mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    reduceMotion = !!mq.matches;
    var onMq = function (e) { reduceMotion = !!e.matches; };
    if (mq.addEventListener) mq.addEventListener('change', onMq);
    else if (mq.addListener) mq.addListener(onMq);
  } catch (_) { reduceMotion = false; }

  fx.shake = function (mag, dur) {
    if (reduceMotion) return;
    mag = mag == null ? 4 : mag; dur = dur || 0.25;
    if (shakeT > 0 && shakeMag * shakeT / shakeDur > mag) return;      // no pisar una sacudida más fuerte
    shakeMag = mag; shakeDur = dur; shakeT = dur;
  };

  fx.flash = function (color, dur, alpha) {
    flashColor = color || '#fff'; flashDur = dur || 0.2; flashT = flashDur;
    flashMax = (alpha == null ? 0.5 : alpha) * (reduceMotion ? 0.25 : 1);
  };

  fx.update = function (dt) {
    if (shakeT > 0) {
      shakeT -= dt;
      var amp = shakeT > 0 ? shakeMag * shakeT / shakeDur : 0;
      fx.ox = Math.round((Math.random() * 2 - 1) * amp);
      fx.oy = Math.round((Math.random() * 2 - 1) * amp);
    } else { fx.ox = 0; fx.oy = 0; }
    if (flashT > 0) flashT -= dt;
    if (fadeT < FADE_HALF * 2) fadeT += dt;
  };

  fx.drawOverlay = function (ctx) {
    if (flashT > 0) {
      ctx.globalAlpha = flashMax * flashT / flashDur;
      rect(ctx, flashColor, 0, 0, DD.W, DD.H);
      ctx.globalAlpha = 1;
    }
    if (fadeT < FADE_HALF * 2) {
      var a;
      if (fadeT < FADE_HALF) {                          // el último fotograma de la escena vieja se apaga
        if (hasSnap) ctx.drawImage(snap, 0, 0);
        a = fadeT / FADE_HALF;
      } else {                                          // la nueva aparece
        a = 1 - (fadeT - FADE_HALF) / FADE_HALF;
      }
      ctx.globalAlpha = Math.max(0, Math.min(1, a));
      rect(ctx, '#000', 0, 0, DD.W, DD.H);
      ctx.globalAlpha = 1;
    }
  };

  function startFade() {
    var cv = canvasEl();
    if (cv && DD.scene) {
      if (!snap) { snap = document.createElement('canvas'); snap.width = DD.W; snap.height = DD.H; }
      snap.getContext('2d').drawImage(cv, 0, 0);
      hasSnap = true; fadeT = 0;
    } else {                                            // primera escena: solo aparece
      hasSnap = false; fadeT = FADE_HALF;
    }
  }

  /* =====================================================================
   * 5. Escenas
   * ===================================================================== */
  // DD.scenes.nombre = { enter(params), update(dt), draw(ctx), exit(), run:true|false }
  DD.setScene = function (name, params) {
    var next = DD.scenes[name];
    if (!next) throw new Error('Escena desconocida: ' + name);
    var old = DD.scene;
    startFade();
    if (old && old.exit) {
      try { old.exit(); } catch (e) { DD.reportError(e); }
    }
    DD.scene = next;
    DD.sceneName = name;
    DD.Input.consume();
    if (next.enter) {
      try { next.enter(params); } catch (e) { DD.reportError(e); }
    }
  };

  /* =====================================================================
   * 6. Guardado (localStorage tolerante a fallos)
   * ===================================================================== */
  var SAVE_CATS = ['skin', 'stitch', 'eyes'];

  function defaultSave() {
    return {
      blueprints: {}, ether: 0, runs: 0, escapes: 0, bestTime: null, bestFloor: 0, kills: 0,
      owned: {}, equip: { skin: '', stitch: '', eyes: '' }, mute: false
    };
  }

  function nat(v) { return typeof v === 'number' && isFinite(v) && v > 0 ? Math.min(999999999, Math.floor(v)) : 0; }

  function trueMap(m) {
    var out = {};
    if (m && typeof m === 'object') Object.keys(m).forEach(function (k) { if (m[k]) out[k] = true; });
    return out;
  }

  function cosmetics(cat) {
    var c = DD.COSMETICS;
    return c && Array.isArray(c[cat]) ? c[cat] : [];
  }

  // Corrige tipos y rellena lo que falte (usa DD.BASES, DD.COSMETICS y DD.LIMBS si ya existen)
  function fillSave(s) {
    ['ether', 'runs', 'escapes', 'bestFloor', 'kills'].forEach(function (k) { s[k] = nat(s[k]); });
    s.bestTime = typeof s.bestTime === 'number' && isFinite(s.bestTime) && s.bestTime >= 0 ? s.bestTime : null;
    s.mute = !!s.mute;
    s.blueprints = trueMap(s.blueprints);
    s.owned = trueMap(s.owned);
    if (!s.equip || typeof s.equip !== 'object') s.equip = {};

    var bases = DD.BASES;
    if (bases && typeof bases === 'object') {           // planos de los cuerpos base libres
      Object.keys(bases).forEach(function (id) {
        var b = bases[id];
        if (b && !b.locked && b.limbs) {
          Object.keys(b.limbs).forEach(function (slot) { if (b.limbs[slot]) s.blueprints[b.limbs[slot]] = true; });
        }
      });
    }
    var limbs = DD.LIMBS;
    if (limbs && typeof limbs === 'object' && Object.keys(limbs).length) {   // fuera planos que ya no existen
      Object.keys(s.blueprints).forEach(function (id) { if (!Object.prototype.hasOwnProperty.call(limbs, id)) delete s.blueprints[id]; });
    }
    SAVE_CATS.forEach(function (cat) {
      var list = cosmetics(cat);
      if (!list.length) { if (typeof s.equip[cat] !== 'string') s.equip[cat] = ''; return; }
      s.owned[list[0].id] = true;
      list.forEach(function (it) { if (it.price === 0) s.owned[it.id] = true; });
      var eq = s.equip[cat], ok = false;
      list.forEach(function (it) { if (it.id === eq && s.owned[eq]) ok = true; });
      if (!ok) s.equip[cat] = list[0].id;
    });
    return s;
  }

  function replaceSave(src) {                           // conserva la referencia a DD.save
    Object.keys(DD.save).forEach(function (k) { delete DD.save[k]; });
    Object.keys(src).forEach(function (k) { DD.save[k] = src[k]; });
  }

  DD.save = fillSave(defaultSave());

  DD.loadSave = function () {
    var fresh = defaultSave(), data = null;
    try {
      var raw = window.localStorage.getItem(DD.CFG.SAVE_KEY);
      if (raw) data = JSON.parse(raw);
    } catch (e) { data = null; }
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      Object.keys(data).forEach(function (k) { fresh[k] = data[k]; });      // conserva claves extra de otros módulos
    }
    replaceSave(fillSave(fresh));
    return DD.save;
  };

  DD.saveNow = function () {
    try {
      window.localStorage.setItem(DD.CFG.SAVE_KEY, JSON.stringify(DD.save));
      return true;
    } catch (e) { return false; }
  };

  DD.resetSave = function () {
    var fresh = defaultSave();
    fresh.mute = !!DD.save.mute;                        // el ajuste de sonido no es progreso
    replaceSave(fillSave(fresh));
    DD.saveNow();
    return DD.save;
  };
})();
