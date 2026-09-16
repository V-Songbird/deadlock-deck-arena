// Anatomical blueprints, cards, enemies, resources and shop items. Owner: DATA worker.
// Shapes and content requirements: PRODUCT.md §3, §4, §8. Ids are lowercase ASCII; text is Spanish.
const DATA = {
  RUN_SECONDS: 360,   // the anatomical clock: six minutes per run
  SHIFT_SECONDS: 45,  // the labyrinth reshuffles its walls this often
  HAND_SIZE: 5,
  ENERGY: 3,
  BASE_HP: 30,
  TRAP_DAMAGE: 5,
  TRAP_HEAT: 2,       // heat added to each leg when a trap springs
  COOL_PER_TURN: 1,
  FLOORS: 3,
  FLOOR_W: 7,
  FLOOR_H: 7,
  SLOTS: ['head', 'torso', 'armL', 'armR', 'legL', 'legR'],
  SLOT_NAMES: { head: 'Cabeza', torso: 'Torso', armL: 'Brazo izq.', armR: 'Brazo der.', legL: 'Pierna izq.', legR: 'Pierna der.' },
  TYPE_NAMES: { head: 'Cabeza', torso: 'Torso', arm: 'Brazo', leg: 'Pierna' },
  STUMP_CARD: 'munon',
  ROOM: { EMPTY: 'empty', START: 'start', ENEMY: 'enemy', RESOURCE: 'resource', TRAP: 'trap', STAIRS: 'stairs', EXIT: 'exit' },
  FLOOR_POP: [
    { enemies: 4, resources: 3, traps: 2 },
    { enemies: 5, resources: 3, traps: 3 },
    { enemies: 6, resources: 3, traps: 3 },
  ],
  /** Limb sprite keys per type; Sprites draws exactly these (PRODUCT.md §9). */
  SPRITE_KEYS: {
    head: ['head_skull', 'head_crow', 'head_jar', 'head_helm', 'head_hound', 'head_scholar', 'head_rat'],
    torso: ['torso_stitch', 'torso_brass', 'torso_barrel', 'torso_ribcage', 'torso_robe', 'torso_fur'],
    arm: ['arm_bone', 'arm_claw', 'arm_saw', 'arm_tentacle', 'arm_brass', 'arm_needle', 'arm_scholar', 'arm_paw'],
    leg: ['leg_bone', 'leg_hoof', 'leg_spring', 'leg_wheel', 'leg_hound', 'leg_scholar', 'leg_rat'],
  },

  /** @param {string} slot one of SLOTS @returns {'head'|'torso'|'arm'|'leg'} */
  slotType(slot) {
    if (slot === 'head' || slot === 'torso') return slot;
    return slot.startsWith('arm') ? 'arm' : 'leg';
  },

  /** cards: id -> { id, name, desc, cost, heat, fx } (PRODUCT.md §4.1). 49 cards in three tiers. */
  cards: {
    // --- Tier 0: base cadaver cards. cost 1, heat 0-1, 3-5 damage / block. ---
    munon: { id: 'munon', name: 'Golpe de muñón', desc: 'Inflige 2 de daño. Un muñón nunca se sobrecalienta.', cost: 1, heat: 0, fx: { dmg: 2 } },
    punetazo: { id: 'punetazo', name: 'Puñetazo', desc: 'Un puñetazo torpe con nudillos que ya no sangran.', cost: 1, heat: 0, fx: { dmg: 4 } },
    cubrirse: { id: 'cubrirse', name: 'Cubrirse', desc: 'Cruzas los brazos y encajas el golpe.', cost: 1, heat: 0, fx: { block: 4 } },
    manotazo: { id: 'manotazo', name: 'Manotazo', desc: 'El brazo chasquea como una rama seca.', cost: 1, heat: 1, fx: { dmg: 5 } },
    muro_costillas: { id: 'muro_costillas', name: 'Muro de costillas', desc: 'Entrelazas tus costillas como un escudo.', cost: 1, heat: 1, fx: { block: 5 } },
    mordida: { id: 'mordida', name: 'Mordida', desc: 'Arrancas un trozo de carne y lo tragas.', cost: 1, heat: 1, fx: { dmg: 3, heal: 2 } },
    temblor: { id: 'temblor', name: 'Temblor', desc: 'Un espasmo recorre la carne: golpea y se cierra.', cost: 1, heat: 0, fx: { dmg: 3, block: 2 } },
    paso_lento: { id: 'paso_lento', name: 'Paso lento', desc: 'Avanzas un palmo con los brazos por delante.', cost: 1, heat: 0, fx: { block: 3 } },
    resuello: { id: 'resuello', name: 'Resuello', desc: 'Un jadeo de pulmones prestados empuja el golpe.', cost: 1, heat: 1, fx: { dmg: 4 } },
    doble_puno: { id: 'doble_puno', name: 'Doble puño', desc: 'Dos golpes rápidos, dos crujidos secos.', cost: 1, heat: 0, fx: { dmg: 2, hits: 2 } },
    escupir: { id: 'escupir', name: 'Escupitajo', desc: 'Escupes bilis al ojo del enemigo.', cost: 1, heat: 0, fx: { vuln: 1 } },
    graznido: { id: 'graznido', name: 'Graznido', desc: 'Un graznido que afloja los tendones del rival.', cost: 1, heat: 0, fx: { weak: 1 } },
    cabezazo: { id: 'cabezazo', name: 'Cabezazo', desc: 'Cabeza contra cabeza; la tuya está cosida con hilo grueso.', cost: 1, heat: 1, fx: { dmg: 5, selfDmg: 1 } },

    // --- Tier 1: common enemy parts. heat 1-2. ---
    garra: { id: 'garra', name: 'Garra', desc: 'Cuatro dedos de hueso abren la carne como papel.', cost: 1, heat: 1, fx: { dmg: 6 } },
    desgarrar: { id: 'desgarrar', name: 'Desgarrar', desc: 'Tiras de la herida hasta oír ceder el tejido.', cost: 2, heat: 2, fx: { dmg: 5, hits: 2 } },
    picotazo: { id: 'picotazo', name: 'Picotazo', desc: 'El pico de latón busca los ojos.', cost: 1, heat: 1, fx: { dmg: 4, vuln: 1 } },
    aliento_podrido: { id: 'aliento_podrido', name: 'Aliento pútrido', desc: 'Exhalas vapor de formol y podredumbre.', cost: 1, heat: 1, fx: { poison: 3 } },
    costura_rapida: { id: 'costura_rapida', name: 'Costura rápida', desc: 'Cinco puntadas y sigues andando.', cost: 1, heat: 1, fx: { heal: 5 } },
    guardia_laton: { id: 'guardia_laton', name: 'Guardia de latón', desc: 'Placas de latón se cierran sobre el pecho.', cost: 2, heat: 2, fx: { block: 9 } },
    venda_fria: { id: 'venda_fria', name: 'Venda fría', desc: 'Un trapo empapado en agua de pozo.', cost: 1, heat: 1, fx: { cool: 1 } },
    ojo_verdigris: { id: 'ojo_verdigris', name: 'Ojo de verdigris', desc: 'Un ojo de cobre oxidado mira, y el enemigo duda.', cost: 1, heat: 1, fx: { weak: 2 } },
    marca_cirujano: { id: 'marca_cirujano', name: 'Marca del cirujano', desc: 'Dibujas la línea de corte sobre el rival.', cost: 1, heat: 1, fx: { vuln: 2 } },
    sangria: { id: 'sangria', name: 'Sangría', desc: 'Abres la vena y dejas que gotee en el suelo.', cost: 1, heat: 1, fx: { dmg: 3, poison: 2 } },
    pulso_acido: { id: 'pulso_acido', name: 'Pulso ácido', desc: 'Un vómito verde que corroe desde dentro.', cost: 2, heat: 2, fx: { poison: 4 } },
    siseo: { id: 'siseo', name: 'Siseo', desc: 'Un silbido entre dientes muertos; tu cuerpo responde.', cost: 0, heat: 1, fx: { draw: 1 } },
    chasquido: { id: 'chasquido', name: 'Chasquido', desc: 'Chascas los dedos y algo se enciende dentro de ti.', cost: 0, heat: 1, fx: { energy: 1 } },
    contorsion: { id: 'contorsion', name: 'Contorsión', desc: 'Doblas huesos que no deberían doblarse.', cost: 1, heat: 1, fx: { block: 4, draw: 1 } },
    arrastrarse: { id: 'arrastrarse', name: 'Arrastrarse', desc: 'Te arrastras por el suelo buscando otra posición.', cost: 1, heat: 1, fx: { block: 3, draw: 1 } },
    inyeccion: { id: 'inyeccion', name: 'Inyección', desc: 'Vacías el frasco dentro de la herida abierta.', cost: 1, heat: 2, fx: { dmg: 8, poison: 3 } },
    coz: { id: 'coz', name: 'Coz', desc: 'Una patada que rompe costillas ajenas.', cost: 1, heat: 2, fx: { dmg: 8 } },
    trapos: { id: 'trapos', name: 'Trapos húmedos', desc: 'Trapos empapados que ahogan el calor de tus juntas.', cost: 1, heat: 1, fx: { block: 4, cool: 1 } },
    pulso_debil: { id: 'pulso_debil', name: 'Pulso débil', desc: 'Compruebas que aún late, y te recompone.', cost: 1, heat: 1, fx: { heal: 3, draw: 1 } },
    mordida_ferrea: { id: 'mordida_ferrea', name: 'Mordida férrea', desc: 'Muerdes, tragas, y la carne nueva se cierra.', cost: 2, heat: 2, fx: { dmg: 6, heal: 4 } },
    embestida: { id: 'embestida', name: 'Embestida', desc: 'Cargas con el hombro por delante.', cost: 2, heat: 2, fx: { dmg: 6, block: 3 } },
    vidrio_molido: { id: 'vidrio_molido', name: 'Vidrio molido', desc: 'Cristales de los frascos rotos bajo las uñas.', cost: 1, heat: 1, fx: { dmg: 2, poison: 3 } },

    // --- Tier 2: rare parts. heat 2-3, big effects (10+ damage, stun, cooling). ---
    sierra: { id: 'sierra', name: 'Sierra ósea', desc: 'La hoja gira y muerde el hueso.', cost: 2, heat: 2, fx: { dmg: 11 } },
    esquirla: { id: 'esquirla', name: 'Esquirla', desc: 'Un fragmento sale despedido entre la sangre.', cost: 1, heat: 2, fx: { dmg: 7, vuln: 1 } },
    desmembrar: { id: 'desmembrar', name: 'Desmembrar', desc: 'Arrancas el miembro entero, y algo tuyo con él.', cost: 2, heat: 3, fx: { dmg: 14, selfDmg: 2 } },
    prensa_laton: { id: 'prensa_laton', name: 'Prensa de latón', desc: 'El brazo mecánico aprieta y te sirve de escudo.', cost: 2, heat: 3, fx: { dmg: 10, block: 6 } },
    cuchilla: { id: 'cuchilla', name: 'Cuchilla de disección', desc: 'La hoja fina encuentra la sutura y la abre.', cost: 1, heat: 2, fx: { dmg: 8, vuln: 1 } },
    escarcha: { id: 'escarcha', name: 'Escarcha', desc: 'Abres la válvula: el hielo recorre tus venas.', cost: 2, heat: 2, fx: { cool: 3 } },
    paralisis: { id: 'paralisis', name: 'Parálisis', desc: 'El enemigo queda rígido como un espécimen.', cost: 2, heat: 3, fx: { stun: 1 } },
    marea_oxido: { id: 'marea_oxido', name: 'Marea de óxido', desc: 'El herrumbre lo invade todo: carne y metal.', cost: 2, heat: 2, fx: { vuln: 2, weak: 2 } },
    transfusion: { id: 'transfusion', name: 'Transfusión', desc: 'Sangre ajena entra a presión en tus costuras.', cost: 2, heat: 2, fx: { heal: 10 } },
    ojo_quirurgico: { id: 'ojo_quirurgico', name: 'Ojo quirúrgico', desc: 'Lo ves todo: la arteria, el tendón, el hueco.', cost: 1, heat: 2, fx: { vuln: 2, draw: 1 } },
    salto_muelle: { id: 'salto_muelle', name: 'Salto de muelle', desc: 'El resorte te lanza fuera del golpe.', cost: 1, heat: 2, fx: { block: 6, draw: 1 } },
    biela: { id: 'biela', name: 'Biela', desc: 'Un empujón hidráulico: el motor de tu pierna responde.', cost: 0, heat: 3, fx: { energy: 1, draw: 1 } },
    rodar: { id: 'rodar', name: 'Rodar', desc: 'Ruedas sobre el enemigo hecho una masa de metal.', cost: 1, heat: 2, fx: { dmg: 6, block: 4 } },
    aplanar: { id: 'aplanar', name: 'Aplanar', desc: 'Caes sobre el enemigo con todo el peso de tu cuerpo muerto.', cost: 2, heat: 3, fx: { dmg: 12 } },
    tormenta_agujas: { id: 'tormenta_agujas', name: 'Tormenta de agujas', desc: 'Cuatro agujas hipodérmicas a la vez.', cost: 2, heat: 2, fx: { dmg: 3, hits: 4 } },
  },

  /** limbs: id -> { id, name, type, desc, cards, maxHeat, hp, sprite, tier } (PRODUCT.md §4.2). 29 limbs. */
  limbs: {
    // --- Heads (7): tier 0 x3, tier 1 x3, tier 2 x1. ---
    cabeza_ahorcado: { id: 'cabeza_ahorcado', name: 'Cabeza de ahorcado', type: 'head', desc: 'Todavía lleva la soga al cuello; la lengua cuelga como una corbata.', cards: ['cubrirse', 'cabezazo'], maxHeat: 6, hp: 0, sprite: 'head_skull', tier: 0 },
    cabeza_difunta: { id: 'cabeza_difunta', name: 'Cabeza de difunta', type: 'head', desc: 'Conserva la mirada de quien ya no espera nada.', cards: ['cubrirse', 'escupir'], maxHeat: 6, hp: 1, sprite: 'head_scholar', tier: 0 },
    cabeza_formol: { id: 'cabeza_formol', name: 'Cabeza en formol', type: 'head', desc: 'Un cerebro flota en formol; todavía recuerda tu nombre.', cards: ['graznido', 'temblor'], maxHeat: 6, hp: 0, sprite: 'head_jar', tier: 0 },
    cabeza_ratonera: { id: 'cabeza_ratonera', name: 'Cabeza ratonera', type: 'head', desc: 'Dientes amarillos que no dejan de castañetear.', cards: ['mordida_ferrea', 'aliento_podrido'], maxHeat: 7, hp: 1, sprite: 'head_rat', tier: 1 },
    cabeza_sabueso: { id: 'cabeza_sabueso', name: 'Cabeza de sabueso', type: 'head', desc: 'Un hocico que ya no distingue a los vivos de la carne.', cards: ['desgarrar', 'mordida'], maxHeat: 7, hp: 1, sprite: 'head_hound', tier: 1 },
    cabeza_cuervo: { id: 'cabeza_cuervo', name: 'Cabeza de cuervo', type: 'head', desc: 'Máscara de pico negro cosida a un cuello humano.', cards: ['picotazo', 'ojo_verdigris'], maxHeat: 8, hp: 0, sprite: 'head_crow', tier: 1 },
    cabeza_casco: { id: 'cabeza_casco', name: 'Cabeza de casco', type: 'head', desc: 'Un yelmo de latón lleno de ojos de cristal.', cards: ['ojo_quirurgico', 'marea_oxido', 'paralisis'], maxHeat: 9, hp: 3, sprite: 'head_helm', tier: 2 },

    // --- Torsos (7): tier 0 x3, tier 1 x3, tier 2 x1. ---
    torso_ahorcado: { id: 'torso_ahorcado', name: 'Torso cosido', type: 'torso', desc: 'Costuras gruesas y frías; la soga dejó marca en el cuello.', cards: ['cubrirse', 'punetazo'], maxHeat: 7, hp: 8, sprite: 'torso_stitch', tier: 0 },
    torso_apestado: { id: 'torso_apestado', name: 'Torso apestado', type: 'torso', desc: 'Piel de perro sobre costillas humanas; apesta a fosa.', cards: ['punetazo', 'cubrirse', 'temblor'], maxHeat: 6, hp: 7, sprite: 'torso_fur', tier: 0 },
    torso_costillar: { id: 'torso_costillar', name: 'Costillar desnudo', type: 'torso', desc: 'Costillas desnudas, sin nada que las tape.', cards: ['muro_costillas', 'cubrirse'], maxHeat: 7, hp: 5, sprite: 'torso_ribcage', tier: 0 },
    torso_tonel: { id: 'torso_tonel', name: 'Torso de tonel', type: 'torso', desc: 'Un tonel flejado donde debería haber pecho.', cards: ['guardia_laton', 'trapos'], maxHeat: 8, hp: 11, sprite: 'torso_barrel', tier: 1 },
    torso_tunica: { id: 'torso_tunica', name: 'Torso de túnica', type: 'torso', desc: 'Túnica de profesor manchada de reactivos y de algo peor.', cards: ['marca_cirujano', 'venda_fria', 'siseo'], maxHeat: 7, hp: 9, sprite: 'torso_robe', tier: 1 },
    torso_amasijo: { id: 'torso_amasijo', name: 'Amasijo de carne', type: 'torso', desc: 'Varios torsos cosidos en uno; gimen con muchas voces.', cards: ['desgarrar', 'costura_rapida'], maxHeat: 8, hp: 13, sprite: 'torso_stitch', tier: 1 },
    torso_laton: { id: 'torso_laton', name: 'Caja torácica de latón', type: 'torso', desc: 'Latón remachado; dentro late algo que no es tuyo.', cards: ['prensa_laton', 'guardia_laton', 'transfusion'], maxHeat: 9, hp: 15, sprite: 'torso_brass', tier: 2 },

    // --- Arms (8): tier 0 x3, tier 1 x3, tier 2 x2. ---
    brazo_ahorcado: { id: 'brazo_ahorcado', name: 'Brazo rígido', type: 'arm', desc: 'Pega con la gracia de un tronco.', cards: ['punetazo', 'punetazo'], maxHeat: 6, hp: 0, sprite: 'arm_bone', tier: 0 },
    brazo_escriba: { id: 'brazo_escriba', name: 'Brazo de escriba', type: 'arm', desc: 'Dedos de tinta y uñas mordidas; aún sabe sostener algo.', cards: ['punetazo', 'temblor'], maxHeat: 6, hp: 0, sprite: 'arm_scholar', tier: 0 },
    brazo_mastin: { id: 'brazo_mastin', name: 'Brazo de mastín', type: 'arm', desc: 'Una pata de mastín remendada a un hombro humano.', cards: ['manotazo', 'doble_puno'], maxHeat: 6, hp: 0, sprite: 'arm_paw', tier: 0 },
    brazo_garra: { id: 'brazo_garra', name: 'Brazo de garra', type: 'arm', desc: 'Cinco uñas de asta que nunca se cortaron.', cards: ['garra', 'vidrio_molido'], maxHeat: 7, hp: 1, sprite: 'arm_claw', tier: 1 },
    brazo_tentaculo: { id: 'brazo_tentaculo', name: 'Brazo tentáculo', type: 'arm', desc: 'Un apéndice húmedo que no obedece del todo.', cards: ['pulso_acido', 'contorsion'], maxHeat: 6, hp: 2, sprite: 'arm_tentacle', tier: 1 },
    brazo_jeringa: { id: 'brazo_jeringa', name: 'Brazo de jeringa', type: 'arm', desc: 'Una jeringa oxidada donde debería estar la mano.', cards: ['inyeccion', 'sangria', 'pulso_debil'], maxHeat: 7, hp: 0, sprite: 'arm_needle', tier: 1 },
    brazo_sierra: { id: 'brazo_sierra', name: 'Brazo de sierra', type: 'arm', desc: 'Una sierra circular de quirófano, todavía caliente.', cards: ['sierra', 'esquirla', 'desmembrar'], maxHeat: 9, hp: 2, sprite: 'arm_saw', tier: 2 },
    brazo_laton: { id: 'brazo_laton', name: 'Brazo de latón', type: 'arm', desc: 'Prótesis de latón con válvulas de refrigerante.', cards: ['cuchilla', 'chasquido', 'escarcha'], maxHeat: 8, hp: 3, sprite: 'arm_brass', tier: 2 },

    // --- Legs (7): tier 0 x3, tier 1 x2, tier 2 x2. ---
    pierna_ahorcado: { id: 'pierna_ahorcado', name: 'Pierna entumecida', type: 'leg', desc: 'Camina a regañadientes, arrastrando el pie.', cards: ['paso_lento', 'temblor'], maxHeat: 6, hp: 0, sprite: 'leg_bone', tier: 0 },
    pierna_escriba: { id: 'pierna_escriba', name: 'Pierna de escriba', type: 'leg', desc: 'Piernas de oficinista; nunca corrieron.', cards: ['paso_lento', 'cubrirse'], maxHeat: 6, hp: 0, sprite: 'leg_scholar', tier: 0 },
    pierna_mastin: { id: 'pierna_mastin', name: 'Pierna de mastín', type: 'leg', desc: 'Corvejones de perro; aún quiere perseguir algo.', cards: ['resuello', 'paso_lento'], maxHeat: 6, hp: 1, sprite: 'leg_hound', tier: 0 },
    pierna_cascos: { id: 'pierna_cascos', name: 'Pierna de cascos', type: 'leg', desc: 'Pezuñas partidas, como las de un sátiro de laboratorio.', cards: ['coz', 'embestida'], maxHeat: 7, hp: 2, sprite: 'leg_hoof', tier: 1 },
    pierna_ratonera: { id: 'pierna_ratonera', name: 'Pierna ratonera', type: 'leg', desc: 'Patas cortas y nerviosas que no paran quietas.', cards: ['arrastrarse', 'resuello'], maxHeat: 6, hp: 0, sprite: 'leg_rat', tier: 1 },
    pierna_muelle: { id: 'pierna_muelle', name: 'Pierna de muelle', type: 'leg', desc: 'Un resorte de ballesta en lugar de rodilla.', cards: ['salto_muelle', 'aplanar', 'biela'], maxHeat: 8, hp: 2, sprite: 'leg_spring', tier: 2 },
    pierna_rueda: { id: 'pierna_rueda', name: 'Pierna de rueda', type: 'leg', desc: 'Una rueda dentada que gira sobre su propio eje.', cards: ['tormenta_agujas', 'rodar'], maxHeat: 9, hp: 3, sprite: 'leg_wheel', tier: 2 },
  },

  /** enemies: id -> { id, name, hp, limbs, intents, essence, floorMin } (PRODUCT.md §4.3). 8 enemies: 3 / 3 / 2 by floorMin. */
  enemies: {
    rata_sutura: {
      id: 'rata_sutura', name: 'Rata de sutura', hp: 12,
      limbs: { head: 'cabeza_ratonera', torso: 'torso_apestado', armL: 'brazo_mastin', armR: null, legL: 'pierna_ratonera', legR: 'pierna_ratonera' },
      intents: [{ kind: 'attack', value: 4 }, { kind: 'poison', value: 2 }, { kind: 'attack', value: 3, hits: 2 }],
      essence: 3, floorMin: 0,
    },
    homunculo: {
      id: 'homunculo', name: 'Homúnculo en formol', hp: 15,
      limbs: { head: 'cabeza_formol', torso: 'torso_costillar', armL: 'brazo_tentaculo', armR: 'brazo_tentaculo', legL: 'pierna_ahorcado', legR: 'pierna_ahorcado' },
      intents: [{ kind: 'attack', value: 5 }, { kind: 'heal', value: 4 }, { kind: 'attack', value: 3, hits: 2 }],
      essence: 4, floorMin: 0,
    },
    cientifico: {
      id: 'cientifico', name: 'Científico corrupto', hp: 17,
      limbs: { head: 'cabeza_difunta', torso: 'torso_tunica', armL: 'brazo_jeringa', armR: 'brazo_escriba', legL: 'pierna_escriba', legR: 'pierna_escriba' },
      intents: [{ kind: 'attack', value: 4 }, { kind: 'weak', value: 2 }, { kind: 'block', value: 5 }],
      essence: 4, floorMin: 0,
    },
    perro_quirurgico: {
      id: 'perro_quirurgico', name: 'Perro quirúrgico', hp: 19,
      limbs: { head: 'cabeza_sabueso', torso: 'torso_apestado', armL: 'brazo_mastin', armR: null, legL: 'pierna_mastin', legR: 'pierna_mastin' },
      intents: [{ kind: 'attack', value: 5, hits: 2 }, { kind: 'block', value: 6 }, { kind: 'attack', value: 7 }],
      essence: 5, floorMin: 1,
    },
    alquimista: {
      id: 'alquimista', name: 'Alquimista de la torre', hp: 21,
      limbs: { head: 'cabeza_cuervo', torso: 'torso_tunica', armL: 'brazo_jeringa', armR: 'brazo_garra', legL: 'pierna_cascos', legR: 'pierna_cascos' },
      intents: [{ kind: 'poison', value: 4 }, { kind: 'attack', value: 6 }, { kind: 'heal', value: 6 }, { kind: 'weak', value: 3 }],
      essence: 6, floorMin: 1,
    },
    golem_carne: {
      id: 'golem_carne', name: 'Golem de carne', hp: 27,
      limbs: { head: null, torso: 'torso_amasijo', armL: 'brazo_garra', armR: 'brazo_tentaculo', legL: 'pierna_mastin', legR: 'pierna_mastin' },
      intents: [{ kind: 'attack', value: 8 }, { kind: 'block', value: 8 }, { kind: 'attack', value: 5, hits: 2 }],
      essence: 7, floorMin: 1,
    },
    cuervo_mecanico: {
      id: 'cuervo_mecanico', name: 'Cuervo mecánico', hp: 25,
      limbs: { head: 'cabeza_cuervo', torso: 'torso_tonel', armL: 'brazo_sierra', armR: null, legL: 'pierna_rueda', legR: 'pierna_rueda' },
      intents: [{ kind: 'attack', value: 6, hits: 2 }, { kind: 'weak', value: 3 }, { kind: 'block', value: 6 }, { kind: 'attack', value: 11 }],
      essence: 8, floorMin: 2,
    },
    cirujano_mayor: {
      id: 'cirujano_mayor', name: 'Cirujano mayor', hp: 36,
      limbs: { head: 'cabeza_casco', torso: 'torso_laton', armL: 'brazo_sierra', armR: 'brazo_laton', legL: 'pierna_muelle', legR: 'pierna_rueda' },
      intents: [{ kind: 'attack', value: 9 }, { kind: 'attack', value: 4, hits: 3 }, { kind: 'heal', value: 8 }, { kind: 'poison', value: 5 }],
      essence: 10, floorMin: 2,
    },
  },

  /** Base bodies for the dissection table: [{ name, slots }] with tier-0 limbs only. */
  baseBodies: [
    { name: 'Cadáver de ahorcado', slots: { head: 'cabeza_ahorcado', torso: 'torso_ahorcado', armL: 'brazo_ahorcado', armR: 'brazo_ahorcado', legL: 'pierna_ahorcado', legR: 'pierna_ahorcado' } },
    { name: 'Despojo de fosa común', slots: { head: 'cabeza_difunta', torso: 'torso_apestado', armL: 'brazo_escriba', armR: 'brazo_mastin', legL: 'pierna_escriba', legR: 'pierna_mastin' } },
    { name: 'Espécimen en formol', slots: { head: 'cabeza_formol', torso: 'torso_costillar', armL: 'brazo_escriba', armR: 'brazo_ahorcado', legL: 'pierna_escriba', legR: 'pierna_ahorcado' } },
  ],

  /** Resources found in rooms: id -> { id, name, desc, fx, weight } (ids and fx keys are fixed). */
  resources: {
    vial_vida: { id: 'vial_vida', name: 'Vial de vida', desc: 'Recupera 8 PV.', fx: { heal: 8 }, weight: 35 },
    vial_frio: { id: 'vial_frio', name: 'Vial de escarcha', desc: 'Enfría todas tus extremidades.', fx: { cool: 99 }, weight: 30 },
    esencia: { id: 'esencia', name: 'Esencia alquímica', desc: '+5 de esencia.', fx: { essence: 5 }, weight: 25 },
    pergamino: { id: 'pergamino', name: 'Pergamino anatómico', desc: 'Descubre un plano anatómico.', fx: { blueprint: 1 }, weight: 10 },
  },

  /** cosmetics: id -> { id, name, desc, price, tint } ; tint is a Sprites.TINTS key ('default' is owned from the start). */
  cosmetics: {
    tinte_verdigris: { id: 'tinte_verdigris', name: 'Tinte de verdigris', desc: 'Cobre oxidado: la piel se vuelve estatua enferma.', price: 20, tint: 'verdigris' },
    tinte_ceniza: { id: 'tinte_ceniza', name: 'Tinte de ceniza', desc: 'Gris de horno: pareces hecho de ceniza y polvo de hueso.', price: 30, tint: 'ash' },
    tinte_sangre: { id: 'tinte_sangre', name: 'Tinte de sangre', desc: 'Rojo húmedo: nadie dudará de lo que eres.', price: 40, tint: 'blood' },
    tinte_oro: { id: 'tinte_oro', name: 'Tinte de oro', desc: 'Pan de oro sobre la carne; los alquimistas lo llamaban éxito.', price: 60, tint: 'gold' },
  },

  /** unlocks: id -> { id, name, desc, price, limbs:[limbIds] }. Two packs of three tier-2 limbs each. */
  unlocks: {
    pack_cirujano: {
      id: 'pack_cirujano', name: 'Equipo del cirujano', price: 50,
      desc: 'Planos del mayor de los cirujanos: sierra, brazo de latón y caja torácica remachada.',
      limbs: ['brazo_sierra', 'brazo_laton', 'torso_laton'],
    },
    pack_relojero: {
      id: 'pack_relojero', name: 'Juego del relojero', price: 70,
      desc: 'Planos del autómata: piernas de resorte y de rueda, y un yelmo lleno de ojos.',
      limbs: ['pierna_muelle', 'pierna_rueda', 'cabeza_casco'],
    },
  },
};
