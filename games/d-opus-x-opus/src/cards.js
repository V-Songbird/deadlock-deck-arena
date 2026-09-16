// cards.js - pure data: cards, limb blueprints, enemies.
// No logic, no imports. Player-facing strings are Spanish; identifiers are English.
// Effect kinds are limited to the ones combat.js implements:
// damage | hits | block | heal | cool | repair | draw | ap | limbDamage | status | selfHarm | exhaust
// status: 'weak' | 'frail' | 'burn' | 'strength' | 'thorns'; to: 'enemy' | 'self'
//
// Thermal balance pass (measured over 2280 simulated fights): heat was decorative.
// heatCap is now tiered (tier 1 -> 4, tier 2 -> 5, tier 3 -> 6, +/-1 for flavour, kept in 3..7)
// and card heat scales with ap cost (ap 0 -> 0..1, ap 1 -> 1..2, ap 2 -> 2..3, ap 3 -> 3..5).
// A stump never overheats, so golpeMunon keeps heat 0.

export const CARDS = {
  // --- head cards ---------------------------------------------------------
  miradaVacia: { id: 'miradaVacia', name: 'Mirada Vacía', type: 'skill', ap: 1, heat: 1, desc: 'El vacío de sus cuencas le roba fuerza al enemigo.', effects: [{ kind: 'status', status: 'weak', amount: 1, to: 'enemy' }] },
  mordisco: { id: 'mordisco', name: 'Mordisco', type: 'attack', ap: 1, heat: 2, desc: 'Dientes sueltos que aún recuerdan el hambre.', effects: [{ kind: 'damage', amount: 5 }] },
  respiroFrio: { id: 'respiroFrio', name: 'Respiro Frío', type: 'skill', ap: 1, heat: 1, desc: 'El latón exhala y toda la carne se enfría.', effects: [{ kind: 'cool', amount: 2 }] },
  cabezazo: { id: 'cabezazo', name: 'Cabezazo', type: 'attack', ap: 1, heat: 2, desc: 'Metal contra hueso ajeno. Gana el metal.', effects: [{ kind: 'damage', amount: 6 }] },
  visionTurbia: { id: 'visionTurbia', name: 'Visión Turbia', type: 'skill', ap: 1, heat: 2, desc: 'Ves dos futuros y robas las cartas de ambos.', effects: [{ kind: 'draw', amount: 2 }] },
  presagio: { id: 'presagio', name: 'Presagio', type: 'skill', ap: 0, heat: 1, desc: 'Adivinas el golpe antes de que llegue a nacer.', effects: [{ kind: 'block', amount: 4 }] },
  dentellada: { id: 'dentellada', name: 'Dentellada', type: 'attack', ap: 2, heat: 3, desc: 'Las fauces cierran sobre el tendón más tierno.', effects: [{ kind: 'damage', amount: 9 }, { kind: 'limbDamage', amount: 1 }] },
  rastroSangre: { id: 'rastroSangre', name: 'Rastro de Sangre', type: 'skill', ap: 1, heat: 2, desc: 'Hueles la herida y sabes dónde volver a abrirla.', effects: [{ kind: 'status', status: 'frail', amount: 2, to: 'enemy' }] },
  transmutacion: { id: 'transmutacion', name: 'Transmutación', type: 'skill', ap: 1, heat: 2, desc: 'Cambias carne por tiempo. El cambio siempre duele.', effects: [{ kind: 'ap', amount: 2 }, { kind: 'draw', amount: 1 }, { kind: 'selfHarm', amount: 2 }] },
  lluviaAcida: { id: 'lluviaAcida', name: 'Lluvia Ácida', type: 'attack', ap: 2, heat: 3, desc: 'Vitriolo destilado cae sobre la piel prestada.', effects: [{ kind: 'damage', amount: 8 }, { kind: 'status', status: 'burn', amount: 4, to: 'enemy' }] },
  mentePlomo: { id: 'mentePlomo', name: 'Mente de Plomo', type: 'skill', ap: 1, heat: 1, desc: 'Pesada, fría, inmóvil. Nada consigue quemarla.', effects: [{ kind: 'cool', amount: 3 }, { kind: 'block', amount: 3 }] },
  alientoIgneo: { id: 'alientoIgneo', name: 'Aliento Ígneo', type: 'attack', ap: 3, heat: 5, desc: 'Abres la mandíbula y el pasillo entero se dora.', effects: [{ kind: 'damage', amount: 16 }, { kind: 'status', status: 'burn', amount: 3, to: 'enemy' }] },
  purgaTermica: { id: 'purgaTermica', name: 'Purga Térmica', type: 'skill', ap: 1, heat: 1, desc: 'Expulsas el calor por las cuencas. Duele salir.', effects: [{ kind: 'cool', amount: 4 }, { kind: 'selfHarm', amount: 2 }] },
  ojoBrasa: { id: 'ojoBrasa', name: 'Ojo de Brasa', type: 'attack', ap: 1, heat: 2, desc: 'Una mirada que marca la carne a fuego lento.', effects: [{ kind: 'damage', amount: 5 }, { kind: 'status', status: 'burn', amount: 2, to: 'enemy' }] },

  // --- torso cards --------------------------------------------------------
  costillar: { id: 'costillar', name: 'Costillar', type: 'skill', ap: 1, heat: 1, desc: 'Cruzas los brazos sobre las costillas prestadas.', effects: [{ kind: 'block', amount: 6 }] },
  puntadas: { id: 'puntadas', name: 'Puntadas', type: 'skill', ap: 1, heat: 2, desc: 'Hilo encerado y aguja curva. Aguanta un poco.', effects: [{ kind: 'heal', amount: 4 }] },
  escudoCostal: { id: 'escudoCostal', name: 'Escudo Costal', type: 'skill', ap: 1, heat: 1, desc: 'Las costillas se cierran como una jaula seca.', effects: [{ kind: 'block', amount: 5 }, { kind: 'repair', amount: 1 }] },
  esquirlas: { id: 'esquirlas', name: 'Esquirlas', type: 'skill', ap: 1, heat: 2, desc: 'Astillas de hueso erizan el pecho abierto.', effects: [{ kind: 'status', status: 'thorns', amount: 3, to: 'self' }] },
  valvulaVapor: { id: 'valvulaVapor', name: 'Válvula de Vapor', type: 'skill', ap: 0, heat: 0, desc: 'Abres la espita y el vapor huye silbando.', effects: [{ kind: 'cool', amount: 3 }] },
  sobrepresion: { id: 'sobrepresion', name: 'Sobrepresión', type: 'attack', ap: 2, heat: 3, desc: 'La caldera ruge y escupe metal hirviendo.', effects: [{ kind: 'damage', amount: 11 }, { kind: 'status', status: 'burn', amount: 2, to: 'enemy' }] },
  fuelleDoble: { id: 'fuelleDoble', name: 'Fuelle Doble', type: 'skill', ap: 1, heat: 2, desc: 'Dos bocanadas mueven el cuerpo entero a la vez.', effects: [{ kind: 'ap', amount: 2 }] },
  hollinNegro: { id: 'hollinNegro', name: 'Hollín Negro', type: 'skill', ap: 1, heat: 2, desc: 'Escupes ceniza caliente en los ojos contrarios.', effects: [{ kind: 'status', status: 'weak', amount: 2, to: 'enemy' }] },
  corazonIcor: { id: 'corazonIcor', name: 'Corazón de Icor', type: 'skill', ap: 2, heat: 3, desc: 'Late verde y remienda lo que el hierro rompió.', effects: [{ kind: 'heal', amount: 8 }, { kind: 'repair', amount: 2 }] },
  salmodia: { id: 'salmodia', name: 'Salmodia', type: 'power', ap: 2, heat: 3, desc: 'Un rezo en lengua muerta tensa cada tendón.', effects: [{ kind: 'status', status: 'strength', amount: 2, to: 'self' }] },
  costraSanta: { id: 'costraSanta', name: 'Costra Santa', type: 'skill', ap: 2, heat: 2, desc: 'Una corteza de reliquias sella el torso. Y se cae.', effects: [{ kind: 'block', amount: 12 }, { kind: 'exhaust' }] },

  // --- arm cards ----------------------------------------------------------
  cuchillada: { id: 'cuchillada', name: 'Cuchillada', type: 'attack', ap: 1, heat: 2, desc: 'Un tajo limpio entre dos costillas ajenas.', effects: [{ kind: 'damage', amount: 7 }] },
  desgarro: { id: 'desgarro', name: 'Desgarro', type: 'attack', ap: 2, heat: 3, desc: 'Agarras, tiras y algo cede con un chasquido.', effects: [{ kind: 'damage', amount: 9 }, { kind: 'limbDamage', amount: 1 }] },
  punetazoSeco: { id: 'punetazoSeco', name: 'Puñetazo Seco', type: 'attack', ap: 1, heat: 1, desc: 'Nudillos desnudos contra carne prestada.', effects: [{ kind: 'damage', amount: 6 }] },
  garraOsea: { id: 'garraOsea', name: 'Garra Ósea', type: 'attack', ap: 2, heat: 2, desc: 'Cuatro dedos buscan el hueco entre los huesos.', effects: [{ kind: 'hits', amount: 3, times: 2 }] },
  manotazo: { id: 'manotazo', name: 'Manotazo', type: 'attack', ap: 1, heat: 1, desc: 'Torpe, lento y mal cosido. Pero llega.', effects: [{ kind: 'damage', amount: 5 }] },
  agarreTorpe: { id: 'agarreTorpe', name: 'Agarre Torpe', type: 'skill', ap: 1, heat: 2, desc: 'Sujetas al enemigo justo donde peor le viene.', effects: [{ kind: 'status', status: 'frail', amount: 2, to: 'enemy' }] },
  tajoGuillotina: { id: 'tajoGuillotina', name: 'Tajo Guillotina', type: 'attack', ap: 2, heat: 3, desc: 'La hoja cae por su propio peso. No perdona.', effects: [{ kind: 'damage', amount: 12 }] },
  amputacion: { id: 'amputacion', name: 'Amputación', type: 'attack', ap: 2, heat: 3, desc: 'Separas el miembro por la juntura. Botín limpio.', effects: [{ kind: 'damage', amount: 5 }, { kind: 'limbDamage', amount: 3 }] },
  incision: { id: 'incision', name: 'Incisión', type: 'attack', ap: 1, heat: 2, desc: 'Tres cortes precisos, ninguno desperdiciado.', effects: [{ kind: 'hits', amount: 3, times: 3 }] },
  suturaRapida: { id: 'suturaRapida', name: 'Sutura Rápida', type: 'skill', ap: 1, heat: 1, desc: 'Te coses sin mirar. Ya tienes práctica de sobra.', effects: [{ kind: 'repair', amount: 3 }, { kind: 'heal', amount: 2 }] },
  martilloVapor: { id: 'martilloVapor', name: 'Martillo Vapor', type: 'attack', ap: 2, heat: 3, desc: 'El pistón se dispara con un siseo blanco.', effects: [{ kind: 'damage', amount: 13 }] },
  bielaDoble: { id: 'bielaDoble', name: 'Biela Doble', type: 'attack', ap: 1, heat: 2, desc: 'Dos émbolos, dos impactos, un solo aliento.', effects: [{ kind: 'hits', amount: 3, times: 2 }] },
  coladaArdiente: { id: 'coladaArdiente', name: 'Colada Ardiente', type: 'attack', ap: 3, heat: 5, desc: 'Viertes metal fundido desde la palma abierta.', effects: [{ kind: 'damage', amount: 18 }, { kind: 'selfHarm', amount: 3 }] },
  forjaViva: { id: 'forjaViva', name: 'Forja Viva', type: 'power', ap: 2, heat: 3, desc: 'Tu sangre hierve y cada golpe pesa el doble.', effects: [{ kind: 'status', status: 'strength', amount: 3, to: 'self' }, { kind: 'selfHarm', amount: 2 }] },
  escoriaFundida: { id: 'escoriaFundida', name: 'Escoria Fundida', type: 'attack', ap: 1, heat: 2, desc: 'Salpicas escoria que sigue comiendo carne.', effects: [{ kind: 'damage', amount: 5 }, { kind: 'status', status: 'burn', amount: 3, to: 'enemy' }] },
  sangriaVoraz: { id: 'sangriaVoraz', name: 'Sangría Voraz', type: 'attack', ap: 2, heat: 3, desc: 'Bebes por la palma lo que abres con la uña.', effects: [{ kind: 'damage', amount: 10 }, { kind: 'heal', amount: 5 }] },
  venaAbierta: { id: 'venaAbierta', name: 'Vena Abierta', type: 'attack', ap: 1, heat: 2, desc: 'Ofreces tu sangre para envenenar la suya.', effects: [{ kind: 'selfHarm', amount: 3 }, { kind: 'damage', amount: 12 }] },
  festin: { id: 'festin', name: 'Festín', type: 'skill', ap: 2, heat: 3, desc: 'El brazo se hincha, satisfecho, y se desprende.', effects: [{ kind: 'heal', amount: 12 }, { kind: 'cool', amount: 2 }, { kind: 'exhaust' }] },

  // --- leg cards ----------------------------------------------------------
  patada: { id: 'patada', name: 'Patada', type: 'attack', ap: 1, heat: 2, desc: 'Un talón sucio contra la rodilla contraria.', effects: [{ kind: 'damage', amount: 5 }] },
  quiebro: { id: 'quiebro', name: 'Quiebro', type: 'skill', ap: 1, heat: 1, desc: 'Un paso al lado y el golpe pasa de largo.', effects: [{ kind: 'block', amount: 5 }] },
  pisoton: { id: 'pisoton', name: 'Pisotón', type: 'attack', ap: 1, heat: 2, desc: 'Bajas el pie sobre algo que cruje al ceder.', effects: [{ kind: 'damage', amount: 6 }] },
  plantarse: { id: 'plantarse', name: 'Plantarse', type: 'skill', ap: 1, heat: 1, desc: 'Clavas los dedos en la piedra y aguantas.', effects: [{ kind: 'block', amount: 6 }] },
  zarpazoBajo: { id: 'zarpazoBajo', name: 'Zarpazo Bajo', type: 'attack', ap: 1, heat: 2, desc: 'Las uñas abren la corva de un solo barrido.', effects: [{ kind: 'damage', amount: 7 }] },
  acecho: { id: 'acecho', name: 'Acecho', type: 'skill', ap: 0, heat: 1, desc: 'Rodeas a la presa y ves su punto más blando.', effects: [{ kind: 'draw', amount: 1 }] },
  saltoBrutal: { id: 'saltoBrutal', name: 'Salto Brutal', type: 'attack', ap: 2, heat: 3, desc: 'Caes con todo el peso del cuerpo robado.', effects: [{ kind: 'damage', amount: 12 }, { kind: 'limbDamage', amount: 1 }] },
  impulso: { id: 'impulso', name: 'Impulso', type: 'skill', ap: 0, heat: 1, desc: 'El muelle se suelta y ganas un movimiento.', effects: [{ kind: 'ap', amount: 1 }] },
  barridoEspinas: { id: 'barridoEspinas', name: 'Barrido Espinas', type: 'skill', ap: 2, heat: 2, desc: 'Las espinas quedan erizadas a tu alrededor.', effects: [{ kind: 'status', status: 'thorns', amount: 5, to: 'self' }, { kind: 'block', amount: 4 }] },
  cozQuitina: { id: 'cozQuitina', name: 'Coz de Quitina', type: 'attack', ap: 2, heat: 3, desc: 'Placa córnea contra esternón. Se oye arriba.', effects: [{ kind: 'damage', amount: 14 }] },
  posturaFerrea: { id: 'posturaFerrea', name: 'Postura Férrea', type: 'skill', ap: 1, heat: 2, desc: 'Seis patas imaginarias te sostienen en pie.', effects: [{ kind: 'block', amount: 8 }, { kind: 'repair', amount: 1 }] },
  pasoTumba: { id: 'pasoTumba', name: 'Paso de Tumba', type: 'attack', ap: 3, heat: 4, desc: 'Cada pisada abre una fosa bajo el enemigo.', effects: [{ kind: 'damage', amount: 15 }, { kind: 'status', status: 'weak', amount: 2, to: 'enemy' }] },
  anclaFunebre: { id: 'anclaFunebre', name: 'Ancla Fúnebre', type: 'skill', ap: 1, heat: 2, desc: 'Lo clavas al suelo con un frío de cripta.', effects: [{ kind: 'status', status: 'weak', amount: 1, to: 'enemy' }, { kind: 'status', status: 'frail', amount: 1, to: 'enemy' }] },
  patadaUmbral: { id: 'patadaUmbral', name: 'Patada Umbral', type: 'attack', ap: 2, heat: 2, desc: 'El pie cruza donde no hay puerta y golpea.', effects: [{ kind: 'damage', amount: 9 }, { kind: 'draw', amount: 1 }] },

  // --- stump card (belongs to no blueprint) -------------------------------
  golpeMunon: { id: 'golpeMunon', name: 'Golpe de Muñón', type: 'attack', ap: 1, heat: 0, desc: 'Carne sin mano. Te duele más a ti que a él.', effects: [{ kind: 'damage', amount: 2 }] },
};

export const LIMBS = {
  // --- heads (6) ----------------------------------------------------------
  craneoDesollado: { id: 'craneoDesollado', slot: 'head', name: 'Cráneo Desollado', desc: 'Sin piel, sin párpados, todo ojo.', tier: 1, integrity: 7, heatCap: 4, hpBonus: 1, cards: ['miradaVacia', 'mordisco'], color: 'bone' },
  mascaraLaton: { id: 'mascaraLaton', slot: 'head', name: 'Máscara de Latón', desc: 'Latón frío atornillado al hueso.', tier: 1, integrity: 8, heatCap: 4, hpBonus: 2, cards: ['respiroFrio', 'cabezazo'], color: 'brass' },
  craneoVidente: { id: 'craneoVidente', slot: 'head', name: 'Cráneo Vidente', desc: 'Lee el golpe antes de que ocurra.', tier: 2, integrity: 7, heatCap: 4, hpBonus: 2, cards: ['visionTurbia', 'presagio'], color: 'arcane' },
  testaSabuesa: { id: 'testaSabuesa', slot: 'head', name: 'Testa de Sabueso', desc: 'Hocico largo, dientes de sobra.', tier: 2, integrity: 9, heatCap: 5, hpBonus: 3, cards: ['dentellada', 'rastroSangre'], color: 'rust' },
  craneoAlquimico: { id: 'craneoAlquimico', slot: 'head', name: 'Cráneo Alquímico', desc: 'Un alambique donde hubo sesos.', tier: 3, integrity: 8, heatCap: 6, hpBonus: 3, cards: ['transmutacion', 'lluviaAcida', 'mentePlomo'], color: 'acid' },
  craneoHorno: { id: 'craneoHorno', slot: 'head', name: 'Cráneo Horno', desc: 'La hoguera vive tras las cuencas.', tier: 3, integrity: 10, heatCap: 7, hpBonus: 4, cards: ['alientoIgneo', 'purgaTermica', 'ojoBrasa'], color: 'fire' },

  // --- torsos (5) ---------------------------------------------------------
  torsoRemendado: { id: 'torsoRemendado', slot: 'torso', name: 'Torso Remendado', desc: 'Tres cadáveres cosidos con hilo basto.', tier: 1, integrity: 9, heatCap: 3, hpBonus: 5, cards: ['costillar', 'puntadas'], color: 'flesh' },
  pechoOsario: { id: 'pechoOsario', slot: 'torso', name: 'Pecho Osario', desc: 'Costillas ajenas trenzadas en jaula.', tier: 1, integrity: 8, heatCap: 3, hpBonus: 4, cards: ['escudoCostal', 'esquirlas'], color: 'bone' },
  torsoCaldera: { id: 'torsoCaldera', slot: 'torso', name: 'Torso Caldera', desc: 'Cobre remachado y presión constante.', tier: 2, integrity: 10, heatCap: 6, hpBonus: 8, cards: ['valvulaVapor', 'sobrepresion'], color: 'copper' },
  cajaFuelle: { id: 'cajaFuelle', slot: 'torso', name: 'Caja de Fuelle', desc: 'Respira por ti y aún te sobra aliento.', tier: 2, integrity: 9, heatCap: 5, hpBonus: 7, cards: ['fuelleDoble', 'hollinNegro'], color: 'rust' },
  torsoReliquia: { id: 'torsoReliquia', slot: 'torso', name: 'Torso Reliquia', desc: 'Late icor bendito bajo el esternón.', tier: 3, integrity: 12, heatCap: 6, hpBonus: 12, cards: ['corazonIcor', 'salmodia', 'costraSanta'], color: 'ichor' },

  // --- arms (8) -----------------------------------------------------------
  brazoCarnicero: { id: 'brazoCarnicero', slot: 'arm', name: 'Brazo Carnicero', desc: 'Viene con su cuchillo ya en la mano.', tier: 1, integrity: 8, heatCap: 4, hpBonus: 0, cards: ['cuchillada', 'desgarro'], color: 'gore' },
  brazoHuesudo: { id: 'brazoHuesudo', slot: 'arm', name: 'Brazo Huesudo', desc: 'Puro hueso y rencor seco.', tier: 1, integrity: 7, heatCap: 3, hpBonus: 0, cards: ['punetazoSeco', 'garraOsea'], color: 'bone' },
  brazoZurcido: { id: 'brazoZurcido', slot: 'arm', name: 'Brazo Zurcido', desc: 'Zurcido a ojo. Responde con retraso.', tier: 1, integrity: 7, heatCap: 4, hpBonus: 0, cards: ['manotazo', 'agarreTorpe'], color: 'flesh' },
  brazoGuillotina: { id: 'brazoGuillotina', slot: 'arm', name: 'Brazo Guillotina', desc: 'Una hoja pesada por codo.', tier: 2, integrity: 9, heatCap: 5, hpBonus: 0, cards: ['tajoGuillotina', 'amputacion'], color: 'stone' },
  brazoBisturi: { id: 'brazoBisturi', slot: 'arm', name: 'Brazo Bisturí', desc: 'Dedos finos que saben dónde cortar.', tier: 2, integrity: 8, heatCap: 4, hpBonus: 0, cards: ['incision', 'suturaRapida'], color: 'pale' },
  brazoPiston: { id: 'brazoPiston', slot: 'arm', name: 'Brazo Pistón', desc: 'Vapor comprimido en vez de músculo.', tier: 2, integrity: 10, heatCap: 6, hpBonus: 0, cards: ['martilloVapor', 'bielaDoble'], color: 'copper' },
  brazoCrisol: { id: 'brazoCrisol', slot: 'arm', name: 'Brazo Crisol', desc: 'La palma es un crisol siempre al rojo.', tier: 3, integrity: 10, heatCap: 7, hpBonus: 0, cards: ['coladaArdiente', 'forjaViva', 'escoriaFundida'], color: 'ember' },
  brazoSanguijuela: { id: 'brazoSanguijuela', slot: 'arm', name: 'Brazo Sanguijuela', desc: 'Bebe lo que abre. Nunca se sacia.', tier: 3, integrity: 9, heatCap: 6, hpBonus: 0, cards: ['sangriaVoraz', 'venaAbierta', 'festin'], color: 'blood' },

  // --- legs (6) -----------------------------------------------------------
  piernaZancuda: { id: 'piernaZancuda', slot: 'leg', name: 'Pierna Zancuda', desc: 'Larga, flaca y sorprendentemente veloz.', tier: 1, integrity: 7, heatCap: 4, hpBonus: 0, cards: ['patada', 'quiebro'], color: 'ash' },
  piernaNudosa: { id: 'piernaNudosa', slot: 'leg', name: 'Pierna Nudosa', desc: 'Nudos de tendón sobre hueso grueso.', tier: 1, integrity: 8, heatCap: 4, hpBonus: 0, cards: ['pisoton', 'plantarse'], color: 'rust' },
  zarpaSabueso: { id: 'zarpaSabueso', slot: 'leg', name: 'Zarpa de Sabueso', desc: 'Almohadillas negras y uñas curvas.', tier: 2, integrity: 8, heatCap: 5, hpBonus: 0, cards: ['zarpazoBajo', 'acecho'], color: 'flesh' },
  piernaResorte: { id: 'piernaResorte', slot: 'leg', name: 'Pierna de Resorte', desc: 'Muelles de acero bajo la rodilla.', tier: 2, integrity: 9, heatCap: 5, hpBonus: 0, cards: ['saltoBrutal', 'impulso'], color: 'brass' },
  zancaQuitina: { id: 'zancaQuitina', slot: 'leg', name: 'Zanca de Quitina', desc: 'Placa córnea erizada de espinas.', tier: 3, integrity: 11, heatCap: 6, hpBonus: 0, cards: ['barridoEspinas', 'cozQuitina', 'posturaFerrea'], color: 'bile' },
  piernaSepulcral: { id: 'piernaSepulcral', slot: 'leg', name: 'Pierna Sepulcral', desc: 'Huele a cripta y pisa como una losa.', tier: 3, integrity: 10, heatCap: 6, hpBonus: 0, cards: ['pasoTumba', 'anclaFunebre', 'patadaUmbral'], color: 'violet' },
};

export const ENEMIES = {
  injertado: {
    id: 'injertado', name: 'El Injertado', tier: 1, hp: 18, color: 'flesh',
    quip: '¿Tú también te despertaste?',
    limbs: ['brazoZurcido', 'torsoRemendado', 'piernaZancuda'],
    moves: [
      { name: 'Manotazo', kind: 'attack', amount: 6, times: 1, weight: 4 },
      { name: 'Sacudida', kind: 'multi', amount: 3, times: 2, weight: 3 },
      { name: 'Cubrirse', kind: 'block', amount: 5, times: 1, weight: 2 },
    ],
  },
  aprendiz: {
    id: 'aprendiz', name: 'Aprendiz Mudo', tier: 1, hp: 15, color: 'arcane',
    quip: 'El maestro te quiere entero.',
    limbs: ['craneoDesollado', 'brazoHuesudo'],
    moves: [
      { name: 'Aguja Larga', kind: 'attack', amount: 5, times: 1, weight: 4 },
      { name: 'Salmo Torpe', kind: 'debuff', amount: 1, times: 1, weight: 2 },
      { name: 'Golpe Ciego', kind: 'attack', amount: 8, times: 1, weight: 2 },
    ],
  },
  sabueso: {
    id: 'sabueso', name: 'Sabueso Injerto', tier: 2, hp: 28, color: 'rust',
    quip: 'Huele tu sangre nueva.',
    limbs: ['zarpaSabueso', 'piernaNudosa', 'testaSabuesa'],
    moves: [
      { name: 'Dentellada', kind: 'multi', amount: 4, times: 3, weight: 4 },
      { name: 'Embestida', kind: 'attack', amount: 10, times: 1, weight: 3 },
      { name: 'Tarascada', kind: 'limbstrike', amount: 7, times: 1, weight: 3 },
    ],
  },
  cirujano: {
    id: 'cirujano', name: 'El Cirujano', tier: 2, hp: 32, color: 'pale',
    quip: 'Quieto. Esto lo arreglo yo.',
    limbs: ['brazoBisturi', 'brazoGuillotina', 'pechoOsario'],
    moves: [
      { name: 'Incisión', kind: 'limbstrike', amount: 8, times: 1, weight: 4 },
      { name: 'Sierra Curva', kind: 'attack', amount: 11, times: 1, weight: 3 },
      { name: 'Éter', kind: 'debuff', amount: 2, times: 1, weight: 2 },
      { name: 'Bata Gruesa', kind: 'block', amount: 8, times: 1, weight: 1 },
    ],
  },
  bibliotecario: {
    id: 'bibliotecario', name: 'El Bibliotecario', tier: 2, hp: 36, color: 'violet',
    quip: 'Tu nombre ya está en el índice.',
    limbs: ['craneoVidente', 'mascaraLaton', 'cajaFuelle'],
    moves: [
      { name: 'Índice Roto', kind: 'attack', amount: 9, times: 1, weight: 3 },
      { name: 'Tomo Pesado', kind: 'attack', amount: 13, times: 1, weight: 2 },
      { name: 'Letanía', kind: 'buff', amount: 2, times: 1, weight: 2 },
      { name: 'Polvo Antiguo', kind: 'debuff', amount: 2, times: 1, weight: 2 },
    ],
  },
  archialquimista: {
    id: 'archialquimista', name: 'Archialquimista', tier: 3, hp: 70, color: 'acid',
    quip: 'Devuélveme lo que te presté.',
    limbs: ['craneoAlquimico', 'torsoReliquia', 'brazoCrisol', 'piernaSepulcral'],
    moves: [
      { name: 'Vitriolo', kind: 'attack', amount: 14, times: 1, weight: 4 },
      { name: 'Mercurio Vivo', kind: 'multi', amount: 5, times: 3, weight: 3 },
      { name: 'Extracción', kind: 'limbstrike', amount: 12, times: 1, weight: 3 },
      { name: 'Gran Obra', kind: 'buff', amount: 3, times: 1, weight: 2 },
    ],
  },
};

// Tier 1 blueprints used to assemble a fresh body on the slab.
export const BASIC = {
  head: ['craneoDesollado', 'mascaraLaton'],
  torso: ['torsoRemendado', 'pechoOsario'],
  arm: ['brazoCarnicero', 'brazoHuesudo', 'brazoZurcido'],
  leg: ['piernaZancuda', 'piernaNudosa'],
};

// Cards granted by an empty (broken off) slot.
export const STUMP_CARDS = ['golpeMunon'];
