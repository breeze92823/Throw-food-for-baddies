// The Training Place. Walk into the dashed ring and you hop up onto the bar between the
// pillars and do pull-ups: each rep (pull, hold, lower) earns training XP (a "+N XP"
// pop at your head, a glock tick that climbs with the bar), every level gives Throwing
// Strength (LEVEL UP pop, rings, a beam, confetti, the strength counter bumps). Tap /
// click / Space / F / E trains 2x faster for a moment. STOP, Esc / Q, walking or jumping
// drops you off; you have to leave the ring before it takes you again.
//
// The body stays on the ground (frozen); main.js calls applyPose() after the animator
// each frame to lift the model and pose it: the hands are pinned to the bar by a 2-bone
// arm IK sized from the loaded avatar's own bones, the knees tuck on each pull.
import { Quaternion, Vector3 } from 'three'
import { TRAINING } from '../config.js'
import { inputState } from '../input.js'
import * as state from './state.js'

const qa = new Quaternion()
const wp = new Vector3()
const wp2 = new Vector3()
const ease = (x) => 1 - Math.pow(1 - x, 3)
const easeIn = (x) => x * x * (3 - 2 * x)

export function createTrainer({ fx, sfx, player, ui, station, director, freeze, syncYaw, canEnter, busy }) {
  const { spot, ringR, rep: R, boost: B } = TRAINING
  let phase = 'idle' // idle | mount | train | dismount
  let t0 = 0 // time in phase
  let armed = true // must leave the ring before it takes you again
  let cyc = 0 // 0..1 through the current rep
  let boostT = 0
  let taps = 0
  let near = false
  let sweatT = 0
  let boostShown = false
  // w: how much you hang on the bar (0 standing .. 1), s: how far up the pull is (0 .. 1),
  // hop: extra height (the jump up), legs: knee tuck, swing: leg sway.
  const pose = { active: false, w: 0, s: 0, hop: 0, legs: 0, swing: 0 }
  let arm = null // cached rig lookups: { rig, L1, L2, bones }
  const v = new Vector3()

  const inRing = (p, r = ringR) => (p.x - spot.x) ** 2 + (p.z - spot.z) ** 2 < r * r && p.y < 1.5
  const repLen = () => R.up + R.hold + R.down + R.rest

  function syncUi(animate = true) {
    ui.setLevel(state.S.train.level, state.S.train.xp, state.trainNeed(), { animate })
  }

  function enter() {
    phase = 'mount'
    t0 = 0
    cyc = 0
    armed = false
    taps = 0
    freeze(true)
    player.facing = TRAINING.facing
    syncYaw()
    ui.show(true)
    syncUi(false)
    sfx.grab()
    fx.puff(v.set(spot.x, 0.15, spot.z), '#eef7d8', 6, { size: 0.5, spread: 1.2, up: 0.5, life: 0.7, alpha: 0.5 })
  }
  function stop() {
    if (phase !== 'mount' && phase !== 'train') return
    phase = 'dismount'
    t0 = 0
    boostT = 0
    boostShown = false
    ui.boost(false)
    ui.show(false)
  }
  function tap() {
    if (phase !== 'train' && phase !== 'mount') return
    boostT = B.window
    taps++
    if (taps === 4) ui.learned()
    ui.tapped()
    ui.boost(true)
    sfx.boost()
  }

  // The top of a pull-up: pay out.
  function payRep() {
    const head = v.set(spot.x, station.gripY + 0.35, spot.z)
    const boosted = boostT > 0
    const { xp, levels } = state.trainRep()
    sfx.rep(boosted)
    station.rep()
    fx.text(`+${xp} XP`, head.clone().add(new Vector3((Math.random() - 0.5) * 0.8, 0.5, 0)), boosted ? '#7fe8ff' : '#59b8ff', { height: 0.62, life: 1.0, rise: 1.6 })
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
    tap,
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
      near = inRing(p, ringR + 4)
      if (!inRing(p, ringR + 0.4)) armed = true
      boostT = Math.max(0, boostT - dt)
      if (phase === 'idle') {
        pose.active = false
        if (armed && inRing(p) && canEnter() && !busy()) enter()
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
        const speed = boostT > 0 ? B.mult : 1
        const before = cyc * repLen()
        cyc += (dt * speed) / repLen()
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
        if (boostShown !== boostT > 0) {
          boostShown = boostT > 0
          ui.boost(boostShown)
        }
        // Effort: sweat drops now and then, and a green aura rising off you.
        sweatT -= dt
        if (sweatT <= 0) {
          sweatT = 0.9 + Math.random() * 1.6
          fx.crumbs(v.set(spot.x + (Math.random() - 0.5) * 0.3, station.gripY - 0.2, spot.z + 0.15), ['#9fdcff', '#d8f3ff'], 2)
        }
        if (Math.random() < dt * (boostT > 0 ? 14 : 6)) fx.motes(v.set(spot.x, 0.25, spot.z), boostT > 0 ? '#ffe14a' : '#8dff3c', 1, 0.9, { rise: 2.2, size: 0.2, life: 1.2 })
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

      station.update(t, dt, { active: phase === 'train' || phase === 'mount', boost: boostT > 0, level: state.S.train.level, near })
    },
  }
}
