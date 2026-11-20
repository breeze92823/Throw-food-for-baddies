// The five fenced pens along the south side. Each has an orange stud floor, a
// wooden fence with a gate gap, a gate arch with a dashed drop spot, a capacity
// sign, the Training Bench's upgrade pad, and the owner's round badge floating over the back with
// their income. The middle pen is the player's; its baddies mirror state.S.baddies.
// Baddies wander inside the fence, look at the player, dance now and then. When you come
// close they try to charm you: they turn to you, drift over, and wave, blow kisses (a heart
// flies to you), make heart hands, twirl, strike a peace pose, sway shyly or curtsy, each with
// its particles and sound; every girl also sheds her area's particles (petals, snow, embers...).
import { CanvasTexture, CylinderGeometry, Group, Mesh, MeshStandardMaterial, PlaneGeometry, Sprite, SpriteMaterial, SRGBColorSpace, Vector3 } from 'three'
import { NEIGHBOURS, PENS, POI, RARITIES, SIZES, TRAINING } from '../config.js'
import { label, solidBox } from '../propkit.js'
import { cbox, ccyl, flat, merge } from '../hub/geo.js'
import { dynLabel } from '../hub/dynlabel.js'
import { paintBadge, paintPlanks } from '../hub/paint.js'
import { dashedRing } from '../hub/props.js'
import { studMaterial } from '../hub/world.js'
import { APPEAL_SFX } from '../audio/girlSfx.js'
import { BY_ID, Baddie } from './baddieModel.js'
import { fmt } from './format.js'

// What one of your own pen's entries earns (main.js sets it to state.baddieIncome; a module
// hook so this file does not import the game state).
let incomeOf = null
export const setIncomeFn = (fn) => (incomeOf = fn)

const vc = new MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })
const rnd = (a, b) => a + Math.random() * (b - a)
// Appeal moves, weighted: close to the player (flirty) and from across the pen (showing off).
const CLOSE_MOVES = [['kiss', 26], ['heart', 20], ['wave', 16], ['pose', 14], ['shy', 12], ['twirl', 7], ['curtsy', 5]]
const FAR_MOVES = [['wave', 30], ['twirl', 25], ['curtsy', 15], ['heart', 15], ['pose', 15]]
function pickMove(list) {
  let r = Math.random() * list.reduce((s, m) => s + m[1], 0)
  for (const [m, w] of list) if ((r -= w) <= 0) return m
  return list[0][0]
}
const tmpV = new Vector3()
const tmpW = new Vector3()

function fenceParts(parts, cx, cz) {
  const { halfW: W, halfD: D } = PENS
  const post = '#6b3b1e'
  const rail = '#8f5428'
  const gate = 2.2 // half-width of the gate gap
  const y0 = PENS.floorHeight
  const postAt = (x, z) => {
    parts.push(cbox(0.42, 1.35, 0.42, post, cx + x, y0 + 0.67, cz + z))
    parts.push(ccyl(0.13, 0.13, 0.1, post, cx + x, y0 + 1.4, cz + z, 0, 0, 0, 8)) // stud cap
  }
  const railX = (x0, x1, z) => {
    for (const y of [0.55, 1.05]) parts.push(cbox(x1 - x0, 0.18, 0.16, rail, cx + (x0 + x1) / 2, y0 + y, cz + z))
  }
  const railZ = (z0, z1, x) => {
    for (const y of [0.55, 1.05]) parts.push(cbox(0.16, 0.18, z1 - z0, rail, cx + x, y0 + y, cz + (z0 + z1) / 2))
  }
  for (let x = -W; x <= W + 0.01; x += 2) {
    postAt(x, D)
    if (Math.abs(x) >= gate - 0.01) postAt(x, -D)
  }
  for (let z = -D + 2; z <= D - 0.01; z += 2) {
    postAt(-W, z)
    postAt(W, z)
  }
  railX(-W, W, D)
  railX(-W, -gate, -D)
  railX(gate, W, -D)
  railZ(-D, D, -W)
  railZ(-D, D, W)
  // Colliders: three full sides and the front either side of the gate.
  const h = 0.8
  solidBox(W, h, 0.2, cx, y0 + h, cz + D)
  solidBox(0.2, h, D, cx - W, y0 + h, cz)
  solidBox(0.2, h, D, cx + W, y0 + h, cz)
  solidBox((W - gate) / 2, h, 0.2, cx - (W + gate) / 2, y0 + h, cz - D)
  solidBox((W - gate) / 2, h, 0.2, cx + (W + gate) / 2, y0 + h, cz - D)
}

// Gate arch: two chunky stacked posts with a pale crossbar.
function gateParts(parts, x, z) {
  const brown = '#8a5128'
  const light = '#a5642f'
  for (const s of [-1, 1]) {
    for (let i = 0; i < 5; i++) parts.push(cbox(0.75, 0.62, 0.75, i % 2 ? light : brown, x + s * 2.4, 0.31 + i * 0.62, z))
    parts.push(cbox(0.9, 0.2, 0.9, '#6b3b1e', x + s * 2.4, 3.2, z))
  }
  parts.push(cbox(5.4, 0.3, 0.4, '#d8e0ea', x, 2.75, z))
  parts.push(cbox(5.4, 0.08, 0.42, '#ffffff', x, 2.92, z))
}

// The capacity sign: wooden board on two legs with a canvas face.
function makeSign(root, x, z) {
  const g = new Group()
  g.position.set(x, 0, z)
  g.rotation.y = 0
  const p = []
  for (const s of [-1, 1]) p.push(cbox(0.2, 1.1, 0.2, '#6b3b1e', s * 1.0, 0.55, 0))
  p.push(cbox(2.7, 1.2, 0.14, '#8a5128', 0, 1.55, 0))
  const m = new Mesh(merge(p), vc)
  m.castShadow = m.receiveShadow = true
  g.add(m)
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 224
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const face = new Mesh(new PlaneGeometry(2.55, 1.1), new MeshStandardMaterial({ map: tex, roughness: 0.8 }))
  face.position.set(0, 1.55, -0.08)
  face.rotation.y = Math.PI // faces north (the open meadow)
  g.add(face)
  root.add(g)
  const planks = paintPlanks(512, 224)
  let bang = null
  return {
    group: g,
    draw(cap, next, cost, affordable, maxed) {
      const x2 = c.getContext('2d')
      x2.drawImage(planks, 0, 0)
      x2.textAlign = 'center'
      x2.textBaseline = 'middle'
      x2.lineJoin = 'round'
      x2.font = '700 88px Fredoka, sans-serif'
      x2.lineWidth = 14
      x2.strokeStyle = '#3a2210'
      const t = maxed ? `${cap} MAX` : `${cap} > ${next}`
      x2.strokeText(t, 256, 74)
      x2.fillStyle = '#ffffff'
      x2.fillText(t, 256, 74)
      if (!maxed) {
        x2.fillStyle = affordable ? '#4fd23a' : '#7a8a74'
        x2.beginPath()
        x2.roundRect(56, 138, 400, 66, 14)
        x2.fill()
        x2.strokeStyle = 'rgba(0,0,0,0.35)'
        x2.lineWidth = 5
        x2.stroke()
        x2.font = '700 50px Fredoka, sans-serif'
        x2.lineWidth = 10
        x2.strokeStyle = '#1a3a10'
        const cs = `▲ $${fmt(cost)}`
        x2.strokeText(cs, 256, 172)
        x2.fillStyle = '#ffffff'
        x2.fillText(cs, 256, 172)
      }
      tex.needsUpdate = true
      if (affordable && !maxed && !bang) {
        bang = label('!', 0.9, { color: '#ffd93b', outline: '#3a2a00', outlineWidth: 18 })
        bang.position.set(1.6, 2.4, 0)
        g.add(bang)
      } else if ((!affordable || maxed) && bang) {
        bang.removeFromParent()
        bang = null
      }
    },
    update(t) {
      if (bang) bang.position.y = 2.4 + Math.abs(Math.sin(t * 4)) * 0.25
    },
  }
}

function makePad(root, x, z) {
  const g = new Group()
  g.position.set(x, 0, z)
  const rim = new Mesh(new CylinderGeometry(1.85, 1.95, 0.22, 40), studMaterial('#6a4bc4', '#5f42b2', { tile: 1, seed: 61, seam: 0.05 }))
  rim.position.y = 0.11
  const top = new Mesh(new CylinderGeometry(1.6, 1.6, 0.3, 40), studMaterial('#ffd93b', '#f5cc2a', { tile: 1.2, seed: 62, seam: 0.05 }))
  top.position.y = 0.17
  rim.receiveShadow = top.receiveShadow = true
  rim.castShadow = true
  g.add(rim, top)
  // The Training Bench's upgrade pad: "UPGRADE > +N XP/s", the XP/s now, the price.
  const text = dynLabel(0.75, { lines: 3, width: 640 })
  text.sprite.position.set(0, 2.75, 0)
  g.add(text.sprite)
  root.add(g)
  return { group: g, text, top }
}

export class Pen {
  // mine: the index of the player's own base (assigned by the server online). online: other
  // bases belong to real players (setOccupant), not the offline stand-ins in NEIGHBOURS.
  constructor(root, index, { mine = PENS.playerIndex, online = false } = {}) {
    this.index = index
    this.cx = PENS.xs[index]
    this.cz = PENS.z
    this.isPlayer = index === mine
    this.online = online
    this.owner = this.isPlayer || online ? null : NEIGHBOURS[index]
    this.front = new Vector3(this.cx, 0, this.cz - PENS.halfD)
    this.baddies = new Map() // uid -> { b: Baddie, target, wait, entry }
    this.group = new Group()
    root.add(this.group)
    // Floor.
    const floorMat = studMaterial('#f2955a', '#e98a4c', { seed: 9 })
    const { halfW: W, halfD: D, floorHeight: H } = PENS
    const fl = new Mesh(flat(this.cx - W, this.cx + W, this.cz - D, this.cz + D, H, 4), floorMat)
    fl.receiveShadow = true
    this.group.add(fl)
    const edge = new Mesh(merge([cbox(W * 2 + 0.2, H, D * 2 + 0.2, '#d97a3e', this.cx, H / 2 - 0.01, this.cz)]), vc)
    edge.receiveShadow = true
    this.group.add(edge)
    solidBox(W, H / 2, D, this.cx, H / 2, this.cz)
    const parts = []
    fenceParts(parts, this.cx, this.cz)
    const gx = this.cx + POI.gateOffset.x
    const gz = this.front.z - 2.2
    gateParts(parts, gx, gz)
    for (const s of [-1, 1]) solidBox(0.4, 1.7, 0.4, gx + s * 2.4, 1.7, gz)
    const fence = new Mesh(merge(parts), vc)
    fence.castShadow = fence.receiveShadow = true
    this.group.add(fence)
    const dash = dashedRing(2.1)
    dash.position.set(gx, 0, gz - 1.2)
    this.group.add(dash)
    this.dropSpot = new Vector3(gx, 0, gz - 1.2)
    this.sign = makeSign(this.group, this.front.x + PENS.halfW - 1.8, this.front.z - POI.signOffset.z - 0.3)
    this.signSpot = new Vector3(this.front.x + PENS.halfW - 1.8, 0, this.front.z - 2.2)
    this.pad = makePad(this.group, this.front.x + POI.padOffset.x, this.front.z + POI.padOffset.z)
    this.padSpot = this.pad.group.position
    // Owner badge + name + income.
    const look = this.owner ?? { skin: '#f2c79a', hair: '#5a3418', shirt: '#2f2f3a' }
    const badgeCanvas = paintBadge({ skin: look.skin, hair: look.hair, shirt: look.shirt, bg: this.isPlayer ? '#4a3a8a' : '#2b3a66' })
    this.badgeTex = new CanvasTexture(badgeCanvas)
    this.badgeTex.colorSpace = SRGBColorSpace
    this.badge = new Sprite(new SpriteMaterial({ map: this.badgeTex, transparent: true, depthWrite: false }))
    this.badge.scale.set(4.2, 4.2, 1)
    this.badge.position.set(this.cx, 10.5, this.cz + D - 1)
    this.group.add(this.badge)
    this.badgeCanvas = badgeCanvas
    this.info = dynLabel(1.0, { lines: 2, width: 760 })
    this.info.sprite.position.set(this.cx, 7.3, this.cz + D - 1)
    this.group.add(this.info.sprite)
    this.name = this.owner?.name ?? 'You'
    this.setIncome(0)
    if (!this.isPlayer && !this.owner) {
      // Online and not yours: a base for another player. Nothing to show but who sits here.
      this.sign.group.visible = false
      this.pad.group.visible = false
      this.setOccupant(null)
    } else if (!this.isPlayer) {
      // Neighbour plots: their sign shows a sample upgrade, their pad a small pile.
      const cap = this.owner.team.length + 2
      this.sign.draw(cap, cap + 2, 1000 * Math.pow(4, cap / 2), false, false)
      const b = TRAINING.benches[Math.min(TRAINING.benches.length - 2, index)]
      const nb = TRAINING.benches[Math.min(TRAINING.benches.length - 1, index + 1)]
      this.pad.text.set([{ text: `UPGRADE ▶ +${fmt(nb.xps, 0)} XP/s`, color: '#ffd23a', scale: 0.55 }, { text: `+${fmt(b.xps, 0)} XP/s`, color: '#59b8ff' }, { text: `$${fmt(nb.price)}`, color: '#7dff4a' }])
      for (const id of this.owner.team) this.add({ uid: `n${index}-${id}`, id, size: 0 })
      this.setIncome(this.owner.team.reduce((s, id) => s + BY_ID[id].income, 0))
    }
  }

  setName(name) {
    this.name = name
    this.setIncome(this.incomeShown ?? 0)
  }

  setIncome(v) {
    this.incomeShown = v
    this.info.set([{ text: this.name, color: '#ffffff' }, { text: `$${fmt(v)}/s`, color: '#7dff4a' }])
  }

  setBadgeImage(img) {
    const c = paintBadge({ img, bg: this.isPlayer ? '#4a3a8a' : '#2b3a66' })
    this.badgeTex.image = c
    this.badgeTex.needsUpdate = true
  }

  // Online, another player's base: who sits here (info { name, pfp }) or null = free base. Taken
  // bases show the player's name and picture; free ones are dimmed.
  setOccupant(info) {
    if (this.isPlayer) return
    const key = info ? `${info.name}|${info.pfp}` : ''
    if (key === this.occupantKey) return
    this.occupantKey = key
    this.badge.material.opacity = info ? 1 : 0.4
    this.badgeTex.image = this.badgeCanvas
    this.badgeTex.needsUpdate = true
    this.name = info ? info.name || 'Player' : 'Free base'
    this.info.set([
      { text: this.name, color: info ? '#ffffff' : '#9fb0c8' },
      info && this.remoteIncome != null
        ? { text: `$${fmt(this.remoteIncome)}/s`, color: '#7dff4a' }
        : { text: info ? `Base ${this.index + 1}` : 'Waiting for a player', color: info ? '#ffd84a' : '#7a8aa0' },
    ])
    if (info?.pfp) {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        if (this.occupantKey === key) this.setBadgeImage(img) // still the same player; a CORS-blocked picture keeps the drawn badge
      }
      img.src = info.pfp
    }
  }

  // Online, another player's base: shows the baddies they placed (`str` = "id:size,id:size" from the
  // roster) with their own wandering / appeal animations and particles, and their income on the
  // sign. Only the difference is applied: new ones drop in, missing ones are removed.
  syncRemote(str, income) {
    if (this.isPlayer) return
    const first = this.remoteSig === undefined
    this.remoteSig = str
    this.remoteIncome = income
    this.remoteUids ||= new Map() // uid -> "id:size"
    const want = new Map()
    for (const key of str ? str.split(',') : []) want.set(key, (want.get(key) ?? 0) + 1)
    for (const [uid, key] of this.remoteUids) {
      const n = want.get(key) ?? 0
      if (n > 0) want.set(key, n - 1)
      else {
        this.remove(uid)
        this.remoteUids.delete(uid)
      }
    }
    for (const [key, n] of want) {
      const [id, size, v] = key.split(':')
      if (!BY_ID[id]) continue
      for (let i = 0; i < n; i++) {
        const uid = `r${this.index}-${(this.remoteSeq = (this.remoteSeq ?? 0) + 1)}`
        this.add({ uid, id, size: Number(size) || 0, v: Number(v) || 0 }, { drop: !first })
        this.remoteUids.set(uid, key)
      }
    }
    if (this.occupantKey) {
      this.info.set([
        { text: this.name, color: '#ffffff' },
        { text: `$${fmt(income || 0)}/s`, color: '#7dff4a' },
      ])
    }
  }

  // A local-only reaction (never synced): every baddie of this base cheers and hops, a little out
  // of step. Used when another player's throw lands.
  celebrate() {
    for (const r of this.baddies.values()) {
      if (r.drop > 0 || r.b.busy()) continue
      setTimeout(() => {
        if (this.baddies.get(r.entry.uid) !== r || r.drop > 0 || r.b.busy()) return
        r.b.mode = 'cheer'
        r.wait = rnd(1.4, 2.6)
        r.b.hop()
      }, rnd(0, 700))
    }
  }

  randomSpot(margin = 1.4) {
    return new Vector3(this.cx + rnd(-PENS.halfW + margin, PENS.halfW - margin), PENS.floorHeight, this.cz + rnd(-PENS.halfD + margin, PENS.halfD - margin))
  }

  // entry: { uid, id, size }. from: optional world position it arrives from (drops in).
  // at: place it there (hand placement) with a short hop down instead of a random spot.
  add(entry, { drop = false, at = null } = {}) {
    const b = new Baddie(entry.id, entry.size, { variant: entry.v | 0, income: this.isPlayer ? (incomeOf?.(entry) ?? null) : null })
    const spot = at ? new Vector3(at.x, PENS.floorHeight, at.z) : this.randomSpot()
    b.group.position.copy(spot)
    b.group.rotation.y = rnd(-Math.PI, Math.PI)
    const rec = { b, entry, target: this.randomSpot(), wait: rnd(0.5, 4), drop: drop ? 1 : 0, home: spot.clone(), danceT: 0, appealIn: rnd(1.5, 6), fxIn: rnd(0, 1) }
    if (drop) b.group.position.y = at ? PENS.floorHeight + 2.2 : 14
    if (at) {
      rec.target = spot.clone()
      rec.wait = 1.4
    }
    this.group.add(b.group)
    this.baddies.set(entry.uid, rec)
    return rec
  }

  remove(uid) {
    const r = this.baddies.get(uid)
    if (!r) return null
    r.b.dispose()
    this.baddies.delete(uid)
    return r
  }

  positionOf(uid, out = new Vector3()) {
    const r = this.baddies.get(uid)
    return r ? out.copy(r.b.group.position) : out.copy(this.front)
  }

  update(dt, t, playerPos, fx, near) {
    this.sign.update(t)
    if (!near) {
      // Far away pens only tick their animations every other frame worth of time.
      this.skip = !this.skip
      if (this.skip) return
      dt *= 2
    }
    const list = [...this.baddies.values()]
    for (const r of list) {
      const b = r.b
      const p = b.group.position
      if (r.drop > 0) {
        // Dropping in from the sky after a catch.
        b.mode = 'fly'
        p.y = Math.max(PENS.floorHeight, p.y - dt * 22)
        if (p.y <= PENS.floorHeight) {
          r.drop = 0
          b.mode = 'cheer'
          r.wait = 1.6
          r.landed = true
          fx?.ring(p, RARITIES[b.def.rarity].glow, { r0: 0.4, r1: 3.5 })
          fx?.puff(p, '#ffe9c9', 10, { size: 0.6, spread: 2.5, up: 0.6 })
        }
        b.update(dt)
        continue
      }
      const px = playerPos.x - p.x
      const pz = playerPos.z - p.z
      const pd2 = px * px + pz * pz
      const close = near && pd2 < 81
      // Area particles drifting off her.
      if (fx && near) {
        r.fxIn -= dt
        if (r.fxIn <= 0) {
          r.fxIn = rnd(0.7, 1.6) / (b.def.look.glow ? 2 : 1)
          const L = b.def.look
          fx.themed(L.fx, tmpV.set(p.x + rnd(-0.7, 0.7), p.y + rnd(0.4, b.height * 1.1), p.z + rnd(-0.7, 0.7)), L.fxColors)
        }
      }
      // An appeal move in progress: face the player, play it out, fire its effects on cue.
      if (b.busy()) {
        b.speed = 0
        if (close) turnTo(b.group, Math.atan2(px, pz), dt * 6)
        this.cue(b, b.takeCue(), playerPos, fx, close, Math.sqrt(pd2))
        b.update(dt)
        continue
      }
      if (APPEAL_SFX[b.mode]) {
        b.mode = 'idle'
        r.wait = rnd(0.6, 2)
      }
      r.appealIn -= dt * (close ? 1 : 0.35)
      if (r.appealIn <= 0 && r.wait > 0 && near) {
        r.appealIn = close ? rnd(2.5, 6) : rnd(6, 14)
        b.appeal(pickMove(close ? CLOSE_MOVES : FAR_MOVES))
        b.update(dt)
        continue
      }
      const dx = r.target.x - p.x
      const dz = r.target.z - p.z
      const d = Math.hypot(dx, dz)
      if (r.wait > 0) {
        r.wait -= dt
        b.speed = 0
        if (b.mode === 'walk') b.mode = 'idle'
        if (r.wait <= 0) {
          if (b.mode === 'dance' || b.mode === 'cheer') b.mode = 'idle'
          r.target = this.randomSpot()
          // With you standing in the pen she drifts over to you.
          if (close && this.inside(playerPos) && Math.random() < 0.45) {
            const a = Math.random() * Math.PI * 2
            const rr = rnd(1.6, 2.6)
            r.target.set(playerPos.x + Math.cos(a) * rr, PENS.floorHeight, playerPos.z + Math.sin(a) * rr)
            this.clampSpot(r.target)
          }
          const roll = Math.random()
          if (roll < 0.12) {
            b.mode = 'dance'
            r.wait = rnd(2.5, 5)
          } else if (roll < 0.2) {
            b.hop()
            r.wait = rnd(0.5, 1.5)
          }
        }
        // Idle ones turn to watch the player when they are close.
        if (b.mode === 'idle' && pd2 < 100) turnTo(b.group, Math.atan2(px, pz), dt * 4)
      } else if (d > 0.3) {
        const speed = 1.6 * (0.8 + (b.def.rarity % 3) * 0.1)
        b.mode = 'walk'
        b.speed = speed
        p.x += (dx / d) * speed * dt
        p.z += (dz / d) * speed * dt
        turnTo(b.group, Math.atan2(dx, dz), dt * 6)
      } else {
        b.mode = 'idle'
        r.wait = rnd(1.5, 6)
      }
      // Keep a little personal space.
      for (const o of list) {
        if (o === r || o.drop) continue
        const ox = p.x - o.b.group.position.x
        const oz = p.z - o.b.group.position.z
        const dd = ox * ox + oz * oz
        const min = 1.2 * SIZES[r.entry.size].scale
        if (dd > 0.0001 && dd < min * min) {
          const k = ((min - Math.sqrt(dd)) / min) * dt * 2
          p.x += ox * k
          p.z += oz * k
        }
      }
      p.x = Math.max(this.cx - PENS.halfW + 0.8, Math.min(this.cx + PENS.halfW - 0.8, p.x))
      p.z = Math.max(this.cz - PENS.halfD + 0.8, Math.min(this.cz + PENS.halfD - 0.8, p.z))
      b.update(dt)
      // Rare ones glitter.
      if (fx && b.def.rarity >= 3 && Math.random() < dt * (b.def.rarity - 1.5)) fx.motes(p, RARITIES[b.def.rarity].glow, 1, 0.9, { rise: 1.2, size: 0.25 })
    }
  }
}

Pen.prototype.inside = function (pos) {
  return Math.abs(pos.x - this.cx) < PENS.halfW && Math.abs(pos.z - this.cz) < PENS.halfD
}
Pen.prototype.clampSpot = function (v, margin = 1) {
  v.x = Math.max(this.cx - PENS.halfW + margin, Math.min(this.cx + PENS.halfW - margin, v.x))
  v.z = Math.max(this.cz - PENS.halfD + margin, Math.min(this.cz + PENS.halfD - margin, v.z))
  return v
}
// The effects of an appeal cue: hearts, sparkles and the move's sound (quieter further away).
Pen.prototype.cue = function (b, cue, playerPos, fx, close, dist) {
  if (!cue || !fx) return
  const p = b.group.position
  const h = b.height
  const yaw = b.group.rotation.y
  const head = tmpV.set(p.x + Math.sin(yaw) * 0.35, p.y + h * 0.86, p.z + Math.cos(yaw) * 0.35)
  const gain = Math.max(0.15, 1 - dist / 22)
  const glow = b.def.look.fxColors
  switch (cue) {
    case 'kiss':
      fx.kiss(head, tmpW.set(playerPos.x, playerPos.y + 1.5, playerPos.z))
      break
    case 'heart':
      fx.hearts(tmpW.set(p.x, p.y + h * 1.05, p.z), 5)
      fx.sparkle(tmpW, '#ff8ac0', 10, { speed: 2, size: 0.25, up: 1 })
      break
    case 'twirl':
      fx.sparkle(tmpW.set(p.x, p.y + h * 0.5, p.z), RARITIES[b.def.rarity].glow, 18, { speed: 3, size: 0.3, up: 1.5 })
      fx.themed(b.def.look.fx, tmpW, glow, { burst: true, count: 10 })
      fx.ring(tmpW.set(p.x, p.y + 0.06, p.z), RARITIES[b.def.rarity].glow, { r0: 0.3, r1: 2.2, life: 0.5 })
      break
    case 'wave':
      fx.themed('notes', tmpW.set(p.x, p.y + h * 1.05, p.z), ['#ffffff', '#ffd6f0'], { count: 2 })
      break
    case 'pose':
      fx.stars(tmpW.set(p.x, p.y + h * 0.95, p.z), '#ffe14a', 8, 2.5)
      break
    case 'shy':
      fx.hearts(tmpW.set(p.x, p.y + h * 1.0, p.z), 2)
      break
    case 'curtsy':
      fx.sparkle(tmpW.set(p.x, p.y + h * 0.4, p.z), '#ffffff', 12, { speed: 2, size: 0.25, up: 0.6 })
      break
  }
  if (close || dist < 18) APPEAL_SFX[b.mode]?.(0, gain)
}

function turnTo(obj, yaw, k) {
  const diff = Math.atan2(Math.sin(yaw - obj.rotation.y), Math.cos(yaw - obj.rotation.y))
  obj.rotation.y += diff * Math.min(1, k)
}

export function buildPens(root, opts) {
  return PENS.xs.map((_, i) => new Pen(root, i, opts))
}
