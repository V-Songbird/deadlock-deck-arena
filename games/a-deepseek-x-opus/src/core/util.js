/* Small helpers used everywhere: deterministic RNG, math, string, colour. */
(function () {
  'use strict';
  var DD = window.DD;

  /* ---------- deterministic RNG (mulberry32) ---------- */
  function Rng(seed) {
    this.seed = (seed >>> 0) || 1;
    this.s = this.seed;
  }
  Rng.prototype.next = function () {
    this.s = (this.s + 0x6D2B79F5) >>> 0;
    var t = this.s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  Rng.prototype.int = function (min, max) {
    if (max === undefined) { max = min; min = 0; }
    if (max <= min) return min;
    return min + Math.floor(this.next() * (max - min + 1));
  };
  Rng.prototype.range = function (min, max) { return min + this.next() * (max - min); };
  Rng.prototype.pick = function (arr) {
    if (!arr || !arr.length) return null;
    return arr[Math.floor(this.next() * arr.length)];
  };
  Rng.prototype.chance = function (p) { return this.next() < p; };
  Rng.prototype.shuffle = function (arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(this.next() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  Rng.prototype.weighted = function (arr, weightOf) {
    var total = 0, i;
    for (i = 0; i < arr.length; i++) total += Math.max(0, weightOf(arr[i]) || 0);
    if (total <= 0) return this.pick(arr);
    var r = this.next() * total;
    for (i = 0; i < arr.length; i++) {
      r -= Math.max(0, weightOf(arr[i]) || 0);
      if (r <= 0) return arr[i];
    }
    return arr[arr.length - 1];
  };

  var _anon = new Rng((Date.now() ^ 0x9e3779b9) >>> 0);
  DD.rng = function (seed) { return new Rng(seed === undefined ? _anon.int(1, 0x7fffffff) : seed); };
  DD.Rng = Rng;
  DD.hash = function (a, b) {
    var h = (a * 374761393 + b * 668265263) >>> 0;
    h = (h ^ (h >>> 13)) >>> 0;
    h = Math.imul(h, 1274126177) >>> 0;
    return (h ^ (h >>> 16)) >>> 0;
  };

  /* ---------- math ---------- */
  DD.clamp = function (v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); };
  DD.lerp = function (a, b, t) { return a + (b - a) * t; };
  DD.approach = function (cur, target, step) {
    if (cur < target) return Math.min(target, cur + step);
    if (cur > target) return Math.max(target, cur - step);
    return target;
  };
  DD.dist = function (ax, ay, bx, by) { var dx = ax - bx, dy = ay - by; return Math.sqrt(dx * dx + dy * dy); };
  DD.easeOut = function (t) { return 1 - (1 - t) * (1 - t); };
  DD.easeIn = function (t) { return t * t; };
  DD.osc = function (t, speed, lo, hi) { return lo + (hi - lo) * (0.5 + 0.5 * Math.sin(t * speed)); };

  /* ---------- text ---------- */
  DD.pad2 = function (n) { n = Math.floor(n); return n < 10 ? '0' + n : '' + n; };
  DD.clock = function (seconds) {
    seconds = Math.max(0, seconds);
    var m = Math.floor(seconds / 60);
    var s = Math.floor(seconds % 60);
    return DD.pad2(m) + ':' + DD.pad2(s);
  };
  DD.plural = function (n, singular, plural) {
    return n + ' ' + (n === 1 ? singular : plural);
  };

  /* ---------- colour ---------- */
  DD.hexToRgb = function (hex) {
    if (!hex) return [255, 0, 255];
    if (hex.charAt(0) === '#') hex = hex.substring(1);
    if (hex.length === 3) hex = hex.charAt(0) + hex.charAt(0) + hex.charAt(1) + hex.charAt(1) + hex.charAt(2) + hex.charAt(2);
    var n = parseInt(hex, 16);
    if (isNaN(n)) return [255, 0, 255];
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  DD.rgbToHex = function (r, g, b) {
    var f = function (v) { v = DD.clamp(Math.round(v), 0, 255).toString(16); return v.length < 2 ? '0' + v : v; };
    return '#' + f(r) + f(g) + f(b);
  };
  DD.mix = function (hexA, hexB, t) {
    var a = DD.hexToRgb(hexA), b = DD.hexToRgb(hexB);
    return DD.rgbToHex(DD.lerp(a[0], b[0], t), DD.lerp(a[1], b[1], t), DD.lerp(a[2], b[2], t));
  };
  DD.shade = function (hex, amount) {
    return amount >= 0 ? DD.mix(hex, '#ffffff', amount) : DD.mix(hex, '#000000', -amount);
  };

  /* ---------- misc ---------- */
  DD.now = function () {
    return (window.performance && window.performance.now) ? window.performance.now() : Date.now();
  };
  DD.keys = function (o) { return Object.keys(o || {}); };
  DD.sum = function (arr, f) {
    var t = 0;
    for (var i = 0; i < arr.length; i++) t += f ? f(arr[i], i) : arr[i];
    return t;
  };
  DD.uniq = function (arr) {
    var out = [], seen = {}, i;
    for (i = 0; i < arr.length; i++) { if (!seen[arr[i]]) { seen[arr[i]] = 1; out.push(arr[i]); } }
    return out;
  };

  /* Hash a string into a positive integer, used to seed per-run generation. */
  DD.hashStr = function (str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619) >>> 0;
    }
    return h >>> 0;
  };
})();
