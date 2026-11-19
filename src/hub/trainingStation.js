// The Training Bench: two pillars joined by a lintel with a pull-up bar slung under it, a dashed
// ring round it and its upgrade pad (the pad is the pen's, just behind the bar), and a floating
// "<bench name> / Training Lv N" sign. Every tier in TRAINING.benches is its own model (`style`):
// rough logs, white lego bricks, a steel rig, a neon arena, a golden temple, frost crystals, a lava
// forge, a royal diamond, a celestial gate and a cosmic titan. All tiers share the same pillar
// spacing and bar height, so the pull-up pose and the colliders never change.
//
// Each model is three merged meshes (matte vertex colours, metal, glow) plus a few animated
// parts (spinning halos, a floating gem, an orbiting planet). upgrade(tier) plays the swap: the
// old bench shudders and crushes into the ground, the new one bursts up with an elastic
// overshoot and a half turn (main game fx are timed off `swapAt`).
import { AdditiveBlending, CircleGeometry, ConeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, OctahedronGeometry, RingGeometry, SphereGeometry, TorusGeometry } from 'three'
import { TRAINING } from '../config.js'
import { neon, solidBox } from '../propkit.js'
import { cbox, ccyl, cgeo, merge } from './geo.js'
import { dashedRing } from './props.js'
import { dynLabel } from './dynlabel.js'

const HALF = TRAINING.pillar.gap / 2
const H = TRAINING.pillar.height
const S = TRAINING.pillar.size
const BAR_Y = H - 0.62
const BAR_LEN = TRAINING.pillar.gap - S + 0.02
const SIDES = [-HALF, HALF]

// --- Shared bits ------------------------------------------------------------------------------
// The pull-up bar (local to BAR_Y): steel or wood with grip tape where the hands go.
function barParts(m, steel, tape, cap, r = 0.075) {
  m.push(ccyl(r, r, BAR_LEN, steel, 0, 0, 0, 0, 0, Math.PI / 2, 14))
  m.push(ccyl(r + 0.013, r + 0.013, 0.42, tape, -0.42, 0, 0, 0, 0, Math.PI / 2, 14))
  m.push(ccyl(r + 0.013, r + 0.013, 0.42, tape, 0.42, 0, 0, 0, 0, Math.PI / 2, 14))
  m.push(ccyl(0.13, 0.13, 0.12, cap, -HALF + S / 2 + 0.04, 0, 0, 0, 0, Math.PI / 2, 14))
  m.push(ccyl(0.13, 0.13, 0.12, cap, HALF - S / 2 - 0.04, 0, 0, 0, 0, Math.PI / 2, 14))
}
const studs = (out, color, x, y, z, w, d, n = 2) => {
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) out.push(ccyl(0.07, 0.07, 0.06, color, x + ((i + 0.5) / n - 0.5) * w, y, z + ((j + 0.5) / n - 0.5) * d, 0, 0, 0, 10))
}
// A model under construction: matte / metal / glow part lists, extra objects and animations.
function kit() {
  return { m: [], metal: [], glow: [], bar: [], extra: [], anim: [] }
}
const spin = (k, obj, speed, axis = 'y') => k.anim.push((t, dt) => (obj.rotation[axis] += dt * speed))
const bob = (k, obj, amp, rate, phase = 0) => {
  const y0 = obj.position.y
  k.anim.push((t) => (obj.position.y = y0 + Math.sin(t * rate + phase) * amp))
}
function glowMesh(geo, color, k = 2.6, extra = {}) {
  return new Mesh(geo, neon(color, k, extra))
}

// --- The ten benches -------------------------------------------------------------------------
const STYLES = {
  // 1. Two rough logs lashed with rope, a log beam, a wooden dowel bar.
  logs(k, [wood, dark, cut, rope]) {
    for (const x of SIDES) {
      k.m.push(ccyl(0.52, 0.6, 0.34, dark, x, 0.17, 0, 0, 0, 0, 9)) // stump
      k.m.push(ccyl(0.36, 0.4, H - 0.2, wood, x, (H - 0.2) / 2 + 0.1, 0, 0, 0, 0, 9))
      for (const y of [0.9, 1.7, 2.4]) k.m.push(ccyl(0.41, 0.41, 0.08, dark, x, y, 0, 0, 0, 0, 9)) // bark rings
      k.m.push(ccyl(0.3, 0.3, 0.04, cut, x, H - 0.08, 0, 0, 0, 0, 9))
      for (const y of [H - 0.36, H - 0.5]) k.m.push(ccyl(0.4, 0.4, 0.07, rope, x, y, 0, 0, 0, 0, 10)) // lashings
      for (let i = 0; i < 5; i++) k.m.push(cbox(0.1, 0.22 + (i % 2) * 0.12, 0.1, '#5fbf3a', x + Math.cos(i * 1.3) * 0.62, 0.12, Math.sin(i * 1.3) * 0.62))
    }
    k.m.push(ccyl(0.27, 0.27, TRAINING.pillar.gap + 1.1, wood, 0, H - 0.3, 0, 0, 0, Math.PI / 2, 9))
    for (const x of [-1, 1]) k.m.push(ccyl(0.24, 0.24, 0.02, cut, x * (HALF + 0.56), H - 0.3, 0, 0, 0, Math.PI / 2, 9))
    k.m.push(cbox(0.5, 0.12, 0.3, dark, -0.6, 0.06, 0.9, 0, 0.4, 0)) // a chopped block
    barParts(k.bar, '#c99a5e', rope, dark, 0.07)
  },

  // 2. White fluted lego pillars on stepped plinths with a studded lintel.
  brick(k, [white, shade, deep, tape]) {
    for (const x of SIDES) {
      k.m.push(cbox(S + 0.5, 0.22, S + 0.5, shade, x, 0.11, 0))
      k.m.push(cbox(S + 0.28, 0.2, S + 0.28, white, x, 0.32, 0))
      const y0 = 0.42
      const y1 = H - 0.62
      const sh = y1 - y0
      k.m.push(cbox(S, sh, S, white, x, y0 + sh / 2, 0))
      for (const f of [-1, 0, 1]) {
        const o = f * S * 0.3
        k.m.push(cbox(0.1, sh - 0.12, 0.06, shade, x + o, y0 + sh / 2, S / 2 + 0.02))
        k.m.push(cbox(0.1, sh - 0.12, 0.06, shade, x + o, y0 + sh / 2, -S / 2 - 0.02))
        k.m.push(cbox(0.06, sh - 0.12, 0.1, shade, x + S / 2 + 0.02, y0 + sh / 2, o))
        k.m.push(cbox(0.06, sh - 0.12, 0.1, shade, x - S / 2 - 0.02, y0 + sh / 2, o))
      }
      k.m.push(cbox(S + 0.1, 0.1, S + 0.1, deep, x, y0 + 0.3, 0))
      k.m.push(cbox(S + 0.14, 0.14, S + 0.14, shade, x, y1 + 0.07, 0))
      k.m.push(cbox(S + 0.34, 0.2, S + 0.34, white, x, y1 + 0.24, 0))
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.m.push(ccyl(0.07, 0.07, 0.06, white, x + dx * (S / 2 + 0.07), 0.45, dz * (S / 2 + 0.07), 0, 0, 0, 10))
    }
    k.m.push(cbox(TRAINING.pillar.gap + S + 0.7, 0.42, S + 0.3, white, 0, H - 0.17, 0))
    k.m.push(cbox(TRAINING.pillar.gap + S + 0.5, 0.06, S + 0.1, shade, 0, H - 0.4, 0))
    for (let i = -3; i <= 3; i++) k.m.push(ccyl(0.11, 0.11, 0.08, white, (i / 3) * (HALF + S / 2 + 0.15), H + 0.08, 0, 0, 0, 0, 10))
    barParts(k.bar, '#cfd6e2', tape, '#9aa4b6')
  },

  // 3. A steel gym rig: square tubes, splayed feet, an I-beam, bolts, weight plates, hazard tape.
  iron(k, [steel, dark, red, chrome]) {
    for (const x of SIDES) {
      k.metal.push(cbox(0.56, H - 0.1, 0.56, steel, x, (H - 0.1) / 2, 0))
      k.metal.push(cbox(1.3, 0.1, 1.3, dark, x, 0.05, 0)) // base plate
      for (const dz of [-1, 1]) k.metal.push(cbox(0.16, 1.5, 0.16, dark, x, 0.72, dz * 0.5, -dz * 0.5, 0, 0)) // braces leaning in
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.metal.push(ccyl(0.06, 0.06, 0.08, chrome, x + dx * 0.5, 0.13, dz * 0.5, 0, 0, 0, 8))
      for (let i = 0; i < 4; i++) k.m.push(cbox(0.6, 0.08, 0.04, i % 2 ? '#1a1a1a' : '#ffd23a', x, 0.6 + i * 0.08, 0.3)) // hazard tape
      for (const y of [1.2, 1.8, 2.4]) for (const dz of [-1, 1]) k.metal.push(ccyl(0.05, 0.05, 0.06, chrome, x, y, dz * 0.3, Math.PI / 2, 0, 0, 8))
      // A stack of weight plates leaning on the outside.
      const ox = x + Math.sign(x) * 0.85
      for (let i = 0; i < 3; i++) {
        k.m.push(ccyl(0.42 - i * 0.08, 0.42 - i * 0.08, 0.1, '#1d1f26', ox, 0.05 + i * 0.11, 0.2, 0, 0, 0, 18))
        k.m.push(ccyl(0.43 - i * 0.08, 0.43 - i * 0.08, 0.04, red, ox, 0.08 + i * 0.11, 0.2, 0, 0, 0, 18))
      }
    }
    const L = TRAINING.pillar.gap + 1.1
    k.metal.push(cbox(L, 0.1, 0.62, steel, 0, H - 0.02, 0)) // I-beam: top flange
    k.metal.push(cbox(L, 0.32, 0.14, dark, 0, H - 0.23, 0))
    k.metal.push(cbox(L, 0.1, 0.62, steel, 0, H - 0.44, 0))
    k.m.push(cbox(1.2, 0.22, 0.04, red, 0, H - 0.23, 0.08)) // nameplate
    barParts(k.bar, chrome, red, dark)
  },

  // 4. A neon arena: black towers with glowing edge strips, a hologram ring spinning above.
  neon(k, [body, deep, cyan, pink]) {
    for (const x of SIDES) {
      k.m.push(cbox(1.0, 0.3, 1.0, deep, x, 0.15, 0))
      k.m.push(cbox(0.66, H - 0.3, 0.66, body, x, (H - 0.3) / 2 + 0.3, 0))
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.glow.push(cbox(0.06, H - 0.4, 0.06, cyan, x + dx * 0.34, (H - 0.4) / 2 + 0.32, dz * 0.34))
      for (const y of [0.9, 1.6, 2.3]) k.glow.push(cbox(0.7, 0.05, 0.7, pink, x, y, 0))
      k.glow.push(cbox(1.04, 0.05, 1.04, cyan, x, 0.31, 0))
      k.m.push(cbox(0.5, 0.6, 0.4, deep, x + Math.sign(x) * 0.9, 0.3, 0.3)) // speaker
      k.glow.push(ccyl(0.14, 0.14, 0.03, pink, x + Math.sign(x) * 0.9, 0.42, 0.51, Math.PI / 2, 0, 0, 14))
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.2, 0.46, 0.8, body, 0, H - 0.2, 0))
    k.glow.push(cbox(TRAINING.pillar.gap + 1.22, 0.06, 0.82, pink, 0, H - 0.42, 0))
    k.glow.push(cbox(TRAINING.pillar.gap + 1.22, 0.06, 0.82, cyan, 0, H + 0.04, 0))
    const ring = glowMesh(new TorusGeometry(0.75, 0.05, 8, 40), cyan, 3)
    ring.position.set(0, H + 0.95, 0)
    ring.rotation.x = Math.PI / 2
    const ring2 = glowMesh(new TorusGeometry(0.5, 0.04, 8, 32), pink, 3)
    ring2.position.set(0, H + 0.95, 0)
    k.extra.push(ring, ring2)
    spin(k, ring, 1.6, 'z')
    spin(k, ring2, -2.4, 'x')
    bob(k, ring, 0.12, 2)
    barParts(k.bar, '#2a2f3d', cyan, pink)
  },

  // 5. A golden temple: stepped base, ringed gold columns, red banners and a trophy on top.
  gold(k, [gold, deep, red, cream]) {
    for (const x of SIDES) {
      k.m.push(cbox(1.4, 0.18, 1.4, cream, x, 0.09, 0))
      k.metal.push(cbox(1.15, 0.18, 1.15, deep, x, 0.27, 0))
      for (let i = 0; i < 6; i++) k.metal.push(ccyl(0.36 - (i % 2) * 0.05, 0.36 - (i % 2) * 0.05, (H - 0.95) / 6, i % 2 ? deep : gold, x, 0.36 + ((i + 0.5) * (H - 0.95)) / 6, 0, 0, 0, 0, 16))
      k.metal.push(cbox(0.95, 0.24, 0.95, gold, x, H - 0.47, 0))
      // A red banner with a gold trim hanging off the outer side.
      const bx = x + Math.sign(x) * 0.62
      k.m.push(cbox(0.06, 1.4, 0.62, red, bx, H - 1.25, 0))
      k.metal.push(cbox(0.08, 0.08, 0.66, gold, bx, H - 0.55, 0))
      k.metal.push(cgeo(new ConeGeometry(0.31, 0.3, 4), red, bx, H - 2.1, 0, Math.PI, Math.PI / 4, 0, 0.2, 1, 1.4))
      k.glow.push(cgeo(new OctahedronGeometry(0.1), '#ff4f5e', bx + Math.sign(x) * 0.04, H - 1.2, 0))
    }
    k.metal.push(cbox(TRAINING.pillar.gap + 1.3, 0.38, 0.96, gold, 0, H - 0.16, 0))
    k.m.push(cbox(TRAINING.pillar.gap + 1.4, 0.08, 1.0, cream, 0, H + 0.06, 0))
    // Trophy.
    const cup = new Group()
    const tp = [ccyl(0.22, 0.28, 0.08, deep, 0, 0.04, 0, 0, 0, 0, 14), ccyl(0.06, 0.06, 0.24, gold, 0, 0.2, 0, 0, 0, 0, 10), ccyl(0.3, 0.12, 0.38, gold, 0, 0.5, 0, 0, 0, 0, 16)]
    for (const s of [-1, 1]) tp.push(cgeo(new TorusGeometry(0.12, 0.035, 6, 14), gold, s * 0.3, 0.52, 0, 0, 0, 0))
    cup.add(new Mesh(merge(tp), new MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.85 })))
    cup.position.set(0, H + 0.1, 0)
    k.extra.push(cup)
    spin(k, cup, 0.8)
    barParts(k.bar, gold, red, deep)
  },

  // 6. Frost crystals: pillars of stacked ice prisms, snow caps, icicles and a floating snowflake gem.
  ice(k, [ice, deep, snow, blue]) {
    for (const x of SIDES) {
      k.m.push(cbox(1.3, 0.16, 1.3, snow, x, 0.08, 0))
      for (let i = 0; i < 5; i++) {
        const y = 0.16 + i * ((H - 0.6) / 5)
        k.m.push(ccyl(0.36 - (i % 2) * 0.04, 0.42 - (i % 2) * 0.04, (H - 0.6) / 5, i % 2 ? deep : ice, x, y + (H - 0.6) / 10, 0, 0, i * 0.4, 0, 6))
      }
      for (const dz of [-1, 1]) k.glow.push(cbox(0.08, H - 0.8, 0.08, '#e8fbff', x, (H - 0.8) / 2 + 0.2, dz * 0.4)) // the cold core
      for (let i = 0; i < 4; i++) {
        const a = i * 1.6 + x
        k.m.push(cgeo(new ConeGeometry(0.12, 0.6 + (i % 2) * 0.3, 6), i % 2 ? ice : deep, x + Math.cos(a) * 0.6, 0.35, Math.sin(a) * 0.6, 0.3 * Math.sin(a), 0, -0.3 * Math.cos(a)))
      }
      k.m.push(cbox(0.95, 0.18, 0.95, snow, x, H - 0.5, 0))
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.2, 0.36, 0.8, ice, 0, H - 0.22, 0))
    k.m.push(cbox(TRAINING.pillar.gap + 1.3, 0.16, 0.86, snow, 0, H + 0.02, 0))
    for (let i = 0; i < 9; i++) {
      const x = (i / 8 - 0.5) * (TRAINING.pillar.gap + 0.9)
      if (Math.abs(x) < 1.05 && Math.abs(x) > 0.2) continue // keep the grips clear
      k.m.push(cgeo(new ConeGeometry(0.06, 0.28 + (i % 3) * 0.12, 6), ice, x, H - 0.55 - (i % 3) * 0.06, 0.32, Math.PI, 0, 0))
    }
    const gem = glowMesh(new OctahedronGeometry(0.32), blue, 2.2)
    gem.position.set(0, H + 0.9, 0)
    gem.scale.y = 1.5
    k.extra.push(gem)
    spin(k, gem, 1.4)
    bob(k, gem, 0.15, 1.8)
    barParts(k.bar, '#e8fbff', blue, deep)
  },

  // 7. A lava forge: craggy obsidian pillars with glowing cracks, horns and a lava moat.
  lava(k, [rock, deep, lava, hot]) {
    for (const x of SIDES) {
      for (let i = 0; i < 6; i++) {
        const y = 0.3 + i * 0.5
        const w = 0.82 - (i % 3) * 0.08
        k.m.push(cbox(w, 0.56, w, i % 2 ? deep : rock, x + Math.sin(i * 2.1) * 0.05, y, Math.cos(i * 1.7) * 0.05, 0, i * 0.5, 0))
      }
      // Glowing cracks on every face.
      for (const dz of [-1, 1]) {
        k.glow.push(cbox(0.06, 1.4, 0.06, lava, x - 0.2 * dz, 1.1, dz * 0.43, 0, 0, 0.3 * dz))
        k.glow.push(cbox(0.06, 0.9, 0.06, lava, x + 0.22 * dz, 2.1, dz * 0.43, 0, 0, -0.4 * dz))
        k.glow.push(cbox(0.3, 0.06, 0.06, hot, x, 1.62 + dz * 0.2, dz * 0.43, 0, 0, 0.5))
      }
      for (const sx of [-1, 1]) k.glow.push(cbox(0.06, 1.1, 0.06, hot, x + sx * 0.43, 1.5, 0, 0.3 * sx, 0, 0))
      for (const dz of [-1, 1]) k.m.push(cgeo(new ConeGeometry(0.13, 0.7, 6), '#efe3d0', x + Math.sign(x) * 0.3, H + 0.2, dz * 0.25, 0, 0, -Math.sign(x) * 0.5))
      k.glow.push(ccyl(0.75, 0.75, 0.04, lava, x, 0.03, 0, 0, 0, 0, 20)) // lava pool
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.3, 0.48, 0.9, rock, 0, H - 0.2, 0))
    k.glow.push(cbox(TRAINING.pillar.gap + 1.32, 0.05, 0.92, lava, 0, H - 0.3, 0))
    const ember = glowMesh(new SphereGeometry(0.2, 12, 10), hot, 2.6)
    ember.position.set(0, H + 0.55, 0)
    k.extra.push(ember)
    k.anim.push((t) => ember.scale.setScalar(1 + Math.sin(t * 6) * 0.15))
    barParts(k.bar, '#3a3040', lava, deep)
  },

  // 8. Royal diamond: purple and marble pillars, a gold crown and a big spinning diamond.
  royal(k, [purple, deep, marble, gold]) {
    k.m.push(cbox(TRAINING.pillar.gap + 2.0, 0.06, 1.8, '#c4202f', 0, 0.03, 0.2)) // carpet
    for (const x of SIDES) {
      k.m.push(cbox(1.25, 0.22, 1.25, marble, x, 0.14, 0))
      k.m.push(cbox(0.7, H - 0.85, 0.7, purple, x, (H - 0.85) / 2 + 0.25, 0))
      for (const y of [0.6, 1.5, 2.4]) k.m.push(cbox(0.78, 0.14, 0.78, marble, x, y, 0))
      for (const y of [1.05, 1.95]) for (const dz of [-1, 1]) k.glow.push(cgeo(new OctahedronGeometry(0.12), '#ffffff', x, y, dz * 0.38))
      k.metal.push(cbox(0.95, 0.2, 0.95, gold, x, H - 0.5, 0))
      k.metal.push(cgeo(new OctahedronGeometry(0.2), gold, x, H + 0.22, 0))
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.2, 0.4, 0.86, deep, 0, H - 0.2, 0))
    k.metal.push(cbox(TRAINING.pillar.gap + 1.24, 0.07, 0.9, gold, 0, H - 0.02, 0))
    // Crown.
    const cr = [ccyl(0.36, 0.36, 0.22, gold, 0, 0.11, 0, 0, 0, 0, 16)]
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      cr.push(cgeo(new ConeGeometry(0.08, 0.26, 6), gold, Math.cos(a) * 0.33, 0.33, Math.sin(a) * 0.33))
    }
    const crown = new Mesh(merge(cr), new MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.9 }))
    crown.position.set(0, H + 0.02, 0)
    const gem = glowMesh(new OctahedronGeometry(0.34, 0), '#c79bff', 2.4)
    gem.position.set(0, H + 1.05, 0)
    gem.scale.y = 1.35
    k.extra.push(crown, gem)
    spin(k, gem, 1.8)
    bob(k, gem, 0.12, 2.2)
    barParts(k.bar, gold, purple, marble)
  },

  // 9. Celestial gate: white-gold pillars on clouds, wings on top and spinning halos.
  celestial(k, [white, sand, violet, gold]) {
    for (const x of SIDES) {
      for (let i = 0; i < 5; i++) k.m.push(cgeo(new SphereGeometry(0.4 + (i % 2) * 0.12, 10, 8), '#ffffff', x + Math.cos(i * 1.3) * 0.5, 0.2, Math.sin(i * 1.3) * 0.5, 0, 0, 0, 1, 0.55, 1)) // cloud
      k.m.push(ccyl(0.34, 0.4, H - 0.6, white, x, (H - 0.6) / 2 + 0.1, 0, 0, 0, 0, 16))
      for (const y of [0.55, H - 0.65]) k.metal.push(ccyl(0.44, 0.44, 0.14, gold, x, y, 0, 0, 0, 0, 16))
      // Wings fanned off the outside of the capital.
      for (let i = 0; i < 4; i++) k.m.push(cbox(0.08, 0.16, 0.9 - i * 0.16, i % 2 ? sand : white, x + Math.sign(x) * (0.45 + i * 0.1), H - 0.1 + i * 0.17, -0.15, 0.35, 0, -Math.sign(x) * (0.6 + i * 0.15)))
      const halo = glowMesh(new TorusGeometry(0.62, 0.035, 8, 40), gold, 2.4)
      halo.position.set(x, 1.6, 0)
      halo.rotation.x = Math.PI / 2
      k.extra.push(halo)
      bob(k, halo, 0.6, 1.3, x)
      spin(k, halo, 1.2, 'z')
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.0, 0.36, 0.76, white, 0, H - 0.2, 0))
    k.metal.push(cbox(TRAINING.pillar.gap + 1.04, 0.06, 0.8, gold, 0, H - 0.02, 0))
    const star = glowMesh(new OctahedronGeometry(0.26), violet, 2.6)
    star.position.set(0, H + 0.75, 0)
    const halo = glowMesh(new TorusGeometry(0.45, 0.04, 8, 36), gold, 2.6)
    halo.position.copy(star.position)
    k.extra.push(star, halo)
    spin(k, star, 2)
    spin(k, halo, 0.9, 'x')
    barParts(k.bar, '#fff6e0', violet, gold)
  },

  // 10. Cosmic titan: galaxy pillars full of stars, a portal disc, a ringed planet orbited by moons.
  cosmic(k, [space, deep, pink, mint]) {
    for (const x of SIDES) {
      k.m.push(cbox(1.3, 0.24, 1.3, deep, x, 0.12, 0))
      k.m.push(cbox(0.76, H - 0.5, 0.76, space, x, (H - 0.5) / 2 + 0.24, 0))
      for (let i = 0; i < 14; i++) {
        const fy = 0.4 + ((i * 0.37) % 1) * (H - 1)
        const side = i % 4
        const o = (((i * 0.61) % 1) - 0.5) * 0.6
        const [dx, dz] = side === 0 ? [o, 0.39] : side === 1 ? [o, -0.39] : side === 2 ? [0.39, o] : [-0.39, o]
        k.glow.push(cbox(0.05, 0.05, 0.05, i % 3 ? '#ffffff' : mint, x + dx, fy, dz))
      }
      for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) k.glow.push(cbox(0.05, H - 0.6, 0.05, pink, x + dx * 0.4, (H - 0.6) / 2 + 0.26, dz * 0.4))
      k.glow.push(cgeo(new OctahedronGeometry(0.22), mint, x, H + 0.25, 0))
    }
    k.m.push(cbox(TRAINING.pillar.gap + 1.3, 0.44, 0.9, space, 0, H - 0.2, 0))
    k.glow.push(cbox(TRAINING.pillar.gap + 1.32, 0.05, 0.92, mint, 0, H - 0.44, 0))
    k.glow.push(cbox(TRAINING.pillar.gap + 1.32, 0.05, 0.92, pink, 0, H + 0.03, 0))
    const portal = new Mesh(new RingGeometry(0.9, 1.25, 40).rotateX(-Math.PI / 2), neon(pink, 2.2, { transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }))
    portal.position.set(0, 0.04, 0)
    const planet = new Group()
    planet.position.set(0, H + 1.05, 0)
    planet.add(new Mesh(new SphereGeometry(0.34, 16, 12), new MeshStandardMaterial({ color: '#7a5cff', roughness: 0.6, emissive: '#3a1a8a', emissiveIntensity: 0.6 })))
    const pr = glowMesh(new TorusGeometry(0.55, 0.035, 6, 40), mint, 2.4)
    pr.rotation.x = Math.PI / 2 - 0.4
    planet.add(pr)
    const orbit = new Group()
    for (let i = 0; i < 3; i++) {
      const moon = glowMesh(new SphereGeometry(0.08, 8, 6), i % 2 ? pink : '#ffffff', 2.4)
      const a = (i / 3) * Math.PI * 2
      moon.position.set(Math.cos(a) * 0.85, Math.sin(a * 2) * 0.2, Math.sin(a) * 0.85)
      orbit.add(moon)
    }
    planet.add(orbit)
    k.extra.push(portal, planet)
    spin(k, portal, 0.7)
    spin(k, planet, 0.5)
    spin(k, orbit, 1.8)
    bob(k, planet, 0.12, 1.4)
    barParts(k.bar, '#2a2050', pink, mint)
  },
}

// Builds one tier's model into a fresh group. Returns { group, bar, anim, dispose }.
function buildModel(tier) {
  const def = TRAINING.benches[tier]
  const k = kit()
  ;(STYLES[def.style] ?? STYLES.brick)(k, def.colors)
  const g = new Group()
  const mats = []
  const add = (parts, mat, shadow = true) => {
    if (!parts.length) return null
    const mesh = new Mesh(merge(parts), mat)
    mesh.castShadow = shadow
    mesh.receiveShadow = shadow
    mats.push(mat)
    g.add(mesh)
    return mesh
  }
  add(k.m, new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }))
  // Moderate metalness: the hub has no environment map, so fully metallic parts would go dark.
  add(k.metal, new MeshStandardMaterial({ vertexColors: true, roughness: 0.38, metalness: 0.15 }))
  add(k.glow, neon('#ffffff', 2.4, { vertexColors: true }), false)
  const bar = add(k.bar, new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }))
  bar.position.y = BAR_Y
  for (const e of k.extra) g.add(e)
  return {
    group: g,
    bar,
    anim: k.anim,
    dispose() {
      g.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose()
          if (!mats.includes(o.material)) o.material.dispose()
        }
      })
      for (const m of mats) m.dispose()
    },
  }
}

const SWAP_AT = 0.42 // s into an upgrade when the old model is gone and the new one bursts up
const RISE = 0.9 // s the new model takes to settle
const elastic = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -9 * x) * Math.cos(x * Math.PI * 3.2))

export function buildTrainingStation(root, { tier = 0 } = {}) {
  const { spot } = TRAINING
  const g = new Group()
  g.position.set(spot.x, 0, spot.z)
  root.add(g)
  const holder = new Group() // the model (scaled / spun by the upgrade animation)
  g.add(holder)
  let model = buildModel(tier)
  holder.add(model.group)
  let curTier = tier

  // Colliders for the two pillars (you stand between them).
  solidBox((S + 0.3) / 2, H / 2, (S + 0.3) / 2, spot.x - HALF, H / 2, spot.z)
  solidBox((S + 0.3) / 2, H / 2, (S + 0.3) / 2, spot.x + HALF, H / 2, spot.z)

  // Dashed ring round bench + pad, a soft glow disc and a pulse ring for each rep. The ring is
  // centred between the bar and the pad.
  const ringZ = TRAINING.padGap / 2
  const ring = dashedRing(TRAINING.ringR, '#ffffff', 30)
  ring.position.set(0, 0.02, ringZ)
  g.add(ring)
  const glowMat = new MeshBasicMaterial({ color: '#7dff4a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  const disc = new Mesh(new CircleGeometry(1.7, 40).rotateX(-Math.PI / 2), glowMat)
  disc.position.y = 0.05
  disc.renderOrder = 2
  g.add(disc)
  const pulseMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 })
  const pulse = new Mesh(new RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), pulseMat)
  pulse.position.y = 0.06
  pulse.renderOrder = 3
  g.add(pulse)
  // The upgrade shockwave: a bright ring + a column of light that only shows during a swap.
  const waveMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false })
  const wave = new Mesh(new RingGeometry(0.85, 1, 56).rotateX(-Math.PI / 2), waveMat)
  wave.position.y = 0.1
  wave.renderOrder = 4
  g.add(wave)

  // Floating sign.
  const sign = dynLabel(0.62, { width: 760, lines: 2 })
  sign.sprite.position.set(0, H + 1.9, 0)
  g.add(sign.sprite)

  let glow = 0
  let pulseT = 1
  let barKick = 0
  let up = null // the running upgrade: { t, to, swapped }
  let pulseColor = '#ffffff'
  return {
    group: g,
    barY: BAR_Y,
    // Where the hands grip (world space): the middle of the bar.
    gripY: BAR_Y,
    swapAt: SWAP_AT,
    get tier() {
      return curTier
    },
    get upgrading() {
      return !!up
    },
    rep(color = '#ffffff') {
      pulseT = 0
      barKick = 1
      pulseColor = color
    },
    // Swap to `to` instantly (a loaded save) or with the upgrade animation.
    setTier(to, animate = true) {
      if (!animate) {
        up = null
        model.dispose()
        holder.remove(model.group)
        model = buildModel(to)
        holder.add(model.group)
        holder.scale.set(1, 1, 1)
        holder.rotation.set(0, 0, 0)
        holder.position.set(0, 0, 0)
        curTier = to
        return
      }
      up = { t: 0, to, swapped: false }
    },
    update(t, dt, { active = false, boost = false, boostColor = null, level = 1, near = false } = {}) {
      ring.rotation.y += dt * (active ? (boost ? 1.6 : 0.8) : 0.18)
      const k = active ? 1 : near ? 0.35 : 0
      glow += (k - glow) * Math.min(1, dt * 4)
      glowMat.opacity = glow * (0.16 + 0.06 * Math.sin(t * 5)) * (boostColor ? 2.2 : boost ? 1.6 : 1)
      glowMat.color.set(boostColor ?? (boost ? '#ffd23a' : '#7dff4a'))
      ring.material.emissiveIntensity = 0.15 + glow * 0.6
      // The rep pulse: a ring sweeping out from your feet.
      pulseT = Math.min(1, pulseT + dt * 1.8)
      const r = 0.6 + pulseT * 2.4
      pulse.scale.set(r, 1, r)
      pulseMat.opacity = (1 - pulseT) * 0.7
      pulseMat.color.set(pulseColor)
      // The bar flexes a little under each pull.
      barKick = Math.max(0, barKick - dt * 3.5)
      model.bar.position.y = BAR_Y - Math.sin(barKick * Math.PI) * 0.04
      for (const a of model.anim) a(t, dt)

      // Upgrade: shudder + crush, swap, elastic burst up with a half turn.
      if (up) {
        up.t += dt
        const def = TRAINING.benches[up.to]
        if (!up.swapped) {
          const k = Math.min(1, up.t / SWAP_AT)
          const shake = Math.sin(up.t * 70) * 0.06 * (1 - k * 0.5)
          holder.position.set(shake, 0, Math.cos(up.t * 63) * 0.04)
          holder.scale.set(1 + k * 0.25, Math.max(0.02, 1 - k * k), 1 + k * 0.25)
          holder.rotation.y = k * k * 0.6
          if (up.t >= SWAP_AT) {
            up.swapped = true
            model.dispose()
            holder.remove(model.group)
            model = buildModel(up.to)
            holder.add(model.group)
            curTier = up.to
            waveMat.color.set(def.glow)
          }
        }
        if (up.swapped) {
          const k = Math.min(1, (up.t - SWAP_AT) / RISE)
          const e = elastic(k)
          holder.position.set(0, 0, 0)
          holder.scale.set(0.3 + 0.7 * e, Math.max(0.02, e), 0.3 + 0.7 * e)
          holder.rotation.y = (1 - e) * -Math.PI
          const w = Math.min(1, (up.t - SWAP_AT) / 0.7)
          const wr = 0.6 + w * 6
          wave.scale.set(wr, 1, wr)
          waveMat.opacity = (1 - w) * 0.9
          if (k >= 1) {
            up = null
            holder.scale.set(1, 1, 1)
            holder.rotation.set(0, 0, 0)
            waveMat.opacity = 0
          }
        }
      }

      sign.sprite.position.y = H + 1.9 + Math.sin(t * 1.6) * 0.08
      const def = TRAINING.benches[curTier]
      sign.set([
        { text: def.name, color: def.glow === '#ffffff' ? '#ffd23a' : def.glow },
        { text: `Training Lv ${level}  +${TRAINING.strengthPerLevel} Strength`, color: '#7dff4a', scale: 0.62 },
      ])
    },
  }
}
