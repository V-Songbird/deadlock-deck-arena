// DD.I18N — Spanish/English text layer for Deadlock Deck: El Reloj Anatómico.
// Loaded before every other module: the data tables translate their own names while they
// are being built, so nothing has to be re-translated later.
// A dictionary key is the exact Spanish string as written in the code; placeholders
// {0}, {1}... keep numbers and names out of the translated text. An unknown key passes
// through unchanged, so Spanish never needs an entry of its own.
window.DD = window.DD || {};

(function (DD) {
  'use strict';

  var STORAGE_KEY = 'dd-lang';
  var DEFAULT_LANG = 'es';

  // Strings drawn on the canvas go through the 5x5 pixel font of src/render.js, which
  // knows A-Z, 0-9 and ': . , ! - / + ?' only. Those entries stay inside that set.
  var EN = {
    // ---------------------------------------------------------------- limb names
    'Cabeza Vacía': 'Vacant Head',
    'Cráneo del Erudito': 'Scholar Skull',
    'Cabeza-Horno': 'Furnace Head',
    'Testa de Sabueso': 'Hound Head',
    'Torso Cosido': 'Sewn Torso',
    'Caja Torácica de Latón': 'Brass Ribcage',
    'Torso Alambique': 'Alembic Torso',
    'Torso Errante': 'Wandering Torso',
    'Brazo Marchito': 'Withered Arm',
    'Brazo Cuchilla': 'Cleaver Arm',
    'Brazo Fuelle': 'Bellows Arm',
    'Brazo Aguja': 'Needle Arm',
    'Guantelete de Latón': 'Brass Gauntlet',
    'Pierna Renqueante': 'Limping Leg',
    'Zanca de Sabueso': 'Hound Shank',
    'Pierna de Pistón': 'Piston Leg',
    'Pierna Raíz': 'Root Leg',

    // ---------------------------------------------------------------- limb plurals
    'Brazos Marchitos': 'Withered Arms',
    'Brazos Cuchilla': 'Cleaver Arms',
    'Brazos Fuelle': 'Bellows Arms',
    'Brazos Aguja': 'Needle Arms',
    'Guanteletes de Latón': 'Brass Gauntlets',
    'Piernas Renqueantes': 'Limping Legs',
    'Zancas de Sabueso': 'Hound Shanks',
    'Piernas de Pistón': 'Piston Legs',
    'Piernas Raíz': 'Root Legs',

    // ---------------------------------------------------------------- limb descriptions
    'Cráneo hueco que aún mira. Aguanta poco antes de agrietarse.':
      'A hollow skull that still stares. It cracks before long.',
    'Cráneo de un erudito corrupto; susurra fórmulas robadas.':
      'Skull of a corrupt scholar; it whispers stolen formulas.',
    'Horno portátil por cabeza: potencia brutal, calor brutal.':
      'A portable furnace for a head: brutal power, brutal heat.',
    'Testa cenicienta de sabueso: buen olfato, dientes largos.':
      'Ashen hound head: keen nose, long teeth.',
    'Torso remendado con hilo negro. Se tensa y tiembla.':
      'A torso patched with black thread. It tightens and trembles.',
    'Coraza de latón remachada: aguanta golpes y devuelve vapor.':
      'Riveted brass armour: it takes blows and answers with steam.',
    'Torso de alambique: destila la carne y escupe ácido.':
      'An alembic torso: it distils flesh and spits acid.',
    'Torso errante que se retuerce y arranca injertos ajenos.':
      'A wandering torso that writhes and tears off the grafts of others.',
    'Brazo seco y ligero. Golpea sin calentarse apenas.':
      'A dry, light arm. It strikes and barely heats up.',
    'Brazo-cuchilla de carnicero: corta y desuella.':
      'A butcher cleaver arm: it cuts and it flays.',
    'Brazo-fuelle: sopla ráfagas ardientes y aire helado.':
      'A bellows arm: it blows burning gusts and frozen air.',
    'Brazo-aguja de cirujano: sutura y envenena la sangre.':
      'A surgeon needle arm: it sutures and poisons the blood.',
    'Guantelete de latón: martillo pesado y parada firme.':
      'A brass gauntlet: heavy hammer and firm parry.',
    'Pierna renqueante. Anda mal, pero anda.':
      'A limping leg. It walks badly, but it walks.',
    'Zanca de sabueso: garra afilada y trote incansable.':
      'A hound shank: sharp claw and tireless trot.',
    'Pierna de pistón: pisotones y vapor a presión.':
      'A piston leg: stomps and pressurised steam.',
    'Pierna-raíz: se ancla al suelo y bebe sangre.':
      'A root leg: it anchors to the ground and drinks blood.',

    // ---------------------------------------------------------------- card names
    'Mirada Turbia': 'Cloudy Gaze',
    'Gemido': 'Moan',
    'Memoria Robada': 'Stolen Memory',
    'Sílaba Prohibida': 'Forbidden Syllable',
    'Sobrepresión': 'Overpressure',
    'Purga de Vapor': 'Steam Purge',
    'Olfato de Ceniza': 'Ash Scent',
    'Dentellada': 'Bite',
    'Costura Tensa': 'Tight Seam',
    'Espasmo': 'Spasm',
    'Baluarte': 'Bulwark',
    'Pistones': 'Pistons',
    'Transmutar': 'Transmute',
    'Flor de Ácido': 'Acid Bloom',
    'Retorcerse': 'Writhe',
    'Tirón de Injerto': 'Graft Yank',
    'Golpe Seco': 'Dry Blow',
    'Agarre': 'Grapple',
    'Tajo': 'Slash',
    'Desollar': 'Flay',
    'Ráfaga': 'Gust',
    'Bomba Fría': 'Cold Pump',
    'Sutura': 'Suture',
    'Inyección': 'Injection',
    'Martillo': 'Hammer',
    'Parada': 'Parry',
    'Patada': 'Kick',
    'Paso Torpe': 'Clumsy Step',
    'Zarpazo': 'Claw Swipe',
    'Carrera': 'Sprint',
    'Pisotón': 'Stomp',
    'Impulso de Vapor': 'Steam Surge',
    'Anclaje': 'Anchor',
    'Raíz Sedienta': 'Thirsty Root',
    'Muñón: Mirada Vacía': 'Stump: Vacant Gaze',
    'Muñón: Bamboleo': 'Stump: Lurch',
    'Muñón: Manotazo': 'Stump: Swat',
    'Muñón: Arrastre': 'Stump: Drag',

    // ---------------------------------------------------------------- card texts
    'Roba 1.': 'Draw 1.',
    'Inflige 2.': 'Deal 2.',
    'Inflige 4.': 'Deal 4.',
    'Inflige 5.': 'Deal 5.',
    'Inflige 7.': 'Deal 7.',
    'Inflige 8.': 'Deal 8.',
    'Inflige 11.': 'Deal 11.',
    'Inflige 13.': 'Deal 13.',
    'Roba 2. Energía +1.': 'Draw 2. Energy +1.',
    'Inflige 9. Aplica Vulnerable 2.': 'Deal 9. Apply Vulnerable 2.',
    'Enfría 4.': 'Cool 4.',
    'Roba 1. +3 s.': 'Draw 1. +3 s.',
    'Inflige 5. Aplica Sangrado 2.': 'Deal 5. Apply Bleed 2.',
    'Bloqueo 1. Roba 1.': 'Block 1. Draw 1.',
    'Bloqueo 2.': 'Block 2.',
    'Bloqueo 3.': 'Block 3.',
    'Bloqueo 6.': 'Block 6.',
    'Bloqueo 8.': 'Block 8.',
    'Bloqueo 9.': 'Block 9.',
    'Bloqueo 10.': 'Block 10.',
    'Inflige 4. Bloqueo 3.': 'Deal 4. Block 3.',
    'Inflige 7. Bloqueo 7.': 'Deal 7. Block 7.',
    'Cura 7.': 'Heal 7.',
    'Inflige 4. Aplica Sangrado 4.': 'Deal 4. Apply Bleed 4.',
    'Bloqueo 4. Roba 1.': 'Block 4. Draw 1.',
    'Inflige 8. Cosecha todos los injertos.': 'Deal 8. Harvest every graft.',
    'Inflige 6. Cosecha todos los injertos.': 'Deal 6. Harvest every graft.',
    'Inflige 3. Aplica Debilidad 2.': 'Deal 3. Apply Weak 2.',
    'Enfría 3. Energía +1.': 'Cool 3. Energy +1.',
    'Cura 4. Bloqueo 3.': 'Heal 4. Block 3.',
    'Inflige 4. Aplica Sangrado 3.': 'Deal 4. Apply Bleed 3.',
    'Inflige 6. Energía +1.': 'Deal 6. Energy +1.',
    'Inflige 9. Aturde.': 'Deal 9. Stun.',
    'Inflige 4. Cura 4.': 'Deal 4. Heal 4.',

    // ---------------------------------------------------------------- enemies
    'Ayudante Suturado': 'Sutured Assistant',
    'Científico Corrupto': 'Corrupt Scientist',
    'Homúnculo de Vapor': 'Steam Homunculus',
    'Perro de Cenizas': 'Ash Hound',
    'Guardia de Latón': 'Brass Guard',
    'Portero de Latón': 'Brass Porter',
    'Ayudante de laboratorio cosido a mano. Obediente y letal.':
      'A hand-sewn laboratory assistant. Obedient and lethal.',
    'Un científico corrompido por sus propias fórmulas.':
      'A scientist corrupted by his own formulas.',
    'Homúnculo de vapor que hierve por dentro y golpea tres veces.':
      'A steam homunculus that boils inside and strikes three times.',
    'Sabueso de ceniza: rápido, hambriento y sangriento.':
      'An ash hound: fast, hungry and bloody.',
    'Torso errante que arrastra sus propios intestinos.':
      'A wandering torso dragging its own intestines.',
    'Guardia de latón: lento, blindado y brutal.':
      'A brass guard: slow, armoured and brutal.',
    'El Portero de Latón custodia la puerta. No deja salir a nadie.':
      'The Brass Porter guards the gate. It lets nobody out.',

    // ---------------------------------------------------------------- rooms
    'Mesa de disección': 'Dissection Table',
    'Portón en llamas': 'Burning Gate',
    'Pasillo de jaulas': 'Corridor of Cages',
    'Sala de vivisección': 'Vivisection Room',
    'Galería de tarros': 'Gallery of Jars',
    'Alcoba de cobayas': 'Alcove of Test Subjects',
    'Depósito de cadáveres': 'Corpse Store',
    'Taller de prótesis': 'Prosthetics Workshop',
    'Armería de latón': 'Brass Armoury',
    'Cámara del guardia': 'Guard Chamber',
    'Alacena de injertos': 'Graft Larder',
    'Armario de reactivos': 'Reagent Cabinet',
    'Estante de frascos': 'Shelf of Flasks',
    'Corredor de sierras': 'Corridor of Saws',
    'Foso de ácido': 'Acid Pit',
    'Trampa de vapor': 'Steam Trap',
    'Pasillo desierto': 'Deserted Hallway',
    'Hueco de escaleras': 'Stairwell',
    'Celda saqueada': 'Looted Cell',
    'Rincón de ceniza': 'Ash Corner',

    // ---------------------------------------------------------------- body slots
    'Cabeza': 'Head',
    'Torso': 'Torso',
    'Brazo izq.': 'Left arm',
    'Brazo der.': 'Right arm',
    'Pierna izq.': 'Left leg',
    'Pierna der.': 'Right leg',
    'cabeza': 'head',
    'torso': 'torso',
    'brazo izquierdo': 'left arm',
    'brazo derecho': 'right arm',
    'pierna izquierda': 'left leg',
    'pierna derecha': 'right leg',
    'la cabeza': 'the head',
    'el torso': 'the torso',
    'el brazo izquierdo': 'the left arm',
    'el brazo derecho': 'the right arm',
    'la pierna izquierda': 'the left leg',
    'la pierna derecha': 'the right leg',
    'Muñón': 'Stump',
    'muñón': 'stump',
    'muñones': 'stumps',
    'Cuerpo vacío': 'Empty body',
    'dos {0}': 'two {0}',

    // ---------------------------------------------------------------- statuses
    'Sangrado': 'Bleed',
    'Vulnerable': 'Vulnerable',
    'Débil': 'Weak',

    // ---------------------------------------------------------------- combat log
    'Robas {0}.': 'You draw {0}.',
    '{0} se rompe.': '{0} breaks.',
    'Calor +{0} en {1}.': 'Heat +{0} on {1}.',
    '¡El enemigo cae!': 'The enemy falls!',
    'Tu cuerpo se deshace.': 'Your body comes apart.',
    'El enemigo bloquea {0}.': 'The enemy blocks {0}.',
    '{0} de daño al enemigo.': '{0} damage to the enemy.',
    'Bloqueas {0}.': 'You block {0}.',
    'Recibes {0} de daño.': 'You take {0} damage.',
    'Sangras {0}.': 'You bleed {0}.',
    'Ganas {0} de bloque.': 'You gain {0} block.',
    'Te coses {0} PV.': 'You stitch {0} HP.',
    'Energía +{0}.': 'Energy +{0}.',
    'Se enfría tu carne.': 'Your flesh cools down.',
    'Aplicas {0} {1}.': 'You apply {0} {1}.',
    'El enemigo queda aturdido.': 'The enemy is stunned.',
    'Puedes cosechar todo el cuerpo.': 'You can harvest the whole body.',
    'El reloj retrocede {0} s.': 'The clock winds back {0} s.',
    'Turno {0}.': 'Turn {0}.',
    '{0} ataca.': '{0} attacks.',
    '{0} ataca {1} veces.': '{0} attacks {1} times.',
    'El enemigo se protege.': 'The enemy guards itself.',
    'No queda carne que quemar.': 'No flesh left to burn.',
    'El enemigo te recalienta.': 'The enemy overheats you.',
    'Sufres {0} {1}.': 'You suffer {0} {1}.',
    'El enemigo sangra {0}.': 'The enemy bleeds {0}.',
    'El enemigo está aturdido.': 'The enemy is still stunned.',
    '¡{0} te cierra el paso!': '{0} blocks your way!',
    'Juegas {0}.': 'You play {0}.',
    'Terminas el turno.': 'You end your turn.',

    // ---------------------------------------------------------------- HUD and cards
    'Ciclo {0}': 'Cycle {0}',
    'Energía {0}/{1}': 'Energy {0}/{1}',
    'Terminar turno': 'End turn',
    '{0}. Coste {1}. Calor {2}. {3}': '{0}. Cost {1}. Heat {2}. {3}',
    'ROTA': 'BROKEN',
    'VACÍA': 'EMPTY',
    'Sonido': 'Sound',
    'Anatomía': 'Anatomy',
    'Movimiento': 'Movement',
    'Norte': 'North',
    'Sur': 'South',
    'Este': 'East',
    'Oeste': 'West',
    'Sonido activado (M)': 'Sound on (M)',
    'Sonido silenciado (M)': 'Sound muted (M)',
    'Sonido activado.': 'Sound on.',
    'Sonido silenciado.': 'Sound muted.',
    'Cambiar a English': 'Switch to Español',
    'Deadlock Deck: El Reloj Anatómico': 'Deadlock Deck: The Anatomical Clock',

    // ---------------------------------------------------------------- rooms and events
    'La mesa de disección te recibe.': 'The dissection table receives you.',
    'La mesa de disección enfría tu carne.': 'The dissection table cools your flesh.',
    '¡Trampa! Pierdes {0} PV.': 'Trap! You lose {0} HP.',
    '¡Trampa! El reloj pierde {0} s.': 'Trap! The clock loses {0} s.',
    'Alacena: te coses {0} PV.': 'Larder: you stitch {0} HP.',
    'La alacena está vacía.': 'The larder is empty.',
    'La alacena enfría tus injertos y repara {0}.':
      'The larder cools your grafts and repairs {0}.',
    'La alacena enfría todos tus injertos.': 'The larder cools all your grafts.',
    'Plano anatómico': 'Anatomical Plan',
    'Plano anatómico: {0}': 'Anatomical plan: {0}',
    'Plano anatómico: {0}.': 'Anatomical plan: {0}.',
    'Un injerto entero, todavía tibio. Puedes cosértelo aquí mismo.':
      'A whole graft, still warm. You can stitch it on right here.',

    // ---------------------------------------------------------------- graft dialogs
    ' y ': ' and ',
    'Injertar en {0}': 'Graft onto {0}',
    'Dejar': 'Leave it',
    'Te lo piensas y sigues tu camino.': 'You think better of it and walk on.',
    'Recuerdas un plano anatómico. La mesa puede cosértelo gratis antes de que salgas.':
      'You remember one anatomical plan. The table can stitch it on for free before you leave.',
    'Recuerdas {0} planos anatómicos. La mesa puede coserte uno gratis antes de que salgas.':
      'You remember {0} anatomical plans. The table can stitch one on for free before you leave.',
    'Arrancas {0} del cadáver. Coserte algo cuesta {1} s de reloj.':
      'You tear {0} off the corpse. Stitching one on costs {1} s of clock.',
    'Cosecha: {0}': 'Harvest: {0}',
    'Injertas {0} en {1}. La mesa no te cobra reloj.':
      'You graft {0} onto {1}. The table charges you no clock.',
    'Injertas {0} en {1}. -{2} s de reloj.': 'You graft {0} onto {1}. -{2} s of clock.',

    // ------------------------------------------------- canvas screens (pixel font only)
    'EL RELOJ ANATÓMICO': 'THE ANATOMICAL CLOCK',
    'SEIS MINUTOS. UN CUERPO PRESTADO.': 'SIX MINUTES. ONE BORROWED BODY.',
    'PULSA O TOCA PARA EMPEZAR': 'PRESS OR TAP TO BEGIN',
    'MEJOR ESCAPE: {0}': 'BEST ESCAPE: {0}',
    'CICLO {0}': 'CYCLE {0}',
    'HAS MUERTO': 'YOU HAVE DIED',
    'EL RELOJ ANATÓMICO TE VUELVE A MONTAR': 'THE ANATOMICAL CLOCK REBUILDS YOU',
    'PULSA O TOCA PARA RENACER': 'PRESS OR TAP TO BE REBORN',
    'HAS ESCAPADO': 'YOU HAVE ESCAPED',
    'TIEMPO RESTANTE {0}': 'TIME REMAINING {0}',
    'PLANOS ANATÓMICOS {0}': 'ANATOMICAL PLANS {0}',
    'BAJAS {0} - CICLO {1}': 'KILLS {0} - CYCLE {1}',
    'PULSA O TOCA PARA UN NUEVO CICLO': 'PRESS OR TAP FOR A NEW CYCLE',
    'Tus costuras ceden y el cuerpo se desarma.':
      'YOUR SEAMS GIVE WAY AND THE BODY FALLS APART.',
    'El reloj anatómico llega a 0:00 y tu carne se deshace.':
      'THE ANATOMICAL CLOCK HITS 0:00 AND YOUR FLESH FALLS APART.',
    'Escapas con: {0}.': 'You escape with: {0}.'
  };

  // ------------------------------------------------------------------ resolution

  function fromQuery() {
    var m = /[?&]lang=([^&]*)/.exec(window.location.search || '');
    return m ? normalize(decodeURIComponent(m[1])) : '';
  }

  function fromStorage() {
    try {
      return window.localStorage ? normalize(window.localStorage.getItem(STORAGE_KEY)) : '';
    } catch (e) {
      return '';   // file:// and private windows throw: the language is a bonus, never a crash
    }
  }

  function normalize(value) {
    var v = String(value == null ? '' : value).toLowerCase();
    return (v === 'es' || v === 'en') ? v : '';
  }

  // ?lang= wins, then a stored choice, then the browser. Spanish is both the shipped
  // language and the fallback, so an untouched URL plays exactly as it always has.
  function resolve() {
    var q = fromQuery();
    if (q) return q;
    var saved = fromStorage();
    if (saved) return saved;
    var nav = String((window.navigator && window.navigator.language) || '').toLowerCase();
    return nav.indexOf('es') === 0 ? 'es' : DEFAULT_LANG;
  }

  var lang = resolve();

  // ------------------------------------------------------------------ public API

  function current() {
    return lang;
  }

  function t(s, args) {
    var out = s == null ? '' : String(s);
    if (lang !== DEFAULT_LANG && typeof EN[out] === 'string') out = EN[out];
    if (args != null) {
      var list = Object.prototype.toString.call(args) === '[object Array]' ? args : [args];
      for (var i = 0; i < list.length; i++) {
        out = out.split('{' + i + '}').join(String(list[i]));
      }
    }
    return out;
  }

  function set(next) {
    var want = normalize(next);
    if (!want) return;
    try {
      if (window.localStorage) window.localStorage.setItem(STORAGE_KEY, want);
    } catch (e) { /* no storage: the ?lang= rewrite below still carries the choice */ }
    // A ?lang= in the URL outranks the stored choice, so the click rewrites it instead
    // of reloading into the language the player just left.
    if (fromQuery()) {
      window.location.search = String(window.location.search || '')
        .replace(/([?&])lang=[^&]*/, '$1lang=' + want);
      return;
    }
    window.location.reload();
  }

  // ------------------------------------------------------------------ static markup

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, value) {
    var node = byId(id);
    if (node) node.textContent = value;
  }

  function setLabel(id, value) {
    var node = byId(id);
    if (node) node.setAttribute('aria-label', value);
  }

  // index.html ships its labels in Spanish; this is the only pass that rewrites them.
  function applyStatic() {
    document.documentElement.lang = lang;
    document.title = t('Deadlock Deck: El Reloj Anatómico');
    setText('cycle-text', t('Ciclo {0}', 1));
    setText('btn-end-turn', t('Terminar turno'));
    setText('room-label', t('Mesa de disección'));
    setLabel('btn-sound', t('Sonido'));
    setLabel('anatomy', t('Anatomía'));
    setLabel('explore-bar', t('Movimiento'));
    setLabel('btn-n', t('Norte'));
    setLabel('btn-s', t('Sur'));
    setLabel('btn-e', t('Este'));
    setLabel('btn-w', t('Oeste'));

    // The ES/EN button shows the language it switches to, next to the sound button.
    var btn = byId('btn-lang');
    if (!btn) return;
    var other = lang === 'es' ? 'en' : 'es';
    btn.textContent = other.toUpperCase();
    btn.setAttribute('aria-label', t('Cambiar a English'));
    btn.title = t('Cambiar a English');
    btn.addEventListener('click', function () { set(other); });
  }

  DD.I18N = { lang: current, t: t, set: set };
  DD.T = t;   // call-site shorthand: every module translates with DD.T('...')

  applyStatic();
})(window.DD);
