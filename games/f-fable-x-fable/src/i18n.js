// Deadlock Deck: El Reloj Anatómico — Spanish/English text layer (DD.i18n, DD.t).
// Loaded before core.js: DD.SLOT_NAME and the whole of data.js translate their own literals
// while they are being built, so every consumer reads the active language for free.
// A dictionary key is the EXACT Spanish string as written in the code; {0}, {1}... keep
// numbers and names out of the translated text. An unknown key passes through unchanged,
// so Spanish needs no entries and identical wordings ('Torso', 'Vulnerable {0}') need none either.
// Every English wording below is sized for the 640×360 pixel font (5×8 cell, 6 px advance):
// see docs/build-log.md for the per-panel widths that were measured.
window.DD = window.DD || {};

(function () {
  'use strict';
  const KEY = 'dd-lang';

  const EN = {
    // ------------------------------------------------------------------ body slots (core.js)
    'Cabeza': 'Head',
    'Brazo izq.': 'Left arm',
    'Brazo der.': 'Right arm',
    'Pierna izq.': 'Left leg',
    'Pierna der.': 'Right leg',
    'Brazo': 'Arm',
    'Pierna': 'Leg',
    'Cabezas': 'Heads',
    'Brazos': 'Arms',
    'Piernas': 'Legs',
    'MUÑÓN': 'STUMP',
    'muñón': 'stump',

    // ------------------------------------------------------------------ card names
    'Golpe de muñón': 'Stump Blow',
    'Chispazo': 'Spark',
    'Mirada fija': 'Cold Stare',
    'Recordar': 'Recall',
    'Cabezazo': 'Headbutt',
    'Cuello roto': 'Snapped Neck',
    'Lengua fuera': 'Lolling Tongue',
    'Cubrirse': 'Cover Up',
    'Sutura': 'Suture',
    'Encogerse': 'Hunch Down',
    'Aguante': 'Endurance',
    'Golpe rígido': 'Stiff Blow',
    'Zarpazo': 'Claw Swipe',
    'Palada': 'Shovelful',
    'Paletazo': 'Spade Whack',
    'Patada tiesa': 'Stiff Kick',
    'Plantarse': 'Stand Firm',
    'Pirueta': 'Pirouette',
    'Puntapié': 'Toe Kick',
    'Paso ligero': 'Light Step',
    'Pinchazo': 'Jab',
    'Doble pincho': 'Double Jab',
    'Escabullirse': 'Slip Away',
    'Brinco': 'Hop',
    'Mordisco': 'Bite',
    'Olfatear': 'Sniff Out',
    'Aullido': 'Howl',
    'Embestida': 'Charge',
    'Acecho': 'Stalk',
    'Frasco frío': 'Cold Flask',
    'Reactivo': 'Reagent',
    'Frasco ácido': 'Acid Flask',
    'Fuego griego': 'Greek Fire',
    'Bisturí': 'Scalpel',
    'Precisión': 'Precision',
    'Sutura veloz': 'Fast Suture',
    'Diagnóstico': 'Diagnosis',
    'Anestesia': 'Anesthesia',
    'Pistón': 'Piston',
    'Válvula': 'Valve',
    'Blindaje': 'Plating',
    'Ventilar': 'Vent',
    'Caldera': 'Boiler',
    'Pisotón': 'Stomp',
    'Anclaje': 'Anchor',
    'Purga': 'Purge',
    'Carne densa': 'Dense Flesh',
    'Regeneración': 'Regrowth',
    'Aplastar': 'Crush',
    'Manotazo': 'Backhand',
    'Terremoto': 'Earthquake',
    'Montaña': 'Mountain',
    'Mente lúcida': 'Lucid Mind',
    'Transmutar': 'Transmute',
    'Maldición': 'Curse',
    'Égida': 'Aegis',
    'Piedra roja': 'Red Stone',

    // ------------------------------------------------------ card descriptions (11 chars/line, 5 lines)
    'Inflige 3 de daño.': 'Deal 3 damage.',
    'Inflige 4 de daño.': 'Deal 4 damage.',
    'Inflige 5 de daño.': 'Deal 5 damage.',
    'Inflige 6 de daño.': 'Deal 6 damage.',
    'Inflige 7 de daño.': 'Deal 7 damage.',
    'Inflige 8 de daño.': 'Deal 8 damage.',
    'Inflige 9 de daño.': 'Deal 9 damage.',
    'Inflige 10 de daño.': 'Deal 10 damage.',
    'Inflige 11 de daño.': 'Deal 11 damage.',
    'Inflige 14 de daño.': 'Deal 14 damage.',
    'Inflige 3 de daño 2 veces.': 'Deal 3 damage twice.',
    'Inflige 3 de daño 3 veces.': 'Deal 3 damage 3 times.',
    'Inflige 9 de daño 2 veces.': 'Deal 9 damage twice.',
    'Inflige 3 de daño y roba 1.': 'Deal 3 damage, draw 1.',
    'Inflige 5 de daño y roba 1.': 'Deal 5 damage, draw 1.',
    'Inflige 4 de daño y gana 3 de bloqueo.': 'Deal 4 damage, gain 3 block.',
    'Inflige 4 de daño y enfría este brazo 3.': 'Deal 4 damage, cool this arm 3.',
    'Inflige 5 de daño. Vulnerable 1 turno.': 'Deal 5 damage. Vulnerable 1 turn.',
    'Debilita al enemigo 1 turno.': 'Weaken enemy 1 turn.',
    'Debilita al enemigo 2 turnos.': 'Weaken enemy 2 turns.',
    'El enemigo queda vulnerable 1 turno.': 'Enemy becomes vulnerable 1 turn.',
    'El enemigo queda vulnerable 2 turnos.': 'Enemy becomes vulnerable 2 turns.',
    'Enemigo débil y vulnerable 1 turno.': 'Enemy weak and vulnerable 1 turn.',
    'Enemigo débil y vulnerable 2 turnos.': 'Enemy weak and vulnerable 2 turns.',
    'Roba 1 carta.': 'Draw 1 card.',
    'Roba 2 cartas.': 'Draw 2 cards.',
    'Roba 1 y gana 1 de energía.': 'Draw 1, gain 1 energy.',
    'Gana 1 de energía.': 'Gain 1 energy.',
    'Gana 2 de energía.': 'Gain 2 energy.',
    'Gana 1 de energía y roba 1.': 'Gain 1 energy, draw 1.',
    'Gana 1 de energía. Vulnerable 1 turno.': 'Gain 1 energy. Vulnerable 1 turn.',
    'Gana 3 de bloqueo.': 'Gain 3 block.',
    'Gana 5 de bloqueo.': 'Gain 5 block.',
    'Gana 7 de bloqueo.': 'Gain 7 block.',
    'Gana 9 de bloqueo.': 'Gain 9 block.',
    'Gana 10 de bloqueo.': 'Gain 10 block.',
    'Gana 12 de bloqueo.': 'Gain 12 block.',
    'Gana 3 de bloqueo y roba 1.': 'Gain 3 block, draw 1.',
    'Gana 3 de bloqueo y roba 2.': 'Gain 3 block, draw 2.',
    'Gana 4 de bloqueo y roba 1.': 'Gain 4 block, draw 1.',
    'Gana 5 de bloqueo y roba 1.': 'Gain 5 block, draw 1.',
    'Gana 3 de bloqueo y cura 2 PV.': 'Gain 3 block, heal 2 HP.',
    'Gana 8 de bloqueo y cura 2 PV.': 'Gain 8 block, heal 2 HP.',
    'Gana 4 de bloqueo y 1 de energía.': 'Gain 4 block, 1 energy.',
    'Gana 5 de bloqueo y 1 de energía.': 'Gain 5 block, 1 energy.',
    'Gana 4 de bloqueo y enfría esta pierna 1.': 'Gain 4 block, cool this leg 1.',
    'Gana 3 de bloqueo y enfría todo 2.': 'Gain 3 block, cool all 2.',
    'Cura 3 PV.': 'Heal 3 HP.',
    'Cura 5 PV.': 'Heal 5 HP.',
    'Cura 8 PV.': 'Heal 8 HP.',
    'Cura 4 PV y gana 3 de bloqueo.': 'Heal 4 HP, gain 3 block.',
    'Cura 8 PV y enfría todo 2.': 'Heal 8 HP, cool all 2.',
    'Enfría cada miembro 2.': 'Cool every limb 2.',
    'Enfría cada miembro 3.': 'Cool every limb 3.',
    'Enfría esta pierna 3 y roba 1.': 'Cool this leg 3, draw 1.',

    // ------------------------------------------------------------------ limb names
    'Cabeza Reanimada': 'Reanimated Head',
    'Cabeza de Ahorcado': 'Hanged Man Head',
    'Torso Suturado': 'Sutured Torso',
    'Torso de Mendigo': 'Beggar Torso',
    'Brazo de Cadáver': 'Corpse Arm',
    'Brazo de Sepulturero': 'Gravedigger Arm',
    'Pierna de Cadáver': 'Corpse Leg',
    'Pierna de Bailarina': 'Dancer Leg',
    'Brazo de Homúnculo': 'Homunculus Arm',
    'Pierna de Homúnculo': 'Homunculus Leg',
    'Cabeza de Sabueso': 'Hound Head',
    'Pata de Sabueso': 'Hound Paw',
    'Cabeza de Alquimista': 'Alchemist Head',
    'Brazo de Alquimista': 'Alchemist Arm',
    'Brazo de Cirujano': 'Surgeon Arm',
    'Torso de Cirujano': 'Surgeon Torso',
    'Brazo de Autómata': 'Automaton Arm',
    'Torso de Autómata': 'Automaton Torso',
    'Pierna de Autómata': 'Automaton Leg',
    'Torso de Gólem': 'Golem Torso',
    'Brazo de Gólem': 'Golem Arm',
    'Pierna de Gólem': 'Golem Leg',
    'Cabeza del Maestro': 'Master Head',
    'Torso del Maestro': 'Master Torso',

    // ------------------------------------------------------------------ limb descriptions
    'Una cabeza cualquiera con la chispa aún tibia.': 'An ordinary head with the spark still warm.',
    'Cortada de la horca; el cuello nunca sanó bien.': 'Cut from the gallows; the neck never healed right.',
    'Remendado con hilo de tripa. Aguanta.': 'Patched with gut thread. It holds.',
    'Flaco y curtido por el frío de la calle.': 'Thin and hardened by the cold of the street.',
    'Rígido, torpe, pero pega.': 'Stiff, clumsy, but it hits.',
    'Acostumbrado a cavar y a golpear con la pala.': 'Used to digging and to swinging the spade.',
    'Se planta bien en el suelo. Poco más.': 'It plants itself well. Little else.',
    'Ligera y ágil; recuerda los pasos.': 'Light and nimble; it remembers the steps.',
    'Diminuto y frío: pincha sin calentarse.': 'Tiny and cold: it jabs without heating up.',
    'Patas de tarro: esquivas y brincos baratos.': 'Jar legs: cheap dodges and hops.',
    'Muerde, olfatea cartas y aúlla para debilitar.': 'It bites, sniffs out cards and howls to weaken.',
    'Embiste y acecha: daño y robo.': 'It charges and stalks: damage and draw.',
    'Sabe enfriar, curar y envenenar.': 'It knows how to cool, heal and poison.',
    'Lanza frascos: ácido, frío y fuego.': 'It throws flasks: acid, cold and fire.',
    'Bisturíes rápidos y cortes precisos.': 'Fast scalpels and precise cuts.',
    'Se cose solo y anestesia al rival.': 'It stitches itself and numbs the rival.',
    'Pistones de latón: pega fuerte y se calienta.': 'Brass pistons: it hits hard and it heats up.',
    'Caldera blindada con válvulas de vapor.': 'An armoured boiler with steam valves.',
    'Pisotones hidráulicos y purgas de vapor.': 'Hydraulic stomps and steam purges.',
    'Una montaña de carne que se regenera.': 'A mountain of flesh that regrows itself.',
    'Aplasta. Se calienta muchísimo.': 'It crushes. It heats up enormously.',
    'Pisotones que hacen temblar la torre.': 'Stomps that make the tower tremble.',
    'La mente del Maestro: energía, frío y maldiciones.': 'The Master mind: energy, cold and curses.',
    'Late con una piedra filosofal.': 'It beats with a philosopher stone.',

    // ------------------------------------------------------------------ enemies
    'Homúnculo': 'Homunculus',
    'Sabueso Suturado': 'Sutured Hound',
    'Alquimista Corrupto': 'Corrupt Alchemist',
    'Cirujano Demente': 'Mad Surgeon',
    'Autómata de Latón': 'Brass Automaton',
    'Gólem de Carne': 'Flesh Golem',
    'Maestro Alquimista': 'Master Alchemist',
    'Un engendro de tarro, rápido y rabioso.': 'A jar-born spawn, fast and rabid.',
    'Perro remendado con hilo de cobre. Muerde primero.': 'A dog patched with copper thread. It bites first.',
    'Bebe lo que destila. Sus frascos hierven.': 'He drinks what he distils. His flasks boil.',
    'Opera sin anestesia y sin permiso.': 'He operates with no anesthesia and no leave.',
    'Caldera con piernas. Escupe vapor hirviendo.': 'A boiler with legs. It spits boiling steam.',
    'Docenas de cuerpos cosidos en uno solo.': 'Dozens of bodies sewn into a single one.',
    'El dueño de la torre. Guarda la salida.': 'The owner of the tower. He guards the exit.',

    // ------------------------------------------------------------------ traps, palettes, floors
    'Trampa de vapor': 'Steam Trap',
    'Suelo de cuchillas': 'Blade Floor',
    'Reloj saboteado': 'Sabotaged Clock',
    'Charco de ácido': 'Acid Pool',
    'Un chorro de vapor calienta una extremidad (+3 calor).': 'A jet of steam heats one limb (+3 heat).',
    'Cuchillas ocultas te cortan (-6 PV).': 'Hidden blades cut you (-6 HP).',
    'Un engranaje maldito roba tiempo (-20 segundos).': 'A cursed gear steals time (-20 seconds).',
    'El ácido corroe todas tus extremidades (+2 calor).': 'Acid corrodes all your limbs (+2 heat).',
    'Pálido': 'Pale',
    'Verdoso': 'Greenish',
    'Cobre': 'Copper',
    'Ébano': 'Ebony',
    'Sótano de Disección': 'Dissection Cellar',
    'Galería de Especímenes': 'Specimen Gallery',
    'Laboratorio Superior': 'Upper Laboratory',

    // ------------------------------------------------------------------ body.js log
    'Injertas {0} ({1})': 'You graft {0} ({1})',
    '¡{0} se rompe! Ahora es un muñón.': '{0} breaks! Now it is a stump.',

    // ------------------------------------------------------------------ explore.js
    'Despiertas en la mesa de disección. ¡Huye!': 'You wake on the dissection table. Run!',
    'La torre se retuerce': 'The tower twists',
    'LA TORRE SE RETUERCE': 'THE TOWER TWISTS',
    'Bebes un vial: +10 PV': 'You drink a vial: +10 HP',
    'Refrigerante: -5 de calor en cada miembro': 'Coolant: -5 heat on every limb',
    'Recoges {0} de Ichor': 'You pick up {0} Ichor',
    'Subes a la planta {0}: {1}': 'You climb to floor {0}: {1}',
    '¡{0}! -6 PV': '{0}! -6 HP',
    '¡{0}! -20 segundos': '{0}! -20 seconds',
    '¡{0}! +2 de calor en cada miembro': '{0}! +2 heat on every limb',
    '¡{0}! +3 de calor en {1}': '{0}! +3 heat on {1}',
    'Planta {0}/{1} - {2}': 'Floor {0}/{1} - {2}',
    'Toca una sala contigua o usa las flechas': 'Tap an adjacent room or use the arrows',

    // ------------------------------------------------------------------ combat.js
    '¡{0} te cierra el paso!': '{0} blocks your way!',
    'No tienes energía para {0}.': 'Not enough energy for {0}.',
    '{0} de daño': '{0} damage',
    '+{0} de bloqueo': '+{0} block',
    '+{0} PV': '+{0} HP',
    '+{0} de energía': '+{0} energy',
    'enemigo débil {0}': 'enemy weak {0}',
    'enemigo vulnerable {0}': 'enemy vulnerable {0}',
    'efecto': 'effect',
    '{0} ataca: {1} de daño.': '{0} attacks: {1} damage.',
    '{0} se cubre: {1} de bloqueo.': '{0} guards: {1} block.',
    'El vapor calienta tu {0} (+{1}).': 'Steam heats your {0} (+{1}).',
    '{0} te debilita {1} turno.': '{0} weakens you {1} turn.',
    '{0} te debilita {1} turnos.': '{0} weakens you {1} turns.',
    '{0} se cura {1} PV.': '{0} heals {1} HP.',
    '¡{0} cae! Cosecha sus restos.': '{0} falls! Harvest its remains.',
    'Bloqueado': 'Blocked',
    'Bloqueo {0}': 'Block {0}',
    'Débil {0}': 'Weak {0}',
    '{0}/{1} PV': '{0}/{1} HP',
    'Intención: ataque {0}': 'Intent: attack {0}',
    'Intención: ataque {0} x{1}': 'Intent: attack {0} x{1}',
    'Intención: bloqueo {0}': 'Intent: block {0}',
    'Intención: vapor +{0} calor': 'Intent: steam +{0} heat',
    'Intención: debilitar': 'Intent: weaken',
    'Intención: curación {0}': 'Intent: heal {0}',
    'Intención: ?': 'Intent: ?',
    'Energía {0}/{1}': 'Energy {0}/{1}',
    'Mazo {0}   Descarte {1}   Turno {2}': 'Deck {0}   Discard {1}   Turn {2}',
    'Fin de turno': 'End turn',
    'Cosecha': 'Harvest',
    'Restos de {0}. Elige una extremidad para injertar:': 'Remains of {0}. Choose a limb to graft:',
    '{0} - calor máx. {1}': '{0} - max heat {1}',
    '{0} - calor máx. {1} - +{2} PV máx.': '{0} - max heat {1} - +{2} max HP',
    'Cartas: {0}': 'Cards: {0}',
    'Descartar': 'Discard',
    'Injertar {0} en:': 'Graft {0} onto:',
    '{0}: {1} (calor {2}/{3})': '{0}: {1} (heat {2}/{3})',
    '{0}: muñón (vacío)': '{0}: stump (empty)',
    'Atrás': 'Back',

    // ------------------------------------------------------------------ title screen
    'Deadlock Deck: El Reloj Anatómico': 'Deadlock Deck: The Anatomical Clock',
    'El Reloj Anatómico': 'The Anatomical Clock',
    'Cómo jugar': 'How to play',
    'Tu cuerpo es tu mazo: cada extremidad aporta sus cartas.':
      'Your body is your deck: every limb brings its own cards.',
    'Las cartas calientan la extremidad que las juega; si se sobrecalienta, se rompe y pierdes sus cartas.':
      'Cards heat the limb that plays them; if it overheats it breaks and you lose its cards.',
    'Cosecha extremidades de los enemigos caídos e injértalas en tu cuerpo.':
      'Harvest limbs from fallen enemies and graft them onto your body.',
    'Escapa de la torre en llamas antes de que el reloj llegue a cero: tienes 6 minutos.':
      'Escape the burning tower before the clock hits zero: you have 6 minutes.',
    'Reanimar': 'Reanimate',
    'Planos': 'Plans',
    'Cosméticos': 'Cosmetics',
    'Sonido: sí': 'Sound: yes',
    'Sonido: no': 'Sound: no',
    'Partidas: {0}   Escapes: {1}   Mejor planta: {2}/{3}   Planos: {4}/{5}   Ichor: {6}':
      'Runs: {0}   Escapes: {1}   Best floor: {2}/{3}   Plans: {4}/{5}   Ichor: {6}',
    'Mejor escape: {0} restantes': 'Best escape: {0} left',
    'Pulsa Intro o Reanimar para despertar en la mesa de disección':
      'Press Enter or Reanimate to wake up on the dissection table',

    // ------------------------------------------------------------------ dissection screen
    'Mesa de disección': 'Dissection Table',
    'PV {0}/{1}   Cartas: {2}': 'HP {0}/{1}   Cards: {2}',
    'Tu cuerpo': 'Your body',
    '{0} (+{1} PV)': '{0} (+{1} HP)',
    'Despertar': 'Wake up',
    'Plano injertado': 'Plan grafted',
    'Injertar un plano': 'Graft a plan',
    'Aún no conoces ningún plano. Cosecha extremidades de los enemigos de la torre para descubrirlos.':
      'You know no plans yet. Harvest limbs from the enemies of the tower to discover them.',
    'Injertado: {0}. Solo un injerto por mesa.': 'Grafted: {0}. Only one graft per table.',
    'Elige un hueco compatible en "Tu cuerpo" para injertar {0}':
      'Choose a fitting slot in "Your body" to graft {0}',
    'Puedes injertar un plano descubierto antes de despertar.':
      'You may graft one discovered plan before waking up.',
    'El reloj no corre hasta que despiertes.   Intro: despertar':
      'The clock does not run until you wake up.   Enter: wake up',

    // ------------------------------------------------------------------ death / escape screens
    'Has muerto': 'You have died',
    'El reloj se detuvo': 'The clock stopped',
    'Informe de autopsia': 'Autopsy report',
    'Planta alcanzada: {0}/{1}': 'Floor reached: {0}/{1}',
    'Enemigos derrotados: {0}': 'Enemies defeated: {0}',
    'Ichor obtenido: +{0}': 'Ichor gained: +{0}',
    'Planos descubiertos en esta partida:': 'Plans discovered in this run:',
    'Tu espíritu regresa a la mesa de disección...': 'Your spirit returns to the dissection table...',
    'HAS ESCAPADO DE LA TORRE': 'YOU ESCAPED THE TOWER',
    'Libertad': 'Freedom',
    'Tiempo restante: {0}': 'Time remaining: {0}',
    'Ichor de la torre: +{0}   Bonificación por tiempo: +{1}':
      'Ichor from the tower: +{0}   Time bonus: +{1}',
    'El amanecer quema tus suturas, pero eres libre.': 'The dawn burns your sutures, but you are free.',
    'ninguno': 'none',
    '+{0} más': '+{0} more',
    '¡nuevo!': 'new!',
    'Nueva mesa de disección': 'New dissection table',
    'Título': 'Title',

    // ------------------------------------------------------------------ codex
    'Planos anatómicos': 'Anatomical plans',
    'Conocidos: {0}/{1}': 'Known: {0}/{1}',
    '{0}   Calor máx. {1}   Origen: {2}': '{0}   Max heat {1}   Source: {2}',
    '{0}   Calor máx. {1}   +{2} PV máx.   Origen: {3}': '{0}   Max heat {1}   +{2} max HP   Source: {3}',
    'cuerpo base': 'base body',
    'Cerrar': 'Close',
    'Pulsa un plano conocido para ver sus cartas': 'Tap a known plan to see its cards',
    'Volver': 'Back',

    // ------------------------------------------------------------------ shop
    'Aspecto actual': 'Current look',
    'En uso': 'In use',
    'Comprado': 'Purchased',
    'Desbloqueado': 'Unlocked',
    'Usar': 'Use',
    'Precio: {0} Ichor': 'Price: {0} Ichor',
    'Comprar ({0} Ichor)': 'Buy ({0} Ichor)',
    'Se desbloquea con {0} planos ({1}/{2})': 'Unlocks with {0} plans ({1}/{2})',
    '{0} planos': '{0} plans',
    'Microtransacciones simuladas: se pagan con Ichor obtenido en la torre; no hay pagos reales.':
      'Simulated microtransactions: paid with Ichor earned in the tower; there are no real payments.',
  };

  // ------------------------------------------------------------------ resolution
  const norm = v => { const s = String(v == null ? '' : v).toLowerCase(); return s === 'es' || s === 'en' ? s : ''; };
  const fromQuery = () => { const m = /[?&]lang=([^&]*)/.exec(window.location.search || ''); return m ? norm(decodeURIComponent(m[1])) : ''; };
  // file:// and private windows throw on storage access: the language is a bonus, never a crash.
  const fromStore = () => { try { return norm(window.localStorage.getItem(KEY)); } catch (e) { return ''; } };

  // ?lang= wins, then the stored choice, then Spanish: an untouched URL with empty storage
  // plays exactly as it always has.
  const lang = fromQuery() || fromStore() || 'es';

  // ------------------------------------------------------------------ public API
  const t = (s, ...args) => {
    const key = s == null ? '' : String(s);
    let out = lang !== 'es' && typeof EN[key] === 'string' ? EN[key] : key;
    for (let i = 0; i < args.length; i++) out = out.split('{' + i + '}').join(String(args[i]));
    return out;
  };

  const set = next => {
    const want = norm(next);
    if (!want || want === lang) return;
    try { window.localStorage.setItem(KEY, want); } catch (e) { /* no storage: the URL rewrite below still carries the choice */ }
    // A ?lang= in the URL outranks the stored choice, so rewrite it instead of reloading
    // into the language the player just left.
    if (fromQuery()) window.location.search = String(window.location.search).replace(/([?&])lang=[^&]*/, '$1lang=' + want);
    else window.location.reload();
  };

  DD.i18n = { lang: () => lang, t, set };
  DD.t = t;   // call-site shorthand: every module translates with DD.t('...')

  // index.html ships its markup in Spanish; this is the only pass that rewrites it.
  document.documentElement.lang = lang;
  document.title = t('Deadlock Deck: El Reloj Anatómico');
})();
