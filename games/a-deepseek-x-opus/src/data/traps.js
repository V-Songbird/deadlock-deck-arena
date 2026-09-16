/* Traps — 6 entries, SPEC.md 3.4. Sprite pairs are reused from the three frozen
 * pairs in SPEC.md 4.2 (trap_spike / trap_vent / trap_acid) since the art set only
 * draws three armed/unarmed pairs. `telegraph` is the warning window before firing,
 * `cooldown` the seconds until it re-arms. */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD || !DD.Data) return;

  DD.Data.traps = [
    {
      id: 'spike',
      name: DD.t('Pinchos Oxidados'),
      sprite: 'trap_spike',
      spriteOn: 'trap_spike_on',
      minFloor: 0,
      damage: 8,
      heat: 0,
      integrity: 0,
      cooldown: 2.0,
      telegraph: 0.45,
      destructible: true,
      flavor: DD.t('Tela de araña, mierda y tétanos. Sobre todo tétanos.')
    },
    {
      id: 'bone_spike',
      name: DD.t('Pinchos de Osario'),
      sprite: 'trap_spike',
      spriteOn: 'trap_spike_on',
      minFloor: 1,
      damage: 12,
      heat: 0,
      integrity: 5,
      cooldown: 3.0,
      telegraph: 0.6,
      destructible: false,
      flavor: DD.t('Fémures afilados hacia arriba. Alguien los colocó a propósito.')
    },
    {
      id: 'steam_vent',
      name: DD.t('Rejilla de Vapor'),
      sprite: 'trap_vent',
      spriteOn: 'trap_vent_on',
      minFloor: 0,
      damage: 0,
      heat: 16,
      integrity: 0,
      cooldown: 3.5,
      telegraph: 0.4,
      destructible: true,
      flavor: DD.t('La caldera respira por aquí. No hace daño: solo hierve lo que llevas puesto.')
    },
    {
      id: 'frost_vent',
      name: DD.t('Rejilla de Escarcha'),
      sprite: 'trap_vent',
      spriteOn: 'trap_vent_on',
      minFloor: 1,
      damage: 0,
      heat: 0,
      integrity: 10,
      cooldown: 2.8,
      telegraph: 0.5,
      destructible: false,
      flavor: DD.t('Un tubo de criogenia roto. El frío no mata: agrieta.')
    },
    {
      id: 'acid_vat',
      name: DD.t('Cuba de Ácido'),
      sprite: 'trap_acid',
      spriteOn: 'trap_acid_on',
      minFloor: 1,
      damage: 6,
      heat: 0,
      integrity: 7,
      cooldown: 3.0,
      telegraph: 0.6,
      destructible: true,
      flavor: DD.t('Rebosa cada pocos segundos y se come el borde de la losa.')
    },
    {
      id: 'acid_jet',
      name: DD.t('Chorro de Ácido'),
      sprite: 'trap_acid',
      spriteOn: 'trap_acid_on',
      minFloor: 2,
      damage: 14,
      heat: 6,
      integrity: 0,
      cooldown: 4.0,
      telegraph: 0.75,
      destructible: false,
      flavor: DD.t('La válvula de la planta alta. Cuando salta, sale todo.')
    }
  ];

  DD.Data.trapById = {};
  for (var i = 0; i < DD.Data.traps.length; i++) DD.Data.trapById[DD.Data.traps[i].id] = DD.Data.traps[i];
})();
