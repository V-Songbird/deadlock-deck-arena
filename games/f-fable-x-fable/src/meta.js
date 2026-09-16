// Deadlock Deck: El Reloj Anatómico — persistent progress (DD.meta), stored in localStorage.
// Blueprints, Ichor, cosmetics and stats survive the death loop and page reloads.
(function () {
  'use strict';
  const KEY = 'deadlockdeck.v1';
  const defaults = () => ({ blueprints: [], ichor: 0, palettesOwned: ['palido'], palette: 'palido', runs: 0, escapes: 0, bestFloor: 0, bestTime: null, muted: false });
  const paletteDef = id => DD.data.palettes.find(p => p.id === id);

  const meta = {
    state: defaults(),

    // Merges the saved JSON over the defaults; localStorage may be missing, blocked or corrupt.
    load() {
      const s = defaults();
      try { Object.assign(s, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* keep defaults */ }
      s.blueprints = (Array.isArray(s.blueprints) ? s.blueprints : []).filter(id => DD.data.limbs[id] && !DD.data.limbs[id].base);
      if (!Array.isArray(s.palettesOwned) || !s.palettesOwned.includes('palido')) s.palettesOwned = ['palido'];
      meta.state = s;
      if (!meta.canUsePalette(s.palette)) s.palette = 'palido';
    },

    save() {
      try { localStorage.setItem(KEY, JSON.stringify(meta.state)); } catch (e) { /* private mode or quota: progress lives for this session only */ }
    },

    // True when the blueprint is new. Base limbs are always known and never stored.
    discover(limbId) {
      const limb = DD.data.limbs[limbId];
      if (!limb || limb.base || meta.state.blueprints.includes(limbId)) return false;
      meta.state.blueprints.push(limbId);
      return true;
    },

    // Owned, or a free palette whose blueprint threshold has been reached.
    canUsePalette(id) {
      const p = paletteDef(id);
      return !!p && (meta.state.palettesOwned.includes(id) || (p.price === 0 && meta.state.blueprints.length >= p.unlock));
    },

    buyPalette(id) {
      const p = paletteDef(id), s = meta.state;
      if (!p || s.palettesOwned.includes(id) || s.ichor < p.price) return false;
      s.ichor -= p.price;
      s.palettesOwned.push(id);
      meta.save();
      return true;
    },
  };

  DD.meta = meta;
})();
