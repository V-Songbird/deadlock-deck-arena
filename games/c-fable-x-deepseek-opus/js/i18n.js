// Language layer: Spanish is the source language, English is a lookup. Owner: I18N worker.
// Loads before every other script. Every player-facing string goes through I18N.t().
const I18N = {
  /** localStorage key holding the chosen language. */
  KEY: 'dd-lang',

  /** @private The language resolved at load; changing it means reloading the page. */
  _lang: 'es',

  /** @returns {'es'|'en'} the active language */
  lang() {
    return I18N._lang;
  },

  /**
   * Translate a Spanish template and fill its {0}, {1}... placeholders.
   * An unknown string is returned exactly as written, so no text is ever lost.
   * @param {string} es the Spanish string exactly as written in the code
   * @param {...(string|number)} args values for the placeholders, in order
   * @returns {string}
   */
  t(es, ...args) {
    const key = String(es);
    const line = I18N._lang === 'en' && typeof I18N.EN[key] === 'string' ? I18N.EN[key] : key;
    if (!args.length) return line;
    return line.replace(/\{(\d+)\}/g, (match, i) => (args[i] === undefined ? match : String(args[i])));
  },

  /**
   * Store the choice and reload, so every string is built again in the new language.
   * A ?lang= in the URL would outrank the store, so it is dropped on the way out.
   * @param {'es'|'en'} lang
   */
  set(lang) {
    const next = I18N._clean(lang);
    if (!next) return;
    try {
      localStorage.setItem(I18N.KEY, next);
    } catch (e) { /* quota or a blocked store: the choice just is not remembered */ }
    const href = location.href.replace(/([?&])lang=[^&#]*&?/g, '$1').replace(/[?&]$/, '');
    if (href === location.href) location.reload();
    else location.replace(href);
  },

  /** @private @returns {'es'|'en'|null} a supported language code, or null */
  _clean(value) {
    const code = String(value === undefined || value === null ? '' : value).trim().toLowerCase();
    return code === 'es' || code === 'en' ? code : null;
  },

  /** @private @returns {string|null} the stored choice, or null when missing or blocked */
  _stored() {
    try {
      return typeof localStorage !== 'undefined' && localStorage ? localStorage.getItem(I18N.KEY) : null;
    } catch (e) {
      return null;   // some privacy modes throw on the mere access
    }
  },

  /** @private ?lang= first, then the store, then the browser locale. @returns {'es'|'en'} */
  _resolve() {
    const fromUrl = I18N._clean(new URLSearchParams(location.search).get('lang'));
    if (fromUrl) return fromUrl;
    const stored = I18N._clean(I18N._stored());
    if (stored) return stored;
    const nav = String((navigator && navigator.language) || '').toLowerCase();
    if (nav.indexOf('es') === 0) return 'es';
    return 'es';   // every other locale also starts in the language the game ships in
  },

  /** @private Translate the markup that index.html cannot wrap itself. */
  _applyDocument() {
    document.documentElement.lang = I18N._lang;
    document.title = I18N.t('Deadlock Deck: El Reloj Anatómico');
    const scene = document.getElementById('scene');
    if (scene) scene.setAttribute('aria-label', I18N.t('Escena del juego'));
  },

  /** Spanish source string -> English. A string missing here falls back to its Spanish form. */
  EN: {
    // ------------------------------------------------------------ data: cards
    'Golpe de muñón': 'Stump blow',
    'Inflige 2 de daño. Un muñón nunca se sobrecalienta.': 'Deals 2 damage. A stump never overheats.',
    'Puñetazo': 'Punch',
    'Un puñetazo torpe con nudillos que ya no sangran.': 'A clumsy punch with knuckles that no longer bleed.',
    'Cubrirse': 'Take cover',
    'Cruzas los brazos y encajas el golpe.': 'You cross your arms and take the blow.',
    'Manotazo': 'Swat',
    'El brazo chasquea como una rama seca.': 'The arm snaps like a dry branch.',
    'Muro de costillas': 'Rib wall',
    'Entrelazas tus costillas como un escudo.': 'You interlock your ribs like a shield.',
    'Mordida': 'Bite',
    'Arrancas un trozo de carne y lo tragas.': 'You tear off a piece of flesh and swallow it.',
    'Temblor': 'Tremor',
    'Un espasmo recorre la carne: golpea y se cierra.': 'A spasm runs through the flesh: it strikes and closes.',
    'Paso lento': 'Slow step',
    'Avanzas un palmo con los brazos por delante.': 'You edge forward with your arms in front.',
    'Resuello': 'Wheeze',
    'Un jadeo de pulmones prestados empuja el golpe.': 'A gasp of borrowed lungs drives the blow.',
    'Doble puño': 'Double fist',
    'Dos golpes rápidos, dos crujidos secos.': 'Two quick blows, two dry cracks.',
    'Escupitajo': 'Spittle',
    'Escupes bilis al ojo del enemigo.': 'You spit bile into the eye of the enemy.',
    'Graznido': 'Caw',
    'Un graznido que afloja los tendones del rival.': 'A caw that loosens the tendons of your rival.',
    'Cabezazo': 'Headbutt',
    'Cabeza contra cabeza; la tuya está cosida con hilo grueso.': 'Head against head; yours is sewn with thick thread.',
    'Garra': 'Claw',
    'Cuatro dedos de hueso abren la carne como papel.': 'Four fingers of bone open the flesh like paper.',
    'Desgarrar': 'Rend',
    'Tiras de la herida hasta oír ceder el tejido.': 'You pull at the wound until the tissue gives way.',
    'Picotazo': 'Peck',
    'El pico de latón busca los ojos.': 'The brass beak goes for the eyes.',
    'Aliento pútrido': 'Putrid breath',
    'Exhalas vapor de formol y podredumbre.': 'You exhale formaldehyde vapour and rot.',
    'Costura rápida': 'Quick stitch',
    'Cinco puntadas y sigues andando.': 'Five stitches and you walk on.',
    'Guardia de latón': 'Brass guard',
    'Placas de latón se cierran sobre el pecho.': 'Brass plates close over the chest.',
    'Venda fría': 'Cold bandage',
    'Un trapo empapado en agua de pozo.': 'A rag soaked in well water.',
    'Ojo de verdigris': 'Verdigris eye',
    'Un ojo de cobre oxidado mira, y el enemigo duda.': 'A rusted copper eye stares, and the enemy hesitates.',
    'Marca del cirujano': 'Surgeon mark',
    'Dibujas la línea de corte sobre el rival.': 'You draw the cutting line on your rival.',
    'Sangría': 'Bloodletting',
    'Abres la vena y dejas que gotee en el suelo.': 'You open the vein and let it drip on the floor.',
    'Pulso ácido': 'Acid pulse',
    'Un vómito verde que corroe desde dentro.': 'A green vomit that corrodes from within.',
    'Siseo': 'Hiss',
    'Un silbido entre dientes muertos; tu cuerpo responde.': 'A whistle between dead teeth; your body answers.',
    'Chasquido': 'Snap',
    'Chascas los dedos y algo se enciende dentro de ti.': 'You snap your fingers and something lights up inside you.',
    'Contorsión': 'Contortion',
    'Doblas huesos que no deberían doblarse.': 'You bend bones that should not bend.',
    'Arrastrarse': 'Crawl',
    'Te arrastras por el suelo buscando otra posición.': 'You crawl along the floor looking for another position.',
    'Inyección': 'Injection',
    'Vacías el frasco dentro de la herida abierta.': 'You empty the vial into the open wound.',
    'Coz': 'Kick',
    'Una patada que rompe costillas ajenas.': 'A kick that breaks the ribs of others.',
    'Trapos húmedos': 'Damp rags',
    'Trapos empapados que ahogan el calor de tus juntas.': 'Soaked rags that smother the heat of your joints.',
    'Pulso débil': 'Faint pulse',
    'Compruebas que aún late, y te recompone.': 'You check that it still beats, and it pulls you together.',
    'Mordida férrea': 'Iron bite',
    'Muerdes, tragas, y la carne nueva se cierra.': 'You bite, you swallow, and the new flesh closes.',
    'Embestida': 'Charge',
    'Cargas con el hombro por delante.': 'You charge shoulder first.',
    'Vidrio molido': 'Ground glass',
    'Cristales de los frascos rotos bajo las uñas.': 'Shards of the broken vials under your nails.',
    'Sierra ósea': 'Bone saw',
    'La hoja gira y muerde el hueso.': 'The blade spins and bites into the bone.',
    'Esquirla': 'Splinter',
    'Un fragmento sale despedido entre la sangre.': 'A fragment flies out through the blood.',
    'Desmembrar': 'Dismember',
    'Arrancas el miembro entero, y algo tuyo con él.': 'You tear off the whole limb, and something of yours with it.',
    'Prensa de latón': 'Brass press',
    'El brazo mecánico aprieta y te sirve de escudo.': 'The mechanical arm squeezes and shields you.',
    'Cuchilla de disección': 'Dissection blade',
    'La hoja fina encuentra la sutura y la abre.': 'The thin blade finds the suture and opens it.',
    'Escarcha': 'Frost',
    'Abres la válvula: el hielo recorre tus venas.': 'You open the valve: ice runs through your veins.',
    'Parálisis': 'Paralysis',
    'El enemigo queda rígido como un espécimen.': 'The enemy goes stiff as a specimen.',
    'Marea de óxido': 'Tide of rust',
    'El herrumbre lo invade todo: carne y metal.': 'The rust invades everything: flesh and metal.',
    'Transfusión': 'Transfusion',
    'Sangre ajena entra a presión en tus costuras.': 'Borrowed blood is forced into your seams.',
    'Ojo quirúrgico': 'Surgical eye',
    'Lo ves todo: la arteria, el tendón, el hueco.': 'You see it all: the artery, the tendon, the gap.',
    'Salto de muelle': 'Spring jump',
    'El resorte te lanza fuera del golpe.': 'The spring throws you clear of the blow.',
    'Biela': 'Connecting rod',
    'Un empujón hidráulico: el motor de tu pierna responde.': 'A hydraulic push: the engine of your leg answers.',
    'Rodar': 'Roll',
    'Ruedas sobre el enemigo hecho una masa de metal.': 'You roll over the enemy as a mass of metal.',
    'Aplanar': 'Flatten',
    'Caes sobre el enemigo con todo el peso de tu cuerpo muerto.': 'You drop on the enemy with all the weight of your dead body.',
    'Tormenta de agujas': 'Needle storm',
    'Cuatro agujas hipodérmicas a la vez.': 'Four hypodermic needles at once.',

    // ------------------------------------------------------------ data: limbs
    'Cabeza de ahorcado': 'Head of a hanged man',
    'Todavía lleva la soga al cuello; la lengua cuelga como una corbata.': 'It still wears the rope; the tongue hangs like a tie.',
    'Cabeza de difunta': 'Head of a dead woman',
    'Conserva la mirada de quien ya no espera nada.': 'It keeps the stare of someone who expects nothing.',
    'Cabeza en formol': 'Head in formaldehyde',
    'Un cerebro flota en formol; todavía recuerda tu nombre.': 'A brain floats in formaldehyde; it still remembers your name.',
    'Cabeza ratonera': 'Rat head',
    'Dientes amarillos que no dejan de castañetear.': 'Yellow teeth that never stop chattering.',
    'Cabeza de sabueso': 'Hound head',
    'Un hocico que ya no distingue a los vivos de la carne.': 'A snout that no longer tells the living from meat.',
    'Cabeza de cuervo': 'Crow head',
    'Máscara de pico negro cosida a un cuello humano.': 'A black beaked mask sewn to a human neck.',
    'Cabeza de casco': 'Helmet head',
    'Un yelmo de latón lleno de ojos de cristal.': 'A brass helm full of glass eyes.',
    'Torso cosido': 'Stitched torso',
    'Costuras gruesas y frías; la soga dejó marca en el cuello.': 'Thick cold seams; the rope left a mark on the neck.',
    'Torso apestado': 'Plagued torso',
    'Piel de perro sobre costillas humanas; apesta a fosa.': 'Dog hide over human ribs; it reeks of the pit.',
    'Costillar desnudo': 'Bare ribcage',
    'Costillas desnudas, sin nada que las tape.': 'Naked ribs, with nothing to cover them.',
    'Torso de tonel': 'Barrel torso',
    'Un tonel flejado donde debería haber pecho.': 'A banded barrel where a chest should be.',
    'Torso de túnica': 'Robed torso',
    'Túnica de profesor manchada de reactivos y de algo peor.': 'A professor robe stained with reagents and something worse.',
    'Amasijo de carne': 'Tangle of flesh',
    'Varios torsos cosidos en uno; gimen con muchas voces.': 'Several torsos sewn into one; they moan with many voices.',
    'Caja torácica de latón': 'Brass ribcage',
    'Latón remachado; dentro late algo que no es tuyo.': 'Riveted brass; inside beats something that is not yours.',
    'Brazo rígido': 'Stiff arm',
    'Pega con la gracia de un tronco.': 'It hits with the grace of a log.',
    'Brazo de escriba': 'Scribe arm',
    'Dedos de tinta y uñas mordidas; aún sabe sostener algo.': 'Inked fingers and bitten nails; it still knows how to hold something.',
    'Brazo de mastín': 'Mastiff arm',
    'Una pata de mastín remendada a un hombro humano.': 'A mastiff leg patched onto a human shoulder.',
    'Brazo de garra': 'Claw arm',
    'Cinco uñas de asta que nunca se cortaron.': 'Five horn nails that were never cut.',
    'Brazo tentáculo': 'Tentacle arm',
    'Un apéndice húmedo que no obedece del todo.': 'A damp appendage that does not quite obey.',
    'Brazo de jeringa': 'Syringe arm',
    'Una jeringa oxidada donde debería estar la mano.': 'A rusted syringe where the hand should be.',
    'Brazo de sierra': 'Saw arm',
    'Una sierra circular de quirófano, todavía caliente.': 'A circular operating room saw, still warm.',
    'Brazo de latón': 'Brass arm',
    'Prótesis de latón con válvulas de refrigerante.': 'A brass prosthetic with coolant valves.',
    'Pierna entumecida': 'Numb leg',
    'Camina a regañadientes, arrastrando el pie.': 'It walks grudgingly, dragging the foot.',
    'Pierna de escriba': 'Scribe leg',
    'Piernas de oficinista; nunca corrieron.': 'Clerk legs; they never ran.',
    'Pierna de mastín': 'Mastiff leg',
    'Corvejones de perro; aún quiere perseguir algo.': 'Dog hocks; it still wants to chase something.',
    'Pierna de cascos': 'Hoofed leg',
    'Pezuñas partidas, como las de un sátiro de laboratorio.': 'Split hooves, like those of a laboratory satyr.',
    'Pierna ratonera': 'Rat leg',
    'Patas cortas y nerviosas que no paran quietas.': 'Short nervous legs that never keep still.',
    'Pierna de muelle': 'Spring leg',
    'Un resorte de ballesta en lugar de rodilla.': 'A crossbow spring instead of a knee.',
    'Pierna de rueda': 'Wheel leg',
    'Una rueda dentada que gira sobre su propio eje.': 'A toothed wheel that spins on its own axle.',

    // ---------------------------------------------------------- data: enemies
    'Rata de sutura': 'Suture rat',
    'Homúnculo en formol': 'Homunculus in formaldehyde',
    'Científico corrupto': 'Corrupt scientist',
    'Perro quirúrgico': 'Surgical dog',
    'Alquimista de la torre': 'Alchemist of the tower',
    'Golem de carne': 'Flesh golem',
    'Cuervo mecánico': 'Mechanical crow',
    'Cirujano mayor': 'Head surgeon',

    // ---------------------------------- data: base bodies, resources and shop
    'Cadáver de ahorcado': 'Corpse of a hanged man',
    'Despojo de fosa común': 'Remains from the mass grave',
    'Espécimen en formol': 'Specimen in formaldehyde',
    'Vial de vida': 'Vial of life',
    'Recupera 8 PV.': 'Restores 8 HP.',
    'Vial de escarcha': 'Vial of frost',
    'Enfría todas tus extremidades.': 'Cools every one of your limbs.',
    'Esencia alquímica': 'Alchemical essence',
    '+5 de esencia.': '+5 essence.',
    'Pergamino anatómico': 'Anatomical scroll',
    'Descubre un plano anatómico.': 'Reveals an anatomical blueprint.',
    'Tinte de verdigris': 'Verdigris dye',
    'Cobre oxidado: la piel se vuelve estatua enferma.': 'Oxidised copper: the skin turns into a sick statue.',
    'Tinte de ceniza': 'Ash dye',
    'Gris de horno: pareces hecho de ceniza y polvo de hueso.': 'Kiln grey: you look made of ash and bone dust.',
    'Tinte de sangre': 'Blood dye',
    'Rojo húmedo: nadie dudará de lo que eres.': 'Wet red: nobody will doubt what you are.',
    'Tinte de oro': 'Gold dye',
    'Pan de oro sobre la carne; los alquimistas lo llamaban éxito.': 'Gold leaf over the flesh; the alchemists called it success.',
    'Equipo del cirujano': 'Surgeon kit',
    'Planos del mayor de los cirujanos: sierra, brazo de latón y caja torácica remachada.': 'Blueprints of the head surgeon: saw, brass arm and riveted ribcage.',
    'Juego del relojero': 'Clockmaker set',
    'Planos del autómata: piernas de resorte y de rueda, y un yelmo lleno de ojos.': 'Blueprints of the automaton: spring and wheel legs, and a helm full of eyes.',

    // ------------------------------------------------- data: slot and type names
    'Cabeza': 'Head',
    'Torso': 'Torso',
    'Brazo izq.': 'Left arm',
    'Brazo der.': 'Right arm',
    'Pierna izq.': 'Left leg',
    'Pierna der.': 'Right leg',
    'Brazo': 'Arm',
    'Pierna': 'Leg',

    // ------------------------------------------------------------ index.html
    'Deadlock Deck: El Reloj Anatómico': 'Deadlock Deck: The Anatomical Clock',
    'Escena del juego': 'Game scene',

    // ------------------------------------------------------------ canvas text
    'El Reloj Anatómico': 'The Anatomical Clock',
    'LA MESA DE DISECCIÓN': 'THE DISSECTION TABLE',
    'TIENDA DE LA TORRE': 'SHOP OF THE TOWER',
    'Compras simuladas: sin dinero real.': 'Simulated purchases: no real money.',
    '{0} de esencia': '{0} essence',
    'Piso {0}/{1}': 'Floor {0}/{1}',
    'Turno {0}': 'Turn {0}',
    'Tú': 'You',
    '{0}/{1} PV': '{0}/{1} HP',
    'Bloqueo {0}': 'Block {0}',
    'Intención': 'Intent',
    'COSECHA': 'HARVEST',
    'de {0}': 'from {0}',
    '+{0} de esencia': '+{0} essence',
    'EL RELOJ LLEGÓ A CERO': 'THE CLOCK RAN OUT',
    'HAS MUERTO': 'YOU ARE DEAD',
    '¡HAS ESCAPADO!': 'YOU ESCAPED!',
    'La torre arde a tu espalda.': 'The tower burns behind you.',
    'Vuln {0}': 'Vuln {0}',
    'Débil {0}': 'Weak {0}',
    'Veneno {0}': 'Poison {0}',
    'Aturd {0}': 'Stun {0}',

    // ------------------------------------------------------------- DOM panel
    'Muñón': 'Stump',
    'Calor {0}/{1}': 'Heat {0}/{1}',
    'Sonido: no': 'Sound: off',
    'Sonido: sí': 'Sound: on',
    'Despiertas en la mesa. La torre arde. Tienes seis minutos.': 'You wake up on the table. The tower burns. You have six minutes.',
    'Despertar': 'Wake up',
    'Despertares: {0}  ·  Huidas: {1}  ·  Esencia: {2}': 'Awakenings: {0}  ·  Escapes: {1}  ·  Essence: {2}',
    'Teclas: WASD/flechas moverse · 1-5 cartas · E terminar turno · M sonido': 'Keys: WASD/arrows move · 1-5 cards · E end turn · M sound',
    'Mesa de disección': 'Dissection table',
    'Cuerpo base: {0}': 'Base body: {0}',
    'Anterior': 'Previous',
    'Siguiente': 'Next',
    'Levantarse': 'Rise',
    'Tienda': 'Shop',
    'Tienda · {0} de esencia': 'Shop · {0} essence',
    'Piel de cadáver': 'Corpse skin',
    'El tinte con el que despertaste. Gratis.': 'The dye you woke up in. Free.',
    'Equipado': 'Equipped',
    'Equipar': 'Equip',
    'Comprar': 'Buy',
    'Desbloqueado': 'Unlocked',
    'Volver': 'Back',
    'Norte': 'North',
    'Oeste': 'West',
    'Este': 'East',
    'Sur': 'South',
    'Energía {0}/{1}': 'Energy {0}/{1}',
    'Terminar turno': 'End turn',
    'Coste {0}': 'Cost {0}',
    'Calor {0}': 'Heat {0}',
    'Cosecha de {0}': 'Harvest from {0}',
    '{0} · calor máx. {1}': '{0} · max heat {1}',
    ' · +{0} PV': ' · +{0} HP',
    'Izq': 'Left',
    'Der': 'Right',
    'Injertar': 'Graft',
    'Seguir sin injertar': 'Move on without grafting',
    'El reloj llegó a cero': 'The clock ran out',
    'Has muerto: {0}': 'You died: {0}',
    'Piso {0}/{1}  ·  Enemigos: {2}  ·  Injertos: {3}  ·  Esencia: {4}': 'Floor {0}/{1}  ·  Enemies: {2}  ·  Grafts: {3}  ·  Essence: {4}',
    'Volver a la mesa': 'Back to the table',
    '¡Has escapado de la torre!': 'You escaped the tower!',
    'Tiempo restante: {0}  ·  Esencia: {1}  ·  Huidas: {2}': 'Time left: {0}  ·  Essence: {1}  ·  Escapes: {2}',

    // ------------------------------------------------------------- run events
    '¡El laberinto se retuerce!': 'The labyrinth twists!',
    'Injertas {0} en tu {1}': 'You graft {0} onto your {1}',
    'Esencia insuficiente': 'Not enough essence',
    'Compras {0}': 'You buy {0}',
    'el reloj': 'the clock',
    'una trampa': 'a trap',
    'Un hallazgo': 'A find',
    '{0}: recuperas {1} PV.': '{0}: you recover {1} HP.',
    '{0}: el frío recorre tus junturas.': '{0}: the cold runs through your joints.',
    '{0}: +{1} de esencia.': '{0}: +{1} essence.',
    '{0}: descubres {1}.': '{0}: you discover {1}.',
    '{0}: ya no queda plano por descubrir; +10 de esencia.': '{0}: there is no blueprint left to discover; +10 essence.',
    '¡Una trampa! Pierdes {0} PV.': 'A trap! You lose {0} HP.',
    ' Se te rompe la {0}': ' Your {0} breaks',
    ' y la ': ' and ',
    'Subes al piso {0}': 'You climb to floor {0}',

    // ---------------------------------------------------------- combat log
    '¡{0} cae!': '{0} falls!',
    'Tu cuerpo se desmorona.': 'Your body falls apart.',
    'Algo': 'Something',
    'Te enfrentas a {0}.': 'You face {0}.',
    'Juegas {0}.': 'You play {0}.',
    '{0} recibe {1} de daño.': '{0} takes {1} damage.',
    'Recuperas {0} PV.': 'You recover {0} HP.',
    'Te cuesta {0} PV.': 'It costs you {0} HP.',
    '¡Tu {0} se parte!': 'Your {0} snaps!',
    'El veneno consume a {0} ({1}).': 'The poison eats away at {0} ({1}).',
    '{0} está aturdido.': '{0} is stunned.',
    '{0} te golpea por {1}.': '{0} hits you for {1}.',
    '{0} se protege.': '{0} guards.',
    '{0} se cose las heridas.': '{0} stitches up its wounds.',
    '{0} te envenena ({1}).': '{0} poisons you ({1}).',
    '{0} te debilita.': '{0} weakens you.',
    'El veneno te consume ({0}).': 'The poison eats away at you ({0}).',
    'Ataca {0}×{1}': 'Attacks {0}×{1}',
    'Ataca {0}': 'Attacks {0}',
    'Se protege {0}': 'Guards {0}',
    'Se cose {0}': 'Stitches {0}',
    'Envenena {0}': 'Poisons {0}',
    'Debilita {0}': 'Weakens {0}',
  },
};

I18N._lang = I18N._resolve();
I18N._applyDocument();
