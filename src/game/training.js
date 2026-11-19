// The Training Place. Walk into the dashed ring and you hop up onto the bar between the
// pillars and do pull-ups: each rep (pull, hold, lower) earns training XP (a "+N XP"
// pop at your head, a glock tick that climbs with the bar), every level gives Throwing
// Strength (LEVEL UP pop, rings, a beam, confetti, the strength counter bumps). STOP, Esc / Q,
// walking or jumping
// drops you off; you have to step away from the bar before it takes you again.
//
// Random XP boosts: while you train, a round "2x" tap button (x3, x5, x10: rolled by weight from
// TRAINING.drops) pops up on screen at random times only; tap it (or Space / F / E) before its ring
// runs out and every rep pays that many times the XP for `dur` s (10 s), then it is gone until the
// next one shows up (coloured aura, orbiting sparks, bigger XP
// pops, glowing screen edges, a countdown pill).
//
// The pad right behind the bar is the bench's upgrade pad: it shows the bench's XP/s and the money
// price of the next bench; step on it to buy it (the old bench crushes into the ground, the new
// model bursts up, rings, a beam, confetti, coins, a fanfare). Short of money it buzzes and tells
// you how much is missing.
//
// The body stays on the ground (frozen); main.js calls applyPose() after the animator
// each frame to lift the model and pose it: the hands are pinned to the bar by a 2-bone
// arm IK sized from the loaded avatar's own bones, the knees tuck on each pull.
import { Quaternion, Vector3 } from 'three'
import { TRAINING } from '../config.js'
import { fmt } from './format.js'
import { inputState } from '../input.js'
import * as state from './state.js'

const qa = new Quaternion()
const wp = new Vector3()
const wp2 = new Vector3()
const ease = (x) => 1 - Math.pow(1 - x, 3)
const easeIn = (x) => x * x * (3 - 2 * x)

const rand = ([a, b]) => a + Math.random() * (b - a)
function rollDrop() {
  const vs = TRAINING.drops.values
  let r = Math.random() * vs.reduce((s, v) => s + v.weight, 0)
  for (const v of vs) if ((r -= v.weight) <= 0) return v
  return vs[0]
}

// pad: { spot (Vector3, the pad centre), label (dynLabel), top (the yellow disc mesh) }.
// toast(text, kind) shows a HUD toast.
export function createTrainer({ fx, sfx, player, ui, station, director, freeze, syncYaw, canEnter, busy, pad, toast }) {
  const { spot, ringR, rep: R, drops: D } = TRAINING
  let phase = 'idle' // idle | mount | train | dismount
  let t0 = 0 // time in phase
  let armed = true // must leave the ring before it takes you again
  let cyc = 0 // 0..1 through the current rep
  let near = false
  let sweatT = 0
  // Random XP boosts: the button on screen (drop) and the running boost (xb).
  let dropIn = 0 // s until the next button pops up
  let drop = null // { v, left }
  let xb = null // { v, left }
  let orbitA = 0
  // The pad: armed again once you step off it; a short queue of timed upgrade fx.
  let padArmed = true
  let padKick = 0
  let padDeny = 0
  const queue = [] // [{ at, fn }]
  let clock = 0
  // w: how much you hang on the bar (0 standing .. 1), s: how far up the pull is (0 .. 1),
  // hop: extra height (the jump up), legs: knee tuck, swing: leg sway.
  const pose = { active: false, w: 0, s: 0, hop: 0, legs: 0, swing: 0 }
  let arm = null // cached rig lookups: { rig, L1, L2, bones }
  const v = new Vector3()

  const inRing = (p, r = TRAINING.enterR) => (p.x - spot.x) ** 2 + (p.z - spot.z) ** 2 < r * r && p.y < 1.5
  const onPad = (p, r = 1.9) => (p.x - pad.spot.x) ** 2 + (p.z - pad.spot.z) ** 2 < r * r && p.y < 1.5
  const ringC = new Vector3(spot.x, 0, spot.z + TRAINING.padGap / 2)
  const v3 = (x, y, z) => new Vector3(x, y, z)
  // The pad's label floats in front of the bench seen from the lane side: draw it on top so the
  // bench never hides the price.
  pad.label.sprite.material.depthTest = false
  pad.label.sprite.renderOrder = 8
  const repLen = () => R.up + R.hold + R.down + R.rest

  function syncUi(animate = true) {
    ui.setLevel(state.S.train.level, state.S.train.xp, state.trainNeed(), { animate })
  }

  function enter() {
    phase = 'mount'
    t0 = 0
    cyc = 0
    armed = false
    freeze(true)
    player.facing = TRAINING.facing
    syncYaw()
    ui.show(true)
    syncUi(false)
    dropIn = rand(D.first)
    drop = null
    xb = null
    sfx.grab()
    fx.puff(v.set(spot.x, 0.15, spot.z), '#eef7d8', 6, { size: 0.5, spread: 1.2, up: 0.5, life: 0.7, alpha: 0.5 })
  }
  function stop() {
    if (phase !== 'mount' && phase !== 'train') return
    phase = 'dismount'
    t0 = 0
    if (xb) sfx.boostEnd()
    drop = null
    xb = null
    ui.show(false)
  }
  // The XP boost button was tapped.
  function grab() {
    if (!drop || phase !== 'train') return
    const v = drop.v
    drop = null
    xb = { v, left: v.dur }
    ui.dropOff(true)
    ui.xpBoost(v)
    sfx.dropGrab(v.mult)
    director?.kick(4 + Math.min(6, v.mult * 0.6))
    director?.shake(0.12 + Math.min(0.2, v.mult * 0.02))
    const feet = v3(spot.x, 0.08, spot.z)
    const body = v3(spot.x, station.gripY - 0.5, spot.z)
    fx.ring(feet, v.color, { r0: 0.4, r1: 5, life: 0.6 })
    fx.ring(feet.clone().setY(0.12), '#ffffff', { r0: 0.2, r1: 3, life: 0.45 })
    fx.beam(feet, v.color, { radius: 0.9, height: 9, life: 0.8 })
    fx.sparkle(body, v.color, 30, { speed: 6, size: 0.42, life: 0.9, up: 2 })
    fx.stars(body, v.color, 10, 5)
    fx.text(`x${v.mult} XP!`, v3(spot.x, station.gripY + 1.3, spot.z), v.color, { height: 1.0, life: 1.3, rise: 1.4 })
  }

  // The top of a pull-up: pay out.
  function payRep() {
    const head = v.set(spot.x, station.gripY + 0.35, spot.z)
    const boosted = !!xb
    const mult = xb ? xb.v.mult : 1
    const { xp, levels } = state.trainRep(mult)
    sfx.rep(boosted)
    if (xb) sfx.boostRep(mult)
    station.rep(xb ? xb.v.color : '#ffffff')
    const at = head.clone().add(new Vector3((Math.random() - 0.5) * 0.8, 0.5, 0))
    if (xb) {
      fx.text(`+${fmt(xp, 0)} XP`, at, xb.v.color, { height: 0.85, life: 1.1, rise: 2 })
      fx.text(`x${mult}`, at.clone().add(new Vector3(0.7, 0.45, 0)), '#ffffff', { height: 0.45, life: 0.8, rise: 2 })
      fx.ring(v3(spot.x, 0.1, spot.z), xb.v.color, { r0: 0.3, r1: 2.6, life: 0.45 })
      fx.sparkle(v3(spot.x, station.gripY - 0.4, spot.z), xb.v.color, 12, { speed: 4, size: 0.35, life: 0.6, up: 1.5 })
    } else fx.text(`+${fmt(xp, 0)} XP`, at, boosted ? '#7fe8ff' : '#59b8ff', { height: 0.62, life: 1.0, rise: 1.6 })
    fx.puff(v.set(spot.x, station.gripY, spot.z), '#ffffff', 2, { size: 0.3, spread: 0.6, up: 0.2, life: 0.5, alpha: 0.45 }) // chalk
    fx.sparkle(v.set(spot.x, station.gripY + 0.1, spot.z), boosted ? '#ffe14a' : '#ffffff', boosted ? 10 : 5, { speed: 2.5, size: 0.3, life: 0.5, up: 1 })
    if (levels) levelUp(levels)
    else sfx.xp(state.S.train.xp / state.trainNeed())
    syncUi()
  }
  function levelUp(levels) {
    const lvl = state.S.train.level
    const feet = new Vector3(spot.x, 0.08, spot.z)
    const chest = new Vector3(spot.x, station.gripY - 0.6, spot.z)
    sfx.levelUp()
    ui.levelUp(levels, lvl)
    director?.kick(5)
    director?.shake(0.22)
    fx.ring(feet, '#8dff3c', { r0: 0.6, r1: 6, life: 0.7 })
    fx.ring(feet.clone().setY(0.1), '#ffffff', { r0: 0.3, r1: 3.6, life: 0.5 })
    fx.beam(feet, '#8dff3c', { radius: 1.1, height: 10, life: 1.0 })
    fx.stars(chest, '#ffd93b', 14, 6)
    fx.sparkle(chest, '#8dff3c', 26, { speed: 6, size: 0.45, life: 0.9, up: 3 })
    fx.confetti(new Vector3(spot.x, station.gripY + 1.4, spot.z), 36, 6)
    fx.text(`+${levels * TRAINING.strengthPerLevel} Strength`, new Vector3(spot.x, station.gripY + 1.6, spot.z), '#ff4d4d', { height: 0.75, life: 1.4, rise: 1.8 })
  }

  // --- Random XP boosts ---
  function updateDrops(dt) {
    if (drop) {
      drop.left -= dt
      if (drop.left <= 0) {
        drop = null
        ui.dropOff(false)
        dropIn = rand(D.every)
      }
    } else if (!xb) {
      dropIn -= dt
      if (dropIn <= 0) {
        const v = rollDrop()
        drop = { v, left: D.life }
        ui.drop(v, D.life)
        sfx.dropSpawn(v.mult)
      }
    }
    if (xb) {
      xb.left -= dt
      // The boost aura: sparks orbiting you, coloured motes rising off you.
      orbitA += dt * (3 + xb.v.mult * 0.3)
      const c = xb.v.color
      for (let i = 0; i < 2; i++) {
        const a = orbitA + i * Math.PI
        const y = station.gripY - 1.1 + Math.sin(orbitA * 0.7 + i) * 0.7
        fx.particle('glow', { x: spot.x + Math.cos(a) * 0.75, y, z: spot.z + Math.sin(a) * 0.75, vx: 0, vy: 0.3, vz: 0, color: rgb(c), size: 0.22, size1: 0, life: 0.5, alpha: 0.9, fadeIn: 0.02, sprite: 1 })
      }
      if (Math.random() < dt * (8 + xb.v.mult)) fx.motes(v.set(spot.x, 0.2, spot.z), c, 1, 0.7, { rise: 3.2, size: 0.28, life: 1.1 })
      if (xb.v.mult >= 5 && Math.random() < dt * 3) fx.sparkle(v.set(spot.x + (Math.random() - 0.5), station.gripY + 0.3, spot.z), '#ffffff', 3, { speed: 2, size: 0.3, life: 0.5, up: 1 })
      if (xb.left <= 0) {
        xb = null
        ui.xpBoost(null)
        sfx.boostEnd()
        dropIn = rand(D.every)
      }
    }
    ui.tick(dt, xb ? xb.left : 0)
  }
  const rgbC = new Map()
  function rgb(c) {
    if (!rgbC.has(c)) {
      const n = parseInt(c.slice(1), 16)
      rgbC.set(c, { r: ((n >> 16) & 255) / 255, g: ((n >> 8) & 255) / 255, b: (n & 255) / 255 })
    }
    return rgbC.get(c)
  }

  // --- The upgrade pad ---
  function updatePad(dt, t, p) {
    // Timed upgrade fx.
    for (let i = queue.length - 1; i >= 0; i--) {
      if (clock >= queue[i].at) {
        const f = queue[i].fn
        queue.splice(i, 1)
        f()
      }
    }
    const on = phase === 'idle' && onPad(p)
    if (!on) padArmed = true
    else if (padArmed && !busy()) {
      padArmed = false
      tryUpgrade()
    }
    // Pad bounce (bought) or red shake (short of money).
    padKick = Math.max(0, padKick - dt * 2.2)
    padDeny = Math.max(0, padDeny - dt * 2.5)
    pad.top.position.y = 0.17 - Math.sin(padKick * Math.PI) * 0.12
    pad.top.position.x = Math.sin(padDeny * 40) * 0.08 * padDeny
    const em = pad.top.material.emissive
    if (em) {
      em.set(padDeny > 0 ? '#ff2a2a' : '#ffd93b')
      pad.top.material.emissiveIntensity = padDeny > 0 ? padDeny * 0.8 : padKick * 0.8 + (on ? 0.15 : 0)
    }
    // The label: the next bench's XP/s, the XP/s now and the price (red while you cannot afford it).
    const cur = state.bench()
    const next = state.benchNext()
    pad.label.sprite.visible = phase === 'idle'
    pad.label.sprite.position.y = 2.75 + Math.sin(t * 2) * 0.06
    pad.label.set([
      next ? { text: `UPGRADE ▶ +${fmt(next.xps, 0)} XP/s`, color: '#ffd23a', scale: 0.55 } : { text: 'BEST BENCH', color: '#ffd23a', scale: 0.55 },
      { text: `+${fmt(cur.xps, 0)} XP/s`, color: '#59b8ff' },
      next ? { text: `$${fmt(next.price)}`, color: state.S.money >= next.price ? '#7dff4a' : '#ff5a5a' } : { text: 'MAX', color: '#ffd23a' },
    ])
    if (on && Math.random() < dt * 6) fx.motes(v.set(pad.spot.x, 0.35, pad.spot.z), next && state.S.money >= next.price ? '#7dff4a' : '#ffe14a', 1, 1.3, { rise: 1.6 })
  }
  function tryUpgrade() {
    const res = state.upgradeBench()
    const at = v3(pad.spot.x, 1.6, pad.spot.z)
    if (res.max) {
      sfx.maxed()
      toast?.('Your Training Bench is the best one!', 'rare')
      return
    }
    if (!res.ok) {
      sfx.deny()
      padDeny = 1
      fx.text(`Need $${fmt(res.need)} more`, at, '#ff5a5a', { height: 0.6, life: 1.3, rise: 1.2 })
      toast?.(`Not enough money: $${fmt(res.need)} more for ${state.benchNext()?.name ?? 'the next bench'}`)
      return
    }
    showUpgrade(res.tier)
  }
  // The upgrade show (the model swap itself runs in the station).
  function showUpgrade(tier) {
    const def = TRAINING.benches[tier]
    const c = def.glow === '#ffffff' ? '#ffd23a' : def.glow
    const sw = station.swapAt
    station.setTier(tier)
    sfx.upgrade(tier, sw)
    padKick = 1
    const top = v3(spot.x, TRAINING.pillar.height + 0.6, spot.z)
    const feet = v3(spot.x, 0.08, spot.z)
    // Coins pour out of the pad into the bench; dust as it shudders and sinks.
    fx.coins(v3(pad.spot.x, 0.5, pad.spot.z), 12, () => top, null)
    fx.ring(v3(pad.spot.x, 0.3, pad.spot.z), '#ffd93b', { r0: 0.4, r1: 2.6, life: 0.4 })
    for (let i = 0; i < 3; i++) queue.push({ at: clock + i * 0.12, fn: () => fx.puff(v3(spot.x + (Math.random() - 0.5) * 2.6, 0.2, spot.z + (Math.random() - 0.5)), '#d8cbb0', 5, { size: 0.7, spread: 1.6, up: 0.6, life: 0.8, alpha: 0.6 }) })
    director?.shake(0.12)
    queue.push({
      at: clock + sw,
      fn: () => {
        director?.kick(8)
        director?.shake(0.35)
        fx.beam(feet, c, { radius: 1.8, height: 16, life: 1.3 })
        fx.ring(feet, c, { r0: 0.6, r1: 8, life: 0.8 })
        fx.ring(feet.clone().setY(0.12), '#ffffff', { r0: 0.3, r1: 5, life: 0.55 })
        fx.puff(feet, '#ffffff', 12, { size: 0.9, spread: 2.6, up: 1, life: 0.9, alpha: 0.6 })
        fx.sparkle(top, c, 40, { speed: 7, size: 0.5, life: 1.1, up: 3 })
        fx.stars(top, '#ffd93b', 16, 7)
        fx.confetti(top, 60, 7)
      },
    })
    queue.push({
      at: clock + sw + 0.45,
      fn: () => {
        fx.text('UPGRADED!', top.clone().setY(top.y + 1.2), '#8dff3c', { height: 1.0, life: 1.6, rise: 1.2 })
        fx.text(`+${fmt(def.xps, 0)} XP/s`, top.clone().setY(top.y + 0.3), '#59b8ff', { height: 0.75, life: 1.6, rise: 1.2 })
        fx.sparkle(top, '#ffffff', 20, { speed: 4, size: 0.4, life: 0.9, up: 2 })
        ui.benchUp(def, tier, TRAINING.benches.length)
        toast?.(`Training Bench upgraded: ${def.name} (+${fmt(def.xps, 0)} XP/s)`, 'rare')
      },
    })
    queue.push({ at: clock + sw + 0.9, fn: () => fx.confetti(top, 30, 5) })
  }

  // Arm lengths from the avatar's bones (shoulder -> elbow -> wrist leaf), in metres.
  function measure(rig, group) {
    group.updateMatrixWorld(true)
    const find = (n) => rig.bindings.find((b) => b.bone.name === n)?.bone ?? null
    const shoulder = find('ArmR1')
    const elbow = find('ArmR2')
    const leaf = elbow?.children.find((c) => c.isBone || c.name.endsWith('_leaf')) ?? null
    let L1 = 0.34
    let L2 = 0.31
    if (shoulder && elbow) L1 = shoulder.getWorldPosition(wp).distanceTo(elbow.getWorldPosition(wp2))
    if (elbow && leaf) L2 = elbow.getWorldPosition(wp).distanceTo(leaf.getWorldPosition(wp2))
    if (!elbow) {
      L1 *= 0.5
      L2 = L1
    }
    return { rig, shoulder, L1: Math.max(0.1, L1), L2: Math.max(0.1, L2), elbows: !!elbow }
  }

  return {
    get active() {
      return phase !== 'idle'
    },
    get training() {
      return phase === 'mount' || phase === 'train'
    },
    stop,
    grab,
    inRing,
    pose,
    // Layer the pull-up over the animator's idle pose (call after animator.update).
    applyPose(rig, group) {
      if (!pose.active || !rig) return
      if (arm?.rig !== rig) arm = measure(rig, group)
      const { grip } = TRAINING
      const barY = station.gripY - grip.drop
      // Shoulder (before the lift) and the bar, in the character's side plane.
      group.updateMatrixWorld(true)
      const sh = arm.shoulder ? arm.shoulder.getWorldPosition(wp) : wp.set(group.position.x, group.position.y + 1.37, group.position.z)
      const fx_ = Math.sin(player.facing)
      const fz_ = Math.cos(player.facing)
      const reach = arm.L1 + arm.L2 - 0.03
      const shH = sh.y - group.position.y
      const hangBase = barY - reach - shH
      const liftMax = Math.max(0.1, reach - grip.top)
      const lift = pose.w * (hangBase + pose.s * liftMax) + pose.hop
      const tz = (spot.x - sh.x) * fx_ + (spot.z - sh.z) * fz_ + grip.forward
      const ty = barY - (sh.y + lift)
      // 2-bone IK (angles from +Y toward forward +Z): upper arm, then forearm to the bar.
      const D = Math.min(arm.L1 + arm.L2 - 0.005, Math.max(Math.abs(arm.L1 - arm.L2) + 0.01, Math.hypot(tz, ty)))
      const bT = Math.atan2(tz, ty)
      const g = Math.acos(Math.max(-1, Math.min(1, (arm.L1 * arm.L1 + D * D - arm.L2 * arm.L2) / (2 * arm.L1 * D))))
      const b1 = bT + g
      const b2 = Math.atan2(tz - arm.L1 * Math.sin(b1), ty - arm.L1 * Math.cos(b1))
      const upper = (b1 - Math.PI) * pose.w
      const fore = arm.elbows ? (b2 - b1) * pose.w : 0
      for (const b of rig.bindings) {
        const n = b.bone.name
        if (n === 'ArmL1' || n === 'ArmR1') {
          b.bone.quaternion.copy(b.rest).premultiply(qa.setFromAxisAngle(b.axisX, arm.elbows ? upper : (bT - Math.PI) * pose.w))
          b.bone.quaternion.premultiply(qa.setFromAxisAngle(b.axisZ, (n === 'ArmL1' ? -1 : 1) * 0.08 * pose.w))
        } else if (n === 'ArmL2' || n === 'ArmR2') b.bone.quaternion.copy(b.rest).premultiply(qa.setFromAxisAngle(b.axisX, fore))
        else if (n === 'LegL1' || n === 'LegR1') b.bone.quaternion.premultiply(qa.setFromAxisAngle(b.axisX, -pose.legs * 0.4 + (n === 'LegL1' ? pose.swing : -pose.swing)))
        else if (n === 'LegL2' || n === 'LegR2') b.bone.quaternion.premultiply(qa.setFromAxisAngle(b.axisX, pose.legs))
      }
      group.position.y += lift
      group.rotation.x = 0
    },
    update(dt, t) {
      const p = player.renderPosition
      clock += dt
      near = (p.x - ringC.x) ** 2 + (p.z - ringC.z) ** 2 < (ringR + 4) ** 2
      if (!inRing(p, TRAINING.enterR + 0.5)) armed = true
      updatePad(dt, t, p)
      if (phase === 'idle') {
        pose.active = false
        if (armed && inRing(p) && !onPad(p) && !station.upgrading && canEnter() && !busy()) enter()
      } else {
        t0 += dt
        // Walking or jumping gets off (the body is frozen, but the input still reads).
        if ((phase === 'train' || phase === 'mount') && Math.hypot(inputState.move.x, inputState.move.z) > 0.4) stop()
        if ((phase === 'train' || phase === 'mount') && busy()) stop()
      }

      if (phase === 'mount') {
        // Hop up: a quick crouch, then a jump to the bar, arms swinging overhead.
        const k = Math.min(1, t0 / 0.42)
        const j = Math.max(0, (k - 0.25) / 0.75) // the jump, after a short crouch
        pose.active = true
        pose.w = ease(j)
        pose.s = 0
        pose.hop = k < 0.25 ? -0.14 * Math.sin((k / 0.25) * Math.PI) : Math.sin(j * Math.PI) * 0.3
        pose.legs = 0.3 * ease(j)
        pose.swing = 0
        if (k >= 1) {
          phase = 'train'
          t0 = 0
          cyc = 0
          station.rep()
          fx.puff(v.set(spot.x, station.gripY, spot.z), '#ffffff', 4, { size: 0.35, spread: 0.6, up: 0.2, life: 0.6, alpha: 0.5 })
        }
      } else if (phase === 'train') {
        const before = cyc * repLen()
        cyc += dt / repLen()
        const at = (cyc % 1) * repLen()
        if (before < R.up && at >= R.up) payRep()
        if (cyc >= 1) cyc -= 1
        // 0 = hanging, 1 = chin over the bar.
        let s
        if (at < R.up) s = ease(at / R.up)
        else if (at < R.up + R.hold) s = 1
        else if (at < R.up + R.hold + R.down) s = 1 - easeIn((at - R.up - R.hold) / R.down)
        else s = 0
        pose.active = true
        pose.w = 1
        pose.s = s
        pose.hop = 0
        // Knees tuck on the pull, legs sway a little.
        pose.legs = 0.3 + s * 0.5
        pose.swing = Math.sin(t * 2.2) * 0.06
        // Effort: sweat drops now and then, and a green aura rising off you.
        sweatT -= dt
        if (sweatT <= 0) {
          sweatT = 0.9 + Math.random() * 1.6
          fx.crumbs(v.set(spot.x + (Math.random() - 0.5) * 0.3, station.gripY - 0.2, spot.z + 0.15), ['#9fdcff', '#d8f3ff'], 2)
        }
        if (Math.random() < dt * (xb ? 14 : 6)) fx.motes(v.set(spot.x, 0.25, spot.z), xb ? xb.v.color : '#8dff3c', 1, 0.9, { rise: 2.2, size: 0.2, life: 1.2 })
        updateDrops(dt)
      } else if (phase === 'dismount') {
        const k = Math.min(1, t0 / 0.3)
        pose.active = true
        pose.s *= 1 - k
        pose.w = 1 - k * k
        pose.hop = 0
        pose.legs *= 1 - k
        pose.swing = 0
        if (k >= 1) {
          phase = 'idle'
          pose.active = false
          freeze(false)
          sfx.drop()
          fx.puff(v.set(spot.x, 0.12, spot.z), '#eef7d8', 6, { size: 0.5, spread: 1.4, up: 0.4, life: 0.7, alpha: 0.5 })
        }
      }

      station.update(t, dt, { active: phase === 'train' || phase === 'mount', boost: !!xb, boostColor: xb?.v.color ?? null, level: state.S.train.level, near })
    },
  }
}
