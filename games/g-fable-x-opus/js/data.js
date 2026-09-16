// Data: static content catalog (spec sections 4 and 5.3). Pure data, no dependencies on other modules.
window.Data = (function () {
  'use strict';

  var T = I18N.t;   // names and texts are translated once, while the tables are built

  var CONFIG = {
    startTime: 360,
    floors: 3,
    mutateEvery: 30,
    fogRadius: 4,
    handSize: 5,
    energy: 3,
    baseHp: 30,
    harvestOffers: 2,
    endCombatCoolMult: 2
  };

  // ---------------------------------------------------------------- families

  // `desc` is never drawn on any screen (only `name` reaches the codex), so it stays as authored.
  var FAMILIES = [
    { id: 'base', name: T('Cuerpo base'), kind: 'base', desc: 'Carne de cadáver remendada: cartas genéricas, débiles y sin sorpresas.' },
    { id: 'homunculo', name: T('Homúnculo'), kind: 'monstruosidad', desc: 'Criatura menuda y frenética: cartas baratas, golpes múltiples y mucho robo.' },
    { id: 'ghoul', name: T('Ghoul de laboratorio'), kind: 'monstruosidad', desc: 'Bruto putrefacto: daño brutal y carne que rebrota, pero se recalienta enseguida.' },
    { id: 'alquimista', name: T('Alquimista corrupto'), kind: 'cientifico', desc: 'Científico podrido: veneno en cada frasco y vapores que enfrían tus miembros.' },
    { id: 'automata', name: T('Autómata de latón'), kind: 'monstruosidad', desc: 'Relojería de caldera: bloqueo pesadísimo y una sobrecarga que solo su chasis aguanta.' },
    { id: 'cirujano', name: T('Cirujano hereje'), kind: 'cientifico', desc: 'Carnicero de precisión: cortes exactos, transfusiones y energía o cartas de más.' },
    { id: 'quimera', name: T('Quimera'), kind: 'monstruosidad', desc: 'Guardiana de la salida: las cartas más fuertes de la torre, con aturdimiento y curación.' }
  ];

  // ------------------------------------------------------------------- slots

  var SLOTS = ['head', 'torso', 'armL', 'armR', 'legL', 'legR'];

  var SLOT_NAMES = {
    head: T('Cabeza'),
    torso: T('Torso'),
    armL: T('Brazo izq.'),
    armR: T('Brazo der.'),
    legL: T('Pierna izq.'),
    legR: T('Pierna der.')
  };

  // 'armL'/'armR' -> 'arm', 'legL'/'legR' -> 'leg', head/torso unchanged.
  function slotType(slotKey) {
    return (slotKey === 'head' || slotKey === 'torso') ? slotKey : slotKey.slice(0, -1);
  }

  // ------------------------------------------------------------------- cards

  var CARDS = {};

  // Effect literal; `times` is omitted when the effect hits once (Combat defaults it to 1).
  function e(kind, value, times) {
    var fx = { kind: kind };
    if (value !== undefined) fx.value = value;
    if (times !== undefined) fx.times = times;
    return fx;
  }

  function card(id, name, cost, heat, type, text, effects, exhaust) {
    CARDS[id] = {
      id: id,
      name: T(name),
      cost: cost,
      heat: heat,
      type: type,
      text: T(text),
      exhaust: exhaust === true,
      effects: effects
    };
  }

  // base: weak generic cards.
  card('ba_observe', 'Ojo atento', 0, 1, 'skill', 'Roba 1 carta.', [e('draw', 1)]);
  card('ba_breathe', 'Respiro', 0, 0, 'skill', 'Enfría este miembro 2.', [e('cool', 2)]);
  card('ba_stare', 'Mirada vacía', 1, 1, 'skill', 'Debilita 1.', [e('weaken', 1)]);
  card('ba_guard', 'Guardia torpe', 1, 1, 'skill', 'Bloquea 5.', [e('block', 5)]);
  card('ba_brace', 'Aguantar', 0, 1, 'skill', 'Bloquea 3.', [e('block', 3)]);
  card('ba_suture', 'Sutura rápida', 1, 2, 'skill', 'Cúrate 4.', [e('heal', 4)]);
  card('ba_strike', 'Golpe seco', 1, 2, 'attack', '5 de daño.', [e('damage', 5)]);
  card('ba_swing', 'Mandoble torpe', 2, 3, 'attack', '8 de daño.', [e('damage', 8)]);
  card('ba_kick', 'Patada', 1, 2, 'attack', '4 de daño.', [e('damage', 4)]);
  card('ba_dodge', 'Esquiva', 1, 1, 'skill', 'Bloquea 4.', [e('block', 4)]);
  card('ba_flee', 'Escapar', 1, 2, 'skill', 'Huyes del combate.', [e('flee')], true);

  // homunculo: cheap multi-hits, draw and energy; burns its own low maxHeat fast.
  card('ho_swarm', 'Pensamiento enjambre', 1, 1, 'skill', 'Roba 2 cartas.', [e('draw', 2)]);
  card('ho_spark', 'Chispa nerviosa', 0, 2, 'skill', 'Ganas 1 de energía.', [e('energy', 1)]);
  card('ho_shell', 'Caparazón blando', 1, 1, 'skill', 'Bloquea 4.', [e('block', 4)]);
  card('ho_knit', 'Remiendo veloz', 1, 1, 'skill', 'Cúrate 3. Roba 1 carta.', [e('heal', 3), e('draw', 1)]);
  card('ho_claws', 'Garras frenéticas', 1, 2, 'attack', '3 de daño ×2.', [e('damage', 3, 2)]);
  card('ho_nip', 'Dentellada rápida', 0, 2, 'attack', '3 de daño.', [e('damage', 3)]);
  card('ho_kick', 'Patada nerviosa', 0, 2, 'attack', '2 de daño ×2.', [e('damage', 2, 2)]);
  card('ho_skitter', 'Brinco', 0, 1, 'skill', 'Bloquea 3.', [e('block', 3)]);
  card('ho_flee', 'Fuga de alimaña', 1, 2, 'skill', 'Huyes del combate.', [e('flee')], true);

  // ghoul: heavy damage and regeneration, high heat, very slow cooling.
  card('gh_roar', 'Rugido carroñero', 1, 2, 'skill', 'Debilita 2.', [e('weaken', 2)]);
  card('gh_hunger', 'Hambre voraz', 1, 2, 'skill', 'Roba 2 cartas. Pierdes 2 de vida.', [e('draw', 2), e('selfDamage', 2)]);
  card('gh_regen', 'Carne que rebrota', 1, 2, 'skill', 'Cúrate 6.', [e('heal', 6)]);
  card('gh_hide', 'Piel correosa', 1, 1, 'skill', 'Bloquea 7.', [e('block', 7)]);
  card('gh_rend', 'Desgarro', 1, 3, 'attack', '6 de daño.', [e('damage', 6)]);
  card('gh_crush', 'Aplastamiento', 3, 6, 'attack', '14 de daño.', [e('damage', 14)]);
  card('gh_stomp', 'Pisotón pútrido', 1, 3, 'attack', '5 de daño. Cúrate 2.', [e('damage', 5), e('heal', 2)]);
  card('gh_flee', 'Huida a rastras', 2, 3, 'skill', 'Huyes del combate.', [e('flee')], true);

  // alquimista: poison and cooling.
  card('al_vapor', 'Vapor refrescante', 0, 0, 'skill', 'Enfría todos los miembros 3.', [e('coolAll', 3)]);
  card('al_insight', 'Cálculo alquímico', 1, 1, 'skill', 'Roba 2 cartas.', [e('draw', 2)]);
  card('al_ward', 'Bata reforzada', 1, 1, 'skill', 'Bloquea 5.', [e('block', 5)]);
  card('al_elixir', 'Elixir verde', 1, 0, 'skill', 'Cúrate 5. Enfría este miembro 3.', [e('heal', 5), e('cool', 3)]);
  card('al_inject', 'Inyección corrosiva', 1, 2, 'attack', '4 de daño. Envenena 3.', [e('damage', 4), e('poison', 3)]);
  card('al_vial', 'Vial de ácido', 1, 2, 'skill', 'Envenena 4.', [e('poison', 4)]);
  card('al_flask', 'Frasco estallante', 2, 3, 'attack', '8 de daño. Envenena 2.', [e('damage', 8), e('poison', 2)]);
  card('al_kick', 'Patada tóxica', 1, 2, 'attack', '4 de daño. Envenena 2.', [e('damage', 4), e('poison', 2)]);
  card('al_step', 'Paso refrigerado', 0, 0, 'skill', 'Bloquea 3. Enfría este miembro 2.', [e('block', 3), e('cool', 2)]);
  card('al_flee', 'Retirada humeante', 1, 2, 'skill', 'Huyes del combate.', [e('flee')], true);

  // automata: heavy block and one overcharge attack that only its huge maxHeat tolerates.
  card('au_calibrate', 'Calibración', 1, 0, 'skill', 'Enfría todos los miembros 2. Roba 1 carta.', [e('coolAll', 2), e('draw', 1)]);
  card('au_lock', 'Engranaje trabado', 2, 2, 'skill', 'Aturde.', [e('stun')]);
  card('au_plating', 'Blindaje de latón', 1, 1, 'skill', 'Bloquea 8.', [e('block', 8)]);
  card('au_boiler', 'Caldera a presión', 2, 2, 'skill', 'Bloquea 12.', [e('block', 12)]);
  card('au_piston', 'Golpe de pistón', 1, 3, 'attack', '6 de daño.', [e('damage', 6)]);
  card('au_overcharge', 'Sobrecarga', 3, 8, 'attack', '15 de daño.', [e('damage', 15)]);
  card('au_stomp', 'Pisotón mecánico', 1, 3, 'attack', '5 de daño. Bloquea 3.', [e('damage', 5), e('block', 3)]);
  card('au_flee', 'Marcha forzada', 2, 4, 'skill', 'Huyes del combate.', [e('flee')], true);

  // cirujano: precise damage, healing, draw and energy.
  card('ci_focus', 'Pulso firme', 1, 1, 'skill', 'Ganas 2 de energía. Roba 1 carta.', [e('energy', 2), e('draw', 1)]);
  card('ci_diagnose', 'Diagnóstico', 0, 1, 'skill', 'Roba 1 carta.', [e('draw', 1)]);
  card('ci_transfuse', 'Transfusión', 1, 2, 'skill', 'Cúrate 8.', [e('heal', 8)]);
  card('ci_gown', 'Delantal quirúrgico', 1, 1, 'skill', 'Bloquea 6.', [e('block', 6)]);
  card('ci_scalpel', 'Bisturí', 1, 2, 'attack', '6 de daño.', [e('damage', 6)]);
  card('ci_incision', 'Incisión precisa', 1, 2, 'attack', '5 de daño. Roba 1 carta.', [e('damage', 5), e('draw', 1)]);
  card('ci_amputate', 'Amputación', 2, 4, 'attack', '10 de daño.', [e('damage', 10)]);
  card('ci_kick', 'Rodillazo clínico', 1, 2, 'attack', '5 de daño. Debilita 1.', [e('damage', 5), e('weaken', 1)]);
  card('ci_sidestep', 'Paso lateral', 1, 1, 'skill', 'Bloquea 5. Roba 1 carta.', [e('block', 5), e('draw', 1)]);
  card('ci_flee', 'Retirada quirúrgica', 1, 3, 'skill', 'Huyes del combate.', [e('flee')], true);

  // quimera: the strongest cards in every slot, with stun and heal.
  card('qu_gaze', 'Mirada de quimera', 2, 2, 'skill', 'Aturde.', [e('stun')]);
  card('qu_howl', 'Aullido de tres gargantas', 1, 2, 'skill', 'Debilita 2. Roba 1 carta.', [e('weaken', 2), e('draw', 1)]);
  card('qu_hide', 'Coraza de escamas', 1, 1, 'skill', 'Bloquea 9.', [e('block', 9)]);
  card('qu_devour', 'Devorar', 2, 2, 'skill', 'Cúrate 10.', [e('heal', 10)]);
  card('qu_rip', 'Zarpazo quimérico', 1, 3, 'attack', '6 de daño.', [e('damage', 6)]);
  card('qu_maul', 'Dentellada múltiple', 2, 4, 'attack', '5 de daño ×2.', [e('damage', 5, 2)]);
  card('qu_annihilate', 'Aniquilación', 3, 7, 'attack', '15 de daño.', [e('damage', 15)]);
  card('qu_kick', 'Coz de quimera', 1, 3, 'attack', '6 de daño. Bloquea 3.', [e('damage', 6), e('block', 3)]);
  card('qu_flee', 'Huida bestial', 1, 4, 'skill', 'Huyes del combate.', [e('flee')], true);

  var STUMP_CARD = {
    id: 'stump',
    name: T('Muñonazo'),
    cost: 1,
    heat: 0,
    type: 'attack',
    text: T('3 de daño. Golpe torpe de muñón.'),
    exhaust: false,
    effects: [{ kind: 'damage', value: 3 }]
  };

  // ------------------------------------------------------------------- limbs

  var LIMBS = {};

  // `desc` is never drawn on any screen (codex, table and harvest all show `name`), so it
  // stays as authored.
  function limb(id, family, slot, name, desc, maxHeat, cool, hp, cards) {
    LIMBS[id] = {
      id: id,
      family: family,
      slot: slot,
      name: T(name),
      desc: desc,
      maxHeat: maxHeat,
      cool: cool,
      hp: hp,
      cards: cards
    };
  }

  function c(id, count) { return { id: id, count: count }; }

  // base (8 blueprints, two variants per slot): maxHeat 8-9, cool 2, torso hp 12.
  limb('base_head_a', 'base', 'head', 'Cabeza de ahorcado', 'Cuello marcado por la soga; mira poco, pero mira.', 9, 2, 0,
    [c('ba_observe', 2), c('ba_breathe', 2)]);
  limb('base_head_b', 'base', 'head', 'Cabeza de lunático', 'Ojos idos que desarman al enemigo con una mirada vacía.', 9, 2, 0,
    [c('ba_stare', 2), c('ba_observe', 2)]);
  limb('base_torso_a', 'base', 'torso', 'Torso remendado', 'Costuras gruesas que aguantan un par de golpes de más.', 9, 2, 12,
    [c('ba_guard', 2), c('ba_suture', 2)]);
  limb('base_torso_b', 'base', 'torso', 'Torso de fosa común', 'Carne prestada de varios muertos; nada sofisticado.', 9, 2, 12,
    [c('ba_brace', 2), c('ba_suture', 2)]);
  limb('base_arm_a', 'base', 'arm', 'Brazo de sepulturero', 'Acostumbrado a la pala: golpes secos y pesados.', 8, 2, 0,
    [c('ba_strike', 3), c('ba_swing', 1)]);
  limb('base_arm_b', 'base', 'arm', 'Brazo de estibador', 'Músculo de puerto para mandobles amplios y torpes.', 8, 2, 0,
    [c('ba_strike', 2), c('ba_swing', 2)]);
  limb('base_leg_a', 'base', 'leg', 'Pierna de vagabundo', 'Callos de mil caminos: patea y, si hace falta, huye.', 8, 2, 0,
    [c('ba_kick', 2), c('ba_dodge', 1), c('ba_flee', 1)]);
  limb('base_leg_b', 'base', 'leg', 'Pierna de peregrino', 'Paso terco que esquiva más de lo que golpea.', 8, 2, 0,
    [c('ba_kick', 1), c('ba_dodge', 2), c('ba_flee', 1)]);

  // homunculo: maxHeat 7, cool 3, torso hp 8.
  limb('homunculo_head', 'homunculo', 'head', 'Cráneo de homúnculo', 'Cerebro diminuto y eléctrico: ideas y chispas a raudales.', 7, 3, 0,
    [c('ho_swarm', 2), c('ho_spark', 3)]);
  limb('homunculo_torso', 'homunculo', 'torso', 'Torso de homúnculo', 'Caparazón blando que se remienda solo entre chillidos.', 7, 3, 8,
    [c('ho_shell', 2), c('ho_knit', 2)]);
  limb('homunculo_arm', 'homunculo', 'arm', 'Garra de homúnculo', 'Zarpas nerviosas que arañan mucho y cuestan poco.', 7, 3, 0,
    [c('ho_claws', 3), c('ho_nip', 2)]);
  limb('homunculo_leg', 'homunculo', 'leg', 'Pata de homúnculo', 'Brincos imposibles para patear dos veces o escapar.', 7, 3, 0,
    [c('ho_kick', 2), c('ho_skitter', 1), c('ho_flee', 1)]);

  // ghoul: maxHeat 10, cool 1, torso hp 20.
  limb('ghoul_head', 'ghoul', 'head', 'Testa de carroñero', 'Rugido pútrido que quiebra la voluntad del enemigo.', 10, 1, 0,
    [c('gh_roar', 2), c('gh_hunger', 2)]);
  limb('ghoul_torso', 'ghoul', 'torso', 'Torso putrefacto', 'Carne que rebrota: enorme, lenta y muy difícil de matar.', 10, 1, 20,
    [c('gh_regen', 2), c('gh_hide', 2)]);
  limb('ghoul_arm', 'ghoul', 'arm', 'Brazo de osario', 'Mazazos que aplastan huesos y recalientan el injerto.', 10, 1, 0,
    [c('gh_rend', 2), c('gh_crush', 1)]);
  limb('ghoul_leg', 'ghoul', 'leg', 'Zanca de ghoul', 'Pisotones que abren la carne del otro y cierran la tuya.', 10, 1, 0,
    [c('gh_stomp', 2), c('gh_hide', 1), c('gh_flee', 1)]);

  // alquimista: maxHeat 10, cool 2 (head and torso 3), torso hp 12.
  limb('alquimista_head', 'alquimista', 'head', 'Cráneo destilador', 'Un alambique dentro del cráneo: vapores que enfrían todo el cuerpo.', 10, 3, 0,
    [c('al_vapor', 2), c('al_insight', 2)]);
  limb('alquimista_torso', 'alquimista', 'torso', 'Torso alambicado', 'Tubos y elixires burbujeando bajo la bata manchada.', 10, 3, 12,
    [c('al_ward', 2), c('al_elixir', 2)]);
  limb('alquimista_arm', 'alquimista', 'arm', 'Brazo inyector', 'Agujas y frascos: todo lo que toca empieza a pudrirse.', 10, 2, 0,
    [c('al_inject', 2), c('al_vial', 1), c('al_flask', 1)]);
  limb('alquimista_leg', 'alquimista', 'leg', 'Pierna de vidrio verde', 'Ampollas en la rodilla que salpican veneno al patear.', 10, 2, 0,
    [c('al_kick', 2), c('al_step', 1), c('al_flee', 1)]);

  // automata: maxHeat 16, cool 1, torso hp 18.
  limb('automata_head', 'automata', 'head', 'Cabeza de relojería', 'Engranajes que calibran el cuerpo entero y traban al enemigo.', 16, 1, 0,
    [c('au_calibrate', 3), c('au_lock', 1)]);
  limb('automata_torso', 'automata', 'torso', 'Torso de latón', 'Blindaje de caldera: aguanta un calor absurdo sin quejarse.', 16, 1, 18,
    [c('au_plating', 2), c('au_boiler', 2)]);
  limb('automata_arm', 'automata', 'arm', 'Brazo de pistón', 'Un martinete a vapor con una sobrecarga demoledora.', 16, 1, 0,
    [c('au_piston', 3), c('au_overcharge', 1)]);
  limb('automata_leg', 'automata', 'leg', 'Pierna de engranajes', 'Cada paso es un yunque que además te deja a cubierto.', 16, 1, 0,
    [c('au_stomp', 2), c('au_plating', 1), c('au_flee', 1)]);

  // cirujano: maxHeat 9, cool 2, torso hp 14.
  limb('cirujano_head', 'cirujano', 'head', 'Cabeza enmascarada', 'Pulso firme tras la máscara: más energía y más cartas en la mano.', 9, 2, 0,
    [c('ci_focus', 2), c('ci_diagnose', 2)]);
  limb('cirujano_torso', 'cirujano', 'torso', 'Torso de quirófano', 'Transfusiones y delantal: se cura en plena pelea.', 9, 2, 14,
    [c('ci_transfuse', 2), c('ci_gown', 2)]);
  limb('cirujano_arm', 'cirujano', 'arm', 'Mano de bisturí', 'Cortes exactos allí donde más duele.', 9, 2, 0,
    [c('ci_scalpel', 2), c('ci_incision', 1), c('ci_amputate', 1)]);
  limb('cirujano_leg', 'cirujano', 'leg', 'Pierna de tendones cosidos', 'Rodillazos clínicos y pasos laterales calculados.', 9, 2, 0,
    [c('ci_kick', 2), c('ci_sidestep', 1), c('ci_flee', 1)]);

  // quimera: maxHeat 12, cool 1, torso hp 24.
  limb('quimera_head', 'quimera', 'head', 'Fauces de quimera', 'Tres gargantas que aúllan y paralizan de puro espanto.', 12, 1, 0,
    [c('qu_gaze', 2), c('qu_howl', 2)]);
  limb('quimera_torso', 'quimera', 'torso', 'Torso quimérico', 'Escamas, pelo y hueso: la coraza más brutal de la torre.', 12, 1, 24,
    [c('qu_hide', 2), c('qu_devour', 2)]);
  limb('quimera_arm', 'quimera', 'arm', 'Zarpa de quimera', 'Dentelladas y zarpazos que no perdonan nada.', 12, 1, 0,
    [c('qu_rip', 2), c('qu_maul', 1), c('qu_annihilate', 1)]);
  limb('quimera_leg', 'quimera', 'leg', 'Pata de quimera', 'Coces de bestia que además te ponen a cubierto.', 12, 1, 0,
    [c('qu_kick', 2), c('qu_hide', 1), c('qu_flee', 1)]);

  function familyOf(limbId) {
    return LIMBS[limbId] ? LIMBS[limbId].family : null;
  }

  // ----------------------------------------------------------------- enemies

  var ENEMIES = {
    homunculo: {
      id: 'homunculo', family: 'homunculo', name: T('Homúnculo'), kind: 'monstruosidad', hp: 12, ichor: 5,
      intents: [
        { kind: 'attack', value: 3 },
        { kind: 'attack', value: 2, times: 2 },
        { kind: 'block', value: 4 },
        { kind: 'attack', value: 5 }
      ],
      drops: ['homunculo_head', 'homunculo_torso', 'homunculo_arm', 'homunculo_leg']
    },
    alquimista: {
      id: 'alquimista', family: 'alquimista', name: T('Alquimista corrupto'), kind: 'cientifico', hp: 16, ichor: 7,
      intents: [
        { kind: 'poison', value: 3 },
        { kind: 'attack', value: 4 },
        { kind: 'heat', value: 3 },
        { kind: 'attack', value: 5 }
      ],
      drops: ['alquimista_head', 'alquimista_torso', 'alquimista_arm', 'alquimista_leg']
    },
    ghoul: {
      id: 'ghoul', family: 'ghoul', name: T('Ghoul de laboratorio'), kind: 'monstruosidad', hp: 24, ichor: 10,
      intents: [
        { kind: 'attack', value: 7 },
        { kind: 'attack', value: 4, times: 2 },
        { kind: 'heal', value: 5 },
        { kind: 'attack', value: 6 }
      ],
      drops: ['ghoul_head', 'ghoul_torso', 'ghoul_arm', 'ghoul_leg']
    },
    automata: {
      id: 'automata', family: 'automata', name: T('Autómata de latón'), kind: 'monstruosidad', hp: 26, ichor: 12,
      intents: [
        { kind: 'block', value: 8 },
        { kind: 'attack', value: 7 },
        { kind: 'attack', value: 6 },
        { kind: 'block', value: 6 },
        { kind: 'attack', value: 8 }
      ],
      drops: ['automata_head', 'automata_torso', 'automata_arm', 'automata_leg']
    },
    cirujano: {
      id: 'cirujano', family: 'cirujano', name: T('Cirujano hereje'), kind: 'cientifico', hp: 20, ichor: 10,
      intents: [
        { kind: 'attack', value: 7 },
        { kind: 'heal', value: 6 },
        { kind: 'attack', value: 4, times: 2 },
        { kind: 'attack', value: 6 }
      ],
      drops: ['cirujano_head', 'cirujano_torso', 'cirujano_arm', 'cirujano_leg']
    },
    quimera: {
      id: 'quimera', family: 'quimera', name: T('Quimera'), kind: 'monstruosidad', hp: 42, ichor: 15,
      intents: [
        { kind: 'attack', value: 9 },
        { kind: 'attack', value: 8 },
        { kind: 'heat', value: 5 },
        { kind: 'attack', value: 10 },
        { kind: 'block', value: 8 }
      ],
      drops: ['quimera_head', 'quimera_torso', 'quimera_arm', 'quimera_leg']
    }
  };

  var FLOOR_ENEMIES = [
    ['homunculo', 'alquimista'],
    ['homunculo', 'ghoul', 'automata', 'cirujano'],
    ['ghoul', 'automata', 'cirujano', 'alquimista']
  ];

  var GUARDIAN = 'quimera';

  var FLOOR_COUNTS = [
    { enemies: 4, resources: 4, traps: 3 },
    { enemies: 5, resources: 4, traps: 4 },
    { enemies: 5, resources: 5, traps: 5 }
  ];

  // ---------------------------------------------- resources, traps, cosmetics

  var RESOURCES = {
    coolant: { id: 'coolant', name: T('Vial de refrigerante'), desc: T('Enfría 6 todos los miembros.'), tile: 'coolant', effect: { kind: 'coolAll', value: 6 } },
    suture: { id: 'suture', name: T('Suturas'), desc: T('Recuperas 12 de vida.'), tile: 'suture', effect: { kind: 'heal', value: 12 } },
    clockwork: { id: 'clockwork', name: T('Engranaje de reloj'), desc: T('Ganas 20 segundos de reloj.'), tile: 'clockwork', effect: { kind: 'time', value: 20 } },
    ichor: { id: 'ichor', name: T('Icor'), desc: T('Ganas 8 de icor.'), tile: 'ichor', effect: { kind: 'ichor', value: 8 } }
  };

  var TRAPS = {
    spikes: { id: 'spikes', name: T('Púas'), desc: T('Pierdes 6 de vida; el bloqueo no protege.'), tile: 'spikes', effect: { kind: 'damage', value: 6 } },
    acid: { id: 'acid', name: T('Ácido alquímico'), desc: T('Añade 5 de calor a un miembro al azar; puede romperlo.'), tile: 'acid', effect: { kind: 'heat', value: 5 } }
  };

  // Tint keys are the literal Core.PAL hex values from spec 5.1 (no load-order dependency).
  var COSMETICS = [
    { id: 'skin_default', name: T('Piel cadavérica'), desc: T('La carne gris verdosa de siempre, con sus costuras a la vista.'), price: 0, tint: {} },
    { id: 'skin_brass', name: T('Suturas de latón'), desc: T('Las costuras brillan como alambre de latón pulido.'), price: 20, tint: { '#d9c9a5': '#b08d57' } },
    { id: 'skin_ichor', name: T('Suturas de icor'), desc: T('Las costuras rezuman icor verde y luminoso.'), price: 20, tint: { '#d9c9a5': '#6fbf3f' } },
    { id: 'skin_crimson', name: T('Carne carmesí'), desc: T('Carne recién sangrada y costuras de hueso pálido.'), price: 35, tint: { '#9aa77a': '#7a1f2b', '#5f6b4a': '#4a1219', '#d9c9a5': '#e8dcc8' } }
  ];

  var PACKS = [
    {
      id: 'pack_quimera',
      name: T('Planos de la Quimera'),
      desc: T('Desbloquea los cuatro planos de la Quimera en la mesa.'),
      price: 60,
      blueprints: ['quimera_head', 'quimera_torso', 'quimera_arm', 'quimera_leg']
    }
  ];

  // --------------------------------------------------------------- base body

  var BASE_POOL = {
    head: ['base_head_a', 'base_head_b'],
    torso: ['base_torso_a', 'base_torso_b'],
    arm: ['base_arm_a', 'base_arm_b'],
    leg: ['base_leg_a', 'base_leg_b']
  };

  function newBaseBody(rnd) {
    function take(list) {
      return { id: list[Math.floor(rnd() * list.length)], heat: 0 };
    }
    return {
      head: take(BASE_POOL.head),
      torso: take(BASE_POOL.torso),
      armL: take(BASE_POOL.arm),
      armR: take(BASE_POOL.arm),
      legL: take(BASE_POOL.leg),
      legR: take(BASE_POOL.leg)
    };
  }

  function maxHp(limbs) {
    var total = CONFIG.baseHp;
    for (var i = 0; i < SLOTS.length; i++) {
      var inst = limbs[SLOTS[i]];
      if (inst && LIMBS[inst.id]) total += LIMBS[inst.id].hp;
    }
    return total;
  }

  return {
    CONFIG: CONFIG,
    FAMILIES: FAMILIES,
    SLOTS: SLOTS,
    SLOT_NAMES: SLOT_NAMES,
    slotType: slotType,
    familyOf: familyOf,
    LIMBS: LIMBS,
    CARDS: CARDS,
    STUMP_CARD: STUMP_CARD,
    ENEMIES: ENEMIES,
    FLOOR_ENEMIES: FLOOR_ENEMIES,
    GUARDIAN: GUARDIAN,
    FLOOR_COUNTS: FLOOR_COUNTS,
    RESOURCES: RESOURCES,
    TRAPS: TRAPS,
    COSMETICS: COSMETICS,
    PACKS: PACKS,
    BASE_POOL: BASE_POOL,
    newBaseBody: newBaseBody,
    maxHp: maxHp
  };
})();
