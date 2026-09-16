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
      name: DD.t('Reptador de Conductos'),
      tier: 1,
      hp: 16,
      sprite: 'enemy_crawler',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 5, text: DD.t('Muerde los dedos') },
        { type: 'block', v: 4, text: DD.t('Se enrosca') },
        { type: 'debuff', status: 'bleed', v: 2, text: DD.t('Araña los tobillos') }
      ],
      heatAttack: 3,
      drops: ['visceral_legs', 'ossuary_arms'],
      dropChance: 0.5,
      flavor: DD.t('Corre entre los tubos con dedos que no son suyos.')
    },
    {
      id: 'leech',
      name: DD.t('Sanguijuela de Sala'),
      tier: 1,
      hp: 20,
      sprite: 'enemy_leech',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 4, text: DD.t('Se adhiere') },
        { type: 'heal', v: 6, text: DD.t('Absorbe la sangre') },
        { type: 'debuff', status: 'bleed', v: 3, text: DD.t('Suelta las ventosas') }
      ],
      heatAttack: 0,
      drops: ['visceral_torso', 'visceral_arms'],
      dropChance: 0.6,
      flavor: DD.t('Criada en un frasco, del tamaño de un perro y siempre hambrienta.')
    },
    {
      id: 'homunculus',
      name: DD.t('Homúnculo'),
      tier: 1,
      hp: 18,
      sprite: 'enemy_homunculus',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 7, text: DD.t('Manotea sin mirar') },
        { type: 'block', v: 5, text: DD.t('Se acurruca') },
        { type: 'debuff', status: 'stun', v: 1, text: DD.t('Chilla hasta aturdir') }
      ],
      heatAttack: 2,
      drops: ['alchemical_head', 'alchemical_arms'],
      dropChance: 0.45,
      flavor: DD.t('Un intento fallido que sigue respirando en su frasco roto.')
    },
    {
      id: 'stitcher',
      name: DD.t('Cosetendones'),
      tier: 2,
      hp: 34,
      sprite: 'enemy_stitcher',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'block', v: 9, text: DD.t('Alza el costurón') },
        { type: 'attack', v: 6, text: DD.t('Ensarta con la aguja') },
        { type: 'debuff', status: 'frail', v: 2, text: DD.t('Cose los tendones') },
        { type: 'attack', v: 11, text: DD.t('Tira de la sutura') }
      ],
      heatAttack: 2,
      drops: ['ossuary_arms', 'ossuary_torso', 'visceral_arms'],
      dropChance: 0.65,
      flavor: DD.t('Cose carne ajena con hilo de plomo y no distingue dueños.')
    },
    {
      id: 'plague_nurse',
      name: DD.t('Enfermera de la Sala Tres'),
      tier: 2,
      hp: 40,
      sprite: 'enemy_plague_nurse',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 6, text: DD.t('Punza con la jeringuilla') },
        { type: 'heal', v: 9, text: DD.t('Inyecta un calmante') },
        { type: 'buff', status: 'vulnerable', v: 2, text: DD.t('Marca la carne del rebaño') },
        { type: 'debuff', status: 'bleed', v: 2, text: DD.t('Lanceta al paciente') }
      ],
      heatAttack: 1,
      drops: ['visceral_torso', 'alchemical_head', 'alchemical_arms'],
      dropChance: 0.6,
      flavor: DD.t('Nadie la contrató. Nadie se atreve a despedirla.')
    },
    {
      id: 'brute',
      name: DD.t('Bruto de Carga'),
      tier: 2,
      hp: 46,
      sprite: 'enemy_brute',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 12, text: DD.t('Aplasta con el puño') },
        { type: 'attack', v: 9, text: DD.t('Barre con el yugo') },
        { type: 'attack', v: 15, text: DD.t('Estrella contra el suelo') },
        { type: 'attack', v: 13, text: DD.t('Arranca de cuajo') }
      ],
      heatAttack: 10,
      drops: ['brute_arm', 'ossuary_torso', 'mech_arms'],
      dropChance: 0.7,
      flavor: DD.t('Músculo mal cosido. Solo sabe derribar puertas y personas.')
    },
    {
      id: 'hound',
      name: DD.t('Sabueso del Doctor'),
      tier: 1,
      hp: 22,
      sprite: 'enemy_hound',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 4, text: DD.t('Muerde la pantorrilla') },
        { type: 'attack', v: 3, text: DD.t('Zarpa el costado') },
        { type: 'block', v: 3, text: DD.t('Se agazapa') }
      ],
      heatAttack: 3,
      drops: ['visceral_legs', 'ossuary_head'],
      dropChance: 0.55,
      flavor: DD.t('Demasiadas mandíbulas para un solo perro.')
    },
    {
      id: 'widow',
      name: DD.t('Viuda del Doctor'),
      tier: 2,
      hp: 32,
      sprite: 'enemy_widow',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'debuff', status: 'vulnerable', v: 2, text: DD.t('Marca la presa') },
        { type: 'attack', v: 11, text: DD.t('Clava los colmillos') },
        { type: 'block', v: 7, text: DD.t('Teje la tela') },
        { type: 'debuff', status: 'bleed', v: 2, text: DD.t('Suelta las larvas') }
      ],
      heatAttack: 0,
      drops: ['visceral_arms', 'spectral_legs'],
      dropChance: 0.55,
      flavor: DD.t('Se quedó a medio hacer y siguió tejiendo sola.')
    },
    {
      id: 'alchemist',
      name: DD.t('Alquimista Corrupto'),
      tier: 2,
      hp: 30,
      sprite: 'enemy_alchemist',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'debuff', status: 'poison', v: 3, text: DD.t('Escupe bilis verdosa') },
        { type: 'attack', v: 7, text: DD.t('Lanza el matraz') },
        { type: 'debuff', status: 'weak', v: 2, text: DD.t('Derrama el frasco') },
        { type: 'debuff', status: 'poison', v: 2, text: DD.t('Remueve la mezcla') }
      ],
      heatAttack: 2,
      drops: ['alchemical_head', 'alchemical_arms', 'mech_arms'],
      dropChance: 0.65,
      flavor: DD.t('Anota cada síntoma antes de provocarlo.')
    },
    {
      id: 'revenant',
      name: DD.t('Resucitado'),
      tier: 3,
      hp: 55,
      sprite: 'enemy_revenant',
      boss: false,
      intentPattern: 'random',
      intents: [
        { type: 'attack', v: 12, text: DD.t('Desgarra la mortaja') },
        { type: 'block', v: 10, text: DD.t('Se envuelve en el sudario') },
        { type: 'debuff', status: 'bleed', v: 3, text: DD.t('Abre la herida vieja') },
        { type: 'buff', v: 1, revive: true, text: DD.t('Vuelve del frío') }
      ],
      heatAttack: 4,
      drops: ['spectral_torso', 'spectral_arms', 'ossuary_head'],
      dropChance: 0.75,
      flavor: DD.t('Ya murió una vez y no le pareció motivo para parar.')
    },
    {
      id: 'golem',
      name: DD.t('Gólem de Losa'),
      tier: 3,
      hp: 70,
      sprite: 'enemy_golem',
      boss: false,
      intentPattern: 'cycle',
      intents: [
        { type: 'block', v: 22, text: DD.t('Cierra los pórticos') },
        { type: 'attack', v: 13, text: DD.t('Machaca el suelo') },
        { type: 'block', v: 14, text: DD.t('Recompone la losa') },
        { type: 'debuff', status: 'stun', v: 1, text: DD.t('Sacude la bóveda') }
      ],
      heatAttack: 12,
      drops: ['mech_arms', 'mech_torso', 'ossuary_legs'],
      dropChance: 0.8,
      flavor: DD.t('Piedra, plomo y un contrato que nadie leyó hasta el final.')
    },
    {
      id: 'harvester',
      name: DD.t('El Cosechador'),
      tier: 3,
      hp: 90,
      sprite: 'enemy_harvester',
      boss: true,
      intentPattern: 'cycle',
      intents: [
        { type: 'attack', v: 15, text: DD.t('Siega las piernas') },
        { type: 'debuff', status: 'vulnerable', v: 3, text: DD.t('Marca el lote') },
        { type: 'heal', v: 12, text: DD.t('Cosecha lo sembrado') }
      ],
      heatAttack: 8,
      drops: ['ossuary_torso', 'spectral_head', 'mech_legs'],
      dropChance: 0.9,
      flavor: DD.t('El capataz de la torre. Recoge lo que los demás dejan a medias.')
    }
  ];

  DD.Data.enemyById = {};
  for (var i = 0; i < DD.Data.enemies.length; i++) DD.Data.enemyById[DD.Data.enemies[i].id] = DD.Data.enemies[i];
})();
