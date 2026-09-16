// Deadlock Deck: El Reloj Anatómico — static game data (DD.data).
// Limbs (anatomical blueprints), cards, enemies, traps and cosmetic palettes.
// Ids are shared with sprites.js (do not rename). Player-facing text is Spanish.
(function () {
  const cards = {};
  // id, name, cost (energy 0-3), heat (added to the card's limb when played), desc, fx
  const C = (id, name, cost, heat, desc, fx) => { cards[id] = { id, name, cost, heat, desc, fx }; };

  // Stump: the only card of a broken slot.
  C('golpe_munon', 'Golpe de muñón', 1, 0, 'Inflige 3 de daño.', { dmg: 3 });

  // Base heads: small utility.
  C('chispazo', 'Chispazo', 1, 1, 'Inflige 4 de daño.', { dmg: 4 });
  C('mirada_fija', 'Mirada fija', 1, 1, 'Debilita al enemigo 1 turno.', { weak: 1 });
  C('recordar', 'Recordar', 0, 1, 'Roba 1 carta.', { draw: 1 });
  C('cabezazo', 'Cabezazo', 1, 1, 'Inflige 5 de daño.', { dmg: 5 });
  C('cuello_roto', 'Cuello roto', 1, 1, 'Gana 3 de bloqueo y roba 1.', { block: 3, draw: 1 });
  C('lengua_fuera', 'Lengua fuera', 0, 1, 'El enemigo queda vulnerable 1 turno.', { vuln: 1 });
  // Base torsos: block and a little healing.
  C('cubrirse', 'Cubrirse', 1, 1, 'Gana 5 de bloqueo.', { block: 5 });
  C('sutura', 'Sutura', 1, 1, 'Cura 3 PV.', { heal: 3 });
  C('encogerse', 'Encogerse', 1, 1, 'Gana 4 de bloqueo y roba 1.', { block: 4, draw: 1 });
  C('aguante', 'Aguante', 1, 1, 'Gana 3 de bloqueo y cura 2 PV.', { block: 3, heal: 2 });
  // Base arms: plain damage.
  C('golpe_rigido', 'Golpe rígido', 1, 1, 'Inflige 5 de daño.', { dmg: 5 });
  C('zarpazo', 'Zarpazo', 1, 2, 'Inflige 7 de daño.', { dmg: 7 });
  C('palada', 'Palada', 1, 1, 'Inflige 6 de daño.', { dmg: 6 });
  C('paletazo', 'Paletazo', 1, 1, 'Inflige 4 de daño y gana 3 de bloqueo.', { dmg: 4, block: 3 });
  // Base legs: block and mobility.
  C('patada_tiesa', 'Patada tiesa', 1, 1, 'Inflige 4 de daño.', { dmg: 4 });
  C('plantarse', 'Plantarse', 1, 1, 'Gana 4 de bloqueo y enfría esta pierna 1.', { block: 4, cool: 1 });
  C('pirueta', 'Pirueta', 1, 1, 'Gana 3 de bloqueo y roba 2.', { block: 3, draw: 2 });
  C('puntapie', 'Puntapié', 1, 1, 'Inflige 3 de daño y roba 1.', { dmg: 3, draw: 1 });
  C('paso_ligero', 'Paso ligero', 0, 2, 'Gana 1 de energía.', { energy: 1 });

  // Homúnculo: cheap, cold, fast jabs and dodges.
  C('pinchazo', 'Pinchazo', 0, 0, 'Inflige 3 de daño.', { dmg: 3 });
  C('doble_pincho', 'Doble pincho', 1, 1, 'Inflige 3 de daño 2 veces.', { dmg: 3, hits: 2 });
  C('escabullirse', 'Escabullirse', 0, 0, 'Gana 3 de bloqueo.', { block: 3 });
  C('brinco', 'Brinco', 1, 1, 'Gana 4 de bloqueo y 1 de energía.', { block: 4, energy: 1 });
  // Sabueso: bites, sniffing (draw), howls.
  C('mordisco', 'Mordisco', 1, 2, 'Inflige 8 de daño.', { dmg: 8 });
  C('olfatear', 'Olfatear', 1, 1, 'Roba 2 cartas.', { draw: 2 });
  C('aullido', 'Aullido', 1, 1, 'Debilita al enemigo 2 turnos.', { weak: 2 });
  C('embestida', 'Embestida', 1, 1, 'Inflige 5 de daño y roba 1.', { dmg: 5, draw: 1 });
  C('acecho', 'Acecho', 1, 1, 'Gana 5 de bloqueo y roba 1.', { block: 5, draw: 1 });
  // Alquimista: flasks (cooling, healing, vulnerability, fire).
  C('frasco_frio', 'Frasco frío', 1, 0, 'Enfría cada miembro 2.', { coolAll: 2 });
  C('elixir', 'Elixir', 1, 1, 'Cura 5 PV.', { heal: 5 });
  C('reactivo', 'Reactivo', 1, 1, 'El enemigo queda vulnerable 2 turnos.', { vuln: 2 });
  C('frasco_acido', 'Frasco ácido', 1, 2, 'Inflige 5 de daño. Vulnerable 1 turno.', { dmg: 5, vuln: 1 });
  C('fuego_griego', 'Fuego griego', 2, 3, 'Inflige 11 de daño.', { dmg: 11 });
  // Cirujano: multi-hit scalpels, precision (energy), sutures, anaesthesia.
  C('bisturi', 'Bisturí', 1, 2, 'Inflige 3 de daño 3 veces.', { dmg: 3, hits: 3 });
  C('precision', 'Precisión', 0, 1, 'Gana 1 de energía. Vulnerable 1 turno.', { energy: 1, vuln: 1 });
  C('sutura_veloz', 'Sutura veloz', 1, 1, 'Cura 4 PV y gana 3 de bloqueo.', { heal: 4, block: 3 });
  C('diagnostico', 'Diagnóstico', 1, 1, 'Roba 1 y gana 1 de energía.', { draw: 1, energy: 1 });
  C('anestesia', 'Anestesia', 1, 1, 'Enemigo débil y vulnerable 1 turno.', { weak: 1, vuln: 1 });
  // Autómata: piston punches and steam vents (heat management).
  C('piston', 'Pistón', 1, 3, 'Inflige 9 de daño.', { dmg: 9 });
  C('valvula', 'Válvula', 1, 0, 'Inflige 4 de daño y enfría este brazo 3.', { dmg: 4, cool: 3 });
  C('blindaje', 'Blindaje', 1, 2, 'Gana 9 de bloqueo.', { block: 9 });
  C('ventilar', 'Ventilar', 1, 0, 'Gana 3 de bloqueo y enfría todo 2.', { block: 3, coolAll: 2 });
  C('caldera', 'Caldera', 0, 4, 'Gana 2 de energía.', { energy: 2 });
  C('pisoton', 'Pisotón', 1, 3, 'Inflige 8 de daño.', { dmg: 8 });
  C('anclaje', 'Anclaje', 1, 2, 'Gana 7 de bloqueo.', { block: 7 });
  C('purga', 'Purga', 0, 0, 'Enfría esta pierna 3 y roba 1.', { cool: 3, draw: 1 });
  // Gólem: huge numbers, huge heat.
  C('carne_densa', 'Carne densa', 1, 3, 'Gana 10 de bloqueo.', { block: 10 });
  C('regeneracion', 'Regeneración', 2, 3, 'Cura 8 PV.', { heal: 8 });
  C('aplastar', 'Aplastar', 2, 4, 'Inflige 14 de daño.', { dmg: 14 });
  C('manotazo', 'Manotazo', 1, 3, 'Inflige 10 de daño.', { dmg: 10 });
  C('terremoto', 'Terremoto', 2, 4, 'Inflige 9 de daño 2 veces.', { dmg: 9, hits: 2 });
  C('montana', 'Montaña', 1, 3, 'Gana 8 de bloqueo y cura 2 PV.', { block: 8, heal: 2 });
  // Maestro: the best head and torso.
  C('mente_lucida', 'Mente lúcida', 0, 2, 'Gana 1 de energía y roba 1.', { energy: 1, draw: 1 });
  C('transmutar', 'Transmutar', 1, 0, 'Enfría cada miembro 3.', { coolAll: 3 });
  C('maldicion', 'Maldición', 1, 2, 'Enemigo débil y vulnerable 2 turnos.', { weak: 2, vuln: 2 });
  C('egida', 'Égida', 1, 2, 'Gana 12 de bloqueo.', { block: 12 });
  C('panacea', 'Panacea', 2, 1, 'Cura 8 PV y enfría todo 2.', { heal: 8, coolAll: 2 });
  C('piedra_roja', 'Piedra roja', 0, 2, 'Gana 5 de bloqueo y 1 de energía.', { block: 5, energy: 1 });

  const limbs = {};
  // id, name, type, source (enemy id or null for base limbs), maxHeat, hpBonus, cards, desc
  const L = (id, name, type, source, maxHeat, hpBonus, cardIds, desc) => {
    limbs[id] = { id, name, type, base: !source, source, maxHeat, hpBonus, cards: cardIds, desc };
  };
  // Base limbs (dissection table).
  L('cabeza_reanimada', 'Cabeza Reanimada', 'head', null, 8, 0, ['chispazo', 'mirada_fija', 'recordar'], 'Una cabeza cualquiera con la chispa aún tibia.');
  L('cabeza_ahorcado', 'Cabeza de Ahorcado', 'head', null, 8, 0, ['cabezazo', 'cuello_roto', 'lengua_fuera'], 'Cortada de la horca; el cuello nunca sanó bien.');
  L('torso_suturado', 'Torso Suturado', 'torso', null, 8, 3, ['cubrirse', 'cubrirse', 'sutura'], 'Remendado con hilo de tripa. Aguanta.');
  L('torso_mendigo', 'Torso de Mendigo', 'torso', null, 8, 2, ['encogerse', 'encogerse', 'aguante'], 'Flaco y curtido por el frío de la calle.');
  L('brazo_cadaver', 'Brazo de Cadáver', 'arm', null, 8, 0, ['golpe_rigido', 'golpe_rigido', 'zarpazo'], 'Rígido, torpe, pero pega.');
  L('brazo_sepulturero', 'Brazo de Sepulturero', 'arm', null, 8, 0, ['palada', 'palada', 'paletazo'], 'Acostumbrado a cavar y a golpear con la pala.');
  L('pierna_cadaver', 'Pierna de Cadáver', 'leg', null, 8, 0, ['patada_tiesa', 'plantarse', 'plantarse'], 'Se planta bien en el suelo. Poco más.');
  L('pierna_bailarina', 'Pierna de Bailarina', 'leg', null, 8, 0, ['pirueta', 'puntapie', 'paso_ligero'], 'Ligera y ágil; recuerda los pasos.');
  // Harvested limbs (source enemy).
  L('brazo_homunculo', 'Brazo de Homúnculo', 'arm', 'homunculo', 6, 0, ['pinchazo', 'pinchazo', 'doble_pincho'], 'Diminuto y frío: pincha sin calentarse.');
  L('pierna_homunculo', 'Pierna de Homúnculo', 'leg', 'homunculo', 6, 0, ['escabullirse', 'escabullirse', 'brinco'], 'Patas de tarro: esquivas y brincos baratos.');
  L('cabeza_sabueso', 'Cabeza de Sabueso', 'head', 'sabueso', 8, 0, ['mordisco', 'olfatear', 'aullido'], 'Muerde, olfatea cartas y aúlla para debilitar.');
  L('pierna_sabueso', 'Pata de Sabueso', 'leg', 'sabueso', 8, 0, ['embestida', 'embestida', 'acecho'], 'Embiste y acecha: daño y robo.');
  L('cabeza_alquimista', 'Cabeza de Alquimista', 'head', 'alquimista', 9, 0, ['frasco_frio', 'elixir', 'reactivo'], 'Sabe enfriar, curar y envenenar.');
  L('brazo_alquimista', 'Brazo de Alquimista', 'arm', 'alquimista', 9, 0, ['frasco_acido', 'frasco_frio', 'fuego_griego'], 'Lanza frascos: ácido, frío y fuego.');
  L('brazo_cirujano', 'Brazo de Cirujano', 'arm', 'cirujano', 9, 0, ['bisturi', 'bisturi', 'precision'], 'Bisturíes rápidos y cortes precisos.');
  L('torso_cirujano', 'Torso de Cirujano', 'torso', 'cirujano', 9, 4, ['sutura_veloz', 'diagnostico', 'anestesia'], 'Se cose solo y anestesia al rival.');
  L('brazo_automata', 'Brazo de Autómata', 'arm', 'automata', 10, 0, ['piston', 'piston', 'valvula'], 'Pistones de latón: pega fuerte y se calienta.');
  L('torso_automata', 'Torso de Autómata', 'torso', 'automata', 10, 6, ['blindaje', 'ventilar', 'caldera'], 'Caldera blindada con válvulas de vapor.');
  L('pierna_automata', 'Pierna de Autómata', 'leg', 'automata', 10, 0, ['pisoton', 'anclaje', 'purga'], 'Pisotones hidráulicos y purgas de vapor.');
  L('torso_golem', 'Torso de Gólem', 'torso', 'golem', 12, 12, ['carne_densa', 'carne_densa', 'regeneracion'], 'Una montaña de carne que se regenera.');
  L('brazo_golem', 'Brazo de Gólem', 'arm', 'golem', 12, 0, ['aplastar', 'manotazo', 'manotazo'], 'Aplasta. Se calienta muchísimo.');
  L('pierna_golem', 'Pierna de Gólem', 'leg', 'golem', 12, 0, ['terremoto', 'montana', 'montana'], 'Pisotones que hacen temblar la torre.');
  L('cabeza_maestro', 'Cabeza del Maestro', 'head', 'maestro', 10, 0, ['mente_lucida', 'transmutar', 'maldicion'], 'La mente del Maestro: energía, frío y maldiciones.');
  L('torso_maestro', 'Torso del Maestro', 'torso', 'maestro', 10, 8, ['egida', 'panacea', 'piedra_roja'], 'Late con una piedra filosofal.');

  const enemies = {};
  const atk = (dmg, hits) => (hits > 1 ? { type: 'attack', dmg, hits } : { type: 'attack', dmg });
  // id, name, hp, elite, floors (1-based), drops, pattern, desc
  const E = (id, name, hp, elite, floors, drops, pattern, desc) => { enemies[id] = { id, name, hp, elite, floors, drops, pattern, desc }; };
  E('homunculo', 'Homúnculo', 14, false, [1, 2], ['brazo_homunculo', 'pierna_homunculo'],
    [atk(5), atk(3, 2), { type: 'block', amt: 4 }], 'Un engendro de tarro, rápido y rabioso.');
  E('sabueso', 'Sabueso Suturado', 18, false, [1, 2], ['cabeza_sabueso', 'pierna_sabueso'],
    [atk(7), { type: 'weak', turns: 1 }, atk(4, 2)], 'Perro remendado con hilo de cobre. Muerde primero.');
  E('alquimista', 'Alquimista Corrupto', 22, false, [2, 3], ['cabeza_alquimista', 'brazo_alquimista'],
    [{ type: 'heat', amt: 3 }, atk(8), { type: 'heal', amt: 5 }, atk(6)], 'Bebe lo que destila. Sus frascos hierven.');
  E('cirujano', 'Cirujano Demente', 24, false, [2, 3], ['brazo_cirujano', 'torso_cirujano'],
    [atk(3, 3), { type: 'weak', turns: 2 }, atk(10), { type: 'block', amt: 6 }], 'Opera sin anestesia y sin permiso.');
  E('automata', 'Autómata de Latón', 36, true, [2, 3], ['brazo_automata', 'torso_automata', 'pierna_automata'],
    [atk(9), { type: 'heat', amt: 4 }, { type: 'block', amt: 8 }, atk(12)], 'Caldera con piernas. Escupe vapor hirviendo.');
  E('golem', 'Gólem de Carne', 42, true, [2, 3], ['torso_golem', 'brazo_golem', 'pierna_golem'],
    [atk(12), { type: 'block', amt: 8 }, atk(7, 2), { type: 'heal', amt: 6 }], 'Docenas de cuerpos cosidos en uno solo.');
  E('maestro', 'Maestro Alquimista', 55, 'boss', [3], ['cabeza_maestro', 'torso_maestro'],
    [{ type: 'heat', amt: 4 }, atk(10), { type: 'weak', turns: 2 }, atk(14), { type: 'heal', amt: 8 }, { type: 'block', amt: 10 }],
    'El dueño de la torre. Guarda la salida.');

  DD.data = {
    limbs, cards, enemies,
    traps: {
      vapor: { id: 'vapor', name: 'Trampa de vapor', desc: 'Un chorro de vapor calienta una extremidad (+3 calor).' },
      cuchillas: { id: 'cuchillas', name: 'Suelo de cuchillas', desc: 'Cuchillas ocultas te cortan (-6 PV).' },
      reloj: { id: 'reloj', name: 'Reloj saboteado', desc: 'Un engranaje maldito roba tiempo (-20 segundos).' },
      acido: { id: 'acido', name: 'Charco de ácido', desc: 'El ácido corroe todas tus extremidades (+2 calor).' },
    },
    palettes: [
      { id: 'palido', name: 'Pálido', price: 0, unlock: 0 },
      { id: 'verdoso', name: 'Verdoso', price: 0, unlock: 6 },
      { id: 'cobre', name: 'Cobre', price: 25, unlock: 0 },
      { id: 'ebano', name: 'Ébano', price: 50, unlock: 0 },
    ],
    STUMP_CARD: 'golpe_munon',
  };
})();
