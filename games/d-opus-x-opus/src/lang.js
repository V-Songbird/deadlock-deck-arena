// Language layer. Spanish is the authored language of the game; English is a
// lookup table on top of it, keyed by the exact Spanish literal written in the
// source. An unknown string passes through untouched, so Spanish never depends
// on this table and the game reads exactly as it did before when 'es' is active.
//
// `{0}`, `{1}`... mark interpolated values: the TEMPLATE is translated and the
// values are substituted afterwards, so no number or name can be lost.
//
// Wordings are limited to what render.js's 4x6 bitmap font can draw: A-Z, 0-9
// and . , : ; ! ? ' " - + / % ( ) < > * = [ ] _ #  (no ampersands, no dashes
// longer than one pixel-wide hyphen, no curly quotes, no ellipsis character).

const STORE_KEY = 'dd-lang';
const DEFAULT_LANG = 'es';

const EN = {
  /* ------------------------------------------------- index.html shell */
  'Deadlock Deck: El Reloj Anatómico': 'Deadlock Deck: The Anatomical Clock',
  'RATÓN / 1-6 MOVER · F BAJAR · ESPACIO FIN DE TURNO · M SILENCIO':
    'MOUSE / 1-6 MOVE · F GO DOWN · SPACE END TURN · M MUTE',

  /* ------------------------------------------------- cards.js: card names */
  'Mirada Vacía': 'Vacant Stare',
  'Mordisco': 'Bite',
  'Respiro Frío': 'Cold Breath',
  'Cabezazo': 'Headbutt',
  'Visión Turbia': 'Clouded Sight',
  'Presagio': 'Omen',
  'Dentellada': 'Savage Bite',
  'Rastro de Sangre': 'Blood Trail',
  'Transmutación': 'Transmutation',
  'Lluvia Ácida': 'Acid Rain',
  'Mente de Plomo': 'Leaden Mind',
  'Aliento Ígneo': 'Fiery Breath',
  'Purga Térmica': 'Thermal Purge',
  'Ojo de Brasa': 'Ember Eye',
  'Costillar': 'Rib Cage',
  'Puntadas': 'Stitches',
  'Escudo Costal': 'Rib Shield',
  'Esquirlas': 'Bone Shards',
  'Válvula de Vapor': 'Steam Valve',
  'Sobrepresión': 'Overpressure',
  'Fuelle Doble': 'Double Bellows',
  'Hollín Negro': 'Black Soot',
  'Corazón de Icor': 'Ichor Heart',
  'Salmodia': 'Plainchant',
  'Costra Santa': 'Holy Scab',
  'Cuchillada': 'Knife Slash',
  'Desgarro': 'Rip',
  'Puñetazo Seco': 'Dry Punch',
  'Garra Ósea': 'Bone Claw',
  'Manotazo': 'Swipe',
  'Agarre Torpe': 'Clumsy Grip',
  'Tajo Guillotina': 'Guillotine Cut',
  'Amputación': 'Amputation',
  'Incisión': 'Incision',
  'Sutura Rápida': 'Quick Suture',
  'Martillo Vapor': 'Steam Hammer',
  'Biela Doble': 'Double Rod',
  'Colada Ardiente': 'Burning Pour',
  'Forja Viva': 'Living Forge',
  'Escoria Fundida': 'Molten Slag',
  'Sangría Voraz': 'Greedy Bleed',
  'Vena Abierta': 'Open Vein',
  'Festín': 'Feast',
  'Patada': 'Kick',
  'Quiebro': 'Sidestep',
  'Pisotón': 'Stomp',
  'Plantarse': 'Stand Firm',
  'Zarpazo Bajo': 'Low Claw',
  'Acecho': 'Stalk',
  'Salto Brutal': 'Brutal Leap',
  'Impulso': 'Momentum',
  'Barrido Espinas': 'Thorn Sweep',
  'Coz de Quitina': 'Chitin Kick',
  'Postura Férrea': 'Iron Stance',
  'Paso de Tumba': 'Grave Step',
  'Ancla Fúnebre': 'Funeral Anchor',
  'Patada Umbral': 'Threshold Kick',
  'Golpe de Muñón': 'Stump Blow',

  /* ------------------------------------------------- cards.js: card descriptions */
  'El vacío de sus cuencas le roba fuerza al enemigo.': 'The void in its sockets drains the foe of strength.',
  'Dientes sueltos que aún recuerdan el hambre.': 'Loose teeth that still remember hunger.',
  'El latón exhala y toda la carne se enfría.': 'The brass exhales and all the flesh cools.',
  'Metal contra hueso ajeno. Gana el metal.': 'Metal against borrowed bone. Metal wins.',
  'Ves dos futuros y robas las cartas de ambos.': 'You see two futures and draw from both.',
  'Adivinas el golpe antes de que llegue a nacer.': 'You read the blow before it is even born.',
  'Las fauces cierran sobre el tendón más tierno.': 'The jaws close on the tenderest tendon.',
  'Hueles la herida y sabes dónde volver a abrirla.': 'You smell the wound and know where to reopen it.',
  'Cambias carne por tiempo. El cambio siempre duele.': 'You trade flesh for time. The trade always hurts.',
  'Vitriolo destilado cae sobre la piel prestada.': 'Distilled vitriol falls on borrowed skin.',
  'Pesada, fría, inmóvil. Nada consigue quemarla.': 'Heavy, cold, still. Nothing can burn it.',
  'Abres la mandíbula y el pasillo entero se dora.': 'You open your jaw and the hall turns gold.',
  'Expulsas el calor por las cuencas. Duele salir.': 'Heat pours out of your sockets. It hurts.',
  'Una mirada que marca la carne a fuego lento.': 'A stare that brands flesh over slow fire.',
  'Cruzas los brazos sobre las costillas prestadas.': 'You fold your arms over borrowed ribs.',
  'Hilo encerado y aguja curva. Aguanta un poco.': 'Waxed thread and curved needle. It holds.',
  'Las costillas se cierran como una jaula seca.': 'The ribs close like a dry cage.',
  'Astillas de hueso erizan el pecho abierto.': 'Bone splinters bristle on the open chest.',
  'Abres la espita y el vapor huye silbando.': 'You open the tap and steam flees hissing.',
  'La caldera ruge y escupe metal hirviendo.': 'The boiler roars and spits boiling metal.',
  'Dos bocanadas mueven el cuerpo entero a la vez.': 'Two gulps move the whole body at once.',
  'Escupes ceniza caliente en los ojos contrarios.': 'You spit hot ash into the enemy eyes.',
  'Late verde y remienda lo que el hierro rompió.': 'It beats green and mends what iron broke.',
  'Un rezo en lengua muerta tensa cada tendón.': 'A prayer in a dead tongue tightens you.',
  'Una corteza de reliquias sella el torso. Y se cae.': 'A crust of relics seals the torso. Then falls.',
  'Un tajo limpio entre dos costillas ajenas.': 'A clean cut between two borrowed ribs.',
  'Agarras, tiras y algo cede con un chasquido.': 'You grab, you pull, something snaps.',
  'Nudillos desnudos contra carne prestada.': 'Bare knuckles on borrowed flesh.',
  'Cuatro dedos buscan el hueco entre los huesos.': 'Four fingers seek the gap between bones.',
  'Torpe, lento y mal cosido. Pero llega.': 'Clumsy, slow, badly sewn. It lands.',
  'Sujetas al enemigo justo donde peor le viene.': 'You hold the foe where it hurts most.',
  'La hoja cae por su propio peso. No perdona.': 'The blade falls by its own weight.',
  'Separas el miembro por la juntura. Botín limpio.': 'You part the limb at the joint. Clean loot.',
  'Tres cortes precisos, ninguno desperdiciado.': 'Three precise cuts, none of them wasted.',
  'Te coses sin mirar. Ya tienes práctica de sobra.': 'You sew yourself blind. Plenty of practice.',
  'El pistón se dispara con un siseo blanco.': 'The piston fires with a white hiss.',
  'Dos émbolos, dos impactos, un solo aliento.': 'Two pistons, two hits, one single breath.',
  'Viertes metal fundido desde la palma abierta.': 'You pour molten metal from an open palm.',
  'Tu sangre hierve y cada golpe pesa el doble.': 'Your blood boils and every blow weighs double.',
  'Salpicas escoria que sigue comiendo carne.': 'You splash slag that keeps eating flesh.',
  'Bebes por la palma lo que abres con la uña.': 'Your palm drinks what your nail opens.',
  'Ofreces tu sangre para envenenar la suya.': 'You offer your blood to poison theirs.',
  'El brazo se hincha, satisfecho, y se desprende.': 'The arm swells, sated, and comes away.',
  'Un talón sucio contra la rodilla contraria.': 'A dirty heel into the enemy knee.',
  'Un paso al lado y el golpe pasa de largo.': 'One step aside and the blow goes wide.',
  'Bajas el pie sobre algo que cruje al ceder.': 'Your foot lands on something that snaps.',
  'Clavas los dedos en la piedra y aguantas.': 'You dig your toes in stone and hold.',
  'Las uñas abren la corva de un solo barrido.': 'Nails open the hollow of the knee.',
  'Rodeas a la presa y ves su punto más blando.': 'You circle the prey and find its soft spot.',
  'Caes con todo el peso del cuerpo robado.': 'You land with all the stolen body weight.',
  'El muelle se suelta y ganas un movimiento.': 'The spring lets go and you gain a move.',
  'Las espinas quedan erizadas a tu alrededor.': 'The thorns stand bristling all around you.',
  'Placa córnea contra esternón. Se oye arriba.': 'Horn plate on sternum. They hear it above.',
  'Seis patas imaginarias te sostienen en pie.': 'Six imagined legs hold you upright.',
  'Cada pisada abre una fosa bajo el enemigo.': 'Each footfall opens a pit under the foe.',
  'Lo clavas al suelo con un frío de cripta.': 'You pin it down with a crypt cold.',
  'El pie cruza donde no hay puerta y golpea.': 'The foot crosses where no door is.',
  'Carne sin mano. Te duele más a ti que a él.': 'Flesh with no hand. It hurts you more.',

  /* ------------------------------------------------- cards.js: limb names */
  'Cráneo Desollado': 'Flayed Skull',
  'Máscara de Latón': 'Brass Mask',
  'Cráneo Vidente': 'Seer Skull',
  'Testa de Sabueso': 'Hound Head',
  'Cráneo Alquímico': 'Alchemic Skull',
  'Cráneo Horno': 'Furnace Skull',
  'Torso Remendado': 'Patched Torso',
  'Pecho Osario': 'Ossuary Chest',
  'Torso Caldera': 'Boiler Torso',
  'Caja de Fuelle': 'Bellows Box',
  'Torso Reliquia': 'Reliquary Torso',
  'Brazo Carnicero': 'Butcher Arm',
  'Brazo Huesudo': 'Bony Arm',
  'Brazo Zurcido': 'Darned Arm',
  'Brazo Guillotina': 'Guillotine Arm',
  'Brazo Bisturí': 'Scalpel Arm',
  'Brazo Pistón': 'Piston Arm',
  'Brazo Crisol': 'Crucible Arm',
  'Brazo Sanguijuela': 'Leech Arm',
  'Pierna Zancuda': 'Stilt Leg',
  'Pierna Nudosa': 'Knotted Leg',
  'Zarpa de Sabueso': 'Hound Paw',
  'Pierna de Resorte': 'Spring Leg',
  'Zanca de Quitina': 'Chitin Shank',
  'Pierna Sepulcral': 'Sepulchral Leg',

  /* ------------------------------------------------- cards.js: limb descriptions */
  'Sin piel, sin párpados, todo ojo.': 'No skin, no eyelids, all eye.',
  'Latón frío atornillado al hueso.': 'Cold brass bolted onto bone.',
  'Lee el golpe antes de que ocurra.': 'It reads the blow before it lands.',
  'Hocico largo, dientes de sobra.': 'Long snout, teeth to spare.',
  'Un alambique donde hubo sesos.': 'A still where brains used to be.',
  'La hoguera vive tras las cuencas.': 'The bonfire lives behind the sockets.',
  'Tres cadáveres cosidos con hilo basto.': 'Three corpses sewn with coarse thread.',
  'Costillas ajenas trenzadas en jaula.': 'Borrowed ribs braided into a cage.',
  'Cobre remachado y presión constante.': 'Riveted copper and constant pressure.',
  'Respira por ti y aún te sobra aliento.': 'It breathes for you, with breath to spare.',
  'Late icor bendito bajo el esternón.': 'Blessed ichor beats under the sternum.',
  'Viene con su cuchillo ya en la mano.': 'It comes with its knife already in hand.',
  'Puro hueso y rencor seco.': 'Pure bone and dry spite.',
  'Zurcido a ojo. Responde con retraso.': 'Darned by eye. It answers late.',
  'Una hoja pesada por codo.': 'A heavy blade for an elbow.',
  'Dedos finos que saben dónde cortar.': 'Thin fingers that know where to cut.',
  'Vapor comprimido en vez de músculo.': 'Pressed steam instead of muscle.',
  'La palma es un crisol siempre al rojo.': 'The palm is a crucible always red hot.',
  'Bebe lo que abre. Nunca se sacia.': 'It drinks what it opens. Never sated.',
  'Larga, flaca y sorprendentemente veloz.': 'Long, thin and surprisingly fast.',
  'Nudos de tendón sobre hueso grueso.': 'Tendon knots over thick bone.',
  'Almohadillas negras y uñas curvas.': 'Black pads and curved nails.',
  'Muelles de acero bajo la rodilla.': 'Steel springs under the knee.',
  'Placa córnea erizada de espinas.': 'Horn plate bristling with thorns.',
  'Huele a cripta y pisa como una losa.': 'It smells of crypt and steps like a slab.',

  /* ------------------------------------------------- cards.js: enemies */
  'El Injertado': 'The Grafted',
  '¿Tú también te despertaste?': 'Did you wake up too?',
  'Aprendiz Mudo': 'Mute Apprentice',
  'El maestro te quiere entero.': 'The master wants you whole.',
  'Sabueso Injerto': 'Graft Hound',
  'Huele tu sangre nueva.': 'It smells your new blood.',
  'El Cirujano': 'The Surgeon',
  'Quieto. Esto lo arreglo yo.': 'Hold still. I will fix this.',
  'El Bibliotecario': 'The Librarian',
  'Tu nombre ya está en el índice.': 'Your name is in the index already.',
  'Archialquimista': 'Archalchemist',
  'Devuélveme lo que te presté.': 'Give me back what I lent you.',

  /* ------------------------------------------------- cards.js: enemy moves */
  'Sacudida': 'Shake',
  'Cubrirse': 'Guard Up',
  'Aguja Larga': 'Long Needle',
  'Salmo Torpe': 'Clumsy Psalm',
  'Golpe Ciego': 'Blind Blow',
  'Embestida': 'Charge',
  'Tarascada': 'Snap Bite',
  'Sierra Curva': 'Curved Saw',
  'Éter': 'Ether',
  'Bata Gruesa': 'Thick Smock',
  'Índice Roto': 'Broken Index',
  'Tomo Pesado': 'Heavy Tome',
  'Letanía': 'Litany',
  'Polvo Antiguo': 'Old Dust',
  'Vitriolo': 'Vitriol',
  'Mercurio Vivo': 'Quicksilver',
  'Extracción': 'Extraction',
  'Gran Obra': 'Great Work',
  'Golpe': 'Blow',
  'GOLPE': 'BLOW',

  /* ------------------------------------------------- tower.js: room names */
  'Losa de Despertar': 'Waking Slab',
  'Portón Sellado': 'Sealed Gate',
  'Sala de Disección': 'Dissection Room',
  'Osario Húmedo': 'Damp Ossuary',
  'Galería de Ganchos': 'Gallery of Hooks',
  'Pabellón de Gritos': 'Ward of Screams',
  'Nave de Cadenas': 'Nave of Chains',
  'Celda Supurante': 'Weeping Cell',
  'Claustro de Vísceras': 'Cloister of Guts',
  'Anfiteatro Rojo': 'Red Amphitheatre',
  'Corredor Tendinoso': 'Sinewy Corridor',
  'Capilla Desollada': 'Flayed Chapel',
  'Archivo de Carne': 'Archive of Flesh',
  'Despensa de Órganos': 'Organ Pantry',
  'Alacena de Tendones': 'Tendon Cupboard',
  'Cripta de Repuestos': 'Crypt of Spares',
  'Cubeta de Hallazgos': 'Bucket of Finds',
  'Nicho de Reliquias': 'Relic Niche',
  'Depósito de Miembros': 'Limb Depot',
  'Pasillo de Cuchillas': 'Hall of Blades',
  'Fosa de Vapor': 'Steam Pit',
  'Bóveda Agrietada': 'Cracked Vault',
  'Tramo Hundido': 'Sunken Stretch',
  'Garganta de Agujas': 'Throat of Needles',
  'Túnel Silbante': 'Whistling Tunnel',
  'Rejilla Traicionera': 'Treacherous Grate',
  'Fragua de Injertos': 'Graft Forge',
  'Yunque de Huesos': 'Anvil of Bones',
  'Horno de Suturas': 'Suture Oven',
  'Taller de Costuras': 'Stitching Shop',
  'Crisol de Cartílago': 'Cartilage Crucible',
  'Banco de Ensamblaje': 'Assembly Bench',
  'Mesa de Suturas': 'Suture Table',
  'Escalera en Espiral': 'Spiral Stairway',
  'Pozo de Peldaños': 'Well of Steps',
  'Caracol de Piedra': 'Stone Spiral',
  'Descenso Estrecho': 'Narrow Descent',
  'Grada de Hierro': 'Iron Flight',
  'Bajada Enmohecida': 'Mildewed Way Down',
  'Vano de Escalones': 'Stairwell Gap',

  /* ------------------------------------------------- main.js */
  'SILENCIO': 'MUTED',
  'SONIDO': 'SOUND',
  'LA TORRE SE REORDENA': 'THE TOWER REWIRES ITSELF',

  /* ------------------------------------------------- combat.js */
  'CRÁNEO': 'SKULL',
  'BRAZO IZQ': 'LEFT ARM',
  'BRAZO DER': 'RIGHT ARM',
  'PIERNA IZQ': 'LEFT LEG',
  'PIERNA DER': 'RIGHT LEG',
  '{0} SE DESGARRA': '{0} TEARS OFF',
  '{0} INSERVIBLE': '{0} IS USELESS',
  '{0} -{1} CARNE': '{0} -{1} FLESH',
  '{0}: SE PROTEGE': '{0}: GUARDS',
  '{0}: SE ENFURECE': '{0}: RAGES',
  '{0}: TE DEBILITA': '{0}: WEAKENS YOU',
  '{0}: TE VUELVE FRÁGIL': '{0}: MAKES YOU FRAIL',
  'ARDES: -{0}': 'YOU BURN: -{0}',
  '{0} ARDE: -{1}': '{0} BURNS: -{1}',
  '{0} SE DESPLOMA': '{0} COLLAPSES',
  'TU CARNE CEDE': 'YOUR FLESH GIVES',
  'APARECE {0}': '{0} APPEARS',
  'NO HAY COMBATE': 'NO FIGHT HERE',
  'NO ES TU TURNO': 'NOT YOUR TURN',
  'NO HAY CARTA AHÍ': 'NO CARD THERE',
  'CARTA ILEGIBLE': 'UNREADABLE CARD',
  'SIN ACCIONES': 'NO ACTIONS LEFT',
  'NO HAY CADÁVER': 'NO CORPSE HERE',
  'YA HAS INJERTADO': 'YOU ALREADY GRAFTED',
  'ESA PIEZA NO EXISTE': 'THAT PIECE DOES NOT EXIST',
  'LA PIEZA ESTÁ DESTROZADA': 'THAT PIECE IS RUINED',
  'PLANO ILEGIBLE': 'UNREADABLE BLUEPRINT',
  'NO ENCAJA AHÍ': 'IT DOES NOT FIT THERE',
  'NO HAY CUERPO': 'NO BODY HERE',
  'INJERTAS {0}': 'YOU GRAFT {0}',
  'ESPERA': 'WAITS',
  'ATACA {0}': 'ATTACKS {0}',
  'X{0} POR {1}': 'X{0} FOR {1}',
  'ARRANCA MIEMBRO': 'RIPS A LIMB OFF',
  'SE PROTEGE': 'GUARDS',
  'SE ENFURECE': 'RAGES',
  'TE DEBILITA': 'WEAKENS YOU',
  'TRAMA ALGO': 'PLOTS SOMETHING',

  /* ------------------------------------------------- explore.js */
  'LOSA': 'SLAB',
  'COMBATE': 'FIGHT',
  'BOTÍN': 'LOOT',
  'TRAMPA': 'TRAP',
  'FRAGUA': 'FORGE',
  'ESCALERA': 'STAIRS',
  'SALIDA': 'EXIT',
  'LO': 'SL',
  'CO': 'FI',
  'BO': 'LO',
  'FR': 'FO',
  'ES': 'ST',
  'SA': 'EX',
  'La losa fría donde despertaste.': 'The cold slab where you woke up.',
  'Algo respira en la penumbra y': 'Something breathes in the gloom',
  'no piensa dejarte pasar.': 'and will not let you through.',
  'Restos aprovechables entre': 'Usable remains among the grime',
  'la mugre y los frascos rotos.': 'and the broken jars.',
  'El mecanismo aguarda cebado': 'The mechanism waits, primed,',
  'bajo las losas flojas.': 'under the loose flagstones.',
  'Yunques tibios, suturas frescas': 'Warm anvils, fresh sutures and',
  'y aceite para tus junturas.': 'oil for your joints.',
  'Los peldaños descienden': 'The steps go down towards',
  'hacia un aire más frío.': 'a colder air.',
  'El portón sellado. Tras él,': 'The sealed gate. Beyond it,',
  'la noche y la libertad.': 'the night and freedom.',
  'CUCHILLAS: -{0} PV Y {1} {2}': 'BLADES: -{0} HP AND {1} {2}',
  'ARRANCADO': 'TORN OFF',
  'ABIERTO': 'OPENED',
  'CUCHILLAS: -{0} PV SOBRE CARNE VIVA': 'BLADES: -{0} HP ON LIVE FLESH',
  'VAPOR HIRVIENTE: -{0} PV Y TODO SE RECALIENTA': 'BOILING STEAM: -{0} HP AND ALL HEATS UP',
  'LA BÓVEDA CEDE: -{0} PV DE ESCOMBROS': 'THE VAULT GIVES: -{0} HP OF RUBBLE',
  'INJERTAS: {0}': 'YOU GRAFT: {0}',
  'EL INJERTO NO ENCAJA EN TU CARNE': 'THE GRAFT DOES NOT FIT YOUR FLESH',
  'REFRIGERANTE: CALOR PURGADO, +3 INTEGRIDAD': 'COOLANT: HEAT PURGED, +3 INTEGRITY',
  'ELIXIR VISCOSO: +{0} PV': 'VISCOUS ELIXIR: +{0} HP',
  'LA FRAGUA REHACE: {0}': 'THE FORGE REMAKES: {0}',
  'LA FRAGUA SÓLO TE ENFRÍA: NO QUEDA NADA': 'THE FORGE ONLY COOLS YOU: NOTHING LEFT',
  'EL ARCHIALQUIMISTA BLOQUEA LA SALIDA': 'THE ARCHALCHEMIST BLOCKS THE EXIT',
  'DESCIENDES': 'YOU DESCEND',
  'NO HAY CORREDOR': 'NO CORRIDOR',
  'PISO {0}': 'FLOOR {0}',
  'MAPA': 'MAP',
  'PISO {0} - {1}': 'FLOOR {0} - {1}',
  'SALIDAS': 'EXITS',
  'NINGUNA. LOS MUROS SE CIERRAN.': 'NONE. THE WALLS CLOSE IN.',
  '[F] BAJAR': '[F] GO DOWN',
  'SALA AGOTADA': 'ROOM SPENT',
  'TECLAS 1-6 O CLICK EN EL MAPA': 'KEYS 1-6 OR CLICK THE MAP',

  /* ------------------------------------------------- ui.js */
  'CABEZA': 'HEAD',
  'BRAZO': 'ARM',
  'PIERNA': 'LEG',
  'ATAQUE': 'ATTACK',
  'HABILIDAD': 'SKILL',
  'PODER': 'POWER',
  'REORDEN {0}': 'REWIRED {0}',
  'SIN SALA': 'NO ROOM',
  'MUÑÓN': 'STUMP',
  'C': 'H',
  'INTENCIÓN OCULTA': 'HIDDEN INTENT',
  'CARTA': 'CARD',
  'SIN COMBATE': 'NO FIGHT',
  'ENEMIGO': 'ENEMY',
  'COSECHABLE': 'HARVESTABLE',
  'RESTO': 'REMAINS',
  'MANO VACÍA': 'EMPTY HAND',
  'TU TURNO': 'YOUR TURN',
  'ENEMIGO ACTÚA': 'ENEMY ACTS',
  'HA CAÍDO': 'IT FELL',
  'FIN': 'END',
  'ACCIONES: {0}/{1}': 'ACTIONS: {0}/{1}',
  'MAZO: {0}': 'DECK: {0}',
  'DESCARTE: {0}': 'DISCARD: {0}',
  'FIN DE TURNO': 'END TURN',
  'NO PUEDES JUGAR ESA CARTA': 'YOU CANNOT PLAY THAT CARD',
  'EL RELOJ ANATÓMICO': 'THE ANATOMICAL CLOCK',
  'DESPIERTAS COSIDO EN LA TORRE DEL': 'YOU WAKE UP STITCHED INSIDE THE',
  'ALQUIMISTA, CON PIEZAS QUE NO SON TUYAS.': "ALCHEMIST'S TOWER, WEARING OTHER PARTS.",
  'SEIS MINUTOS ANTES DE QUE TODO FALLE.': 'SIX MINUTES BEFORE IT ALL FAILS.',
  'PLANOS DESCUBIERTOS: {0}/{1}': 'BLUEPRINTS FOUND: {0}/{1}',
  'FUGAS: {0}   MESAS: {1}': 'ESCAPES: {0}   TABLES: {1}',
  'MEJOR FUGA: {0}': 'BEST ESCAPE: {0}',
  'CONTROLES': 'CONTROLS',
  'RATÓN: ELEGIR SALA Y JUGAR CARTAS': 'MOUSE: PICK ROOMS AND PLAY CARDS',
  'ESPACIO: FIN DE TURNO': 'SPACE: END TURN',
  '1-6: SALAS VECINAS    F: BAJAR': '1-6: NEXT ROOMS    F: GO DOWN',
  'FLECHAS: LISTAS    M: SILENCIO': 'ARROWS: LISTS    M: MUTE',
  '[ DESPERTAR ]': '[ WAKE UP ]',
  'YA HAS ELEGIDO TRES PLANOS': 'YOU ALREADY PICKED THREE BLUEPRINTS',
  'NO QUEDA HUECO DE ESA FAMILIA': 'NO SLOT LEFT IN THAT FAMILY',
  'MESA DE DISECCIÓN': 'DISSECTION TABLE',
  'CUERPO NUEVO': 'NEW BODY',
  'AÚN NO GUARDAS PLANOS: COSECHA UN CADÁVER PARA RETENERLOS.': 'NO BLUEPRINTS SAVED YET: HARVEST A CORPSE TO KEEP THEM.',
  'ESTA VEZ DESPERTARÁS CON PIEZAS DE TIER 1 AL AZAR.': 'THIS TIME YOU WAKE WITH RANDOM TIER 1 PARTS.',
  'ELEGIDOS {0}/3': 'PICKED {0}/3',
  '  T{0}  INT {1}  CAL {2}': '  T{0}  INT {1}  HEAT {2}',
  'EL RESTO SERÁ TIER 1 AL AZAR': 'THE REST WILL BE RANDOM TIER 1',
  'VUELVE A PULSAR UN PLANO PARA DESCARTARLO. EL RESTO DE SLOTS SERÁ TIER 1.':
    'CLICK A BLUEPRINT AGAIN TO DROP IT. THE REMAINING SLOTS WILL BE TIER 1.',
  '[ REANIMAR ]': '[ REANIMATE ]',
  'EL CADÁVER': 'THE CORPSE',
  'COSECHA': 'HARVEST',
  'HA CAÍDO: {0}': 'IT FELL: {0}',
  'EL RELOJ ESTÁ PARADO MIENTRAS CORTAS': 'THE CLOCK IS STOPPED WHILE YOU CUT',
  'RESTO SIN NOMBRE': 'NAMELESS REMAINS',
  'INSERVIBLE': 'USELESS',
  'CARTAS: {0}': 'CARDS: {0}',
  'NO QUEDA NADA APROVECHABLE.': 'NOTHING USABLE IS LEFT.',
  'ELIGE DÓNDE INJERTARLO': 'CHOOSE WHERE TO GRAFT IT',
  'LIBRE': 'FREE',
  'ELIGE UNA EXTREMIDAD DE LA IZQUIERDA': 'PICK A LIMB FROM THE LEFT',
  'LO QUE CORTAS QUEDA ANOTADO EN TUS PLANOS Y PODRÁS ELEGIRLO EN LA PRÓXIMA MESA DE DISECCIÓN.':
    'WHAT YOU CUT IS RECORDED IN YOUR BLUEPRINTS AND YOU CAN PICK IT AT THE NEXT DISSECTION TABLE.',
  '[ DEJAR EL CADÁVER ]': '[ LEAVE THE CORPSE ]',
  'TIEMPO EN LA TORRE: {0}': 'TIME IN THE TOWER: {0}',
  'TIEMPO SOBREVIVIDO: {0}': 'TIME SURVIVED: {0}',
  'PISO ALCANZADO: {0}': 'FLOOR REACHED: {0}',
  'ENEMIGOS COSECHADOS: {0}': 'ENEMIES HARVESTED: {0}',
  'INJERTOS: {0}': 'GRAFTS: {0}',
  'TU CUERPO FALLA': 'YOUR BODY FAILS',
  'EL RELOJ LLEGÓ A CERO': 'THE CLOCK HIT ZERO',
  'TE DESTRUYERON': 'THEY DESTROYED YOU',
  'TU ESPÍRITU SE TRASLADA A UNA MESA NUEVA.': 'YOUR SPIRIT MOVES ON TO A NEW TABLE.',
  'LOS PLANOS QUE CORTASTE TE SIGUEN.': 'THE BLUEPRINTS YOU CUT FOLLOW YOU.',
  '[ NUEVA MESA DE DISECCIÓN ]': '[ NEW DISSECTION TABLE ]',
  'HAS ESCAPADO': 'YOU ESCAPED',
  'EL RELOJ SE DETUVO EN {0}': 'THE CLOCK STOPPED AT {0}',
  'NINGUNA': 'NONE',
  'FUGAS: {0}': 'ESCAPES: {0}',
  '[ OTRA VEZ ]': '[ AGAIN ]',
};

const known = (key) => Object.prototype.hasOwnProperty.call(EN, key);

function stored() {
  try {
    return localStorage.getItem(STORE_KEY);
  } catch {
    return null; // storage unavailable, fall through to the locale
  }
}

function resolve() {
  let param = null;
  try {
    param = new URLSearchParams(location.search).get('lang');
  } catch {
    /* no URL to read */
  }
  if (param === 'es' || param === 'en') return param;
  const saved = stored();
  if (saved === 'es' || saved === 'en') return saved;
  const locale = typeof navigator !== 'undefined' ? String(navigator.language || '') : '';
  // Spanish is the authored language and also the fallback for every other locale.
  return locale.toLowerCase().startsWith('es') ? 'es' : DEFAULT_LANG;
}

const LANG = resolve();

if (typeof document !== 'undefined' && document.documentElement) {
  document.documentElement.lang = LANG;
}

export function getLang() {
  return LANG;
}

// t('APARECE {0}', name) -> the active language's template with {0} filled in.
// An unknown template is returned unchanged, so Spanish never needs the table.
export function t(template, ...values) {
  const key = String(template === null || template === undefined ? '' : template);
  const out = LANG === 'en' && known(key) ? EN[key] : key;
  if (!values.length) return out;
  return out.replace(/\{(\d+)\}/g, (match, i) => (values[i] === undefined ? match : String(values[i])));
}

export function setLang(next) {
  if (next !== 'es' && next !== 'en') return;
  try {
    localStorage.setItem(STORE_KEY, next);
  } catch {
    /* storage unavailable, the choice lasts only for this page */
  }
  const url = new URL(location.href);
  if (url.searchParams.has('lang')) {
    // Drop the override so the stored choice is the one that wins after the reload.
    url.searchParams.delete('lang');
    location.replace(url.href);
  } else {
    location.reload();
  }
}
