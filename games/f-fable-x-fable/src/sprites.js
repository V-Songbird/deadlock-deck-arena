// Deadlock Deck: El Reloj Anatómico — sprite data (Worker C).
// Every sprite is { rows: [string], map: { char: color }, w, h }. One char = one pixel,
// '.' = transparent. Body parts use color ROLES (skin, skinDark, stitch, bone, cloth,
// clothDark, metal, metalDark, glow, eye, hair, fur, leather, outline) resolved through
// DD.sprites.palettes at draw time; everything else uses literal '#rrggbb' colors.
(function () {
  'use strict';

  function S(rows, map) { return { rows, map, w: rows[0].length, h: rows.length }; }

  // Role letters shared by every limb / stump sprite. 'w' and 'r' are literal colors.
  const R = {
    s: 'skin', d: 'skinDark', t: 'stitch', b: 'bone', c: 'cloth', k: 'clothDark',
    m: 'metal', n: 'metalDark', g: 'glow', e: 'eye', h: 'hair', f: 'fur', l: 'leather',
    o: 'outline', w: '#f4f0e8', r: '#8a1c2a', p: '#6a3a8a', y: '#e0c040',
  };

  // Cosmetic palettes (ids fixed by DD.data.palettes).
  const palettes = {
    palido:  { skin: '#b9bfc9', skinDark: '#7d8598', stitch: '#3a2630', bone: '#e6dcc4', cloth: '#4a3a4c', clothDark: '#2a2030', metal: '#c8a464', metalDark: '#7a5a2c', glow: '#7cf0d8', eye: '#f2e468', hair: '#2a2228', fur: '#6a5a48', leather: '#5a3a28', outline: '#14101a' },
    verdoso: { skin: '#9cc48c', skinDark: '#587f55', stitch: '#2c2a1c', bone: '#e6dcc4', cloth: '#3c4a3a', clothDark: '#222c22', metal: '#c8a464', metalDark: '#7a5a2c', glow: '#b6ff6e', eye: '#f4c23c', hair: '#242a20', fur: '#5e6a44', leather: '#5a3a28', outline: '#10160e' },
    cobre:   { skin: '#c9865a', skinDark: '#864a2e', stitch: '#2a1810', bone: '#ecdcc0', cloth: '#4e3830', clothDark: '#2c1c18', metal: '#dcb46c', metalDark: '#86602c', glow: '#ffb45a', eye: '#ffe48a', hair: '#301c14', fur: '#7a5a3a', leather: '#5e3420', outline: '#180e0a' },
    ebano:   { skin: '#4c4652', skinDark: '#28242e', stitch: '#c8b8a4', bone: '#d8d0c0', cloth: '#3a2a44', clothDark: '#1e1626', metal: '#c8a464', metalDark: '#7a5a2c', glow: '#b07cff', eye: '#ff6a3c', hair: '#141018', fur: '#3e3644', leather: '#402a20', outline: '#0c0a10' },
  };

  // ---------------------------------------------------------------- limbs: heads (10×10)
  const limbs = {};

  // Cabeza Reanimada: pale face, stitched forehead, temple bolts, blank glowing eyes.
  limbs.cabeza_reanimada = S([
    '..hhhhhh..',
    '.hsssssssh',
    '.ststtsss.',
    'msssssssm.',
    'nseesseesn',
    '.ssssssss.',
    '.sdsttsds.',
    '..ssssss..',
    '..dsssssd.',
    '....dd....',
  ], R);

  // Cabeza de Ahorcado: rope burn around the neck, lolling tongue, bruised skin.
  limbs.cabeza_ahorcado = S([
    '..hhhhhhh.',
    '.hddsssssh',
    '.dsssssss.',
    '.dsxsssxs.',
    '.dsssssss.',
    '.ddsssssd.',
    '..dsrrsd..',
    '..ddsrsd..',
    '..llllll..',
    '...ldddl..',
  ], Object.assign({ x: '#f2e468' }, R));

  // Cabeza de Sabueso: hound muzzle, torn ear, stitched skull, fangs.
  limbs.cabeza_sabueso = S([
    '.f......f.',
    'ff.ffff.ff',
    '.ffftffff.',
    '.fetffffe.',
    '.ffffffff.',
    '..fffffff.',
    '..dddddd..',
    '..dwddwd..',
    '...dddd...',
    '....dd....',
  ], R);

  // Cabeza de Alquimista: brass goggles on the forehead, wild hair, sunken cheeks.
  limbs.cabeza_alquimista = S([
    'h.hhhhhh.h',
    'hhmmhhmmhh',
    'hmggmmggmh',
    '.msssssms.',
    '.sessssess',
    '.ssssssss.',
    '.dsssssss.',
    '.dsstttsd.',
    '..ssssss..',
    '....dd....',
  ], R);

  // Cabeza del Maestro: top hat, monocle, waxed moustache, glowing eyes.
  limbs.cabeza_maestro = S([
    '..kkkkkk..',
    '..kkkkkk..',
    '..kyyyyk..',
    'kkkkkkkkkk',
    '.sssssmmm.',
    '.sgsssmgm.',
    '.ssssssmm.',
    '.shhhhhhs.',
    '..ssssss..',
    '....dd....',
  ], R);

  // -------------------------------------------------------------- limbs: torsos (12×14)

  // Torso Suturado: bare stitched chest, a big Y-shaped autopsy seam.
  limbs.torso_suturado = S([
    '....ssss....',
    'ssssssssssss',
    'sstssssssts.',
    'sstsssssts..',
    '.sstsssts...',
    '.ssstttss...',
    '.sssstssss..',
    '.sdsstsssd..',
    '.sssstssss..',
    '.sdsstsssd..',
    '.sssstssss..',
    '.ssdstsdss..',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
  ], R);

  // Torso de Mendigo: ragged patched cloth, rope belt, thin frame.
  limbs.torso_mendigo = S([
    '....ssss....',
    'cccsssssscc.',
    'ccccccccccc.',
    '.ckcccccckc.',
    '.cccclcccc..',
    '.ckcccccck..',
    '.cccccclcc..',
    '.clccccccc..',
    '.cccckcccc..',
    '.ccccccccc..',
    '.llllllllll.',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
  ], R);

  // Torso de Cirujano: bloody apron over a shirt, buttons, a tucked scalpel.
  limbs.torso_cirujano = S([
    '....ssss....',
    'wwwwssssswww',
    'wwwbwwwwbwww',
    '.wwwwrwwwww.',
    '.wwwwwwrww..',
    '.wwwrwwwww..',
    '.wwwwwrrww..',
    '.wwwwwwwww..',
    '.wwmwwwwrw..',
    '.wwmwwwwww..',
    '.wwwwwwwww..',
    '.wwwwwwwww..',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
  ], R);

  // Torso de Autómata: riveted brass plating, a glass window over the boiler.
  limbs.torso_automata = S([
    '....mmmm....',
    'mmmmmnnmmmmm',
    'mnmmmmmmmmnm',
    '.mmnnnnnnmm.',
    '.mmnggggnmm.',
    '.mmnggggnmm.',
    '.mmnnnnnnmm.',
    '.mnmmmmmmnm.',
    '.mmmnmmnmmm.',
    '.mnmmmmmmnm.',
    '.mmmmmmmmmm.',
    '.nmnmnmnmnm.',
    '.nnnnnnnnnn.',
    '.nnnnnnnnnn.',
  ], R);

  // Torso de Gólem: massive flesh mass, mismatched skin patches, thick stitches.
  limbs.torso_golem = S([
    '....ssss....',
    'ssssssssssss',
    'sdddsssssdds',
    'sdttdsssdtds',
    'sdddsstssdds',
    'sssssstsssss',
    'ssttttttttss',
    'sssdddtsssss',
    'ssddddtddsss',
    'sddtdddddsss',
    'sdddddtddsss',
    'ssdddttdssss',
    'kkkkkkkkkkkk',
    'kkkkkkkkkkkk',
  ], R);

  // Torso del Maestro: ornate robe with gold trim, a glowing arcane sigil.
  limbs.torso_maestro = S([
    '....ssss....',
    'ccccssssccc.',
    'cyccccccccy.',
    '.cyccccccy..',
    '.ccycggcyc..',
    '.cccgggccc..',
    '.ccycggcyc..',
    '.cyccccccy..',
    '.cyyyyyyyy..',
    '.ccccccccc..',
    '.cccyyycccc.',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
    '.kkkkkkkkk..',
  ], R);

  // ---------------------------------------------------------------- limbs: arms (5×14)
  // Drawn as the LEFT arm (hand at the bottom, thumb towards the body on the right).

  // Brazo de Cadáver: grey stitched arm, bandaged wrist, rigid fingers.
  limbs.brazo_cadaver = S([
    'sssss',
    'sstss',
    'sssss',
    'sdsss',
    'stsss',
    'sssss',
    'ssstd',
    'sssss',
    'bbbbb',
    'bbbbb',
    'sssss',
    'ssdss',
    'sdsds',
    '.sss.',
  ], R);

  // Brazo de Sepulturero: sleeved, gloved, holding a short shovel.
  limbs.brazo_sepulturero = S([
    'ccccc',
    'cckcc',
    'ccccc',
    'ckccc',
    'ccccc',
    'ccckc',
    'ccccc',
    'lllll',
    'lllln',
    'lllln',
    'lnlln',
    'llnnn',
    '.lmmm',
    '..mmm',
  ], R);

  // Brazo de Homúnculo: small greenish arm, translucent, webbed clawed hand.
  limbs.brazo_homunculo = S([
    '.ggg.',
    '.sgs.',
    '.sss.',
    '.dsd.',
    '.sss.',
    '.sgs.',
    '.sss.',
    '.dss.',
    '.sss.',
    '.ssd.',
    'sssss',
    'ststs',
    's.s.s',
    't.t.t',
  ], R);

  // Brazo de Alquimista: purple sleeve with brass cuff, hand holding a bubbling flask.
  limbs.brazo_alquimista = S([
    'ppppp',
    'ppkpp',
    'ppppp',
    'pkppp',
    'ppppp',
    'mmmmm',
    'sssss',
    'ssdss',
    'sssss',
    '.sgs.',
    '.ggg.',
    'ggggg',
    'gggyg',
    'ggggg',
  ], R);

  // Brazo de Cirujano: rolled white sleeve, blood-splattered glove, scalpel in hand.
  limbs.brazo_cirujano = S([
    'wwwww',
    'wwrww',
    'wwwww',
    'wrwww',
    'wwwww',
    'wwwww',
    'sssss',
    'ssrss',
    'sssss',
    'sdsss',
    'ssssm',
    'sssmm',
    '.sswm',
    '...w.',
  ], R);

  // Brazo de Autómata: brass piston arm with a steam vent and a hydraulic claw.
  limbs.brazo_automata = S([
    'mmmmm',
    'mnnnm',
    'mmmmm',
    'nmgmn',
    'nmmmn',
    'mnnnm',
    'mmmmm',
    'nnmnn',
    '.mmm.',
    '.mnm.',
    'mmmmm',
    'mnnnm',
    'm.m.m',
    'n...n',
  ], R);

  // Brazo de Gólem: enormous mismatched flesh, thick stitches, giant fist.
  limbs.brazo_golem = S([
    'sssss',
    'sdtds',
    'sdtds',
    'ssdss',
    'sssss',
    'tttts',
    'sdsss',
    'sddss',
    'sdsss',
    'sssss',
    'sssss',
    'sdsds',
    'ssdss',
    'sssss',
  ], R);

  // ---------------------------------------------------------------- limbs: legs (5×14)
  // Drawn as the LEFT leg (foot pointing left / outward).

  // Pierna de Cadáver: grey stitched leg, bandaged knee, bare foot.
  limbs.pierna_cadaver = S([
    'kkkkk',
    'kkkkk',
    'sssss',
    'ststs',
    'sssss',
    'sdsss',
    'bbbbb',
    'bbbbb',
    'sssss',
    'ssdss',
    'sssss',
    'sdsss',
    'sssss',
    'sssss',
  ], R);

  // Pierna de Bailarina: slender stockinged leg with ribbon laces and a slipper.
  limbs.pierna_bailarina = S([
    'kkkkk',
    'kkkkk',
    '.www.',
    '.wpw.',
    '.pwp.',
    '.wpw.',
    '.www.',
    '.pww.',
    '.wwp.',
    '.www.',
    '.pww.',
    '.www.',
    'pppp.',
    'pppp.',
  ], R);

  // Pierna de Homúnculo: thin greenish leg, bulbous knee, three-toed foot.
  limbs.pierna_homunculo = S([
    '.kkk.',
    '.kkk.',
    '.sgs.',
    '.sss.',
    '.dsd.',
    'sssss',
    'sgggs',
    'sssss',
    '.dsd.',
    '.sss.',
    '.dss.',
    '.sss.',
    'ssss.',
    'tsts.',
  ], R);

  // Pata de Sabueso: furry hound leg with a bent hock and clawed paw.
  limbs.pierna_sabueso = S([
    'kkkkk',
    'kkkkk',
    'fffff',
    'ffhff',
    'fffff',
    '.ffff',
    '..fff',
    '..fff',
    '.ffff',
    '.fff.',
    '.fff.',
    '.fff.',
    'ffff.',
    'wfwf.',
  ], R);

  // Pierna de Autómata: brass piston leg with a glowing knee joint and iron boot.
  limbs.pierna_automata = S([
    'mmmmm',
    'mnnnm',
    'mmmmm',
    '.nmn.',
    '.mmm.',
    'mmgmm',
    'mgggm',
    'mmgmm',
    '.nmn.',
    '.mmm.',
    '.nmn.',
    '.mmm.',
    'nnnnn',
    'nnnnn',
  ], R);

  // Pierna de Gólem: thick mismatched flesh column, stitched patches, heavy foot.
  limbs.pierna_golem = S([
    'kkkkk',
    'kkkkk',
    'sssss',
    'sdtds',
    'sdtds',
    'sssss',
    'tttts',
    'sssss',
    'ssdss',
    'sddss',
    'sssss',
    'sdsss',
    'sssss',
    'sssss',
  ], R);

  // ---------------------------------------------------------------- stumps (bandaged)
  const stumps = {
    head: S([
      '..........',
      '..........',
      '..........',
      '..........',
      '...bbbb...',
      '..bbrbbb..',
      '..bbbbbb..',
      '..brbbbb..',
      '..bbbbrb..',
      '...bbbb...',
    ], R),
    torso: S([
      '....bbbb....',
      'bbbbbbbbbbbb',
      'bbrbbbbbbrbb',
      '.bbbbbrbbbb.',
      '.bbbbbbbbbb.',
      '.bbrbbbbbbb.',
      '.bbbbbbrbbb.',
      '.bbbbbbbbbb.',
      '.bbbrbbbbbb.',
      '.bbbbbbbbrb.',
      '.bbbbbbbbbb.',
      '.bbbbbbbbbb.',
      '.kkkkkkkkkk.',
      '.kkkkkkkkkk.',
    ], R),
    arm: S([
      'bbbbb',
      'bbrbb',
      'bbbbb',
      'brbbb',
      'bbbbb',
      'bbbrb',
      'bbbbb',
      '.rbb.',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ], R),
    leg: S([
      'kkkkk',
      'kkkkk',
      'bbbbb',
      'bbrbb',
      'bbbbb',
      'brbbb',
      'bbbbb',
      'bbbrb',
      '.rbb.',
      '.....',
      '.....',
      '.....',
      '.....',
      '.....',
    ], R),
  };

  // ------------------------------------------------------------------- enemies
  // Literal colors shared by enemies, icons and misc sprites.
  const H = {
    o: '#14101a', s: '#a8b4ac', d: '#5c6a68', g: '#8fd47a', G: '#4a8a48', r: '#a02030', R: '#601020',
    m: '#c8a464', n: '#7a5a2c', b: '#e6dcc4', w: '#f4f0e8', k: '#2a2030', c: '#4a3a4c', p: '#6a3a8a',
    P: '#3c2050', y: '#f2e468', e: '#ff6a3c', t: '#3a2630', f: '#6a5a48', F: '#3e3628', l: '#5a3a28',
    i: '#7cf0d8', a: '#5a8cb0', q: '#a8c8d8', x: '#606870', X: '#3a3f48', z: '#d0d8e0', h: '#2a2228',
    v: '#c04060', u: '#8a6c58',
  };
  const enemies = {};

  // Homúnculo: a small green creature sealed in a brass-lidded jar, limbs pushing out.
  enemies.homunculo = S([
    '.......xxxx.......',
    '......xnnnnx......',
    '.....qaaaaaaq.....',
    '....qaaaaaaaaq....',
    '....qaaggggaaq....',
    '....qagyggygaq....',
    '....qagggGggaq....',
    '....qaaGtGGaaq....',
    '...gqaggggggaqg...',
    '..ggqgggggggGqgg..',
    '.gGGqgGgggggGqGGg.',
    '.g..qgggggggGq..g.',
    'tt..qaGgggggaq..tt',
    '....qaaGGGGaaq....',
    '....qaaaaaaaaq....',
    '....qaaaaaaaaq....',
    '....qaaGaaGaaq....',
    '....qaaGaaGaaq....',
    '....qaGGaaGGaq....',
    '....qqqqqqqqqq....',
    '...xxxxxxxxxxxx...',
    '...xXXXXXXXXXXx...',
    '...xxxxxxxxxxxx...',
  ], H);

  // Sabueso Suturado: a hound sewn from several dogs, exposed ribs, bare fangs. Faces left.
  enemies.sabueso = S([
    '.....fF.......................',
    '....fFFf......................',
    '...ffffff...ffffffffffff...FF.',
    '..ffefffff.ffffffffffffff.FFF.',
    '..fffffftfffffftfffffffffffFF.',
    '..ffffffffffftffffffffffffffF.',
    '..FFfffffffffffftffffffffffFf.',
    '..FwFwfffffffffffffffffffffFF.',
    '...FFFFffffffFFfffffffffffFFf.',
    '....rr.fffffffbfbfbffffffFF...',
    '.......ffffffbfbfbffffffff....',
    '.......fFffffffFfffffFffff....',
    '........fFf...fFf...fFf..fFf..',
    '........fFf...fFf...fFf..fFf..',
    '........fFf...fFf...fFf..fFf..',
    '........Fff...Fff...Fff..Fff..',
    '........fff...fff...fff..fff..',
    '.......wfww..wfww..wfww.wfww..',
  ], H);

  // Alquimista Corrupto: wild hair, brass goggles, purple robe, bubbling flask. Faces left.
  enemies.alquimista = S([
    '......hhhhhh........',
    '.....hhhhhhhh.......',
    '.....hmmmmmmh.......',
    '.....miimmiim.......',
    '.....hssssssh.......',
    '.....ssyssyss.......',
    '.....ssssssss.......',
    '......ssddss........',
    '.......ssss.........',
    '.....pppppppp.......',
    '....pppppppppp......',
    '...ppPpppppppPpp....',
    '...pp.pppppppp.pp...',
    '..pp..pppppppp..pp..',
    '..ss..ppmmmmpp..ss..',
    '.aqa..pppppppp......',
    '.aga..pppppppp......',
    '.ggg..pppppppp......',
    '......pppppppp......',
    '......ppPppPpp......',
    '......pppppppp......',
    '......pppppppp......',
    '......pppppppp......',
    '......pppppppp......',
    '......PPPPPPPP......',
    '......kkk..kkk......',
    '......kkk..kkk......',
    '.....kkkk..kkkk.....',
  ], H);

  // Cirujano Demente: surgical mask, blood-splattered apron, a scalpel in each hand. Faces left.
  enemies.cirujano = S([
    '.......hhhhhh.......',
    '......hhhhhhhh......',
    '......hssssssh......',
    '......ssyssyss......',
    '......ssssssss......',
    '......wwwwwwww......',
    '......wwwwwwww......',
    '.......wwwwww.......',
    '........ssss........',
    '.....wwwwwwwwww.....',
    '....wwwlwwwwlwww....',
    '...wwwwrwwwwwrwww...',
    '...ww.wwwwrwwww.ww..',
    '..ww..wwrwwwwww..ww.',
    '..ss..wwwwwrwww..ss.',
    '..sm..wwwwwwww...ms.',
    '..qw..wwrwwwww...wq.',
    '..q...wwwwwwrw....q.',
    '..q...wwwwwwww....q.',
    '......wwrwwwww......',
    '......wwwwwwww......',
    '......wwwwwrww......',
    '......wwwwwwww......',
    '......kkkkkkkk......',
    '......kkk..kkk......',
    '......kkk..kkk......',
    '......kkk..kkk......',
    '.....kkkk..kkkk.....',
  ], H);

  // Autómata de Latón: riveted brass body, chimney venting steam, furnace window, piston arm. Faces left.
  enemies.automata = S([
    '......z.zz..............',
    '.....zz.z...............',
    '......xx................',
    '......xx....mmmmmmmm....',
    '......xx....mnnnnnnm....',
    '......xx....mneeeenm....',
    '..mmmmxxmmmmmnnnnnnm....',
    '.mnnnnnnnnnnmmmmmmmm....',
    '.mnmmmmmmmmnm.nmmn......',
    '.mnmnnnnnnmnm..mm.......',
    '.mnmnmmmmnmnmmmmmmmmm...',
    '.mnmnmeemnmnmnnnnnnnm...',
    '.mnmnmeemnmnm.mnmmnm....',
    '.mnmnnnnnnmnm.mnmmnm....',
    '.mnmmmmmmmmnm.mnmmnm....',
    '.mnnnnnnnnnnm.mnmmnm....',
    '.mmmmmmmmmmmm.xnxxnx....',
    '..xxxxxxxxxx..xxxxxx....',
    '..xXXXXXXXXx..xXXXXx....',
    '..xxxxxxxxxx..xxxxxx....',
    '..mmmm..mmmm............',
    '..mnnm..mnnm............',
    '..mnnm..mnnm............',
    '..xnnx..xnnx............',
    '..xnnx..xnnx............',
    '..mnnm..mnnm............',
    '..mnnm..mnnm............',
    '.XXXXX..XXXXX...........',
    '.XXXXX..XXXXX...........',
  ], H);

  // Gólem de Carne: a mountain of mismatched flesh held together by thick stitches, tiny head.
  enemies.golem = S([
    '............ssss..............',
    '...........sseess.............',
    '...........ssstss.............',
    '.......sssssssssssssss........',
    '.....ssssssssdddsssssssss.....',
    '....sssdddsssdddssssdddsss....',
    '...ssssdddsssttssssssdddssss..',
    '..sssssssssttssttsssssssssss..',
    '..ssttsssssssssssssssssttsss..',
    '..sssssdddsssdddsssssssssssss.',
    '.sssssssdddssdddsssdddsssssss.',
    '.ssssdssssssssssssssdddssssss.',
    '.sssddssssttttttsssssssssssss.',
    '.ssddss.sssssssssssss.ssssdss.',
    '.ssdss..ssdddsssdddss..ssddss.',
    '.sssss..ssdddsttdddss..sssss..',
    '.sssss..ssssssttsssss..sssss..',
    '.sssss..sssstttttssss..sssss..',
    '.ssdss..ssssssttsssss..ssdss..',
    '.sssss..sssssssssssss..sssss..',
    'sssssss.ssttssssttsss.sssssss.',
    'ssdssss.sssssssssssss.ssssdss.',
    'sssssss.sssssssssssss.sssssss.',
    '.sssss..ssssss.ssssss..sssss..',
    '........ssssss.ssssss.........',
    '........sdssss.ssssds.........',
    '........ssssss.ssssss.........',
    '........ssttss.ssttss.........',
    '........ssssss.ssssss.........',
    '.......sssssss.sssssss........',
    '.......kkkkkkk.kkkkkkk........',
  ], Object.assign({}, H, { s: '#b08c7c', d: '#7a5a52', t: '#2a1a1a', e: '#f2e468' }));

  // Maestro Alquimista: top hat, glowing eyes, gold-trimmed robe, arcane orb and staff. Faces left.
  enemies.maestro = S([
    '.........kkkkkk.........',
    '.........kkkkkk.........',
    '.........kyyyyk.........',
    '......kkkkkkkkkkkk......',
    '.........ssssss.........',
    '.........sissis.........',
    '.........ssssss.........',
    '.........shhhhs.........',
    '..........hhhh..........',
    '.......pppppppppp.......',
    '......pyppppppppyp......',
    '.....ppyppppppppypp.....',
    '....pppyppiippppyppp....',
    '...pp.ppypiiiipypp.pp...',
    '...ss.ppypiiiipypp.ss...',
    '..iii.pppypiipyppp.mmm..',
    '.iiiii.pppyyyypppp..m...',
    '..iii..ppppppppppp..m...',
    '...m...pyyyyyyyyyp..m...',
    '...m...ppppppppppp..m...',
    '...m...ppPppppppPp..m...',
    '...m...ppppppppppp..m...',
    '...m...pPpppppppPp..m...',
    '.......ppppppppppp..m...',
    '.......pppyppppypp..m...',
    '.......ppppppppppp..m...',
    '.......pPPPpppPPPp..m...',
    '.......PPPPPPPPPPP..m...',
    '.......kkkk...kkkk......',
    '......kkkkk...kkkkk.....',
  ], H);

  // ------------------------------------------------------------------- icons (12×12)
  const icons = {};

  // start: an open doorway with warm light.
  icons.start = S([
    '............',
    '....oooo....',
    '...oyyyyo...',
    '..oyyeeyyo..',
    '..oyeeeeyo..',
    '..oyeeeeyo..',
    '..oyeeeeyo..',
    '..oyeeeeyo..',
    '..oyeeeeyo..',
    '..oyeeeeyo..',
    '..oooooooo..',
    '............',
  ], H);

  // empty: a few specks of dust on the flagstones.
  icons.empty = S([
    '............',
    '............',
    '...x........',
    '............',
    '........x...',
    '............',
    '............',
    '.....x......',
    '............',
    '..........x.',
    '............',
    '............',
  ], H);

  // enemy: a bloodshot monstrous eye.
  icons.enemy = S([
    '............',
    '............',
    '...rrrrrr...',
    '..rwwwwwwr..',
    '.rwwwrrwwwr.',
    'rwwwrRRrwwwr',
    'rwwwrRRrwwwr',
    '.rwwwrrwwwr.',
    '..rwwwwwwr..',
    '...rrrrrr...',
    '............',
    '............',
  ], H);

  // elite: a crowned skull with red sockets.
  icons.elite = S([
    '.y..y..y..y.',
    '.yyyyyyyyyy.',
    '..bbbbbbbb..',
    '.bbbbbbbbbb.',
    '.bbbbbbbbbb.',
    '.brrbbbbrrb.',
    '.brrbbbbrrb.',
    '.bbbbbbbbbb.',
    '..bbbtbtbb..',
    '...bbbbbb...',
    '...bobobo...',
    '............',
  ], H);

  // vial: a corked bottle of red tonic.
  icons.vial = S([
    '.....xxx....',
    '.....qxq....',
    '.....qqq....',
    '.....qqq....',
    '....qqqqq...',
    '...qqvvvqq..',
    '...qvvvvvq..',
    '...qvvvvvq..',
    '...qvvvvvq..',
    '...qqvvvqq..',
    '....qqqqq...',
    '............',
  ], H);

  // coolant: a frost crystal.
  icons.coolant = S([
    '.....ii.....',
    '..i..ii..i..',
    '...i.ii.i...',
    '....iiii....',
    '.iiiiiiiiii.',
    '.iiiiiiiiii.',
    '....iiii....',
    '...i.ii.i...',
    '..i..ii..i..',
    '.....ii.....',
    '............',
    '............',
  ], H);

  // ichor: a golden drop.
  icons.ichor = S([
    '.....y......',
    '.....y......',
    '....yyy.....',
    '....yyy.....',
    '...yyyyy....',
    '...yyyyy....',
    '..yyyyyyy...',
    '..ywyyyyy...',
    '..ywyyyyy...',
    '..yyyyyyy...',
    '...yyyyy....',
    '....yyy.....',
  ], H);

  // trap: iron jaws over a bloodied plate.
  icons.trap = S([
    '............',
    '.x........x.',
    '.xx..xx..xx.',
    '.xx..xx..xx.',
    '.xxx.xx.xxx.',
    '.xxxxxxxxxx.',
    '.xxxxxxxxxx.',
    '..XXXXXXXX..',
    '..XXXXXXXX..',
    '...rrrrrr...',
    '............',
    '............',
  ], H);

  // stairs: stone steps going up to the right.
  icons.stairs = S([
    '............',
    '........bbbb',
    '........bxxx',
    '......bbbxxx',
    '......bxxxxx',
    '....bbbxxxxx',
    '....bxxxxxxx',
    '..bbbxxxxxxx',
    '..bxxxxxxxxx',
    'bbbxxxxxxxxx',
    'bxxxxxxxxxxx',
    '............',
  ], H);

  // exit: an arched gate glowing with dawn light.
  icons.exit = S([
    '....oooo....',
    '...oeeeeo...',
    '..oeeyyeeo..',
    '..oeyyyyeo..',
    '..oeyyyyeo..',
    '..oeyyyyeo..',
    '..oeyyyyeo..',
    '..oeyyyyeo..',
    '..oeyyyyeo..',
    '..oeeyyeeo..',
    '..oeeeeeeo..',
    '..oooooooo..',
  ], H);

  // heat: a flame.
  icons.heat = S([
    '.....e......',
    '.....e......',
    '....ee.e....',
    '....eee.e...',
    '...eeeeee...',
    '...eeyeee...',
    '..eeyyyeee..',
    '..eeyyyyee..',
    '..eeyyyyee..',
    '...eyyyye...',
    '....eyye....',
    '.....ee.....',
  ], H);

  // hp: a heart.
  icons.hp = S([
    '............',
    '..rr....rr..',
    '.rvrr..rrvr.',
    'rvrrrrrrrrrr',
    'rrrrrrrrrrrr',
    'rrrrrrrrrrrr',
    '.rrrrrrrrrr.',
    '..rrrrrrrr..',
    '...rrrrrr...',
    '....rrrr....',
    '.....rr.....',
    '............',
  ], H);

  // clock: a brass pocket watch.
  icons.clock = S([
    '....mmmm....',
    '...mbbbbm...',
    '..mbbbbbbm..',
    '.mbbbbobbbm.',
    '.mbbbbobbbm.',
    '.mbbbbooobm.',
    '.mbbbbbbbbm.',
    '.mbbbbbbbbm.',
    '..mbbbbbbm..',
    '...mbbbbm...',
    '....mmmm....',
    '............',
  ], H);

  // energy: a lightning bolt.
  icons.energy = S([
    '.......yy...',
    '......yy....',
    '.....yy.....',
    '....yy......',
    '...yyyyyy...',
    '.....yyy....',
    '.....yy.....',
    '....yy......',
    '...yy.......',
    '..yy........',
    '.y..........',
    '............',
  ], H);

  // skull: bone white.
  icons.skull = S([
    '...bbbbbb...',
    '..bbbbbbbb..',
    '.bbbbbbbbbb.',
    '.bbbbbbbbbb.',
    '.boobbbboob.',
    '.boobbbboob.',
    '.bbbbbobbbb.',
    '..bbbbbbbb..',
    '...bobobo...',
    '...bbbbbb...',
    '............',
    '............',
  ], H);

  // lock: a brass padlock.
  icons.lock = S([
    '....mmmm....',
    '...mm..mm...',
    '...m....m...',
    '...m....m...',
    '.nnnnnnnnnn.',
    '.nmmmmmmmmn.',
    '.nmmmoommmn.',
    '.nmmmmommmn.',
    '.nmmmmmmmmn.',
    '.nmmmmmmmmn.',
    '.nnnnnnnnnn.',
    '............',
  ], H);

  // check: a green tick.
  icons.check = S([
    '............',
    '..........g.',
    '.........gg.',
    '........ggg.',
    '.......ggg..',
    '.g....ggg...',
    '.gg..ggg....',
    '.ggggggg....',
    '..ggggg.....',
    '...ggg......',
    '....g.......',
    '............',
  ], H);

  // -------------------------------------------------------------------- misc sprites
  const misc = {};

  // token: hooded pale figure used as the map marker (8×12).
  misc.token = S([
    '..ssss..',
    '.ssssss.',
    '.syssys.',
    '.ssssss.',
    '..ssss..',
    '.kkkkkk.',
    'kkkkkkkk',
    'kkkkkkkk',
    'kkkkkkkk',
    '.kkkkkk.',
    '.kk..kk.',
    '.kk..kk.',
  ], H);

  // flame: a fire tongue (8×12).
  misc.flame = S([
    '...e....',
    '...ee...',
    '..eee.e.',
    '..eeeee.',
    '.eeyeee.',
    '.eeyyeee',
    'eeyyyyee',
    'eeyyyyee',
    'eeyywyee',
    '.eyyyye.',
    '..eyye..',
    '...ee...',
  ], H);

  // chain: one vertical link, tile it (4×6).
  misc.chain = S([
    '.xx.',
    'x..x',
    'x..x',
    '.xx.',
    '.XX.',
    '.XX.',
  ], H);

  // torch: wall torch with flame (6×10).
  misc.torch = S([
    '..ee..',
    '.eeye.',
    '.eyye.',
    '.eeee.',
    '..ee..',
    '.llll.',
    '..ll..',
    '..ll..',
    '..ll..',
    '..ll..',
  ], H);

  // jars for the laboratory shelves (8×8), three fillings.
  const jarRows = [
    '..xxxx..',
    '.qaaaaq.',
    '.qaaaaq.',
    '.qagGaq.',
    '.qaggaq.',
    '.qagGaq.',
    '.qaaaaq.',
    '.qqqqqq.',
  ];
  misc.jar_green = S(jarRows, H);
  misc.jar_red = S(jarRows, Object.assign({}, H, { g: H.v, G: H.R }));
  misc.jar_amber = S(jarRows, Object.assign({}, H, { g: H.y, G: H.n }));

  // alembic: retort with a glowing green distillate (16×18).
  misc.alembic = S([
    '.......xx.......',
    '......xnnx......',
    '......qaaq......',
    '.....qaaaaq.....',
    '....qaaggaaq....',
    '....qagggGaq....',
    '....qaggggaqxxxx',
    '.....qaggaq.xnnx',
    '......qaaq..xnnx',
    '.......xx...xnnx',
    '......xxxx..xnnx',
    '.....xnnnnx.xnnx',
    '....xnnnnnnxxnnx',
    '....xnnnnnnnnnnx',
    '....xxxxxxxxxxxx',
    '......llll......',
    '......llll......',
    '.....llllll.....',
  ], H);

  // gear: small brass cog (8×8).
  misc.gear = S([
    '.m.mm.m.',
    'mmmmmmmm',
    '.mmnnmm.',
    'mmnnnnmm',
    'mmnnnnmm',
    '.mmnnmm.',
    'mmmmmmmm',
    '.m.mm.m.',
  ], H);

  // --------------------------------------------------------------------- pixel font
  // Cell 5×8: rows 0-6 are the letter (caps use all 7, lowercase x-height is rows 2-6),
  // row 7 is the descender row. Rows are '/'-separated, '#' = ink; missing rows are blank.
  const font = {
    A: '.###./#...#/#...#/#####/#...#/#...#/#...#',
    B: '####./#...#/#...#/####./#...#/#...#/####.',
    C: '.####/#..../#..../#..../#..../#..../.####',
    D: '####./#...#/#...#/#...#/#...#/#...#/####.',
    E: '#####/#..../#..../####./#..../#..../#####',
    F: '#####/#..../#..../####./#..../#..../#....',
    G: '.####/#..../#..../#.###/#...#/#...#/.####',
    H: '#...#/#...#/#...#/#####/#...#/#...#/#...#',
    I: '#####/..#../..#../..#../..#../..#../#####',
    J: '....#/....#/....#/....#/#...#/#...#/.###.',
    K: '#...#/#..#./#.#../##.../#.#../#..#./#...#',
    L: '#..../#..../#..../#..../#..../#..../#####',
    M: '#...#/##.##/#.#.#/#.#.#/#...#/#...#/#...#',
    N: '#...#/##..#/#.#.#/#..##/#...#/#...#/#...#',
    O: '.###./#...#/#...#/#...#/#...#/#...#/.###.',
    P: '####./#...#/#...#/####./#..../#..../#....',
    Q: '.###./#...#/#...#/#...#/#.#.#/#..#./.##.#',
    R: '####./#...#/#...#/####./#.#../#..#./#...#',
    S: '.####/#..../#..../.###./....#/....#/####.',
    T: '#####/..#../..#../..#../..#../..#../..#..',
    U: '#...#/#...#/#...#/#...#/#...#/#...#/.###.',
    V: '#...#/#...#/#...#/#...#/#...#/.#.#./..#..',
    W: '#...#/#...#/#...#/#.#.#/#.#.#/##.##/#...#',
    X: '#...#/#...#/.#.#./..#../.#.#./#...#/#...#',
    Y: '#...#/#...#/.#.#./..#../..#../..#../..#..',
    Z: '#####/....#/...#./..#../.#.../#..../#####',
    a: '...../...../.###./....#/.####/#...#/.####',
    b: '#..../#..../####./#...#/#...#/#...#/####.',
    c: '...../...../.###./#..../#..../#..../.###.',
    d: '....#/....#/.####/#...#/#...#/#...#/.####',
    e: '...../...../.###./#...#/#####/#..../.###.',
    f: '..##./.#..#/.#.../###../.#.../.#.../.#...',
    g: '...../...../.####/#...#/#...#/.####/....#/.###.',
    h: '#..../#..../####./#...#/#...#/#...#/#...#',
    i: '..#../...../.##../..#../..#../..#../.###.',
    j: '...#./...../..##./...#./...#./...#./#..#./.##..',
    k: '#..../#..../#..#./#.#../##.../#.#../#..#.',
    l: '.##../..#../..#../..#../..#../..#../.###.',
    m: '...../...../##.#./#.#.#/#.#.#/#.#.#/#...#',
    n: '...../...../####./#...#/#...#/#...#/#...#',
    o: '...../...../.###./#...#/#...#/#...#/.###.',
    p: '...../...../####./#...#/#...#/####./#..../#....',
    q: '...../...../.####/#...#/#...#/.####/....#/....#',
    r: '...../...../#.##./##..#/#..../#..../#....',
    s: '...../...../.####/#..../.###./....#/####.',
    t: '.#.../.#.../###../.#.../.#.../.#..#/..##.',
    u: '...../...../#...#/#...#/#...#/#..##/.##.#',
    v: '...../...../#...#/#...#/#...#/.#.#./..#..',
    w: '...../...../#...#/#...#/#.#.#/#.#.#/.#.#.',
    x: '...../...../#...#/.#.#./..#../.#.#./#...#',
    y: '...../...../#...#/#...#/#...#/.####/....#/.###.',
    z: '...../...../#####/...#./..#../.#.../#####',
    '0': '.###./#...#/#..##/#.#.#/##..#/#...#/.###.',
    '1': '..#../.##../..#../..#../..#../..#../.###.',
    '2': '.###./#...#/....#/...#./..#../.#.../#####',
    '3': '#####/...#./..#../...#./....#/#...#/.###.',
    '4': '...#./..##./.#.#./#..#./#####/...#./...#.',
    '5': '#####/#..../####./....#/....#/#...#/.###.',
    '6': '..##./.#.../#..../####./#...#/#...#/.###.',
    '7': '#####/....#/...#./..#../.#.../.#.../.#...',
    '8': '.###./#...#/#...#/.###./#...#/#...#/.###.',
    '9': '.###./#...#/#...#/.####/....#/...#./.##..',
    ' ': '.....',
    '.': '...../...../...../...../...../.##../.##..',
    ',': '...../...../...../...../...../.##../..#../.#...',
    ':': '...../.##../.##../...../...../.##../.##..',
    ';': '...../.##../.##../...../...../.##../..#../.#...',
    '!': '..#../..#../..#../..#../..#../...../..#..',
    '?': '.###./#...#/....#/...#./..#../...../..#..',
    '¡': '..#../...../..#../..#../..#../..#../..#..',
    '¿': '..#../...../..#../.#.../#..../#...#/.###.',
    "'": '..#../..#../.#.../...../...../...../.....',
    '’': '..#../..#../.#.../...../...../...../.....',
    '"': '.#.#./.#.#./...../...../...../...../.....',
    '(': '...#./..#../.#.../.#.../.#.../..#../...#.',
    ')': '.#.../..#../...#./...#./...#./..#../.#...',
    '-': '...../...../...../#####/...../...../.....',
    '+': '...../..#../..#../#####/..#../..#../.....',
    '/': '....#/....#/...#./..#../.#.../#..../#....',
    '%': '##..#/##..#/...#./..#../.#.../#..##/#..##',
    '×': '...../#...#/.#.#./..#../.#.#./#...#/.....',
    '→': '...../..#../...#./#####/...#./..#../.....',
    '=': '...../...../#####/...../#####/...../.....',
    '<': '....#/...#./..#../.#.../..#../...#./....#',
    '>': '#..../.#.../..#../...#./..#../.#.../#....',
    '*': '...../#.#.#/.###./#####/.###./#.#.#/.....',
    '_': '...../...../...../...../...../...../#####',
    '#': '.#.#./.#.#./#####/.#.#./#####/.#.#./.#.#.',
    '&': '.##../#..#./#..#./.##../#.#.#/#..#./.##.#',
    '…': '...../...../...../...../...../#.#.#/#.#.#',
    '[': '.###./.#.../.#.../.#.../.#.../.#.../.###.',
    ']': '.###./...#./...#./...#./...#./...#./.###.',
    '|': '..#../..#../..#../..#../..#../..#../..#..',
    'á': '...#./..#../.###./....#/.####/#...#/.####',
    'é': '...#./..#../.###./#...#/#####/#..../.###.',
    'í': '...#./..#../.##../..#../..#../..#../.###.',
    'ó': '...#./..#../.###./#...#/#...#/#...#/.###.',
    'ú': '...#./..#../#...#/#...#/#...#/#..##/.##.#',
    'ü': '.#.#./...../#...#/#...#/#...#/#..##/.##.#',
    'ñ': '.##.#/#..#./####./#...#/#...#/#...#/#...#',
    'Á': '..#../.###./#...#/#...#/#####/#...#/#...#',
    'É': '..#../#####/#..../####./#..../#..../#####',
    'Í': '..#../.###./..#../..#../..#../..#../.###.',
    'Ó': '..#../.###./#...#/#...#/#...#/#...#/.###.',
    'Ú': '..#../#...#/#...#/#...#/#...#/#...#/.###.',
    'Ü': '.#.#./#...#/#...#/#...#/#...#/#...#/.###.',
    'Ñ': '.##.#/#...#/##..#/#.#.#/#..##/#...#/#...#',
  };

  // Flat lookup used by DD.ui.sprite: limb ids, 'stump_<type>', enemy ids, 'icon_<name>', misc keys.
  const index = {};
  for (const k in limbs) index[k] = limbs[k];
  for (const k in stumps) index['stump_' + k] = stumps[k];
  for (const k in enemies) index[k] = enemies[k];
  for (const k in icons) index['icon_' + k] = icons[k];
  for (const k in misc) index[k] = misc[k];

  window.DD.sprites = {
    limbs, stumps, enemies, icons, misc, palettes, index,
    font: { glyphs: font, w: 5, h: 8, adv: 6, lineH: 9 },
    get(key) { return index[key] || null; },
  };
})();
