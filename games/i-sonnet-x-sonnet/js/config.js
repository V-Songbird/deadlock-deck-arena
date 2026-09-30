/* Deadlock Deck: El Reloj Anatómico — build I
 * Configuración compartida. La escribe el orquestador; ningún trabajador la edita.
 * Si algo de aquí estorba, se pide al orquestador en el informe final, no se cambia.
 */
(function () {
  'use strict';
  var DD = window.DD = window.DD || {};

  /* ---------- Pantalla ---------- */
  DD.W = 640;
  DD.H = 360;
  DD.TILE = 16;
  // Zona segura de juego: el HUD ocupa y<24 (reloj, vida) e y>=320 (barra anatómica).
  DD.SAFE = { top: 24, bottom: 320 };

  /* ---------- Anatomía ---------- */
  DD.SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];
  DD.SLOT_TYPE = { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' };
  DD.TYPE_SLOTS = { head: ['head'], torso: ['torso'], arm: ['armL', 'armR'], leg: ['legL', 'legR'] };
  DD.SLOT_NAME = { head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.', legL: 'Pierna izq.', legR: 'Pierna der.' };
  DD.TYPE_NAME = { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' };
  DD.STATUSES = ['burn', 'vuln', 'weak', 'stun'];

  /* ---------- Reglas (valores compartidos entre módulos) ---------- */
  DD.CFG = {
    SAVE_KEY: 'dd-i-save-v1',
    RUN_TIME: 360,          // segundos: exactamente 6 minutos
    FLOORS: 3,              // pisos de la torre; el último tiene la salida
    HP_BASE: 60,            // vida base (+ base.hpBonus + pasivas)
    HAND: 5,                // cartas en mano por turno (+ pasiva draw)
    ENERGY: 3,              // energía por turno (+ pasiva energy)
    HEAT_MAX: 100,          // pasar de este calor = sobrecalentamiento
    HEAT_HOT: 70,           // desde aquí la extremidad se muestra "caliente" (aviso)
    OVERHEAT_RESET: 55,     // calor al que vuelve tras sobrecalentar
    OVERHEAT_DMG: 12,       // integridad que pierde la extremidad al sobrecalentar
    COOL_TURN: 12,          // calor que pierde cada extremidad al acabar tu turno (+ pasiva cool)
    COOL_SEC: 3,            // calor por segundo que se disipa fuera de combate
    GRAFT_FRAC: 0.75,       // integridad (fracción del máximo) de una extremidad recién injertada
    TABLE_GRAFTS: 3,        // injertos de plano permitidos en la mesa de disección
    DEVOUR_HEAL: 12,        // PV al devorar una extremidad
    DEVOUR_COOL: 30,        // calor que se quita a todas las extremidades al devorar
    VISION: 4,              // radio de visión en casillas (+ pasiva vision)
    MAP_W: 31,              // casillas por piso (impar)
    MAP_H: 17,
    MAP_X: 72,              // esquina superior izquierda del mapa en pantalla (mapa centrado en la zona segura)
    MAP_Y: 36,
    VIAL_HEAL: 15,          // PV del vial de sangre
    COOLANT_COOL: 40,       // calor que quita el refrigerante a todas las extremidades
    SUTURE_REPAIR: 15,      // integridad que devuelven las suturas a la extremidad más dañada
    ETHER_ESCAPE_BONUS: 40  // Éter extra por escapar
  };

  /* ---------- Paleta gótico-alquímica (usar estos nombres; sin colores sueltos de más) ---------- */
  DD.C = {
    bg: '#0d0b12', bg2: '#17131f', panel: '#1d1726', panelHi: '#2a2136', line: '#4a3b5c',
    ink: '#e8dcc0', dim: '#8a7f6a', bone: '#d9cdb0',
    brass: '#c9a24a', brassDk: '#7a5c22', copper: '#b8642f', steel: '#7a8899', steelDk: '#3c4654',
    blood: '#a3202a', bloodHi: '#e0453f',
    acid: '#6fbf3a', ether: '#7fd6e6', warn: '#e8c23a',
    heat: '#ff7a2a', heatHi: '#ffd15a', integ: '#6ec46e',
    fire1: '#ff5a1f', fire2: '#ff9a2e', fire3: '#ffd15a'
  };

  /* ---------- Utilidades puras (todas aceptan un rng: function() -> [0,1)) ---------- */
  DD.mulberry32 = function (seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      var t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  DD.clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  DD.lerp = function (a, b, t) { return a + (b - a) * t; };
  DD.randInt = function (rng, a, b) { return a + Math.floor(rng() * (b - a + 1)); };      // a..b inclusive
  DD.pick = function (rng, arr) { return arr[Math.floor(rng() * arr.length)]; };
  DD.shuffle = function (rng, arr) {                                                     // in place, devuelve arr
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(rng() * (i + 1)), t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  };
  DD.fmtTime = function (sec) {                                                          // 360 -> "6:00"
    sec = Math.max(0, Math.ceil(sec));
    var m = Math.floor(sec / 60), s = sec % 60;
    return m + ':' + (s < 10 ? '0' : '') + s;
  };
  DD.rng = DD.mulberry32((Date.now() ^ (Math.random() * 4294967296)) >>> 0);             // rng global no determinista
})();
