/* Cosmetics — SPEC.md 3.6. Purely a recolour of the avatar's palette channels 1/2/3
 * plus a `tint` used as the HUD accent. Cost is in shards; only the default is owned
 * at the start of a fresh meta. */
(function () {
  'use strict';
  var DD = window.DD;
  if (!DD || !DD.Data) return;

  DD.Data.cosmetics = [
    {
      id: 'default',
      name: 'Carne Cruda',
      cost: 0,
      palette: ['#2b2130', '#6b5a7a', '#c9b8d8'],
      tint: '#9b8fb0',
      unlockedByDefault: true,
      desc: 'La carne con la que llegaste. Nadie la eligió por ti.'
    },
    {
      id: 'embalmed',
      name: 'Embalmado',
      cost: 6,
      palette: ['#3a2a12', '#8a6a2a', '#e0c98a'],
      tint: '#d8b45a',
      unlockedByDefault: false,
      desc: 'Formol, vendas apretadas y una sonrisa que ya no se mueve.'
    },
    {
      id: 'charred',
      name: 'Carbonizado',
      cost: 8,
      palette: ['#1a1210', '#4a3528', '#9c8873'],
      tint: '#e0562a',
      unlockedByDefault: false,
      desc: 'Salió del incendio de la planta baja y siguió andando.'
    },
    {
      id: 'drowned',
      name: 'Ahogado',
      cost: 10,
      palette: ['#0e1a22', '#2c4a56', '#7fa8b0'],
      tint: '#4a9fd8',
      unlockedByDefault: false,
      desc: 'Lo sacaron del depósito con los pulmones llenos de agua turbia.'
    },
    {
      id: 'fungal',
      name: 'Fúngico',
      cost: 12,
      palette: ['#1a2418', '#4a6b3a', '#b8d18a'],
      tint: '#7fc23a',
      unlockedByDefault: false,
      desc: 'Algo crece debajo de la piel y respira por los poros.'
    },
    {
      id: 'chromed',
      name: 'Cromado',
      cost: 16,
      palette: ['#1e2228', '#7a8794', '#dfe7ee'],
      tint: '#8fa2b8',
      unlockedByDefault: false,
      desc: 'Cada músculo sustituido por una pieza que brilla demasiado.'
    },
    {
      id: 'gilded',
      name: 'Dorado',
      cost: 30,
      palette: ['#2a1f0e', '#8a6a1e', '#f0d878'],
      tint: '#e8b23a',
      unlockedByDefault: false,
      desc: 'Los patronos pagan el oro. El cuerpo lo paga otro.'
    },
    {
      id: 'spectral',
      name: 'Espectral',
      cost: 40,
      palette: ['#141a2e', '#4a5f9e', '#c8d8ff'],
      tint: '#9fb8ff',
      unlockedByDefault: false,
      desc: 'La mitad de ti ya está en la sala de al lado.'
    }
  ];

  DD.Data.cosmeticById = {};
  for (var i = 0; i < DD.Data.cosmetics.length; i++) DD.Data.cosmeticById[DD.Data.cosmetics[i].id] = DD.Data.cosmetics[i];
})();
