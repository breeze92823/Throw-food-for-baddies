// The other players of the room, drawn in the hub: their Bloxity avatar (skin, hat, proportions),
// locomotion / jump animation, the arm poses (food held up while aiming, a baddie carried in the
// arms), emotes, chat bubbles, the food they throw (flying down the lane with its trail and landing
// burst) and the baddies in their base. Everything is fed by the server roster (net.js: the live
// PlayerState of each player) plus the relayed `throwFx` / `emoteFx` events; nothing here talks to
// the network.
//
// Kept cheap: at most BASE_COUNT - 1 remotes; one animator each, ticked at a third of the rate when
// far away and skipped (hidden) beyond REMOTE.hideDist; particles only near the local player; the
// pen contents reuse Pen's own (already throttled) baddie simulation.
import * as THREE from 'three'
import { Group, Quaternion, Vector3 } from 'three'
import { PLAYER_DIMS, REMOTE } from './config.js'
import * as bloxity from './bloxity.js'
import { buildDefaultCharacter, loadBaseCharacter } from './avatar/character.js'
import { applyProportions, attachEquippedAccessories } from './avatar/loader.js'
import { disposeAnimator, makeAnimator } from './avatar/animator.js'
import { EmotePlayer } from './avatar/emotes.js'
import { dynLabel } from './hub/dynlabel.js'
import { Baddie } from './game/baddieModel.js'
import { foodColors, foodMesh } from './game/foods.js'

const rotQ = new Quaternion()
const tmp = new Vector3()

class RemotePlayer {
  constructor(mgr, id, p) {
    this.mgr = mgr
    this.id = id
    this.p = p // the live PlayerState
    this.group = new Group()
    mgr.scene.add(this.group)
    this.pos = new Vector3(p.x, p.y, p.z)
    this.yaw = p.yaw
    this.speed = 0
    this.lookSig = null
    this.gen = 0
    this.dead = false
    this.swing = 0 // 1 -> 0 while the throw whip plays
    this.heldId = ''
    this.held = null
    this.carryKey = ''
    this.carried = null
    this.skip = 0
    this.bubble = null
    this.bubbleT = 0
    this.nameSig = null
    this.label = dynLabel(0.55, { lines: 1, width: 520 })
    this.label.sprite.position.set(0, PLAYER_DIMS.height + 0.9, 0)
    this.group.add(this.label.sprite)
    this.setAvatar(buildDefaultCharacter())
    this.group.position.copy(this.pos)
  }

  setAvatar(next) {
    if (this.avatar) this.group.remove(this.avatar)
    disposeAnimator(this.animator)
    this.held?.removeFromParent()
    this.held = null
    this.heldId = ''
    this.avatar = next
    this.group.add(next)
    this.emotes = new EmotePlayer(next) // while still in the bind pose
    this.animator = makeAnimator(next)
    const find = (name) => this.animator?.rig.bindings.find((b) => b.bone.name === name) ?? null
    this.armR = find('ArmR1')
    this.armL = find('ArmL1')
  }

  // The Bloxity look the server relays as JSON { equipped, proportions }: skin texture, replaced
  // body parts, hat and back items, proportions. "" = the default look.
  async loadLook(sig) {
    this.lookSig = sig
    const mine = ++this.gen
    let look = null
    try {
      look = sig ? JSON.parse(sig) : null
    } catch {
      look = null
    }
    try {
      const group = await loadBaseCharacter()
      if (look?.equipped) await attachEquippedAccessories(group, look.equipped, { skinTextureUrl: bloxity.skinTextureUrlFor(look.equipped) })
      if (mine !== this.gen || this.dead) return
      applyProportions(group, look?.proportions ?? null)
      this.setAvatar(group)
    } catch (err) {
      console.warn('[remote] look failed', err)
    }
  }

  playEmote(id) {
    if (!id) return this.emotes?.stop()
    const clip = this.mgr.emoteCatalogue?.get(id)
    if (clip) this.emotes?.play(clip, id)
  }

  say(text) {
    this.bubble?.remove?.()
    this.bubble = bloxity.attachChatBubble(THREE, this.group, text)
  }

  // The food in the right hand while aiming (a child of the hand bone: it follows the arm).
  syncHeld(show) {
    const id = show ? this.p.food : ''
    if (id === this.heldId) return
    this.heldId = id
    this.held?.removeFromParent()
    this.held = null
    if (!id || !this.armR) return
    this.held = new Group()
    this.held.add(foodMesh(id))
    const k = 1 / (this.avatar.scale.x || 1)
    this.held.scale.setScalar(k)
    this.held.position.set(0, -2.6, 0.3)
    this.armR.bone.add(this.held)
  }

  syncCarry() {
    const key = this.p.carry
    if (key === this.carryKey) return
    this.carryKey = key
    this.carried?.dispose()
    this.carried = null
    if (!key) return
    const [id, size] = key.split(':')
    try {
      this.carried = new Baddie(id, Number(size) || 0, { showLabel: false })
      this.carried.mode = 'fly'
      this.mgr.scene.add(this.carried.group)
    } catch {
      this.carried = null
    }
  }

  update(dt, t, d2) {
    const p = this.p
    const hide = d2 > REMOTE.hideDist * REMOTE.hideDist
    this.group.visible = !hide
    const px = this.pos.x
    const pz = this.pos.z
    // Smooth the ~10 Hz pose; snap after a teleport / respawn.
    const dx = p.x - px
    const dz = p.z - pz
    if (dx * dx + dz * dz > 900) this.pos.set(p.x, p.y, p.z)
    else this.pos.lerp(tmp.set(p.x, p.y, p.z), 1 - Math.exp(-REMOTE.follow * dt))
    this.yaw += Math.atan2(Math.sin(p.yaw - this.yaw), Math.cos(p.yaw - this.yaw)) * (1 - Math.exp(-14 * dt))
    const v = dt > 0 ? Math.hypot(this.pos.x - px, this.pos.z - pz) / dt : 0
    this.speed += (Math.min(v, 30) - this.speed) * (1 - Math.exp(-12 * dt))
    this.group.position.copy(this.pos)
    this.group.rotation.set(p.lean, this.yaw, 0)
    if (this.carried) this.placeCarried(dt, t)
    if (hide) return

    if (p.avatar !== this.lookSig) void this.loadLook(p.avatar)
    const name = p.username || 'Player'
    if (name !== this.nameSig) {
      this.nameSig = name
      this.label.set([{ text: name, color: '#ffffff' }])
    }
    this.label.sprite.visible = d2 < REMOTE.labelDist * REMOTE.labelDist
    this.syncCarry()

    // Far players animate at a third of the rate.
    const far = d2 > REMOTE.farDist * REMOTE.farDist
    this.skip += dt
    if (!far || this.skip > 0.05) {
      const step = far ? this.skip : dt
      this.skip = 0
      this.animator?.update(step, { grounded: p.grounded, speed: this.speed, verticalVelocity: p.vy, turn: 0 })
      if (this.emotes?.active) {
        if (this.speed > 1.5 || !p.grounded) this.emotes.stop()
        else this.emotes.apply(step)
      }
      this.applyArms(step, t)
    }
    this.syncHeld(p.act === 'aim' && this.swing <= 0)
  }

  // Right arm: the throw whip, food held up while aiming, or the carrying pose; left arm up while
  // carrying (the same angles the local player uses).
  applyArms(dt, t) {
    if (this.emotes?.active) return
    const p = this.p
    let arm = null
    if (this.swing > 0) {
      arm = -3.5 + (1 - this.swing) * 3.2
      this.swing = Math.max(0, this.swing - dt / 0.35)
    } else if (p.act === 'aim') arm = -2.85 + Math.sin(t * 4) * 0.06
    else if (p.armOn) arm = p.arm
    else if (p.carry) arm = -1.35
    if (this.armR && arm != null) {
      rotQ.setFromAxisAngle(this.armR.axisX, arm)
      this.armR.bone.quaternion.premultiply(rotQ)
    }
    if (this.armL && p.carry) {
      rotQ.setFromAxisAngle(this.armL.axisX, -1.35)
      this.armL.bone.quaternion.premultiply(rotQ)
    }
  }

  placeCarried(dt, t) {
    const fx = Math.sin(this.yaw)
    const fz = Math.cos(this.yaw)
    const b = this.carried
    b.group.position.set(this.pos.x + fx * 0.95, this.pos.y + 0.5 + Math.sin(t * 3) * 0.05, this.pos.z + fz * 0.95)
    b.group.rotation.y = this.yaw
    b.update(dt)
  }

  dispose() {
    this.dead = true
    this.gen++
    this.bubble?.remove?.()
    this.carried?.dispose()
    disposeAnimator(this.animator)
    this.group.removeFromParent()
    this.label.sprite.material?.map?.dispose?.()
  }
}

// A thrown food in flight: the same arc as the thrower's (from -> to over dur with a parabolic
// peak), a sparkle trail while near, a burst of crumbs and chunks on landing.
class Flight {
  constructor(scene, e) {
    this.e = e
    this.t = 0
    this.mesh = foodMesh(e.food)
    this.mesh.scale.setScalar(1.35)
    this.mesh.position.set(e.from.x, e.from.y, e.from.z)
    scene.add(this.mesh)
    this.colors = foodColors(e.food)
  }
}

export function createRemotePlayers(scene, { fx, sfx, pens, localPos }) {
  const remotes = new Map() // sessionId -> RemotePlayer
  const flights = []
  const mgr = { scene, emoteCatalogue: null }
  let first = true
  void bloxity.loadEmotes().then((c) => (mgr.emoteCatalogue = c))

  // Roster changes (net.onRoster): remotes appear / leave.
  function sync(list) {
    const seen = new Set()
    for (const e of list) {
      if (e.me) continue
      seen.add(e.id)
      if (!remotes.has(e.id)) {
        remotes.set(e.id, new RemotePlayer(mgr, e.id, e.p))
        if (e.name) (first ? bloxity.playerInRoom : bloxity.playerJoined)(e.name)
      }
    }
    first = false
    for (const [id, r] of remotes) {
      if (seen.has(id)) continue
      pens[r.p.base]?.syncRemote('', 0)
      r.dispose()
      remotes.delete(id)
    }
  }

  function throwFx(e) {
    const r = remotes.get(e.sid)
    if (r) {
      r.swing = 1
      r.syncHeld(false)
    }
    const flight = new Flight(scene, e)
    flight.base = r?.p.base
    flights.push(flight)
    if (flights.length > 12) landFlight(flights.shift()) // a flood of throws: finish the oldest
  }

  function emoteFx(e) {
    remotes.get(e.sid)?.playEmote(e.id)
  }

  // A Bloxity chat message: a bubble over the matching player (the server's roster carries the
  // Bloxity id of signed-in players).
  function chat(m) {
    const text = bloxity.chatText(m)
    for (const r of remotes.values()) {
      if (r.p.uid && String(m.userId).replace(/^legion_/, '') === r.p.uid) r.say(text)
    }
  }

  function landFlight(f) {
    const { e } = f
    const at = tmp.set(e.to.x, e.to.y - 0.25, e.to.z)
    const near = localPos().distanceToSquared(at) < REMOTE.fxDist * REMOTE.fxDist
    if (near) {
      fx.ring(at, f.colors[0] ?? '#ffffff', { r0: 0.5, r1: 7, life: 0.7 })
      fx.puff(at, '#fff8e8', 12, { size: 1, spread: 3.5, up: 1.2, life: 1, alpha: 0.6 })
      fx.crumbs(at, f.colors, 26)
      fx.chunks(tmp.set(e.to.x, e.to.y, e.to.z), f.colors, 18, { power: 0.75 + e.power * 0.4, floor: e.to.y - 0.4 })
      fx.sparkle(at, '#ffffff', 16, { speed: 6, up: 3 })
      sfx.impact?.(0.25)
    }
    pens[f.base]?.celebrate() // their baddies cheer (local only, not synced)
    f.mesh.removeFromParent()
  }

  function update(dt, t) {
    const me = localPos()
    for (const r of remotes.values()) {
      const dx = r.p.x - me.x
      const dz = r.p.z - me.z
      r.update(dt, t, dx * dx + dz * dz)
      // The base shows what the player placed in it (changes only).
      const pen = pens[r.p.base]
      if (pen && !pen.isPlayer && (pen.remoteSig !== r.p.pen || pen.remoteIncome !== r.p.income)) pen.syncRemote(r.p.pen, r.p.income)
    }
    for (let i = flights.length - 1; i >= 0; i--) {
      const f = flights[i]
      const { e } = f
      f.t += dt
      const u = Math.min(1, f.t / e.dur)
      f.mesh.position.set(
        e.from.x + (e.to.x - e.from.x) * u,
        e.from.y + (e.to.y - e.from.y) * u + 4 * e.peak * u * (1 - u),
        e.from.z + (e.to.z - e.from.z) * u,
      )
      f.mesh.rotation.x -= dt * 14
      f.mesh.rotation.z += dt * 3
      if (me.distanceToSquared(f.mesh.position) < REMOTE.fxDist * REMOTE.fxDist) {
        fx.trail(f.mesh.position, f.colors[0] ?? '#ffffff')
        if (Math.random() < dt * 20) fx.sparkle(f.mesh.position, e.lucky ? '#ffe14a' : '#ffffff', 2, { speed: 1.5, up: 0.5, size: 0.3, life: 0.5 })
      }
      if (u >= 1) {
        landFlight(f)
        flights.splice(i, 1)
      }
    }
  }

  function dispose() {
    for (const r of remotes.values()) r.dispose()
    remotes.clear()
    for (const f of flights) f.mesh.removeFromParent()
    flights.length = 0
  }

  return {
    sync,
    update,
    throwFx,
    emoteFx,
    chat,
    dispose,
    get count() {
      return remotes.size
    },
    get flying() {
      return flights.length
    },
  }
}
