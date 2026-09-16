/* Enemy definitions — the 12 frozen ids from SPEC.md 2.9, in exactly that order
 * (the frozen order interleaves tiers, so there are no tier section headers here).
 * `intents` are the telegraphs the combat view shows; `heatAttack` is how much heat
 * the enemy dumps into a random player socket when its attack lands.
 * Drops reference limb ids that anatomy guarantees (src/data/limbs.js). */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD || !DD.Data) return;

  DD.Data.enemies = [
    {
      id: 'crawler',
      name: 'Reptador de Conductos',
      tier: 1,
      hp: 16,
      sprite: 'enemy_crawler',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 5, text: 'Muerde los dedos' },
        { type: 'block', v: 4, text: 'Se enrosca' },
        { type: 'debuff', status: 'bleed', v: 2, text: 'Araña los tobillos' }
      ],
      heatAttack: 3,
      drops: ['visceral_legs', 'ossuary_arms'],
      dropChance: 0.5,
      flavor: 'Corre entre los tubos con dedos que no son suyos.'
    },
    {
      id: 'leech',
      name: 'Sanguijuela de Sala',
      tier: 1,
      hp: 20,
      sprite: 'enemy_leech',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 4, text: 'Se adhiere' },
        { type: 'heal', v: 6, text: 'Absorbe la sangre' },
        { type: 'debuff', status: 'bleed', v: 3, text: 'Suelta las ventosas' }
      ],
      heatAttack: 0,
      drops: ['visceral_torso', 'visceral_arms'],
      dropChance: 0.6,
      flavor: 'Criada en un frasco, del tamaño de un perro y siempre hambrienta.'
    },
    {
      id: 'homunculus',
      name: 'Homúnculo',
      tier: 1,
      hp: 18,
      sprite: 'enemy_homunculus',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 7, text: 'Manotea sin mirar' },
        { type: 'block', v: 5, text: 'Se acurruca' },
        { type: 'debuff', status: 'stun', v: 1, text: 'Chilla hasta aturdir' }
      ],
      heatAttack: 2,
      drops: ['alchemical_head', 'alchemical_arms'],
      dropChance: 0.45,
      flavor: 'Un intento fallido que sigue respirando en su frasco roto.'
    },
    {
      id: 'stitcher',
      name: 'Cosetendones',
      tier: 2,
      hp: 34,
      sprite: 'enemy_stitcher',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'block', v: 9, text: 'Alza el costurón' },
        { type: 'attack', v: 6, text: 'Ensarta con la aguja' },
        { type: 'debuff', status: 'frail', v: 2, text: 'Cose los tendones' },
        { type: 'attack', v: 11, text: 'Tira de la sutura' }
      ],
      heatAttack: 2,
      drops: ['ossuary_arms', 'ossuary_torso', 'visceral_arms'],
      dropChance: 0.65,
      flavor: 'Cose carne ajena con hilo de plomo y no distingue dueños.'
    },
    {
      id: 'plague_nurse',
      name: 'Enfermera de la Sala Tres',
      tier: 2,
      hp: 40,
      sprite: 'enemy_plague_nurse',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 6, text: 'Punza con la jeringuilla' },
        { type: 'heal', v: 9, text: 'Inyecta un calmante' },
        { type: 'buff', status: 'vulnerable', v: 2, text: 'Marca la carne del rebaño' },
        { type: 'debuff', status: 'bleed', v: 2, text: 'Lanceta al paciente' }
      ],
      heatAttack: 1,
      drops: ['visceral_torso', 'alchemical_head', 'alchemical_arms'],
      dropChance: 0.6,
      flavor: 'Nadie la contrató. Nadie se atreve a despedirla.'
    },
    {
      id: 'brute',
      name: 'Bruto de Carga',
      tier: 2,
      hp: 46,
      sprite: 'enemy_brute',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 12, text: 'Aplasta con el puño' },
        { type: 'attack', v: 9, text: 'Barre con el yugo' },
        { type: 'attack', v: 15, text: 'Estrella contra el suelo' },
        { type: 'attack', v: 13, text: 'Arranca de cuajo' }
      ],
      heatAttack: 10,
      drops: ['brute_arm', 'ossuary_torso', 'mech_arms'],
      dropChance: 0.7,
      flavor: 'Músculo mal cosido. Solo sabe derribar puertas y personas.'
    },
    {
      id: 'hound',
      name: 'Sabueso del Doctor',
      tier: 1,
      hp: 22,
      sprite: 'enemy_hound',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 4, text: 'Muerde la pantorrilla' },
        { type: 'attack', v: 3, text: 'Zarpa el costado' },
        { type: 'block', v: 3, text: 'Se agazapa' }
      ],
      heatAttack: 3,
      drops: ['visceral_legs', 'ossuary_head'],
      dropChance: 0.55,
      flavor: 'Demasiadas mandíbulas para un solo perro.'
    },
    {
      id: 'widow',
      name: 'Viuda del Doctor',
      tier: 2,
      hp: 32,
      sprite: 'enemy_widow',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'debuff', status: 'vulnerable', v: 2, text: 'Marca la presa' },
        { type: 'attack', v: 11, text: 'Clava los colmillos' },
        { type: 'block', v: 7, text: 'Teje la tela' },
        { type: 'debuff', status: 'bleed', v: 2, text: 'Suelta las larvas' }
      ],
      heatAttack: 0,
      drops: ['visceral_arms', 'spectral_legs'],
      dropChance: 0.55,
      flavor: 'Se quedó a medio hacer y siguió tejiendo sola.'
    },
    {
      id: 'alchemist',
      name: 'Alquimista Corrupto',
      tier: 2,
      hp: 30,
      sprite: 'enemy_alchemist',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'debuff', status: 'poison', v: 3, text: 'Escupe bilis verdosa' },
        { type: 'attack', v: 7, text: 'Lanza el matraz' },
        { type: 'debuff', status: 'weak', v: 2, text: 'Derrama el frasco' },
        { type: 'debuff', status: 'poison', v: 2, text: 'Remueve la mezcla' }
      ],
      heatAttack: 2,
      drops: ['alchemical_head', 'alchemical_arms', 'mech_arms'],
      dropChance: 0.65,
      flavor: 'Anota cada síntoma antes de provocarlo.'
    },
    {
      id: 'revenant',
      name: 'Resucitado',
      tier: 3,
      hp: 55,
      sprite: 'enemy_revenant',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 12, text: 'Desgarra la mortaja' },
        { type: 'block', v: 10, text: 'Se envuelve en el sudario' },
        { type: 'debuff', status: 'bleed', v: 3, text: 'Abre la herida vieja' },
        { type: 'buff', v: 1, revive: true, text: 'Vuelve del frío' }
      ],
      heatAttack: 4,
      drops: ['spectral_torso', 'spectral_arms', 'ossuary_head'],
      dropChance: 0.75,
      flavor: 'Ya murió una vez y no le pareció motivo para parar.'
    },
    {
      id: 'golem',
      name: 'Gólem de Losa',
      tier: 3,
      hp: 70,
      sprite: 'enemy_golem',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'block', v: 22, text: 'Cierra los pórticos' },
        { type: 'attack', v: 13, text: 'Machaca el suelo' },
        { type: 'block', v: 14, text: 'Recompone la losa' },
        { type: 'debuff', status: 'stun', v: 1, text: 'Sacude la bóveda' }
      ],
      heatAttack: 12,
      drops: ['mech_arms', 'mech_torso', 'ossuary_legs'],
      dropChance: 0.8,
      flavor: 'Piedra, plomo y un contrato que nadie leyó hasta el final.'
    },
    {
      id: 'harvester',
      name: 'El Cosechador',
      tier: 3,
      hp: 90,
      sprite: 'enemy_harvester',
      boss: true,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 15, text: 'Siega las piernas' },
        { type: 'debuff', status: 'vulnerable', v: 3, text: 'Marca el lote' },
        { type: 'heal', v: 12, text: 'Cosecha lo sembrado' }
      ],
      heatAttack: 8,
      drops: ['ossuary_torso', 'spectral_head', 'mech_legs'],
      dropChance: 0.9,
      flavor: 'El capataz de la torre. Recoge lo que los demás dejan a medias.'
    }
  ];

  DD.Data.enemyById = {};
  for (var i = 0; i < DD.Data.enemies.length; i++) DD.Data.enemyById[DD.Data.enemies[i].id] = DD.Data.enemies[i];
})();
