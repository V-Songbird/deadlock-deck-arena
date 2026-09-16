/* Deadlock Deck: El Reloj Anatómico — global namespace.
 * Loaded first. Every other file assumes these objects exist. */
(function () {
  'use strict';

  var DD = window.DD = window.DD || {};

  // Namespaces written by the data/art/audio files.
  DD.Data = DD.Data || {};
  DD.Sprites = DD.Sprites || {};
  DD.Avatar = DD.Avatar || {};
  DD.Font = DD.Font || {};
  DD.Scenes = DD.Scenes || {};

  // Frozen vocabulary (see SPEC.md section 2).
  DD.SOCKETS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];

  DD.SOCKET_LABEL = {
    head: 'Cabeza',
    torso: 'Torso',
    armL: 'Brazo Izq.',
    armR: 'Brazo Der.',
    legL: 'Pierna Izq.',
    legR: 'Pierna Der.'
  };

  DD.TILE = 24;
  DD.VW = 640;
  DD.VH = 360;

  DD.TILE_VOID = 0;
  DD.TILE_FLOOR = 1;
  DD.TILE_WALL = 2;
  DD.TILE_DOOR = 3;
  DD.TILE_STAIRS = 4;
  DD.TILE_EXIT = 5;
  DD.TILE_GRATE = 6;
  DD.TILE_BLOOD = 7;

  DD.RUN_SECONDS = 360;
  DD.FLOOR_COUNT = 4;
  DD.SHIFT_SECONDS = 60;
  DD.HAND_LIMIT = 8;
  DD.BASE_HP = 60;

  // Ink palette shared by every view.
  DD.C = {
    ink: '#0b0a10',
    void: '#07060a',
    panel: '#141020',
    panelHi: '#1e1830',
    panelLo: '#0d0a15',
    line: '#3a2f4d',
    lineHi: '#6b5a7a',
    text: '#e2d9f0',
    textDim: '#9b8fb0',
    textFaint: '#60566f',
    blood: '#a81c2c',
    bloodHi: '#e0344a',
    bile: '#7fc23a',
    bone: '#ded3b8',
    rust: '#c2672a',
    gold: '#e8b23a',
    steel: '#8fa2b8',
    poison: '#7a3fa8',
    heat: ['#4a5f8a', '#c2672a', '#e0344a', '#ffe066'],
    hp: '#c02a3a',
    energy: '#e8b23a',
    residue: '#7fc23a',
    integrity: '#4a9fd8'
  };
})();
