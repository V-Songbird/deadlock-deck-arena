// DD.DATA — pure data for Deadlock Deck: El Reloj Anatómico.
// No logic, no functions, no dependencies. See PRODUCT.md §5.1.
window.DD = window.DD || {};

DD.DATA = {
  SLOTS: ['head', 'torso', 'armL', 'armR', 'legL', 'legR'],
  SLOT_KIND: { head: 'head', torso: 'torso', armL: 'arm', armR: 'arm', legL: 'leg', legR: 'leg' },
  BASE_BODY: {
    head: 'head_vacant', torso: 'torso_sewn',
    armL: 'arm_withered', armR: 'arm_withered',
    legL: 'leg_limping', legR: 'leg_limping'
  },
  BASE_HP: 30,
  RUN_SECONDS: 360,

  LIMBS: {
    // --- heads ---
    head_vacant: {
      id: 'head_vacant', kind: 'head', name: DD.T('Cabeza Vacía'), integrity: 6,
      cards: ['mirada_turbia', 'gemido'], hpBonus: 0, tint: '#d9cdb4',
      desc: DD.T('Cráneo hueco que aún mira. Aguanta poco antes de agrietarse.')
    },
    head_scholar: {
      id: 'head_scholar', kind: 'head', name: DD.T('Cráneo del Erudito'), integrity: 8,
      cards: ['memoria_robada', 'silaba_prohibida'], hpBonus: 0, tint: '#5b3a72',
      desc: DD.T('Cráneo de un erudito corrupto; susurra fórmulas robadas.')
    },
    head_furnace: {
      id: 'head_furnace', kind: 'head', name: DD.T('Cabeza-Horno'), integrity: 12,
      cards: ['sobrepresion', 'purga_de_vapor'], hpBonus: 0, tint: '#d8622b',
      desc: DD.T('Horno portátil por cabeza: potencia brutal, calor brutal.')
    },
    head_hound: {
      id: 'head_hound', kind: 'head', name: DD.T('Testa de Sabueso'), integrity: 7,
      cards: ['olfato_de_ceniza', 'dentellada'], hpBonus: 0, tint: '#8a7d64',
      desc: DD.T('Testa cenicienta de sabueso: buen olfato, dientes largos.')
    },

    // --- torsos ---
    torso_sewn: {
      id: 'torso_sewn', kind: 'torso', name: DD.T('Torso Cosido'), integrity: 8,
      cards: ['costura_tensa', 'espasmo'], hpBonus: 0, tint: '#7a1f22',
      desc: DD.T('Torso remendado con hilo negro. Se tensa y tiembla.')
    },
    torso_brass: {
      id: 'torso_brass', kind: 'torso', name: DD.T('Caja Torácica de Latón'), integrity: 14,
      cards: ['baluarte', 'pistones'], hpBonus: 8, tint: '#b08d3f',
      desc: DD.T('Coraza de latón remachada: aguanta golpes y devuelve vapor.')
    },
    torso_alembic: {
      id: 'torso_alembic', kind: 'torso', name: DD.T('Torso Alambique'), integrity: 9,
      cards: ['transmutar', 'flor_de_acido'], hpBonus: 4, tint: '#4e8c7a',
      desc: DD.T('Torso de alambique: destila la carne y escupe ácido.')
    },
    torso_wretch: {
      id: 'torso_wretch', kind: 'torso', name: DD.T('Torso Errante'), integrity: 10,
      cards: ['retorcerse', 'tiron_de_injerto'], hpBonus: 6, tint: '#3f5c46',
      desc: DD.T('Torso errante que se retuerce y arranca injertos ajenos.')
    },

    // --- arms ---
    arm_withered: {
      id: 'arm_withered', kind: 'arm', name: DD.T('Brazo Marchito'), integrity: 6,
      cards: ['golpe_seco', 'agarre'], hpBonus: 0, tint: '#a89272',
      desc: DD.T('Brazo seco y ligero. Golpea sin calentarse apenas.')
    },
    arm_cleaver: {
      id: 'arm_cleaver', kind: 'arm', name: DD.T('Brazo Cuchilla'), integrity: 8,
      cards: ['tajo', 'desollar'], hpBonus: 0, tint: '#8f2a24',
      desc: DD.T('Brazo-cuchilla de carnicero: corta y desuella.')
    },
    arm_bellows: {
      id: 'arm_bellows', kind: 'arm', name: DD.T('Brazo Fuelle'), integrity: 10,
      cards: ['rafaga', 'bomba_fria'], hpBonus: 0, tint: '#a5642c',
      desc: DD.T('Brazo-fuelle: sopla ráfagas ardientes y aire helado.')
    },
    arm_needle: {
      id: 'arm_needle', kind: 'arm', name: DD.T('Brazo Aguja'), integrity: 7,
      cards: ['sutura', 'inyeccion'], hpBonus: 0, tint: '#7d9c93',
      desc: DD.T('Brazo-aguja de cirujano: sutura y envenena la sangre.')
    },
    arm_gauntlet: {
      id: 'arm_gauntlet', kind: 'arm', name: DD.T('Guantelete de Latón'), integrity: 12,
      cards: ['martillo', 'parada'], hpBonus: 0, tint: '#8f7333',
      desc: DD.T('Guantelete de latón: martillo pesado y parada firme.')
    },

    // --- legs ---
    leg_limping: {
      id: 'leg_limping', kind: 'leg', name: DD.T('Pierna Renqueante'), integrity: 6,
      cards: ['patada', 'paso_torpe'], hpBonus: 0, tint: '#6f6450',
      desc: DD.T('Pierna renqueante. Anda mal, pero anda.')
    },
    leg_hound: {
      id: 'leg_hound', kind: 'leg', name: DD.T('Zanca de Sabueso'), integrity: 7,
      cards: ['zarpazo', 'carrera'], hpBonus: 0, tint: '#5c4a3a',
      desc: DD.T('Zanca de sabueso: garra afilada y trote incansable.')
    },
    leg_piston: {
      id: 'leg_piston', kind: 'leg', name: DD.T('Pierna de Pistón'), integrity: 11,
      cards: ['pisoton', 'impulso_de_vapor'], hpBonus: 0, tint: '#6e7480',
      desc: DD.T('Pierna de pistón: pisotones y vapor a presión.')
    },
    leg_root: {
      id: 'leg_root', kind: 'leg', name: DD.T('Pierna Raíz'), integrity: 9,
      cards: ['anclaje', 'raiz_sedienta'], hpBonus: 0, tint: '#4d6b3a',
      desc: DD.T('Pierna-raíz: se ancla al suelo y bebe sangre.')
    }
  },

  CARDS: {
    // --- head_vacant ---
    mirada_turbia: {
      id: 'mirada_turbia', name: DD.T('Mirada Turbia'), cost: 0, heat: 1,
      text: DD.T('Roba 1.'), effects: [{ op: 'draw', amount: 1 }]
    },
    gemido: {
      id: 'gemido', name: DD.T('Gemido'), cost: 1, heat: 2,
      text: DD.T('Inflige 4.'), effects: [{ op: 'damage', amount: 4 }]
    },

    // --- head_scholar ---
    memoria_robada: {
      id: 'memoria_robada', name: DD.T('Memoria Robada'), cost: 1, heat: 2,
      text: DD.T('Roba 2. Energía +1.'),
      effects: [{ op: 'draw', amount: 2 }, { op: 'energy', amount: 1 }]
    },
    silaba_prohibida: {
      id: 'silaba_prohibida', name: DD.T('Sílaba Prohibida'), cost: 2, heat: 4,
      text: DD.T('Inflige 9. Aplica Vulnerable 2.'),
      effects: [{ op: 'damage', amount: 9 }, { op: 'vulnerable', amount: 2 }]
    },

    // --- head_furnace ---
    sobrepresion: {
      id: 'sobrepresion', name: DD.T('Sobrepresión'), cost: 1, heat: 5,
      text: DD.T('Inflige 11.'), effects: [{ op: 'damage', amount: 11 }]
    },
    purga_de_vapor: {
      id: 'purga_de_vapor', name: DD.T('Purga de Vapor'), cost: 0, heat: 0,
      text: DD.T('Enfría 4.'), effects: [{ op: 'cool', amount: 4 }]
    },

    // --- head_hound ---
    olfato_de_ceniza: {
      id: 'olfato_de_ceniza', name: DD.T('Olfato de Ceniza'), cost: 0, heat: 1,
      text: DD.T('Roba 1. +3 s.'),
      effects: [{ op: 'draw', amount: 1 }, { op: 'time', amount: 3 }]
    },
    dentellada: {
      id: 'dentellada', name: DD.T('Dentellada'), cost: 1, heat: 3,
      text: DD.T('Inflige 5. Aplica Sangrado 2.'),
      effects: [{ op: 'damage', amount: 5 }, { op: 'bleed', amount: 2 }]
    },

    // --- torso_sewn ---
    costura_tensa: {
      id: 'costura_tensa', name: DD.T('Costura Tensa'), cost: 1, heat: 1,
      text: DD.T('Bloqueo 6.'), effects: [{ op: 'block', amount: 6 }]
    },
    espasmo: {
      id: 'espasmo', name: DD.T('Espasmo'), cost: 1, heat: 2,
      text: DD.T('Inflige 4. Bloqueo 3.'),
      effects: [{ op: 'damage', amount: 4 }, { op: 'block', amount: 3 }]
    },

    // --- torso_brass ---
    baluarte: {
      id: 'baluarte', name: DD.T('Baluarte'), cost: 1, heat: 2,
      text: DD.T('Bloqueo 10.'), effects: [{ op: 'block', amount: 10 }]
    },
    pistones: {
      id: 'pistones', name: DD.T('Pistones'), cost: 2, heat: 5,
      text: DD.T('Inflige 7. Bloqueo 7.'),
      effects: [{ op: 'damage', amount: 7 }, { op: 'block', amount: 7 }]
    },

    // --- torso_alembic ---
    transmutar: {
      id: 'transmutar', name: DD.T('Transmutar'), cost: 1, heat: 3,
      text: DD.T('Cura 7.'), effects: [{ op: 'heal', amount: 7 }]
    },
    flor_de_acido: {
      id: 'flor_de_acido', name: DD.T('Flor de Ácido'), cost: 2, heat: 4,
      text: DD.T('Inflige 4. Aplica Sangrado 4.'),
      effects: [{ op: 'damage', amount: 4 }, { op: 'bleed', amount: 4 }]
    },

    // --- torso_wretch ---
    retorcerse: {
      id: 'retorcerse', name: DD.T('Retorcerse'), cost: 0, heat: 2,
      text: DD.T('Bloqueo 4. Roba 1.'),
      effects: [{ op: 'block', amount: 4 }, { op: 'draw', amount: 1 }]
    },
    tiron_de_injerto: {
      id: 'tiron_de_injerto', name: DD.T('Tirón de Injerto'), cost: 2, heat: 4,
      text: DD.T('Inflige 8. Cosecha todos los injertos.'),
      effects: [{ op: 'damage', amount: 8 }, { op: 'harvest' }]
    },

    // --- arm_withered ---
    golpe_seco: {
      id: 'golpe_seco', name: DD.T('Golpe Seco'), cost: 1, heat: 1,
      text: DD.T('Inflige 5.'), effects: [{ op: 'damage', amount: 5 }]
    },
    agarre: {
      id: 'agarre', name: DD.T('Agarre'), cost: 1, heat: 2,
      text: DD.T('Inflige 3. Aplica Debilidad 2.'),
      effects: [{ op: 'damage', amount: 3 }, { op: 'weak', amount: 2 }]
    },

    // --- arm_cleaver ---
    tajo: {
      id: 'tajo', name: DD.T('Tajo'), cost: 1, heat: 2,
      text: DD.T('Inflige 8.'), effects: [{ op: 'damage', amount: 8 }]
    },
    desollar: {
      id: 'desollar', name: DD.T('Desollar'), cost: 2, heat: 4,
      text: DD.T('Inflige 6. Cosecha todos los injertos.'),
      effects: [{ op: 'damage', amount: 6 }, { op: 'harvest' }]
    },

    // --- arm_bellows ---
    rafaga: {
      id: 'rafaga', name: DD.T('Ráfaga'), cost: 1, heat: 3,
      text: DD.T('Inflige 7.'), effects: [{ op: 'damage', amount: 7 }]
    },
    bomba_fria: {
      id: 'bomba_fria', name: DD.T('Bomba Fría'), cost: 0, heat: 0,
      text: DD.T('Enfría 3. Energía +1.'),
      effects: [{ op: 'cool', amount: 3 }, { op: 'energy', amount: 1 }]
    },

    // --- arm_needle ---
    sutura: {
      id: 'sutura', name: DD.T('Sutura'), cost: 1, heat: 2,
      text: DD.T('Cura 4. Bloqueo 3.'),
      effects: [{ op: 'heal', amount: 4 }, { op: 'block', amount: 3 }]
    },
    inyeccion: {
      id: 'inyeccion', name: DD.T('Inyección'), cost: 1, heat: 3,
      text: DD.T('Inflige 4. Aplica Sangrado 3.'),
      effects: [{ op: 'damage', amount: 4 }, { op: 'bleed', amount: 3 }]
    },

    // --- arm_gauntlet ---
    martillo: {
      id: 'martillo', name: DD.T('Martillo'), cost: 2, heat: 5,
      text: DD.T('Inflige 13.'), effects: [{ op: 'damage', amount: 13 }]
    },
    parada: {
      id: 'parada', name: DD.T('Parada'), cost: 1, heat: 1,
      text: DD.T('Bloqueo 8.'), effects: [{ op: 'block', amount: 8 }]
    },

    // --- leg_limping ---
    patada: {
      id: 'patada', name: DD.T('Patada'), cost: 1, heat: 2,
      text: DD.T('Inflige 4.'), effects: [{ op: 'damage', amount: 4 }]
    },
    paso_torpe: {
      id: 'paso_torpe', name: DD.T('Paso Torpe'), cost: 0, heat: 1,
      text: DD.T('Bloqueo 3.'), effects: [{ op: 'block', amount: 3 }]
    },

    // --- leg_hound ---
    zarpazo: {
      id: 'zarpazo', name: DD.T('Zarpazo'), cost: 1, heat: 3,
      text: DD.T('Inflige 6. Energía +1.'),
      effects: [{ op: 'damage', amount: 6 }, { op: 'energy', amount: 1 }]
    },
    carrera: {
      id: 'carrera', name: DD.T('Carrera'), cost: 0, heat: 2,
      text: DD.T('+5 s.'), effects: [{ op: 'time', amount: 5 }]
    },

    // --- leg_piston ---
    pisoton: {
      id: 'pisoton', name: DD.T('Pisotón'), cost: 2, heat: 4,
      text: DD.T('Inflige 9. Aturde.'),
      effects: [{ op: 'damage', amount: 9 }, { op: 'stun' }]
    },
    impulso_de_vapor: {
      id: 'impulso_de_vapor', name: DD.T('Impulso de Vapor'), cost: 1, heat: 3,
      text: DD.T('+8 s.'), effects: [{ op: 'time', amount: 8 }]
    },

    // --- leg_root ---
    anclaje: {
      id: 'anclaje', name: DD.T('Anclaje'), cost: 1, heat: 2,
      text: DD.T('Bloqueo 9.'), effects: [{ op: 'block', amount: 9 }]
    },
    raiz_sedienta: {
      id: 'raiz_sedienta', name: DD.T('Raíz Sedienta'), cost: 1, heat: 3,
      text: DD.T('Inflige 4. Cura 4.'),
      effects: [{ op: 'damage', amount: 4 }, { op: 'heal', amount: 4 }]
    },

    // --- stumps (cost 0, heat 0, never break) ---
    stump_stare: {
      id: 'stump_stare', name: DD.T('Muñón: Mirada Vacía'), cost: 0, heat: 0,
      text: DD.T('Bloqueo 1. Roba 1.'),
      effects: [{ op: 'block', amount: 1 }, { op: 'draw', amount: 1 }]
    },
    stump_lurch: {
      id: 'stump_lurch', name: DD.T('Muñón: Bamboleo'), cost: 0, heat: 0,
      text: DD.T('Bloqueo 2.'), effects: [{ op: 'block', amount: 2 }]
    },
    stump_flail: {
      id: 'stump_flail', name: DD.T('Muñón: Manotazo'), cost: 0, heat: 0,
      text: DD.T('Inflige 2.'), effects: [{ op: 'damage', amount: 2 }]
    },
    stump_drag: {
      id: 'stump_drag', name: DD.T('Muñón: Arrastre'), cost: 0, heat: 0,
      text: DD.T('Bloqueo 2.'), effects: [{ op: 'block', amount: 2 }]
    }
  },

  STUMPS: { head: 'stump_stare', torso: 'stump_lurch', arm: 'stump_flail', leg: 'stump_drag' },

  ENEMIES: {
    assistant: {
      id: 'assistant', name: DD.T('Ayudante Suturado'), hp: 24, tint: '#9c8f76',
      drops: ['arm_cleaver', 'arm_needle', 'torso_sewn'],
      intents: [
        { type: 'attack', amount: 7 },
        { type: 'block', amount: 5 },
        { type: 'attack', amount: 9 }
      ],
      desc: DD.T('Ayudante de laboratorio cosido a mano. Obediente y letal.')
    },
    scientist: {
      id: 'scientist', name: DD.T('Científico Corrupto'), hp: 20, tint: '#5b3a72',
      drops: ['head_scholar', 'arm_needle', 'torso_alembic'],
      intents: [
        { type: 'heat', amount: 3 },
        { type: 'attack', amount: 6 },
        { type: 'weak', amount: 2 },
        { type: 'attack', amount: 8 }
      ],
      desc: DD.T('Un científico corrompido por sus propias fórmulas.')
    },
    homunculus: {
      id: 'homunculus', name: DD.T('Homúnculo de Vapor'), hp: 30, tint: '#d8622b',
      drops: ['head_furnace', 'arm_bellows', 'leg_piston'],
      intents: [
        { type: 'attack', amount: 8 },
        { type: 'heat', amount: 4 },
        { type: 'multi', amount: 4, times: 3 }
      ],
      desc: DD.T('Homúnculo de vapor que hierve por dentro y golpea tres veces.')
    },
    ash_hound: {
      id: 'ash_hound', name: DD.T('Perro de Cenizas'), hp: 18, tint: '#6b5f4a',
      drops: ['head_hound', 'leg_hound'],
      intents: [
        { type: 'multi', amount: 3, times: 2 },
        { type: 'bleed', amount: 3 },
        { type: 'attack', amount: 7 }
      ],
      desc: DD.T('Sabueso de ceniza: rápido, hambriento y sangriento.')
    },
    wretch: {
      id: 'wretch', name: DD.T('Torso Errante'), hp: 26, tint: '#3f5c46',
      drops: ['torso_wretch', 'leg_root'],
      intents: [
        { type: 'attack', amount: 9 },
        { type: 'block', amount: 6 },
        { type: 'bleed', amount: 2 }
      ],
      desc: DD.T('Torso errante que arrastra sus propios intestinos.')
    },
    brass_guard: {
      id: 'brass_guard', name: DD.T('Guardia de Latón'), hp: 40, tint: '#b08d3f',
      drops: ['torso_brass', 'arm_gauntlet'],
      intents: [
        { type: 'block', amount: 8 },
        { type: 'attack', amount: 12 },
        { type: 'multi', amount: 5, times: 3 }
      ],
      desc: DD.T('Guardia de latón: lento, blindado y brutal.')
    },
    brass_porter: {
      id: 'brass_porter', name: DD.T('Portero de Latón'), hp: 55, tint: '#8f7333',
      drops: ['torso_brass', 'arm_gauntlet', 'leg_piston'],
      intents: [
        { type: 'attack', amount: 11 },
        { type: 'heat', amount: 5 },
        { type: 'multi', amount: 6, times: 3 },
        { type: 'block', amount: 10 }
      ],
      desc: DD.T('El Portero de Latón custodia la puerta. No deja salir a nadie.')
    }
  },

  GUARDIAN: 'brass_porter'
};
