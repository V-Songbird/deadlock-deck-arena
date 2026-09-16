/* Deadlock Deck — contenido original. Sin dependencias. */
'use strict';

window.DDData = (() => {
  const slots = [
    { id: 'head', label: 'Cabeza', short: 'Cabeza', kind: 'head' },
    { id: 'torso', label: 'Torso', short: 'Torso', kind: 'torso' },
    { id: 'armL', label: 'Brazo izquierdo', short: 'Brazo I', kind: 'arm' },
    { id: 'armR', label: 'Brazo derecho', short: 'Brazo D', kind: 'arm' },
    { id: 'legL', label: 'Pierna izquierda', short: 'Pierna I', kind: 'leg' },
    { id: 'legR', label: 'Pierna derecha', short: 'Pierna D', kind: 'leg' }
  ];

  const cards = {
    focus: { name: 'Lucidez prestada', cost: 0, draw: 2, heat: 16, wear: 3, icon: 'eye', text: 'Roba 2 cartas.' },
    whisper: { name: 'Susurro impuro', cost: 1, damage: 7, weak: 1, heat: 14, wear: 3, icon: 'eye', text: '7 de daño. Debilita 1 turno.' },
    diagnose: { name: 'Diagnóstico', cost: 1, draw: 2, heal: 5, heat: 15, wear: 3, icon: 'eye', text: 'Roba 2 cartas. Recupera 5 de vida.' },
    incision: { name: 'Incisión precisa', cost: 1, damage: 12, pierce: true, heat: 22, wear: 5, icon: 'blade', text: '12 de daño. Ignora la defensa.' },
    omen: { name: 'Mal augurio', cost: 2, damage: 15, stun: 1, heat: 34, wear: 8, icon: 'eye', text: '15 de daño. Cancela la intención enemiga.' },
    vision: { name: 'Visión imposible', cost: 0, draw: 3, heat: 27, wear: 6, icon: 'eye', text: 'Roba 3 cartas.' },
    bite: { name: 'Hambre de tumba', cost: 1, damage: 11, heal: 4, heat: 23, wear: 5, icon: 'fang', text: '11 de daño. Recupera 4 de vida.' },
    scream: { name: 'Grito sin lengua', cost: 1, weak: 2, draw: 1, heat: 19, wear: 4, icon: 'fang', text: 'Debilita 2 turnos. Roba 1 carta.' },
    stitch: { name: 'Sutura de urgencia', cost: 1, heal: 9, heat: 17, wear: 4, icon: 'heart', text: 'Recupera 9 de vida.' },
    brace: { name: 'Costillas cerradas', cost: 1, block: 11, heat: 12, wear: 3, icon: 'shield', text: 'Obtén 11 de defensa.' },
    eruption: { name: 'Combustión interna', cost: 2, damage: 25, burn: 3, heat: 42, wear: 11, icon: 'flame', text: '25 de daño. Aplica 3 de quemadura.' },
    vent: { name: 'Válvula de escape', cost: 1, cool: 28, heat: 4, wear: 2, icon: 'snow', text: 'Enfría todos tus injertos 28°.' },
    ironwall: { name: 'Bastión de hierro', cost: 1, block: 19, heat: 20, wear: 5, icon: 'shield', text: 'Obtén 19 de defensa.' },
    recoil: { name: 'Retroceso blindado', cost: 1, damage: 8, block: 9, heat: 22, wear: 5, icon: 'shield', text: '8 de daño. Obtén 9 de defensa.' },
    transfusion: { name: 'Sangre de mercurio', cost: 1, heal: 15, heat: 27, wear: 6, icon: 'heart', text: 'Recupera 15 de vida.' },
    surge: { name: 'Segundo corazón', cost: 0, energy: 2, heat: 36, wear: 9, icon: 'bolt', text: 'Obtén 2 de energía.' },
    slash: { name: 'Tajo de hueso', cost: 1, damage: 10, heat: 16, wear: 4, icon: 'blade', text: '10 de daño.' },
    heavy: { name: 'Fractura expuesta', cost: 2, damage: 19, heat: 28, wear: 6, icon: 'bone', text: '19 de daño.' },
    scalpel: { name: 'Corte quirúrgico', cost: 1, damage: 13, heat: 22, wear: 5, icon: 'blade', text: '13 de daño.' },
    dissect: { name: 'Disección viva', cost: 2, damage: 21, weak: 1, heat: 33, wear: 8, icon: 'blade', text: '21 de daño. Debilita 1 turno.' },
    rip: { name: 'Desgarro necrótico', cost: 1, damage: 10, burn: 4, heat: 24, wear: 5, icon: 'fang', text: '10 de daño. Aplica 4 de quemadura.' },
    reap: { name: 'Cosecha carmesí', cost: 2, damage: 19, heal: 7, heat: 32, wear: 7, icon: 'fang', text: '19 de daño. Recupera 7 de vida.' },
    discharge: { name: 'Descarga galvánica', cost: 2, damage: 26, heat: 41, wear: 10, icon: 'bolt', text: '26 de daño.' },
    arc: { name: 'Arco paralizante', cost: 1, damage: 8, stun: 1, heat: 34, wear: 8, icon: 'bolt', text: '8 de daño. Cancela la intención enemiga.' },
    punch: { name: 'Puño de pistón', cost: 1, damage: 16, heat: 28, wear: 6, icon: 'bone', text: '16 de daño.' },
    crusher: { name: 'Prensa hidráulica', cost: 3, damage: 43, heat: 52, wear: 14, icon: 'bone', text: '43 de daño. Un precio terrible.' },
    kick: { name: 'Patada de cadáver', cost: 1, damage: 8, block: 3, heat: 13, wear: 3, icon: 'foot', text: '8 de daño. Obtén 3 de defensa.' },
    dodge: { name: 'Paso torcido', cost: 1, block: 10, heat: 12, wear: 3, icon: 'foot', text: 'Obtén 10 de defensa.' },
    leap: { name: 'Salto arácnido', cost: 1, damage: 9, block: 9, heat: 23, wear: 5, icon: 'foot', text: '9 de daño. Obtén 9 de defensa.' },
    silk: { name: 'Seda de sutura', cost: 1, weak: 2, draw: 1, heat: 20, wear: 4, icon: 'shield', text: 'Debilita 2 turnos. Roba 1 carta.' },
    impact: { name: 'Rodilla de acero', cost: 2, damage: 24, heat: 31, wear: 7, icon: 'foot', text: '24 de daño.' },
    momentum: { name: 'Inercia prohibida', cost: 0, energy: 1, draw: 1, heat: 25, wear: 6, icon: 'bolt', text: 'Obtén 1 de energía. Roba 1 carta.' },
    grave: { name: 'Quietud de mármol', cost: 1, block: 15, cool: 10, heat: 14, wear: 3, icon: 'shield', text: '15 de defensa. Enfría todos los injertos 10°.' },
    silent: { name: 'Paso entre tumbas', cost: 1, block: 6, draw: 2, heat: 20, wear: 4, icon: 'foot', text: '6 de defensa. Roba 2 cartas.' },
    forbidden: { name: 'Liturgia de ceniza', cost: 2, damage: 18, burn: 8, heat: 39, wear: 10, icon: 'flame', text: '18 de daño. Aplica 8 de quemadura.' },
    echoes: { name: 'Coro de los muertos', cost: 1, draw: 2, energy: 1, heat: 31, wear: 7, icon: 'eye', text: 'Roba 2 cartas. Obtén 1 de energía.' },
    stumpHead: { name: 'Eco del espíritu', cost: 1, damage: 3, heat: 0, wear: 0, icon: 'eye', text: '3 de daño. Necesitas una cabeza.' },
    stumpTorso: { name: 'Último latido', cost: 1, block: 4, heat: 0, wear: 0, icon: 'heart', text: '4 de defensa. Necesitas un torso.' },
    stumpArm: { name: 'Golpe de muñón', cost: 1, damage: 4, heat: 0, wear: 0, icon: 'bone', text: '4 de daño. Necesitas un brazo.' },
    stumpLeg: { name: 'Arrastrarse', cost: 1, block: 3, heat: 0, wear: 0, icon: 'foot', text: '3 de defensa. Necesitas una pierna.' }
  };

  const parts = {
    skull: { name: 'Cráneo cosido', kind: 'head', tier: 1, color: '#8fa58e', cards: ['focus', 'whisper'], lore: 'Alguien dejó un recuerdo dentro.' },
    surgeon: { name: 'Máscara del cirujano', kind: 'head', tier: 2, color: '#bda8b7', cards: ['diagnose', 'incision'], lore: 'El último rostro que vieron sus pacientes.' },
    oracle: { name: 'Oráculo de vidrio', kind: 'head', tier: 3, color: '#79b9b6', cards: ['omen', 'vision'], lore: 'Ve futuros que no deberían existir.' },
    jaw: { name: 'Mandíbula de fosa', kind: 'head', tier: 2, color: '#bc7e78', cards: ['bite', 'scream'], lore: 'La muerte no le quitó el apetito.' },
    sutures: { name: 'Torso de suturas', kind: 'torso', tier: 1, color: '#8fa58e', cards: ['stitch', 'brace'], lore: 'Seis vidas. Una mala costura.' },
    boiler: { name: 'Caldera torácica', kind: 'torso', tier: 3, color: '#ce9759', cards: ['eruption', 'vent'], lore: 'La llama ocupa el lugar del corazón.' },
    iron: { name: 'Caja de hierro', kind: 'torso', tier: 2, color: '#859498', cards: ['ironwall', 'recoil'], lore: 'Ningún pulmón. Ninguna duda.' },
    mercury: { name: 'Corazón de mercurio', kind: 'torso', tier: 3, color: '#a3c1cb', cards: ['transfusion', 'surge'], lore: 'Una segunda vida, a interés compuesto.' },
    bone: { name: 'Brazo de hueso', kind: 'arm', tier: 1, color: '#c4bca2', cards: ['slash', 'heavy'], lore: 'Todavía recuerda cómo romper cosas.' },
    scalpel: { name: 'Brazo de bisturís', kind: 'arm', tier: 2, color: '#adb8b0', cards: ['scalpel', 'dissect'], lore: 'La precisión también puede ser crueldad.' },
    claw: { name: 'Garra de la morgue', kind: 'arm', tier: 2, color: '#bd8178', cards: ['rip', 'reap'], lore: 'Nada que toque vuelve a estar entero.' },
    cannon: { name: 'Cañón galvánico', kind: 'arm', tier: 3, color: '#c99e60', cards: ['discharge', 'arc'], lore: 'Un trueno encerrado en carne.' },
    piston: { name: 'Puño hidráulico', kind: 'arm', tier: 3, color: '#b39979', cards: ['punch', 'crusher'], lore: 'Diseñado para trabajar. Adaptado para sobrevivir.' },
    legs: { name: 'Pierna reanimada', kind: 'leg', tier: 1, color: '#8fa58e', cards: ['kick', 'dodge'], lore: 'Un paso más lejos de la mesa.' },
    spider: { name: 'Zanca arácnida', kind: 'leg', tier: 2, color: '#9c93b9', cards: ['leap', 'silk'], lore: 'Demasiadas articulaciones. Ningún tropiezo.' },
    pistons: { name: 'Pierna de pistón', kind: 'leg', tier: 3, color: '#c19860', cards: ['impact', 'momentum'], lore: 'El hierro tampoco quiere arder.' },
    funeral: { name: 'Pie funerario', kind: 'leg', tier: 2, color: '#879caf', cards: ['grave', 'silent'], lore: 'Aprendió a caminar entre los muertos.' },
    ash: { name: 'Cráneo de ceniza', kind: 'head', tier: 3, color: '#d09262', cards: ['forbidden', 'echoes'], lore: 'El archivo prohibido habla a través de ti.', expansion: true }
  };

  const enemies = {
    orderly: { name: 'Celador de la morgue', tag: 'ABOMINACIÓN', sprite: 'brute', hp: 30, attack: 9, loot: ['claw', 'bone', 'funeral'], pattern: ['attack', 'guard', 'attack', 'fury'] },
    scientist: { name: 'Cirujano apóstata', tag: 'CIENTÍFICO CORRUPTO', sprite: 'scientist', hp: 27, attack: 8, loot: ['surgeon', 'scalpel', 'mercury'], pattern: ['attack', 'heat', 'attack', 'guard'] },
    stitched: { name: 'El mal cosido', tag: 'ABOMINACIÓN', sprite: 'stitched', hp: 34, attack: 10, loot: ['jaw', 'iron', 'spider'], pattern: ['guard', 'attack', 'fury', 'attack'] },
    furnace: { name: 'Custodio de la caldera', tag: 'AUTÓMATA ALQUÍMICO', sprite: 'furnace', hp: 39, attack: 11, loot: ['boiler', 'cannon', 'pistons', 'piston'], pattern: ['attack', 'heat', 'fury', 'guard'] },
    oracle: { name: 'Anatomista sin ojos', tag: 'CIENTÍFICO CORRUPTO', sprite: 'oracle', hp: 33, attack: 10, loot: ['oracle', 'mercury', 'surgeon'], pattern: ['heat', 'attack', 'guard', 'fury'] },
    archivist: { name: 'Archivista de ceniza', tag: 'ALA PROHIBIDA', sprite: 'ash', hp: 40, attack: 11, loot: ['ash', 'boiler'], pattern: ['heat', 'fury', 'guard', 'attack'] },
    boss: { name: 'El Rector de Carne', tag: 'GUARDIÁN DE LA SALIDA', sprite: 'boss', hp: 95, attack: 15, loot: ['cannon', 'mercury', 'oracle'], pattern: ['attack', 'guard', 'fury', 'heat', 'fury'], boss: true }
  };

  const floors = [
    { name: 'Laboratorios de sutura', small: 'Laboratorio', roman: 'I', subtitle: 'Donde la muerte es apenas un procedimiento.' },
    { name: 'Fundición de los réprobos', small: 'Fundición', roman: 'II', subtitle: 'El humo ya conoce tu nombre.' },
    { name: 'Observatorio del Rector', small: 'Observatorio', roman: 'III', subtitle: 'La última puerta todavía respira.' }
  ];

  const roomNames = {
    start: 'Mesa de disección', corridor: 'Pasillo de ceniza', combat: 'Sala de contención',
    cache: 'Suministros abandonados', workshop: 'Estación de injertos', trap: 'Conducto de vapor',
    stairs: 'Escalera de caracol', boss: 'El umbral del Rector', archive: 'Archivo anatómico'
  };

  const skins = {
    suture: { name: 'Piel de suturas', cost: 0, color: '#8fa58e', description: 'Carne prestada. Puntadas imperfectas.' },
    copper: { name: 'Óxido y cobre', cost: 15, color: '#bd875b', description: 'Pátina cobriza para tu nuevo cuerpo.' },
    spectral: { name: 'Espíritu de éter', cost: 25, color: '#72b9bd', description: 'Un resplandor espectral entre las costuras.' },
    crimson: { name: 'Luto carmesí', cost: 35, color: '#be777d', description: 'El color de lo que no has olvidado.' }
  };

  return { slots, cards, parts, enemies, floors, roomNames, skins };
})();
