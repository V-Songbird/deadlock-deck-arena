// Deterministic seeded PRNG (mulberry32). No dependencies: same seed, same sequence.

export function makeRng(seed) {
  let state = seed >>> 0;

  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function int(n) {
    return Math.floor(next() * n);
  }

  return {
    seed,
    next,
    int,
    range(a, b) {
      // inclusive on both ends
      return a + int(b - a + 1);
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      return arr[int(arr.length)];
    },
    shuffle(arr) {
      // Fisher-Yates, in place; returns the same array
      for (let i = arr.length - 1; i > 0; i--) {
        const j = int(i + 1);
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr;
    },
  };
}
