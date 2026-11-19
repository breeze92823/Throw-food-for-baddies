// Cinematic camera layer over the chase cam (camera.js). A director "shot" is a position,
// a look-at point and a FOV that its owner (game/throw.js) sets every frame; the director
// eases its own copy toward the shot (stiffness per shot, or cut() to snap under a flash),
// and blends the result over the gameplay camera with a 0..1 weight, so going in and out of
// a cutscene glides instead of jumping. On top of whatever is on screen it adds:
//   shake(trauma)  - smooth multi-sine shake (position + roll), trauma^2 so small hits stay small
//   kick(deg)      - a FOV punch that springs back (launch, impact, reveal)
//   roll           - a dutch angle owned by the shot
// apply() runs after camera.js every frame and never allocates.
import { Vector3 } from 'three'

const tmpLook = new Vector3()
const baseLook = new Vector3()
const fwd = new Vector3()

export function createDirector() {
  const shot = { pos: new Vector3(0, 5, 10), look: new Vector3(), fov: 60, roll: 0, stiff: 6 }
  const cur = { pos: new Vector3(0, 5, 10), look: new Vector3(), fov: 60, roll: 0 }
  let weight = 0
  let target = 0
  let rate = 3
  let trauma = 0
  let kickV = 0 // degrees of FOV punch now
  let kickVel = 0
  let time = 0
  let fresh = true

  const smooth = (k) => k * k * (3 - 2 * k)

  return {
    get active() {
      return weight > 0.001 || target > 0
    },
    get weight() {
      return weight
    },
    // Take over (on) or hand back (off) the camera, blending over ~1/rate s.
    engage(on, blendRate = 3) {
      target = on ? 1 : 0
      rate = blendRate
      if (on && weight < 0.001) fresh = true
    },
    // The wanted framing this frame. stiff: 1/s the director's copy chases it.
    setShot(pos, look, fov, { stiff = 6, roll = 0 } = {}) {
      shot.pos.copy(pos)
      shot.look.copy(look)
      shot.fov = fov
      shot.roll = roll
      shot.stiff = stiff
    },
    // Snap to the shot (use under a flash or wipe).
    cut() {
      fresh = true
    },
    shake(amount) {
      trauma = Math.min(1, trauma + amount)
    },
    kick(deg) {
      kickVel += deg * 26
    },
    apply(camera, dt) {
      time += dt
      if (fresh) {
        cur.pos.copy(shot.pos)
        cur.look.copy(shot.look)
        cur.fov = shot.fov
        cur.roll = shot.roll
        fresh = false
      } else {
        const k = 1 - Math.exp(-shot.stiff * dt)
        cur.pos.lerp(shot.pos, k)
        cur.look.lerp(shot.look, k)
        cur.fov += (shot.fov - cur.fov) * k
        cur.roll += (shot.roll - cur.roll) * k
      }
      weight += Math.sign(target - weight) * Math.min(Math.abs(target - weight), dt * rate)
      const w = smooth(weight)
      let fov = camera.fov
      let changed = false
      if (w > 0.0001) {
        camera.getWorldDirection(fwd)
        baseLook.copy(camera.position).addScaledVector(fwd, 12)
        camera.position.lerp(cur.pos, w)
        tmpLook.copy(baseLook).lerp(cur.look, w)
        camera.lookAt(tmpLook)
        if (Math.abs(cur.roll) > 0.0001) camera.rotateZ(cur.roll * w)
        fov = fov + (cur.fov - fov) * w
        changed = true
      }
      // FOV punch: a damped spring back to 0.
      kickVel += (-kickV * 120 - kickVel * 14) * dt
      kickV += kickVel * dt
      if (Math.abs(kickV) > 0.01 || Math.abs(kickVel) > 0.01) {
        fov += kickV
        changed = true
      } else kickV = kickVel = 0
      // Shake.
      if (trauma > 0.0005) {
        const s = trauma * trauma
        const n = (a, b, c) => Math.sin(time * a) * 0.5 + Math.sin(time * b + 1.3) * 0.3 + Math.sin(time * c + 4.1) * 0.2
        camera.translateX(n(37, 61, 89) * s * 0.55)
        camera.translateY(n(43, 71, 97) * s * 0.45)
        camera.rotateZ(n(29, 53, 83) * s * 0.06)
        trauma = Math.max(0, trauma - dt * 1.6)
      }
      if (changed) {
        camera.fov = Math.max(20, Math.min(120, fov))
        camera.updateProjectionMatrix()
      }
    },
  }
}
