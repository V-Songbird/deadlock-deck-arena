// I18N: Spanish/English text layer. Loaded before every other module so the data
// tables translate their own names and texts while they are being built.
// A dictionary key is the exact Spanish string as written in the code; {0}, {1}...
// keep numbers and names out of the translated text. An unknown key passes through
// unchanged, so Spanish never needs an entry of its own.
window.I18N = (function () {
  'use strict';

  var STORAGE_KEY = 'dd-lang';
  var DEFAULT_LANG = 'es';

  // Every string is drawn with the 8 px "Press Start 2P" font (8 px per glyph) inside a
  // 480x270 canvas, so the English wordings below are kept within the width of the button,
  // panel, card or log line that holds them (see docs/i18n-notes.md).
  var EN = {
    // ------------------------------------------------------------------- page
    'Deadlock Deck: El Reloj Anatómico': 'Deadlock Deck: The Anatomical Clock',

    // --------------------------------------------------------------- families
    // Only ever drawn in the codex header, clipped to 7 glyphs.
    'Cuerpo base': 'Base',
    'Homúnculo': 'Homunculus',
    'Ghoul de laboratorio': 'Laboratory Ghoul',
    'Alquimista corrupto': 'Corrupt Alchemist',
    'Autómata de latón': 'Brass Automaton',
    'Cirujano hereje': 'Heretic Surgeon',
    'Quimera': 'Chimera',

    // ------------------------------------------------------------ slot names
    'Cabeza': 'Head',
    'Torso': 'Torso',
    'Brazo izq.': 'Left arm',
    'Brazo der.': 'Right arm',
    'Pierna izq.': 'Left leg',
    'Pierna der.': 'Right leg',
    'Brazo': 'Arm',
    'Pierna': 'Leg',
    'Izq.': 'Left',
    'Der.': 'Right',
    'muñón': 'stump',
    '{0} (muñón)': '{0} stump',

    // ------------------------------------------------------------- card names
    'Ojo atento': 'Keen Eye',
    'Respiro': 'Breather',
    'Mirada vacía': 'Blank Stare',
    'Guardia torpe': 'Clumsy Guard',
    'Aguantar': 'Brace',
    'Sutura rápida': 'Quick Suture',
    'Golpe seco': 'Dry Blow',
    'Mandoble torpe': 'Clumsy Swing',
    'Patada': 'Kick',
    'Esquiva': 'Dodge',
    'Escapar': 'Escape',
    'Pensamiento enjambre': 'Swarm Mind',
    'Chispa nerviosa': 'Nervous Spark',
    'Caparazón blando': 'Soft Shell',
    'Remiendo veloz': 'Fast Patch',
    'Garras frenéticas': 'Frantic Claws',
    'Dentellada rápida': 'Quick Bite',
    'Patada nerviosa': 'Nervous Kick',
    'Brinco': 'Hop',
    'Fuga de alimaña': 'Vermin Flight',
    'Rugido carroñero': 'Carrion Roar',
    'Hambre voraz': 'Wild Hunger',
    'Carne que rebrota': 'Regrown Flesh',
    'Piel correosa': 'Leather Hide',
    'Desgarro': 'Rend',
    'Aplastamiento': 'Crush',
    'Pisotón pútrido': 'Putrid Stomp',
    'Huida a rastras': 'Crawl Away',
    'Vapor refrescante': 'Cool Vapour',
    'Cálculo alquímico': 'Insight',
    'Bata reforzada': 'Lined Smock',
    'Elixir verde': 'Green Elixir',
    'Inyección corrosiva': 'Corrosive Jab',
    'Vial de ácido': 'Acid Vial',
    'Frasco estallante': 'Burst Flask',
    'Patada tóxica': 'Toxic Kick',
    'Paso refrigerado': 'Cooled Step',
    'Retirada humeante': 'Smoke Retreat',
    'Calibración': 'Calibrate',
    'Engranaje trabado': 'Locked Gear',
    'Blindaje de latón': 'Brass Plate',
    'Caldera a presión': 'Steam Boiler',
    'Golpe de pistón': 'Piston Blow',
    'Sobrecarga': 'Overcharge',
    'Pisotón mecánico': 'Iron Stomp',
    'Marcha forzada': 'Forced March',
    'Pulso firme': 'Steady Hand',
    'Diagnóstico': 'Diagnosis',
    'Transfusión': 'Transfuse',
    'Delantal quirúrgico': 'Surgeon Apron',
    'Bisturí': 'Scalpel',
    'Incisión precisa': 'Precise Cut',
    'Amputación': 'Amputation',
    'Rodillazo clínico': 'Clinic Knee',
    'Paso lateral': 'Sidestep',
    'Retirada quirúrgica': 'Clean Retreat',
    'Mirada de quimera': 'Chimera Gaze',
    'Aullido de tres gargantas': 'Triple Howl',
    'Coraza de escamas': 'Scale Armour',
    'Devorar': 'Devour',
    'Zarpazo quimérico': 'Chimera Claw',
    'Dentellada múltiple': 'Multi Bite',
    'Aniquilación': 'Annihilate',
    'Coz de quimera': 'Chimera Kick',
    'Huida bestial': 'Beast Flight',
    'Muñonazo': 'Stump Smash',
    'Muñonazo ×1': 'Stump Smash ×1',

    // ------------------------------------------------------------- card texts
    'Roba 1 carta.': 'Draw 1 card.',
    'Roba 2 cartas.': 'Draw 2 cards.',
    'Roba 2 cartas. Pierdes 2 de vida.': 'Draw 2 cards. Lose 2 HP.',
    'Enfría este miembro 2.': 'Cool this limb 2.',
    'Enfría todos los miembros 2. Roba 1 carta.': 'Cool every limb 2. Draw 1 card.',
    'Enfría todos los miembros 3.': 'Cool every limb 3.',
    'Debilita 1.': 'Weaken 1.',
    'Debilita 2.': 'Weaken 2.',
    'Debilita 2. Roba 1 carta.': 'Weaken 2. Draw 1 card.',
    'Bloquea 3.': 'Block 3.',
    'Bloquea 4.': 'Block 4.',
    'Bloquea 5.': 'Block 5.',
    'Bloquea 6.': 'Block 6.',
    'Bloquea 7.': 'Block 7.',
    'Bloquea 8.': 'Block 8.',
    'Bloquea 9.': 'Block 9.',
    'Bloquea 12.': 'Block 12.',
    'Bloquea 3. Enfría este miembro 2.': 'Block 3. Cool this limb 2.',
    'Bloquea 5. Roba 1 carta.': 'Block 5. Draw 1 card.',
    'Cúrate 3. Roba 1 carta.': 'Heal 3. Draw 1 card.',
    'Cúrate 4.': 'Heal 4.',
    'Cúrate 5. Enfría este miembro 3.': 'Heal 5. Cool this limb 3.',
    'Cúrate 6.': 'Heal 6.',
    'Cúrate 8.': 'Heal 8.',
    'Cúrate 10.': 'Heal 10.',
    'Ganas 1 de energía.': 'Gain 1 energy.',
    'Ganas 2 de energía. Roba 1 carta.': 'Gain 2 energy. Draw 1 card.',
    'Envenena 4.': 'Poison 4.',
    'Aturde.': 'Stun.',
    'Huyes del combate.': 'You flee the fight.',
    '2 de daño ×2.': '2 damage ×2.',
    '3 de daño.': '3 damage.',
    '3 de daño ×2.': '3 damage ×2.',
    '3 de daño. Golpe torpe de muñón.': '3 damage. Clumsy stump blow.',
    '4 de daño.': '4 damage.',
    '4 de daño. Envenena 2.': '4 damage. Poison 2.',
    '4 de daño. Envenena 3.': '4 damage. Poison 3.',
    '5 de daño.': '5 damage.',
    '5 de daño ×2.': '5 damage ×2.',
    '5 de daño. Bloquea 3.': '5 damage. Block 3.',
    '5 de daño. Cúrate 2.': '5 damage. Heal 2.',
    '5 de daño. Debilita 1.': '5 damage. Weaken 1.',
    '5 de daño. Roba 1 carta.': '5 damage. Draw 1 card.',
    '6 de daño.': '6 damage.',
    '6 de daño. Bloquea 3.': '6 damage. Block 3.',
    '8 de daño.': '8 damage.',
    '8 de daño. Envenena 2.': '8 damage. Poison 2.',
    '10 de daño.': '10 damage.',
    '14 de daño.': '14 damage.',
    '15 de daño.': '15 damage.',

    // ------------------------------------------------------------- limb names
    'Cabeza de ahorcado': 'Head of the Hanged',
    'Cabeza de lunático': 'Head of the Lunatic',
    'Torso remendado': 'Torso of Patches',
    'Torso de fosa común': 'Torso of the Grave',
    'Brazo de sepulturero': 'Arm of the Digger',
    'Brazo de estibador': 'Arm of the Docker',
    'Pierna de vagabundo': 'Leg of the Vagrant',
    'Pierna de peregrino': 'Leg of the Pilgrim',
    'Cráneo de homúnculo': 'Homunculus Skull',
    'Torso de homúnculo': 'Homunculus Torso',
    'Garra de homúnculo': 'Homunculus Claw',
    'Pata de homúnculo': 'Homunculus Paw',
    'Testa de carroñero': 'Carrion Head',
    'Torso putrefacto': 'Putrid Torso',
    'Brazo de osario': 'Ossuary Arm',
    'Zanca de ghoul': 'Ghoul Shank',
    'Cráneo destilador': 'Distiller Skull',
    'Torso alambicado': 'Alembic Torso',
    'Brazo inyector': 'Injector Arm',
    'Pierna de vidrio verde': 'Green Glass Leg',
    'Cabeza de relojería': 'Clockwork Head',
    'Torso de latón': 'Brass Torso',
    'Brazo de pistón': 'Piston Arm',
    'Pierna de engranajes': 'Geared Leg',
    'Cabeza enmascarada': 'Masked Head',
    'Torso de quirófano': 'Surgery Torso',
    'Mano de bisturí': 'Scalpel Hand',
    'Pierna de tendones cosidos': 'Sewn Tendon Leg',
    'Fauces de quimera': 'Chimera Jaws',
    'Torso quimérico': 'Chimera Torso',
    'Zarpa de quimera': 'Chimera Paw',
    'Pata de quimera': 'Chimera Leg',

    // ------------------------------------------- resources, traps, shop items
    'Vial de refrigerante': 'Coolant Vial',
    'Enfría 6 todos los miembros.': 'Cools every limb by 6.',
    'Suturas': 'Sutures',
    'Recuperas 12 de vida.': 'You recover 12 HP.',
    'Engranaje de reloj': 'Clock Gear',
    'Ganas 20 segundos de reloj.': 'You gain 20 seconds.',
    'Icor': 'Ichor',
    'Ganas 8 de icor.': 'You gain 8 ichor.',
    'Púas': 'Spikes',
    'Pierdes 6 de vida; el bloqueo no protege.': 'You lose 6 HP; block does not help.',
    'Ácido alquímico': 'Alchemic Acid',
    'Añade 5 de calor a un miembro al azar; puede romperlo.': 'Adds 5 heat to a random limb.',
    'Piel cadavérica': 'Cadaver Skin',
    'La carne gris verdosa de siempre, con sus costuras a la vista.':
      'The usual grey-green flesh, seams in plain sight.',
    'Suturas de latón': 'Brass Sutures',
    'Las costuras brillan como alambre de latón pulido.': 'The seams shine like polished brass wire.',
    'Suturas de icor': 'Ichor Sutures',
    'Las costuras rezuman icor verde y luminoso.': 'The seams ooze glowing green ichor.',
    'Carne carmesí': 'Crimson Flesh',
    'Carne recién sangrada y costuras de hueso pálido.': 'Freshly bled flesh and pale bone seams.',
    'Planos de la Quimera': 'Chimera Blueprints',
    'Desbloquea los cuatro planos de la Quimera en la mesa.':
      'Unlocks the four Chimera blueprints at the table.',

    // ------------------------------------------------------------- title menu
    'El Reloj Anatómico': 'The Anatomical Clock',
    'Despertar [Enter]': 'Awaken [Enter]',
    'Planos': 'Plans',
    'Tienda': 'Shop',
    'Toca o pulsa una tecla para activar el sonido': 'Tap or press a key to turn on sound',
    'Huidas: {0} · Bucles: {1} · Mejor: {2}': 'Escapes: {0} · Loops: {1} · Best: {2}',

    // ----------------------------------------------------------------- table
    'Mesa de disección': 'Dissection Table',
    'Despiertas sobre una mesa de disección. Nuevo cuerpo. Mismo reloj.':
      'You wake on a dissection table. New body. Same clock.',
    'PV {0}/{1}': 'HP {0}/{1}',
    'Injerto inicial': 'First graft',
    'Ya has usado el injerto de este bucle.': 'Graft already used this loop.',
    'Injertar': 'Graft',
    'Levántate [Enter]': 'Get up [Enter]',
    '¿Qué brazo?': 'Which arm?',
    '¿Qué pierna?': 'Which leg?',
    'Cancelar': 'Cancel',

    // --------------------------------------------------------------- explore
    'Piso {0}/{1}': 'Floor {0}/{1}',
    'Cab': 'Hd',
    'Tor': 'Tr',
    'B.I': 'L.A',
    'B.D': 'R.A',
    'P.I': 'L.L',
    'P.D': 'R.L',
    'Flechas/WASD o desliza · Llega a la salida': 'Arrows/WASD or swipe · Reach the exit',
    'Subes al piso {0}': 'You climb to floor {0}',
    'La Quimera guarda la salida': 'The Chimera guards the exit',
    '¡La Quimera bloquea la salida!': 'The Chimera bars the exit!',
    'El laboratorio se reconfigura…': 'The lab reconfigures itself…',

    // ---------------------------------------------------------------- combat
    'Calor': 'Heat',
    'Bloq {0}': 'Blk {0}',
    'Veneno {0}': 'Poison {0}',
    'Ven {0}': 'Psn {0}',
    'Déb {0}': 'Wk {0}',
    'Aturd.': 'Stun',
    'Fin turno [E]': 'End turn [E]',
    'Te enfrentas a {0}.': 'You face {0}.',
    'Juegas {0}.': 'You play {0}.',
    '¡Se rompe: {0} ({1})!': 'Broken: {0} ({1})!',
    '¡Se rompe: {0}!': 'Broken: {0}!',
    'Tu cuerpo se desploma.': 'Your body collapses.',
    '¡{0} cae!': '{0} falls!',
    '¡Huyes del combate!': 'You flee the fight!',
    '{0} te golpea {1}.': '{0} hits you for {1}.',
    'Tu bloqueo aguanta el golpe.': 'Your block holds.',
    '{0} se cubre {1}.': '{0} guards {1}.',
    'Calor +{0} en {1}': 'Heat +{0} on {1}',
    'No queda miembro que calentar.': 'No limb left to heat.',
    '{0} te envenena {1}.': '{0} poisons you {1}.',
    '{0} se cura {1}.': '{0} heals {1}.',
    'El veneno hace {0} a {1}.': 'Poison deals {0} to {1}.',
    'El veneno te hace {0}.': 'Poison deals {0} to you.',
    '{0} está aturdido.': '{0} is stunned.',

    // --------------------------------------------------------------- harvest
    'Cosecha: {0}': 'Harvest: {0}',
    'Arranca un miembro del cadáver.': 'Tear a limb from the corpse.',
    'Injertar repara un muñón.': 'Grafting repairs a stump.',
    'Descartado': 'Discarded',
    'Descartar': 'Discard',
    '+{0} PV': '+{0} HP',
    'Calor máx. {0} · Enfría {1}': 'Max heat {0} · Cools {1}',
    'I:{0} D:{1}': 'L:{0} R:{1}',
    'Actual: {0}': 'Now: {0}',
    'Continuar [Enter]': 'Continue [Enter]',
    'Cae: {0} (+{1} icor)': 'Down: {0} (+{1} ichor)',
    'Huyes de {0}.': 'You flee {0}.',
    'Injertas: {0} ({1})': 'Grafted: {0} ({1})',
    '¡Nuevo plano anatómico: {0}!': 'New blueprint: {0}!',

    // ------------------------------------------------------- victory / death
    'Has escapado': 'You escaped',
    'de la torre': 'the tower',
    'Tiempo restante: {0}': 'Time left: {0}',
    'Bajas: {0}': 'Kills: {0}',
    'Icor: {0} (+{1} de bonus)': 'Ichor: {0} (+{1} bonus)',
    'Volver': 'Back',
    'Has muerto': 'You died',
    'El reloj marcó las seis. La torre se derrumba sobre ti.':
      'The clock struck six. The tower collapses on you.',
    'Tu cuerpo cae. La torre sigue ardiendo.': 'Your body falls. The tower keeps burning.',
    'Tu espíritu se transporta a una nueva mesa de disección. La torre se regenera. Conservas tus planos.':
      'Your spirit travels to a new dissection table. The tower regenerates. You keep your blueprints.',
    'Bajas: {0} · Icor: {1} · Bucles: {2}': 'Kills: {0} · Ichor: {1} · Loops: {2}',
    'Nueva mesa [Enter]': 'New table [Enter]',

    // ----------------------------------------------------------- codex / shop
    'Planos anatómicos': 'Anatomical plans',
    'Planos: {0}/{1}': 'Plans: {0}/{1}',
    'Volver [Esc]': 'Back [Esc]',
    'Demo gratuita: sin pagos reales. El Icor se gana jugando.':
      'Free demo: no real payments. Ichor is earned in game.',
    'Icor: {0}': 'Ichor: {0}',
    'Equipado': 'Equipped',
    'Equipar': 'Equip',
    'Comprar ({0})': 'Buy ({0})',
    'Desbloqueado': 'Unlocked',
    'Desbloquear ({0})': 'Unlock ({0})',
    'Comprado: {0}': 'Bought: {0}',
    'Desbloqueado: {0}': 'Unlocked: {0}'
  };

  // ------------------------------------------------------------- resolution

  function normalize(value) {
    var v = String(value === null || value === undefined ? '' : value).toLowerCase();
    return (v === 'es' || v === 'en') ? v : '';
  }

  function fromQuery() {
    var m = /[?&]lang=([^&]*)/.exec(window.location.search || '');
    return m ? normalize(decodeURIComponent(m[1])) : '';
  }

  function fromStorage() {
    // file:// and private windows throw on storage: the language is a bonus, never a crash.
    try { return normalize(window.localStorage.getItem(STORAGE_KEY)); }
    catch (e) { return ''; }
  }

  // ?lang= wins, then the stored choice, then Spanish: an untouched URL plays as it always has.
  var lang = fromQuery() || fromStorage() || DEFAULT_LANG;

  // ---------------------------------------------------------------- public

  function current() { return lang; }

  function t(str, args) {
    var out = (str === null || str === undefined) ? '' : String(str);
    if (lang !== DEFAULT_LANG && typeof EN[out] === 'string') out = EN[out];
    if (args === null || args === undefined) return out;
    var list = (Object.prototype.toString.call(args) === '[object Array]') ? args : [args];
    for (var i = 0; i < list.length; i++) out = out.split('{' + i + '}').join(String(list[i]));
    return out;
  }

  function set(next) {
    var want = normalize(next);
    if (!want) return;
    try { window.localStorage.setItem(STORAGE_KEY, want); }
    catch (e) { /* no storage: the ?lang= rewrite below still carries the choice */ }
    var search = String(window.location.search || '');
    // A ?lang= in the URL outranks the stored choice, so the click rewrites it instead
    // of reloading straight back into the language the player just left.
    if (/[?&]lang=/.test(search)) {
      window.location.search = search.replace(/([?&])lang=[^&]*/, '$1lang=' + want);
      return;
    }
    window.location.reload();
  }

  document.documentElement.lang = lang;
  // index.html ships the Spanish title; this is the only pass that rewrites it.
  if (lang !== DEFAULT_LANG) document.title = t('Deadlock Deck: El Reloj Anatómico');

  return { lang: current, t: t, set: set };
})();
