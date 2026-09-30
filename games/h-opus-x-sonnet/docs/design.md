# Deadlock Deck: El Reloj Anatómico — contrato de diseño (build H)

Orchestrator-written contract. Every worker builds against THIS file. Do not invent new global
names outside the ones listed for your module; if you need a private helper, keep it inside your
file's IIFE. Plain HTML/CSS/JS, classic `<script>` tags (no ES modules, no build step, no
dependencies, no network, no tests). Must work when served by any static server AND from file://.
All player-facing text is in **Spanish**. Code/comments in English.

## 0. Pitch (the brief, which must be honoured in full)

You are an abomination just reanimated in an alchemical lab collapsing in flames. You have exactly
**6 minutes (real time)** to escape the burning tower. The tower is a procedurally generated,
**constantly shifting labyrinth** full of monstrosities and corrupt scientists. Defeat enemies,
**harvest their limbs and graft them onto yourself**. Your deck IS your body: head, torso, 2 arms,
2 legs, each limb carries its own cards. Powerful cards **overheat and wear** limbs; a broken limb
loses its cards and leaves a **stump** (muñón) with weak stump cards until replaced. Dying or
running out of time sends your spirit to a **new dissection table with a new base body**; you
**keep discovered anatomical blueprints** (planos anatómicos) but the tower regenerates.
Objectives: Explore (collect resources, avoid traps), Combat (quick turn-based card fights),
Harvest (take limbs), Escape (reach the exit before 6:00 elapses).
Visual: gothic-alchemical + steampunk, pixel art. Sound: ominous synth soundtrack (electronic +
orchestral pads), guttural visceral SFX. Platforms: PC (keyboard+mouse), consoles (Gamepad API),
mobile (touch). Monetization: free-to-play with a cosmetic/content shop — implemented as an
in-game shop paid with **Éter** earned in play; a "premium" section is a clearly labelled demo
("DEMO — sin pagos reales") that just grants Éter.

## 1. Files and owners

```
index.html        W1   loads scripts in this exact order:
style.css         W1     js/core.js, js/data.js, js/sprites.js, js/audio.js, js/body.js,
js/core.js        W1     js/tower.js, js/explore.js, js/combat.js, js/meta.js, js/main.js
js/meta.js        W1   game flow + title/table/loopEnd/victory/codex/shop scenes + HUD
js/main.js        W1   boot + main loop + pause overlay
js/data.js        W2   cards, limbs, stumps, enemies, base bodies, cosmetics
js/body.js        W2   body model: slots, heat, integrity, breaking, grafting, deck
js/combat.js      W2   combat scene + harvest scene
js/tower.js       W3   procedural floor generation
js/explore.js     W3   exploration scene
js/sprites.js     W4   all pixel art (procedural, drawn from code — no image files)
js/audio.js       W4   WebAudio music + SFX
```

Every JS file is wrapped: `(function(){ 'use strict'; const DD = window.DD; ... })();`
except core.js which creates `window.DD = window.DD || {}` first.

## 2. Screen

Logical canvas **640×360**. `index.html` has one `<canvas id="game" width="640" height="360">`.
CSS scales it to fit the window keeping 16:9, `image-rendering: pixelated`. Pixel sprites are
authored at 16×16 (tiles, explore sprites) or 32×32/48×48 (combat enemies, body doll parts) and
drawn at integer scale with `ctx.imageSmoothingEnabled = false`.
Text: canvas `fillText` with font family `DD.FONT` = `'"Courier New", Courier, monospace'`, bold,
sizes 8/10/12/16/24. Always use `DD.draw.text` so styling is consistent.

## 3. core.js (W1) — shared API (everyone depends on this)

```js
DD.W = 640; DD.H = 360; DD.FONT
DD.canvas, DD.ctx                       // set by DD.initCanvas()
DD.PAL = { bg:'#0d0b12', ink:'#e8dcc0', dim:'#8a7f6a', blood:'#a3202a', bloodLight:'#e04848',
  brass:'#c89b3c', brassDark:'#7a5a1e', copper:'#b8643a', verdigris:'#3fa38a', ember:'#ff7a1a',
  fire:'#ffb830', ichor:'#7bd35a', violet:'#6b3fa0', steel:'#6c7a89', bone:'#d9ceb0',
  heat:'#ff4a1a', cold:'#4ab8ff', panel:'#1a1520', panelEdge:'#4a3a2a' }
DD.clamp(v,a,b), DD.lerp(a,b,t)
DD.RNG(seed) -> { next():[0,1), int(a,b) inclusive, pick(arr), chance(p), shuffle(arr) (in place, returns arr) }
DD.rand                                  // DD.RNG(Date.now())
// input — actions: 'up','down','left','right','confirm','cancel','pause',
// plus digits '1'..'9' as actions '1'..'9' (for playing cards), 'end' (E key / gamepad Y = end turn)
DD.input.held(action) -> bool            // keyboard WASD/arrows, Enter/Space=confirm, Esc/Backspace=cancel,
DD.input.hit(action)  -> bool            //   P/Esc=pause (Esc = pause only when scene has no cancel use:
                                          //   Esc maps to BOTH 'cancel' and 'pause'; scenes that use cancel
                                          //   call DD.input.consume('pause')).  Gamepad: dpad/stick, A=confirm,
                                          //   B=cancel, Start=pause, Y=end.
DD.input.consume(action)                 // clears the hit for this frame
DD.input.mouse = { x, y, down, clicked, rclicked }  // logical 640x360 coords; touch maps to mouse
DD.input.mouseIn(x,y,w,h) -> bool
// scenes
DD.scenes = {}                           // each: { enter(params), update(dt), draw(ctx), exit() } (all optional)
DD.setScene(name, params)
DD.sceneName                             // current scene name
// drawing
DD.draw.text(str, x, y, opts)            // opts {color, size=10, align='left'|'center'|'right', shadow=true, bold=true, alpha}
DD.draw.textWrap(str, x, y, w, opts) -> heightUsed   // wraps on spaces, lineHeight = size+3
DD.draw.panel(x, y, w, h, opts)          // opts {fill, edge, rivets=true} gothic brass-riveted panel
DD.draw.button(label, x, y, w, h, opts) -> bool   // immediate-mode; draws hover state; returns true when
                                          // clicked this frame. opts {disabled, color, size, selected}
DD.draw.bar(x, y, w, h, frac, color, bg)
DD.draw.rect(x,y,w,h,color) / DD.draw.stroke(x,y,w,h,color)
// fx (drawn by main loop after the scene, in screen space)
DD.fx.shake(intensity, time)             // screen shake
DD.fx.flash(color, time)
DD.fx.float(text, x, y, color)           // rising fading text, screen coords
DD.fx.particles(x, y, color, count)      // small pixel burst, screen coords
// persistent meta save (localStorage key 'ddh-save', wrapped in try/catch)
DD.save.data = { blueprints:{}, loops:0, escapes:0, deaths:0, timeouts:0, ether:0,
                 owned:{}, skin:'none', bestTime:null, muted:false }
DD.save.write(); DD.save.load()
```

## 4. Game flow (meta.js, W1)

```js
DD.CONFIG = { runSeconds: 360, floors: 3 }
DD.run  // null outside a run. During a run:
  { active:true, timeLeft:360, floor:1, body, seed, rng, ether:0 (earned this run),
    kills:0, loop:n, currentEnemy:null, map:null /* owned by explore */, log:[] }
DD.game.newRun(bodyInit)   // bodyInit = {baseId, grafts:{slotKey:limbId}} -> builds body with
                           // DD.body.create(baseId) then DD.body.graft for each; sets DD.run;
                           // DD.audio.music('explore'); DD.setScene('explore', {newFloor:true})
DD.game.startCombat(entity)   // entity = explore enemy object with .enemyId; stores DD.run.currentEnemy=entity;
                              // DD.setScene('combat', {enemyId: entity.enemyId})
DD.game.combatWon(enemyId)    // called by combat: DD.run.kills++, add ether (DD.ENEMIES[id].ether),
                              // entity.dead = true, DD.setScene('harvest', {limbs: pickHarvest(enemyId), source:'enemy', enemyId})
                              // (pickHarvest = up to 3 distinct ids from DD.ENEMIES[id].limbs, shuffled)
                              // if enemy is boss: after harvest the exit opens (explore reads DD.run.bossDead=true)
DD.game.openJar(limbId)       // explore calls when picking a jar: DD.setScene('harvest', {limbs:[limbId], source:'jar'})
DD.game.returnToExplore()     // harvest calls when done: DD.setScene('explore', {newFloor:false})
DD.game.discover(limbId)      // marks DD.save.data.blueprints[limbId]=true, write(); returns true if new
DD.game.nextFloor()           // explore calls on stairs: floor++; if floor > CONFIG.floors -> DD.game.escape()
                              // else DD.setScene('explore', {newFloor:true})
DD.game.escape()              // victory: escapes++, bestTime, bank ether -> 'victory' scene
DD.game.endLoop(reason)       // 'death' | 'time' | 'abandon' -> deaths/timeouts++, loops++, bank
                              // 50% of run ether, DD.run.active=false -> 'loopEnd' scene -> then 'table'
```
The clock: main loop does `DD.run.timeLeft -= dt` whenever `DD.run && DD.run.active && !DD.paused`
and the scene is one of explore/combat/harvest. At 0 → `DD.game.endLoop('time')`. Under 60 s:
`DD.audio.sfx('tick')` each whole second and red pulsing clock. `DD.audio.setTension(1 - timeLeft/360)`
every frame.

Scenes owned by W1: `title`, `table` (dissection table), `loopEnd`, `victory`, `codex`, `shop`,
plus the pause overlay (`DD.paused`, drawn by main loop; buttons Continuar / Silenciar sonido /
Abandonar bucle).

**Dissection table (`table`)**: shows available base bodies (DD.BASE_BODIES filtered by
`unlock==='free'` or owned in shop) — the default one is picked at random each loop ("un nuevo
cuerpo base"), player may switch among unlocked ones. Then "Planos anatómicos": list of
discovered blueprints (limbs); the player may graft up to `graftSlots = min(3, 1 + floor(nBlueprints/4))`
of them (0 if no blueprints) onto chosen slots before waking. Shows the body doll
(`DD.sprites.drawBody`) and the resulting card list. Button "¡DESPERTAR!" → `DD.game.newRun`.
Loop 1 intro text explains the premise in 3–4 short lines.

**HUD** (W1): `DD.ui.drawHUD(ctx)` — top bar 0..24 px: anatomical clock (M:SS, big, red pulse
under 60 s, gear/heart motif), HP bar, floor "Piso 1/3", run Éter, and a compact body strip of 6
slot chips (icon + heat bar colour-coded + integrity pips; stumps shown crossed). Explore and
combat both call it at the end of their draw.

**Codex** (`codex`): all limbs in DD.LIMBS, undiscovered shown as "???" silhouettes; discovered
show name, slot, integrity, passive and their cards (name/cost/heat/desc).
**Shop** (`shop`): DD.COSMETICS (skins) and locked DD.BASE_BODIES purchasable with DD.save.data.ether;
equip skin; demo premium pack button ("Paquete de Éter +100 — DEMO, sin pagos reales").
**Title**: animated (flames, pulsing clock), buttons: Jugar, Planos (codex), Tienda, Sonido on/off.
Stats line: bucles, fugas, mejor tiempo. Controls help line.
**loopEnd**: reason text ("Has muerto" / "El reloj se detuvo"), "Tu espíritu viaja a una nueva mesa
de disección…", stats of the run, blueprints discovered this run → button Continuar → table.
**victory**: "¡HAS ESCAPADO!" time used, stats → button → title.

## 5. data.js (W2)

```js
DD.SLOTS = ['head','torso','armL','armR','legL','legR']
DD.SLOT_TYPE = {head:'head', torso:'torso', armL:'arm', armR:'arm', legL:'leg', legR:'leg'}
DD.SLOT_NAME = {head:'Cabeza', torso:'Torso', armL:'Brazo izq.', armR:'Brazo der.', legL:'Pierna izq.', legR:'Pierna der.'}
DD.CARDS[id] = { id, name, cost (0-3), heat (0-60 added to its limb), wear (0-2 integrity lost on play),
                 type:'attack'|'skill'|'power', desc (Spanish, short), play(c) }
   // c = combat context API (see combat.js) — effects are written as code in play(c)
DD.LIMBS[id] = { id, name, slot:'head'|'torso'|'arm'|'leg', integrity (2-6), cards:[2-3 card ids],
                 passive:{ maxHp?, draw?, energy?, vision?, speed?, cool? }, desc,
                 look:{ style:'flesh'|'brass'|'chitin'|'bone'|'slime'|'scaled', color:'#hex' } }
DD.STUMPS = { head:'cardId', torso:'cardId', arm:'cardId', leg:'cardId' } // weak stump cards; stump look is drawn by sprites
DD.ENEMIES[id] = { id, name, kind:'monster'|'scientist', hp, floorMin (1-3), boss?:true,
                   ether, limbs:[limb ids it can drop], intents:[ {type, ...} ], desc }
DD.BASE_BODIES = [ { id, name, desc, slots:{head,torso,armL,armR,legL,legR: limbId}, unlock:'free'|'shop', price? } ]
DD.COSMETICS = [ { id, name, tint:'#hex'|null, price } ]   // id 'none' first, price 0
```
**Fixed enemy ids (sprites depend on them)**: `homunculo` (monster, small pale fleshy thing),
`quimera` (monster, stitched beast), `golem` (monster, brass golem), `sanguijuela` (monster, giant leech),
`alquimista` (scientist in goggles/robe), `cirujano` (mad surgeon with saw), `acolito` (hooded
cultist scientist with vial), `rector` (BOSS, "El Rector Carnicero", huge scientist with brass
prosthetics). Floors: homunculo/sanguijuela/alquimista floorMin 1, quimera/cirujano/acolito 2,
golem 3, rector boss floor 3.
Content targets: ≥5 limbs per slot type (head/torso/arm/leg ⇒ ≥20 limbs), each limb 2–3 unique
cards (≥45 cards total) + 4 stump cards; at least 3 base bodies (2 free, ≥1 shop); ≥5 cosmetics.
Each enemy drops limbs thematically (golem → brass parts, sanguijuela → slime parts, etc.).
Limbs give distinct playstyles (e.g. brass arms = heavy block/high heat, chitin = multi-hit bleed,
alchemist head = draw & burn, surgeon arm = self-repair/suture, leech torso = lifesteal,
chimera legs = speed/dodge).

## 6. body.js (W2)

```js
DD.body.create(baseId) -> body   // body = { slots:{ head:limbInst|null, ... }, hp, maxHp }
   // limbInst = { id (limb id), integrity, maxIntegrity, heat (0..100) }
   // hp starts at maxHp. maxHp = 40 + sum passive.maxHp
DD.body.graft(body, slotKey, limbId)          // replaces; fresh integrity, heat 0; recompute maxHp (hp clamped, +diff if raised)
DD.body.slotsFor(limbId) -> ['armL','armR'] etc.
DD.body.limbDef(body, slotKey) -> DD.LIMBS entry or null (stump)
DD.body.stat(body, name) -> number   // 'draw' (5+), 'energy' (3+), 'vision' (4+; head stump -> 2),
   // 'speed' (1.0 with 2 legs; one stump 0.65; two stumps 0.4; times (1+sum passive.speed)),
   // 'cool' (10 + passive.cool heat shed per turn), 'maxHp'
DD.body.deck(body) -> [{cardId, slot}]  // all cards of all limbs; a stump slot contributes its stump card once
DD.body.addHeat(body, slotKey, n)  // heat>=100 => OVERHEAT: integrity -1, heat=60, sfx 'overheat', fx; may break
DD.body.wear(body, slotKey, n)     // integrity -n; at 0 => break
DD.body.cool(body, n)              // all limbs heat -n (min 0)
DD.body.repair(body, slotKey, n)   // integrity +n (max)
DD.body.heal(body, n); DD.body.hurt(body, n)
DD.body.onBreak = null             // optional callback(slotKey, limbId) set by combat to purge cards
   // break: slots[slotKey] = null, sfx 'break', DD.fx.shake, DD.fx.float("¡"+name+" se rompe!")
```

## 7. combat.js (W2) — scenes `combat` and `harvest`

`DD.setScene('combat', {enemyId})`. One enemy per fight, fast turns.
- Player: `DD.run.body` (HP persists between fights), block (resets each turn), energy =
  stat('energy') per turn, draw stat('draw') per turn, max hand 8. Deck = `DD.body.deck`, shuffled.
- Start of player turn: `DD.body.cool(body, stat('cool'))`, block=0, statuses tick.
- Playing a card: pay energy, run `card.play(c)`, then `addHeat(slot, card.heat)`, `wear(slot, card.wear)`.
  If the limb breaks: remove all cards of that slot from hand/draw/discard, add its stump card to discard.
- Card context `c`: `c.damage(n)` (applies strength/weak/vulnerable/enemy block),
  `c.hits(n, times)`, `c.block(n)`, `c.heal(n)`, `c.draw(n)`, `c.energy(n)`,
  `c.status('enemy'|'self', id, n)` ids: burn, bleed, weak, vuln, stun, strength, thorns,
  `c.coolSelf(n)`, `c.repair(n)` (most damaged limb), `c.heatSelf(slotKey|'random', n)`, `c.slot`
  (slot of the played card), `c.enemy`, `c.player`, `c.body`. Keep statuses simple:
  burn = dmg n at turn start then n-1; bleed = dmg n at end of turn then n-1; weak = deal −25%;
  vuln = take +50%; stun = skip next action; strength = +n per hit; thorns = reflect n when hit.
- Enemy intents (shown above enemy with icon + number, telegraphed one turn ahead):
  `{type:'attack', dmg, times?}`, `{type:'block', n}`, `{type:'buff', strength}`,
  `{type:'scald', heat}` (adds heat to a random player limb), `{type:'sever', n}` (integrity damage to a random limb),
  `{type:'debuff', status, n}`, `{type:'heal', n}`. Enemies cycle their intents list with some randomness.
  Enemy HP scales ×(1 + 0.25·(floor−1)).
- UI: enemy sprite right (`DD.sprites.enemy`), player body doll left (`DD.sprites.drawBody`) with
  each limb's heat glow, hand of cards at the bottom (click or keys 1–9 to play, E / button
  "Fin de turno"), energy orb, draw/discard counts, hover card → shows which limb it belongs to
  and its heat/wear. Cards are drawn by combat.js (panel + `DD.sprites.icon`). Call `DD.ui.drawHUD` last.
- Win → brief death animation → `DD.game.combatWon(enemyId)`. Lose (hp ≤ 0) → `DD.game.endLoop('death')`.
- After combat: `DD.body.cool(body, 30)`.
- Music: 'combat' on enter ('boss' for rector); back to 'explore' is set by explore's enter.

`DD.setScene('harvest', {limbs:[ids], source:'enemy'|'jar', enemyId?})`: "COSECHA". Shows each offered
limb with slot, integrity, passive and its card list. Choose a limb, then choose a valid slot
(shows what it replaces, incl. stumps highlighted as priority). "Injertar" → `DD.body.graft`,
sfx 'graft', `DD.game.discover(id)` (show "¡Nuevo plano anatómico!" if new). Alternatives:
"Devorar" (heal 8, sfx 'squelch') or "Dejar". Then `DD.game.returnToExplore()`. Timer keeps running here.

## 8. tower.js + explore.js (W3) — scene `explore`

`DD.tower.generate(floor, rng) -> map` (map shape is W3's own). `DD.setScene('explore',{newFloor})`:
if newFloor, generate `DD.run.map` for `DD.run.floor` and place the player at start; else resume
(remove `dead` enemies, keep everything else). Calls `DD.audio.music('explore')` on enter.
- Grid ~ 41×25 tiles, tile 16 px drawn ×2 (32 px), camera follows player (smooth), HUD bar on top.
- Generation: maze of rooms + corridors (with some loops), start, stairs ('stairs' on floors 1–2,
  'exit' on floor 3 guarded by the boss `rector`; exit only usable after `DD.run.bossDead`).
  Enemies 4+2·floor (from DD.ENEMIES by floorMin ≤ floor, not boss), traps 5+2·floor, pickups:
  vials, coolant, sutures, ether shards, 1–2 limb jars (random limb of DD.LIMBS).
- **Constantly changing labyrinth**: some wall tiles are 'shiftwall' (brass mechanical walls). Every
  ~20 s the tower reconfigures: a set of shiftwalls toggle open/closed (never on a cell occupied
  by the player/entities, never breaking connectivity start→stairs: keep the precomputed critical
  path free), with message "La torre se reconfigura…", sfx 'shift', small shake.
- **Burning tower**: fire tiles spread over time; spread rate grows as `DD.run.timeLeft` falls.
  Stepping into fire: hurt 3 + heat 15 to a leg. Fire never spawns on stairs/exit/player.
- Traps (visible only within 2 tiles, or always when head has vision ≥5): spikes (hurt 4, wear a leg 1),
  acid (heat +35 random limb), steam (heat +15 all limbs). Re-arm after 5 s. sfx 'trap'/'acid'/'steam'.
- Pickups: 'Vial de sangre' heal 10, 'Refrigerante' cool 40, 'Sutura' repair 1 most damaged limb,
  'Éter' +3 run ether, jar → `DD.game.openJar(limbId)`. `DD.fx.float` feedback, sfx 'pickup'.
- Movement: grid steps with tween; step time = 0.14 / stat('speed') s; hold to keep moving.
  Mouse/touch: hold on screen → move in the dominant direction from player to pointer. Gamepad via actions.
- Fog of war: radius stat('vision') tiles, explored tiles remembered dimmed.
- Enemies: wander; chase if within 5 tiles; enemies avoid fire; contact → `DD.game.startCombat(entity)`.
  The boss stands next to the exit and doesn't wander.
- Stairs → `DD.game.nextFloor()`; exit (floor 3, boss dead) → `DD.game.nextFloor()` (which escapes).
- Hint line at the bottom: "WASD/Flechas: moverse · P: pausa" etc. Call `DD.ui.drawHUD(ctx)` last.

## 9. sprites.js (W4)

All art procedural (pixel maps as string arrays + palettes, rendered once to offscreen canvases
and cached). Gothic-alchemical-steampunk: dark stone, brass pipes, gears, glass vials, green
ichor, blood, embers.
```js
DD.sprites.tile(ctx, name, x, y, scale, t)   // name: floor, wall, shiftwall, shiftwall_open, stairs, exit,
      // exit_locked, fire (animated by t seconds), trap_spike, trap_acid, trap_steam, trap_spent,
      // vial, coolant, suture, ether, jar, rubble.  16x16 source.
DD.sprites.player(ctx, body, x, y, scale, t, facing)  // 16x16 explore avatar reflecting body
      // (missing arm/leg visible as stump; skin tint from DD.save.data.skin via DD.COSMETICS)
DD.sprites.enemyMini(ctx, enemyId, x, y, scale, t)    // 16x16 explore sprite
DD.sprites.enemy(ctx, enemyId, x, y, scale, t, opts)  // big combat sprite (~48x48 source), x,y = bottom-center
      // opts {hurt: 0..1 flash, dead: 0..1 dissolve}
DD.sprites.drawBody(ctx, body, x, y, scale, t, opts)  // anatomical doll composed of per-slot limb parts
      // chosen by DD.LIMBS[id].slot + look.style + look.color; stumps drawn as bandaged stubs;
      // heat glow per limb (red→orange→white as heat rises); x,y = bottom-center; ~32x48 source
      // opts {skin (cosmetic id), highlight: slotKey}
DD.sprites.limbIcon(ctx, limbId, x, y, scale)       // 16x16 icon of a single limb (for harvest/codex/HUD)
DD.sprites.icon(ctx, name, x, y, scale)             // 8x8 icons: attack, skill, power, block, heat, wear,
      // energy, heart, clock, gear, head, torso, arm, leg, stump, burn, bleed, weak, vuln, stun,
      // strength, thorns, heal, buff, scald, sever, ether, skull
DD.sprites.background(ctx, kind, t)                 // full-screen backdrops: 'lab' (combat), 'table'
      // (dissection table room), 'title' (burning tower silhouette + moon), animated embers
```

## 10. audio.js (W4)

WebAudio only, fully synthesized. `DD.audio.init()` is called by main on the first user gesture
(click/key/touch); every other call is a no-op before init. Respect `DD.save.data.muted`.
```js
DD.audio.init(); DD.audio.setMuted(bool)
DD.audio.music(mode)      // 'title' | 'explore' | 'combat' | 'boss' | 'table' | 'victory' | 'silence'
                          // ominous synth: low drone + detuned saw pads (orchestral feel) +
                          // minor arpeggios/bells; crossfade between modes
DD.audio.setTension(x)    // 0..1: tempo/filter/pitch pressure rise as the clock runs down
DD.audio.sfx(name)        // step, hit, hurt, block, card, burn, overheat, break, graft, squelch, pickup,
                          // trap, acid, steam, door, shift, tick, death, victory, select, heal,
                          // enemyDie, draw, error — guttural/visceral (noise bursts, pitch-dropping
                          // growls, wet squelches via filtered noise + LFO)
```
Unknown names must be ignored silently.
