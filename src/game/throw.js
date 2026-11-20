// The throw sequence. Step onto the yellow band at the lane mouth and the game takes over
// the camera for a short cinematic loop (THROW_MODE in config.js):
//   enter   - you glide to the throw spot, the camera swings in behind your shoulder
//   aim     - a power meter sweeps up and down; tap (click / Space / F / E / touch) to stop it
//   windup  - the grade pops (PERFECT! ... WEAK), the arm cocks back, the camera leans in
//   flight  - a FOV punch and the camera chases the food down the lane: speed lines, wind,
//             streaks; the LUCK counter climbs with every metre and each rarity zone
//             slams its name on screen; the last moments play in slow motion
//   impact  - hit-stop, shockwave, splat, shake, bounces, then a slow orbit of the food
//   (landed) - no prompt: after a beat the sequence moves straight on
//   meet    - first person through a baddie's eyes: it rises from behind the nearest bush,
//             spots the food, walks in (head bob, sway, footsteps) and eats it bite by bite
//   reveal  - close-up with a rotating sunburst; its name types out, then the rarity card
//   catch   - hearts, a beam, it rockets off to your pen (or shrugs off if the hotbar is full)
//   return  - a wipe back to the aim shot for the next throw
// Exit (or Esc / Q) leaves from the aim phase. Auto plays the loop by itself.
import { AdditiveBlending, BoxGeometry, BufferAttribute, BufferGeometry, CanvasTexture, CircleGeometry, Color, DoubleSide, DynamicDrawUsage, Group, InstancedMesh, Mesh, MeshBasicMaterial, Object3D, PlaneGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three'
import { EVENTS, HUB, RARITIES, SEASON, STREAK, THROW, THROW_MODE as TM, VARIANTS } from '../config.js'
import * as events from './events.js'
import { laneCover } from '../hub/world.js'
import { Baddie } from './baddieModel.js'
import { FOOD_BY_ID, foodColors as paletteOf, foodMesh, foodRarity } from './foods.js'
import { zoneAt } from './lane.js'
import * as state from './state.js'

const STREAKS = 56
const L = HUB.lane
const FY = L.floorY // the lane floor sits this far below the hub
const rnd = (a, b) => a + Math.random() * (b - a)
const smooth = (k) => k * k * (3 - 2 * k)
const easeOutBack = (k) => 1 + 2.4 * Math.pow(k - 1, 3) + 1.4 * Math.pow(k - 1, 2)

// --- Small canvas textures ----------------------------------------------------------------
function canvasTex(size, draw) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  draw(c.getContext('2d'), size)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}
// Sunburst behind the revealed baddie: soft alternating rays fading out from the centre.
const sunTex = () =>
  canvasTex(256, (x, s) => {
    const c = s / 2
    const rays = 18
    for (let i = 0; i < rays; i++) {
      const a0 = (i / rays) * Math.PI * 2
      const a1 = a0 + (Math.PI / rays) * 0.9
      const g = x.createRadialGradient(c, c, 0, c, c, c)
      g.addColorStop(0, 'rgba(255,255,255,0.9)')
      g.addColorStop(0.5, 'rgba(255,255,255,0.35)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.beginPath()
      x.moveTo(c, c)
      x.arc(c, c, c, a0, a1)
      x.closePath()
      x.fill()
    }
    const core = x.createRadialGradient(c, c, 0, c, c, c * 0.45)
    core.addColorStop(0, 'rgba(255,255,255,1)')
    core.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = core
    x.fillRect(0, 0, s, s)
  })
// Food splat decal: a lumpy blob with droplets around it.
const splatTex = () =>
  canvasTex(256, (x, s) => {
    const c = s / 2
    x.fillStyle = '#fff'
    x.beginPath()
    for (let i = 0; i <= 40; i++) {
      const a = (i / 40) * Math.PI * 2
      const r = c * (0.42 + 0.12 * Math.sin(a * 5 + 1) + 0.06 * Math.sin(a * 11))
      x.lineTo(c + Math.cos(a) * r, c + Math.sin(a) * r)
    }
    x.fill()
    for (let i = 0; i < 14; i++) {
      const a = Math.random() * Math.PI * 2
      const r = c * (0.62 + Math.random() * 0.3)
      x.beginPath()
      x.arc(c + Math.cos(a) * r, c + Math.sin(a) * r, 4 + Math.random() * 10, 0, Math.PI * 2)
      x.fill()
    }
  })

// Soft glow disc (the rarity aura around the held / flying food).
const glowTex = () =>
  canvasTex(128, (x, s) => {
    const g = x.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.25, 'rgba(255,255,255,0.55)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.fillRect(0, 0, s, s)
  })
// Ribbon cross-section: bright core, soft edges (u across the strip).
const ribbonTex = () =>
  canvasTex(64, (x, s) => {
    const g = x.createLinearGradient(0, 0, s, 0)
    g.addColorStop(0, '#000')
    g.addColorStop(0.35, '#888')
    g.addColorStop(0.5, '#fff')
    g.addColorStop(0.65, '#888')
    g.addColorStop(1, '#000')
    x.fillStyle = g
    x.fillRect(0, 0, s, s)
  })
const RIB = 20 // ribbon trail points (one per frame: about a third of a second of flight)

export function createThrower(scene, { fx, sfx, player, camera, director, ui, onCaught, onThrow, toast, place, freeze, syncYaw, canEnter, income, toBase }) {
  // --- Scene pieces ---
  const sun = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: sunTex(), transparent: true, opacity: 0, depthWrite: false, blending: AdditiveBlending, fog: false }))
  sun.renderOrder = 1
  sun.visible = false
  scene.add(sun)
  const splat = new Mesh(new CircleGeometry(1, 24).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: splatTex(), transparent: true, opacity: 0, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
  splat.visible = false
  splat.renderOrder = 2
  scene.add(splat)
  // Wind streaks the chase camera rushes past: thin additive bars (black = invisible).
  const streakMesh = new InstancedMesh(new BoxGeometry(0.035, 0.035, 1), new MeshBasicMaterial({ color: '#ffffff', blending: AdditiveBlending, transparent: true, depthWrite: false, fog: false }), STREAKS)
  streakMesh.instanceMatrix.setUsage(DynamicDrawUsage)
  streakMesh.frustumCulled = false
  streakMesh.renderOrder = 4
  scene.add(streakMesh)
  const streaks = Array.from({ length: STREAKS }, () => ({ on: false, p: new Vector3(), len: 1, life: 0, max: 1 }))
  const dummy = new Object3D()
  const black = new Color(0, 0, 0)
  const sc = new Color()
  for (let i = 0; i < STREAKS; i++) {
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    streakMesh.setMatrixAt(i, dummy.matrix)
    streakMesh.setColorAt(i, black)
  }
  let streakCursor = 0

  // Ribbon trail behind the flying food: a camera-facing strip through its recent positions
  // in the food's rarity glow (a cycling rainbow for Celestial), tapering and fading out.
  const ribPts = Array.from({ length: RIB }, () => new Vector3())
  let ribCount = 0
  let ribFade = 0
  const ribPos = new Float32Array(RIB * 6)
  const ribCol = new Float32Array(RIB * 6)
  const ribUv = new Float32Array(RIB * 4)
  const ribIdx = []
  for (let i = 0; i < RIB; i++) {
    ribUv.set([0, i / (RIB - 1), 1, i / (RIB - 1)], i * 4)
    if (i < RIB - 1) ribIdx.push(i * 2, i * 2 + 1, i * 2 + 2, i * 2 + 1, i * 2 + 3, i * 2 + 2)
  }
  const ribGeo = new BufferGeometry()
  ribGeo.setAttribute('position', new BufferAttribute(ribPos, 3).setUsage(DynamicDrawUsage))
  ribGeo.setAttribute('color', new BufferAttribute(ribCol, 3).setUsage(DynamicDrawUsage))
  ribGeo.setAttribute('uv', new BufferAttribute(ribUv, 2))
  ribGeo.setIndex(ribIdx)
  const ribbon = new Mesh(ribGeo, new MeshBasicMaterial({ map: ribbonTex(), vertexColors: true, transparent: true, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }))
  ribbon.frustumCulled = false
  ribbon.renderOrder = 3
  ribbon.visible = false
  scene.add(ribbon)
  // Aura: a pulsing additive glow around the food for Rare and up.
  const aura = new Sprite(new SpriteMaterial({ map: glowTex(), color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, fog: false }))
  aura.visible = false
  aura.renderOrder = 3
  scene.add(aura)
  const rv1 = new Vector3()
  const rv2 = new Vector3()
  const rv3 = new Vector3()
  const rc = new Color()
  const RC_A = new Color()
  const RC_B = new Color()
  // Trail / aura colour at k (0 head .. 1 tail) for the held food's rarity.
  function rarityColor(k, t, out) {
    const r = heldR
    if (r.rainbow) return out.setHSL((t * 0.5 + k * 1.3) % 1, 1, 0.62)
    if (r.key === 'exotic') return out.copy(RC_A.set('#ffd84a')).lerp(RC_B.set('#7ffcff'), 0.5 + 0.5 * Math.sin(k * 9 - t * 6))
    if (r.key === 'cosmic') return out.copy(RC_A.set('#b07dff')).lerp(RC_B.set('#4fc8ff'), k)
    if (r.key === 'special') return out.copy(RC_A.set('#ffe060')).lerp(RC_B.set('#c07dff'), k)
    return out.set(r.glow)
  }
  function ribbonStart(p) {
    ribCount = 0
    ribFade = 1
    ribbon.visible = true
    ribbonPush(p)
  }
  function ribbonPush(p) {
    for (let i = Math.min(ribCount, RIB - 1); i > 0; i--) ribPts[i].copy(ribPts[i - 1])
    ribPts[0].copy(p)
    ribCount = Math.min(RIB, ribCount + 1)
  }
  function ribbonUpdate(rdt, t) {
    if (!ribbon.visible) return
    if (phase !== 'flight') {
      ribFade -= rdt * 1.5
      if (ribFade <= 0) {
        ribbon.visible = false
        return
      }
    }
    const width = 0.1 + heldR.fx * 0.016
    const bright = heldR.fx === 0 ? 0.45 : 0.9
    for (let i = 0; i < RIB; i++) {
      const p = ribPts[Math.min(i, ribCount - 1)]
      const q = ribPts[Math.min(i + 1, ribCount - 1)]
      rv1.copy(p).sub(q)
      if (rv1.lengthSq() < 1e-8) rv1.set(0, 0, 1)
      rv2.copy(camera.position).sub(p)
      rv3.crossVectors(rv1, rv2).normalize()
      const k = i / (RIB - 1)
      const w = i < ribCount ? width * (1 - k * 0.85) : 0
      ribPos[i * 6] = p.x + rv3.x * w
      ribPos[i * 6 + 1] = p.y + rv3.y * w
      ribPos[i * 6 + 2] = p.z + rv3.z * w
      ribPos[i * 6 + 3] = p.x - rv3.x * w
      ribPos[i * 6 + 4] = p.y - rv3.y * w
      ribPos[i * 6 + 5] = p.z - rv3.z * w
      // Fade where the strip passes close to the chase camera, so it never fills the screen.
      const near = Math.min(1, Math.max(0, (rv2.length() - 2.5) / 4))
      rarityColor(k, t, rc).multiplyScalar(Math.pow(1 - k, 1.3) * ribFade * bright * near)
      ribCol[i * 6] = ribCol[i * 6 + 3] = rc.r
      ribCol[i * 6 + 1] = ribCol[i * 6 + 4] = rc.g
      ribCol[i * 6 + 2] = ribCol[i * 6 + 5] = rc.b
    }
    ribGeo.attributes.position.needsUpdate = true
    ribGeo.attributes.color.needsUpdate = true
  }
  // The aura and ambient rarity particles around the food while you hold it or it flies.
  function auraUpdate(rdt, t, on) {
    const r = heldR
    aura.visible = on && !!held?.visible && r.fx >= 2
    if (!aura.visible) return
    aura.position.copy(held.position)
    const pulse = 1 + Math.sin(t * 5) * 0.12
    aura.scale.setScalar((0.95 + r.fx * 0.05) * pulse * held.scale.x)
    rarityColor(0, t, aura.material.color)
    aura.material.opacity = (0.14 + r.fx * 0.026) * (phase === 'flight' ? 0.55 : 1)
    if (Math.random() < rdt * (1 + r.fx * 2.2)) fx.sparkle(held.position, '#' + rarityColor(Math.random(), t, rc).getHexString(), 1, { speed: 1.4, up: 0.6, size: 0.22 + r.fx * 0.02, life: 0.6 })
    if (r.key === 'secret' && Math.random() < rdt * 6) fx.puff(held.position, '#20202a', 1, { size: 0.5, spread: 0.5, up: 0.6, life: 0.8, alpha: 0.5 })
    if ((r.key === 'cosmic' || r.key === 'special' || r.key === 'exotic') && Math.random() < rdt * 5) fx.stars(held.position, '#ffffff', 1, 1.5)
  }
  // Squash and stretch on landings: s jumps to amp, then wobbles out.
  let squashT = 9
  let squashAmp = 0
  function squash(amp) {
    squashT = 0
    squashAmp = amp
  }
  function applySquash(base, rdt) {
    squashT += rdt
    const s = squashAmp * Math.exp(-squashT * 7) * Math.cos(squashT * 24)
    held.scale.set(base * (1 + 0.32 * s), base * (1 - 0.42 * s), base * (1 + 0.32 * s))
  }
  function spawnStreak(at) {
    const s = streaks[streakCursor]
    streakCursor = (streakCursor + 1) % STREAKS
    s.on = true
    s.p.copy(at)
    s.len = rnd(3, 9)
    s.life = 0
    s.max = rnd(0.35, 0.6)
  }
  function updateStreaks(dt) {
    for (let i = 0; i < STREAKS; i++) {
      const s = streaks[i]
      if (!s.on) continue
      s.life += dt
      if (s.life >= s.max) {
        s.on = false
        dummy.scale.setScalar(0)
        dummy.updateMatrix()
        streakMesh.setMatrixAt(i, dummy.matrix)
        streakMesh.setColorAt(i, black)
        continue
      }
      const k = s.life / s.max
      dummy.position.copy(s.p)
      dummy.rotation.set(0, 0, 0)
      dummy.scale.set(1, 1, s.len)
      dummy.updateMatrix()
      streakMesh.setMatrixAt(i, dummy.matrix)
      const a = Math.sin(k * Math.PI) * 0.9
      streakMesh.setColorAt(i, sc.setRGB(a, a, a))
    }
    streakMesh.instanceMatrix.needsUpdate = true
    if (streakMesh.instanceColor) streakMesh.instanceColor.needsUpdate = true
  }

  // --- State ---
  let phase = 'off'
  let pt = 0 // s in this phase (scaled time)
  let armed = true // must step off the band before it can catch you again
  let auto = false
  let lucky = false // the Lucky Throw is armed for the next throw
  let luckyUsed = false
  let meter = 0
  let meterDir = 1
  let autoStop = 0.9
  let power = 0
  let grade = TM.grades[2]
  let gradeIdx = 2
  let ts = 1 // time scale (slow motion)
  let hitStop = 0
  let swing = 0 // arm follow-through after the release, 1 -> 0
  let lean = 0
  let wind = null
  let held = null // the food (held, then flying, then resting): position + squash, no rotation
  let spin = null // its model inside held (tumbles)
  let heldId = ''
  let heldDef = FOOD_BY_ID[state.S.food]
  let heldR = foodRarity(state.S.food)
  const from = new Vector3()
  const to = new Vector3()
  const vel = new Vector3()
  const prevPos = new Vector3()
  let flightDur = 1
  let peak = 3
  let slowed = false
  let luckBase = 1
  let streak = 0 // PERFECTs in a row (STREAK)
  const streakMult = () => 1 + STREAK.step * Math.min(STREAK.max, streak)
  let throwDist = 0 // metres from the throw spot to where the food lands
  let luckNow = 1
  let luckShown = 1
  let zoneIdx = -1
  let bounces = 0
  let settled = false
  let orbit = 0
  let enterFrom = { x: 0, z: 0, facing: 0 }
  // Meet / reveal.
  let bad = null // { b, def, cover, home, sub, t, isNew, full }
  const flyers = [] // caught baddies on their way to the pen
  const leavers = [] // full pen: baddies walking back into cover
  let canContinue = false
  let autoT = 0
  let luckyPrice = 0
  let uiT = 0

  const spot = new Vector3(TM.spot.x, 0, TM.spot.z)
  // 0 on landscape screens, up to 1 on tall phone screens: shots back off and centre up.
  const narrow = () => Math.max(0, Math.min(1, (1.25 - camera.aspect) / 0.7))
  const tmpA = new Vector3()
  const tmpB = new Vector3()
  const tmpC = new Vector3()

  function onBand(p) {
    const B = TM.band
    return Math.abs(p.x) < B.halfWidth && p.z < B.south && p.z > B.north && p.y < 2
  }
  function priceNow() {
    const raw = Math.max(TM.lucky.minPrice, income() * TM.lucky.incomeSeconds)
    const step = Math.pow(10, Math.floor(Math.log10(raw)) - 1)
    return Math.ceil(raw / step) * step
  }
  function refreshLucky() {
    luckyPrice = priceNow()
    const free = state.S.luckyCredits > 0 // earned from a rewarded ad
    ui.setLucky({ price: luckyPrice, armed: lucky, afford: free || state.S.money >= luckyPrice, free, mult: TM.lucky.mult })
  }
  function setPhase(name) {
    phase = name
    pt = 0
    ui.setPhase(name)
    ui.canExit(name === 'aim')
  }
  function ensureHeld() {
    if (!held) {
      held = new Group()
      scene.add(held)
    }
    if (heldId !== state.S.food) {
      spin?.removeFromParent()
      spin = foodMesh(state.S.food)
      held.add(spin)
      heldId = state.S.food
      heldDef = FOOD_BY_ID[heldId]
      heldR = foodRarity(heldId)
    }
    held.visible = true
    held.scale.setScalar(1)
    held.rotation.set(0, 0, 0) // a girl turned it to face her while eating
    spin.rotation.set(0, 0, 0)
  }
  const hand = (out) => {
    const p = player.renderPosition
    return out.set(p.x + 0.62, p.y + 2.45 + Math.sin(performance.now() / 260) * 0.06, p.z + 0.05)
  }
  const foodColors = () => paletteOf(heldId)

  // --- Shots ---
  function aimShot(stiff = 4, push = 0) {
    const c = TM.cam.aim
    const p = player.renderPosition
    const n = narrow()
    tmpA.set(spot.x + c.side * (1 - n * 0.75), p.y + c.up + n * 1.2 - push * 0.3, spot.z + c.back * (1 + n * 0.35) - push)
    tmpB.set(spot.x + c.side * 0.3 * (1 - n), p.y + c.lookUp, spot.z - c.lookAhead)
    director.setShot(tmpA, tmpB, c.fov + n * 8 - push * 4, { stiff })
  }

  // --- Enter / exit ---
  function enter() {
    if (phase !== 'off') return
    const p = player.renderPosition
    enterFrom = { x: p.x, z: p.z, facing: player.facing }
    freeze(true)
    syncYaw()
    document.body.classList.add('throw-mode')
    if (document.pointerLockElement) document.exitPointerLock?.()
    setPhase('enter')
    ui.letterbox(false)
    ui.vignette('#000', 0.35)
    ui.setGain(THROW.strengthPerThrow)
    ui.setAuto(auto)
    refreshLucky()
    aimShot(3)
    director.engage(true, 1.8)
    sfx.bandEnter()
    fx.ring(new Vector3(spot.x, 0.06, spot.z), '#ffe23a', { r0: 0.5, r1: 4, life: 0.6 })
    fx.motes(new Vector3(spot.x, 0.1, spot.z), '#ffe23a', 18, 1.6, { rise: 2.4 })
    ensureHeld()
    held.scale.setScalar(0.01)
    sfx.foodAppear?.(heldR.fx)
  }
  function exit() {
    if (phase !== 'aim') return
    finishExit()
  }
  function finishExit() {
    phase = 'off'
    ui.hide()
    ui.vignette('#000', 0)
    director.engage(false, 2.2)
    freeze(false)
    armed = false
    document.body.classList.remove('throw-mode')
    if (held) held.visible = false
    aura.visible = false
    sfx.bandExit()
  }

  // --- Aim -> windup -> launch ---
  function lockIn() {
    power = meter
    gradeIdx = TM.grades.findIndex((g) => power >= g.min)
    grade = TM.grades[gradeIdx]
    ui.grade(grade.name, grade.color)
    sfx.lockIn(gradeIdx)
    director.kick(-4)
    // PERFECT streak: PERFECT adds one, GREAT keeps it, GOOD / WEAK ends it.
    if (gradeIdx === 0) streak++
    else if (gradeIdx >= 2) streak = 0
    state.noteStreak(streak)
    ui.setStreak(streak, streakMult())
    if (gradeIdx === 0) {
      fx.sparkle(hand(tmpA), '#bfff6a', 26, { speed: 5 })
      fx.stars(tmpA, '#ffe14a', 8, 4)
      ui.flash('#c8ff6a', 0.25, 0.3)
    }
    luckyUsed = lucky
    lucky = false
    setPhase('windup')
    sfx.windup()
  }
  function launch() {
    const p = player.renderPosition
    hand(from)
    const want = Math.max(8, state.range() * (TM.minPower + (1 - TM.minPower) * power))
    const z = Math.min(L.throwLine - 5, Math.max(L.end + 3, spot.z - want))
    to.set(Math.max(-L.halfWidth + 2.5, Math.min(L.halfWidth - 2.5, spot.x + rnd(-1.8, 1.8))), FY + 0.42, z)
    const dist = Math.abs(to.z - from.z)
    const f = THROW.flightTime
    flightDur = f[0] + (f[1] - f[0]) * Math.min(1, dist / THROW.maxRange)
    peak = 2.5 + Math.min(18, dist * 0.09)
    luckBase = state.luck() * grade.luck * streakMult() * (luckyUsed ? TM.lucky.mult : 1)
    luckNow = luckShown = luckBase
    throwDist = Math.abs(spot.z - z)
    zoneIdx = -1
    slowed = false
    settled = false
    bounces = 0
    ts = 1
    prevPos.copy(from)
    held.scale.setScalar(1.35)
    swing = 1
    lean = -0.25
    state.S.stats.throws++
    state.addStrength(THROW.strengthPerThrow)
    // The other players replay the flight (remote.js): same arc, food, trail and landing burst.
    onThrow?.({ food: state.S.food, from: { x: from.x, y: from.y, z: from.z }, to: { x: to.x, y: to.y, z: to.z }, dur: flightDur, peak, power, lucky: luckyUsed })
    sfx.launch(power)
    sfx.foodLaunch?.(heldR.fx)
    ribbonStart(from)
    if (heldR.fx >= 1) fx.sparkle(from, heldR.glow, 8 + heldR.fx * 3, { speed: 6, size: 0.35 })
    if (heldR.fx >= 4) fx.ring(new Vector3(p.x, 0.07, p.z), heldR.glow, { r0: 0.6, r1: 6 + heldR.fx * 0.5, life: 0.55 })
    wind?.stop()
    wind = sfx.windLoop()
    director.kick(16)
    director.shake(0.32 + power * 0.15)
    ui.flash('#ffffff', 0.32, 0.25)
    ui.vignette('#000', 0.25)
    ui.setLuck(luckNow)
    ui.zone('', '#fff')
    fx.puff(from, '#ffffff', 10, { size: 0.6, spread: 2.2, up: 0.6, life: 0.6 })
    fx.sparkle(from, '#fff6c0', 20, { speed: 6 })
    fx.ring(new Vector3(p.x, 0.06, p.z), '#ffffff', { r0: 0.5, r1: 5, life: 0.45 })
    fx.puff(new Vector3(p.x, 0.1, p.z), '#f4ffe0', 8, { size: 0.6, spread: 2.4, up: 0.3, life: 0.6, alpha: 0.5 })
    setPhase('flight')
  }

  // --- Landing ---
  function impact() {
    const zone = zoneAt(held.position.z)
    const zc = zone?.color ?? '#ffffff'
    held.position.y = FY + 0.42
    hitStop = TM.hitStop
    ts = 1
    wind?.stop(0.05)
    wind = null
    sfx.impact(0.6 + power * 0.4)
    sfx.foodImpact?.(heldDef.kind, 0.6 + power * 0.4, heldR.fx)
    director.shake(0.5 + power * 0.2)
    director.kick(-8)
    ui.flash('#ffffff', 0.55, 0.35)
    ui.setSpeed(0)
    ui.vignette('#000', 0.3)
    const at = tmpA.set(held.position.x, FY + 0.15, held.position.z)
    fx.ring(at, zc, { r0: 0.5, r1: 8, life: 0.7 })
    fx.ring(at, '#ffffff', { r0: 0.3, r1: 4.5, life: 0.45 })
    fx.puff(at, '#fff8e8', 16, { size: 1, spread: 4, up: 1.4, life: 1.1, alpha: 0.6 })
    fx.crumbs(at, foodColors(), 34)
    fx.chunks(tmpB.set(held.position.x, FY + 0.45, held.position.z), foodColors(), 26 + heldR.fx * 3, { power: 0.75 + power * 0.45, floor: FY + 0.02 })
    impactFx(at)
    squash(1)
    fx.sparkle(at, zc, 30, { speed: 7, up: 3 })
    fx.stars(at, '#ffe14a', 8, 5)
    splat.visible = true
    splat.position.set(held.position.x, FY + 0.035, held.position.z)
    splat.scale.setScalar(0.4)
    splat.material.color.set(foodColors()[0])
    splat.material.opacity = 0.85
    splat.userData.t = 0
    vel.set(rnd(-0.6, 0.6), 5.5 + power * 3, -(5 + power * 7))
    setPhase('impact')
    orbit = 0
  }

  // Rarity extras on touchdown: the rarer the food, the bigger the show.
  function impactFx(at) {
    const r = heldR
    if (r.fx >= 2) fx.ring(at, r.glow, { r0: 0.6, r1: 6 + r.fx, life: 0.8 })
    // One slim light beam (the landing camera sits close, so wide beams would white out).
    if (r.fx >= 4 && r.key !== 'divine' && r.key !== 'exotic') fx.beam(at, r.glow, { radius: 0.45 + r.fx * 0.035, height: 10 + r.fx * 2, life: 1.3 })
    if (r.fx >= 5) fx.stars(at, r.glow, 6 + r.fx, 6)
    if (r.rainbow) for (const c of ['#ff5a5a', '#ffd84a', '#5aff8a', '#5ac8ff', '#c07dff']) fx.sparkle(at, c, 8, { speed: 8, up: 4 })
    if (r.key === 'cosmic' || r.key === 'special') {
      fx.sparkle(at, '#ffffff', 22, { speed: 9, up: 5, size: 0.5 })
      fx.ring(at, '#4fc8ff', { r0: 1, r1: 12, life: 1 })
    }
    if (r.key === 'divine') {
      fx.beam(at, '#fff6d0', { radius: 0.6, height: 26, life: 1.6 })
      fx.motes(at, '#fff0b0', 30, 2.5, { rise: 3, size: 0.3, life: 1.6 })
      fx.ring(at, '#ffd6f0', { r0: 2, r1: 9, life: 1.2 })
    }
    if (r.key === 'secret') {
      fx.puff(at, '#22222a', 14, { size: 1.2, spread: 3.5, up: 1.5, life: 1.4, alpha: 0.7 })
      fx.sparkle(at, '#ffffff', 30, { speed: 10, up: 4 })
    }
    if (r.key === 'exotic') {
      fx.beam(at, '#ffd84a', { radius: 0.55, height: 26, life: 1.6 })
      fx.ring(at, '#7ffcff', { r0: 1, r1: 14, life: 1.1 })
      fx.stars(at, '#7ffcff', 12, 8)
      fx.confetti(at, 40, 8)
    }
    if (r.fx >= 6) ui.flash(r.glow, 0.3, 0.4)
  }

  // --- Meet: a baddie comes for it ---
  // The cover the baddie steps out of: one about 10 m from the food (7..16 m), ahead of it
  // or level, so the first-person walk-in has room to play out.
  function coverNear(p) {
    let best = null
    let bd = Infinity
    for (const c of laneCover) {
      if (c.busy || c.z > p.z + 3) continue
      const d = Math.hypot(c.x - p.x, c.z - p.z)
      if (d < 7 || d > 16) continue
      const score = Math.abs(d - 10)
      if (score < bd) {
        bd = score
        best = c
      }
    }
    return best
  }
  // Who comes out for the food: a season girl (a Season Lure guarantees one, else 1 in
  // SEASON.chance), or a girl of the zone it landed in (the featured area adds luck). Then a
  // variant roll: rarest first, 1 in VARIANTS[v].chance, featured area x EVENTS.featured.variant,
  // luck helps a little.
  function rollMeet(zone) {
    const featured = events.isFeatured(zone.index)
    const L = luckNow * (featured ? EVENTS.featured.luck : 1)
    let def
    const lure = (state.S.lures | 0) > 0
    if (lure || Math.random() * SEASON.chance < 1) {
      if (lure) state.S.lures--
      def = state.rollSeason(L)
    }
    def ||= state.rollBaddie(zone.index, L)
    const boost = (featured ? EVENTS.featured.variant : 1) * (1 + Math.log10(Math.max(1, L)) * 0.5)
    let v = 0
    for (let i = VARIANTS.length - 1; i > 0; i--) {
      if (Math.random() * VARIANTS[i].chance < boost) {
        v = i
        break
      }
    }
    return { def, v }
  }
  function startMeet() {
    const fp = held.position
    const zone = zoneAt(fp.z) ?? HUB.zones[0]
    const { def, v } = rollMeet(zone)
    const area = zone.index
    // Records, milestone cash and Event Tickets for this throw.
    const rec = state.recordThrow(throwDist, area)
    if (rec.record) ui.zone(`NEW RECORD! ${Math.round(throwDist)} m`, '#ffe14a')
    if (rec.paid) toast(`Distance milestone: +$${Math.round(rec.paid).toLocaleString()}!`, 'good')
    state.addTickets(SEASON.ticketsPerThrow + (def.season ? SEASON.ticketsPerGirl : 0))
    const cover = coverNear(fp)
    const side = cover ? cover.side : Math.random() < 0.5 ? -1 : 1
    const home = cover ? new Vector3(cover.x - cover.side * 1.1, FY, cover.z) : new Vector3(side * (L.halfWidth - 1.6), FY, Math.max(L.end + 2, fp.z - 9))
    if (cover) cover.busy = true
    const b = new Baddie(def.id, 0, { showLabel: false, variant: v })
    b.group.position.copy(home)
    b.group.rotation.y = Math.atan2(fp.x - home.x, fp.z - home.z)
    scene.add(b.group)
    // First person: we see through the baddie's eyes (its head hidden so it never fills the
    // lens; its arms and body still show when it looks down or reaches for the food).
    b.head.visible = false
    const isNew = !state.S.discovered[def.id]
    const full = state.hotbarRoom() <= 0
    bad = { b, def, v, area, cover, home, sub: 'peek', t: 0, isNew, full, noticed: false, speed: 0, step: 0, bites: 0, side: -Math.sign(home.x || 1) }
    povShot(0, true)
    director.cut()
    ui.flash('#ffffff', 0.7, 0.35)
    ui.showContinue(false)
    ui.letterbox(true)
    ui.vignette('#000', 0.62)
    sfx.rustle()
    // Her cover rustles in her area's colours.
    for (let i = 0; i < 8; i++) fx.themed(zone.fx, { x: home.x + rnd(-1, 1), y: FY + rnd(1, 2.4), z: home.z + rnd(-1, 1) }, zone.fxColors, { burst: true })
    fx.puff(tmpA.set(home.x, FY + 0.6, home.z), zone.dust, 8, { size: 0.6, spread: 1.6, up: 0.8, alpha: 0.5 })
    setPhase('meet')
  }
  // The first-person camera: eye height with a crouch (0..1 up), a walking bob, sway and roll
  // driven by the step phase, looking at the food (or down at it while eating).
  function povShot(rise = 1, snap = false) {
    const b = bad.b
    const bp = b.group.position
    const fp = held.position
    const yaw = b.group.rotation.y
    const fx0 = Math.sin(yaw)
    const fz0 = Math.cos(yaw)
    const walk = Math.min(1, bad.speed / 5)
    const s = bad.step
    const bob = (Math.abs(Math.sin(s)) - 0.5) * 0.17 * walk
    const sway = Math.sin(s) * 0.08 * walk
    const eye = b.height * 0.86 * (0.62 + 0.38 * rise) + bob - (bad.dip ?? 0)
    // A peek: leaning out from behind the cover toward the lane while rising.
    const lean = (1 - rise) * 0.7 * bad.side
    const fwd = 0.38 + (bad.fwd ?? 0) // bending forward to pick it up / head back over her hands
    tmpA.set(bp.x + fx0 * fwd + fz0 * sway + lean, bp.y + eye, bp.z + fz0 * fwd - fx0 * sway)
    tmpB.set(fp.x, fp.y + 0.15 + (bad.lookUp ?? 0) - bob * 0.6, fp.z)
    director.setShot(tmpA, tmpB, 72 - (bad.zoom ?? 0), { stiff: snap ? 60 : 30, roll: Math.sin(s) * 0.028 * walk + (1 - rise) * 0.12 * bad.side })
  }
  function startReveal() {
    const b = bad.b
    const r = bad.def.rarity
    const bp = b.group.position
    held.visible = false
    b.head.visible = true
    bad.sub = 'reveal'
    bad.t = 0
    b.mode = 'idle'
    b.speed = 0
    canContinue = false
    // Close-up from the south, the baddie turned to camera, a sunburst in its rarity colour.
    const c = TM.cam.reveal
    tmpA.set(bp.x, FY + c.up + b.height * 0.25, bp.z + c.dist * (1 + narrow() * 0.45))
    tmpB.set(bp.x, FY + b.height * (0.62 - narrow() * 0.3), bp.z)
    director.setShot(tmpA, tmpB, c.fov, { stiff: 14 })
    director.cut()
    ui.flash(RARITIES[r].glow, 0.75, 0.5)
    ui.vignette(r >= 3 ? RARITIES[r].glow : '#000', r >= 3 ? 0.55 : 0.4)
    sun.visible = true
    sun.material.color.set(RARITIES[r].glow)
    sun.material.opacity = 0
    sun.position.set(bp.x, FY + b.height * 0.6, bp.z - 1.4)
    sun.scale.setScalar(0.1)
    fx.beam(new Vector3(bp.x, FY, bp.z), RARITIES[r].glow, { radius: 1.3, height: 14, life: 1.6 })
    fx.ring(new Vector3(bp.x, FY + 0.08, bp.z), RARITIES[r].glow, { r1: 4, life: 0.6 })
    setPhase('reveal')
    ui.letterbox(false)
    ui.typeName(bad.def.name, TM.typeEvery, (i) => {
      sfx.typeKey(i)
      director.shake(0.04)
    }, showCard)
  }
  function showCard() {
    if (!bad || bad.sub !== 'reveal') return
    const r = bad.def.rarity
    const b = bad.b
    const bp = b.group.position
    const inc = state.baddieIncome({ id: bad.def.id, size: 0, v: bad.v, a: bad.area })
    ui.card({ rarity: r, name: bad.def.name, income: inc, isNew: bad.isNew, full: bad.full, variant: bad.v, season: bad.def.season ? events.season().season.name : '' })
    if (bad.v) {
      ui.flash(VARIANTS[bad.v].glow, 0.6, 0.6)
      fx.sparkle(tmpA.set(bp.x, FY + b.height * 0.6, bp.z), VARIANTS[bad.v].color, 60, { speed: 8, up: 3 })
    }
    sfx.reveal(r)
    if (bad.isNew) setTimeout(() => sfx.newStamp(), 450)
    if (bad.full) setTimeout(() => sfx.deny(), 450)
    director.shake(0.22 + Math.min(r, 7) * 0.07) // the top rarities shake no harder than Divine
    director.kick(7 + Math.min(r, 7))
    ui.flash(RARITIES[r].glow, 0.45 + r * 0.05, 0.5)
    const head = tmpA.set(bp.x, FY + b.height * 0.8, bp.z)
    fx.sparkle(head, RARITIES[r].glow, 30 + r * 10, { speed: 6 })
    fx.stars(head, '#ffe14a', 10 + r * 3, 6)
    if (r >= 1) fx.confetti(tmpB.set(bp.x, FY + b.height + 0.5, bp.z + 1), 40 + Math.min(r, 7) * 25, 7)
    b.hop()
    b.mode = bad.full ? 'idle' : 'cheer'
    bad.sub = 'card'
    bad.t = 0
  }
  function startCatch() {
    const b = bad.b
    const def = bad.def
    const bp = b.group.position
    ui.hideReveal()
    ui.showContinue(false)
    ui.letterbox(true)
    setPhase('catch')
    const entry = bad.full ? null : state.catchToHotbar(def, { catchOdds: def.odds, v: bad.v, a: bad.area })
    if (bad.cover) bad.cover.busy = false
    if (entry) {
      state.recordCatch(def)
      const head = tmpA.set(bp.x, FY + b.height, bp.z)
      fx.hearts(head, 10)
      fx.beam(new Vector3(bp.x, FY, bp.z), RARITIES[def.rarity].glow, { radius: 1.7, height: 20, life: 1.5 })
      fx.ring(new Vector3(bp.x, FY + 0.08, bp.z), RARITIES[def.rarity].glow, { r1: 6 })
      sfx.caught(def.rarity)
      b.mode = 'cheer'
      bad.sub = 'liftoff'
      bad.entry = entry
    } else {
      fx.text('Hotbar full!', new Vector3(bp.x, FY + b.height + 1, bp.z), '#ff6a6a', { height: 1, life: 1.6 })
      toast('Hotbar full! Place baddies in your pen, sell some or fuse them to free a slot.', 'warn')
      b.mode = 'idle'
      bad.sub = 'shrug'
    }
    bad.t = 0
  }
  function backToAim() {
    sfx.wipe()
    ui.wipe(() => {
      ui.letterbox(false)
      ui.hideReveal()
      ui.showContinue(false)
      ui.vignette('#000', 0.35)
      sun.visible = false
      ensureHeld()
      aimShot(20)
      director.cut()
      meter = 0
      meterDir = 1
      autoStop = rnd(TM.auto.stopAt[0], TM.auto.stopAt[1])
      refreshLucky()
      setPhase('aim')
    }, RARITIES[bad?.def.rarity ?? 0].color)
    setPhase('return')
  }
  // A girl just landed in the hotbar: end the throw and put the player back on their own base
  // (to place her), instead of returning to the power meter. Auto mode keeps looping.
  function leaveToBase() {
    sfx.wipe()
    ui.wipe(() => {
      ui.letterbox(false)
      ui.hideReveal()
      ui.showContinue(false)
      sun.visible = false
      finishExit()
      director.cut()
      toBase?.()
    }, RARITIES[bad?.def.rarity ?? 0].color)
    setPhase('return')
  }
  function proceed() {
    if (!canContinue) return
    canContinue = false
    sfx.proceed()
    ui.showContinue(false)
    if (phase === 'landed') startMeet()
    else if (phase === 'reveal') startCatch()
  }

  // --- Input ---
  function tap() {
    if (phase === 'aim') lockIn()
    else if (phase === 'landed' || phase === 'reveal') proceed()
    else if (phase === 'meet' && bad && bad.sub !== 'reveal') {
      // Impatient: skip to the bite.
      bad.skip = true
    }
  }
  function toggleAuto() {
    auto = !auto
    ui.setAuto(auto)
    if (auto && phase === 'aim') autoStop = rnd(TM.auto.stopAt[0], TM.auto.stopAt[1])
  }
  function buyLucky() {
    if (phase !== 'aim' || lucky) return
    const price = priceNow()
    if (state.S.luckyCredits > 0) {
      state.S.luckyCredits--
      state.save()
    } else if (!state.spend(price)) {
      sfx.deny()
      toast(`Lucky Throw costs $${Math.round(price).toLocaleString()}. Keep catching!`, 'warn')
      return
    }
    lucky = true
    sfx.luckyArm()
    ui.flash('#ffe14a', 0.35, 0.4)
    fx.sparkle(hand(tmpA), '#ffe14a', 40, { speed: 6 })
    fx.stars(tmpA, '#7dff4a', 14, 5)
    director.kick(5)
    refreshLucky()
  }

  // --- Per-frame ---
  function updateFlyers(dt) {
    for (let i = flyers.length - 1; i >= 0; i--) {
      const f = flyers[i]
      const b = f.b
      const p = b.group.position
      f.t += dt
      const k = Math.min(1, f.t / 2.1)
      const e = smooth(k)
      p.x = f.from.x + (f.to.x - f.from.x) * e
      p.z = f.from.z + (f.to.z - f.from.z) * e
      p.y = f.from.y + Math.sin(k * Math.PI) * (26 + f.from.distanceTo(f.to) * 0.08) + (f.to.y - f.from.y) * e
      b.group.rotation.y += dt * 9
      if (Math.random() < 0.9) fx.trail(tmpA.set(p.x, p.y + 1, p.z), RARITIES[b.def.rarity].glow)
      b.update(dt)
      if (k >= 1) {
        onCaught.arrive(f.entry, b.def)
        b.dispose()
        flyers.splice(i, 1)
      }
    }
    for (let i = leavers.length - 1; i >= 0; i--) {
      const a = leavers[i]
      const b = a.b
      const p = b.group.position
      const dx = a.home.x - p.x
      const dz = a.home.z - p.z
      const d = Math.hypot(dx, dz)
      if (d > 0.4) {
        b.mode = 'walk'
        b.speed = 4
        p.x += (dx / d) * Math.min(d, 4 * dt)
        p.z += (dz / d) * Math.min(d, 4 * dt)
        b.group.rotation.y = Math.atan2(dx, dz)
        b.update(dt)
      } else {
        fx.puff(tmpA.set(p.x, FY + 0.4, p.z), '#e8ffd8', 8, { size: 0.6, spread: 1.4 })
        b.dispose()
        leavers.splice(i, 1)
      }
    }
  }

  function update(rdt, t) {
    // Hit-stop freezes the world for a beat; slow motion scales it.
    let dt = rdt * ts
    if (hitStop > 0) {
      hitStop -= rdt
      dt = rdt * 0.02
    }
    pt += dt
    ribbonUpdate(rdt, t)
    auraUpdate(rdt, t, phase === 'enter' || phase === 'aim' || phase === 'windup' || phase === 'flight')
    swing = Math.max(0, swing - rdt * 3)
    lean += (0 - lean) * Math.min(1, rdt * 4)
    updateFlyers(rdt)
    updateStreaks(rdt)
    if (splat.visible) {
      splat.userData.t += rdt
      const k = splat.userData.t
      splat.scale.setScalar(Math.min(2.6, 0.4 + k * 14))
      if (k > 3) splat.material.opacity = Math.max(0, 0.85 - (k - 3) * 0.5)
      if (splat.material.opacity <= 0) splat.visible = false
    }
    const p = player.renderPosition

    if (phase === 'off') {
      const on = onBand(p)
      if (!on) armed = true
      else if (armed && canEnter()) enter()
      return
    }

    if (phase === 'enter') {
      const k = smooth(Math.min(1, pt / 0.6))
      const x = enterFrom.x + (spot.x - enterFrom.x) * k
      const z = enterFrom.z + (spot.z - enterFrom.z) * k
      const df = Math.atan2(Math.sin(Math.PI - enterFrom.facing), Math.cos(Math.PI - enterFrom.facing))
      place(x, z, enterFrom.facing + df * k)
      ensureHeld()
      hand(held.position)
      held.scale.setScalar(Math.max(0.01, easeOutBack(Math.min(1, pt / 0.5))))
      spin.rotation.y += rdt * 3
      aimShot(3.5)
      if (pt > 0.75) {
        meter = 0
        meterDir = 1
        autoStop = rnd(TM.auto.stopAt[0], TM.auto.stopAt[1])
        setPhase('aim')
      }
      return
    }

    if (phase === 'aim') {
      const prev = meter
      meter += meterDir * rdt * TM.meterSpeed * 2
      if (meter >= 1) {
        meter = 2 - meter
        meterDir = -1
        sfx.meterTick(true)
      } else if (meter <= 0) {
        meter = -meter
        meterDir = 1
        sfx.meterTick(false)
      }
      ui.setMeter(meter)
      hand(held.position)
      spin.rotation.y += rdt * 2.5
      spin.rotation.x = Math.sin(t * 2) * 0.2
      if (Math.random() < rdt * (lucky ? 30 : 6)) fx.motes(held.position, lucky ? '#ffe14a' : '#ffffff', 1, 0.5, { rise: 0.8, size: lucky ? 0.3 : 0.18 })
      aimShot(5)
      uiT += rdt
      if (uiT > 0.3) {
        uiT = 0
        refreshLucky()
      }
      if (auto && meterDir > 0 && prev < autoStop && meter >= autoStop) lockIn()
      return
    }

    if (phase === 'windup') {
      const k = Math.min(1, pt / 0.3)
      lean = 0.16 * k
      hand(held.position).add(tmpA.set(0.15 * k, -0.15 * k, 0.55 * k))
      aimShot(5, 0.9 * smooth(k))
      if (pt >= 0.3) launch()
      return
    }

    if (phase === 'flight') {
      const u = Math.min(1, pt / flightDur)
      prevPos.copy(held.position)
      held.position.set(from.x + (to.x - from.x) * u, from.y + (to.y - from.y) * u + 4 * peak * u * (1 - u), from.z + (to.z - from.z) * u)
      spin.rotation.x -= dt * 14
      spin.rotation.z += dt * 3
      const fp = held.position
      if (dt > 0) vel.copy(fp).sub(prevPos).divideScalar(dt)
      const speed = Math.hypot(vel.x, vel.z)
      const sk = Math.min(1, speed / 110)
      // Trail and sparkles.
      const zone = zoneAt(fp.z)
      const zc = zone?.color ?? '#ffffff'
      ribbonPush(fp)
      fx.trail(fp, foodColors()[0])
      fx.trail(tmpA.copy(prevPos).lerp(fp, 0.5), '#ffffff')
      if (Math.random() < rdt * 30) fx.sparkle(fp, luckyUsed ? '#ffe14a' : zc, 2, { speed: 1.5, up: 0.5, size: 0.3, life: 0.5 })
      if (!slowed && Math.random() < rdt * (20 + sk * 50)) spawnStreak(tmpA.set(fp.x + rnd(-7, 7), Math.max(FY + 0.5, fp.y + rnd(-3, 4)), fp.z - rnd(18, 45)))
      // Luck climbs with distance.
      luckNow = luckBase * (1 + Math.abs(fp.z - from.z) / TM.luckPerMeters)
      const bump = Math.floor(luckNow) > Math.floor(luckShown)
      luckShown = luckNow
      ui.setLuck(luckNow, bump)
      if (bump && phase === 'flight') director.kick(1.5)
      // Zone banner.
      const zi = zone ? HUB.zones.indexOf(zone) : -1
      if (zi !== zoneIdx && zi >= 0) {
        zoneIdx = zi
        ui.zone(zone.name, zone.banner[0])
        sfx.zoneCross(zi)
        if (zi > 0) {
          ui.flash(zone.color, 0.28, 0.35)
          director.kick(5)
          director.shake(0.12)
          fx.ring(tmpA.set(fp.x, FY + 0.1, fp.z), zone.color, { r0: 1, r1: 10, life: 0.6 })
        }
      }
      // Slow motion for the last moments.
      const left = (flightDur - pt) / ts
      if (!slowed && flightDur > 1.3 && left < TM.slowMo.last) {
        slowed = true
        ts = TM.slowMo.scale
        sfx.slowmo()
        ui.vignette('#000', 0.55)
        director.kick(-6)
      }
      wind?.set(slowed ? 0.2 : sk)
      ui.setSpeed(slowed ? 0 : Math.min(1, sk * 1.3 - 0.1))
      // Chase camera: behind and above the food, looking down the line of flight.
      const c = TM.cam.chase
      const vy = vel.y / Math.max(1, speed)
      const back = (slowed ? c.back * 0.7 : c.back) * (1 + narrow() * 0.4)
      tmpA.set(fp.x * 0.7, Math.max(FY + 1.0, fp.y + c.up - vy * 0.8), fp.z + back)
      tmpB.set(fp.x, fp.y + vy * 2.5, fp.z - 6)
      director.setShot(tmpA, tmpB, slowed ? c.fov - 22 : c.fov, { stiff: pt < 0.25 ? 3 + pt * 30 : Math.min(70, 10 + pt * 120), roll: Math.sin(t * 1.4) * 0.04 })
      if (u >= 1) impact()
      return
    }

    if (phase === 'impact' || phase === 'landed') {
      const fp = held.position
      if (!settled) {
        vel.y -= 30 * dt
        fp.addScaledVector(vel, dt)
        fp.z = Math.max(L.end + 1.5, fp.z)
        fp.x = Math.max(-L.halfWidth + 1.5, Math.min(L.halfWidth - 1.5, fp.x))
        spin.rotation.x -= vel.z * dt * 1.6
        if (fp.y <= FY + 0.42 && vel.y < 0) {
          fp.y = FY + 0.42
          if (vel.y < -3 && bounces < 3) {
            vel.y = -vel.y * 0.42
            vel.z *= 0.7
            bounces++
            sfx.bounce(Math.min(1, -vel.y / 6))
            sfx.foodBounce?.(heldDef.kind, Math.min(1, -vel.y / 6))
            fx.chunks(tmpB.set(fp.x, FY + 0.4, fp.z), foodColors(), 6, { power: 0.45, floor: FY + 0.02 })
            squash(Math.min(0.7, -vel.y / 10))
            fx.puff(tmpA.set(fp.x, FY + 0.15, fp.z), '#fff8e8', 5, { size: 0.5, spread: 1.4, up: 0.4, life: 0.6, alpha: 0.5 })
            fx.crumbs(tmpA, foodColors(), 8)
            director.shake(0.08)
          } else {
            vel.y = 0
            vel.z *= Math.exp(-5 * dt)
            vel.x *= Math.exp(-5 * dt)
            if (Math.abs(vel.z) < 0.25) settled = true
          }
        }
        applySquash(1.35, rdt)
      } else {
        applySquash(1.35, rdt)
        spin.rotation.x += (Math.round(spin.rotation.x / Math.PI) * Math.PI - spin.rotation.x) * Math.min(1, rdt * 6)
      }
      // Slow low orbit around the food.
      orbit += rdt * TM.cam.landed.orbit
      const c = TM.cam.landed
      const a = orbit - 0.35
      tmpA.set(Math.max(-L.halfWidth + 1, Math.min(L.halfWidth - 1, fp.x + Math.sin(a) * c.radius)), FY + c.up, fp.z + Math.cos(a) * c.radius)
      tmpB.set(fp.x, FY + 0.6, fp.z)
      director.setShot(tmpA, tmpB, c.fov, { stiff: phase === 'impact' && pt < 0.4 ? 3 : 4 })
      if (Math.random() < rdt * 4) fx.motes(tmpC.set(fp.x, FY + 0.4, fp.z), '#fff6c0', 1, 0.8, { rise: 0.8 })
      // Once it has settled and the camera has circled it for a beat, a baddie comes for it
      // straight away (no "continue" prompt here).
      if (phase === 'impact' && settled && pt > 1.1) startMeet()
      return
    }

    if (phase === 'meet' && bad) {
      const b = bad.b
      const bp = b.group.position
      const fp = held.position
      bad.t += dt
      if (bad.sub === 'peek') {
        // Rise out of a crouch behind the bush, spot the food, a quick zoom of interest.
        const k = smooth(Math.min(1, bad.t / 0.9))
        b.mode = 'idle'
        if (bad.t > 0.5 && !bad.noticed) {
          bad.noticed = true
          sfx.notice(0)
          director.shake(0.06)
          bad.zoomT = 0
        }
        if (bad.noticed) {
          bad.zoomT += dt
          bad.zoom = Math.sin(Math.min(1, bad.zoomT / 0.5) * Math.PI) * 14
        }
        b.update(dt)
        povShot(k)
        if (bad.t > 1.05 || bad.skip) {
          bad.sub = 'walk'
          bad.t = 0
          bad.zoom = 0
        }
        return
      }
      if (bad.sub === 'walk') {
        const dx = fp.x - bp.x
        const dz = fp.z - bp.z
        const d = Math.hypot(dx, dz)
        if (d < 1.15 || bad.skip) {
          if (bad.skip && d >= 1.15) bp.set(fp.x - (dx / d) * 1.15, FY, fp.z - (dz / d) * 1.15)
          bad.sub = 'eat'
          bad.t = 0
          bad.et = 0
          bad.speed = 0
          bad.ground = fp.clone()
          bad.groundRot = spin.rotation.x
          bad.grabbed = false
          bad.bites = -1
          bad.fs = held.scale.x
          b.mode = 'feed'
          b.reach = b.hold = b.chomp = 0
          b.speed = 0
          b.group.rotation.y = Math.atan2(dx, dz)
          sfx.drumroll(1.6, bad.def.rarity)
          if (bad.def.rarity >= 3) ui.vignette(RARITIES[bad.def.rarity].glow, 0.6)
        } else {
          // Walk in: accelerate, then ease off for the last couple of metres.
          const want = Math.min(5.5, 1 + d * 1.2)
          bad.speed += (want - bad.speed) * Math.min(1, dt * 4)
          const stepLen = Math.min(d, bad.speed * dt)
          bp.x += (dx / d) * stepLen
          bp.z += (dz / d) * stepLen
          const yaw = Math.atan2(dx, dz)
          const diff = Math.atan2(Math.sin(yaw - b.group.rotation.y), Math.cos(yaw - b.group.rotation.y))
          b.group.rotation.y += diff * Math.min(1, dt * 6)
          b.mode = 'walk'
          b.speed = bad.speed
          // Footfalls: one per half cycle of the bob (a stride of about 0.9 m).
          const prev = Math.floor(bad.step / Math.PI)
          bad.step += (stepLen / 0.9) * Math.PI
          if (Math.floor(bad.step / Math.PI) !== prev) {
            sfx.step(0.9, Math.floor(bad.step / Math.PI) % 2 ? 0.25 : -0.25)
            director.shake(0.035)
            fx.puff(tmpA.set(bp.x + Math.sin(yaw) * 0.3, FY + 0.05, bp.z + Math.cos(yaw) * 0.3), '#f4ffe6', 2, { size: 0.3, spread: 0.6, up: 0.25, life: 0.5, alpha: 0.45 })
          }
        }
        b.update(dt)
        povShot(1)
        return
      }
      if (bad.sub === 'eat') {
        // She bends down and scoops the food up in both hands, lifts it to her mouth and eats
        // it from her hands bite by bite: the camera nods with each chomp, crumbs fly at the
        // lens, the food shrinks away. A tap (skip) plays it at 3.5x.
        const E = TM.eat
        bad.et += dt * (bad.skip ? E.skipSpeed : 1)
        const et = bad.et
        const ramp = (from, len) => smooth(Math.max(0, Math.min(1, (et - from) / len)))
        const reach = et < E.reach ? ramp(0, E.reach) : 1 - ramp(E.reach, E.lift)
        const grab = ramp(E.grab, E.grabLen)
        const hold = ramp(E.reach, E.lift)
        const biteAt = E.reach + E.lift
        const bk = (et - biteAt) / E.biteEvery // bites so far (fractional)
        const chomp = bk > 0 && bk < E.bites ? Math.max(0, Math.sin(bk * Math.PI * 2)) : 0
        b.reach = reach
        b.hold = hold
        b.chomp = chomp
        b.update(dt)
        // Where her two palms meet: the food sits just in front of them.
        b.group.updateMatrixWorld(true)
        const hl = b.armL.localToWorld(tmpA.set(0, -0.86, 0.14))
        const hr = b.armR.localToWorld(tmpC.set(0, -0.86, 0.14))
        hl.add(hr).multiplyScalar(0.5)
        const yaw = b.group.rotation.y
        hl.x += Math.sin(yaw) * E.inFront
        hl.z += Math.cos(yaw) * E.inFront
        hl.y += 0.04
        fp.lerpVectors(bad.ground, hl, grab)
        if (!bad.grabbed && grab > 0.02) {
          bad.grabbed = true
          sfx.pop(true)
          director.shake(0.05)
          fx.chunks(tmpB.set(bad.ground.x, FY + 0.3, bad.ground.z), foodColors(), 6, { power: 0.35, floor: FY + 0.02 })
          fx.puff(tmpB.set(bad.ground.x, FY + 0.12, bad.ground.z), '#fff8e8', 5, { size: 0.5, spread: 1.2, up: 0.4, life: 0.6, alpha: 0.45 })
        }
        // Turn the food upright and its face toward her as it comes up.
        const upright = Math.round(bad.groundRot / (Math.PI * 2)) * Math.PI * 2
        spin.rotation.x = bad.groundRot + (upright - bad.groundRot) * grab
        held.rotation.y = (yaw + Math.PI) * grab
        // Bites: each one takes a chunk out of it.
        const bite = bk >= 0.25 ? Math.floor(bk - 0.25) : -1 // on each chomp's peak
        if (bite > bad.bites && bite < E.bites) {
          bad.bites = bite
          sfx.munch(1, 0, heldDef.kind)
          fx.chunks(tmpB.set(fp.x, fp.y + 0.1, fp.z), foodColors(), 8, { power: 0.45, floor: FY + 0.02 })
          director.shake(0.09)
          director.kick(-2.5)
          fx.crumbs(tmpB.set(fp.x, fp.y + 0.15, fp.z), foodColors(), 14)
          fx.sparkle(tmpB, '#fff6c0', 6, { speed: 2, up: 1, size: 0.25, life: 0.5 })
        }
        const size = bad.fs + (E.holdScale - bad.fs) * grab
        held.scale.setScalar(Math.max(0.01, size * Math.pow(E.biteShrink, Math.max(0, bad.bites + 1))))
        bad.dip = reach * 0.55 + chomp * 0.06
        bad.fwd = reach * 0.3 - hold * 0.55
        bad.lookUp = hold * 0.2
        if (hold > 0.5 && Math.random() < dt * 3) fx.hearts(tmpB.set(fp.x, fp.y + 0.35, fp.z), 1)
        povShot(1)
        if (et > biteAt + E.biteEvery * E.bites + E.after) {
          bad.dip = bad.fwd = bad.lookUp = 0
          startReveal()
        }
        return
      }
      return
    }

    if (phase === 'reveal' && bad) {
      const b = bad.b
      bad.t += rdt
      // Turn to face the camera (+Z), sunburst grows and spins.
      b.group.rotation.y += Math.atan2(Math.sin(0 - b.group.rotation.y), Math.cos(0 - b.group.rotation.y)) * Math.min(1, rdt * 8)
      const r = bad.def.rarity
      const grow = Math.min(1, bad.t / 0.5)
      sun.scale.setScalar((5 + r * 1.2) * easeOutBack(grow) + Math.sin(t * 3) * 0.2)
      sun.material.opacity = Math.min(0.55 + r * 0.06, grow)
      sun.lookAt(camera.position)
      sun.rotateZ(t * (0.4 + r * 0.08))
      if (Math.random() < rdt * (6 + r * 4)) fx.motes(tmpA.set(b.group.position.x, FY + 0.2, b.group.position.z), RARITIES[r].glow, 1, 1.2, { rise: 2.2 })
      if (bad.sub === 'card') {
        if (!canContinue && bad.t > 0.7) {
          canContinue = true
          autoT = 0
          ui.showContinue(true)
        }
        if (canContinue && auto) {
          autoT += rdt
          if (autoT > TM.auto.revealHold) proceed()
        }
      }
      b.update(rdt)
      return
    }

    if (phase === 'catch' && bad) {
      const b = bad.b
      const bp = b.group.position
      bad.t += rdt
      sun.material.opacity = Math.max(0, sun.material.opacity - rdt * 2)
      if (bad.sub === 'liftoff') {
        // A little cheer, then it spins down into a burst of sparkles and its card flies
        // into the hotbar (select it there to carry it and place it in your pen).
        if (bad.t > 0.6 && !bad.launched) {
          bad.launched = true
          sfx.whoosh()
          director.shake(0.15)
          director.kick(-5)
        }
        if (bad.launched) {
          const k = Math.min(1, (bad.t - 0.6) / 0.35)
          b.group.scale.setScalar(Math.max(0.001, 1 - k * k))
          b.group.rotation.y += rdt * 18
          b.group.position.y = FY + k * 1.2
          if (k >= 1 && !bad.stored) {
            bad.stored = true
            b.group.visible = false
            const c = tmpA.set(bp.x, FY + 1.4, bp.z)
            fx.sparkle(c, RARITIES[bad.def.rarity].glow, 40, { speed: 6 })
            fx.stars(c, '#ffe14a', 12, 5)
            fx.puff(c, '#ffffff', 10, { size: 0.7, spread: 2 })
            sfx.pop(true)
            onCaught.toHotbar(bad.def)
          }
        }
        tmpA.set(bp.x, FY + 2.2, bp.z + 6.5)
        tmpB.set(bp.x, FY + 1.4, bp.z)
        director.setShot(tmpA, tmpB, 58, { stiff: 4 })
        b.update(rdt)
        if (bad.t > 1.45) {
          b.dispose()
          bad = { ...bad, b: null }
          if (auto) backToAim()
          else leaveToBase()
        }
      } else if (bad.sub === 'shrug') {
        b.update(rdt)
        if (bad.t > 1.1) {
          leavers.push({ b, home: bad.home })
          bad = { ...bad, b: null }
          backToAim()
        }
      }
      return
    }
  }

  return {
    update,
    tap,
    exit,
    toggleAuto,
    buyLucky,
    get phase() {
      return phase
    },
    get active() {
      return phase !== 'off'
    },
    get timeScale() {
      return hitStop > 0 ? 0.02 : ts
    },
    onBand,
    // Right arm pose for the avatar: food held up while aiming, cocked back in the windup,
    // whipping forward on release.
    armAngle(t) {
      if (phase === 'enter' || phase === 'aim') return -2.85 + Math.sin(t * 4) * 0.06
      if (phase === 'windup') return -2.85 - Math.min(1, pt / 0.3) * 0.65
      if (swing > 0) return -3.5 + (1 - swing) * 3.2
      return null
    },
    // Whole-body lean (radians about X; + leans back).
    lean: () => lean,
  }
}
