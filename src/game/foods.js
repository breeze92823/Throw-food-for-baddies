// Food models (what you throw), built as voxel sculptures to match the blocky world:
// each food is painted into a sparse voxel grid with a few shape brushes (ellipsoids,
// tapered cylinders, tori, capsules, boxes, free fills), then meshed into one geometry
// with only the exposed faces, per-vertex ambient occlusion (the soft dark creases that
// make voxel art read), a little per-voxel colour jitter and baked face shading.
// Voxels painted with a leading '*' glow (the bloom pass picks them up): sparkles,
// lava, stars. Higher food rarities also glow faintly all over (FOOD_RARITIES.emissive).
// Every model is normalised to the same size and baked into its display pose, so the
// shop portraits, the stall crates and the thrown food all share one cached geometry.
import { BufferGeometry, Color, Euler, Float32BufferAttribute, Group, Matrix4, Mesh, MeshStandardMaterial, Vector3 } from 'three'
import { FOOD_RARITIES, FOODS } from '../config.js'
import { mulberry32 } from '../textures.js'

export const FOOD_BY_ID = Object.fromEntries(FOODS.map((f) => [f.id, f]))
export const foodRarity = (id) => FOOD_RARITIES[FOOD_BY_ID[id]?.rarity ?? 0]

const SIZE = 0.82 // m, the longest side of every food
const TAU = Math.PI * 2
const OFF = 64
const SPAN = 128
const KEY = (x, y, z) => ((x + OFF) * SPAN + (y + OFF)) * SPAN + (z + OFF)
const hash = (x, y, z) => {
  const s = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453
  return s - Math.floor(s)
}

// --- Colour helpers (hex strings in, hex strings out) ----------------------------------------
const rgbOf = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const hexOf = (r, g, b) => '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')
export function mix(a, b, t) {
  const A = rgbOf(a)
  const B = rgbOf(b)
  return hexOf(A[0] + (B[0] - A[0]) * t, A[1] + (B[1] - A[1]) * t, A[2] + (B[2] - A[2]) * t)
}
const shade = (h, k) => {
  const [r, g, b] = rgbOf(h)
  return hexOf(r * k, g * k, b * k)
}

// --- The voxel grid --------------------------------------------------------------------------
// Brush colours: '#hex', '*#hex' (glow), '' (erase) or a function returning one of those
// (null / undefined = leave the voxel alone).
const m4 = new Matrix4()
const ev = new Euler()
const pv = new Vector3()
class Vox {
  constructor(seed) {
    this.m = new Map()
    this.rand = mulberry32(seed)
  }
  put(x, y, z, c) {
    if (c == null) return
    if (c === '') this.m.delete(KEY(x, y, z))
    else this.m.set(KEY(x, y, z), c)
  }
  has(x, y, z) {
    return this.m.has(KEY(x, y, z))
  }
  get(x, y, z) {
    return this.m.get(KEY(x, y, z))
  }
  // Generic fill over a box of integer coords: fn(x, y, z) -> colour | null.
  fill(x0, x1, y0, y1, z0, z1, fn) {
    for (let x = Math.floor(x0); x <= Math.ceil(x1); x++)
      for (let y = Math.floor(y0); y <= Math.ceil(y1); y++)
        for (let z = Math.floor(z0); z <= Math.ceil(z1); z++) this.put(x, y, z, fn(x, y, z))
  }
  // Ellipsoid; col(x, y, z, a, b, c) gets the normalised offsets (-1..1). rot = [rx, ry, rz].
  ell(cx, cy, cz, rx, ry, rz, col, rot = null, bump = 0) {
    let inv = null
    if (rot) {
      ev.set(rot[0], rot[1], rot[2])
      inv = m4.makeRotationFromEuler(ev).clone().invert()
    }
    const R = Math.max(rx, ry, rz) + 1
    this.fill(cx - R, cx + R, cy - R, cy + R, cz - R, cz + R, (x, y, z) => {
      pv.set(x - cx, y - cy, z - cz)
      if (inv) pv.applyMatrix4(inv)
      const a = pv.x / rx
      const b = pv.y / ry
      const c = pv.z / rz
      const d = a * a + b * b + c * c
      if (d > 1 - (bump ? hash(x, y, z) * bump : 0)) return null
      return typeof col === 'function' ? col(x, y, z, a, b, c) : col
    })
  }
  ball(cx, cy, cz, r, col, bump = 0) {
    this.ell(cx, cy, cz, r, r, r, col, null, bump)
  }
  // Tapered cylinder along an axis from a0 to a1 (integer range), radius r0 -> r1.
  // (p, q) is the centre in the other two axes (x/y/z order without the axis).
  // col(x, y, z, t (0..1 along), ang, rr (0..1 out)).
  cyl(axis, p, q, a0, a1, r0, r1, col) {
    const R = Math.max(r0, r1) + 1
    for (let a = a0; a <= a1; a++) {
      const t = a1 === a0 ? 0 : (a - a0) / (a1 - a0)
      const r = r0 + (r1 - r0) * t
      for (let i = Math.floor(p - R); i <= Math.ceil(p + R); i++)
        for (let j = Math.floor(q - R); j <= Math.ceil(q + R); j++) {
          const di = i - p
          const dj = j - q
          const rr = Math.hypot(di, dj)
          if (rr > r) continue
          const [x, y, z] = axis === 'x' ? [a, i, j] : axis === 'y' ? [i, a, j] : [i, j, a]
          // Angle around the axis, measured so 'y' cylinders get the usual atan2(z, x).
          const ang = Math.atan2(dj, di)
          this.put(x, y, z, typeof col === 'function' ? col(x, y, z, t, ang, rr / Math.max(0.001, r)) : col)
        }
    }
  }
  // Torus around an axis (ring radius R, tube radius r). col(x, y, z, ang, tubeAng, up).
  tor(axis, cx, cy, cz, R, r, col) {
    const E = R + r + 1
    this.fill(cx - E, cx + E, cy - E, cy + E, cz - E, cz + E, (x, y, z) => {
      const dx = x - cx
      const dy = y - cy
      const dz = z - cz
      const [a, p, q] = axis === 'x' ? [dx, dy, dz] : axis === 'y' ? [dy, dx, dz] : [dz, dx, dy]
      const ring = Math.hypot(p, q) - R
      if (ring * ring + a * a > r * r) return null
      return typeof col === 'function' ? col(x, y, z, Math.atan2(q, p), Math.atan2(a, ring), a / r) : col
    })
  }
  // Capsule from p0 to p1 with radius r (r1 at the end if given). col(x, y, z, t).
  line(x0, y0, z0, x1, y1, z1, r, col, r1 = r) {
    const dx = x1 - x0
    const dy = y1 - y0
    const dz = z1 - z0
    const L2 = dx * dx + dy * dy + dz * dz || 1
    const R = Math.max(r, r1) + 1
    this.fill(Math.min(x0, x1) - R, Math.max(x0, x1) + R, Math.min(y0, y1) - R, Math.max(y0, y1) + R, Math.min(z0, z1) - R, Math.max(z0, z1) + R, (x, y, z) => {
      const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy + (z - z0) * dz) / L2))
      const d = Math.hypot(x - (x0 + dx * t), y - (y0 + dy * t), z - (z0 + dz * t))
      if (d > r + (r1 - r) * t) return null
      return typeof col === 'function' ? col(x, y, z, t) : col
    })
  }
  box(x0, y0, z0, x1, y1, z1, col) {
    this.fill(x0, x1, y0, y1, z0, z1, (x, y, z) => (typeof col === 'function' ? col(x, y, z) : col))
  }
  each(fn) {
    for (const [k, c] of [...this.m]) {
      const z = (k % SPAN) - OFF
      const y = (Math.floor(k / SPAN) % SPAN) - OFF
      const x = Math.floor(k / (SPAN * SPAN)) - OFF
      fn(x, y, z, c)
    }
  }
  exposed(x, y, z) {
    return !this.has(x + 1, y, z) || !this.has(x - 1, y, z) || !this.has(x, y + 1, z) || !this.has(x, y - 1, z) || !this.has(x, y, z + 1) || !this.has(x, y, z - 1)
  }
  // Recolour existing voxels: fn(x, y, z, colour, exposed) -> new colour | null.
  paint(fn) {
    this.each((x, y, z, c) => {
      const n = fn(x, y, z, c, this.exposed(x, y, z))
      if (n != null) this.put(x, y, z, n)
    })
  }
  // A one-voxel skin around existing voxels where pred(x, y, z) holds (bands, wraps).
  skin(pred, col) {
    const add = []
    this.each((x, y, z) => {
      for (const [dx, dy, dz] of DIRS) {
        const nx = x + dx
        const ny = y + dy
        const nz = z + dz
        if (!this.has(nx, ny, nz) && pred(nx, ny, nz)) add.push([nx, ny, nz])
      }
    })
    for (const [x, y, z] of add) this.put(x, y, z, typeof col === 'function' ? col(x, y, z) : col)
  }
  // Sprinkle: recolour n random exposed voxels that pass pred.
  speckle(n, colors, pred = () => true) {
    const pool = []
    this.each((x, y, z, c) => {
      if (this.exposed(x, y, z) && pred(x, y, z, c)) pool.push([x, y, z])
    })
    for (let i = 0; i < n && pool.length; i++) {
      const [x, y, z] = pool.splice(Math.floor(this.rand() * pool.length), 1)[0]
      this.put(x, y, z, colors[i % colors.length])
    }
  }
}

// --- Mesher ----------------------------------------------------------------------------------
const DIRS = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]
const FACE_SHADE = [0.9, 0.9, 1, 0.72, 0.96, 0.94]
const AO = [0.5, 0.68, 0.85, 1]
const linCache = new Map()
const tmpCol = new Color()
function lin(hex) {
  let v = linCache.get(hex)
  if (!v) {
    tmpCol.set(hex)
    v = [tmpCol.r, tmpCol.g, tmpCol.b]
    linCache.set(hex, v)
  }
  return v
}

function meshVox(v) {
  const pos = []
  const nor = []
  const col = []
  const glw = []
  const idx = []
  const counts = new Map()
  const occ = (x, y, z) => (v.has(x, y, z) ? 1 : 0)
  v.each((x, y, z, c) => {
    const glow = c[0] === '*'
    const hex = glow ? c.slice(1) : c
    const rgb = lin(hex)
    const j = 0.94 + hash(x, y, z) * 0.12
    let faces = 0
    for (let d = 0; d < 6; d++) {
      const n = DIRS[d]
      if (v.has(x + n[0], y + n[1], z + n[2])) continue
      faces++
      const a = d >> 1
      const s = n[0] + n[1] + n[2]
      const u = (a + 1) % 3
      const w = (a + 2) % 3
      const q = [x, y, z]
      q[a] += s
      const b = pos.length / 3
      const aos = []
      const corners = s > 0 ? [[0, 0], [1, 0], [1, 1], [0, 1]] : [[0, 0], [0, 1], [1, 1], [1, 0]]
      for (const [cu, cw] of corners) {
        const s1p = q.slice()
        s1p[u] += cu ? 1 : -1
        const s2p = q.slice()
        s2p[w] += cw ? 1 : -1
        const cp = s1p.slice()
        cp[w] += cw ? 1 : -1
        const s1 = occ(...s1p)
        const s2 = occ(...s2p)
        const cc = occ(...cp)
        const ao = s1 && s2 ? 0 : 3 - (s1 + s2 + cc)
        const vp = [x - 0.5, y - 0.5, z - 0.5]
        vp[a] += s > 0 ? 1 : 0
        vp[u] += cu
        vp[w] += cw
        pos.push(vp[0], vp[1], vp[2])
        nor.push(n[0], n[1], n[2])
        const k = FACE_SHADE[d] * (glow ? 1 : AO[ao]) * j
        col.push(rgb[0] * k, rgb[1] * k, rgb[2] * k)
        glw.push(glow ? 1 : 0)
        aos.push(ao)
      }
      if (aos[0] + aos[2] < aos[1] + aos[3]) idx.push(b + 1, b + 2, b + 3, b + 1, b + 3, b)
      else idx.push(b, b + 1, b + 2, b, b + 2, b + 3)
    }
    if (faces) counts.set(hex, (counts.get(hex) ?? 0) + faces)
  })
  const g = new BufferGeometry()
  g.setAttribute('position', new Float32BufferAttribute(pos, 3))
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3))
  g.setAttribute('color', new Float32BufferAttribute(col, 3))
  g.setAttribute('glow', new Float32BufferAttribute(glw, 1))
  g.setIndex(idx)
  // Palette: the most visible colours first (crumbs, chunks, splats, trails).
  const palette = [...counts.entries()].sort((p, q) => q[1] - p[1]).slice(0, 5).map((e) => e[0])
  return { geo: g, palette }
}

// --- Materials -------------------------------------------------------------------------------
// Standard PBR with vertex colours; emissive = vertex colour x (rarity glow + glow voxels),
// so glowing voxels go HDR and bloom while the rest only lifts a touch.
const mats = new Map()
function foodMaterial(finish, base) {
  // Metal has no environment to reflect in the open meadow, so it lights itself a bit.
  if (finish === 'metal') base = Math.max(base, 0.22)
  const key = `${finish}|${base}`
  if (mats.has(key)) return mats.get(key)
  const m = new MeshStandardMaterial({
    vertexColors: true,
    roughness: finish === 'gloss' ? 0.28 : finish === 'metal' ? 0.3 : 0.62,
    metalness: finish === 'metal' ? 0.55 : 0,
    emissive: '#ffffff',
  })
  m.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float glow;\nvarying float vGlow;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvGlow = glow;')
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vGlow;')
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>\ntotalEmissiveRadiance = vColor.rgb * (${base.toFixed(3)} + vGlow * 3.2);`)
  }
  m.customProgramCacheKey = () => `food-${key}`
  mats.set(key, m)
  return m
}

// --- The models ------------------------------------------------------------------------------
// Each builder paints into v (integer voxel coords, y up, front = +z) and may return
// { rot: [rx, ry, rz], finish: 'matte' | 'gloss' | 'metal' } for its display pose.
const leafy = (v, x0, y0, z0, x1, y1, z1, r = 1, light = '#5fd23a', dark = '#2f8a22') => v.line(x0, y0, z0, x1, y1, z1, r, (x, y, z, t) => (t > 0.6 ? light : hash(x, y, z) < 0.3 ? dark : mix(dark, light, t)))
const leaf = (v, cx, cy, cz, len, rz, ry = 0, c = '#4cc23a') =>
  v.ell(cx, cy, cz, len, 0.9, len * 0.48, (x, y, z, a, b, cc) => (Math.abs(cc) < 0.14 ? shade(c, 0.78) : a > 0.3 ? shade(c, 1.12) : c), [0, ry, rz])
function appleShape(v, colors, { glowSpark = false } = {}) {
  const [base, hi, lo, mid] = colors
  v.fill(-11, 11, -10, 10, -11, 11, (x, y, z) => {
    const k = 1 + (y / 8) * 0.12
    const a = x / (8.6 * k)
    const b = y / 8.2
    const c = z / (8.6 * k)
    if (a * a + b * b + c * c > 1) return null
    if (b > 0.72 && Math.hypot(x, z) < 2.6) return null // dimple
    const l = -a * 0.45 + b * 0.55 + c * 0.7
    if (glowSpark && hash(x, y, z) > 0.985) return '*#ffffff'
    return l > 0.95 ? hi : l > 0.6 ? mid : b < -0.55 ? lo : base
  })
  v.line(0, 5, 0, 1, 11, 0, 0.75, '#6b3a18')
  leaf(v, 3.6, 10.5, 0.5, 3.4, 0.45, 0.2)
}

const BUILD = {
  carrot(v) {
    v.cyl('y', 0, 0, -10, 10, 0.9, 4.6, (x, y, z, t, ang) => ((y + 10) % 4 === 1 && hash(x, 0, z) < 0.7 ? '#d8650e' : Math.cos(ang - 2.2) > 0.6 ? '#ffa640' : '#f2861c'))
    v.cyl('y', 0, 0, 10, 11, 4.2, 3.4, '#e87a18')
    leafy(v, 0, 11, 0, -2.5, 19, 1, 1.25)
    leafy(v, 0, 11, 0, 2.5, 20, -1, 1.25)
    leafy(v, 0, 11, 0, 0, 21, 1.5, 1.15)
    leafy(v, -1.2, 15, 0.5, -4, 17, 1, 0.8)
    leafy(v, 1.2, 16, -0.5, 4.2, 18, -1, 0.8)
    return { rot: [0.15, 0.3, 0.6] }
  },
  apple(v) {
    appleShape(v, ['#e0222c', '#ff7a6a', '#a8121c', '#f0383a'])
    return { rot: [0.15, 0.3, 0], finish: 'gloss' }
  },
  banana(v) {
    const N = 46
    for (let i = 0; i <= N; i++) {
      const t = i / N
      const ang = -1.15 + t * 2.3
      const cx = Math.sin(ang) * 12
      const cy = -Math.cos(ang) * 9
      const r = 0.7 + 2.7 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.05)), 0.55)
      v.ball(cx, cy, 0, r, (x, y, z, a, b) => {
        if (t < 0.05) return '#5a3a1a'
        if (t > 0.94) return t > 0.985 ? '#4a3a1a' : '#8aa03a'
        if (b < -0.55) return '#e0b020'
        if (b > 0.45 && a < 0.2) return '#fff27a'
        return Math.abs(a) > 0.8 ? '#f4c828' : '#ffd83a'
      })
    }
    v.speckle(10, ['#a8801a', '#8a6a1a'], (x, y, z, c) => c === '#ffd83a')
    return { rot: [0.35, 0.1, 0.25] }
  },
  orange(v) {
    v.ball(0, 0, 0, 8.4, (x, y, z, a, b, c) => {
      if ((x * 7 + y * 13 + z * 5) % 9 === 0) return '#e87410'
      const l = -a * 0.4 + b * 0.5 + c * 0.75
      return l > 0.95 ? '#ffc060' : l > 0.6 ? '#ffa628' : b < -0.6 ? '#d86a0a' : '#ff941a'
    })
    v.ell(0, 8.5, 0, 1.6, 0.8, 1.6, '#9a7a2a')
    v.line(0, 8, 0, 0.5, 10, 0, 0.6, '#6b4a18')
    leaf(v, 3, 9.6, 0, 3.4, 0.35, 0.3, '#3faa2a')
    return { rot: [0.2, 0.3, 0] }
  },
  strawberry(v) {
    v.fill(-9, 9, -10, 8, -9, 9, (x, y, z) => {
      const t = (y + 10) / 17
      const r = 7.6 * Math.pow(Math.sin(Math.min(1, t) * Math.PI * 0.62), 0.85)
      const d = Math.hypot(x, z)
      if (d > r || t > 1) return null
      if ((x + y * 2 + z * 3) % 5 === 0 && d > r - 1.2) return '#ffe14a'
      const l = (-x * 0.4 + z * 0.8) / Math.max(1, r)
      return l > 0.75 ? '#ff5a5a' : y < -6 ? '#c01020' : '#e01e2a'
    })
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * TAU
      v.ell(Math.cos(a) * 3.4, 8, Math.sin(a) * 3.4, 3.4, 0.8, 1.4, k % 2 ? '#3fae2a' : '#2f8a22', [0, -a, -0.25])
    }
    v.line(0, 8, 0, 0.5, 12, 0, 0.8, '#3f9a2a')
    return { rot: [0.25, 0.3, 0.1], finish: 'gloss' }
  },
  pear(v) {
    const col = (x, y, z, a, b, c) => {
      if (hash(x, y, z) > 0.93) return '#8a9a2a'
      const l = -a * 0.4 + b * 0.4 + c * 0.75
      return l > 0.85 ? '#e8f07a' : x > 3 && y < 0 ? '#e0c040' : y < -6 ? '#a8c030' : '#c8dc4a'
    }
    v.ell(0, -3, 0, 7.6, 7, 7.6, col)
    v.ell(0, 4, 0, 4.6, 6, 4.6, col)
    v.line(0, 9, 0, 1.2, 13.5, 0, 0.75, '#6b3a18')
    leaf(v, 3.6, 12.5, 0, 3.2, 0.4, 0.2)
    return { rot: [0.1, 0.3, -0.1] }
  },
  lemon(v) {
    const col = (x, y, z, a, b, c) => {
      if ((x * 5 + y * 11 + z * 7) % 11 === 0) return '#f0c418'
      const l = -a * 0.3 + b * 0.5 + c * 0.75
      return l > 0.9 ? '#fff59a' : b < -0.5 ? '#e8c020' : '#ffe23a'
    }
    v.ell(0, 0, 0, 9, 6.6, 6.6, col)
    v.ell(-9.2, 0, 0, 2, 1.6, 1.6, '#f4d020')
    v.ell(9.2, 0, 0, 2, 1.6, 1.6, '#f4d020')
    return { rot: [0.15, 0.4, 0.3], finish: 'gloss' }
  },
  cherry(v) {
    const col = (x, y, z, a, b, c) => {
      const l = -a * 0.5 + b * 0.5 + c * 0.7
      return l > 0.95 ? '#ff7a8a' : l > 0.6 ? '#e8203a' : b < -0.5 ? '#8a0a1a' : '#c80e28'
    }
    v.ball(-4.8, -5, 0, 4.7, col)
    v.ball(4.8, -6, 1, 4.7, col)
    v.line(-4.2, -1, 0, 0, 12, 0, 0.7, '#3a9a2a')
    v.line(4.2, -2, 1, 0, 12, 0, 0.7, '#3a9a2a')
    v.ell(0, 12.5, 0, 1.2, 1, 1.2, '#5a3a18')
    leaf(v, 3.6, 12.5, 0, 3.6, -0.35, 0.2)
    return { rot: [0.1, 0.25, 0], finish: 'gloss' }
  },
  grapes(v) {
    const r = v.rand
    const rows = [[6, 5, 4.8], [2, 5, 4.6], [-2, 4, 3.8], [-6, 3, 3], [-9.5, 1, 0]]
    const tones = ['#8a3ad0', '#a04ae0', '#7a2ab8']
    let n = 0
    for (const [y, count, rr] of rows) {
      for (let i = 0; i < count; i++) {
        const a = (i / count) * TAU + y
        const c = tones[n++ % 3]
        v.ball(Math.cos(a) * rr, y + (r() - 0.5), Math.sin(a) * rr, 2.9, (x, yy, z, A, B, C) => (-A * 0.5 + B * 0.5 + C * 0.7 > 0.9 ? '#d8a8ff' : B < -0.5 ? shade(c, 0.7) : c))
      }
      if (count > 2) v.ball(0, y, 0, 2.6, '#6a2aa0')
    }
    v.line(0, 8, 0, 1, 13, 0, 0.8, '#6b4a18')
    leaf(v, 4, 11, 0, 4, 0.4, 0.3, '#4cc23a')
    return { rot: [0.15, 0.3, 0] }
  },
  corn(v) {
    v.cyl('y', 0, 0, -10, 10, 4.4, 3.8, (x, y, z, t, ang) => {
      const k = Math.floor(((ang + Math.PI) / TAU) * 14)
      const groove = (y + 20) % 2 === 0 || Math.abs(((ang + Math.PI) / TAU) * 14 - k - 0.5) > 0.42
      return groove ? '#e0a820' : k % 2 ? '#ffe44a' : '#ffd52a'
    })
    v.ell(0, 10.5, 0, 3, 2, 3, '#f4cc30')
    for (const side of [1, -1]) {
      v.fill(-7, 7, -14, 4, -7, 7, (x, y, z) => {
        const rr = Math.hypot(x, z)
        if (rr < 4.4 || rr > 5.6) return null
        const ang = Math.atan2(z, x * side)
        const w = 1.25 * (1 - (y + 14) / 18)
        if (Math.abs(ang) > w || v.has(x, y, z)) return null
        return Math.abs(ang) < 0.2 ? '#3f9a2a' : (x + y) % 3 === 0 ? '#4fb02e' : '#69c83a'
      })
    }
    v.cyl('y', 0, 0, -14, -11, 2, 2.4, '#4f9a2a')
    return { rot: [0.2, 0.5, -0.4] }
  },
  broccoli(v) {
    v.cyl('y', 0, 0, -12, -2, 2.4, 3, (x, y, z) => (hash(x, y, z) > 0.85 ? '#8ac850' : '#a8d86a'))
    for (const [x, z] of [[-3, 1], [3, -1], [0, 3], [0, -3]]) v.line(0, -4, 0, x, 1, z, 1.2, '#98cc5a')
    const top = (x, y, z, a, b) => {
      const h = hash(x, y, z)
      if (b > 0.6) return h > 0.5 ? '#5ec84a' : '#4cb83e'
      return h > 0.7 ? '#277a24' : h > 0.35 ? '#2f8a2a' : '#3fa83a'
    }
    for (const [x, y, z, r] of [[0, 4, 0, 5.6], [-5, 2, 1, 4.2], [5, 2, -1, 4.2], [0, 3, 5, 4], [0, 3, -5, 4], [-3, 7, -2, 3.6], [3, 7, 2, 3.6], [-4, 5, 4, 3.2]]) v.ball(x, y, z, r, top, 0.25)
    return { rot: [0.15, 0.3, 0] }
  },
  mushroom(v) {
    const spots = [[0.2, 0.9, 0.4], [-0.6, 0.6, 0.5], [0.7, 0.55, 0.45], [-0.1, 0.5, 0.86], [0.55, 0.6, -0.55], [-0.7, 0.55, -0.4], [0, 0.97, -0.25]].map(([a, b, c]) => {
      const l = Math.hypot(a, b, c)
      return [a / l, b / l, c / l]
    })
    v.ell(0, 1, 0, 9.6, 7.2, 9.6, (x, y, z, a, b, c) => {
      if (y < 1) return null
      const l = Math.hypot(a, b, c) || 1
      for (const [p, q, r] of spots) if ((a / l) * p + (b / l) * q + (c / l) * r > 0.95) return '#ffffff'
      return b > 0.7 && c > 0 ? '#ff4a4a' : b < 0.25 ? '#b81a1a' : '#e02a2a'
    })
    v.cyl('y', 0, 0, 0, 1, 9, 9, (x, y, z, t, ang, rr) => (rr > 0.42 ? (Math.round(ang * 9) % 2 ? '#e8dcc0' : '#d8c8a8') : '#f0e8d8'))
    v.cyl('y', 0, 0, -9, 0, 3.8, 3.2, (x, y, z, t, ang) => (Math.cos(ang - 1.6) > 0.5 ? '#ffffff' : '#ece6d6'))
    v.ell(0, -8.5, 0, 4.4, 2, 4.4, '#e6dcc8')
    return { rot: [0.25, 0.3, 0] }
  },
  eggplant(v) {
    for (let i = 0; i <= 30; i++) {
      const t = i / 30
      v.ball(Math.sin(t * 1.3) * 3, -9 + t * 15, 0, 6.3 - t * 3.1, (x, y, z, a, b, c) => {
        const l = -a * 0.5 + c * 0.8
        return l > 0.75 ? '#9a5ad8' : l > 0.35 ? '#6e2aa8' : b < -0.6 && t < 0.2 ? '#3a0e5a' : '#56188a'
      })
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU
      v.ell(Math.sin(1.3) * 3 + Math.cos(a) * 2.6, 5.5, Math.sin(a) * 2.6, 2.8, 0.9, 1.4, '#3a9a2a', [0, -a, -0.9])
    }
    v.cyl('y', Math.sin(1.3) * 3, 0, 6, 10, 1.4, 1.1, '#4f8a2a')
    return { rot: [0.1, 0.2, -0.35], finish: 'gloss' }
  },
  avocado(v) {
    const inside = (x, y, s = 1) => {
      const b1 = (x / (7.6 * s)) ** 2 + ((y + 3) / (7 * s)) ** 2
      const b2 = (x / (5 * s)) ** 2 + ((y - 4) / (6 * s)) ** 2
      return b1 <= 1 || b2 <= 1
    }
    v.fill(-9, 9, -11, 11, -4, 0, (x, y, z) => {
      if (!inside(x, y)) return null
      const zr = Math.sqrt(Math.max(0, 1 - (x / 9) ** 2 - ((y + 1) / 11) ** 2)) * 4.2
      if (-z > zr) return null
      if (z < 0) return hash(x, y, z) > 0.8 ? '#2a4a1a' : '#3a6a2a'
      if (!inside(x, y, 0.86)) return '#2f5a22'
      if (!inside(x, y, 0.74)) return '#a8d84a'
      return inside(x, y, 0.5) ? '#f0f8b0' : '#d8f08a'
    })
    v.ell(0, -2.5, 0.6, 3.6, 3.8, 3.4, (x, y, z, a, b, c) => (-a * 0.5 + b * 0.5 + c * 0.7 > 0.85 ? '#c07a3a' : '#8a4a1e'))
    return { rot: [0.15, 0.4, 0.15] }
  },
  watermelon(v) {
    v.fill(-12, 12, -12, 11, -2, 2, (x, y, z) => {
      const yb = -8 - 3 * (1 - (x / 11.5) ** 2)
      if (y < yb || Math.abs(x) > (10 - y) * 0.62 || y > 10) return null
      const dy = y - yb
      if (dy < 1.4) return (x + 20) % 3 === 0 ? '#1f6a1e' : '#2f8a2a'
      if (dy < 2.4) return '#a8e07a'
      if (dy < 3.2) return '#f4fff0'
      if (Math.abs(z) === 2 && (x + 20) % 4 === 1 && (y + 20) % 5 === 2 && dy > 5) return '#1a1a1a'
      return y > 4 ? '#ff5a68' : '#f03848'
    })
    return { rot: [0.1, 0.4, 0.08] }
  },
  pineapple(v) {
    v.ell(0, -2, 0, 6.8, 9, 6.8, (x, y, z) => {
      const u = Math.round(Math.atan2(z, x) * 6.6)
      const g1 = (((u + y) % 4) + 4) % 4 === 0
      const g2 = (((u - y) % 4) + 4) % 4 === 0
      if (g1 || g2) return '#a8700e'
      return (((u + y) % 4) + 4) % 4 === 2 && (((u - y) % 4) + 4) % 4 === 2 ? '#d89a18' : z > 3 && x < 0 ? '#ffd84a' : '#f0c020'
    })
    for (let k = 0; k < 9; k++) {
      const a = (k / 9) * TAU
      const h = 9 + (k % 3) * 2.5
      leafy(v, 0, 6, 0, Math.cos(a) * 4.5, 6 + h, Math.sin(a) * 4.5, 1.05, '#5fd23a', '#2f8a22')
    }
    leafy(v, 0, 6, 0, 0, 20, 0, 1.1)
    return { rot: [0.1, 0.3, 0.05] }
  },
  toast(v) {
    const inside = (x, y, s) => (Math.abs(x) <= 8 - s && y >= -9 + s && y <= 5) || Math.hypot(x + 4, y - 5) <= 4.6 - s || Math.hypot(x - 4, y - 5) <= 4.6 - s
    v.fill(-9, 9, -10, 11, -1, 1, (x, y) => {
      if (!inside(x, y, 0)) return null
      if (!inside(x, y, 1.6)) return y > 6 ? '#a8601e' : '#b8702a'
      return Math.hypot(x, y) < 4 ? '#e8b860' : hash(x, y, 0) > 0.9 ? '#e0b060' : '#f4d48a'
    })
    v.box(-3, -3, 2, 3, 2, 2, (x, y) => (y === 2 || x === -3 ? '#fffbd0' : '#fff0a0'))
    v.box(-2, -2, 3, 2, 1, 3, '#fff7c0')
    return { rot: [0.2, 0.35, 0] }
  },
  bread(v) {
    v.fill(-12, 12, -6, 7, -7, 7, (x, y, z) => {
      const ax = Math.abs(x)
      const f = ax > 8 ? Math.sqrt(Math.max(0, 1 - ((ax - 8) / 3.6) ** 2)) : 1
      if (y < -5 || (z / (6.4 * f)) ** 2 + ((y + 5) / (11 * f)) ** 2 > 1) return null
      if (y > 1) {
        const g = (((x + z * 0.6) % 6) + 6) % 6
        if (g < 1) return '#8a5022'
        if (g < 2) return '#f0c070'
        return '#c8803a'
      }
      return y < -4 ? '#a8682a' : Math.abs(z) > 4 ? '#d89a50' : '#c88840'
    })
    return { rot: [0.25, 0.55, 0] }
  },
  cheese(v) {
    v.fill(-10, 11, -4, 4, -6, 7, (x, y, z) => {
      if (z > -5 + 11 * (1 - (x + 9) / 20)) return null
      if (x < -9 || z < -5) return null
      if (z === -5) return '#f0a818'
      return y === 4 ? '#ffe060' : '#ffcf3a'
    })
    const holes = [[-5, 4, -1, 2.2], [2, 1, -2, 1.8], [-3, -2, 2, 1.6], [-7, 0, 4, 1.5], [4, 4, -3, 1.4], [-1, -4, -2, 1.5], [6, -1, -4, 1.3], [-6, -3, -4, 1.4]]
    for (const [x, y, z, r] of holes) v.ball(x, y, z, r, '')
    v.paint((x, y, z, c) => {
      for (const [hx, hy, hz, r] of holes) if (Math.hypot(x - hx, y - hy, z - hz) < r + 1.2) return '#e0a818'
      return null
    })
    return { rot: [0.35, 0.5, 0] }
  },
  croissant(v) {
    v.fill(-14, 14, -6, 12, -6, 6, (x, y, z) => {
      const th = Math.atan2(x, y + 4)
      const t = (th + 1.35) / 2.7
      if (t < 0 || t > 1) return null
      const rho = Math.hypot(x, y + 4)
      const wave = Math.abs(Math.cos(t * 7 * Math.PI))
      const rt = (1.4 + 3.4 * Math.pow(Math.sin(Math.PI * t), 0.8)) * (0.84 + 0.16 * wave)
      const dr = rho - 9
      if (dr * dr + (z * 1.1) ** 2 > rt * rt) return null
      if (wave < 0.22) return '#a86a20'
      if (t < 0.08 || t > 0.92) return '#c88a38'
      return dr > rt * 0.4 || z > rt * 0.5 ? '#f8d080' : '#e8a848'
    })
    return { rot: [0.5, 0.2, 0], finish: 'gloss' }
  },
  cookie(v) {
    v.cyl('y', 0, 0, -1, 1, 10, 10, (x, y, z) => {
      const h = hash(x, y, z)
      return h > 0.8 ? '#e8bc70' : h < 0.15 ? '#c08840' : '#d8a050'
    })
    v.fill(-10, 10, 2, 2, -10, 10, (x, y, z) => (Math.hypot(x, z) < 9 && hash(x, 5, z) > 0.35 ? '#dcaa5c' : null))
    const r = v.rand
    for (let i = 0; i < 13; i++) {
      const a = r() * TAU
      const d = r() * 8.4
      v.ell(Math.cos(a) * d, 2.3, Math.sin(a) * d, 1.4, 1, 1.4, (x, y, z, A, B) => (B > 0.3 ? '#5a3216' : '#3a1e0c'))
    }
    for (let i = 0; i < 6; i++) {
      const a = r() * TAU
      v.ball(Math.cos(a) * 9.6, 0, Math.sin(a) * 9.6, 1.2, '#4a2812')
    }
    return { rot: [1.0, 0.1, 0.12] }
  },
  pancakes(v) {
    for (let k = 0; k < 3; k++) {
      const y0 = -6 + k * 3
      v.cyl('y', 0, 0, y0, y0 + 2, 9 - k * 0.3, 9 - k * 0.3, (x, y, z, t, ang, rr) => (rr > 0.9 ? (y === y0 + 1 ? '#f8d088' : '#d8903a') : '#e8a850'))
    }
    v.cyl('y', 0, 0, 3, 3, 6.6, 6.6, (x, y, z) => (hash(x, y, z) > 0.75 ? '#d07020' : '#a8501a'))
    for (const a of [0.4, 1.7, 2.6, 4.1, 5.3]) {
      const x = Math.round(Math.cos(a) * 8.6)
      const z = Math.round(Math.sin(a) * 8.6)
      v.line(x, 2, z, x, -1 - (a * 3) % 4, z, 0.75, '#a0480e')
    }
    v.fill(-6, 6, 3, 3, -6, 6, (x, y, z) => (Math.hypot(x, z) < 8 && Math.hypot(x, z) > 6 && hash(x, 9, z) > 0.4 ? '#b05818' : null))
    v.box(-2, 4, -2, 2, 6, 2, (x, y) => (y === 6 ? '#fffbd0' : '#fff0a0'))
    return { rot: [0.4, 0.2, 0], finish: 'gloss' }
  },
  donut(v) {
    const sprinkles = ['#ffffff', '#ffe14a', '#4fc8ff', '#7be04a', '#b07cff', '#ff5a5a']
    v.tor('y', 0, 0, 0, 6.6, 3.7, (x, y, z, ang, ta, up) => {
      const drip = Math.sin(ang * 5 + 1) > 0.55 && Math.cos(ta) > 0.3
      if (up > -0.05 || (drip && up > -0.65)) {
        if (up > 0.6 && hash(x, y, z) > 0.86) return sprinkles[Math.floor(hash(z, x, y) * sprinkles.length)]
        return up > 0.75 && Math.cos(ta) < 0 ? '#ffb2d8' : '#ff7fbd'
      }
      return up < -0.7 ? '#b8803e' : '#d9a05b'
    })
    return { rot: [0.75, 0, 0.12], finish: 'gloss' }
  },
  chocolate(v) {
    v.fill(-6, 6, -1, 12, -2, 2, (x, y) => (y === 12 ? '#8a4e28' : '#6a3618'))
    v.fill(-6, 6, -1, 12, 3, 3, (x, y) => {
      const gx = (x + 6) % 4
      const gy = (y + 1) % 5
      if (gx === 0 || gy === 0) return null
      return gx === 1 || gy === 1 ? '#9a5a30' : '#7a4220'
    })
    v.fill(-7, 7, -13, -1, -3, 4, (x, y, z) => {
      if (y >= -2) return '#ffd23a'
      if (z === 4 && Math.abs(x) <= 4 && y >= -9 && y <= -4) return Math.hypot(x, y + 6.5) < 1.8 ? '#e02a2a' : '#ffffff'
      return x === -7 || y === -13 ? '#b81818' : '#e02424'
    })
    return { rot: [0.15, 0.45, -0.3] }
  },
  lollipop(v) {
    v.cyl('z', 0, 6, -1, 1, 8.4, 8.4, (x, y, z, t, ang, rr) => {
      if (rr > 0.9) return '#ff9ad8'
      const s = (ang + rr * 7) / TAU
      const band = ((s * 4) % 1 + 1) % 1
      return band < 0.5 ? '#ff6ac8' : '#ffd0f0'
    })
    v.fill(-9, 9, -3, 15, 2, 2, (x, y) => {
      const dx = x
      const dy = y - 6
      return Math.abs(dx - dy) < 1.1 || Math.abs(dx + dy) < 1.1 ? (Math.hypot(dx, dy) < 8 ? '#ffffff' : null) : null
    })
    v.cyl('y', 0, 0, -16, -2, 1, 1, '#f4f4f4')
    return { rot: [0.05, 0.4, -0.25], finish: 'gloss' }
  },
  popsicle(v) {
    v.fill(-5, 5, -7, 11, -2, 2, (x, y) => {
      if (y > 7 && Math.hypot(Math.max(0, Math.abs(x) - 2), y - 7) > 3.6) return null
      if (y >= 1 && y <= 3) return '#ffd0e4'
      return x < -2 ? '#ff8ab8' : x > 3 ? '#e8508a' : '#ff6aa0'
    })
    v.line(-2, -7, 2, -2, -9, 2, 0.8, '#ff6aa0')
    v.box(-1, -15, -1, 1, -8, 1, (x, y) => (y === -15 && Math.abs(x) === 1 ? null : '#e8c080'))
    return { rot: [0.1, 0.4, -0.3], finish: 'gloss' }
  },
  cupcake(v) {
    v.cyl('y', 0, 0, -11, -2, 5.6, 7.6, (x, y, z, t, ang) => (y === -11 ? '#2aa0c0' : Math.floor(((ang + Math.PI) / TAU) * 16) % 2 ? '#3fc4e0' : '#62dcf2'))
    const frost = (x, y, z, a, b, c) => (-a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? '#ffe2f2' : b < -0.3 ? '#ffa0d0' : '#ffbcde')
    v.ell(0, -0.5, 0, 8.4, 3, 8.4, frost)
    v.ell(0, 2.6, 0, 6.4, 2.7, 6.4, frost)
    v.ell(0, 5.2, 0, 4.2, 2.3, 4.2, frost)
    v.ell(0, 7.2, 0, 2.2, 1.6, 2.2, frost)
    v.speckle(26, ['#ffffff', '#ffe14a', '#4fc8ff', '#7be04a', '#b07cff'], (x, y, z, c) => y > 0 && c.startsWith('#ff'))
    v.ball(0, 9.8, 0, 1.9, (x, y, z, a, b, c) => (b > 0.4 && a < 0 ? '#ff7a8a' : '#e01a2a'))
    v.line(0, 11, 0, 1.4, 13.5, 0, 0.5, '#5a3a18')
    return { rot: [0.2, 0.3, 0] }
  },
  icecream(v) {
    v.cyl('y', 0, 0, -15, -1, 0.7, 5.8, (x, y, z, t, ang) => {
      const u = Math.round(((ang + Math.PI) / TAU) * 24)
      return ((u + y) % 4 + 4) % 4 === 0 || ((u - y) % 4 + 4) % 4 === 0 ? '#c8843a' : '#ecb464'
    })
    const pink = (x, y, z, a, b, c) => (-a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? '#ffd8ea' : b < -0.2 ? '#ff9ac4' : '#ffb0d2')
    v.ell(0, 4, 0, 6.8, 5.8, 6.8, pink)
    v.ell(0, 0, 0, 7.3, 1.8, 7.3, pink)
    for (const a of [0.3, 1.5, 2.4, 3.9, 5.1]) v.line(Math.cos(a) * 6.4, -1, Math.sin(a) * 6.4, Math.cos(a) * 6.2, -3 - (a * 2) % 2, Math.sin(a) * 6.2, 0.9, '#ff9ac4')
    v.ball(0, 10.6, 0, 1.9, (x, y, z, a, b) => (b > 0.4 && a < 0 ? '#ff7a8a' : '#e01a2a'))
    v.line(0, 12, 0, 1.2, 14.5, 0, 0.5, '#5a3a18')
    return { rot: [0.15, 0.3, -0.2] }
  },
  fries(v) {
    const r = v.rand
    const fries = []
    for (let i = 0; i < 11; i++) {
      const x = -4.5 + (i % 6) * 1.8 + (r() - 0.5)
      const z = i < 6 ? -1.2 : 1.4
      const h = 6 + r() * 7
      fries.push([x, z, h, (r() - 0.5) * 3])
    }
    for (const [x, z, h, lean] of fries) v.line(x, -4, z, x + lean, h, z + (r() - 0.5), 0.95, (xx, y, zz, t) => (t > 0.92 ? '#e8b828' : hash(xx, y, zz) > 0.85 ? '#ffd040' : '#ffe458'))
    v.fill(-7, 7, -12, 2, -5, 5, (x, y, z) => {
      const w = 5.4 + (y + 12) * 0.12
      const d = 3.4 + (y + 12) * 0.08
      if (Math.abs(x) > w || Math.abs(z) > d) return null
      const shell = Math.abs(x) > w - 1 || Math.abs(z) > d - 1 || y === -12
      if (!shell) return null
      if (z > d - 1 && Math.abs(x) <= 2.6 && y >= -8 && y <= -3) return '#ffd23a'
      return y === 2 ? '#ff3a3a' : x < -w + 1 ? '#c01820' : '#e0202a'
    })
    return { rot: [0.15, 0.4, 0] }
  },
  hotdog(v) {
    const bun = (x, y, z, a, b, c) => (b > 0.4 ? '#d08a30' : b < -0.6 ? '#c88a40' : '#e8b050')
    v.ell(0, -2, 0, 11, 3.6, 4.8, bun)
    v.ell(0, 0.5, 3, 10.6, 3, 2.4, bun)
    v.ell(0, 0.5, -3, 10.6, 3, 2.4, bun)
    v.fill(-12, 12, -1, 4, -1, 1, (x, y, z) => (Math.abs(x) < 10 && v.has(x, y, z) ? '#fff0c8' : null))
    v.cyl('x', 1.6, 0, -12, 12, 2.5, 2.5, (x, y, z, t, ang) => (Math.sin(ang) > 0.6 ? '#e06a4a' : '#c0442a'))
    v.ball(-12.5, 1.6, 0, 2.4, '#b03a22')
    v.ball(12.5, 1.6, 0, 2.4, '#b03a22')
    v.fill(-10, 10, 4, 5, -3, 3, (x, y, z) => (y === 4 && Math.abs(z - 1.6 * Math.sin(x * 0.9)) < 0.8 ? '#ffd020' : null))
    return { rot: [0.35, 0.45, 0] }
  },
  burger(v) {
    v.cyl('y', 0, 0, -9, -6, 7.8, 8.2, (x, y) => (y === -9 ? '#c07a30' : '#d89040'))
    v.cyl('y', 0, 0, -5, -3, 8.6, 8.6, (x, y, z) => (hash(x, y, z) > 0.75 ? '#4a2412' : '#6a3a1e'))
    v.fill(-9, 9, -2, -2, -9, 9, (x, y, z) => (Math.abs(x) <= 8 && Math.abs(z) <= 8 ? '#ffcc33' : null))
    for (const [x, z] of [[8, 8], [-8, 8], [8, -8], [-8, -8]]) v.line(x, -2, z, x * 1.05, -4, z * 1.05, 0.8, '#ffc020')
    v.cyl('y', 0, 0, -1, -1, 7.8, 7.8, (x, y, z, t, ang, rr) => (rr > 0.85 ? '#c81820' : '#e8262e'))
    v.fill(-11, 11, -1, 0, -11, 11, (x, y, z) => {
      const d = Math.hypot(x, z)
      const edge = 8.6 + 1 * Math.sin(Math.atan2(z, x) * 7)
      if (d < 6 || d > edge) return null
      if (y === -1 && Math.sin(Math.atan2(z, x) * 7) < 0.4) return null
      return hash(x, y, z) > 0.5 ? '#69c23a' : '#8ae04a'
    })
    v.ell(0, 1, 0, 8.6, 7.2, 8.6, (x, y, z, a, b, c) => {
      if (y < 1) return null
      return -a * 0.4 + b * 0.5 + c * 0.7 > 0.9 ? '#f8c070' : '#e09a3c'
    })
    v.speckle(22, ['#fff3d0'], (x, y) => y > 4)
    return { rot: [0.3, 0.3, 0] }
  },
  pizza(v) {
    v.fill(-11, 11, -12, 11, -2, 2, (x, y, z) => {
      const hw = (y + 11) * 0.48
      if (Math.abs(x) > hw || y < -11) return null
      if (y >= 7) {
        if (y > 7 + 3 * Math.sqrt(Math.max(0, 1 - (x / hw) ** 2)) || Math.abs(z) > 2) return null
        return y > 8 ? '#e8a850' : '#d08a3a'
      }
      if (Math.abs(z) > 1) return null
      if (z === -1) return '#e8b060'
      return y === 6 ? '#e04a2a' : '#ffd84a'
    })
    for (const [x, y] of [[-2.5, 3], [3, 1], [-1, -4], [1, -8.5]]) v.cyl('z', x, y, 2, 2, 2.3, 2.3, (xx, yy) => (hash(xx, yy, 0) > 0.8 ? '#8a1018' : '#c8202a'))
    for (const [x, y] of [[-5, 4], [5, 5], [3, -4], [-3, -1]]) v.line(x, y, 2, x, y - 2.5, 2, 0.7, '#ffe070')
    v.ell(4.5, -0.5, 2, 1.6, 0.9, 0.7, '#3fa83a', [0, 0, 0.6])
    v.ell(-3.5, -7, 2, 1.4, 0.8, 0.7, '#2f8a2a', [0, 0, -0.5])
    return { rot: [0.15, 0.35, 0] }
  },
  taco(v) {
    v.cyl('x', 0, 0, -9, 9, 6.4, 6.4, (x, y, z, t, ang, rr) => {
      if (y > 1 || rr < 0.8) return null
      return hash(x, y, z) > 0.85 ? '#e8a820' : '#ffd23a'
    })
    v.fill(-8, 8, -2, 3, -5, 5, (x, y, z) => (Math.hypot(y, z) < 5.4 && hash(x, y, z) > 0.15 ? '#8a4a22' : null))
    v.fill(-8, 8, 2, 6, -6, 6, (x, y, z) => {
      if (Math.hypot(y - 1, z) > 6.2 - (y - 2) * 0.4) return null
      const h = hash(x, y, z)
      if (y > 4 && h > 0.5) return null
      return h > 0.85 ? '#e8262e' : h > 0.7 ? '#ffd84a' : h > 0.35 ? '#69c23a' : '#8ae04a'
    })
    return { rot: [0.3, 0.5, 0] }
  },
  sushi(v) {
    v.ell(0, -2, 0, 8.4, 3.8, 5, (x, y, z) => (hash(x, y, z) > 0.6 ? '#eef0f4' : '#ffffff'))
    v.ell(0, 1.2, 0, 9.6, 3, 5.8, (x, y, z) => {
      if (y < 1) return null
      return (((x + y) % 4) + 4) % 4 === 0 ? '#ffd0b8' : z > 3 ? '#ffa070' : '#ff8a5c'
    })
    v.skin((x, y, z) => Math.abs(x) <= 1 && y > -6 && y < 5, '#1e2a1e')
    v.paint((x, y, z) => (Math.abs(x) <= 1 && v.exposed(x, y, z) ? '#26341e' : null))
    return { rot: [0.35, 0.45, 0], finish: 'gloss' }
  },
  ramen(v) {
    v.fill(-10, 10, -9, 2, -10, 10, (x, y, z) => {
      const d = Math.hypot(x, y - 2, z)
      if (d > 9.6 || d < 8.4 || y > 2) return null
      if (d < 9) return '#f8f4ec'
      return y > -1 ? '#ffffff' : (Math.round(Math.atan2(z, x) * 5) + y) % 3 === 0 ? '#ffffff' : '#e0202a'
    })
    v.cyl('y', 0, 0, -9, -8, 4.4, 4.4, '#c81818')
    v.cyl('y', 0, 0, 1, 1, 8.6, 8.6, '#f0b860')
    v.fill(-8, 8, 2, 2, -8, 8, (x, y, z) => (Math.hypot(x, z) < 8 && Math.sin(x * 1.3 + Math.sin(z * 0.8) * 2) > 0.45 ? '#ffe08a' : null))
    v.ell(3, 2.6, 2, 3, 1.4, 2.3, (x, y, z, a, b, c) => (Math.hypot(a, c) < 0.5 && b > 0 ? '#ffa020' : '#ffffff'))
    v.cyl('y', -3, -2.5, 2, 3, 2.3, 2.3, (x, y, z, t, ang, rr) => (Math.abs(rr - (ang + Math.PI) / TAU) < 0.18 && y === 3 ? '#ff6aa0' : '#ffffff'))
    v.speckle(14, ['#69c23a', '#4fa82a'], (x, y) => y === 2)
    v.line(-9, 5, -4, 10, 12, -6, 0.7, '#c88a4a')
    v.line(-9, 6, -2, 10, 13, -3, 0.7, '#b87a3a')
    return { rot: [0.45, 0.2, 0] }
  },
  drumstick(v) {
    v.fill(-8, 8, -6, 12, -8, 8, (x, y, z) => {
      const k = 1 - Math.max(0, -(y - 3) / 12)
      const a = x / (6.6 * k)
      const b = (y - 3) / 8.4
      const c = z / (6.6 * k)
      if (a * a + b * b + c * c > 1) return null
      const h = hash(x, y, z)
      if (h > 0.9) return '#7a3412'
      return -a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? '#e0904a' : h > 0.55 ? '#a85024' : '#b85e2a'
    })
    v.cyl('y', 0, 0, -12, -4, 1.6, 1.6, (x, y, z, t, ang) => (Math.cos(ang - 2) > 0.5 ? '#ffffff' : '#ece6da'))
    v.ball(-1.5, -13.4, 0, 2, '#f8f4ea')
    v.ball(1.5, -13.4, 0, 2, '#f8f4ea')
    return { rot: [0.15, 0.3, 0.45], finish: 'gloss' }
  },
  steak(v) {
    v.fill(-12, 12, -2, 2, -12, 12, (x, y, z) => {
      const a = Math.atan2(z, x)
      const r = 9.4 + 1.5 * Math.sin(2 * a) + Math.sin(3 * a + 1)
      const d = Math.hypot(x, z)
      if (d > r - (Math.abs(y) === 2 ? 0.8 : 0)) return null
      if (d > r - 1.8 && a > -0.6 && a < 1.7) return '#f4e4d4'
      if (Math.abs(y) === 2 && (((x - z) % 5) + 5) % 5 === 0) return '#5a1a10'
      return hash(x, y, z) > 0.82 ? '#e0605a' : '#c8302a'
    })
    return { rot: [1.0, 0.35, 0.1] }
  },
  cake(v) {
    v.fill(-9, 9, -6, 4, -8, 10, (x, y, z) => {
      if (Math.abs(x) > (10 - z) * 0.5 || z < -7) return null
      if (y >= 3 || z === -7) return y === 4 ? '#ffc8e0' : '#ffb0d0'
      if (y === -3 || y === 1) return '#ffffff'
      return hash(x, y, z) > 0.88 ? '#f0d088' : '#f8e0a0'
    })
    for (const x of [-6, -3, 1, 4, 7]) v.line(x, 3, -8, x, 1 - Math.abs(x % 3), -8, 0.7, '#ffb0d0')
    v.ell(0, 6, -4.5, 2.8, 1.6, 2.8, '#ffffff')
    v.ell(0, 7.4, -4.5, 1.6, 1.2, 1.6, '#ffffff')
    v.ball(0, 9.3, -4.5, 1.8, (x, y, z, a, b) => (b > 0.4 && a < 0 ? '#ff7a8a' : '#e0202a'))
    return { rot: [0.3, 0.6, 0] }
  },
  milkshake(v) {
    v.cyl('y', 0, 0, -12, 3, 5, 6.4, (x, y, z, t, ang) => (y === -7 || y === -6 || y === -1 ? '#ffffff' : Math.cos(ang - 2) > 0.6 ? '#ffc8e0' : '#ffaed0'))
    v.cyl('y', 0, 0, 3, 4, 6.8, 6.8, '#ffd0e4')
    const cream = (x, y, z, a, b, c) => (-a * 0.4 + b * 0.4 + c * 0.7 > 0.9 ? '#ffffff' : b < -0.4 ? '#e8e4ee' : '#f6f4f8')
    v.ell(0, 6, 0, 5.8, 3.2, 5.8, cream)
    v.ell(0, 8.8, 0, 3.6, 2.4, 3.6, cream)
    v.ell(0, 10.8, 0, 1.9, 1.4, 1.9, cream)
    v.ball(0, 13, 0, 1.7, (x, y, z, a, b) => (b > 0.4 && a < 0 ? '#ff7a8a' : '#e0202a'))
    v.line(2, 4, 1, 5.5, 18, 2, 1, (x, y) => ((y + 20) % 4 < 2 ? '#ff3a4a' : '#ffffff'))
    return { rot: [0.1, 0.3, -0.12], finish: 'gloss' }
  },
  goldenapple(v) {
    appleShape(v, ['#ffc21f', '#fff3a0', '#c8820e', '#ffd84a'], { glowSpark: true })
    return { rot: [0.15, 0.3, 0], finish: 'metal' }
  },
  dragonfruit(v) {
    v.ell(0, 0, 0, 7.6, 8.8, 7.6, (x, y, z, a, b, c) => (-a * 0.4 + b * 0.4 + c * 0.7 > 0.85 ? '#ff6aa8' : b < -0.5 ? '#b8105a' : '#e8207a'))
    const n = 24
    for (let i = 0; i < n; i++) {
      const y = 1 - (i / (n - 1)) * 1.7
      const rr = Math.sqrt(Math.max(0, 1 - y * y))
      const a = i * 2.39996
      const px = Math.cos(a) * rr * 7.4
      const py = y * 8.6
      const pz = Math.sin(a) * rr * 7.4
      v.line(px, py, pz, px * 1.3, py * 1.15 + 2.5, pz * 1.3, 0.8, (x, yy, z, t) => (t > 0.55 ? '#7ad83a' : '#ff4a9a'))
    }
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * TAU
      v.line(0, 8, 0, Math.cos(a) * 2.6, 12, Math.sin(a) * 2.6, 0.8, (x, y, z, t) => (t > 0.5 ? '#7ad83a' : '#e8207a'))
    }
    return { rot: [0.15, 0.3, 0.1], finish: 'gloss' }
  },
  rainbowcake(v) {
    const bands = ['#ff3a3a', '#ff9a2a', '#ffe03a', '#4fd23a', '#3fa0ff', '#9a5aff']
    v.box(-6, -10, -6, 6, 3, 6, (x, y) => bands[Math.min(5, Math.floor((y + 10) / 2.34))])
    v.box(-6, 4, -6, 6, 5, 6, (x, y) => (y === 5 ? '#ffffff' : '#f4f2f8'))
    const r = v.rand
    for (let i = 0; i < 14; i++) {
      const side = i % 4
      const p = Math.round(-5 + r() * 10)
      const len = 1 + Math.floor(r() * 4)
      const [x, z] = side === 0 ? [p, 7] : side === 1 ? [7, p] : side === 2 ? [p, -7] : [-7, p]
      v.line(x, 4, z, x, 4 - len, z, 0.6, '#ffffff')
    }
    v.ell(0, 7, 0, 2.6, 1.3, 2.6, '#ffffff')
    v.ball(0, 9.2, 0, 1.8, (x, y, z, a, b) => (b > 0.4 && a < 0 ? '#ff7a8a' : '#e0202a'))
    return { rot: [0.3, 0.6, 0] }
  },
  dango(v) {
    v.cyl('y', 0, 0, -16, 14, 0.9, 0.9, '#d8a868')
    const ball = (cy, base, hi, lo) => v.ball(0, cy, 0, 4.5, (x, y, z, a, b, c) => (-a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? hi : b < -0.5 ? lo : base))
    ball(8.6, '#ffaacc', '#ffd8e8', '#e888aa')
    ball(0, '#f8f6ee', '#ffffff', '#ddd8c8')
    ball(-8.6, '#a8dc88', '#d0f4b8', '#88bc68')
    return { rot: [0.1, 0.3, -0.35], finish: 'gloss' }
  },
  ghostpepper(v) {
    for (let i = 0; i <= 36; i++) {
      const t = i / 36
      const cx = Math.sin(t * 2.4) * 1.8
      const cy = 7 - t * 21
      const r = 4.4 * Math.pow(1 - t, 0.7) + 0.5
      v.fill(cx - r - 1, cx + r + 1, cy - 1, cy + 1, -r - 1, r + 1, (x, y, z) => {
        if (Math.abs(y - cy) > 0.5) return null
        const a = Math.atan2(z, x - cx)
        const rr = r * (1 + 0.14 * Math.sin(a * 5 + t * 9))
        const d = Math.hypot(x - cx, z)
        if (d > rr) return null
        if (Math.sin(a * 5 + t * 9) < -0.7) return '#a8100e'
        return Math.cos(a - 1.8) > 0.6 ? '#ff5a40' : '#e0201a'
      })
    }
    v.ell(0, 8, 0, 4.4, 1.4, 4.4, (x, y, z) => (hash(x, y, z) > 0.5 ? '#3a9a2a' : '#4fb03a'))
    v.line(0, 8, 0, 2, 12.5, 0, 0.9, '#4aa83a')
    return { rot: [0.1, 0.3, -0.3], finish: 'gloss' }
  },
  lavacake(v) {
    v.cyl('y', 0, 0, -6, -6, 10.6, 10.6, (x, y, z, t, ang, rr) => (rr > 0.9 ? '#ffffff' : '#ecebf4'))
    v.ell(0, -5, 0, 8, 10, 8, (x, y, z, a, b, c) => {
      if (y < -5) return null
      const crack = Math.abs(Math.sin(x * 0.9 + z * 0.5) * Math.cos(y * 0.7 - x * 0.3)) < 0.1
      if (crack && b > 0.1) return '*#ff6a10'
      if (b > 0.75 && hash(x, y, z) > 0.6) return '#f0e6e0'
      return -a * 0.4 + b * 0.4 + c * 0.7 > 0.85 ? '#6a3018' : '#4a2010'
    })
    v.ell(0, 4.6, 0, 3, 1.2, 3, '*#ff8a20')
    for (const a of [0.5, 2.1, 3.7, 5.2]) v.line(Math.cos(a) * 2.6, 4.6, Math.sin(a) * 2.6, Math.cos(a) * 6.4, -2 - (a % 2) * 1.5, Math.sin(a) * 6.4, 0.9, '*#ff5a10')
    return { rot: [0.35, 0.3, 0], finish: 'gloss' }
  },
  hotwings(v) {
    const wing = (cx, cy, cz, ang) => {
      v.ell(cx, cy, cz, 3.2, 5.2, 3.2, (x, y, z, a, b, c) => {
        const h = hash(x, y, z)
        if (h > 0.9) return '#a02a10'
        return -a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? '#ffa060' : h > 0.5 ? '#ff6a2a' : '#d84018'
      }, [0, 0, ang])
      const ex = cx + Math.sin(ang) * 5.6
      const ey = cy - Math.cos(ang) * 5.6
      v.line(cx + Math.sin(ang) * 3.5, cy - Math.cos(ang) * 3.5, cz, ex, ey, cz, 1, '#f4f0e6')
      v.ball(ex, ey, cz, 1.4, '#ffffff')
    }
    wing(-4.5, 1, 1, -0.4)
    wing(4, 0, -1, 0.5)
    wing(0, 5, 2, 0.1)
    return { rot: [0.2, 0.3, 0], finish: 'gloss' }
  },
  starfruit(v) {
    v.fill(-12, 12, -12, 12, -4, 4, (x, y, z) => {
      const rho = Math.hypot(x, y)
      const th = Math.atan2(y, x) + Math.PI / 2
      const w = ((th / TAU) * 5) % 1
      const tri = Math.abs(((w + 1) % 1) - 0.5) * 2 // 0 at a point, 1 between
      const rs = 11 - tri * 6.2
      if (rho > rs) return null
      if (Math.abs(z) > 3.4 * (1 - 0.55 * (rho / 11))) return null
      if (rho > rs - 1.1) return '#a8c820'
      if (rho < 1.6) return '#f4ffa0'
      if (rho < 3.4 && tri < 0.25) return '#8a6a2a'
      if (tri < 0.08) return '#b8d830'
      return Math.abs(z) > 1 && hash(x, y, z) > 0.97 ? '*#ffffff' : '#d8f040'
    })
    return { rot: [0.3, 0.35, 0.2], finish: 'gloss' }
  },
  mooncheese(v) {
    v.ball(0, 0, 0, 8.6, (x, y, z, a, b, c) => {
      if (hash(x, y, z) > 0.992) return '*#fffbe0'
      return -a * 0.4 + b * 0.5 + c * 0.7 > 0.85 ? '#fffbd8' : b < -0.5 ? '#e0d890' : '#f4eeb0'
    })
    const craters = [[0.3, 0.3, 0.9, 2.6], [-0.6, -0.2, 0.75, 2.2], [0.7, -0.5, 0.5, 2], [-0.3, 0.8, 0.5, 1.8], [0.2, -0.9, 0.4, 1.8], [-0.85, 0.3, -0.4, 2.2]]
    for (const [a, b, c, r] of craters) {
      const l = Math.hypot(a, b, c)
      v.ball((a / l) * 8.8, (b / l) * 8.8, (c / l) * 8.8, r, '')
    }
    v.paint((x, y, z, c, ex) => {
      if (!ex) return null
      for (const [a, b, cc, r] of craters) {
        const l = Math.hypot(a, b, cc)
        if (Math.hypot(x - (a / l) * 8.8, y - (b / l) * 8.8, z - (cc / l) * 8.8) < r + 1.1) return '#d8cc80'
      }
      return null
    })
    v.line(2, 7, 0, 2, 16, 0, 0.55, '#e8e8f0')
    v.box(3, 13, 0, 7, 16, 0, (x, y) => (x === 7 && y === 13 ? null : '#4fd23a'))
    return { rot: [0.15, 0.4, 0] }
  },
  nebulajelly(v) {
    v.cyl('y', 0, 0, -10, -9, 10.6, 10.6, (x, y, z, t, ang, rr) => (rr > 0.9 && y === -9 ? '#ffffff' : '#e8e8f8'))
    const jelly = (lo, hi, r0, r1, c0, c1) =>
      v.cyl('y', 0, 0, lo, hi, r0, r1, (x, y, z, t, ang) => {
        if (hash(x, y, z) > 0.975) return hash(z, y, x) > 0.5 ? '*#ffffff' : '*#ffe8a0'
        return Math.cos(ang - 2) > 0.55 ? c1 : c0
      })
    jelly(-8, -3, 8.6, 8.1, '#7a2ae0', '#a868ff')
    jelly(-2, 2, 6.8, 6.2, '#3a6af0', '#6a9aff')
    jelly(3, 6, 4.8, 4.2, '#3ad8c0', '#8af0e0')
    jelly(7, 8, 2.6, 2, '#7af0d8', '#c0fff0')
    v.line(0, 9, 0, 0, 11, 0, 1.1, '*#ffe14a')
    v.box(-2, 10, 0, 2, 10, 0, '*#ffe14a')
    return { rot: [0.3, 0.3, 0], finish: 'gloss' }
  },
  galaxydonut(v) {
    v.tor('y', 0, 0, 0, 6.6, 3.7, (x, y, z, ang, ta, up) => {
      if (up > -0.1 || (Math.sin(ang * 4) > 0.5 && up > -0.6)) {
        if (up > 0.5 && hash(x, y, z) > 0.88) return hash(z, x, y) > 0.5 ? '*#ffffff' : '*#ffe060'
        const s = (Math.sin(ang * 3 + ta * 2) + 1) / 2
        return s > 0.7 ? '#c03ae0' : s > 0.35 ? '#4a3ad8' : '#24125a'
      }
      return up < -0.7 ? '#b8803e' : '#e0a860'
    })
    return { rot: [0.75, 0, 0.12], finish: 'gloss' }
  },
}

// --- Build + cache -----------------------------------------------------------------------------
const cache = new Map()
function build(id) {
  const v = new Vox(id.length * 131 + id.charCodeAt(0) * 7)
  const make = BUILD[id]
  const opts = make ? make(v) ?? {} : (v.ball(0, 0, 0, 8, '#ffffff'), {})
  const { geo, palette } = meshVox(v)
  geo.computeBoundingBox()
  const bb = geo.boundingBox
  const size = Math.max(bb.max.x - bb.min.x, bb.max.y - bb.min.y, bb.max.z - bb.min.z)
  geo.translate(-(bb.min.x + bb.max.x) / 2, -(bb.min.y + bb.max.y) / 2, -(bb.min.z + bb.max.z) / 2)
  geo.scale(SIZE / size, SIZE / size, SIZE / size)
  const [rx, ry, rz] = opts.rot ?? [0, 0, 0]
  geo.applyMatrix4(m4.makeRotationFromEuler(ev.set(rx, ry, rz)))
  geo.computeBoundingBox()
  const c = geo.boundingBox.getCenter(pv)
  geo.translate(-c.x, -c.y, -c.z)
  geo.computeBoundingSphere()
  const r = foodRarity(id)
  return { geo, palette, mat: foodMaterial(opts.finish ?? 'matte', r.emissive ?? 0) }
}
function get(id) {
  if (!cache.has(id)) cache.set(id, build(id))
  return cache.get(id)
}

// Main colours of a food (most visible first): crumbs, chunks, splats, trails.
export const foodColors = (id) => get(id).palette

export function foodMesh(id) {
  const { geo, mat } = get(id)
  const mesh = new Mesh(geo, mat)
  mesh.castShadow = true
  const g = new Group()
  g.add(mesh)
  return g
}
