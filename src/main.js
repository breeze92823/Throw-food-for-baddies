import { ACESFilmicToneMapping, CircleGeometry, Clock, DoubleSide, Group, Mesh, MeshBasicMaterial, RingGeometry, PCFSoftShadowMap, PerspectiveCamera, Quaternion, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { BADDIES, BOARD_BOTS, CAMERA, LEADERBOARDS, REMOTE, ECONOMY, FUSE, graphicsPreset, HUB, PENS, PHYSICS, POI, RARITIES, RENDER, SIZES, SPAWN, AUDIO, THROW_MODE, VARIANTS, placeUnit } from './config.js'
import * as THREE from 'three'
import * as bloxity from './bloxity.js'
import { createRemotePlayers } from './remote.js'
import { createAds } from './ads.js'
import { EmotePlayer } from './avatar/emotes.js'
import * as net from './net.js'
import { install as installInput, onKey } from './input.js'
import { installTouch } from './touch.js'
import { createPlayerBody, interpolate as interpolatePlayer, player, resetPlayer, respawn, setSpawn } from './player.js'
import { setCameraSensitivity, syncYawToPlayer, update as updateCamera } from './camera.js'
import { createDirector } from './camDirector.js'
import { onModeChanged, toggleMode } from './modes.js'
import { bodyCount, initPhysics, stepPhysics } from './physics.js'
import { createLighting } from './lighting.js'
import { createPostFx } from './postfx.js'
import { setNeonBloom } from './propkit.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { buildHub } from './hub/world.js'
import { buildBoards, buildChest, buildFoodShop, buildFriendWall, buildFuse, buildLaneDeco, buildSell, buildThrowBand } from './hub/props.js'
import { buildPens, setIncomeFn } from './game/pens.js'
import { createThrower } from './game/throw.js'
import { createBoss } from './game/boss.js'
import { createRewards } from './ui/rewards.js'
import { createEventsUi } from './ui/eventsUi.js'
import { Baddie, BY_ID } from './game/baddieModel.js'
import { fmt, clock, money } from './game/format.js'
import * as state from './game/state.js'
import { createFx } from './fx/particles.js'
import { installAudio, isMuted, setDucked, setVolume, sfx, toggleMuted, updateAudio } from './audio/index.js'
import { warmFoodPortraits } from './ui/foodShop.js'
import { createHud } from './ui/hud.js'
import { baddiePortrait } from './ui/snapshot.js'
import { createThrowUi } from './ui/throwUi.js'
import { TRAINING } from './config.js'
import { buildTrainingStation } from './hub/trainingStation.js'
import { createTrainer } from './game/training.js'
import { createTrainUi } from './ui/trainUi.js'
import * as trainSfx from './audio/trainSfx.js'
import * as girlSfx from './audio/girlSfx.js'
import { zoneAt } from './game/lane.js'
import { AREAS, INDEX_BONUS } from './config.js'
import { createHotbar } from './ui/hotbar.js'

// Boot order: Bloxity SDK -> renderer -> Rapier (async wasm) -> hub world, props, pens,
// lane, player body -> saved progress -> avatar (async, swaps in when ready) -> loop.
let lighting = null
let renderer = null
let postfx = null
let fx = null

function applySetting(key, value) {
  if (key === 'camera_sensitivity') setCameraSensitivity(value)
  else if (key === 'fullscreen') bloxity.requestFullscreen(value)
  else if (key === 'master_volume') setVolume(value / 100)
  else if (key === 'graphics_quality' && renderer) {
    const next = graphicsPreset(value)
    renderer.shadowMap.enabled = next.shadows
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.dpr))
    lighting?.setShadows(next)
    postfx?.configure(next)
    setNeonBloom(next.bloom)
    postfx?.setSize(window.innerWidth, window.innerHeight)
    fx?.setDensity(next.particles)
    resize()
  }
}
bloxity.onSetting(applySetting)
bloxity.init()

// Waits (briefly) for Bloxity sign-in to settle so the server gets the real user id and name.
async function authSettled(maxMs = 4000) {
  if (bloxity.authState.ready) return
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, maxMs)
    bloxity.subscribeAuth((s) => {
      if (!s.ready) return
      clearTimeout(timer)
      resolve()
    })
  })
}

// --- Renderer ---------------------------------------------------------------
const preset = graphicsPreset(bloxity.settings.graphics_quality)
renderer = new WebGLRenderer({ antialias: preset.antialias, powerPreference: 'high-performance' })
renderer.outputColorSpace = SRGBColorSpace
renderer.toneMapping = ACESFilmicToneMapping
renderer.toneMappingExposure = RENDER.exposure
renderer.shadowMap.enabled = preset.shadows
renderer.shadowMap.type = PCFSoftShadowMap
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.dpr))
document.body.appendChild(renderer.domElement)
installInput(() => bloxity.showMenu(), renderer.domElement)
installAudio()

const scene = new Scene()
const camera = new PerspectiveCamera(CAMERA.fov, 1, CAMERA.near, CAMERA.far)
postfx = createPostFx(renderer, scene, camera)
postfx.configure(preset)

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight)
  postfx.setSize(window.innerWidth, window.innerHeight)
  camera.aspect = window.innerWidth / window.innerHeight
  camera.updateProjectionMatrix()
  fx?.setScale((window.innerHeight * renderer.getPixelRatio()) / (2 * Math.tan((camera.fov * Math.PI) / 360)))
}
window.addEventListener('resize', resize)

for (const key of Object.keys(bloxity.settings)) applySetting(key, bloxity.settings[key])

// --- World ----------------------------------------------------------------------
bloxity.loadingStep('Starting physics')
await initPhysics()
bloxity.loadingStep('Building the hub')
lighting = createLighting(scene, renderer, preset)
fx = createFx(scene, { particles: preset.particles })
resize()
const hub = buildHub(scene)
const world = new Group()
scene.add(world)
buildSell(world)
const fuseMachine = buildFuse(world)
const chest = buildChest(world)
const boards = buildBoards(world)
buildFriendWall(world)
const laneDeco = buildLaneDeco(world)
const band = buildThrowBand(world)
// Join the shared room first: the server assigns this player one of the bases (room size = number
// of bases, so every player gets their own). No server (dev without one, blocked SDK, nobody
// answering in time): play offline on the middle pen with the stand-in neighbours.
bloxity.loadingStep('Finding your base')
await authSettled()
net.setJoinExtras(() => ({ avatar: lookJson() }))
const session = await net.connect()
const online = !!session
const myIndex = online ? session.base : PENS.playerIndex
// One unit per player: your base + your Food Shop + your Training Place, side by side. Other
// players' shops and training stations are not built, so you only ever see your own.
placeUnit(myIndex)
buildFoodShop(world)
const trainStation = buildTrainingStation(world)
setIncomeFn((e) => state.baddieIncome(e))
const pens = buildPens(world, { mine: myIndex, online })
const myPen = pens[myIndex]
const localVec = new Vector3()
const remote = online
  ? createRemotePlayers(scene, { fx, sfx, pens, localPos: () => localVec.set(player.renderPosition.x, player.renderPosition.y, player.renderPosition.z) })
  : null
setSpawn(myPen.cx + SPAWN.x - PENS.xs[PENS.playerIndex], SPAWN.z) // in front of your own base
createPlayerBody()
syncYawToPlayer()

// --- Progress ----------------------------------------------------------------------
// The save lives on the game server only (nothing in the browser): wait for the stored progress,
// then every change goes back through state.save() -> net.saveGame. Without a server, as a guest, or
// if the stored progress could not be read, this session just is not stored.
// Progress used to live in the browser: drop those leftovers.
for (const key of ['throw-food-for-baddies.save.v1', 'throw-food-for-baddies.index-seen']) {
  try {
    localStorage.removeItem(key)
  } catch {
    // Storage blocked.
  }
}
const saved = online ? await net.loadGame() : { ok: false, game: null }
const away = state.hydrate(saved.game)
state.setInvites(saved.invites ?? 0)
state.setSaver((S) => net.saveGame({ ...S, income: Math.round(state.income()) })) // + the money/s the income board ranks
for (const b of state.S.baddies) myPen.add(b)
const baseWalk = PHYSICS.walkSpeed
const baseSprint = PHYSICS.sprintSpeed
function applySpeed() {
  PHYSICS.walkSpeed = baseWalk * state.walkMult()
  PHYSICS.sprintSpeed = baseSprint * state.walkMult()
}
applySpeed()

// --- HUD -------------------------------------------------------------------------------
const chestTarget = new Vector3()
const playerChest = () => chestTarget.set(player.renderPosition.x, player.renderPosition.y + 1.2, player.renderPosition.z)
let fuseBusy = false
warmFoodPortraits() // shop cards render their food portraits in idle time
const hud = createHud({
  sfx,
  onReservedAreas: bloxity.onReservedAreas,
  actions: {
    onWindow(id, prev) {
      if (prev === 'fuse' && !fuseBusy) fuseMachine.setCount(0)
      setDucked(!!id)
      if (id && document.pointerLockElement) document.exitPointerLock?.()
    },
    // Sell owned entries ({ kind: 'pen' | 'hot', b }, see state.owned). Returns the total.
    sellMany(entries) {
      let got = 0
      for (const e of entries) {
        if (e.kind === 'pen') {
          const pos = myPen.positionOf(e.b.uid, new Vector3())
          const p = state.sellBaddie(e.b.uid)
          if (p) fx.puff(pos, '#ffffff', 8, { size: 0.7, spread: 1.6 })
          got += p
        } else got += state.sellHotbarItem(e.b)
      }
      if (got) {
        sfx.sell(entries.length)
        fx.coins(new Vector3(POI.sell.x, 2, POI.sell.z - 1.7), Math.min(18, 4 + entries.length * 2), playerChest, () => sfx.coin(Math.floor(Math.random() * 6)))
      }
      return got
    },
    fusing: () => fuseBusy,
    fuse: (entries) => startFuse(entries),
    fuseAll: () => fuseAll(),
    fuseSlots: (n) => !fuseBusy && fuseMachine.setCount(n),
    unequip(uid) {
      const pos = myPen.positionOf(uid, new Vector3())
      const item = state.unequip(uid)
      if (!item) return
      fx.puff(pos, '#ffffff', 10, { size: 0.7, spread: 1.6 })
      sfx.equip()
      hotbar.render()
      hud.toast(`${BY_ID[item.id].name} is back in your hotbar (not earning).`, '')
    },
    equipBest() {
      const placed = state.equipBest()
      if (!placed.length) {
        sfx.deny()
        hud.toast('Your pen is full! Upgrade it or sell a baddie.', 'warn')
        return
      }
      for (const b of placed) {
        const rec = myPen.add(b, { drop: true })
        fx.sparkle(rec.home.clone().setY(1.2), RARITIES[BY_ID[b.id].rarity].glow, 14, { speed: 4 })
      }
      sfx.arrive()
      hud.toast(`${placed.length} baddie${placed.length > 1 ? 's' : ''} put to work! +$${fmt(placed.reduce((t, b) => t + state.baddieIncome(b), 0))}/s`, 'good')
    },
    celebrate() {
      fx.confetti(playerChest().clone().setY(player.renderPosition.y + 2.5), 50)
      fx.stars(playerChest(), '#ffd93b', 12)
    },
    getVolume: () => volume,
    setVolume(v) {
      volume = v
      setVolume(v)
      try {
        localStorage.setItem(`${AUDIO.storageKey}.volume`, String(v))
      } catch {
        // Ignore.
      }
    },
    isMuted,
    toggleMuted,
    dayNight,
  },
})
let volume = AUDIO.volume
try {
  const v = parseFloat(localStorage.getItem(`${AUDIO.storageKey}.volume`))
  if (Number.isFinite(v)) volume = v
} catch {
  // Ignore.
}
setVolume(volume)

function refreshPortrait() {
  const best = [...state.S.baddies].sort((a, b) => state.baddieIncome(b) - state.baddieIncome(a))[0]
  hud.setPortrait(baddiePortrait(best?.id ?? BADDIES[0].id, 0, true))
  hud.setCount()
}
function refreshSign() {
  const cap = state.capacity()
  myPen.sign.draw(cap, cap + ECONOMY.capacityStep, state.capacityCost(), state.S.money >= state.capacityCost(), state.capacityMaxed())
}
function refreshIncome() {
  myPen.setIncome(state.income())
}
hud.setMoney(state.S.money, 0, { popup: false })
hud.setStrength(state.totalStrength())
hud.setQuest(state.questView())
refreshPortrait()
refreshSign()
refreshIncome()
if (online && !saved.ok) setTimeout(() => hud.toast('Could not load your saved progress, so this session will not be saved.', 'warn'), 2500)
if (online) {
  // A guest signed in mid-session: their account's stored progress replaces this one (reload), or a
  // new account adopts it and starts saving.
  net.onLateGame(({ ok, game }) => {
    if (!ok) return
    if (game) location.reload()
    else {
      net.enableSaving(true)
      state.save()
    }
  })
}
if (away.cash > 0) setTimeout(() => hud.toast(`Welcome back! Your baddies earned ${money(away.cash)} while you were away`, 'good'), 1500)

// --- State -> world -----------------------------------------------------------------
let lastSignAffordable = null
state.on('money', (v, delta, source) => {
  hud.setMoney(v, source === 'income' ? 0 : delta)
  const afford = v >= state.capacityCost()
  if (afford !== lastSignAffordable) {
    lastSignAffordable = afford
    refreshSign()
  }
  if (hud.isOpen() && source !== 'income') hud.refresh()
})
state.on('strength', (v) => hud.setStrength(v))
state.on('baddie-added', (b, isNew, source) => {
  if (source !== 'catch' && source !== 'place') myPen.add(b, { drop: source === 'fuse' })
  refreshPortrait()
  if (isNew) hud.newDiscovery()
})
// The Index: a sting for every new girl, a fanfare and a toast for every completed area page.
state.on('discover', (def) => {
  if (def) hud.focusIndex(def.id)
  setTimeout(() => girlSfx.discover(), 900)
})
state.on('area-complete', (a) => {
  setTimeout(() => {
    girlSfx.areaComplete()
    hud.toast(`${AREAS[a].name} Index complete! +${Math.round(INDEX_BONUS * 100)}% income forever`, 'rare')
    const p = player.renderPosition
    fx.confetti(new Vector3(p.x, p.y + 2.5, p.z), 90, 8)
    fx.stars(new Vector3(p.x, p.y + 2, p.z), '#ffe14a', 20, 6)
  }, 2200)
})
state.on('baddie-removed', (b) => {
  myPen.remove(b.uid)
  refreshPortrait()
})
state.on('income', () => refreshIncome())
state.on('capacity', () => {
  refreshSign()
  hud.setCount()
})
state.on('upgrade', (id) => {
  if (id === 'speed') applySpeed()
})
state.on('quest', (q) => {
  hud.questDone(q)
  sfx.quest()
  fx.confetti(new Vector3(player.renderPosition.x, player.renderPosition.y + 3, player.renderPosition.z), 60)
})

// --- Hotbar: carry a caught baddie and place it in your pen ------------------------
// A catch lands in the hotbar. Select a slot (click it or press its number) and you carry
// that baddie in front of you; a white disc on the ground shows where it will go. Inside
// your pen, click (E / F, or the PLACE button on touch) to put it down: it hops in and
// starts earning.
let carried = null // { b: Baddie, idx }
let carriedItem = null // the hotbar item being carried
const marker = new Group()
const markerDisc = new Mesh(new CircleGeometry(1.05, 36).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.85, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
const markerRing = new Mesh(new RingGeometry(1.25, 1.42, 40).rotateX(-Math.PI / 2), new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.7, depthWrite: false, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4 }))
marker.add(markerDisc, markerRing)
marker.visible = false
marker.renderOrder = 3
scene.add(marker)
let markerValid = false
function inMyPen(x, z, margin = 1) {
  return Math.abs(x - myPen.cx) < PENS.halfW - margin && Math.abs(z - myPen.cz) < PENS.halfD - margin
}
function setCarry(idx) {
  carried?.b.dispose()
  carried = null
  const item = idx >= 0 ? state.S.hotbar[idx] : null
  if (item) {
    const b = new Baddie(item.id, item.size, { variant: item.v | 0, income: state.baddieIncome(item) })
    b.mode = 'fly'
    world.add(b.group)
    carried = { b, idx }
    carriedItem = item
    sfx.equip()
  }
  marker.visible = !!carried
  document.body.classList.toggle('holding', !!carried)
}
const hotbar = createHotbar({ getItems: () => state.S.hotbar, onSelect: setCarry })
hotbar.render()
state.on('hotbar', (items, info) => {
  if (info?.isNew) hud.newDiscovery()
  // A sell or fuse can take a hotbar item out from under the one you carry: put it away.
  if (info?.removed && carried && state.S.hotbar[carried.idx] !== carriedItem) hotbar.select(-1)
  if (info?.removed || info?.unequipped || info?.fused) hotbar.render()
  hud.refreshActive()
})
function placeCarried() {
  if (!carried) return
  if (!markerValid) {
    sfx.deny()
    hud.toast(`Walk into your pen to place ${carried.b.def.name}!`, 'warn')
    return
  }
  const idx = carried.idx
  const def = carried.b.def
  const at = marker.position.clone()
  hotbar.select(-1)
  const entry = state.placeFromHotbar(idx)
  if (!entry) {
    sfx.deny()
    hud.toast('Your pen is full! Upgrade it or sell a baddie.', 'warn')
    return
  }
  myPen.add(entry, { drop: true, at })
  fx.ring(at.clone().setY(PENS.floorHeight + 0.05), RARITIES[def.rarity].glow, { r0: 0.4, r1: 3.6 })
  fx.sparkle(at.clone().setY(1.2), RARITIES[def.rarity].glow, 24, { speed: 4 })
  fx.beam(at.clone().setY(PENS.floorHeight), RARITIES[def.rarity].glow, { radius: 1.1, height: 9, life: 1 })
  sfx.arrive()
  hud.toast(`${entry.v ? VARIANTS[entry.v].name + ' ' : ''}${def.name} (${RARITIES[def.rarity].name}) joined your pen! +$${fmt(state.baddieIncome(entry))}/s`, def.rarity >= 3 || entry.v ? 'rare' : 'good')
}
function updateCarry(dt, t) {
  if (!carried) return
  const p = player.renderPosition
  const fwdX = Math.sin(player.facing)
  const fwdZ = Math.cos(player.facing)
  const b = carried.b
  b.group.position.set(p.x + fwdX * 0.95, p.y + 0.5 + Math.sin(t * 3) * 0.05, p.z + fwdZ * 0.95)
  b.group.rotation.y = player.facing
  b.update(dt)
  const mx = p.x + fwdX * 3
  const mz = p.z + fwdZ * 3
  markerValid = inMyPen(mx, mz)
  marker.position.set(mx, (markerValid ? PENS.floorHeight : 0) + 0.04, mz)
  const pulse = 1 + Math.sin(t * 5) * 0.06
  marker.scale.setScalar(markerValid ? pulse : 0.7)
  markerDisc.material.color.set(markerValid ? '#ffffff' : '#ff6a6a')
  markerRing.material.color.set(markerValid ? '#ffffff' : '#ff6a6a')
  markerDisc.material.opacity = markerValid ? 0.85 : 0.45
  markerRing.rotation.y = t * 0.8
}

// --- The throw sequence -------------------------------------------------------------
// Step on the yellow band: throw.js takes the camera (through the director) and the
// overlay (throwUi.js) for the aim -> flight -> landing -> reveal loop. A caught baddie
// flies to your pen and drops in through a beam of light.
const director = createDirector()
let thrower = null
let boss = null // game/boss.js, created with the other live-event modules below
const throwUi = createThrowUi({
  onTap: () => thrower?.tap(),
  onExit: () => thrower?.exit(),
  onAuto: () => thrower?.toggleAuto(),
  onLucky: () => thrower?.buyLucky(),
})
thrower = createThrower(world, {
  fx,
  sfx,
  player,
  camera,
  director,
  ui: throwUi,
  onThrow: (e) => {
    net.send('throw', e)
    boss?.noteThrow()
  },
  toast: (t, k) => hud.toast(t, k),
  income: () => state.income(),
  canEnter() {
    if (hud.isOpen()) return false
    hotbar.select(-1) // put away whatever you carry before throwing
    return true
  },
  freeze(on) {
    player.frozen = on
  },
  place(x, z, facing) {
    resetPlayer({ x, y: player.renderPosition.y, z }, facing)
  },
  syncYaw() {
    player.facing = Math.PI
    syncYawToPlayer()
  },
  // A girl went into the hotbar: the throw ends and the player appears on their own base to place her.
  toBase() {
    respawn()
  },
  onCaught: {
    toHotbar(def) {
      hotbar.flyIn(def.id)
      hud.toast(`${def.name} is in your hotbar! Select it, then place it in your pen.`, def.rarity >= 3 ? 'rare' : 'good')
    },
    target: () => myPen.front.clone().setY(PENS.floorHeight).add(new Vector3(0, 0, PENS.halfD)),
    arrive(entry, def) {
      const rec = myPen.add(entry, { drop: true })
      const p = rec.b.group.position
      fx.beam(new Vector3(p.x, 0, p.z), RARITIES[def.rarity].glow, { radius: 1.4, height: 16, life: 1.4 })
      sfx.arrive()
      hud.toast(`${entry.v ? VARIANTS[entry.v].name + ' ' : ''}${def.name} (${RARITIES[def.rarity].name}) joined your pen! +$${fmt(state.baddieIncome(entry))}/s`, def.rarity >= 3 || entry.v ? 'rare' : 'good')
    },
  },
})

// --- Training Place --------------------------------------------------------------------
// Walk in under the bar: pull-ups earn training XP (the bench's XP/s), levels give strength; the
// pad behind the bar upgrades the bench, random x2..x10 XP boost buttons pop up while you train
// (game/training.js). Space / F / E (or a tap) grab the random 2x boost button; STOP, Q or walking gets off.
let trainer = null
const trainUi = createTrainUi({ onStop: () => trainer?.stop(), onGrab: () => trainer?.grab() })
trainStation.setTier(state.benchTier(), false) // the saved bench
trainer = createTrainer({
  fx,
  sfx: trainSfx,
  player,
  ui: trainUi,
  station: trainStation,
  director,
  freeze(on) {
    player.frozen = on
  },
  syncYaw: syncYawToPlayer,
  canEnter() {
    if (hud.isOpen() || thrower.active) return false
    hotbar.select(-1) // hands free for the bar
    return true
  },
  busy: () => thrower.active || hud.isOpen(),
  // The pen's pad is the bench's upgrade pad (it sits right behind the bar).
  pad: { spot: myPen.padSpot, label: myPen.pad.text, top: myPen.pad.top },
  toast: (text, kind) => hud.toast(text, kind),
})
window.addEventListener('keydown', (e) => {
  if (!trainer.training || e.repeat || e.target instanceof HTMLInputElement) return
  if (e.code === 'Space' || e.code === 'KeyF' || e.code === 'KeyE') trainer.grab() // the boost button, when it is up
  else if (e.code === 'KeyQ' || e.code === 'Escape') trainer.stop()
})

// --- Fuse -----------------------------------------------------------------------------
// The Fuse Machine window hands over three entries (pen and/or hotbar, see state.fuseEntries)
// or asks to fuse everything. The machine runs (screen fills, steam), then the fuse lands.
const fuseTop = new Vector3(POI.fuse.x, 3.5, POI.fuse.z - 2.2)
function runFuseMachine(def, onDone) {
  fuseBusy = true
  const dur = FUSE.duration
  fuseMachine.run(dur)
  fuseMachine.setCount(3)
  sfx.fuseRun(dur)
  const t0 = performance.now()
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / (dur * 1000))
    fuseMachine.drawScreen(def.name, k, RARITIES[def.rarity].color)
    if (k < 1) requestAnimationFrame(tick)
  }
  tick()
  const steam = setInterval(() => fx.puff(fuseTop.clone().add(new Vector3(0.4, 0.8, 0)), '#e8f6ff', 3, { size: 0.6, spread: 0.6, up: 2 }), 120)
  setTimeout(() => {
    clearInterval(steam)
    fuseBusy = false
    fuseMachine.setCount(0)
    fuseMachine.drawScreen('?')
    onDone()
    hud.refresh()
  }, dur * 1000)
}
function fuseCelebrate(lucky) {
  sfx.fuseDone()
  fx.stars(fuseTop, '#ffd93b', lucky ? 40 : 24, 8)
  fx.confetti(fuseTop, lucky ? 160 : 90, 9)
  fx.puff(fuseTop, '#ffffff', 16, { size: 1, spread: 3, up: 2 })
  fx.ring(new Vector3(POI.fuse.x, 0, POI.fuse.z), lucky ? '#ffe14a' : '#3fe0ff', { r1: lucky ? 10 : 7 })
}
const fusedName = (b) => `${SIZES[b.size].name} ${BY_ID[b.id].name}`
function fusedToast(r) {
  const where = r.where === 'pen' ? 'is in your pen' : 'is in your hotbar'
  const lucky = r.lucky ? (r.bonus ? `LUCKY! +${money(r.bonus)} bonus! ` : 'LUCKY! Skipped a size! ') : ''
  hud.toast(`${lucky}${fusedName(r.b)} ${where}: $${fmt(state.baddieIncome(r.b))}/s!`, 'rare')
}
function startFuse(entries) {
  if (fuseBusy || entries?.length !== 3 || !entries.every(state.ownsEntry)) return
  runFuseMachine(BY_ID[entries[0].b.id], () => {
    const r = state.fuseEntries(entries)
    if (!r) {
      hud.toast('Those baddies are gone: fuse cancelled.', 'warn')
      return
    }
    fuseCelebrate(r.lucky)
    hud.pop({ img: baddiePortrait(r.b.id), line1: r.lucky ? 'LUCKY FUSE!' : 'FUSED!', line2: fusedName(r.b), color: r.lucky ? '#7dff4a' : '#ffd93b' })
    fusedToast(r)
  })
}
// FUSE ALL: every triple, biggest-earning first, repeated so fresh BIGs can make HUGEs.
function fuseAll() {
  if (fuseBusy) return
  const first = state.fusable().sort((a, b) => state.baddieIncome(b[0].b) - state.baddieIncome(a[0].b))[0]
  if (!first) return
  runFuseMachine(BY_ID[first[0].b.id], () => {
    const made = []
    for (let guard = 0; guard < 200; guard++) {
      const g = state.fusable().sort((a, b) => state.baddieIncome(b[0].b) - state.baddieIncome(a[0].b))[0]
      if (!g) break
      const r = state.fuseEntries(state.pickTriple(g[0].b))
      if (!r) break
      made.push(r)
    }
    if (!made.length) return
    const lucky = made.filter((r) => r.lucky).length
    fuseCelebrate(lucky > 0)
    const best = made.reduce((a, r) => (state.baddieIncome(r.b) > state.baddieIncome(a.b) ? r : a))
    hud.pop({ img: baddiePortrait(best.b.id), line1: `FUSED x${made.length}!`, line2: fusedName(best.b), color: '#ffd93b' })
    if (made.length === 1) fusedToast(made[0])
    else hud.toast(`Fused ${made.length} times${lucky ? ` (${lucky} lucky!)` : ''}. Best: ${fusedName(best.b)}`, 'rare')
  })
}

// --- Player avatar ----------------------------------------------------------
const playerGroup = new Group()
scene.add(playerGroup)
let avatar = null
let animator = null
let emoteP = null
let generation = 0
let avatarReady = false
let armBinding = null
let armLBinding = null

function setAvatar(next) {
  if (avatar) playerGroup.remove(avatar)
  disposeAnimator(animator)
  avatar = next
  emoteP = new EmotePlayer(next) // while still in the bind pose
  playerGroup.add(avatar)
  animator = makeAnimator(avatar)
  armBinding = animator?.rig.bindings.find((b) => b.bone.name === 'ArmR1') ?? null
  armLBinding = animator?.rig.bindings.find((b) => b.bone.name === 'ArmL1') ?? null
}
setAvatar(buildDefaultCharacter())

async function loadAvatar() {
  const mine = ++generation
  try {
    const group = await loadBaseCharacter()
    if (mine !== generation) return
    const equipped = bloxity.authState.user ? bloxity.getEquippedAvatar() : null
    await attachEquippedAccessories(group, equipped, { skinTextureUrl: bloxity.getSkinTextureUrl() })
    if (mine !== generation) return
    applyProportions(group, bloxity.authState.user ? bloxity.getProportions() : null)
    setAvatar(group)
    sendLook()
  } finally {
    if (mine === generation) avatarReady = true
  }
}

// The player's plot badge: their name and Bloxity picture (if any).
let badgeUrl = ''
function refreshBadge() {
  const name = bloxity.displayName()
  myPen.setName(name === 'Offline' ? 'You' : name)
  const url = bloxity.getPfp()
  if (!url || url === badgeUrl) return
  badgeUrl = url // tried once; a CORS-blocked picture keeps the drawn badge
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => myPen.setBadgeImage(img)
  img.src = url
}

// --- Bases (net.js) --------------------------------------------------------------------
let friendIds = new Set() // Bloxity friends (refreshFriends)
let lastPlayers = [] // the room roster
// Every other base shows who the server seated there (name + picture), or "Free base".
if (online) {
  net.onEvent('throwFx', (e) => remote.throwFx(e))
  net.onEvent('emoteFx', (e) => remote.emoteFx(e))
  net.onRoster((players) => {
    remote.sync(players)
    lastPlayers = players
    countFriends()
    for (const pen of pens) {
      if (pen === myPen) continue
      const p = players.find((o) => !o.me && o.base === pen.index)
      pen.setOccupant(p ? { name: p.name, pfp: p.pfp } : null)
    }
  })
  net.onStatus((status) => {
    if (status === 'reconnecting') hud.toast('Connection lost. Reconnecting...', 'warn')
    else if (status === 'online') hud.toast('Back online!', 'good')
    else hud.toast('Could not reconnect. Your progress is kept on this device.', 'warn')
  })
  // The server seated us on a different base after a reconnect: the hub is built around the old
  // one, so save and start over on the new one.
  net.onRebase(() => {
    state.save()
    location.reload()
  })
}

let signedIn = null
bloxity.subscribeAuth((s) => {
  const now = !!s.user
  refreshBadge()
  if (online && net.net.online) net.identify() // signed in or out mid-session: update the roster name
  if (now !== signedIn) {
    signedIn = now
    loadAvatar()
  }
})
bloxity.onAvatarChanged(loadAvatar)
bloxity.onProportionsChanged(() => {
  applyProportions(avatar, bloxity.getProportions())
  sendLook()
})
bloxity.onRespawnRequest(() => {
  respawn()
  sfx.respawn()
})

// --- Presence: what the other players see of you (net.js, remote.js) ---------------------
// Your Bloxity look, pose, held items and base contents go to the server; it relays them to the
// room. Sent only on change (pose ~10 Hz while moving, a heartbeat once a second).
function lookJson() {
  if (!bloxity.authState.user) return '' // guests wear the default look
  try {
    const json = JSON.stringify({ equipped: bloxity.getEquippedAvatar(), proportions: bloxity.getProportions() })
    return json.length <= 2900 ? json : ''
  } catch {
    return ''
  }
}
function sendLook() {
  net.send('setAvatar', { avatar: lookJson() })
}

let poseT = 0
let penSigT = 0
let penSig = null
let lastPose = ''
let lastPoseAt = 0
function sendPresence(dt, t, arm) {
  if (!online || !net.net.online) return
  poseT += dt
  if (poseT >= 1 / REMOTE.poseHz) {
    poseT = 0
    const p = player.renderPosition
    const act = thrower.active ? (thrower.phase === 'enter' || thrower.phase === 'aim' ? 'aim' : '') : trainer.active ? 'train' : ''
    const msg = {
      x: Math.round(p.x * 100) / 100,
      y: Math.round(p.y * 100) / 100,
      z: Math.round(p.z * 100) / 100,
      yaw: Math.round(player.facing * 100) / 100,
      speed: Math.round(Math.hypot(player.velocity.x, player.velocity.z) * 10) / 10,
      grounded: player.grounded,
      vy: Math.round(player.velocity.y * 10) / 10,
      arm: arm == null ? null : Math.round(arm * 100) / 100,
      lean: Math.round(thrower.lean() * 100) / 100,
      act,
      food: state.S.food,
      carry: carried ? `${carried.b.def.id}:${carried.b.size}` : '',
      income: Math.round(state.income()),
    }
    // arm swings every frame while aiming: compare without it so a still player stays quiet.
    const key = JSON.stringify({ ...msg, arm: act === 'aim' ? 0 : msg.arm })
    const now = t
    if (key !== lastPose || now - lastPoseAt > 1) {
      lastPose = key
      lastPoseAt = now
      net.send('pose', msg)
    }
  }
  // Your base's baddies (placed ones only): a cheap signature twice a second.
  penSigT += dt
  if (penSigT >= 0.5) {
    penSigT = 0
    const sig = state.S.baddies.map((b) => `${b.id}:${b.size}:${b.v | 0}`).join(',')
    if (sig !== penSig) {
      penSig = sig
      net.send('pen', { list: state.S.baddies.map((b) => ({ id: b.id, size: b.size, v: b.v | 0 })) })
    }
  }
}

// --- Bloxity integrations ------------------------------------------------------------
// Friend boost: Bloxity friends who are in your room add income. Tap the badge to copy an invite link.
function countFriends() {
  const n = lastPlayers.filter((p) => !p.me && p.p?.uid && friendIds.has(p.p.uid)).length
  state.setFriends(n)
  hud.setFriendBoost(Math.round(100 * (ECONOMY.friendBoost * state.friends() + state.inviteBoostPct())))
  const hint = document.querySelector('.hud-friend small')
  if (hint) hint.textContent = `Invite friends: +${Math.round(ECONOMY.inviteBoost * 100)}% each (${Math.min(ECONOMY.inviteMax, state.invites())}/${ECONOMY.inviteMax})`
  refreshIncome()
}
async function refreshFriends() {
  friendIds = await bloxity.getFriendIds()
  countFriends()
}
if (online) {
  if (bloxity.sdk()) {
    void refreshFriends()
    setInterval(refreshFriends, 60000)
  }
  // Friend invite boost: a friend who joins from your link (new to the game) adds income for good.
  // The link carries your account id as ?ref=; the server credits you once per new friend.
  net.onInvites((n) => {
    state.setInvites(n)
    countFriends()
    sfx.arrive()
    hud.toast(`A friend joined from your invite! +${Math.round(ECONOMY.inviteBoost * 100)}% income`, 'rare')
  })
  countFriends()
  const badge = document.querySelector('.hud-friend')
  if (badge) {
    badge.style.pointerEvents = 'auto'
    badge.style.cursor = 'pointer'
    badge.addEventListener('pointerdown', async (e) => {
      e.preventDefault()
      const ref = net.myUid()
      if (!ref) return hud.toast('Sign in to Bloxity to invite friends and earn the boost.', 'warn')
      const link = bloxity.inviteLink(net.net.roomKey, ref)
      if (!link) return
      try {
        await navigator.clipboard.writeText(link)
        hud.toast('Invite link copied! Send it to a friend.', 'good')
      } catch {
        hud.toast(link, 'good')
      }
    })
  }
}
// Emotes: the portal's picker sends the id; it plays on your avatar and the others'.
let adPaused = false
void bloxity.loadEmotes()
function stopEmote() {
  if (!emoteP?.active) return
  emoteP.stop()
  net.send('emote', { id: '' })
}
bloxity.onEmote(async (id) => {
  if (!id) return stopEmote()
  if (thrower.active || trainer.active) return
  const catalogue = await bloxity.loadEmotes()
  const clip = catalogue?.get(id)
  if (!clip || !emoteP) return
  emoteP.play(clip, id)
  net.send('emote', { id })
})
// Rewarded ads (Free Gift button, boost chip) and the gameplay / panel banners.
const ads = createAds({ hud, sfx, fx, playerChest, onChange: refreshIncome, isBusy: () => thrower.active || trainer.active, isPaused: () => adPaused })
// Live events and rewards: the Hungry Giant at the lane end, the Rewards window (playtime gifts,
// Daily Reward, spin wheel) and the Events window + HUD event pills.
const celebrate = () => {
  fx.confetti(playerChest().clone().setY(player.renderPosition.y + 2.5), 50)
  fx.stars(playerChest(), '#ffd93b', 12)
}
boss = createBoss(world, { fx, sfx, hud, celebrate })
const rewards = createRewards({ hud, sfx, celebrate })
const eventsUi = createEventsUi({ hud, sfx, boss, celebrate })
state.on('index-reward', ({ area, title, cash }) => {
  hud.pop({ line1: `${AREAS[area].name} page complete!`, line2: `"${title}" +$${fmt(cash)}`, color: '#ffd93b' })
  celebrate()
})
// Chat bubbles over the speaker (yours here, the others' in remote.js).
let myBubble = null
bloxity.onChat((m) => {
  if (m.isLocalPlayer) {
    myBubble?.remove?.()
    myBubble = bloxity.attachChatBubble(THREE, playerGroup, bloxity.chatText(m))
  } else remote?.chat(m)
})
// Ad breaks: pause the world and mute until the break ends.
let mutedByAd = false
bloxity.onAdBreak((on) => {
  adPaused = on
  if (on && !isMuted()) {
    toggleMuted()
    mutedByAd = true
  } else if (!on && mutedByAd) {
    toggleMuted()
    mutedByAd = false
  }
})

// --- Input -----------------------------------------------------------------------
onModeChanged((mode) => {
  playerGroup.visible = mode !== 'player'
})
let nightTarget = 0
function dayNight() {
  lighting.toggleDayNight()
  nightTarget = nightTarget ? 0 : 1
  sfx.dayNight()
}
onKey('KeyV', toggleMode)
onKey('KeyN', dayNight)
onKey('KeyR', () => {
  respawn()
  sfx.respawn()
})
installTouch({ mode: toggleMode, day: dayNight, respawn })
renderer.domElement.addEventListener('pointerdown', (e) => {
  if (e.pointerType === 'mouse' && e.button === 0 && carried && !hud.isOpen() && !thrower.active) placeCarried()
})
window.addEventListener('keydown', (e) => {
  if ((e.code === 'KeyE' || e.code === 'KeyF') && !e.repeat && carried && !hud.isOpen() && !thrower.active) placeCarried()
})
{
  const cluster = document.querySelector('.touch-cluster')
  const b = document.createElement('button')
  b.type = 'button'
  b.className = 'touch-btn place'
  b.textContent = 'PLACE'
  b.addEventListener('pointerdown', (e) => {
    e.preventDefault()
    e.stopPropagation()
    placeCarried()
  })
  cluster?.appendChild(b)
}

// --- Leaderboards -------------------------------------------------------------------
const botColors = ['#ff7fb8', '#7fa8ff', '#ffd84a', '#7dff4a', '#c27dff', '#ff9a2e', '#59e6ff', '#ff5f5f', '#b0ffb0', '#ffffff', '#ffc4dd']
let serverBoards = null // { bestOdds, catches, income: [{ name, value }] } from the game server
const liveRows = [null, null, null]
async function refreshLiveBoards() {
  if (!bloxity.sdk()) return
  for (let i = 0; i < liveRows.length; i++) liveRows[i] = await bloxity.topScores(LEADERBOARDS[i].id)
  drawBoards()
}
function submitScores() {
  bloxity.submitScore(LEADERBOARDS[0].id, state.S.stats.bestOdds)
  bloxity.submitScore(LEADERBOARDS[1].id, state.S.stats.catches)
  bloxity.submitScore(LEADERBOARDS[2].id, state.income())
}
function drawBoards() {
  const me = { name: myPen.name, me: true, color: '#ffd84a' }
  const rows = (i, pick, fmtv, mine) => {
    // The server's real top lists (every saved player), then Bloxity's, then the offline stand-ins.
    const top = serverBoards?.[LEADERBOARDS[i].stat]
    if (top?.length) return top.slice(0, 10).map((r, k) => ({ name: r.name, me: r.name === myPen.name, color: r.name === myPen.name ? '#ffd84a' : botColors[k % botColors.length], v: r.value, value: fmtv(r.value) }))
    // Bloxity's real top list when the SDK answered, else the offline stand-ins.
    const live = liveRows[i]
    if (live) return live.slice(0, 10).map((r, k) => ({ name: r.name, me: r.me, color: r.me ? '#ffd84a' : botColors[k % botColors.length], v: r.score, value: fmtv(r.score) }))
    const list = BOARD_BOTS.map((r, i) => ({ name: r[0], v: pick(r), color: botColors[i % botColors.length] }))
    list.push({ ...me, v: mine })
    list.sort((a, b) => b.v - a.v)
    return list.slice(0, 10).map((r) => ({ ...r, value: fmtv(r.v) }))
  }
  boards.draw(0, rows(0, (r) => r[2], (v) => `1 in ${fmt(v)}`, state.S.stats.bestOdds))
  boards.draw(1, rows(1, (r) => r[1], (v) => fmt(v), state.S.stats.catches))
  boards.draw(2, rows(2, (r) => r[3], (v) => `$${fmt(v)}/s`, state.income()))
}
drawBoards()
// The server's top lists (they replay at once if they already arrived).
if (online) {
  net.onLeaderboard(({ boards }) => {
    serverBoards = boards
    drawBoards()
  })
}
document.fonts?.ready?.then(drawBoards)
setInterval(drawBoards, 60000)
setInterval(refreshLiveBoards, 60000)
setInterval(submitScores, 30000)
setTimeout(() => {
  submitScores()
  refreshLiveBoards()
}, 4000)

// --- Zones ---------------------------------------------------------------------------
// Walk into a ring: its window opens; walk out: it closes (if the ring opened it).
const zones = [
  { id: 'foodShop', x: POI.foodShop.x, z: POI.foodShop.z, r: POI.foodShop.r },
  { id: 'sell', x: POI.sell.x, z: POI.sell.z + 0.6, r: POI.sell.r },
  { id: 'fuse', x: POI.fuse.x, z: POI.fuse.z + 0.8, r: POI.fuse.r },
  { id: 'pen', x: myPen.signSpot.x, z: myPen.signSpot.z, r: 1.9 },
]
let inZone = null
function updateZones() {
  const p = player.renderPosition
  let hit = null
  for (const z of zones) if ((p.x - z.x) ** 2 + (p.z - z.z) ** 2 < z.r * z.r && p.y < 2) hit = z.id
  if (hit !== inZone) {
    if (inZone && hud.openProximity() === inZone) hud.close()
    inZone = hit
    if (hit) hud.show(hit, true)
  }
}

// The free chest. (The pen's pad is the Training Bench's upgrade pad: game/training.js.)
const income = () => state.income()
function updatePadAndChest(dt, t) {
  const p = player.renderPosition
  const ready = state.chestReady()
  chest.update(dt, t, ready)
  chest.setTimer(ready ? '' : clock((state.S.chestAt - Date.now()) / 1000))
  const c = POI.chest
  if (ready && (p.x - c.x) ** 2 + (p.z - c.z) ** 2 < c.r * c.r) {
    const got = state.claimChest()
    if (got) {
      chest.pop()
      sfx.chestOpen()
      const from = new Vector3(c.x, 1.6, c.z - 0.6)
      fx.coins(from, 30, playerChest, () => sfx.coin(Math.floor(Math.random() * 8)))
      fx.stars(from, '#ffd93b', 16)
      fx.sparkle(from, '#ffe680', 30, { speed: 6 })
      hud.toast(`Free reward: ${money(got)}!`, 'rare')
    }
  }
}

// --- Ambient effects -------------------------------------------------------------------
const treeSpots = hub.treeSpots
const lanePt = new Vector3()
function ambient(dt, t) {
  const p = player.renderPosition
  // Upgrade pad glitter (more when you can afford the next bench).
  const pp = myPen.padSpot
  const nb = state.benchNext()
  if (Math.random() < dt * (nb && state.S.money >= nb.price ? 10 : 2)) fx.motes(new Vector3(pp.x, 0.35, pp.z), '#ffe14a', 1, 1.4)
  if (state.chestReady() && Math.random() < dt * 8) fx.motes(new Vector3(POI.chest.x, 0.4, POI.chest.z - 0.6), '#ffd34f', 1, 1.6, { rise: 1.6 })
  // Pollen motes drifting round the player.
  if (Math.random() < dt * 5) {
    const a = Math.random() * Math.PI * 2
    const r = 4 + Math.random() * 14
    fx.particle('glow', { x: p.x + Math.cos(a) * r, y: 0.5 + Math.random() * 4, z: p.z + Math.sin(a) * r, vx: 0.3, vy: 0.15, vz: 0.1, color: { r: 1, g: 0.95, b: 0.6 }, size: 0.12, size1: 0.08, life: 4, alpha: 0.6, fadeIn: 1, sprite: 0 })
  }
  // Leaves falling from nearby trees.
  if (Math.random() < dt * 3) {
    const s = treeSpots[Math.floor(Math.random() * treeSpots.length)]
    if ((s[0] - p.x) ** 2 + (s[2] - p.z) ** 2 < 70 * 70) fx.leaf({ x: s[0] + (Math.random() - 0.5) * 5, y: s[1] + 6, z: s[2] + (Math.random() - 0.5) * 5 })
  }
  // The lane air: each area's particles (petals, wheat, fireflies, sand, snow, leaves, gems,
  // sunset sparks, bubbles, feathers, embers, stars) drift round the camera while it is over
  // the lane, a little ahead of it so a throw flies into them.
  const cz = camera.position.z
  if (cz < HUB.lane.throwLine + 6) {
    const L = HUB.lane
    for (let i = 0, k = Math.random() < dt * 30 ? 2 : 0; i < k; i++) {
      const z = cz - 4 - Math.random() * 40
      const zone = zoneAt(Math.min(L.throwLine - 0.5, Math.max(L.end + 2, z)))
      if (!zone) continue
      const falls = zone.fx === 'snow' || zone.fx === 'feathers' || zone.fx === 'leaves' || zone.fx === 'petals' || zone.fx === 'wheat'
      lanePt.set((Math.random() - 0.5) * L.halfWidth * 2, L.floorY + (falls ? 5 + Math.random() * 7 : 0.4 + Math.random() * 6), z)
      fx.themed(zone.fx, lanePt, zone.fxColors)
    }
  }
  // Fuse machine idle puffs.
  if (Math.random() < dt * 0.8) fx.puff(new Vector3(POI.fuse.x + 0.9, 4.0, POI.fuse.z - 2.3), '#dfefff', 1, { size: 0.4, spread: 0.2, up: 1.4, alpha: 0.4 })
}

// --- Footsteps, jump, land ---------------------------------------------------------------
let stepDist = 0
let wasGrounded = true
let fallSpeed = 0
const lastPos = new Vector3()
function body(dt) {
  const p = player.renderPosition
  const moved = Math.hypot(p.x - lastPos.x, p.z - lastPos.z)
  lastPos.set(p.x, p.y, p.z)
  const speed = Math.hypot(player.velocity.x, player.velocity.z)
  if (player.grounded && speed > 1 && moved < 2) {
    stepDist += moved
    if (stepDist > AUDIO.stepEvery * (speed > 10 ? 1.25 : 1)) {
      stepDist = 0
      sfx.step(Math.min(1, speed / 14))
      if (speed > 9) fx.puff(new Vector3(p.x, 0.1, p.z), '#e8f5d0', 2, { size: 0.35, spread: 0.6, up: 0.4, life: 0.6, alpha: 0.5 })
    }
  }
  if (!player.grounded) fallSpeed = Math.min(fallSpeed, player.velocity.y)
  if (wasGrounded && !player.grounded && player.velocity.y > 2) sfx.jump()
  if (!wasGrounded && player.grounded) {
    const k = Math.min(1, -fallSpeed / 14)
    if (k > 0.2) {
      sfx.land(k)
      fx.puff(new Vector3(p.x, 0.1, p.z), '#e8f5d0', Math.round(4 + k * 6), { size: 0.5, spread: 1.6, up: 0.4, life: 0.7, alpha: 0.55 })
    }
    fallSpeed = 0
  }
  wasGrounded = player.grounded
}

// Where the guide chevrons lead for the quest on the banner.
const laneMouth = { x: THROW_MODE.spot.x, z: THROW_MODE.spot.z }
function questTarget() {
  if (carried && !markerValid) return { x: myPen.cx, z: myPen.cz }
  const q = state.currentQuest()
  if (!q) return null
  if (q.id.startsWith('food')) return POI.foodShop
  const g = q.goal?.type
  if (q.id === 'bench1' || g === 'bench') return trainer.active ? null : myPen.padSpot
  if (q.id === 'train1' || g === 'level') return trainer.active ? null : TRAINING.spot
  if (q.id === 'pen1') return myPen.signSpot
  if (q.id === 'fuse1' || g === 'size') return state.fusable().length ? { x: POI.fuse.x, z: POI.fuse.z + 0.8 } : laneMouth
  if (g === 'food') return POI.foodShop
  if (thrower.active || thrower.onBand(player.renderPosition)) return null // already throwing
  return laneMouth
}

// --- Loop -------------------------------------------------------------------
const clock3 = new Clock()
let shownLoading = true
let readySince = 0
let incomeT = 0
let liveT = 0 // quest-goal checks, twice a second
let night = 0
const q = new Quaternion()

renderer.setAnimationLoop(() => {
  const dt = adPaused ? (clock3.getDelta(), 0) : Math.min(clock3.getDelta(), 0.1)
  const t = clock3.elapsedTime

  stepPhysics(dt)
  interpolatePlayer()

  const p = player.renderPosition
  playerGroup.position.set(p.x, p.y, p.z)
  playerGroup.rotation.y = player.facing
  animator?.update(dt, {
    grounded: player.grounded,
    speed: Math.hypot(player.velocity.x, player.velocity.z),
    verticalVelocity: player.velocity.y,
    turn: 0,
  })
  // An emote plays until the player moves, jumps, throws or trains.
  if (emoteP?.active) {
    if (Math.hypot(player.velocity.x, player.velocity.z) > 1.5 || !player.grounded || thrower.active || trainer.active) stopEmote()
    else emoteP.apply(dt)
  }
  const emoting = !!emoteP?.active
  const arm = thrower.armAngle(t) ?? (carried ? -1.35 : null)
  if (armBinding && arm != null && !emoting) {
    q.setFromAxisAngle(armBinding.axisX, arm)
    armBinding.bone.quaternion.premultiply(q)
  }
  if (armLBinding && carried && !emoting) {
    q.setFromAxisAngle(armLBinding.axisX, -1.35)
    armLBinding.bone.quaternion.premultiply(q)
  }
  updateCarry(dt, t)
  playerGroup.rotation.x = thrower.lean()
  trainer.update(dt, t)
  trainer.applyPose(animator?.rig, playerGroup)
  sendPresence(dt, t, arm)

  // Economy: income every second, the pad fills continuously.
  incomeT += dt
  if (incomeT >= 1) {
    incomeT -= 1
    const inc = state.income()
    if (inc > 0) {
      state.addMoney(inc, 'income')
      hud.setMoney(state.S.money, inc)
    }
  }

  thrower.update(dt, t)
  const wdt = dt * thrower.timeScale // slow motion / hit-stop for the world effects
  band.update(t, dt, thrower.onBand(p), thrower.active)
  remote?.update(dt, t)
  ads.update()
  for (const pen of pens) pen.update(dt, t, p, fx, Math.abs(pen.cx - p.x) < 45 && Math.abs(pen.cz - p.z) < 60)
  updateZones()
  updatePadAndChest(dt, t)
  ambient(dt, t)
  body(dt)
  fuseMachine.update(dt, t)
  boards.update(dt, t)
  laneDeco.update(t, p, questTarget())
  hub.update(dt)
  fx.update(wdt)

  hud.setQuest(state.questView())
  liveT += dt
  if (liveT >= 0.5) {
    liveT = 0
    state.checkQuests()
  }
  boss.update(dt)
  rewards.update(dt)
  eventsUi.update(dt)
  const touchUi = document.body.classList.contains('touch-ui')
  hud.setHint(
    carried && !hud.isOpen()
      ? markerValid
        ? `${touchUi ? 'Tap PLACE' : 'Click'} to place ${carried.b.def.name}`
        : `Walk into your pen to place ${carried.b.def.name}`
      : !thrower.active && p.z < HUB.minZ + 14 && !hud.isOpen()
        ? 'Step onto the yellow band to throw!'
        : '',
  )
  hud.frame(dt)

  night += ((nightTarget ? 1 : 0) - night) * Math.min(1, dt * 0.5)
  updateAudio(dt, night)

  updateCamera(camera, dt)
  director.apply(camera, dt)
  lighting.update(dt, playerGroup.position)
  postfx.render()

  if (shownLoading) {
    readySince += dt
    if (avatarReady || readySince > 5) {
      shownLoading = false
      bloxity.notifyFirstFrame()
    }
  }
})

window.addEventListener('beforeunload', () => {
  state.save()
  net.disconnect()
  bloxity.teardown()
})

if (import.meta.env.DEV) {
  const teleport = (x, y, z, facing = player.facing) => {
    resetPlayer({ x, y, z }, facing)
    syncYawToPlayer()
  }
  window.__game = { net, remote, ads, player, scene, renderer, camera, postfx, bodies: bodyCount, toggleMode, teleport, state, hud, fx, pens, thrower, director, trainer, trainStation, hotbar, placeCarried, carry: () => carried, updateCarry, give: (n) => state.addMoney(n, 'dev') }
}
