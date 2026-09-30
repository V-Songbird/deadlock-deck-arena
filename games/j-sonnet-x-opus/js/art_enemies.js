// Enemy sprites for DD.Art: enemySprite(enemyId, size) returns a cached canvas, 32x32 for 'big'
// (combat) or 16x16 for 'small' (map). Every enemy faces left. A sprite is drawn with a few pixel
// primitives into a grid of palette keys and then gets a 1 px PAL.ink outline. A key ending in '*'
// marks a glow pixel (eyes, cores) that always survives the 2x downscale used for the small sprite.
(function () {
  window.DD = window.DD || {};

  const N = 32;
  // Grey-green corpse tones missing from PAL.
  const EXTRA = { rot0: '#454f3a', rot: '#6f7b5a', rot2: '#98a57c' };

  function painter() {
    const g = new Array(N * N).fill(null);
    function px(x, y, c) {
      x = Math.round(x); y = Math.round(y);
      if (x >= 0 && y >= 0 && x < N && y < N) g[y * N + x] = c;
    }
    function rect(x, y, w, h, c) {
      for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) px(x + i, y + j, c);
    }
    // Filled ellipse centered on pixel (cx, cy).
    function ell(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / (rx + 0.5), dy = (y - cy) / (ry + 0.5);
          if (dx * dx + dy * dy <= 1) px(x, y, c);
        }
      }
    }
    // Bresenham line with a w x w brush.
    function line(x0, y0, x1, y1, c, w) {
      const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0), sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
      let err = dx + dy;
      for (;;) {
        rect(x0, y0, w || 1, w || 1, c);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
      }
    }
    // Filled polygon from a flat [x0, y0, x1, y1, ...] list of pixel coordinates.
    function poly(pts, c) {
      let top = Infinity, bottom = -Infinity;
      for (let i = 1; i < pts.length; i += 2) { top = Math.min(top, pts[i]); bottom = Math.max(bottom, pts[i]); }
      for (let y = Math.ceil(top); y <= Math.floor(bottom); y++) {
        const yc = Math.min(Math.max(y, top + 0.01), bottom - 0.01), xs = [];
        for (let i = 0; i < pts.length; i += 2) {
          const ax = pts[i], ay = pts[i + 1], bx = pts[(i + 2) % pts.length], by = pts[(i + 3) % pts.length];
          if ((ay <= yc) !== (by <= yc)) xs.push(ax + (yc - ay) * (bx - ax) / (by - ay));
        }
        xs.sort((a, b) => a - b);
        for (let k = 0; k + 1 < xs.length; k += 2) {
          for (let x = Math.ceil(xs[k] - 0.5); x <= Math.floor(xs[k + 1] + 0.5); x++) px(x, y, c);
        }
      }
    }
    // Several single pixels of one color: [x0, y0, x1, y1, ...].
    function dots(pts, c) {
      for (let i = 0; i < pts.length; i += 2) px(pts[i], pts[i + 1], c);
    }
    // String-grid stamp: each char maps to a key through map (unmapped chars are skipped).
    function stamp(x, y, rows, map, flip) {
      rows.forEach((r, j) => {
        for (let i = 0; i < r.length; i++) if (map[r[i]]) px(flip ? x + r.length - 1 - i : x + i, y + j, map[r[i]]);
      });
    }
    return { g, px, rect, ell, line, poly, dots, stamp };
  }

  // Draws fn into its own outlined layer on top of p, so overlapping parts stay readable.
  function layer(p, fn) {
    const t = painter();
    fn(t);
    outline(t.g, N).forEach((c, i) => { if (c) p.g[i] = c; });
  }

  // 14x6 side-view rat facing left (F fur, L lit fur, E eye, P pink skin).
  const RAT = [
    '....P.........',
    '...PFLLL......',
    '..FEFFFFLL....',
    '.FFFFFFFFFF...',
    'PFFFFFFFFFFPP.',
    '...P....P...PP'
  ];

  function gear(p, cx, cy, r, c) {
    p.ell(cx, cy, r, r, c);
    p.dots([cx - r - 1, cy, cx + r + 1, cy, cx, cy - r - 1, cx, cy + r + 1,
      cx - r, cy - r, cx + r, cy - r, cx - r, cy + r, cx + r, cy + r], c);
    p.px(cx, cy, 'ink');
  }

  const DRAW = {
    rat_swarm(p) {
      p.ell(16, 26, 14, 4, 'stone');
      p.dots([4, 27, 6, 27, 14, 29, 16, 29, 25, 28, 27, 28], 'blood2*');
      const grey = { F: 'mist', L: 'parch', E: 'blood2*', P: 'flesh' };
      const brown = { F: 'flesh2', L: 'flesh', E: 'blood2*', P: 'flesh' };
      [[13, 5, grey, true], [3, 10, brown, false], [16, 12, brown, true], [1, 18, grey, false],
        [16, 20, grey, false], [8, 24, brown, false]].forEach((r) => {
        layer(p, (t) => t.stamp(r[0], r[1], RAT, r[2], r[3]));
      });
    },

    ghoul(p) {
      // far limbs
      p.line(21, 14, 23, 21, 'rot0', 2);
      p.line(23, 21, 22, 25, 'rot0', 2);
      p.line(22, 20, 26, 25, 'rot0', 2);
      p.line(26, 25, 24, 29, 'rot0', 2);
      p.rect(22, 29, 4, 1, 'rot0');
      // hunched torso
      p.ell(18, 15, 7, 6, 'rot');
      p.ell(18, 12, 5, 2, 'rot2');
      p.dots([13, 10, 16, 9, 19, 9, 22, 10], 'bone');
      p.line(15, 16, 19, 15, 'rot0');
      p.line(15, 18, 20, 17, 'rot0');
      p.poly([14, 19, 22, 19, 21, 23, 18, 21, 15, 23], 'stone2');
      // near leg
      p.line(15, 20, 13, 25, 'rot', 2);
      p.line(13, 25, 15, 28, 'rot', 2);
      p.rect(11, 29, 6, 1, 'rot');
      // head thrust forward and low
      p.line(12, 14, 14, 13, 'rot', 2);
      p.ell(9, 15, 3, 3, 'rot');
      p.rect(5, 16, 5, 3, 'rot');
      p.line(5, 17, 8, 17, 'ink');
      p.dots([5, 16, 7, 16, 6, 18], 'bone');
      p.px(8, 13, 'acid*');
      p.dots([8, 11, 10, 11, 11, 12], 'stone');
      p.px(4, 18, 'blood2');
      // long arm with claws
      p.line(13, 15, 9, 21, 'rot', 2);
      p.line(9, 21, 6, 25, 'rot', 2);
      p.line(6, 26, 3, 30, 'bone');
      p.line(7, 26, 6, 30, 'bone');
      p.line(8, 26, 9, 30, 'bone');
      p.dots([3, 30, 6, 30, 9, 30], 'blood2');
    },

    flesh_hound(p) {
      // far legs and tail
      p.line(13, 19, 12, 29, 'flesh2', 2);
      p.line(25, 19, 27, 29, 'flesh2', 2);
      p.line(26, 14, 30, 9, 'blood', 2);
      // skinless body
      p.ell(19, 16, 8, 5, 'blood');
      p.ell(19, 13, 6, 1, 'blood2');
      p.line(14, 18, 18, 20, 'flesh2');
      p.line(20, 18, 24, 20, 'flesh2');
      p.dots([15, 14, 15, 16, 17, 14, 17, 16, 19, 14, 19, 16], 'bone');
      p.dots([13, 11, 15, 12, 17, 11, 19, 12, 21, 11, 23, 12, 25, 11], 'parch');
      // near legs
      p.line(10, 19, 9, 29, 'blood', 2);
      p.line(22, 19, 24, 24, 'blood', 2);
      p.line(24, 24, 22, 29, 'blood', 2);
      p.dots([8, 30, 10, 30, 21, 30, 23, 30], 'bone');
      // head with open jaws
      p.ell(10, 13, 4, 4, 'blood');
      p.poly([10, 8, 13, 4, 13, 10], 'blood');
      p.rect(1, 11, 8, 3, 'blood');
      p.poly([2, 16, 9, 15, 9, 18, 3, 18], 'blood');
      p.rect(2, 14, 7, 2, 'ink');
      p.dots([2, 14, 4, 14, 6, 14, 3, 15, 5, 15, 7, 15], 'bone');
      p.px(1, 11, 'ink');
      p.line(3, 11, 8, 11, 'blood2');
      p.px(8, 12, 'flame2*');
    },

    homunculus(p) {
      p.line(19, 7, 25, 5, 'copper');
      p.line(25, 5, 27, 11, 'copper');
      p.ell(16, 19, 8, 9, 'verdi');
      p.rect(12, 7, 8, 3, 'brass');
      p.rect(11, 6, 10, 1, 'brass2');
      p.rect(9, 28, 14, 2, 'brass');
      p.line(9, 14, 9, 22, 'ice');
      p.dots([10, 12, 11, 11], 'ice');
      // pale child-like creature floating inside
      p.line(16, 10, 15, 13, 'flesh2');
      p.ell(18, 23, 3, 3, 'parch');
      p.ell(20, 26, 3, 1, 'parch');
      p.line(15, 22, 13, 25, 'parch');
      p.ell(14, 17, 5, 4, 'bone');
      p.rect(10, 16, 2, 3, 'ink');
      p.rect(14, 16, 2, 3, 'ink');
      p.dots([10, 16, 14, 16], 'acid*');
      p.line(12, 20, 13, 20, 'flesh2');
      p.dots([21, 13, 22, 17, 20, 11, 11, 25], 'verdi2');
    },

    clockwork_spider(p) {
      // far legs (behind the abdomen)
      p.line(14, 19, 10, 9, 'copper');
      p.line(10, 9, 7, 29, 'copper');
      p.line(16, 19, 20, 4, 'copper');
      p.line(20, 4, 21, 29, 'copper');
      p.line(17, 20, 28, 5, 'copper');
      p.line(28, 5, 30, 28, 'copper');
      // clock-face abdomen
      p.ell(22, 14, 7, 7, 'brass');
      p.ell(22, 14, 5, 5, 'parch');
      p.dots([22, 10, 26, 14, 22, 18, 18, 14], 'ink');
      p.line(22, 14, 22, 11, 'ink');
      p.line(22, 14, 24, 15, 'ink');
      p.px(22, 14, 'blood2');
      p.rect(21, 5, 3, 2, 'brass2');
      // cephalothorax
      p.ell(12, 20, 4, 3, 'brass');
      p.line(10, 18, 14, 18, 'brass2');
      p.dots([8, 19, 9, 18, 10, 19], 'blood2*');
      p.dots([7, 22, 8, 23], 'copper');
      // near legs
      p.line(11, 20, 4, 11, 'brass2');
      p.line(4, 11, 1, 29, 'brass2');
      p.line(13, 21, 8, 14, 'brass2');
      p.line(8, 14, 10, 29, 'brass2');
      p.dots([4, 11, 8, 14], 'copper');
    },

    bone_golem(p) {
      // legs and far arm
      p.rect(11, 22, 4, 7, 'parch');
      p.rect(19, 22, 4, 7, 'parch');
      p.rect(10, 28, 6, 2, 'bone');
      p.rect(18, 28, 6, 2, 'bone');
      p.rect(25, 11, 4, 9, 'parch');
      p.rect(26, 19, 4, 7, 'parch');
      p.ell(28, 27, 2, 2, 'parch');
      // ribcage torso with a glowing core
      p.ell(17, 22, 6, 2, 'bone');
      p.poly([7, 9, 27, 9, 23, 21, 11, 21], 'bone');
      for (let y = 12; y <= 18; y += 3) p.line(10, y, 24, y, 'stone');
      p.rect(16, 10, 2, 11, 'parch');
      p.ell(17, 15, 2, 2, 'verdi2');
      p.rect(16, 14, 2, 2, 'acid*');
      // shoulders and low skull
      p.ell(8, 10, 4, 3, 'bone');
      p.ell(26, 10, 4, 3, 'parch');
      p.line(24, 12, 22, 20, 'parch', 2);
      p.dots([7, 20, 3, 21, 4, 21, 5, 21, 6, 21, 7, 21], 'stone');
      p.ell(12, 6, 3, 3, 'bone');
      p.rect(10, 5, 2, 2, 'ink');
      p.px(10, 6, 'acid*');
      p.px(13, 5, 'ink');
      p.line(10, 9, 13, 9, 'parch');
      p.dots([10, 9, 12, 9], 'ink');
      // front arm ending in a huge fist
      p.rect(4, 12, 4, 8, 'bone');
      p.ell(5, 20, 2, 1, 'parch');
      p.rect(3, 21, 5, 5, 'bone');
      p.ell(5, 27, 3, 2, 'bone');
      p.line(3, 27, 7, 27, 'parch');
    },

    gargoyle(p) {
      // wings
      p.poly([14, 12, 10, 2, 8, 7, 6, 5, 8, 12], 'stone');
      p.poly([15, 13, 19, 1, 23, 6, 27, 2, 30, 12, 25, 11, 24, 16], 'stone2');
      p.line(16, 12, 19, 2, 'mist');
      p.line(18, 13, 27, 3, 'mist');
      p.line(20, 14, 29, 11, 'stone');
      // tail
      p.line(25, 28, 29, 25, 'stone2', 2);
      p.line(30, 25, 29, 20, 'stone2');
      // crouched body
      p.ell(18, 21, 6, 6, 'stone2');
      p.ell(22, 24, 5, 5, 'stone2');
      p.rect(16, 28, 10, 2, 'stone2');
      p.line(14, 16, 19, 15, 'mist');
      p.dots([18, 20, 19, 21, 20, 21, 23, 25], 'flame');
      // head with horns and ember eyes
      p.ell(10, 14, 4, 4, 'stone2');
      p.rect(5, 15, 4, 3, 'stone2');
      p.line(11, 10, 15, 7, 'mist');
      p.line(9, 10, 10, 6, 'mist');
      p.line(5, 17, 8, 17, 'ink');
      p.px(6, 18, 'bone');
      p.dots([7, 13, 10, 13], 'flame2*');
      // front arm
      p.line(12, 18, 9, 24, 'stone2', 2);
      p.line(9, 24, 9, 28, 'stone2', 2);
      p.dots([7, 30, 9, 30, 11, 30], 'bone');
    },

    alchemist(p) {
      // robe and hood
      p.poly([12, 11, 21, 10, 26, 30, 9, 30], 'stone2');
      p.line(17, 13, 15, 29, 'stone');
      p.line(21, 14, 23, 29, 'stone');
      p.rect(9, 29, 17, 1, 'verdi');
      p.ell(16, 8, 5, 5, 'stone2');
      p.ell(17, 6, 3, 2, 'mist');
      p.ell(13, 9, 3, 3, 'night');
      p.dots([10, 8, 12, 8, 13, 8, 15, 8], 'brass');
      p.dots([11, 8, 14, 8], 'acid*');
      p.px(11, 11, 'flesh');
      // belt of vials
      p.rect(12, 18, 11, 1, 'copper');
      p.dots([14, 19, 17, 19, 20, 19], 'blood2');
      p.px(17, 19, 'acid');
      // arm holding a bubbling flask
      p.poly([13, 12, 16, 14, 9, 17, 8, 15], 'mist');
      p.px(7, 16, 'flesh');
      p.rect(5, 15, 2, 3, 'ice');
      p.ell(6, 20, 3, 3, 'acid');
      p.line(4, 19, 8, 19, 'verdi2');
      p.px(5, 20, 'bone');
      p.dots([5, 12, 4, 8], 'verdi2');
      p.px(7, 10, 'acid*');
    },

    surgeon(p) {
      p.rect(12, 26, 3, 4, 'stone2');
      p.rect(17, 26, 3, 4, 'stone2');
      p.rect(10, 11, 11, 16, 'mist');
      // back hand fanning scalpels
      p.line(20, 13, 23, 19, 'mist', 2);
      p.px(23, 20, 'flesh');
      p.line(23, 19, 24, 17, 'mist');
      p.line(24, 16, 25, 13, 'ice');
      p.line(24, 19, 26, 17, 'mist');
      p.line(27, 16, 29, 14, 'ice');
      p.line(24, 20, 26, 20, 'mist');
      p.line(27, 20, 30, 19, 'ice');
      // bloodied apron
      p.poly([10, 13, 19, 13, 21, 28, 9, 28], 'parch');
      p.dots([12, 17, 13, 17, 13, 18, 15, 22, 16, 22, 16, 23, 11, 25, 18, 15], 'blood2');
      p.dots([12, 19, 16, 24, 11, 26, 19, 26, 20, 27], 'blood');
      // masked head with cap and loupe
      p.ell(15, 6, 4, 4, 'flesh');
      p.ell(15, 3, 4, 2, 'verdi');
      p.rect(11, 7, 6, 3, 'bone');
      p.line(17, 7, 19, 6, 'ink');
      p.dots([11, 5, 13, 5], 'brass');
      p.px(12, 5, 'flame2*');
      // raised arm with a bone saw
      p.line(11, 12, 8, 9, 'mist', 2);
      p.px(7, 9, 'flesh');
      p.rect(6, 7, 2, 2, 'copper');
      p.rect(1, 4, 6, 3, 'ice');
      p.line(1, 4, 6, 4, 'bone');
      p.dots([1, 7, 3, 7, 5, 7], 'ice');
      p.dots([2, 5, 3, 6], 'blood2');
    },

    engineer(p) {
      // steam, pipes and boiler backpack
      p.ell(20, 2, 2, 1, 'mist');
      p.ell(26, 3, 2, 2, 'mist');
      p.dots([19, 1, 25, 2], 'bone');
      p.rect(19, 3, 2, 7, 'copper');
      p.rect(25, 5, 2, 5, 'copper');
      p.rect(17, 9, 11, 15, 'brass');
      p.rect(26, 9, 2, 15, 'copper');
      p.dots([18, 10, 24, 10, 18, 22, 24, 22], 'copper');
      p.ell(22, 13, 2, 2, 'parch');
      p.dots([20, 11, 24, 11, 20, 15, 24, 15], 'brass2');
      p.line(22, 13, 21, 12, 'blood2*');
      p.rect(19, 18, 6, 3, 'ink');
      p.dots([19, 19, 21, 19, 23, 19], 'flame');
      p.dots([20, 20, 22, 20, 24, 20], 'flame2*');
      // legs and coat
      p.rect(10, 22, 3, 7, 'stone2');
      p.rect(15, 22, 3, 7, 'stone2');
      p.rect(9, 29, 4, 1, 'stone');
      p.rect(14, 29, 4, 1, 'stone');
      p.rect(9, 12, 9, 11, 'copper');
      p.rect(9, 19, 9, 1, 'brass');
      p.line(15, 12, 17, 18, 'stone');
      // head with goggles
      p.ell(12, 8, 4, 4, 'flesh');
      p.ell(13, 5, 4, 2, 'stone');
      p.rect(8, 7, 7, 2, 'brass2');
      p.dots([9, 7, 12, 7], 'ice*');
      p.rect(8, 10, 4, 1, 'mist');
      // arm raising a wrench
      p.line(10, 14, 6, 17, 'copper', 2);
      p.px(5, 17, 'flesh');
      p.line(5, 16, 3, 9, 'mist', 2);
      p.rect(1, 5, 5, 4, 'mist');
      p.rect(2, 5, 3, 2, null);
      p.px(4, 11, 'ice');
    },

    chimera(p) {
      // snake tail rising behind
      p.line(27, 18, 30, 13, 'verdi', 2);
      p.line(30, 13, 29, 8, 'verdi', 2);
      p.line(29, 8, 26, 6, 'verdi', 2);
      p.ell(24, 6, 2, 1, 'verdi2');
      p.px(23, 5, 'acid*');
      p.dots([21, 7, 20, 6, 20, 8], 'blood2');
      // far legs
      p.rect(12, 21, 3, 8, 'copper');
      p.rect(25, 21, 3, 8, 'copper');
      // lion body
      p.ell(19, 18, 9, 5, 'brass');
      p.ell(19, 21, 6, 1, 'copper');
      p.line(14, 14, 25, 14, 'brass2');
      // near legs
      p.rect(9, 20, 3, 10, 'brass');
      p.rect(22, 21, 3, 9, 'brass');
      p.dots([8, 30, 10, 30, 21, 30, 23, 30], 'bone');
      // burning mane
      p.poly([3, 10, 5, 3, 8, 8], 'blood2');
      p.poly([8, 7, 10, 0, 12, 7], 'blood2');
      p.poly([12, 9, 16, 4, 15, 12], 'blood2');
      p.poly([13, 14, 17, 12, 14, 19], 'blood2');
      p.ell(9, 13, 6, 6, 'flame');
      p.ell(9, 13, 4, 4, 'flame2');
      // goat horns
      p.line(9, 8, 12, 5, 'bone');
      p.line(12, 5, 15, 6, 'bone');
      p.line(15, 6, 16, 9, 'parch');
      p.line(8, 8, 10, 4, 'parch');
      // face
      p.ell(6, 14, 3, 3, 'brass');
      p.rect(2, 14, 4, 3, 'parch');
      p.px(2, 14, 'ink');
      p.rect(2, 17, 4, 1, 'ink');
      p.dots([3, 17, 5, 17], 'bone');
      p.px(6, 12, 'blood2*');
    },

    inquisitor(p) {
      // robe
      p.poly([12, 12, 21, 12, 26, 30, 8, 30], 'blood');
      p.poly([12, 13, 15, 13, 13, 30, 8, 30], 'blood2');
      p.line(19, 15, 21, 29, 'flesh2');
      p.rect(8, 29, 19, 1, 'brass2');
      p.dots([17, 17, 16, 18, 17, 18, 18, 18, 17, 19], 'brass2');
      // tall pointed hood and faceless brass mask
      p.poly([18, 0, 22, 12, 12, 12], 'blood');
      p.line(17, 2, 14, 11, 'blood2');
      p.ell(14, 11, 3, 3, 'brass');
      p.dots([12, 10, 13, 9, 12, 11], 'brass2');
      p.px(15, 13, 'copper');
      // arm swinging a flail
      p.poly([13, 13, 16, 15, 10, 19, 8, 18], 'blood2');
      p.px(8, 19, 'stone2');
      p.line(7, 19, 5, 15, 'copper');
      p.dots([4, 14, 3, 16, 3, 18], 'mist');
      p.ell(3, 22, 2, 2, 'stone2');
      p.dots([3, 19, 0, 22, 6, 22, 3, 25, 1, 20, 5, 20, 1, 24, 5, 24], 'mist');
      p.px(2, 21, 'flame*');
    },

    clockmaker(p) {
      // gears behind
      gear(p, 26, 4, 3, 'copper');
      gear(p, 5, 5, 2, 'copper');
      // robe and shoulders
      p.poly([9, 10, 23, 10, 28, 30, 7, 30], 'stone2');
      p.line(9, 11, 7, 29, 'verdi');
      p.line(23, 11, 27, 29, 'verdi');
      p.rect(7, 29, 21, 1, 'brass');
      p.ell(8, 10, 4, 3, 'brass');
      p.ell(24, 10, 4, 3, 'brass');
      p.dots([6, 9, 22, 9], 'brass2');
      // automaton head
      p.ell(16, 5, 4, 4, 'brass');
      p.rect(12, 4, 6, 3, 'stone');
      p.dots([13, 5, 16, 5], 'flame2*');
      p.dots([13, 0, 16, 0, 19, 1], 'brass2');
      p.px(19, 5, 'verdi2');
      // chest clock face
      p.ell(16, 18, 7, 7, 'brass2');
      p.ell(16, 18, 6, 6, 'bone');
      p.dots([16, 13, 21, 18, 16, 23, 11, 18], 'ink');
      p.line(16, 18, 16, 14, 'ink');
      p.line(16, 18, 19, 20, 'ink');
      p.line(16, 18, 13, 21, 'blood2');
      gear(p, 12, 27, 2, 'copper');
      gear(p, 21, 27, 2, 'brass');
      // pendulum arm in front, claw hand behind
      p.line(6, 12, 3, 24, 'brass');
      p.ell(3, 26, 2, 3, 'brass2');
      p.px(3, 26, 'flame');
      p.line(25, 13, 27, 21, 'brass', 2);
      p.dots([26, 23, 28, 23, 29, 22], 'brass2');
    },

    unknown(p) {
      p.poly([10, 12, 22, 12, 26, 30, 6, 30], 'stone2');
      p.ell(16, 10, 6, 6, 'stone2');
      p.ell(14, 11, 3, 3, 'night');
      p.dots([13, 11, 15, 11], 'bone*');
    }
  };

  // 1 px ink outline on every empty pixel that touches the sprite (4-neighbourhood).
  function outline(g, n) {
    const out = g.slice();
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = y * n + x;
        if (!g[i] && ((x > 0 && g[i - 1]) || (x < n - 1 && g[i + 1]) || (y > 0 && g[i - n]) || (y < n - 1 && g[i + n]))) out[i] = 'ink';
      }
    }
    return out;
  }

  // 2x downscale: a glow pixel wins its 2x2 block, otherwise the most frequent key if 2+ pixels are set.
  function downscale(g) {
    const n = N / 2, out = new Array(n * n).fill(null);
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        const i = 2 * y * N + 2 * x;
        const keys = [g[i], g[i + 1], g[i + N], g[i + N + 1]].filter(Boolean);
        const count = (k) => keys.filter((v) => v === k).length;
        const glow = keys.find((k) => k.endsWith('*'));
        if (glow) out[y * n + x] = glow;
        else if (keys.length >= 2) out[y * n + x] = keys.reduce((a, b) => (count(b) > count(a) ? b : a));
      }
    }
    return out;
  }

  function toCanvas(g, n) {
    const PAL = DD.Art.PAL, cv = document.createElement('canvas');
    cv.width = cv.height = n;
    const ctx = cv.getContext('2d');
    for (let i = 0; i < g.length; i++) {
      if (!g[i]) continue;
      const k = g[i].replace('*', '');
      ctx.fillStyle = PAL[k] || EXTRA[k];
      ctx.fillRect(i % n, Math.floor(i / n), 1, 1);
    }
    return cv;
  }

  const cache = {};

  DD.Art = DD.Art || {};
  Object.assign(DD.Art, {
    enemySprite(enemyId, size) {
      const small = size === 'small', key = enemyId + (small ? ':small' : ':big');
      if (!cache[key]) {
        const p = painter(), n = small ? N / 2 : N;
        (Object.prototype.hasOwnProperty.call(DRAW, enemyId) ? DRAW[enemyId] : DRAW.unknown)(p);
        cache[key] = toCanvas(outline(small ? downscale(p.g) : p.g, n), n);
      }
      return cache[key];
    }
  });
})();
