/* Deadlock Deck: El Reloj Anatómico — datos del juego (W2)
 * Extremidades, cartas, muñones, enemigos, cuerpos base, cosméticos y pisos. Solo datos y texto.
 * Reglas de referencia: docs/design.md §4.
 */
(function () {
  'use strict';
  var DD = window.DD;

  DD.LIMBS = {};
  DD.LIMB_ORDER = [];   // ids en orden cabeza, torso, brazos, piernas (útil para cuadrículas)
  DD.CARDS = {};

  /* ---------- Constructores cortos ---------- */
  // Las 3 cartas de cada extremidad se llaman <id>_1 (barata), _2 (media), _3 (firma).
  function limb(id, name, type, tier, integ, passive, flavor) {
    DD.LIMBS[id] = {
      id: id, name: name, type: type, tier: tier, integ: integ, passive: passive,
      cards: [id + '_1', id + '_2', id + '_3'], flavor: flavor
    };
    DD.LIMB_ORDER.push(id);
  }
  function card(id, name, cost, heat, wear, fx, flavor) {
    var c = { id: id, limb: id.replace(/_\d$/, ''), name: name, cost: cost, heat: heat, wear: wear, fx: fx };
    if (flavor) c.flavor = flavor;
    DD.CARDS[id] = c;
  }

  /* ---------- Cabezas ---------- */
  limb('cab_cosido', 'Cabeza Cosida', 'head', 1, 35, { vision: 1 },
    'Cosida a toda prisa; aun así, te mira con desaprobación.');
  card('cab_cosido_1', 'Cabezazo', 1, 8, 0, [{ t: 'dmg', v: 4 }]);
  card('cab_cosido_2', 'Ceño Fruncido', 1, 4, 0, [{ t: 'block', v: 5 }]);
  card('cab_cosido_3', 'Grito Cosido', 2, 12, 0, [{ t: 'weak', v: 2 }, { t: 'dmg', v: 5 }],
    'Un alarido que hace temblar las puntadas.');

  limb('cab_sabueso', 'Cabeza de Sabueso', 'head', 1, 35, { vision: 2 },
    'Huele el miedo a tres pisos de distancia.');
  card('cab_sabueso_1', 'Olfatear Sangre', 1, 10, 0, [{ t: 'vuln', v: 1 }, { t: 'dmg', v: 2 }]);
  card('cab_sabueso_2', 'Mordisco Doble', 1, 14, 0, [{ t: 'dmg', v: 3, n: 2 }]);
  card('cab_sabueso_3', 'Jauría', 2, 24, 0,
    [{ t: 'vuln', v: 2 }, { t: 'dmg', v: 2, n: 4 }],
    'Aúlla, y el eco responde con colmillos.');

  limb('cab_relojero', 'Cabeza de Relojero', 'head', 2, 40, { draw: 1, vision: 1 },
    'Sus ojos son lentes; su mente, un escape de ancla.');
  card('cab_relojero_1', 'Tic-Tac', 0, 10, 0, [{ t: 'draw', v: 1 }]);
  card('cab_relojero_2', 'Dar Cuerda', 1, 14, 0, [{ t: 'draw', v: 2 }]);
  card('cab_relojero_3', 'Hora Exacta', 1, 40, 3,
    [{ t: 'energy', v: 2 }, { t: 'draw', v: 1 }],
    'Por un instante, el tiempo te obedece.');

  limb('cab_quimera', 'Cabeza de Quimera', 'head', 3, 50, { fireRes: 0.25 },
    'Tres bocas, una sola hambre: arder.');
  card('cab_quimera_1', 'Chispa', 1, 20, 0, [{ t: 'dmg', v: 2 }, { t: 'burn', v: 3 }]);
  card('cab_quimera_2', 'Fuego Fatuo', 2, 36, 2, [{ t: 'dmg', v: 3 }, { t: 'burn', v: 4 }]);
  card('cab_quimera_3', 'Gran Llamarada', 3, 55, 6,
    [{ t: 'dmg', v: 8 }, { t: 'burn', v: 5 }, { t: 'selfdmg', v: 3 }],
    'El fuego pide su precio en carne.');

  limb('cab_plaga', 'Máscara de la Plaga', 'head', 2, 42, { block: 1, fireRes: 0.15 },
    'El pico está lleno de hierbas... y de lo que ocultan.');
  card('cab_plaga_1', 'Velo Enfermizo', 1, 8, 0, [{ t: 'block', v: 5 }, { t: 'weak', v: 1 }]);
  card('cab_plaga_2', 'Miasma Denso', 2, 20, 0, [{ t: 'block', v: 6 }, { t: 'weak', v: 3 }, { t: 'cool', v: 10, all: true }]);
  card('cab_plaga_3', 'Peste Negra', 2, 42, 3,
    [{ t: 'dmg', v: 5 }, { t: 'weak', v: 2 }, { t: 'vuln', v: 2 }],
    'La torre entera tose.');

  /* ---------- Torsos ---------- */
  limb('tor_remendado', 'Torso Remendado', 'torso', 1, 40, { hp: 4 },
    'Más hilo que hueso, y aun así late.');
  card('tor_remendado_1', 'Puntada Firme', 1, 4, 0, [{ t: 'block', v: 5 }]);
  card('tor_remendado_2', 'Latido Fuerte', 1, 6, 0, [{ t: 'heal', v: 4 }]);
  card('tor_remendado_3', 'Coraza Cosida', 2, 10, 0, [{ t: 'block', v: 11 }],
    'Parches sobre parches sobre parches.');

  limb('tor_caldera', 'Torso de Caldera', 'torso', 3, 60, { energy: 1 },
    'En su pecho hierve algo que no debería hervir.');
  card('tor_caldera_1', 'Vapor a Presión', 1, 22, 0, [{ t: 'block', v: 6 }]);
  card('tor_caldera_2', 'Escape de Vapor', 2, 40, 0, [{ t: 'block', v: 10 }, { t: 'cool', v: 15, all: true }, { t: 'repair', v: 6 }]);
  card('tor_caldera_3', 'Sobrepresión', 3, 52, 6,
    [{ t: 'dmg', v: 10 }, { t: 'block', v: 10 }],
    'La presión busca salida. Tú eres la salida.');

  limb('tor_costillar', 'Costillar de Hierro', 'torso', 2, 50, { hp: 2, block: 1 },
    'Las costillas son barrotes; el corazón, un preso.');
  card('tor_costillar_1', 'Jaula de Hueso', 1, 8, 0, [{ t: 'block', v: 7 }]);
  card('tor_costillar_2', 'Muro de Hueso', 2, 16, 0, [{ t: 'block', v: 13 }, { t: 'cool', v: 8, all: true }]);
  card('tor_costillar_3', 'Bastión Férreo', 3, 44, 3,
    [{ t: 'block', v: 20 }, { t: 'weak', v: 2 }],
    'Nada entra. Nada sale. Nadie se queja.');

  limb('tor_alambique', 'Alambique Vivo', 'torso', 2, 45, { cool: 3 },
    'Destila tus heridas en un licor verdoso.');
  card('tor_alambique_1', 'Destilar', 1, 4, 0, [{ t: 'heal', v: 5 }]);
  card('tor_alambique_2', 'Condensar', 1, 10, 0, [{ t: 'block', v: 2 }, { t: 'cool', v: 20, all: true }]);
  card('tor_alambique_3', 'Panacea', 2, 20, 0,
    [{ t: 'heal', v: 9 }, { t: 'repair', v: 10 }, { t: 'cool', v: 15, all: true }],
    'Transmuta el dolor en algo casi parecido a la salud.');

  /* ---------- Brazos ---------- */
  limb('bra_muerto', 'Brazo de Cadáver', 'arm', 1, 30, {},
    'Cuelga, tiembla y, a veces, golpea.');
  card('bra_muerto_1', 'Zarpazo Torpe', 1, 6, 0, [{ t: 'dmg', v: 5 }]);
  card('bra_muerto_2', 'Brazos Cruzados', 1, 4, 0, [{ t: 'block', v: 5 }]);
  card('bra_muerto_3', 'Puñetazo Cosido', 2, 12, 0, [{ t: 'dmg', v: 9 }]);

  limb('bra_sierra', 'Brazo de Sierra', 'arm', 2, 45, { dmg: 1 },
    'Zumba como una colmena furiosa.');
  card('bra_sierra_1', 'Corte Dentado', 1, 20, 0, [{ t: 'dmg', v: 5 }]);
  card('bra_sierra_2', 'Aserrar', 2, 32, 4, [{ t: 'dmg', v: 9 }]);
  card('bra_sierra_3', 'Desmembrar', 3, 50, 7,
    [{ t: 'dmg', v: 20 }],
    'Las virutas de hueso caen como nieve.');

  limb('bra_golem', 'Puño de Gólem', 'arm', 2, 50, { hp: 3 },
    'Retazos de una docena de gigantes, un solo puño.');
  card('bra_golem_1', 'Puño de Piedra', 1, 20, 0, [{ t: 'dmg', v: 6 }]);
  card('bra_golem_2', 'Muro de Piedra', 2, 26, 0, [{ t: 'block', v: 9 }, { t: 'dmg', v: 4 }, { t: 'repair', v: 4 }]);
  card('bra_golem_3', 'Golpe Sísmico', 3, 48, 5,
    [{ t: 'dmg', v: 16 }, { t: 'block', v: 6 }],
    'El suelo recuerda cada golpe.');

  limb('bra_tijera', 'Tenazas de Cirujano', 'arm', 2, 40, { vision: 1 },
    'Precisas, frías y siempre demasiado abiertas.');
  card('bra_tijera_1', 'Tijeretazo', 1, 14, 0, [{ t: 'vuln', v: 1 }, { t: 'dmg', v: 2 }]);
  card('bra_tijera_2', 'Incisión', 2, 24, 1, [{ t: 'vuln', v: 1 }, { t: 'dmg', v: 5 }]);
  card('bra_tijera_3', 'Amputación', 3, 46, 4,
    [{ t: 'vuln', v: 2 }, { t: 'dmg', v: 11 }],
    'Un corte tan limpio que tarda en doler.');

  limb('bra_piston', 'Brazo de Pistón', 'arm', 3, 52, { dmg: 1 },
    'Cada golpe es una explosión pequeña y obediente.');
  card('bra_piston_1', 'Pistonazo', 1, 20, 0, [{ t: 'dmg', v: 2, n: 2 }]);
  card('bra_piston_2', 'Martilleo', 2, 36, 1, [{ t: 'dmg', v: 2, n: 3 }]);
  card('bra_piston_3', 'Ráfaga de Vapor', 3, 55, 5,
    [{ t: 'dmg', v: 2, n: 5 }],
    'Cinco golpes antes de que suene el primero.');

  limb('bra_tentaculo', 'Tentáculo Alquímico', 'arm', 3, 55, { fireRes: 0.2 },
    'Nació en un frasco. No ha perdonado al frasco.');
  card('bra_tentaculo_1', 'Látigo Ácido', 1, 20, 0, [{ t: 'dmg', v: 3 }, { t: 'burn', v: 3 }]);
  card('bra_tentaculo_2', 'Zarcillo Tóxico', 2, 32, 1, [{ t: 'weak', v: 2 }, { t: 'burn', v: 5 }]);
  card('bra_tentaculo_3', 'Abrazo Ácido', 3, 52, 5,
    [{ t: 'weak', v: 3 }, { t: 'dmg', v: 6 }, { t: 'burn', v: 5 }],
    'Lo disuelve despacio, con cariño.');

  /* ---------- Piernas ---------- */
  limb('pie_muerta', 'Pierna de Cadáver', 'leg', 1, 30, {},
    'Camina por costumbre, no por voluntad.');
  card('pie_muerta_1', 'Patada Floja', 1, 4, 0, [{ t: 'dmg', v: 4 }]);
  card('pie_muerta_2', 'Zancada Firme', 1, 4, 0, [{ t: 'block', v: 5 }]);
  card('pie_muerta_3', 'Pisotón Cosido', 2, 10, 0, [{ t: 'dmg', v: 5 }, { t: 'block', v: 5 }]);

  limb('pie_sabueso', 'Patas de Sabueso', 'leg', 1, 35, { speed: 0.15 },
    'Corren sin que nadie las llame.');
  card('pie_sabueso_1', 'Arañazo', 0, 10, 0, [{ t: 'dmg', v: 2 }]);
  card('pie_sabueso_2', 'Acoso', 1, 12, 0, [{ t: 'dmg', v: 2, n: 2 }]);
  card('pie_sabueso_3', 'Salto Cazador', 2, 22, 0,
    [{ t: 'vuln', v: 1 }, { t: 'dmg', v: 7 }],
    'La presa nunca oye el último paso.');

  limb('pie_resorte', 'Piernas de Resorte', 'leg', 2, 40, { speed: 0.15 },
    'Cada paso es un rebote con mala intención.');
  card('pie_resorte_1', 'Rebote', 1, 14, 0, [{ t: 'dmg', v: 4 }, { t: 'block', v: 3 }]);
  card('pie_resorte_2', 'Muelle Tenso', 0, 24, 0, [{ t: 'energy', v: 1 }]);
  card('pie_resorte_3', 'Salto Mortal', 2, 40, 4,
    [{ t: 'dmg', v: 8 }, { t: 'energy', v: 1 }],
    'Sube, cae y aplasta.');

  limb('pie_arana', 'Patas de Araña', 'leg', 2, 40, { speed: 0.1, vision: 1 },
    'Ocho agujas de latón que no dejan de tejer.');
  card('pie_arana_1', 'Pinchazos', 1, 10, 0, [{ t: 'dmg', v: 2, n: 3 }]);
  card('pie_arana_2', 'Tejer Red', 1, 10, 0, [{ t: 'block', v: 4 }, { t: 'weak', v: 2 }]);
  card('pie_arana_3', 'Lluvia de Púas', 2, 36, 3,
    [{ t: 'weak', v: 1 }, { t: 'dmg', v: 2, n: 5 }],
    'Mil puntadas en un segundo.');

  limb('pie_pesada', 'Botas de Hierro', 'leg', 2, 50, { block: 1 },
    'Pesan tanto que hasta el suelo se disculpa.');
  card('pie_pesada_1', 'Planta Firme', 1, 8, 0, [{ t: 'block', v: 6 }, { t: 'cool', v: 10 }]);
  card('pie_pesada_2', 'Patada Pesada', 2, 28, 0, [{ t: 'dmg', v: 10 }]);
  card('pie_pesada_3', 'Pisotón Sísmico', 2, 42, 4,
    [{ t: 'dmg', v: 7 }, { t: 'stun' }],
    'Bajo la bota, hasta el tiempo se detiene.');

  /* ---------- Muñones: una carta débil y sin calor por cada hueco vacío ---------- */
  DD.STUMP_CARDS = {
    head:  { id: 'stump_head',  limb: null, name: 'Cabezazo Torpe', cost: 1, heat: 0, wear: 0,
             fx: [{ t: 'dmg', v: 2 }, { t: 'selfdmg', v: 1 }] },
    torso: { id: 'stump_torso', limb: null, name: 'Respirar Hondo', cost: 1, heat: 0, wear: 0,
             fx: [{ t: 'block', v: 2 }] },
    arm:   { id: 'stump_arm',   limb: null, name: 'Golpe de Muñón', cost: 1, heat: 0, wear: 0,
             fx: [{ t: 'dmg', v: 3 }] },
    leg:   { id: 'stump_leg',   limb: null, name: 'Tropiezo', cost: 1, heat: 0, wear: 0,
             fx: [{ t: 'block', v: 3 }] }
  };

  /* ---------- Textos generados desde fx (cortos: la carta es pequeña) ---------- */
  var FX_TEXT = {
    dmg:     function (f) { return 'Daño ' + f.v + ((f.n || 1) > 1 ? ' ×' + f.n : '') + '.'; },
    block:   function (f) { return 'Bloqueo ' + f.v + '.'; },
    heal:    function (f) { return 'Cura ' + f.v + ' PV.'; },
    draw:    function (f) { return 'Roba ' + f.v + (f.v === 1 ? ' carta.' : ' cartas.'); },
    energy:  function (f) { return '+' + f.v + ' energía.'; },
    burn:    function (f) { return 'Quemadura ' + f.v + '.'; },
    vuln:    function (f) { return 'Vulnerable ' + f.v + '.'; },
    weak:    function (f) { return 'Débil ' + f.v + '.'; },
    stun:    function () { return 'Aturde.'; },
    cool:    function (f) { return 'Enfría ' + f.v + (f.all ? ' a todas.' : '.'); },
    repair:  function (f) { return 'Repara ' + f.v + '.'; },
    selfdmg: function (f) { return 'Pierdes ' + f.v + ' PV.'; }
  };
  DD.cardText = function (card) {
    var out = [], fx = (card && card.fx) || [];
    for (var i = 0; i < fx.length; i++) {
      var fn = FX_TEXT[fx[i].t];
      if (fn) out.push(fn(fx[i]));
    }
    return out.join(' ');
  };

  // Pasivas de extremidad en texto claro: devuelve un array de frases cortas ([] si no tiene).
  var PASSIVE_TEXT = [
    ['hp',      function (v) { return '+' + v + ' vida máx.'; }],
    ['energy',  function (v) { return '+' + v + ' de energía'; }],
    ['draw',    function (v) { return '+' + v + (v === 1 ? ' carta en mano' : ' cartas en mano'); }],
    ['cool',    function (v) { return '+' + v + ' enfriamiento/turno'; }],
    ['dmg',     function (v) { return '+' + v + ' daño por golpe'; }],
    ['block',   function (v) { return '+' + v + ' bloqueo por carta'; }],
    ['speed',   function (v) { return '+' + Math.round(v * 100) + '% velocidad'; }],
    ['vision',  function (v) { return '+' + v + ' de visión'; }],
    ['fireRes', function (v) { return '-' + Math.round(v * 100) + '% daño de fuego/ácido'; }]
  ];
  DD.passiveText = function (passive) {
    var out = [];
    for (var i = 0; i < PASSIVE_TEXT.length; i++) {
      var v = passive && passive[PASSIVE_TEXT[i][0]];
      if (v) out.push(PASSIVE_TEXT[i][1](v));
    }
    return out;
  };

  DD.STATUS_INFO = {
    burn: { name: 'Quemadura', desc: 'Daño = cargas al empezar su turno (ignora bloqueo); pierde 1.' },
    vuln: { name: 'Vulnerable', desc: '+50% de daño recibido. Dura N turnos.' },
    weak: { name: 'Débil', desc: '-25% de daño infligido. Dura N turnos.' },
    stun: { name: 'Aturdido', desc: 'Pierde su próxima acción.' }
  };

  /* ---------- Enemigos ---------- */
  // floors = [primer piso, último piso] (0-based, inclusive). speed = factor al explorar; sight = casillas de persecución.
  DD.ENEMIES = {
    sabueso: {
      id: 'sabueso', name: 'Sabueso Cosido', kind: 'monster', floors: [0, 1],
      hp: [24, 30], ether: [4, 8], speed: 1.15, sight: 6, elite: false, dropCount: 1,
      drops: ['cab_sabueso', 'pie_sabueso'],
      moves: [
        { name: 'Zarpazos', t: 'attack', v: 5, n: 2 },
        { name: 'Desgarro', t: 'limb', v: 9 },
        { name: 'Mordisco', t: 'attack', v: 8 },
        { name: 'Aullido', t: 'debuff', status: 'weak', v: 2 }
      ],
      flavor: 'Hecho con tres perros y ningún remordimiento.'
    },
    ayudante: {
      id: 'ayudante', name: 'Ayudante Enloquecido', kind: 'scientist', floors: [0, 1],
      hp: [20, 26], ether: [3, 7], speed: 0.9, sight: 5, elite: false, dropCount: 1,
      drops: ['cab_cosido', 'tor_remendado', 'bra_muerto', 'pie_muerta', 'bra_tijera'],
      moves: [
        { name: 'Bisturí Tembloroso', t: 'attack', v: 6 },
        { name: 'Frasco Hirviente', t: 'heat', v: 35 },
        { name: 'Puñalada Nerviosa', t: 'attack', v: 8 },
        { name: 'Corte de Tendones', t: 'limb', v: 7 }
      ],
      flavor: 'Lleva semanas sin dormir. Tú eres su último experimento.'
    },
    golem: {
      id: 'golem', name: 'Gólem de Retazos', kind: 'monster', floors: [0, 2],
      hp: [34, 42], ether: [5, 8], speed: 0.7, sight: 4, elite: false, dropCount: 1,
      drops: ['bra_golem', 'tor_costillar'],
      moves: [
        { name: 'Endurecerse', t: 'block', v: 8 },
        { name: 'Puñetazo Brutal', t: 'attack', v: 14 },
        { name: 'Retazo Suelto', t: 'limb', v: 10 }
      ],
      flavor: 'Lento como una condena, pesado como una sentencia.'
    },
    alquimista: {
      id: 'alquimista', name: 'Alquimista Corrupto', kind: 'scientist', floors: [1, 2],
      hp: [38, 48], ether: [7, 12], speed: 1.0, sight: 6, elite: false, dropCount: 1,
      drops: ['cab_plaga', 'bra_tentaculo', 'tor_alambique'],
      moves: [
        { name: 'Frasco de Ácido', t: 'debuff', status: 'burn', v: 4 },
        { name: 'Golpe de Retorta', t: 'attack', v: 12 },
        { name: 'Fórmula de Flaqueza', t: 'debuff', status: 'weak', v: 2 },
        { name: 'Elixir Carmesí', t: 'heal', v: 7 }
      ],
      flavor: 'Buscaba la piedra filosofal y encontró el gusto por el dolor.'
    },
    arana: {
      id: 'arana', name: 'Araña de Engranajes', kind: 'monster', floors: [1, 2],
      hp: [38, 48], ether: [6, 11], speed: 1.3, sight: 7, elite: false, dropCount: 1,
      drops: ['pie_arana', 'pie_resorte'],
      moves: [
        { name: 'Picotazos', t: 'attack', v: 5, n: 3 },
        { name: 'Hilo Cortante', t: 'limb', v: 11 },
        { name: 'Veneno Pegajoso', t: 'debuff', status: 'vuln', v: 2 },
        { name: 'Patas Afiladas', t: 'limb', v: 9 }
      ],
      flavor: 'Teje con hilo de latón y espera con paciencia de reloj.'
    },
    cirujano: {
      id: 'cirujano', name: 'Cirujano Demente', kind: 'scientist', floors: [1, 2],
      hp: [40, 50], ether: [8, 12], speed: 0.9, sight: 5, elite: false, dropCount: 1,
      drops: ['bra_tijera', 'bra_sierra'],
      moves: [
        { name: 'Afilar Bisturí', t: 'buff', v: 2 },
        { name: 'Amputación', t: 'limb', v: 16 },
        { name: 'Corte Limpio', t: 'attack', v: 11 },
        { name: 'Tajo Doble', t: 'attack', v: 7, n: 2 }
      ],
      flavor: 'Sonríe tras la máscara mientras cuenta tus piezas.'
    },
    automata: {
      id: 'automata', name: 'Autómata de Latón', kind: 'monster', floors: [1, 2],
      hp: [42, 50], ether: [7, 12], speed: 0.8, sight: 5, elite: false, dropCount: 1,
      drops: ['pie_pesada', 'tor_costillar', 'bra_piston', 'tor_caldera'],
      moves: [
        { name: 'Blindaje de Latón', t: 'block', v: 12 },
        { name: 'Vapor Hirviente', t: 'heat', v: 24, all: true },
        { name: 'Golpe de Pistón', t: 'attack', v: 12 },
        { name: 'Martillazo', t: 'attack', v: 15 }
      ],
      flavor: 'Nadie recuerda quién le dio cuerda por última vez.'
    },
    quimera: {
      id: 'quimera', name: 'Quimera Ardiente', kind: 'monster', floors: [2, 2],
      hp: [60, 70], ether: [10, 15], speed: 1.2, sight: 7, elite: false, dropCount: 1,
      drops: ['cab_quimera', 'tor_caldera'],
      moves: [
        { name: 'Aliento Ígneo', t: 'debuff', status: 'burn', v: 6 },
        { name: 'Llamarada', t: 'heat', v: 30, all: true },
        { name: 'Zarpazo Ardiente', t: 'attack', v: 15 },
        { name: 'Mordisco Triple', t: 'attack', v: 6, n: 3 }
      ],
      flavor: 'Escapó del crisol y ahora quiere que todo arda.'
    },
    relojero: {
      id: 'relojero', name: 'Relojero Fanático', kind: 'scientist', floors: [2, 2],
      hp: [56, 68], ether: [10, 16], speed: 1.0, sight: 6, elite: false, dropCount: 1,
      drops: ['bra_piston', 'pie_resorte', 'cab_relojero'],
      moves: [
        { name: 'Dar Cuerda', t: 'buff', v: 3 },
        { name: 'Engranaje Roto', t: 'limb', v: 13 },
        { name: 'Martillo de Reloj', t: 'attack', v: 14 },
        { name: 'Manecillas', t: 'attack', v: 8, n: 2 }
      ],
      flavor: 'Jura que a medianoche el tiempo se detendrá. Te quiere dentro.'
    },
    vivisector: {
      id: 'vivisector', name: 'Vivisector', kind: 'scientist', floors: [2, 2],
      hp: [80, 85], ether: [14, 16], speed: 1.0, sight: 7, elite: true, dropCount: 2,
      drops: ['bra_sierra', 'bra_tentaculo', 'cab_quimera', 'pie_arana'],
      moves: [
        { name: 'Anestesia', t: 'debuff', status: 'weak', v: 2 },
        { name: 'Extirpar', t: 'limb', v: 16 },
        { name: 'Vivisección', t: 'attack', v: 18 },
        { name: 'Bisturíes Múltiples', t: 'attack', v: 7, n: 3 },
        { name: 'Transfusión', t: 'heal', v: 7 }
      ],
      flavor: 'Ha cosido más cuerpos que nadie. Ninguno seguía vivo.'
    }
  };

  /* ---------- Cuerpos base ---------- */
  DD.BASES = {
    jornalero: {
      id: 'jornalero', name: 'El Jornalero', hpBonus: 0, locked: false, price: 0,
      flavor: 'Un cuerpo corriente. Se nota que lo cosieron con prisa.',
      limbs: { head: 'cab_cosido', torso: 'tor_remendado', armL: 'bra_muerto', armR: 'bra_muerto', legL: 'pie_muerta', legR: 'pie_muerta' }
    },
    vigia: {
      id: 'vigia', name: 'La Vigía', hpBonus: 0, locked: false, price: 0,
      flavor: 'Ve venir todo, salvo el final. Roba tiempo al tiempo.',
      limbs: { head: 'cab_relojero', torso: 'tor_remendado', armL: 'bra_tijera', armR: 'bra_muerto', legL: 'pie_muerta', legR: 'pie_muerta' }
    },
    bruto: {
      id: 'bruto', name: 'El Bruto', hpBonus: 10, locked: false, price: 0,
      flavor: 'Carne de sobra y poca paciencia.',
      limbs: { head: 'cab_cosido', torso: 'tor_costillar', armL: 'bra_golem', armR: 'bra_muerto', legL: 'pie_muerta', legR: 'pie_muerta' }
    },
    saltadora: {
      id: 'saltadora', name: 'La Saltadora', hpBonus: 0, locked: true, price: 120,
      flavor: 'Sus piernas rebotan; el resto intenta seguir el ritmo.',
      limbs: { head: 'cab_sabueso', torso: 'tor_remendado', armL: 'bra_tijera', armR: 'bra_muerto', legL: 'pie_resorte', legR: 'pie_resorte' }
    },
    centinela: {
      id: 'centinela', name: 'El Centinela', hpBonus: 5, locked: true, price: 200,
      flavor: 'Forjado para custodiar la caldera. Ahora custodia tu huida.',
      limbs: { head: 'cab_plaga', torso: 'tor_caldera', armL: 'bra_piston', armR: 'bra_muerto', legL: 'pie_pesada', legR: 'pie_muerta' }
    }
  };
  DD.BASE_ORDER = ['jornalero', 'vigia', 'bruto', 'saltadora', 'centinela'];

  /* ---------- Cosméticos (el primero de cada lista es el de serie) ---------- */
  DD.COSMETICS = {
    skin: [   // c = [base, sombra, luz]
      { id: 'skin_palida',    name: 'Piel Pálida',     price: 0,  c: ['#b9a98c', '#8a7a66', '#d9cdb0'] },
      { id: 'skin_verdigris', name: 'Piel Verdigrís',  price: 40, c: ['#6f9a7a', '#476b57', '#9cc7a0'] },
      { id: 'skin_ceniza',    name: 'Piel de Ceniza',  price: 50, c: ['#8a8a94', '#5a5a66', '#b5b5bf'] },
      { id: 'skin_ascua',     name: 'Piel de Ascua',   price: 70, c: ['#b5562f', '#7a3119', '#e08a4a'] },
      { id: 'skin_medianoche', name: 'Piel de Medianoche', price: 90, c: ['#4f5f86', '#2f3b5c', '#7d8fba'] }
    ],
    stitch: [ // c = [color]
      { id: 'stitch_rojas',   name: 'Puntadas Rojas',   price: 0,  c: ['#a3202a'] },
      { id: 'stitch_doradas', name: 'Puntadas Doradas', price: 50, c: ['#c9a24a'] },
      { id: 'stitch_cian',    name: 'Puntadas Cian',    price: 60, c: ['#7fd6e6'] },
      { id: 'stitch_acido',   name: 'Puntadas Ácidas',  price: 80, c: ['#6fbf3a'] }
    ],
    eyes: [   // c = [color, brillo]
      { id: 'eyes_verdes',  name: 'Ojos Verdes',  price: 0,  c: ['#6fbf3a', '#d6ff9a'] },
      { id: 'eyes_ambar',   name: 'Ojos Ámbar',   price: 40, c: ['#e8a02a', '#ffe39a'] },
      { id: 'eyes_violeta', name: 'Ojos Violeta', price: 50, c: ['#a65fe0', '#e2c2ff'] },
      { id: 'eyes_cian',    name: 'Ojos Cian',    price: 60, c: ['#5fd6e6', '#d0faff'] },
      { id: 'eyes_carmesi', name: 'Ojos Carmesí', price: 90, c: ['#e0453f', '#ffb0a8'] }
    ]
  };

  /* ---------- Pisos (enemies = los que tienen el piso dentro de su rango floors) ---------- */
  DD.FLOORS = [
    { name: 'Sótano de Disección', sub: 'Donde despiertan los cuerpos',
      enemies: ['sabueso', 'ayudante', 'golem'] },
    { name: 'Biblioteca Alquímica', sub: 'Saberes prohibidos arden entre los estantes',
      enemies: ['sabueso', 'ayudante', 'golem', 'alquimista', 'arana', 'cirujano', 'automata'] },
    { name: 'Observatorio del Reloj', sub: 'El corazón de latón late hacia la medianoche',
      enemies: ['golem', 'alquimista', 'arana', 'cirujano', 'automata', 'quimera', 'relojero', 'vivisector'] }
  ];
})();
