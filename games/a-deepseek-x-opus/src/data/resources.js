/* Pickups — SPEC.md 3.5. `weight` is the relative spawn weight; `cool` reduces heat
 * on all six sockets; `integrity` repairs the most damaged socket; `shard` feeds the
 * persistent meta currency. */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD || !DD.Data) return;

  DD.Data.resources = [
    {
      id: 'residue',
      name: DD.t('Residuo Alquímico'),
      sprite: 'res_residue',
      amount: 5,
      desc: DD.t('+5 de residuo.'),
      weight: 40,
      heal: 0,
      cool: 0,
      integrity: 0,
      shard: 0,
      flavor: DD.t('Un poso verde que baja por los desagües de toda la torre.')
    },
    {
      id: 'oil',
      name: DD.t('Aceite Refrigerante'),
      sprite: 'res_oil',
      amount: 0,
      desc: DD.t('Enfría 9 de calor en los seis injertos.'),
      weight: 22,
      heal: 0,
      cool: 9,
      integrity: 0,
      shard: 0,
      flavor: DD.t('Sabe a hierro y a taller. Los mecánicos lo bebían a escondidas.')
    },
    {
      id: 'bandage',
      name: DD.t('Venda Grasienta'),
      sprite: 'res_bandage',
      amount: 0,
      desc: DD.t('Recupera 8 de vida.'),
      weight: 20,
      heal: 8,
      cool: 0,
      integrity: 0,
      shard: 0,
      flavor: DD.t('Usada, pero del lado limpio.')
    },
    {
      id: 'heart',
      name: DD.t('Corazón en Salmuera'),
      sprite: 'res_heart',
      amount: 0,
      desc: DD.t('Repara 14 de integridad en el miembro más dañado.'),
      weight: 12,
      heal: 0,
      cool: 0,
      integrity: 14,
      shard: 0,
      flavor: DD.t('Todavía late. Nadie sabe de quién era.')
    },
    {
      id: 'shard',
      name: DD.t('Esquirla de Reloj'),
      sprite: 'res_shard',
      amount: 0,
      desc: DD.t('+1 esquirla para la tienda de la torre.'),
      weight: 8,
      heal: 0,
      cool: 0,
      integrity: 0,
      shard: 1,
      flavor: DD.t('Un trozo del reloj anatómico. Sigue contando algo.')
    }
  ];

  DD.Data.resById = {};
  for (var i = 0; i < DD.Data.resources.length; i++) DD.Data.resById[DD.Data.resources[i].id] = DD.Data.resources[i];
})();
