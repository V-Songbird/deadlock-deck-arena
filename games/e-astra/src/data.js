/* Deadlock Deck — contenido original. Sin dependencias. */
'use strict';

window.DDData = (() => {
  const T = window.DDLang.t;

  const slots = [
    { id: 'head', label: T('Cabeza'), short: T('Cabeza'), kind: 'head' },
    { id: 'torso', label: T('Torso'), short: T('Torso'), kind: 'torso' },
    { id: 'armL', label: T('Brazo izquierdo'), short: T('Brazo I'), kind: 'arm' },
    { id: 'armR', label: T('Brazo derecho'), short: T('Brazo D'), kind: 'arm' },
    { id: 'legL', label: T('Pierna izquierda'), short: T('Pierna I'), kind: 'leg' },
    { id: 'legR', label: T('Pierna derecha'), short: T('Pierna D'), kind: 'leg' }
  ];

  const cards = {
    focus: { name: T('Lucidez prestada'), cost: 0, draw: 2, heat: 16, wear: 3, icon: 'eye', text: T('Roba 2 cartas.') },
    whisper: { name: T('Susurro impuro'), cost: 1, damage: 7, weak: 1, heat: 14, wear: 3, icon: 'eye', text: T('7 de daño. Debilita 1 turno.') },
    diagnose: { name: T('Diagnóstico'), cost: 1, draw: 2, heal: 5, heat: 15, wear: 3, icon: 'eye', text: T('Roba 2 cartas. Recupera 5 de vida.') },
    incision: { name: T('Incisión precisa'), cost: 1, damage: 12, pierce: true, heat: 22, wear: 5, icon: 'blade', text: T('12 de daño. Ignora la defensa.') },
    omen: { name: T('Mal augurio'), cost: 2, damage: 15, stun: 1, heat: 34, wear: 8, icon: 'eye', text: T('15 de daño. Cancela la intención enemiga.') },
    vision: { name: T('Visión imposible'), cost: 0, draw: 3, heat: 27, wear: 6, icon: 'eye', text: T('Roba 3 cartas.') },
    bite: { name: T('Hambre de tumba'), cost: 1, damage: 11, heal: 4, heat: 23, wear: 5, icon: 'fang', text: T('11 de daño. Recupera 4 de vida.') },
    scream: { name: T('Grito sin lengua'), cost: 1, weak: 2, draw: 1, heat: 19, wear: 4, icon: 'fang', text: T('Debilita 2 turnos. Roba 1 carta.') },
    stitch: { name: T('Sutura de urgencia'), cost: 1, heal: 9, heat: 17, wear: 4, icon: 'heart', text: T('Recupera 9 de vida.') },
    brace: { name: T('Costillas cerradas'), cost: 1, block: 11, heat: 12, wear: 3, icon: 'shield', text: T('Obtén 11 de defensa.') },
    eruption: { name: T('Combustión interna'), cost: 2, damage: 25, burn: 3, heat: 42, wear: 11, icon: 'flame', text: T('25 de daño. Aplica 3 de quemadura.') },
    vent: { name: T('Válvula de escape'), cost: 1, cool: 28, heat: 4, wear: 2, icon: 'snow', text: T('Enfría todos tus injertos 28°.') },
    ironwall: { name: T('Bastión de hierro'), cost: 1, block: 19, heat: 20, wear: 5, icon: 'shield', text: T('Obtén 19 de defensa.') },
    recoil: { name: T('Retroceso blindado'), cost: 1, damage: 8, block: 9, heat: 22, wear: 5, icon: 'shield', text: T('8 de daño. Obtén 9 de defensa.') },
    transfusion: { name: T('Sangre de mercurio'), cost: 1, heal: 15, heat: 27, wear: 6, icon: 'heart', text: T('Recupera 15 de vida.') },
    surge: { name: T('Segundo corazón'), cost: 0, energy: 2, heat: 36, wear: 9, icon: 'bolt', text: T('Obtén 2 de energía.') },
    slash: { name: T('Tajo de hueso'), cost: 1, damage: 10, heat: 16, wear: 4, icon: 'blade', text: T('10 de daño.') },
    heavy: { name: T('Fractura expuesta'), cost: 2, damage: 19, heat: 28, wear: 6, icon: 'bone', text: T('19 de daño.') },
    scalpel: { name: T('Corte quirúrgico'), cost: 1, damage: 13, heat: 22, wear: 5, icon: 'blade', text: T('13 de daño.') },
    dissect: { name: T('Disección viva'), cost: 2, damage: 21, weak: 1, heat: 33, wear: 8, icon: 'blade', text: T('21 de daño. Debilita 1 turno.') },
    rip: { name: T('Desgarro necrótico'), cost: 1, damage: 10, burn: 4, heat: 24, wear: 5, icon: 'fang', text: T('10 de daño. Aplica 4 de quemadura.') },
    reap: { name: T('Cosecha carmesí'), cost: 2, damage: 19, heal: 7, heat: 32, wear: 7, icon: 'fang', text: T('19 de daño. Recupera 7 de vida.') },
    discharge: { name: T('Descarga galvánica'), cost: 2, damage: 26, heat: 41, wear: 10, icon: 'bolt', text: T('26 de daño.') },
    arc: { name: T('Arco paralizante'), cost: 1, damage: 8, stun: 1, heat: 34, wear: 8, icon: 'bolt', text: T('8 de daño. Cancela la intención enemiga.') },
    punch: { name: T('Puño de pistón'), cost: 1, damage: 16, heat: 28, wear: 6, icon: 'bone', text: T('16 de daño.') },
    crusher: { name: T('Prensa hidráulica'), cost: 3, damage: 43, heat: 52, wear: 14, icon: 'bone', text: T('43 de daño. Un precio terrible.') },
    kick: { name: T('Patada de cadáver'), cost: 1, damage: 8, block: 3, heat: 13, wear: 3, icon: 'foot', text: T('8 de daño. Obtén 3 de defensa.') },
    dodge: { name: T('Paso torcido'), cost: 1, block: 10, heat: 12, wear: 3, icon: 'foot', text: T('Obtén 10 de defensa.') },
    leap: { name: T('Salto arácnido'), cost: 1, damage: 9, block: 9, heat: 23, wear: 5, icon: 'foot', text: T('9 de daño. Obtén 9 de defensa.') },
    silk: { name: T('Seda de sutura'), cost: 1, weak: 2, draw: 1, heat: 20, wear: 4, icon: 'shield', text: T('Debilita 2 turnos. Roba 1 carta.') },
    impact: { name: T('Rodilla de acero'), cost: 2, damage: 24, heat: 31, wear: 7, icon: 'foot', text: T('24 de daño.') },
    momentum: { name: T('Inercia prohibida'), cost: 0, energy: 1, draw: 1, heat: 25, wear: 6, icon: 'bolt', text: T('Obtén 1 de energía. Roba 1 carta.') },
    grave: { name: T('Quietud de mármol'), cost: 1, block: 15, cool: 10, heat: 14, wear: 3, icon: 'shield', text: T('15 de defensa. Enfría todos los injertos 10°.') },
    silent: { name: T('Paso entre tumbas'), cost: 1, block: 6, draw: 2, heat: 20, wear: 4, icon: 'foot', text: T('6 de defensa. Roba 2 cartas.') },
    forbidden: { name: T('Liturgia de ceniza'), cost: 2, damage: 18, burn: 8, heat: 39, wear: 10, icon: 'flame', text: T('18 de daño. Aplica 8 de quemadura.') },
    echoes: { name: T('Coro de los muertos'), cost: 1, draw: 2, energy: 1, heat: 31, wear: 7, icon: 'eye', text: T('Roba 2 cartas. Obtén 1 de energía.') },
    stumpHead: { name: T('Eco del espíritu'), cost: 1, damage: 3, heat: 0, wear: 0, icon: 'eye', text: T('3 de daño. Necesitas una cabeza.') },
    stumpTorso: { name: T('Último latido'), cost: 1, block: 4, heat: 0, wear: 0, icon: 'heart', text: T('4 de defensa. Necesitas un torso.') },
    stumpArm: { name: T('Golpe de muñón'), cost: 1, damage: 4, heat: 0, wear: 0, icon: 'bone', text: T('4 de daño. Necesitas un brazo.') },
    stumpLeg: { name: T('Arrastrarse'), cost: 1, block: 3, heat: 0, wear: 0, icon: 'foot', text: T('3 de defensa. Necesitas una pierna.') }
  };

  const parts = {
    skull: { name: T('Cráneo cosido'), kind: 'head', tier: 1, color: '#8fa58e', cards: ['focus', 'whisper'], lore: T('Alguien dejó un recuerdo dentro.') },
    surgeon: { name: T('Máscara del cirujano'), kind: 'head', tier: 2, color: '#bda8b7', cards: ['diagnose', 'incision'], lore: T('El último rostro que vieron sus pacientes.') },
    oracle: { name: T('Oráculo de vidrio'), kind: 'head', tier: 3, color: '#79b9b6', cards: ['omen', 'vision'], lore: T('Ve futuros que no deberían existir.') },
    jaw: { name: T('Mandíbula de fosa'), kind: 'head', tier: 2, color: '#bc7e78', cards: ['bite', 'scream'], lore: T('La muerte no le quitó el apetito.') },
    sutures: { name: T('Torso de suturas'), kind: 'torso', tier: 1, color: '#8fa58e', cards: ['stitch', 'brace'], lore: T('Seis vidas. Una mala costura.') },
    boiler: { name: T('Caldera torácica'), kind: 'torso', tier: 3, color: '#ce9759', cards: ['eruption', 'vent'], lore: T('La llama ocupa el lugar del corazón.') },
    iron: { name: T('Caja de hierro'), kind: 'torso', tier: 2, color: '#859498', cards: ['ironwall', 'recoil'], lore: T('Ningún pulmón. Ninguna duda.') },
    mercury: { name: T('Corazón de mercurio'), kind: 'torso', tier: 3, color: '#a3c1cb', cards: ['transfusion', 'surge'], lore: T('Una segunda vida, a interés compuesto.') },
    bone: { name: T('Brazo de hueso'), kind: 'arm', tier: 1, color: '#c4bca2', cards: ['slash', 'heavy'], lore: T('Todavía recuerda cómo romper cosas.') },
    scalpel: { name: T('Brazo de bisturís'), kind: 'arm', tier: 2, color: '#adb8b0', cards: ['scalpel', 'dissect'], lore: T('La precisión también puede ser crueldad.') },
    claw: { name: T('Garra de la morgue'), kind: 'arm', tier: 2, color: '#bd8178', cards: ['rip', 'reap'], lore: T('Nada que toque vuelve a estar entero.') },
    cannon: { name: T('Cañón galvánico'), kind: 'arm', tier: 3, color: '#c99e60', cards: ['discharge', 'arc'], lore: T('Un trueno encerrado en carne.') },
    piston: { name: T('Puño hidráulico'), kind: 'arm', tier: 3, color: '#b39979', cards: ['punch', 'crusher'], lore: T('Diseñado para trabajar. Adaptado para sobrevivir.') },
    legs: { name: T('Pierna reanimada'), kind: 'leg', tier: 1, color: '#8fa58e', cards: ['kick', 'dodge'], lore: T('Un paso más lejos de la mesa.') },
    spider: { name: T('Zanca arácnida'), kind: 'leg', tier: 2, color: '#9c93b9', cards: ['leap', 'silk'], lore: T('Demasiadas articulaciones. Ningún tropiezo.') },
    pistons: { name: T('Pierna de pistón'), kind: 'leg', tier: 3, color: '#c19860', cards: ['impact', 'momentum'], lore: T('El hierro tampoco quiere arder.') },
    funeral: { name: T('Pie funerario'), kind: 'leg', tier: 2, color: '#879caf', cards: ['grave', 'silent'], lore: T('Aprendió a caminar entre los muertos.') },
    ash: { name: T('Cráneo de ceniza'), kind: 'head', tier: 3, color: '#d09262', cards: ['forbidden', 'echoes'], lore: T('El archivo prohibido habla a través de ti.'), expansion: true }
  };

  const enemies = {
    orderly: { name: T('Celador de la morgue'), tag: T('ABOMINACIÓN'), sprite: 'brute', hp: 30, attack: 9, loot: ['claw', 'bone', 'funeral'], pattern: ['attack', 'guard', 'attack', 'fury'] },
    scientist: { name: T('Cirujano apóstata'), tag: T('CIENTÍFICO CORRUPTO'), sprite: 'scientist', hp: 27, attack: 8, loot: ['surgeon', 'scalpel', 'mercury'], pattern: ['attack', 'heat', 'attack', 'guard'] },
    stitched: { name: T('El mal cosido'), tag: T('ABOMINACIÓN'), sprite: 'stitched', hp: 34, attack: 10, loot: ['jaw', 'iron', 'spider'], pattern: ['guard', 'attack', 'fury', 'attack'] },
    furnace: { name: T('Custodio de la caldera'), tag: T('AUTÓMATA ALQUÍMICO'), sprite: 'furnace', hp: 39, attack: 11, loot: ['boiler', 'cannon', 'pistons', 'piston'], pattern: ['attack', 'heat', 'fury', 'guard'] },
    oracle: { name: T('Anatomista sin ojos'), tag: T('CIENTÍFICO CORRUPTO'), sprite: 'oracle', hp: 33, attack: 10, loot: ['oracle', 'mercury', 'surgeon'], pattern: ['heat', 'attack', 'guard', 'fury'] },
    archivist: { name: T('Archivista de ceniza'), tag: T('ALA PROHIBIDA'), sprite: 'ash', hp: 40, attack: 11, loot: ['ash', 'boiler'], pattern: ['heat', 'fury', 'guard', 'attack'] },
    boss: { name: T('El Rector de Carne'), tag: T('GUARDIÁN DE LA SALIDA'), sprite: 'boss', hp: 95, attack: 15, loot: ['cannon', 'mercury', 'oracle'], pattern: ['attack', 'guard', 'fury', 'heat', 'fury'], boss: true }
  };

  const floors = [
    { name: T('Laboratorios de sutura'), small: T('Laboratorio'), roman: 'I', subtitle: T('Donde la muerte es apenas un procedimiento.') },
    { name: T('Fundición de los réprobos'), small: T('Fundición'), roman: 'II', subtitle: T('El humo ya conoce tu nombre.') },
    { name: T('Observatorio del Rector'), small: T('Observatorio'), roman: 'III', subtitle: T('La última puerta todavía respira.') }
  ];

  const roomNames = {
    start: T('Mesa de disección'), corridor: T('Pasillo de ceniza'), combat: T('Sala de contención'),
    cache: T('Suministros abandonados'), workshop: T('Estación de injertos'), trap: T('Conducto de vapor'),
    stairs: T('Escalera de caracol'), boss: T('El umbral del Rector'), archive: T('Archivo anatómico')
  };

  const skins = {
    suture: { name: T('Piel de suturas'), cost: 0, color: '#8fa58e', description: T('Carne prestada. Puntadas imperfectas.') },
    copper: { name: T('Óxido y cobre'), cost: 15, color: '#bd875b', description: T('Pátina cobriza para tu nuevo cuerpo.') },
    spectral: { name: T('Espíritu de éter'), cost: 25, color: '#72b9bd', description: T('Un resplandor espectral entre las costuras.') },
    crimson: { name: T('Luto carmesí'), cost: 35, color: '#be777d', description: T('El color de lo que no has olvidado.') }
  };

  return { slots, cards, parts, enemies, floors, roomNames, skins };
})();
