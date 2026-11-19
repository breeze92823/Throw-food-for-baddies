// Bloxity emotes on the base rig. The portal draws the picker; the catalogue
// (GET {apiUrl}/v1/avatar/emotes, bloxity.js loadEmotes) holds clips { len, loop, tracks } with
// tracks[bone] = [[timeSec, xDeg, yDeg, zDeg], ...]. Per the docs the values are degrees applied
// as deltas over the bind pose (XYZ order, right-multiplied), keys are smoothstepped and clamped
// outside their range, a loop wraps on time % len, unknown bones are ignored. Emotes stop when the
// player moves. One EmotePlayer per avatar; call apply() after the animator each frame.
import { Euler, Quaternion } from 'three'

const DEG = Math.PI / 180
const FADE_IN = 0.1 // s, blend from the locomotion pose

export class EmotePlayer {
  constructor(root) {
    this.root = root
    this.clip = null
    this.id = ''
    this.t = 0
    this.touched = new Set()
    this.e = new Euler()
    this.q = new Quaternion()
    this.target = new Quaternion()
    // Bind pose of every bone, captured now (the avatar is still in its bind pose).
    this.rest = new Map()
    root.traverse((o) => {
      if (o.isBone) this.rest.set(o.name, o.quaternion.clone())
    })
  }

  get active() {
    return !!this.clip
  }

  play(clip, id = '') {
    if (!clip?.tracks) return
    this.clip = clip
    this.id = id
    this.t = 0
  }

  stop() {
    if (!this.clip) return
    this.clip = null
    this.id = ''
    for (const name of this.touched) {
      const node = this.root.nodes?.[name]
      const rest = this.rest.get(name)
      if (node && rest) node.quaternion.copy(rest)
    }
    this.touched.clear()
  }

  apply(dt) {
    const clip = this.clip
    if (!clip) return
    this.t += dt
    const len = clip.len || 1
    if (clip.loop) this.t %= len
    else if (this.t > len) return this.stop()
    const weight = Math.min(1, this.t / FADE_IN)
    for (const name in clip.tracks) {
      const node = this.root.nodes?.[name]
      const rest = this.rest.get(name)
      const keys = clip.tracks[name]
      if (!node || !rest || !keys?.length) continue
      this.sample(keys, this.t)
      this.target.copy(rest).multiply(this.q.setFromEuler(this.e))
      node.quaternion.slerp(this.target, weight)
      this.touched.add(name)
    }
  }

  // Euler (radians) of the track at time t into this.e.
  sample(keys, t) {
    let a = keys[0]
    let b = keys[keys.length - 1]
    if (t <= a[0]) b = a
    else if (t >= b[0]) a = b
    else {
      for (let i = 1; i < keys.length; i++) {
        if (keys[i][0] >= t) {
          a = keys[i - 1]
          b = keys[i]
          break
        }
      }
    }
    let s = b[0] > a[0] ? (t - a[0]) / (b[0] - a[0]) : 0
    s = s * s * (3 - 2 * s)
    this.e.set((a[1] + (b[1] - a[1]) * s) * DEG, (a[2] + (b[2] - a[2]) * s) * DEG, (a[3] + (b[3] - a[3]) * s) * DEG, 'XYZ')
  }
}
