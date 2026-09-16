/* 5x5 block glyphs, copied verbatim from build B's renderer
   (games/b-opus-x-deepseek/src/render.js) so the hub's headline is drawn with
   the exact same font the games draw with. Rows are separated by '|'. */
(function (global) {
  'use strict';

  var GLYPHS = {
    A: '.###.|#...#|#####|#...#|#...#', B: '####.|#...#|####.|#...#|####.',
    C: '.####|#....|#....|#....|.####', D: '####.|#...#|#...#|#...#|####.',
    E: '#####|#....|####.|#....|#####', F: '#####|#....|####.|#....|#....',
    G: '.####|#....|#..##|#...#|.####', H: '#...#|#...#|#####|#...#|#...#',
    I: '#####|..#..|..#..|..#..|#####', J: '..###|...#.|...#.|#..#.|.##..',
    K: '#...#|#..#.|###..|#..#.|#...#', L: '#....|#....|#....|#....|#####',
    M: '#...#|##.##|#.#.#|#...#|#...#', N: '#...#|##..#|#.#.#|#..##|#...#',
    O: '.###.|#...#|#...#|#...#|.###.', P: '####.|#...#|####.|#....|#....',
    Q: '.###.|#...#|#.#.#|.###.|....#', R: '####.|#...#|####.|#..#.|#...#',
    S: '.####|#....|.###.|....#|####.', T: '#####|..#..|..#..|..#..|..#..',
    U: '#...#|#...#|#...#|#...#|.###.', V: '#...#|#...#|#...#|.#.#.|..#..',
    W: '#...#|#...#|#.#.#|##.##|#...#', X: '#...#|.#.#.|..#..|.#.#.|#...#',
    Y: '#...#|.#.#.|..#..|..#..|..#..', Z: '#####|...#.|..#..|.#...|#####',
    0: '.###.|#..##|#.#.#|##..#|.###.', 1: '..#..|.##..|..#..|..#..|.###.',
    2: '.###.|#...#|..##.|.#...|#####', 3: '####.|....#|.###.|....#|####.',
    4: '#..#.|#..#.|#####|...#.|...#.', 5: '#####|#....|####.|....#|####.',
    6: '.###.|#....|####.|#...#|.###.', 7: '#####|...#.|..#..|..#..|..#..',
    8: '.###.|#...#|.###.|#...#|.###.', 9: '.###.|#...#|.####|....#|.###.',
    ':': '.....|..#..|.....|..#..|.....', '.': '.....|.....|.....|.....|..#..',
    ',': '.....|.....|.....|..#..|.#...', '!': '..#..|..#..|..#..|.....|..#..',
    '-': '.....|.....|.###.|.....|.....', '/': '....#|...#.|..#..|.#...|#....',
    '+': '.....|..#..|.###.|..#..|.....', '?': '.###.|#...#|..#..|.....|..#..'
  };

  var FONT = {}, key;
  for (key in GLYPHS) FONT[key] = GLYPHS[key].split('|');

  var ACC = { 'Á': 'A', 'É': 'E', 'Í': 'I', 'Ó': 'O', 'Ú': 'U', 'Ñ': 'N', 'Ü': 'U' };
  var ACCENTED = { 'Á': 1, 'É': 1, 'Í': 1, 'Ó': 1, 'Ú': 1, 'Ñ': 1, 'Ü': 1 };

  function width(s, scale) {
    return String(s).length * 6 * scale - scale;
  }

  // align: 'left' | 'center'. shadow: a colour, or null for none.
  function text(ctx, s, x, y, scale, colour, align, shadow) {
    s = String(s == null ? '' : s).toUpperCase();
    var left = align === 'center' ? x - (width(s, scale) >> 1) : x;
    for (var pass = shadow ? 0 : 1; pass < 2; pass++) {
      ctx.fillStyle = pass === 0 ? shadow : colour;
      var off = pass === 0 ? scale : 0, bx = left;
      for (var i = 0; i < s.length; i++) {
        var raw = s.charAt(i);
        if (raw !== ' ') {
          var g = FONT[ACC[raw] || raw] || FONT['?'];
          for (var r = 0; r < 5; r++) {
            var row = g[r], c = 0;
            while (c < 5) {
              if (row.charAt(c) !== '#') { c++; continue; }
              var c0 = c;
              while (c < 5 && row.charAt(c) === '#') c++;
              ctx.fillRect(bx + c0 * scale + off, y + r * scale + off, (c - c0) * scale, scale);
            }
          }
          if (pass === 1 && ACCENTED[raw]) {
            var tx = bx + scale, ty = y - 4 * scale;
            ctx.fillRect(tx, ty + scale, scale, scale);
            ctx.fillRect(tx + scale, ty, scale, scale);
            if (raw === 'Ñ' || raw === 'Ü') ctx.fillRect(tx + 2 * scale, ty + scale, scale, scale);
          }
        }
        bx += 6 * scale;
      }
    }
  }

  global.PixelFont = { text: text, width: width };
})(window);
