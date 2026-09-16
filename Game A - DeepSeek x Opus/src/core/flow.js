/* Scene stack and the main loop. */
(function () {
  'use strict';
  var DD = window.DD;

  /* =======================================================================
   * DD.Scenes — a stack of scene objects.
   * A scene is {transparent, enter(p), exit(), update(dt), draw(), key(e), pointer(e)}.
   * ===================================================================== */
  var Scenes = DD.Scenes;
  Scenes.stack = [];
  Scenes.name = null;
  Scenes.registry = Scenes.registry || {};

  Scenes.define = function (name, scene) {
    Scenes.registry[name] = scene;
    scene.name = name;
    return scene;
  };

  Scenes.has = function (name) { return !!Scenes.registry[name]; };

  Scenes.top = function () {
    return Scenes.stack.length ? Scenes.stack[Scenes.stack.length - 1].scene : null;
  };

  Scenes.enterScene = function (entry, params) {
    entry.scene.enter && entry.scene.enter(params || {});
  };

  Scenes.exitScene = function (entry) {
    entry.scene.exit && entry.scene.exit();
  };

  Scenes.replace = function (name, params) {
    while (Scenes.stack.length) Scenes.exitScene(Scenes.stack.pop());
    Scenes.push(name, params);
  };

  Scenes.push = function (name, params) {
    var scene = Scenes.registry[name];
    if (!scene) { console.error('DD.Scenes: unknown scene "' + name + '"'); return; }
    ((Scenes.onPush) || function () {})(name);
    Scenes.stack.push({ name: name, scene: scene, params: params || {} });
    Scenes.name = name;
    Scenes.enterScene(Scenes.stack[Scenes.stack.length - 1], params);
  };

  Scenes.pop = function () {
    if (!Scenes.stack.length) return;
    Scenes.exitScene(Scenes.stack.pop());
    Scenes.name = Scenes.stack.length ? Scenes.stack[Scenes.stack.length - 1].name : null;
    var top = Scenes.top();
    if (top && top.resume) top.resume();
  };

  /* Update/draw the top scene. A transparent scene lets the one under it draw. */
  /* Only the scene that was on top when the frame started is updated. A scene
   * is free to push, pop or replace from inside its own update; the stack is
   * simply read fresh on the next frame. */
  Scenes.update = function (dt) {
    var top = Scenes.top();
    if (!top) return;
    if (top.update) top.update(dt);
  };

  Scenes.draw = function () {
    var n = Scenes.stack.length;
    if (!n) return;
    var top = Scenes.stack[n - 1].scene;
    if (top.transparent && n > 1) {
      var under = Scenes.stack[n - 2].scene;
      if (under.draw) under.draw();
    } else {
      DD.Canvas.clear();
    }
    if (top.draw) top.draw();
  };

  Scenes.key = function (e) {
    var top = Scenes.top();
    if (top && top.key) top.key(e);
  };

  Scenes.pointer = function (phase) {
    var top = Scenes.top();
    if (top && top.pointer) top.pointer(phase);
  };

  /* =======================================================================
   * DD.Loop — one requestAnimationFrame loop, fixed-ish delta.
   * ===================================================================== */
  DD.Loop = {
    running: false,
    t: 0,
    dt: 0,
    fps: 60,
    _last: 0,
    _acc: 0,
    _frames: 0,
    _fpsT: 0,
    slowmo: 1
  };

  DD.Loop.start = function () {
    if (DD.Loop.running) return;
    DD.Loop.running = true;
    DD.Loop._last = DD.now();
    requestAnimationFrame(DD.Loop.frame);
  };

  DD.Loop.frame = function () {
    if (!DD.Loop.running) return;
    var now = DD.now();
    var dt = (now - DD.Loop._last) / 1000;
    DD.Loop._last = now;
    if (dt > 0.05) dt = 0.05;          // clamp after tab switches
    if (dt < 0) dt = 0;
    dt *= DD.Loop.slowmo;
    DD.Loop.dt = dt;
    DD.Loop.t += dt;

    DD.Loop._frames++;
    DD.Loop._fpsT += dt;
    if (DD.Loop._fpsT >= 0.5) {
      DD.Loop.fps = Math.round(DD.Loop._frames / DD.Loop._fpsT);
      DD.Loop._frames = 0;
      DD.Loop._fpsT = 0;
    }

    DD.Input.beginFrame();
    Scenes.update(dt);
    Scenes.draw();
    DD.Input.endFrame();

    requestAnimationFrame(DD.Loop.frame);
  };
})();
