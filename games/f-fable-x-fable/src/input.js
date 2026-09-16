// Deadlock Deck: El Reloj Anatómico — pointer + keyboard input (Worker C).
// Coordinates are logical 640×360 buffer pixels (via DD.render.toLogical).
// Edge flags (clicked, keyPressed) are latched by the event handlers and exposed for
// exactly one update+draw pass between beginFrame() and endFrame().
(function () {
  'use strict';
  const input = {
    x: 0, y: 0,
    down: false,            // pointer currently pressed
    clicked: false,         // pointer released (tap/click) during this frame
    anyInteraction: false,  // set once the user clicked or pressed a key (audio unlock)
    _keys: {},              // code -> currently held
    _pressed: {},           // code -> went down this frame (visible between begin/endFrame)
    _pendingPressed: {},    // latched by keydown until the next beginFrame
    _pendingClick: false,

    init(canvas) {
      const move = (e) => { const p = DD.render.toLogical(e.clientX, e.clientY); input.x = p.x; input.y = p.y; };
      canvas.addEventListener('pointerdown', (e) => {
        move(e); input.down = true; input.anyInteraction = true;
        if (canvas.setPointerCapture) { try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ } }
        e.preventDefault();
      });
      canvas.addEventListener('pointermove', (e) => { move(e); e.preventDefault(); });
      const up = (e) => {
        if (!input.down) return;
        move(e); input.down = false; input._pendingClick = true; e.preventDefault();
      };
      canvas.addEventListener('pointerup', up);
      canvas.addEventListener('pointercancel', () => { input.down = false; });
      window.addEventListener('pointerup', (e) => { if (input.down && e.target !== canvas) input.down = false; });
      // Older mobile browsers: stop scrolling/zooming gestures on the canvas.
      canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      // Some virtual keyboards and synthesized events ship an empty e.code: derive it from e.key.
      const codeOf = (e) => e.code || (e.key === ' ' ? 'Space' : /^[a-z]$/i.test(e.key) ? 'Key' + e.key.toUpperCase() : /^[0-9]$/.test(e.key) ? 'Digit' + e.key : e.key);
      window.addEventListener('keydown', (e) => {
        const code = codeOf(e);
        if (!e.repeat) { input._pendingPressed[code] = true; input._keys[code] = true; }
        input.anyInteraction = true;
        if (code === 'Space' || code.startsWith('Arrow')) e.preventDefault();
      });
      window.addEventListener('keyup', (e) => { input._keys[codeOf(e)] = false; });
      window.addEventListener('blur', () => { input._keys = {}; input.down = false; });
    },

    keyDown(code) { return !!input._keys[code]; },
    keyPressed(code) { return !!input._pressed[code]; },
    beginFrame() {
      input.clicked = input._pendingClick; input._pendingClick = false;
      input._pressed = input._pendingPressed; input._pendingPressed = {};
    },
    endFrame() { input.clicked = false; input._pressed = {}; },
  };
  window.DD.input = input;
})();
