/* DD.Run — the live run and the meta that survives death.
 * Thin state container only: body logic lives in DD.Body, combat in DD.Combat. */
(function () {
  'use strict';
  var DD = window.DD;

  var META_KEY = 'dd.meta.v1';

  var Run = DD.Run = {
    state: null,
    meta: null
  };

  /* ----------------------------------------------------------------- meta */
  function freshMeta() {
    return {
      codexLimbs: {},
      codexEnemies: {},
      runs: 0,
      escapes: 0,
      deaths: 0,
      bestTime: null,
      cosmetics: { equipped: 'default', unlocked: ['default'] },
      seenIntro: false
    };
  }

  Run.loadMeta = function () {
    var m = DD.Storage.get(META_KEY, null);
    Run.meta = m || freshMeta();
    // repair a partially written or older record
    var base = freshMeta();
    for (var k in base) if (Run.meta[k] === undefined) Run.meta[k] = base[k];
    if (!Run.meta.cosmetics || !Run.meta.cosmetics.unlocked) Run.meta.cosmetics = base.cosmetics;
    return Run.meta;
  };

  Run.saveMeta = function () {
    DD.Storage.set(META_KEY, Run.meta);
  };

  Run.resetMeta = function () {
    Run.meta = freshMeta();
    Run.saveMeta();
  };

  /* ------------------------------------------------------------ run state */
  function baseMaxHp(body) {
    var hp = DD.BASE_HP;
    if (body && DD.Body) {
      hp += DD.Body.maxHpBonus ? DD.Body.maxHpBonus(body) : 0;
    }
    return hp;
  }

  Run.newRun = function (seed) {
    if (!Run.meta) Run.loadMeta();
    var runIndex = (Run.meta.runs || 0) + 1;
    seed = (seed === undefined) ? ((Math.random() * 0x7fffffff) | 0) : seed;

    var body = DD.Body ? DD.Body.create(1) : null;

    var st = {
      runIndex: runIndex,
      seed: seed,
      elapsed: 0,
      timeLeft: DD.RUN_SECONDS,
      timeTotal: DD.RUN_SECONDS,
      status: 'explore',
      floor: 0,
      floorCount: DD.FLOOR_COUNT,
      shiftTimer: DD.SHIFT_SECONDS,
      shiftWarn: 0,
      body: body,
      hp: 60,
      maxHp: 60,
      block: 0,
      residue: 0,
      oils: 0,
      bandages: 0,
      shards: 0,
      map: null,
      player: { x: 0, y: 0, dir: 'down', anim: 0, moving: false, flash: 0, invuln: 0 },
      encounter: null,
      stats: { kills: 0, grafted: 0, lost: 0, floors: 0, played: 0, damage: 0, best: 0 },
      log: []
    };
    Run.state = st;
    st.maxHp = baseMaxHp(body);
    st.hp = st.maxHp;

    Run.meta.runs = runIndex;
    Run.saveMeta();

    Run.loadFloor(0);
    Run.say(DD.t('Te despiertas en una mesa de disección. Seis minutos.'));
    return st;
  };

  Run.loadFloor = function (floor) {
    var st = Run.state;
    if (!st || !DD.Tower) return;
    st.floor = floor;
    st.map = DD.Tower.generate(DD.hash(st.seed, floor * 7919 + 13), floor, st.floorCount);
    st.player.x = st.map.start.x;
    st.player.y = st.map.start.y;
    st.player.dir = 'down';
    st.shiftTimer = DD.SHIFT_SECONDS;
    st.shiftWarn = 0;
    if (DD.Explore && DD.Explore.reset) DD.Explore.reset();
  };

  Run.nextFloor = function () {
    var st = Run.state;
    if (!st) return false;
    st.stats.floors++;
    if (st.floor >= st.floorCount - 1) {
      Run.escape();
      return false;
    }
    Run.loadFloor(st.floor + 1);
    Run.say(DD.t('Piso ') + (st.floor + 1) + DD.t('. El aire huele a formol.'));
    return true;
  };

  Run.shiftFloor = function () {
    var st = Run.state;
    if (!st || !DD.Tower || !st.map) return;
    DD.Tower.relayout(st.map, DD.hash(st.seed, (st.elapsed * 1000) | 0));
    st.shiftTimer = DD.SHIFT_SECONDS;
    st.shiftWarn = 0;
    Run.say(DD.t('La torre se reordena a tu alrededor.'));
  };

  /* ---------------------------------------------------------------- clock */
  Run.tick = function (dt) {
    var st = Run.state;
    if (!st) return;
    if (st.status !== 'explore' && st.status !== 'combat') return;

    st.elapsed += dt;
    st.timeLeft -= dt;

    if (st.timeLeft <= 0) {
      st.timeLeft = 0;
      Run.timeout();
      return;
    }

    // The tower rearranges itself while you are still inside it.
    if (st.status === 'explore') {
      st.shiftTimer -= dt;
      if (st.shiftTimer <= 3 && st.shiftWarn <= 0) {
        st.shiftWarn = 3;
        if (DD.Audio) DD.Audio.sfx.play('alarm');
      }
      if (st.shiftWarn > 0) st.shiftWarn -= dt;
      if (st.shiftTimer <= 0) Run.shiftFloor();
    }
    if (DD.Audio && DD.Audio.music.setIntensity) {
      DD.Audio.music.setIntensity(1 - DD.clamp(st.timeLeft / st.timeTotal, 0, 1));
    }
  };

  /* ------------------------------------------------------------- outcomes */
  Run.timeout = function () {
    var st = Run.state;
    if (!st || st.status === 'timedout' || st.status === 'dead' || st.status === 'escaped') return;
    st.status = 'timedout';
    if (DD.Audio) { DD.Audio.music.play('death'); DD.Audio.sfx.play('death'); }
    Run.recordRun('timedout');
  };

  Run.die = function () {
    var st = Run.state;
    if (!st || st.status === 'dead' || st.status === 'timedout' || st.status === 'escaped') return;
    st.status = 'dead';
    if (DD.Audio) { DD.Audio.music.play('death'); DD.Audio.sfx.play('death'); }
    Run.recordRun('dead');
  };

  Run.escape = function () {
    var st = Run.state;
    if (!st || st.status === 'escaped') return;
    st.status = 'escaped';
    if (st.timeLeft > (Run.meta.bestTime || 0)) Run.meta.bestTime = Math.round(st.timeLeft);
    if (DD.Audio) { DD.Audio.music.play('escape'); DD.Audio.sfx.play('escape'); }
    Run.recordRun('escaped');
  };

  Run.recordRun = function (result) {
    if (!Run.meta) Run.loadMeta();
    if (result === 'escaped') Run.meta.escapes++;
    else Run.meta.deaths++;
    if (result === 'escaped') {
      Run.state.shards += 3 + Run.state.stats.floors * 2;
      if (Run.state.stats.floors >= Run.state.floorCount) Run.state.shards += 5;
    }
    if (DD.Progress && DD.Progress.addShards) DD.Progress.addShards(Run.state.shards);
    Run.saveMeta();
  };

  /* ------------------------------------------------------------- grafting */
  Run.graft = function (socket, limbId) {
    var st = Run.state;
    if (!st || !DD.Body) return false;
    var limb = DD.Data.limbById ? DD.Data.limbById[limbId] : null;
    if (!limb) return false;
    if (socket !== limb.slot && !(limb.slot === 'arm' && (socket === 'armL' || socket === 'armR')) &&
        !(limb.slot === 'leg' && (socket === 'legL' || socket === 'legR'))) return false;

    var wasStump = DD.Body.isStump(st.body, socket);
    if (!DD.Body.equip(st.body, socket, limbId)) return false;

    st.stats.grafted++;
    if (wasStump) st.stats.lost = Math.max(0, st.stats.lost - 1);
    if (DD.Progress) DD.Progress.discoverLimb(limbId);
    Run.say(DD.t('Injertas ') + limb.name + '.');
    return true;
  };

  /* ------------------------------------------------------------------ log */
  Run.say = function (text) {
    var st = Run.state;
    if (!st) return;
    st.log.unshift(text);
    if (st.log.length > 5) st.log.pop();
  };

  /* --------------------------------------------------------------- player */
  Run.heal = function (n) {
    var st = Run.state;
    if (!st) return 0;
    var before = st.hp;
    st.hp = DD.clamp(st.hp + n, 0, st.maxHp);
    return st.hp - before;
  };

  Run.damage = function (n) {
    var st = Run.state;
    if (!st) return 0;
    var blocked = Math.min(st.block, n);
    st.block -= blocked;
    var through = n - blocked;
    st.hp = DD.clamp(st.hp - through, 0, st.maxHp);
    if (st.hp <= 0) Run.die();
    return through;
  };

  Run.refreshMaxHp = function () {
    var st = Run.state;
    if (!st) return;
    st.maxHp = baseMaxHp(st.body);
    if (st.hp > st.maxHp) st.hp = st.maxHp;
  };
})();
