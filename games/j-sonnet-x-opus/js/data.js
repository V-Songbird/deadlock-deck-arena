// DD.Data: all game content and tuning (limbs, cards, enemies, items, traps, skins).
(function () {
  window.DD = window.DD || {};

  // ---- Card effect builders (closed effect set, see architecture 5.1) ----
  function dmg(v, hits) { return hits ? { k: 'damage', v: v, hits: hits } : { k: 'damage', v: v }; }
  function blk(v) { return { k: 'block', v: v }; }
  function heal(v) { return { k: 'heal', v: v }; }
  function draw(v) { return { k: 'draw', v: v }; }
  function nrg(v) { return { k: 'energy', v: v }; }
  function onFoe(status, v) { return { k: 'status', status: status, v: v, target: 'enemy' }; }
  function onSelf(status, v) { return { k: 'status', status: status, v: v, target: 'self' }; }
  function cool(v, scope) { return { k: 'cool', v: v, scope: scope || 'self' }; }
  function repair(v, scope) { return { k: 'repair', v: v, scope: scope || 'self' }; }
  function hurt(v) { return { k: 'selfdamage', v: v }; }
  function card(id, name, cost, heat, icon, effects) {
    return { id: id, name: name, cost: cost, heat: heat, icon: icon, effects: effects, text: '' };
  }

  // ---- Blueprints (33, ids fixed by architecture 6.1); cards are inlined and extracted below ----
  var LIMB_LIST = [
    // Heads
    { id: 'head_stitched', type: 'head', name: 'Cabeza Cosida', origin: 'Cadáver del anfiteatro', rarity: 0,
      style: 'flesh', accent: '#c9b98f', integrity: 10, heatMax: 6, cool: 1, passive: { maxHp: 4 },
      desc: 'Equilibrada y aburrida. Nunca falla, nunca sorprende.',
      cards: [card('hs_headbutt', 'Cabezazo', 1, 1, 'skull', [dmg(5)]),
              card('hs_recall', 'Recordar', 1, 0, 'brain', [draw(2)])] },
    { id: 'head_rat', type: 'head', name: 'Cabeza de Rata', origin: 'Ratas de la cloaca', rarity: 0,
      style: 'beast', accent: '#8c1c2b', integrity: 8, heatMax: 4, cool: 1, passive: {},
      desc: 'Cartas baratas y rápidas, pero se rompe pronto.',
      cards: [card('hr_nibble', 'Mordisco', 0, 1, 'sword', [dmg(3)]),
              card('hr_sniff', 'Olfatear', 0, 0, 'eye', [draw(1)])] },
    { id: 'head_ghoul', type: 'head', name: 'Cabeza de Necrófago', origin: 'Necrófago de la cripta', rarity: 0,
      style: 'flesh', accent: '#9be04a', integrity: 10, heatMax: 6, cool: 1, passive: { maxHp: 2 },
      desc: 'Aliento que quema y un hambre que cura.',
      cards: [card('hg_breath', 'Aliento Pútrido', 1, 1, 'flame', [onFoe('burn', 3)]),
              card('hg_gnaw', 'Roer Carroña', 1, 1, 'bone', [dmg(4), heal(2)])] },
    { id: 'head_hound', type: 'head', name: 'Cabeza de Sabueso', origin: 'Sabueso de carne', rarity: 1,
      style: 'beast', accent: '#c8323f', integrity: 10, heatMax: 6, cool: 1, passive: { draw: 1 },
      desc: 'Olfato voraz: robas más cartas cada turno.',
      cards: [card('hh_scent', 'Olfato Voraz', 0, 1, 'eye', [draw(2)]),
              card('hh_fangs', 'Colmillo', 1, 1, 'sword', [dmg(3, 2)])] },
    { id: 'head_homunculus', type: 'head', name: 'Cabeza de Homúnculo', origin: 'Probeta del homúnculo', rarity: 1,
      style: 'chem', accent: '#58c2a0', integrity: 8, heatMax: 5, cool: 1, passive: { coolBonus: 1 },
      desc: 'Cerebro de probeta: energía barata y enfría todo el cuerpo.',
      cards: [card('hm_spark', 'Chispa Mental', 0, 1, 'bolt', [nrg(1)]),
              card('hm_whisper', 'Susurro', 0, 0, 'brain', [draw(1), blk(2)])] },
    { id: 'head_alchemist', type: 'head', name: 'Cabeza de Alquimista', origin: 'Alquimista corrupto', rarity: 1,
      style: 'chem', accent: '#9be04a', integrity: 9, heatMax: 7, cool: 1, passive: { maxHp: 3 },
      desc: 'Nubes de fuego muy calientes; destila el calor del cuerpo.',
      cards: [card('ha_cloud', 'Nube Ígnea', 2, 3, 'flame', [onFoe('burn', 5), dmg(4)]),
              card('ha_distill', 'Destilar', 1, 0, 'snow', [cool(2, 'all'), draw(1)])] },
    { id: 'head_inquisitor', type: 'head', name: 'Cabeza de Inquisidor', origin: 'Inquisidor Rojo', rarity: 2,
      style: 'brass', accent: '#c8323f', integrity: 12, heatMax: 6, cool: 1, passive: { energy: 1 },
      desc: 'Debilita y expone al hereje. Más energía cada turno.',
      cards: [card('hi_accuse', 'Ojo Acusador', 1, 1, 'eye', [onFoe('weak', 2), onFoe('vulnerable', 1)]),
              card('hi_sentence', 'Condena', 2, 3, 'sword', [dmg(10), onFoe('vulnerable', 2)])] },
    { id: 'head_chimera', type: 'head', name: 'Cabeza de Quimera', origin: 'Quimera abrasada', rarity: 2,
      style: 'beast', accent: '#f07a1e', integrity: 9, heatMax: 5, cool: 1, passive: { maxHp: 6 },
      desc: 'Tres bocas hambrientas. Poder bruto que arde rápido.',
      cards: [card('hc_roar', 'Rugido Triple', 1, 1, 'strength', [onSelf('strength', 1)]),
              card('hc_maws', 'Fauces', 2, 3, 'sword', [dmg(7, 2)])] },
    { id: 'head_clockmaker', type: 'head', name: 'Cabeza del Relojero', origin: 'El Relojero Mayor', rarity: 2,
      style: 'brass', accent: '#e0b84a', integrity: 12, heatMax: 6, cool: 1, passive: { draw: 1, coolBonus: 1 },
      desc: 'Detiene el tiempo. Más robo y mejor enfriamiento.',
      cards: [card('hk_stop', 'Detener Tiempo', 2, 3, 'hourglass', [onFoe('stun', 1)]),
              card('hk_calc', 'Cálculo', 0, 1, 'gear', [draw(1), nrg(1)])] },

    // Torsos
    { id: 'torso_stitched', type: 'torso', name: 'Torso Cosido', origin: 'Cadáver del anfiteatro', rarity: 0,
      style: 'flesh', accent: '#c9b98f', integrity: 14, heatMax: 7, cool: 1, passive: { maxHp: 12 },
      desc: 'Mucha vida y cartas honestas.',
      cards: [card('ts_tackle', 'Topetazo', 1, 1, 'fist', [dmg(6)]),
              card('ts_brace', 'Aguantar', 1, 0, 'shield', [blk(6)]),
              card('ts_mend', 'Remendar', 1, 1, 'heart', [blk(3), heal(2)])] },
    { id: 'torso_ghoul', type: 'torso', name: 'Torso de Necrófago', origin: 'Necrófago de la cripta', rarity: 0,
      style: 'flesh', accent: '#9be04a', integrity: 12, heatMax: 6, cool: 1, passive: { maxHp: 8 },
      desc: 'Bilis y entrañas: energía a cambio de sangre.',
      cards: [card('tg_bile', 'Bilis Ácida', 1, 1, 'drop', [dmg(3), onFoe('vulnerable', 1)]),
              card('tg_guts', 'Entrañas', 1, 1, 'bolt', [hurt(2), nrg(2)]),
              card('tg_flesh', 'Carne Blanda', 1, 0, 'shield', [blk(6)])] },
    { id: 'torso_bone', type: 'torso', name: 'Torso Óseo', origin: 'Gólem de huesos', rarity: 1,
      style: 'bone', accent: '#e8dcc0', integrity: 16, heatMax: 8, cool: 1, passive: { maxHp: 10, startBlock: 3 },
      desc: 'Costillas como coraza. Bloqueo y aguante.',
      cards: [card('tb_ribs', 'Costilla', 1, 0, 'shield', [blk(7)]),
              card('tb_shard', 'Esquirla', 1, 1, 'bone', [dmg(5), blk(3)]),
              card('tb_carapace', 'Coraza Ósea', 2, 2, 'shield', [blk(14)])] },
    { id: 'torso_gargoyle', type: 'torso', name: 'Torso de Gárgola', origin: 'Gárgola de hollín', rarity: 1,
      style: 'stone', accent: '#5b4d6b', integrity: 16, heatMax: 9, cool: 1, passive: { maxHp: 14 },
      desc: 'Piedra lenta: bloqueos enormes y un golpe demoledor.',
      cards: [card('tq_skin', 'Piel de Piedra', 2, 1, 'shield', [blk(13)]),
              card('tq_crush', 'Aplastar', 3, 3, 'fist', [dmg(22)]),
              card('tq_still', 'Inmóvil', 1, 0, 'lock', [blk(6)])] },
    { id: 'torso_boiler', type: 'torso', name: 'Torso Caldera', origin: 'Ingeniero de vapor', rarity: 1,
      style: 'brass', accent: '#f07a1e', integrity: 12, heatMax: 7, cool: 1, passive: { energy: 1, maxHp: 4 },
      desc: 'Caldera viva: más energía, poca vida, mucho calor.',
      cards: [card('tr_pressure', 'Presión', 0, 1, 'bolt', [nrg(1)]),
              card('tr_blast', 'Vapor Ardiente', 2, 3, 'flame', [dmg(14)]),
              card('tr_purge', 'Purgar Válvula', 1, 0, 'snow', [cool(1, 'all'), blk(4)])] },
    { id: 'torso_chimera', type: 'torso', name: 'Torso de Quimera', origin: 'Quimera abrasada', rarity: 2,
      style: 'beast', accent: '#f07a1e', integrity: 12, heatMax: 5, cool: 1, passive: { maxHp: 10 },
      desc: 'Daño brutal que se sobrecalienta en dos turnos.',
      cards: [card('tc_triple', 'Zarpazo Triple', 3, 4, 'sword', [dmg(9, 3)]),
              card('tc_frenzy', 'Frenesí', 1, 1, 'fist', [dmg(5, 2), hurt(2)]),
              card('tc_fur', 'Pelaje Espeso', 1, 1, 'shield', [blk(7)])] },
    { id: 'torso_clockwork', type: 'torso', name: 'Torso de Relojería', origin: 'El Relojero Mayor', rarity: 2,
      style: 'brass', accent: '#e0b84a', integrity: 14, heatMax: 7, cool: 2, passive: { energy: 1, maxHp: 6 },
      desc: 'Engranajes precisos: energía, robo y aturdimiento.',
      cards: [card('tk_spring', 'Resorte', 1, 1, 'gear', [dmg(5), draw(1)]),
              card('tk_coolant', 'Aceite Frío', 1, 0, 'snow', [cool(2, 'all'), blk(4)]),
              card('tk_pendulum', 'Péndulo Maestro', 3, 3, 'stun', [onFoe('stun', 1), blk(8)])] },

    // Arms
    { id: 'arm_stitched', type: 'arm', name: 'Brazo Cosido', origin: 'Cadáver del anfiteatro', rarity: 0,
      style: 'flesh', accent: '#c9b98f', integrity: 12, heatMax: 6, cool: 1, passive: {},
      desc: 'Un puño y una guardia. Fiable.',
      cards: [card('as_punch', 'Puñetazo', 1, 1, 'fist', [dmg(6)]),
              card('as_guard', 'Guardia', 1, 0, 'shield', [blk(5)])] },
    { id: 'arm_ghoul', type: 'arm', name: 'Brazo de Necrófago', origin: 'Necrófago de la cripta', rarity: 0,
      style: 'flesh', accent: '#9be04a', integrity: 10, heatMax: 5, cool: 1, passive: {},
      desc: 'Garras infectas; desgarra a costa de tu carne.',
      cards: [card('ag_claw', 'Garra Infecta', 1, 1, 'sword', [dmg(4), onFoe('vulnerable', 1)]),
              card('ag_rend', 'Desgarro', 2, 2, 'sword', [dmg(12), hurt(2)])] },
    { id: 'arm_bone', type: 'arm', name: 'Brazo Óseo', origin: 'Gólem de huesos', rarity: 1,
      style: 'bone', accent: '#e8dcc0', integrity: 16, heatMax: 7, cool: 1, passive: {},
      desc: 'Duro como un fémur: golpea y protege.',
      cards: [card('ab_femur', 'Fémur', 2, 2, 'bone', [dmg(9), blk(6)]),
              card('ab_shield', 'Escudo Óseo', 1, 0, 'shield', [blk(7)])] },
    { id: 'arm_gargoyle', type: 'arm', name: 'Brazo de Gárgola', origin: 'Gárgola de hollín', rarity: 1,
      style: 'stone', accent: '#5b4d6b', integrity: 15, heatMax: 9, cool: 1, passive: {},
      desc: 'Lento y pesado; casi no se calienta.',
      cards: [card('aq_fist', 'Puño de Piedra', 3, 3, 'fist', [dmg(24)]),
              card('aq_wall', 'Muro', 2, 1, 'shield', [blk(14)])] },
    { id: 'arm_alchemist', type: 'arm', name: 'Brazo de Alquimista', origin: 'Alquimista corrupto', rarity: 1,
      style: 'chem', accent: '#9be04a', integrity: 10, heatMax: 7, cool: 2, passive: {},
      desc: 'Frascos ígneos; se enfría el doble de rápido.',
      cards: [card('aa_flask', 'Frasco Ígneo', 2, 3, 'flame', [dmg(8), onFoe('burn', 4)]),
              card('aa_salts', 'Sal Volátil', 0, 0, 'snow', [cool(1, 'all'), blk(2)])] },
    { id: 'arm_surgeon', type: 'arm', name: 'Brazo de Cirujano', origin: 'Cirujano desquiciado', rarity: 1,
      style: 'chem', accent: '#7fb8d6', integrity: 11, heatMax: 6, cool: 1, passive: {},
      desc: 'Bisturí preciso y cirugía sobre ti mismo.',
      cards: [card('au_scalpel', 'Bisturí', 0, 1, 'sword', [dmg(4)]),
              card('au_surgery', 'Coserse', 1, 1, 'wrench', [hurt(2), repair(2, 'all')])] },
    { id: 'arm_piston', type: 'arm', name: 'Brazo Pistón', origin: 'Ingeniero de vapor', rarity: 1,
      style: 'brass', accent: '#a4532c', integrity: 12, heatMax: 6, cool: 1, passive: {},
      desc: 'Golpes de vapor devastadores. Se funde rápido.',
      cards: [card('ap_piston', 'Pistón', 2, 3, 'fist', [dmg(15)]),
              card('ap_hammer', 'Pilón', 3, 4, 'fist', [dmg(27)])] },
    { id: 'arm_clockwork', type: 'arm', name: 'Brazo de Relojería', origin: 'Araña de relojería', rarity: 1,
      style: 'brass', accent: '#e0b84a', integrity: 12, heatMax: 7, cool: 2, passive: {},
      desc: 'Golpes rítmicos y engranes que disipan calor.',
      cards: [card('ak_ticktock', 'Tic-Tac', 1, 1, 'gear', [dmg(3, 2), draw(1)]),
              card('ak_mesh', 'Engranar', 1, 0, 'snow', [blk(4), cool(1, 'all')])] },
    { id: 'arm_chimera', type: 'arm', name: 'Brazo de Quimera', origin: 'Quimera abrasada', rarity: 2,
      style: 'beast', accent: '#f07a1e', integrity: 11, heatMax: 5, cool: 1, passive: {},
      desc: 'El mayor daño bruto, al borde del colapso.',
      cards: [card('ac_claw', 'Garra Bestial', 1, 1, 'sword', [dmg(9)]),
              card('ac_gut', 'Desollar', 3, 4, 'sword', [dmg(14, 2)])] },
    { id: 'arm_inquisitor', type: 'arm', name: 'Brazo de Inquisidor', origin: 'Inquisidor Rojo', rarity: 2,
      style: 'brass', accent: '#c8323f', integrity: 13, heatMax: 7, cool: 1, passive: {},
      desc: 'Marca al hereje y aplástalo.',
      cards: [card('ai_brand', 'Marca Hereje', 1, 1, 'vulnerable', [dmg(4), onFoe('vulnerable', 2)]),
              card('ai_hammer', 'Martillo Santo', 2, 2, 'fist', [dmg(12), onFoe('weak', 1)])] },

    // Legs
    { id: 'leg_stitched', type: 'leg', name: 'Pierna Cosida', origin: 'Cadáver del anfiteatro', rarity: 0,
      style: 'flesh', accent: '#c9b98f', integrity: 12, heatMax: 6, cool: 1, passive: {},
      desc: 'Patada y paso atrás. Paso normal.',
      cards: [card('ls_kick', 'Patada', 1, 1, 'boot', [dmg(5)]),
              card('ls_step', 'Paso Atrás', 0, 0, 'shield', [blk(3)])] },
    { id: 'leg_rat', type: 'leg', name: 'Pata de Rata', origin: 'Ratas de la cloaca', rarity: 0,
      style: 'beast', accent: '#8c1c2b', integrity: 8, heatMax: 4, cool: 1, passive: { speed: 0.15 },
      desc: 'Rápida y barata, pero frágil.',
      cards: [card('lr_scurry', 'Huida', 0, 0, 'shield', [blk(3)]),
              card('lr_trip', 'Traspié', 0, 1, 'weak', [dmg(2), onFoe('weak', 1)])] },
    { id: 'leg_ghoul', type: 'leg', name: 'Pierna de Necrófago', origin: 'Necrófago de la cripta', rarity: 0,
      style: 'flesh', accent: '#9be04a', integrity: 10, heatMax: 6, cool: 1, passive: { speed: 0.05 },
      desc: 'Pisotón podrido que quema.',
      cards: [card('lg_stomp', 'Pisotón Podrido', 1, 1, 'boot', [dmg(4), onFoe('burn', 2)]),
              card('lg_crawl', 'Reptar', 1, 0, 'shield', [blk(5)])] },
    { id: 'leg_hound', type: 'leg', name: 'Pata de Sabueso', origin: 'Sabueso de carne', rarity: 1,
      style: 'beast', accent: '#c8323f', integrity: 10, heatMax: 6, cool: 1, passive: { speed: 0.2 },
      desc: 'Muy veloz; salta y roba cartas.',
      cards: [card('lh_leap', 'Salto Feroz', 1, 1, 'boot', [dmg(5), draw(1)]),
              card('lh_bound', 'Brinco', 1, 0, 'arrow', [blk(4), draw(1)])] },
    { id: 'leg_spider', type: 'leg', name: 'Pata de Araña', origin: 'Araña de relojería', rarity: 1,
      style: 'brass', accent: '#b8892e', integrity: 12, heatMax: 7, cool: 1, passive: { speed: 0.1 },
      desc: 'Patas de alambre que enredan y debilitan.',
      cards: [card('lp_skitter', 'Correteo', 1, 0, 'shield', [blk(6)]),
              card('lp_web', 'Red de Alambre', 1, 1, 'weak', [dmg(2), onFoe('weak', 2)])] },
    { id: 'leg_steam', type: 'leg', name: 'Pierna de Vapor', origin: 'Ingeniero de vapor', rarity: 1,
      style: 'brass', accent: '#a4532c', integrity: 11, heatMax: 6, cool: 1, passive: { speed: 0.1 },
      desc: 'Coz de vapor feroz; se recalienta.',
      cards: [card('lv_kick', 'Coz de Vapor', 2, 3, 'boot', [dmg(14)]),
              card('lv_blind', 'Chorro Cegador', 1, 1, 'weak', [blk(5), onFoe('weak', 1)])] },
    { id: 'leg_clockwork', type: 'leg', name: 'Pierna de Relojería', origin: 'El Relojero Mayor', rarity: 2,
      style: 'brass', accent: '#e0b84a', integrity: 13, heatMax: 7, cool: 2, passive: { speed: 0.2 },
      desc: 'Paso exacto y veloz; se enfría rápido.',
      cards: [card('lk_kick', 'Patada Horaria', 1, 1, 'boot', [dmg(6), draw(1)]),
              card('lk_step', 'Paso Exacto', 0, 0, 'hourglass', [blk(3), draw(1)])] }
  ];

  var STUMP_CARDS = [
    card('stump_head', 'Muñón Craneal', 1, 0, 'broken', [dmg(2)]),
    card('stump_torso', 'Tronco Vacío', 1, 0, 'broken', [blk(2)]),
    card('stump_arm', 'Golpe de Muñón', 1, 0, 'broken', [dmg(3)]),
    card('stump_leg', 'Muñón Cojo', 1, 0, 'broken', [blk(3)])
  ];

  var LIMBS = {};
  var CARDS = {};
  LIMB_LIST.forEach(function (bp) {
    bp.cards = bp.cards.map(function (c) { CARDS[c.id] = c; return c.id; });
    LIMBS[bp.id] = bp;
  });
  STUMP_CARDS.forEach(function (c) { CARDS[c.id] = c; });

  // ---- Enemies (13, ids fixed by architecture 6.2) ----
  function toPlayer(status, v) { return { status: status, v: v, target: 'player' }; }
  function toSelf(status, v) { return { status: status, v: v, target: 'self' }; }

  var ENEMY_LIST = [
    { id: 'rat_swarm', name: 'Enjambre de Ratas', kind: 'monster', hp: 18, floors: [0, 2], weight: 3,
      speed: 50, sense: 5, pattern: 'random', essence: 3,
      flavor: 'Cien dientes y una sola hambre.',
      moves: [{ name: 'Mordiscos', intent: 'attack', dmg: 3, hits: 2 },
              { name: 'Roer', intent: 'attack', dmg: 5 },
              { name: 'Chillido', intent: 'debuff', status: toPlayer('weak', 1) },
              { name: 'Amontonarse', intent: 'defend', block: 5 }],
      drops: [{ limb: 'head_rat', chance: 0.6 }, { limb: 'leg_rat', chance: 0.6 }] },
    { id: 'ghoul', name: 'Necrófago', kind: 'monster', hp: 30, floors: [0, 2], weight: 3,
      speed: 35, sense: 5, pattern: 'cycle', essence: 4,
      flavor: 'Huele a cripta abierta y a hambre vieja.',
      moves: [{ name: 'Zarpazo', intent: 'attack', dmg: 7 },
              { name: 'Vómito Bilioso', intent: 'debuff', status: toPlayer('burn', 3) },
              { name: 'Devorar', intent: 'attack', dmg: 5, block: 4 },
              { name: 'Carne Muerta', intent: 'defend', block: 8 }],
      drops: [{ limb: 'head_ghoul', chance: 0.5 }, { limb: 'arm_ghoul', chance: 0.5 },
              { limb: 'torso_ghoul', chance: 0.5 }, { limb: 'leg_ghoul', chance: 0.5 }] },
    { id: 'flesh_hound', name: 'Sabueso de Carne', kind: 'monster', hp: 24, floors: [0, 2], weight: 3,
      speed: 62, sense: 7, pattern: 'random', essence: 4,
      flavor: 'Cosido con tres perros. Ninguno recuerda a su amo.',
      moves: [{ name: 'Mordida', intent: 'attack', dmg: 6 },
              { name: 'Dentellada Doble', intent: 'attack', dmg: 4, hits: 2 },
              { name: 'Aullido', intent: 'buff', status: toSelf('strength', 1) },
              { name: 'Acechar', intent: 'defend', block: 6 }],
      drops: [{ limb: 'head_hound', chance: 0.6 }, { limb: 'leg_hound', chance: 0.6 }] },
    { id: 'homunculus', name: 'Homúnculo', kind: 'monster', hp: 18, floors: [0, 1], weight: 2,
      speed: 40, sense: 4, pattern: 'cycle', essence: 4,
      flavor: 'Un niño de probeta que chilla en latín.',
      moves: [{ name: 'Chispa', intent: 'attack', dmg: 4 },
              { name: 'Burbujeo', intent: 'heat', heat: 2 },
              { name: 'Grito Mental', intent: 'debuff', status: toPlayer('weak', 2) },
              { name: 'Arañar', intent: 'attack', dmg: 3, hits: 2 }],
      drops: [{ limb: 'head_homunculus', chance: 0.7 }] },
    { id: 'clockwork_spider', name: 'Araña de Relojería', kind: 'monster', hp: 28, floors: [1, 2], weight: 3,
      speed: 55, sense: 6, pattern: 'cycle', essence: 5,
      flavor: 'Tic, tac, ocho patas. Nunca se detiene.',
      moves: [{ name: 'Aguijón', intent: 'attack', dmg: 4, hits: 2 },
              { name: 'Tejer Alambre', intent: 'debuff', block: 4, status: toPlayer('weak', 2) },
              { name: 'Picadura', intent: 'attack', dmg: 8 },
              { name: 'Enroscarse', intent: 'defend', block: 8 }],
      drops: [{ limb: 'leg_spider', chance: 0.6 }, { limb: 'arm_clockwork', chance: 0.5 }] },
    { id: 'bone_golem', name: 'Gólem de Huesos', kind: 'monster', hp: 40, floors: [1, 2], weight: 2,
      speed: 25, sense: 4, pattern: 'cycle', essence: 6,
      flavor: 'Mil huesos que nadie reclamó, unidos por rencor.',
      moves: [{ name: 'Armadura Ósea', intent: 'defend', block: 10 },
              { name: 'Golpe Óseo', intent: 'attack', dmg: 9 },
              { name: 'Lluvia de Esquirlas', intent: 'attack', dmg: 3, hits: 3 },
              { name: 'Crujido', intent: 'buff', block: 4, status: toSelf('strength', 2) }],
      drops: [{ limb: 'torso_bone', chance: 0.6 }, { limb: 'arm_bone', chance: 0.6 }] },
    { id: 'gargoyle', name: 'Gárgola de Hollín', kind: 'monster', hp: 36, floors: [1, 2], weight: 2,
      speed: 30, sense: 5, pattern: 'cycle', essence: 6,
      flavor: 'Bajó del campanario cuando empezó el incendio.',
      moves: [{ name: 'Piel de Hollín', intent: 'defend', block: 12 },
              { name: 'Garras de Piedra', intent: 'attack', dmg: 8 },
              { name: 'Aliento de Ceniza', intent: 'heat', heat: 2, status: toPlayer('burn', 2) },
              { name: 'Picado', intent: 'attack', dmg: 5, hits: 2 }],
      drops: [{ limb: 'torso_gargoyle', chance: 0.6 }, { limb: 'arm_gargoyle', chance: 0.6 }] },
    { id: 'alchemist', name: 'Alquimista Corrupto', kind: 'scientist', hp: 28, floors: [0, 2], weight: 2,
      speed: 40, sense: 6, pattern: 'cycle', essence: 5,
      flavor: 'Buscaba oro. Encontró algo que arde mejor.',
      moves: [{ name: 'Frasco Ígneo', intent: 'attack', dmg: 5, status: toPlayer('burn', 2) },
              { name: 'Catalizar', intent: 'heat', heat: 3 },
              { name: 'Piel Transmutada', intent: 'defend', block: 8 },
              { name: 'Ácido Corrosivo', intent: 'debuff', dmg: 3, status: toPlayer('vulnerable', 2) }],
      drops: [{ limb: 'head_alchemist', chance: 0.6 }, { limb: 'arm_alchemist', chance: 0.6 }] },
    { id: 'surgeon', name: 'Cirujano Desquiciado', kind: 'scientist', hp: 30, floors: [0, 2], weight: 2,
      speed: 45, sense: 6, pattern: 'cycle', essence: 5,
      flavor: 'Quiere terminar su obra maestra: tú.',
      moves: [{ name: 'Bisturí', intent: 'attack', dmg: 4, hits: 2 },
              { name: 'Anestesia', intent: 'debuff', status: toPlayer('weak', 2) },
              { name: 'Cauterizar', intent: 'heat', dmg: 4, heat: 2 },
              { name: 'Amputar', intent: 'attack', dmg: 9 }],
      drops: [{ limb: 'arm_surgeon', chance: 0.6 }, { limb: 'head_stitched', chance: 0.5 },
              { limb: 'torso_stitched', chance: 0.5 }, { limb: 'arm_stitched', chance: 0.5 },
              { limb: 'leg_stitched', chance: 0.5 }] },
    { id: 'engineer', name: 'Ingeniero de Vapor', kind: 'scientist', hp: 34, floors: [1, 2], weight: 2,
      speed: 35, sense: 6, pattern: 'cycle', essence: 6,
      flavor: 'Mantiene las calderas de la torre... y las sobrecarga.',
      moves: [{ name: 'Llave Inglesa', intent: 'attack', dmg: 7 },
              { name: 'Chorro de Vapor', intent: 'heat', dmg: 3, heat: 3 },
              { name: 'Sobrepresión', intent: 'buff', status: toSelf('strength', 2) },
              { name: 'Blindaje', intent: 'defend', block: 10 },
              { name: 'Martillo Pilón', intent: 'attack', dmg: 9 }],
      drops: [{ limb: 'leg_steam', chance: 0.6 }, { limb: 'arm_piston', chance: 0.5 },
              { limb: 'torso_boiler', chance: 0.5 }] },
    { id: 'chimera', name: 'Quimera Abrasada', kind: 'elite', hp: 58, floors: [1, 2], weight: 1,
      speed: 45, sense: 6, pattern: 'cycle', essence: 12,
      flavor: 'León, cabra y serpiente, y las tres están ardiendo.',
      moves: [{ name: 'Rugido Triple', intent: 'buff', block: 6, status: toSelf('strength', 2) },
              { name: 'Tres Fauces', intent: 'attack', dmg: 5, hits: 3 },
              { name: 'Aliento Ígneo', intent: 'heat', heat: 3, status: toPlayer('burn', 3) },
              { name: 'Embestida', intent: 'attack', dmg: 12 },
              { name: 'Lamer Heridas', intent: 'defend', block: 12 }],
      drops: [{ limb: 'head_chimera', chance: 0.7 }, { limb: 'torso_chimera', chance: 0.6 },
              { limb: 'arm_chimera', chance: 0.6 }] },
    { id: 'inquisitor', name: 'Inquisidor Rojo', kind: 'elite', hp: 52, floors: [1, 2], weight: 1,
      speed: 40, sense: 7, pattern: 'cycle', essence: 12,
      flavor: 'Vino a quemar al alquimista. Ahora quema lo que sea.',
      moves: [{ name: 'Acusación', intent: 'debuff', status: toPlayer('vulnerable', 2) },
              { name: 'Martillo del Juicio', intent: 'attack', dmg: 12 },
              { name: 'Hoguera', intent: 'heat', heat: 2, status: toPlayer('burn', 3) },
              { name: 'Penitencia', intent: 'debuff', dmg: 6, status: toPlayer('weak', 2) },
              { name: 'Fe Férrea', intent: 'buff', block: 10, status: toSelf('strength', 1) }],
      drops: [{ limb: 'head_inquisitor', chance: 0.7 }, { limb: 'arm_inquisitor', chance: 0.7 }] },
    { id: 'clockmaker', name: 'El Relojero Mayor', kind: 'boss', hp: 100, floors: [2, 2], weight: 0,
      speed: 0, sense: 0, pattern: 'cycle', essence: 25,
      flavor: 'Construyó la torre como un reloj. Tú eres su último engranaje.',
      moves: [{ name: 'Manecillas', intent: 'attack', dmg: 5, hits: 2 },
              { name: 'Péndulo Hipnótico', intent: 'debuff', dmg: 6, status: toPlayer('weak', 2) },
              { name: 'Sobrecalentar', intent: 'heat', heat: 4, status: toPlayer('burn', 2) },
              { name: 'Campanada', intent: 'attack', dmg: 16 },
              { name: 'Cuerda Maestra', intent: 'buff', block: 10, status: toSelf('strength', 2) }],
      drops: [{ limb: 'head_clockmaker', chance: 1 }, { limb: 'torso_clockwork', chance: 1 },
              { limb: 'leg_clockwork', chance: 1 }, { limb: 'arm_clockwork', chance: 1 }] }
  ];

  var ENEMIES = {};
  ENEMY_LIST.forEach(function (e) { ENEMIES[e.id] = e; });

  var STATUS = {
    burn: { name: 'Quemadura', icon: 'flame', text: 'Pierde vida al inicio de su turno, ignora el bloqueo; baja 1.' },
    weak: { name: 'Débil', icon: 'weak', text: 'Inflige 25% menos daño.' },
    vulnerable: { name: 'Vulnerable', icon: 'vulnerable', text: 'Recibe 50% más daño.' },
    stun: { name: 'Aturdido', icon: 'stun', text: 'Pierde su próxima acción.' },
    strength: { name: 'Fuerza', icon: 'strength', text: '+1 de daño por golpe por cada punto.' }
  };
  // Short status words for card text (cards fit ~8 characters per line).
  var STATUS_WORD = { burn: 'Quemar', weak: 'Débil', vulnerable: 'Vuln.', stun: 'Aturdir', strength: 'Fuerza' };

  var PASSIVE_LABEL = { maxHp: 'Vida máx.', energy: 'Energía', draw: 'Robo', speed: 'Velocidad',
                        startBlock: 'Bloqueo inicial', coolBonus: 'Enfriamiento' };

  function signed(n) { return (n >= 0 ? '+' : '') + n; }

  function effectText(e) {
    switch (e.k) {
      case 'damage': return 'Daño ' + e.v + (e.hits > 1 ? 'x' + e.hits : '') + '.';
      case 'block': return 'Bloq ' + e.v + '.';
      case 'heal': return 'Cura ' + e.v + '.';
      case 'draw': return 'Roba ' + e.v + '.';
      case 'energy': return '+' + e.v + ' Energía.';
      case 'status': return e.target === 'self'
        ? 'Ganas ' + e.v + ' ' + STATUS_WORD[e.status] + '.'
        : STATUS_WORD[e.status] + ' ' + e.v + '.';
      case 'cool': return (e.scope === 'all' ? 'Enfría todo ' : 'Enfría ') + e.v + '.';
      case 'repair': return (e.scope === 'all' ? 'Repara todo ' : 'Repara ') + e.v + '.';
      case 'selfdamage': return 'Pierdes ' + e.v + ' PV.';
    }
    return '';
  }

  function cardText(c) { return c.effects.map(effectText).join(' '); }
  Object.keys(CARDS).forEach(function (id) { CARDS[id].text = cardText(CARDS[id]); });

  window.DD.Data = {
    CONST: { RUN_SECONDS: 360, FLOORS: 3, TILE: 16, BASE_HP: 20, BASE_ENERGY: 3, BASE_DRAW: 5,
             SHIFT_EVERY: 35, PRINT_COST: [0, 8, 20], ESCAPE_BONUS: 25 },
    SLOTS: ['head', 'torso', 'armL', 'armR', 'legL', 'legR'],
    SLOT_TYPE: { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' },
    SLOT_NAME: { head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.', legL: 'Pierna izq.', legR: 'Pierna der.' },
    TYPE_NAME: { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' },
    TILE: { WALL: 0, FLOOR: 1, STAIRS_DOWN: 2, STAIRS_UP: 3, EXIT: 4 },
    FLOOR_NAME: ['Laboratorio', 'Galería de Engranajes', 'Vestíbulo en Llamas'],
    RARITY: [{ name: 'Común', color: 'bone' }, { name: 'Raro', color: 'verdi2' }, { name: 'Épico', color: 'flame2' }],
    STATUS: STATUS,
    PASSIVE_LABEL: PASSIVE_LABEL,
    LIMBS: LIMBS,
    CARDS: CARDS,
    ENEMIES: ENEMIES,
    ITEMS: {
      elixir: { name: 'Elixir Vital', text: 'Recupera 10 de vida.', icon: 'heart' },
      thread: { name: 'Hilo de Sutura', text: '+2 de integridad a cada extremidad.', icon: 'wrench' },
      gear: { name: 'Engranaje Temporal', text: '+12 s al reloj.', icon: 'hourglass' },
      essence: { name: 'Esencia', text: '+5 de esencia.', icon: 'essence' },
      blueprint: { name: 'Plano Anatómico', text: 'Descubre un plano anatómico nuevo.', icon: 'scroll' }
    },
    TRAPS: {
      spikes: { name: 'Púas', text: 'Suben y bajan cada 3 s. 4 de daño.' },
      steam: { name: 'Vapor', text: 'Chorro periódico: 2 de daño y 3 de calor.' }
    },
    SKINS: {
      classic: { name: 'Clásica', cost: 0, colors: { skin: '#b07a6a', skinDark: '#7d4f52', stitch: '#1a1424', eye: '#ffc23a' } },
      verdigris: { name: 'Cardenillo', cost: 15, colors: { skin: '#58a88f', skinDark: '#2f6d5d', stitch: '#0d0a12', eye: '#9be04a' } },
      ash: { name: 'Ceniza', cost: 20, colors: { skin: '#8d8594', skinDark: '#5b4d6b', stitch: '#1a1424', eye: '#7fb8d6' } },
      brass: { name: 'Latón', cost: 30, colors: { skin: '#c9a04a', skinDark: '#8a6424', stitch: '#3d3149', eye: '#f07a1e' } },
      crimson: { name: 'Carmesí', cost: 40, colors: { skin: '#b8424a', skinDark: '#7a1f2b', stitch: '#e8dcc0', eye: '#ffc23a' } }
    },
    STUMP_CARD: { head: 'stump_head', torso: 'stump_torso', arm: 'stump_arm', leg: 'stump_leg' },

    limbsOfType: function (type) {
      return LIMB_LIST.filter(function (bp) { return bp.type === type; });
    },
    commonLimbs: function (type) {
      return LIMB_LIST.filter(function (bp) { return bp.type === type && bp.rarity === 0; });
    },
    cardsOfLimb: function (bpId) {
      return LIMBS[bpId].cards.map(function (id) { return CARDS[id]; });
    },
    describePassive: function (bp) {
      var p = bp.passive || {};
      return Object.keys(PASSIVE_LABEL).filter(function (k) { return p[k]; }).map(function (k) {
        var v = k === 'speed' ? signed(Math.round(p[k] * 100)) + '%' : signed(p[k]);
        return v + ' ' + PASSIVE_LABEL[k];
      }).join(', ');
    },
    cardText: cardText,
    describeMove: function (m) {
      var parts = [];
      if (m.dmg) parts.push('Ataca ' + m.dmg + (m.hits > 1 ? 'x' + m.hits : ''));
      if (m.block) parts.push('Bloquea ' + m.block);
      if (m.status) {
        var name = STATUS[m.status.status].name;
        parts.push(m.status.target === 'self' ? name + ' +' + m.status.v : name + ' ' + m.status.v);
      }
      if (m.heat) parts.push('Calor +' + m.heat);
      return parts.join(', ');
    }
  };
})();
