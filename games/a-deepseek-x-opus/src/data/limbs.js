/* Deadlock Deck — limb blueprints (26: 6 heads, 6 torsos, 8 arms, 6 legs).
 * Id style is <family>_<part>, matching the ids the bestiary drops reference.
 * Six families, each with a fixed avatar form: osario=gaunt, visceral=fleshy,
 * mecanico=mech, espectral=spectral, alquimico=fleshy, criogenico=gaunt|bulky.
 * See SPEC.md 3.1 / 2.8. Every id in `cards` must exist in cards.js. */
(function () {
  'use strict';
  var DD = window.DD;

  DD.Data.limbs = [

    /* ================= HEADS (3 / 2 / 1) — utility and draw ================= */

    /* --- osario --- */
    { id: 'ossuary_head', name: DD.t('Cráneo Osario'), slot: 'head', tier: 1,
      form: 'gaunt', palette: ['#1e1a24', '#7d7260', '#ded3b8'],
      integrity: 20, heatCap: 96, coolRate: 6, maxHpBonus: 0,
      passive: null,
      cards: ['ossuary_glare', 'skull_tap', 'bone_focus'],
      drops: false,
      flavor: DD.t('Un cráneo limpio y hueco, más útil como herramienta que como cabeza.') },

    /* --- visceral --- */
    { id: 'visceral_head', name: DD.t('Rostro Palpitante'), slot: 'head', tier: 1,
      form: 'fleshy', palette: ['#3a1420', '#9c3040', '#e08a92'],
      integrity: 24, heatCap: 90, coolRate: 5, maxHpBonus: 4,
      passive: { id: 'regen', v: 1 },
      cards: ['blood_spit', 'raw_scream', 'gorge'],
      drops: true,
      flavor: DD.t('Una cara prestada que supura y nunca deja de sonreír.') },

    /* --- mecánico --- */
    { id: 'mech_head', name: DD.t('Cráneo de Válvulas'), slot: 'head', tier: 1,
      form: 'mech', palette: ['#20242c', '#6d7787', '#c2ccd8'],
      integrity: 26, heatCap: 108, coolRate: 8, maxHpBonus: 2,
      passive: { id: 'heatResist', v: 2 },
      cards: ['pressure_valve', 'cog_shot', 'brass_guard', 'overclock'],
      drops: true,
      flavor: DD.t('Latón, manómetros y un ojo de cristal que gira solo.') },

    /* --- espectral --- */
    { id: 'spectral_head', name: DD.t('Cráneo Vidente'), slot: 'head', tier: 2,
      form: 'spectral', palette: ['#241a33', '#6b4fa0', '#c9a8e8'],
      integrity: 28, heatCap: 112, coolRate: 8, maxHpBonus: 6,
      passive: { id: 'openingDraw', v: 1 },
      cards: ['ecto_insight', 'soul_siphon', 'dread_gaze', 'third_eye'],
      drops: true,
      flavor: DD.t('Mira hacia dentro y encuentra cosas que todavía no han ocurrido.') },

    /* --- alquímico --- */
    { id: 'alchemical_head', name: DD.t('Córtex Alquímico'), slot: 'head', tier: 2,
      form: 'fleshy', palette: ['#1c2a18', '#4f8a34', '#a8d86a'],
      integrity: 30, heatCap: 104, coolRate: 7, maxHpBonus: 8,
      passive: { id: 'thorns', v: 3 },
      cards: ['venom_drip', 'distill', 'weakening_fumes', 'mind_venom'],
      drops: true,
      flavor: DD.t('Un cerebro conservado en veneno: sólo piensa en dosis y antídotos.') },

    /* --- criogénico --- */
    { id: 'cryo_head', name: DD.t('Mente Criogénica'), slot: 'head', tier: 3,
      form: 'gaunt', palette: ['#16222e', '#4a7fa8', '#bfe4f5'],
      integrity: 38, heatCap: 130, coolRate: 10, maxHpBonus: 10,
      passive: { id: 'openingDraw', v: 2 },
      cards: ['absolute_zero', 'permafrost', 'frost_thought', 'numbing_gaze'],
      drops: true,
      flavor: DD.t('Piensa despacio, congelando cada idea antes de llegar a usarla.') },

    /* ================= TORSOS (3 / 2 / 1) — HP and defense ================= */

    /* --- osario --- */
    { id: 'ossuary_torso', name: DD.t('Caja Torácica'), slot: 'torso', tier: 1,
      form: 'gaunt', palette: ['#221d28', '#8a7d63', '#e0d6bb'],
      integrity: 22, heatCap: 100, coolRate: 6, maxHpBonus: 4,
      passive: null,
      cards: ['rib_splinter', 'bone_plate', 'brittle_guard'],
      drops: false,
      flavor: DD.t('Costillas secas que crujen con cada respiración y aguantan de milagro.') },

    /* --- visceral --- */
    { id: 'visceral_torso', name: DD.t('Torso Palpitante'), slot: 'torso', tier: 1,
      form: 'fleshy', palette: ['#3d1220', '#a8323f', '#e89098'],
      integrity: 26, heatCap: 90, coolRate: 5, maxHpBonus: 6,
      passive: { id: 'regen', v: 1 },
      cards: ['gristle_bind', 'blood_let', 'crimson_feast', 'visceral_mend'],
      drops: true,
      flavor: DD.t('Un tronco de músculo cosido a un corazón que no era suyo.') },

    /* --- mecánico --- */
    { id: 'mech_torso', name: DD.t('Coraza de Caldera'), slot: 'torso', tier: 1,
      form: 'mech', palette: ['#1f232b', '#7a6a4a', '#d8c08a'],
      integrity: 26, heatCap: 110, coolRate: 8, maxHpBonus: 4,
      passive: { id: 'coolBonus', v: 1 },
      cards: ['rivet_wall', 'boiler_purge', 'overpressure'],
      drops: true,
      flavor: DD.t('Cincuenta remaches y una caldera que nunca acaba de enfriarse.') },

    /* --- espectral --- */
    { id: 'spectral_torso', name: DD.t('Torso Hueco'), slot: 'torso', tier: 2,
      form: 'spectral', palette: ['#1d1a2e', '#5f4a9c', '#b8a6e6'],
      integrity: 24, heatCap: 100, coolRate: 6, maxHpBonus: 6,
      passive: { id: 'energyBonus', v: 1 },
      cards: ['soul_battery', 'ectoplasm_veil', 'wail', 'spectral_communion'],
      drops: true,
      flavor: DD.t('No hay órganos: sólo un hueco que zumba y escupe chispas.') },

    /* --- alquímico --- */
    { id: 'alchemical_torso', name: DD.t('Saco Venenoso'), slot: 'torso', tier: 2,
      form: 'fleshy', palette: ['#1a2a14', '#5f9c38', '#bce87a'],
      integrity: 32, heatCap: 108, coolRate: 6, maxHpBonus: 8,
      passive: { id: 'scavengeBonus', v: 20 },
      cards: ['bile_burst', 'residue_tap', 'caustic_armor', 'purge_flask'],
      drops: true,
      flavor: DD.t('Un buche traslúcido donde fermentan residuos y promesas.') },

    /* --- criogénico --- */
    { id: 'cryo_torso', name: DD.t('Coraza Glacial'), slot: 'torso', tier: 3,
      form: 'bulky', palette: ['#131e2a', '#4f88b0', '#cfeaf8'],
      integrity: 46, heatCap: 140, coolRate: 11, maxHpBonus: 16,
      passive: { id: 'coolBonus', v: 5 },
      cards: ['glacier_wall', 'heart_of_ice', 'thermal_sink', 'rime_armor'],
      drops: true,
      flavor: DD.t('Placas de hielo eterno; debajo, algo sigue latiendo muy despacio.') },

    /* ================= ARMS (4 / 3 / 1) — damage ================= */

    /* --- osario --- */
    { id: 'ossuary_arms', name: DD.t('Garra Ósea'), slot: 'arm', tier: 1,
      form: 'gaunt', palette: ['#241e2a', '#8f8268', '#e6dcc2'],
      integrity: 18, heatCap: 94, coolRate: 6, maxHpBonus: 0,
      passive: { id: 'thorns', v: 2 },
      cards: ['claw_rake', 'bone_spike', 'missing_limb_fury'],
      drops: false,
      flavor: DD.t('Falanges afiladas que se parten al primer golpe mal dado.') },

    /* --- visceral --- */
    { id: 'visceral_arms', name: DD.t('Brazo de Carne'), slot: 'arm', tier: 1,
      form: 'fleshy', palette: ['#40121e', '#ab2f3c', '#ea9098'],
      integrity: 24, heatCap: 92, coolRate: 5, maxHpBonus: 2,
      passive: { id: 'lifesteal', v: 1 },
      cards: ['rend', 'blood_offering', 'feast_of_meat'],
      drops: true,
      flavor: DD.t('Músculo crudo cosido al hombro con hilo de tripa.') },

    /* --- mecánico --- */
    { id: 'mech_arms', name: DD.t('Brazo de Pistón'), slot: 'arm', tier: 1,
      form: 'mech', palette: ['#1d2129', '#6f7a8a', '#c6d0dc'],
      integrity: 26, heatCap: 106, coolRate: 7, maxHpBonus: 2,
      passive: null,
      cards: ['piston_jab', 'hydraulic_ram', 'scalding_vent'],
      drops: false,
      flavor: DD.t('Lento, pesado, y capaz de abollar una puerta de hierro.') },

    /* --- espectral --- */
    { id: 'spectral_arms', name: DD.t('Brazo Fantasmal'), slot: 'arm', tier: 1,
      form: 'spectral', palette: ['#201c30', '#6350a2', '#c0b0ea'],
      integrity: 20, heatCap: 98, coolRate: 7, maxHpBonus: 0,
      passive: null,
      cards: ['ghost_touch', 'spectral_bolt', 'ecto_leech'],
      drops: false,
      flavor: DD.t('Atraviesa la materia, pero el calor lo disuelve como niebla.') },

    /* --- alquímico --- */
    { id: 'alchemical_arms', name: DD.t('Aguijón Venenoso'), slot: 'arm', tier: 2,
      form: 'fleshy', palette: ['#1b2a16', '#5a9c36', '#b6e878'],
      integrity: 26, heatCap: 105, coolRate: 8, maxHpBonus: 5,
      passive: { id: 'bleedOnHit', v: 2 },
      cards: ['sting', 'toxic_lash', 'venom_burst', 'serum_of_ruin'],
      drops: true,
      flavor: DD.t('Un aguijón hueco que se rellena solo mientras alguien sangre.') },

    /* --- mecánico, brutal --- */
    { id: 'brute_arm', name: DD.t('Brazo de Garfio'), slot: 'arm', tier: 2,
      form: 'bulky', palette: ['#22262e', '#7d6a52', '#d6c096'],
      integrity: 34, heatCap: 118, coolRate: 7, maxHpBonus: 7,
      passive: { id: 'thorns', v: 5 },
      cards: ['hook_drag', 'chain_yank', 'meat_hook', 'iron_maiden'],
      drops: true,
      flavor: DD.t('Un garfio de matadero con cadena, polea y muy malos modales.') },

    /* --- criogénico --- */
    { id: 'frost_arm', name: DD.t('Lanza de Escarcha'), slot: 'arm', tier: 2,
      form: 'bulky', palette: ['#15212c', '#4d86ae', '#c6e6f6'],
      integrity: 34, heatCap: 118, coolRate: 8, maxHpBonus: 6,
      passive: { id: 'firstStrike', v: 5 },
      cards: ['lance_thrust', 'chill_spike', 'frostbite', 'cryo_lance'],
      drops: true,
      flavor: DD.t('Un brazo convertido en carámbano; el primer golpe es siempre el más frío.') },

    /* --- osario --- */
    { id: 'reaver_arm', name: DD.t('Brazo Segador'), slot: 'arm', tier: 3,
      form: 'gaunt', palette: ['#1c1620', '#7e7260', '#e8ddc4'],
      integrity: 34, heatCap: 125, coolRate: 9, maxHpBonus: 9,
      passive: { id: 'bleedOnHit', v: 3 },
      cards: ['bone_scythe', 'marrow_spray', 'reaper_toll', 'ossuary_ascendant'],
      drops: true,
      flavor: DD.t('Cosecha brazos ajenos para alargar el suyo: cada muñón lo hace más fuerte.') },

    /* ================= LEGS (3 / 2 / 1) — mobility, energy, cooling ================= */

    /* --- osario --- */
    { id: 'ossuary_legs', name: DD.t('Zancos Óseos'), slot: 'leg', tier: 1,
      form: 'gaunt', palette: ['#22202a', '#8b8068', '#e2d8be'],
      integrity: 20, heatCap: 92, coolRate: 6, maxHpBonus: 0,
      passive: null,
      cards: ['stilt_step', 'march_of_bone', 'femur_throw', 'knuckle_walk'],
      drops: false,
      flavor: DD.t('Dos fémures alargados con bisagras de alambre y mucha prisa.') },

    /* --- visceral --- */
    { id: 'visceral_legs', name: DD.t('Piernas de Tendón'), slot: 'leg', tier: 1,
      form: 'fleshy', palette: ['#3b1120', '#a52f3e', '#e5899a'],
      integrity: 24, heatCap: 90, coolRate: 5, maxHpBonus: 4,
      passive: { id: 'regen', v: 2 },
      cards: ['sprint', 'tendon_snap', 'blood_marathon'],
      drops: true,
      flavor: DD.t('Tendones tensados como cuerdas de violín que se reajustan solos.') },

    /* --- mecánico --- */
    { id: 'mech_legs', name: DD.t('Piernas de Muelle'), slot: 'leg', tier: 1,
      form: 'mech', palette: ['#1e222a', '#77828f', '#ccd6e2'],
      integrity: 24, heatCap: 100, coolRate: 8, maxHpBonus: 2,
      passive: { id: 'coolBonus', v: 1 },
      cards: ['spring_leap', 'pneumatic_kick', 'steam_exhaust'],
      drops: true,
      flavor: DD.t('Muelles de coche y tubos de escape por donde resopla todo el cuerpo.') },

    /* --- espectral --- */
    { id: 'spectral_legs', name: DD.t('Piernas Espectrales'), slot: 'leg', tier: 2,
      form: 'spectral', palette: ['#1f1b30', '#6553a8', '#c4b4ec'],
      integrity: 26, heatCap: 102, coolRate: 8, maxHpBonus: 5,
      passive: { id: 'drawBonus', v: 1 },
      cards: ['phase_step', 'wraith_dash', 'ecto_overflow', 'void_stride'],
      drops: true,
      flavor: DD.t('No tocan el suelo: flotan un dedo por encima del polvo.') },

    /* --- alquímico --- */
    { id: 'alchemical_legs', name: DD.t('Piernas Ácidas'), slot: 'leg', tier: 2,
      form: 'fleshy', palette: ['#1c2a12', '#63a032', '#c0ea74'],
      integrity: 30, heatCap: 106, coolRate: 7, maxHpBonus: 6,
      passive: { id: 'scavengeBonus', v: 15 },
      cards: ['acid_trail', 'corrosive_step', 'alembic_stride', 'toxic_runoff'],
      drops: true,
      flavor: DD.t('Cada paso deja un charco que silba y disuelve la piedra.') },

    /* --- criogénico --- */
    { id: 'cryo_legs', name: DD.t('Pisadas de Escarcha'), slot: 'leg', tier: 3,
      form: 'bulky', palette: ['#101c28', '#4a84b2', '#d2ecfa'],
      integrity: 40, heatCap: 135, coolRate: 12, maxHpBonus: 12,
      passive: { id: 'coolBonus', v: 4 },
      cards: ['permafrost_step', 'hail_stomp', 'winter_eternal', 'frozen_march'],
      drops: true,
      flavor: DD.t('El suelo se hiela donde pisa; el tiempo también, un poco.') }
  ];

  DD.Data.limbById = {};
  for (var i = 0; i < DD.Data.limbs.length; i++) DD.Data.limbById[DD.Data.limbs[i].id] = DD.Data.limbs[i];
})();
