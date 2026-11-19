// Effects: two GPU point clouds (additive glow and alpha "solid" particles) that
// sample one sprite atlas, a pool of flying 3D coins that home in on a target,
// floating text pops, light beams, ground shockwave rings and voxel food chunks
// (little lit cubes that burst off a landing, bounce, tumble and shrink away). All pools are
// allocated once; nothing is created per frame.
import {
  AdditiveBlending,
  BufferAttribute,
  BoxGeometry,
  BufferGeometry,
  CanvasTexture,
  Color,
  CylinderGeometry,
  DoubleSide,
  DynamicDrawUsage,
  InstancedMesh,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  NormalBlending,
  Object3D,
  Points,
  RingGeometry,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { FX } from '../config.js'

// --- Sprite atlas: 4 x 4 cells of 64 px ------------------------------------------------
export const SPR = { dot: 0, sparkle: 1, heart: 2, star: 3, square: 4, crumb: 5, smoke: 6, leaf: 7, snow: 8, bubble: 9, flame: 10, feather: 11, petal: 12, note: 13, gem: 14, ring: 15 }
function atlas() {
  const S = 64
  const c = document.createElement('canvas')
  c.width = S * 4
  c.height = S * 4
  const ctx = c.getContext('2d')
  const cell = (i, fn) => {
    ctx.save()
    ctx.translate((i % 4) * S + S / 2, Math.floor(i / 4) * S + S / 2)
    fn(ctx, S / 2)
    ctx.restore()
  }
  const radial = (r, stops) => {
    const g = ctx.createRadialGradient(0, 0, 0, 0, 0, r)
    stops.forEach(([o, a]) => g.addColorStop(o, `rgba(255,255,255,${a})`))
    return g
  }
  cell(0, (x, r) => {
    x.fillStyle = radial(r, [[0, 1], [0.35, 0.55], [1, 0]])
    x.fillRect(-r, -r, r * 2, r * 2)
  })
  cell(1, (x, r) => {
    x.fillStyle = radial(r * 0.5, [[0, 1], [1, 0]])
    x.fillRect(-r, -r, r * 2, r * 2)
    x.fillStyle = '#fff'
    for (const [w, h] of [[r * 0.13, r], [r, r * 0.13]]) {
      x.beginPath()
      x.moveTo(-w, 0)
      x.lineTo(0, -h)
      x.lineTo(w, 0)
      x.lineTo(0, h)
      x.closePath()
      x.fill()
    }
  })
  cell(2, (x, r) => {
    x.fillStyle = '#fff'
    x.beginPath()
    const s = r * 0.85
    x.moveTo(0, s * 0.75)
    x.bezierCurveTo(-s * 1.2, -s * 0.1, -s * 0.55, -s * 1.05, 0, -s * 0.4)
    x.bezierCurveTo(s * 0.55, -s * 1.05, s * 1.2, -s * 0.1, 0, s * 0.75)
    x.fill()
    x.fillStyle = 'rgba(255,255,255,0.0)'
  })
  cell(3, (x, r) => {
    x.fillStyle = '#fff'
    x.beginPath()
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2
      const d = i % 2 ? r * 0.42 : r * 0.92
      x.lineTo(Math.cos(a) * d, Math.sin(a) * d)
    }
    x.closePath()
    x.fill()
  })
  cell(4, (x, r) => {
    x.fillStyle = '#fff'
    x.fillRect(-r * 0.7, -r * 0.42, r * 1.4, r * 0.84)
  })
  cell(5, (x, r) => {
    x.fillStyle = '#fff'
    x.beginPath()
    for (let i = 0; i < 7; i++) {
      const a = (i / 7) * Math.PI * 2
      const d = r * (0.55 + ((i * 37) % 10) / 25)
      x.lineTo(Math.cos(a) * d, Math.sin(a) * d)
    }
    x.closePath()
    x.fill()
  })
  cell(6, (x, r) => {
    for (const [ox, oy, rr] of [[-0.3, 0.1, 0.55], [0.25, 0.05, 0.6], [0, -0.25, 0.55], [0.05, 0.25, 0.5]]) {
      const g = ctx.createRadialGradient(ox * r, oy * r, 0, ox * r, oy * r, rr * r)
      g.addColorStop(0, 'rgba(255,255,255,0.55)')
      g.addColorStop(1, 'rgba(255,255,255,0)')
      x.fillStyle = g
      x.fillRect(-r, -r, r * 2, r * 2)
    }
  })
  cell(7, (x, r) => {
    x.fillStyle = '#fff'
    x.beginPath()
    x.ellipse(0, 0, r * 0.35, r * 0.8, 0.5, 0, Math.PI * 2)
    x.fill()
  })
  cell(8, (x, r) => {
    // Snowflake: six spokes with little branches.
    x.strokeStyle = '#fff'
    x.lineCap = 'round'
    x.lineWidth = r * 0.12
    for (let i = 0; i < 6; i++) {
      x.save()
      x.rotate((i / 6) * Math.PI * 2)
      x.beginPath()
      x.moveTo(0, 0)
      x.lineTo(0, -r * 0.85)
      x.moveTo(0, -r * 0.5)
      x.lineTo(-r * 0.22, -r * 0.7)
      x.moveTo(0, -r * 0.5)
      x.lineTo(r * 0.22, -r * 0.7)
      x.stroke()
      x.restore()
    }
  })
  cell(9, (x, r) => {
    // Bubble: thin rim, soft inside, a highlight.
    x.fillStyle = radial(r * 0.8, [[0, 0.08], [0.8, 0.2], [0.95, 0.9], [1, 0]])
    x.beginPath()
    x.arc(0, 0, r * 0.8, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = 'rgba(255,255,255,0.95)'
    x.beginPath()
    x.ellipse(-r * 0.3, -r * 0.32, r * 0.16, r * 0.1, -0.7, 0, Math.PI * 2)
    x.fill()
  })
  cell(10, (x, r) => {
    // Flame tongue: bright core, soft edges.
    const g = ctx.createRadialGradient(0, r * 0.3, 0, 0, r * 0.1, r * 0.9)
    g.addColorStop(0, 'rgba(255,255,255,1)')
    g.addColorStop(0.5, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,0)')
    x.fillStyle = g
    x.beginPath()
    x.moveTo(0, -r * 0.95)
    x.bezierCurveTo(r * 0.7, -r * 0.2, r * 0.6, r * 0.8, 0, r * 0.85)
    x.bezierCurveTo(-r * 0.6, r * 0.8, -r * 0.7, -r * 0.2, 0, -r * 0.95)
    x.fill()
  })
  cell(11, (x, r) => {
    // Feather: a quill and two soft vanes.
    x.fillStyle = 'rgba(255,255,255,0.95)'
    x.beginPath()
    x.ellipse(0, 0, r * 0.3, r * 0.85, 0.35, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = 'rgba(200,200,210,1)'
    x.lineWidth = r * 0.06
    x.beginPath()
    x.moveTo(-r * 0.3, r * 0.85)
    x.lineTo(r * 0.28, -r * 0.8)
    x.stroke()
  })
  cell(12, (x, r) => {
    // Petal: a teardrop with a notch.
    x.fillStyle = '#fff'
    x.beginPath()
    x.moveTo(0, r * 0.8)
    x.bezierCurveTo(-r * 0.8, r * 0.1, -r * 0.4, -r * 0.8, -r * 0.08, -r * 0.6)
    x.lineTo(0, -r * 0.45)
    x.lineTo(r * 0.08, -r * 0.6)
    x.bezierCurveTo(r * 0.4, -r * 0.8, r * 0.8, r * 0.1, 0, r * 0.8)
    x.fill()
  })
  cell(13, (x, r) => {
    // Music note.
    x.fillStyle = '#fff'
    x.beginPath()
    x.ellipse(-r * 0.25, r * 0.45, r * 0.28, r * 0.2, -0.4, 0, Math.PI * 2)
    x.fill()
    x.fillRect(-r * 0.02, -r * 0.75, r * 0.12, r * 1.2)
    x.beginPath()
    x.moveTo(r * 0.1, -r * 0.75)
    x.quadraticCurveTo(r * 0.7, -r * 0.5, r * 0.45, -r * 0.05)
    x.lineTo(r * 0.1, -r * 0.35)
    x.fill()
  })
  cell(14, (x, r) => {
    // Gem: a cut diamond with facets.
    x.fillStyle = '#fff'
    x.beginPath()
    x.moveTo(-r * 0.7, -r * 0.2)
    x.lineTo(-r * 0.35, -r * 0.6)
    x.lineTo(r * 0.35, -r * 0.6)
    x.lineTo(r * 0.7, -r * 0.2)
    x.lineTo(0, r * 0.8)
    x.closePath()
    x.fill()
    x.strokeStyle = 'rgba(160,170,190,0.9)'
    x.lineWidth = r * 0.05
    x.beginPath()
    x.moveTo(-r * 0.7, -r * 0.2)
    x.lineTo(r * 0.7, -r * 0.2)
    x.moveTo(-r * 0.2, -r * 0.2)
    x.lineTo(0, r * 0.8)
    x.lineTo(r * 0.2, -r * 0.2)
    x.stroke()
  })
  cell(15, (x, r) => {
    // Soft ring (fireflies, aura sparks).
    x.fillStyle = radial(r, [[0, 1], [0.15, 0.9], [0.3, 0.25], [1, 0]])
    x.fillRect(-r, -r, r * 2, r * 2)
  })
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  return t
}

// How each area particle kind drifts: sprite, glow (additive) or solid, size, life, velocity
// ranges. fx.themed() uses it for the lane air, the girls' cover and the girls in your pen.
const THEMES = {
  petals: { sprite: SPR.petal, size: [0.22, 0.34], life: [3, 5], vy: [-0.5, -0.2], drift: 0.7, spin: 2 },
  wheat: { sprite: SPR.leaf, size: [0.16, 0.26], life: [3, 5], vy: [-0.4, -0.1], drift: 0.9, spin: 3 },
  fireflies: { sprite: SPR.ring, glow: true, size: [0.18, 0.3], life: [2, 3.5], vy: [0.05, 0.3], drift: 0.4, spin: 0, blink: true },
  sand: { sprite: SPR.crumb, size: [0.06, 0.12], life: [1.5, 2.5], vy: [-0.1, 0.2], drift: 2.2, spin: 4, alpha: 0.7 },
  snow: { sprite: SPR.snow, size: [0.16, 0.3], life: [4, 6], vy: [-0.8, -0.4], drift: 0.4, spin: 1 },
  leaves: { sprite: SPR.leaf, size: [0.28, 0.42], life: [3.5, 5.5], vy: [-0.7, -0.35], drift: 0.9, spin: 3 },
  gems: { sprite: SPR.gem, glow: true, size: [0.14, 0.24], life: [1.6, 2.6], vy: [0.2, 0.6], drift: 0.3, spin: 1.5 },
  sunset: { sprite: SPR.sparkle, glow: true, size: [0.2, 0.32], life: [1.6, 2.6], vy: [0.2, 0.5], drift: 0.4, spin: 2 },
  bubbles: { sprite: SPR.bubble, size: [0.14, 0.3], life: [2.5, 4], vy: [0.5, 1.1], drift: 0.25, spin: 0 },
  feathers: { sprite: SPR.feather, size: [0.26, 0.4], life: [4, 6], vy: [-0.45, -0.2], drift: 0.8, spin: 1.5 },
  embers: { sprite: SPR.flame, glow: true, size: [0.12, 0.24], life: [1.2, 2.2], vy: [0.8, 1.8], drift: 0.6, spin: 2 },
  stars: { sprite: SPR.star, glow: true, size: [0.14, 0.26], life: [1.5, 2.5], vy: [-0.1, 0.25], drift: 0.3, spin: 1.5 },
  hearts: { sprite: SPR.heart, size: [0.3, 0.45], life: [1.2, 1.8], vy: [0.9, 1.6], drift: 0.4, spin: 0 },
  notes: { sprite: SPR.note, size: [0.3, 0.42], life: [1.2, 1.8], vy: [0.8, 1.4], drift: 0.5, spin: 0 },
}

const vert = /* glsl */ `
  attribute float aSize;
  attribute float aAlpha;
  attribute float aSprite;
  attribute float aRot;
  attribute vec3 aColor;
  uniform float uScale;
  varying float vAlpha;
  varying float vSprite;
  varying float vRot;
  varying vec3 vColor;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = aSize * uScale / max(0.1, -mv.z);
    vAlpha = aAlpha;
    vSprite = aSprite;
    vRot = aRot;
    vColor = aColor;
  }`
const frag = /* glsl */ `
  uniform sampler2D uMap;
  uniform float uBoost;
  varying float vAlpha;
  varying float vSprite;
  varying float vRot;
  varying vec3 vColor;
  void main() {
    if (vAlpha < 0.004) discard;
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    if (p.x < 0.0 || p.x > 1.0 || p.y < 0.0 || p.y > 1.0) discard;
    float col = mod(vSprite, 4.0);
    float row = floor(vSprite / 4.0);
    vec2 uv = vec2((col + p.x) / 4.0, 1.0 - (row + p.y) / 4.0);
    vec4 t = texture2D(uMap, uv);
    float a = t.a * vAlpha;
    if (a < 0.01) discard;
    gl_FragColor = vec4(vColor * t.rgb * uBoost, a);
  }`

class Cloud {
  constructor(max, map, additive) {
    this.max = max
    this.cursor = 0
    const g = new BufferGeometry()
    const attr = (name, n) => {
      const a = new BufferAttribute(new Float32Array(max * n), n)
      a.setUsage(DynamicDrawUsage)
      g.setAttribute(name, a)
      return a
    }
    this.pos = attr('position', 3)
    this.col = attr('aColor', 3)
    this.size = attr('aSize', 1)
    this.alpha = attr('aAlpha', 1)
    this.sprite = attr('aSprite', 1)
    this.rot = attr('aRot', 1)
    // CPU-only state.
    this.vel = new Float32Array(max * 3)
    this.life = new Float32Array(max)
    this.maxLife = new Float32Array(max)
    this.s0 = new Float32Array(max)
    this.s1 = new Float32Array(max)
    this.a0 = new Float32Array(max)
    this.grav = new Float32Array(max)
    this.drag = new Float32Array(max)
    this.spin = new Float32Array(max)
    this.fadeIn = new Float32Array(max)
    this.live = 0
    this.material = new ShaderMaterial({
      uniforms: { uMap: { value: map }, uScale: { value: 600 }, uBoost: { value: additive ? 1.6 : 1 } },
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      blending: additive ? AdditiveBlending : NormalBlending,
    })
    this.points = new Points(g, this.material)
    this.points.frustumCulled = false
    this.points.renderOrder = additive ? 4 : 3
  }

  spawn(o) {
    const i = this.cursor
    this.cursor = (this.cursor + 1) % this.max
    const i3 = i * 3
    this.pos.array[i3] = o.x
    this.pos.array[i3 + 1] = o.y
    this.pos.array[i3 + 2] = o.z
    this.vel[i3] = o.vx ?? 0
    this.vel[i3 + 1] = o.vy ?? 0
    this.vel[i3 + 2] = o.vz ?? 0
    const c = o.color
    this.col.array[i3] = c.r
    this.col.array[i3 + 1] = c.g
    this.col.array[i3 + 2] = c.b
    this.life[i] = 0
    this.maxLife[i] = o.life ?? 1
    this.s0[i] = o.size ?? 0.3
    this.s1[i] = o.size1 ?? this.s0[i]
    this.a0[i] = o.alpha ?? 1
    this.grav[i] = o.gravity ?? 0
    this.drag[i] = o.drag ?? 0
    this.spin[i] = o.spin ?? 0
    this.rot.array[i] = o.rot ?? Math.random() * 6.28
    this.sprite.array[i] = o.sprite ?? 0
    this.fadeIn[i] = o.fadeIn ?? 0.05
    this.live = Math.max(this.live, 1)
  }

  update(dt) {
    const n = this.max
    const P = this.pos.array
    const S = this.size.array
    const A = this.alpha.array
    const R = this.rot.array
    let any = false
    for (let i = 0; i < n; i++) {
      const ml = this.maxLife[i]
      if (ml <= 0) continue
      const l = (this.life[i] += dt)
      if (l >= ml) {
        this.maxLife[i] = 0
        A[i] = 0
        S[i] = 0
        continue
      }
      any = true
      const i3 = i * 3
      const d = 1 - Math.min(1, this.drag[i] * dt)
      this.vel[i3] *= d
      this.vel[i3 + 1] = this.vel[i3 + 1] * d + this.grav[i] * dt
      this.vel[i3 + 2] *= d
      P[i3] += this.vel[i3] * dt
      P[i3 + 1] += this.vel[i3 + 1] * dt
      P[i3 + 2] += this.vel[i3 + 2] * dt
      const t = l / ml
      S[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t
      const fi = this.fadeIn[i] > 0 ? Math.min(1, l / this.fadeIn[i]) : 1
      A[i] = this.a0[i] * fi * (t < 0.6 ? 1 : 1 - (t - 0.6) / 0.4)
      R[i] += this.spin[i] * dt
    }
    if (any || this.live) {
      this.pos.needsUpdate = this.size.needsUpdate = this.alpha.needsUpdate = this.rot.needsUpdate = true
      this.col.needsUpdate = this.sprite.needsUpdate = true
    }
    this.live = any ? 1 : 0
  }
}

const tmpC = new Color()
const rnd = (a, b) => a + Math.random() * (b - a)

export function createFx(scene, { particles = 1 } = {}) {
  const map = atlas()
  const glow = new Cloud(FX.maxGlow, map, true)
  const solid = new Cloud(FX.maxSolid, map, false)
  scene.add(glow.points, solid.points)
  let density = particles // graphics preset scales particle counts
  const n = (k) => Math.max(1, Math.round(k * density))

  // --- Coins ---
  const coinGeo = new CylinderGeometry(0.2, 0.2, 0.05, 16)
  coinGeo.rotateX(Math.PI / 2)
  const coinMat = new MeshStandardMaterial({ color: '#ffcc33', metalness: 0.9, roughness: 0.25, emissive: '#7a4a00', emissiveIntensity: 0.55 })
  const coinMesh = new InstancedMesh(coinGeo, coinMat, FX.maxCoins)
  coinMesh.instanceMatrix.setUsage(DynamicDrawUsage)
  coinMesh.frustumCulled = false
  coinMesh.castShadow = false
  scene.add(coinMesh)
  const coins = Array.from({ length: FX.maxCoins }, () => ({ on: false, p: new Vector3(), v: new Vector3(), t: 0, spin: 0, target: null, done: null }))
  const dummy = new Object3D()
  const hide = new Object3D()
  hide.scale.setScalar(0)
  hide.updateMatrix()
  for (let i = 0; i < FX.maxCoins; i++) coinMesh.setMatrixAt(i, hide.matrix)

  // --- Voxel chunks (food debris) ---
  const MAXCH = FX.maxChunks ?? 200
  const chunkMesh = new InstancedMesh(new BoxGeometry(1, 1, 1), new MeshStandardMaterial({ roughness: 0.55 }), MAXCH)
  chunkMesh.instanceMatrix.setUsage(DynamicDrawUsage)
  chunkMesh.frustumCulled = false
  chunkMesh.castShadow = true
  for (let i = 0; i < MAXCH; i++) {
    chunkMesh.setMatrixAt(i, hide.matrix)
    chunkMesh.setColorAt(i, tmpC.set('#ffffff'))
  }
  scene.add(chunkMesh)
  const chunks = Array.from({ length: MAXCH }, () => ({ on: false, p: new Vector3(), v: new Vector3(), r: new Vector3(), w: new Vector3(), s: 0.1, life: 0, max: 1, floor: 0 }))
  let chunkCursor = 0
  let chunksLive = 0

  // --- Floating text ---
  const texts = Array.from({ length: FX.maxTexts }, () => {
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 128
    const t = new CanvasTexture(c)
    t.colorSpace = SRGBColorSpace
    const s = new Sprite(new SpriteMaterial({ map: t, transparent: true, depthWrite: false, depthTest: false, fog: false }))
    s.visible = false
    s.renderOrder = 10
    scene.add(s)
    return { s, c, t, life: 0, max: 1, vy: 0, h: 1 }
  })
  let textCursor = 0

  // --- Beams and rings ---
  const beamGeo = new CylinderGeometry(1, 1, 1, 24, 1, true)
  beamGeo.translate(0, 0.5, 0)
  const beamTex = (() => {
    const c = document.createElement('canvas')
    c.width = 4
    c.height = 128
    const x = c.getContext('2d')
    const g = x.createLinearGradient(0, 0, 0, 128)
    g.addColorStop(0, 'rgba(255,255,255,0)')
    g.addColorStop(0.7, 'rgba(255,255,255,0.6)')
    g.addColorStop(1, 'rgba(255,255,255,1)')
    x.fillStyle = g
    x.fillRect(0, 0, 4, 128)
    return new CanvasTexture(c)
  })()
  const beams = Array.from({ length: 6 }, () => {
    const m = new Mesh(beamGeo, new MeshBasicMaterial({ map: beamTex, color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide, fog: false }))
    m.visible = false
    m.renderOrder = 4
    scene.add(m)
    return { m, life: 0, max: 1, r: 1 }
  })
  const ringGeo = new RingGeometry(0.85, 1, 48)
  ringGeo.rotateX(-Math.PI / 2)
  const rings = Array.from({ length: 10 }, () => {
    const m = new Mesh(ringGeo, new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
    m.visible = false
    m.renderOrder = 4
    scene.add(m)
    return { m, life: 0, max: 1, r0: 0.5, r1: 4 }
  })

  function paintText(slot, text, color, outline) {
    const ctx = slot.c.getContext('2d')
    ctx.clearRect(0, 0, 512, 128)
    ctx.font = '700 84px Fredoka, "Arial Black", sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.lineWidth = 16
    ctx.strokeStyle = outline
    ctx.strokeText(text, 256, 68)
    ctx.fillStyle = color
    ctx.fillText(text, 256, 64)
    slot.t.needsUpdate = true
  }

  const fx = {
    setDensity(k) {
      density = k
    },
    setScale(px) {
      glow.material.uniforms.uScale.value = px
      solid.material.uniforms.uScale.value = px
    },
    // Raw particle (kind 'glow' or 'solid').
    particle(kind, o) {
      ;(kind === 'glow' ? glow : solid).spawn(o)
    },

    // Radial burst of sparkles + dots in `color`.
    sparkle(p, color = '#ffffff', count = 16, { speed = 4, size = 0.4, life = 0.8, up = 2, gravity = -3 } = {}) {
      tmpC.set(color)
      for (let i = 0, k = n(count); i < k; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(0.3, 1) * speed
        glow.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(0, 1) * speed * 0.6 + up, vz: Math.sin(a) * s, color: tmpC, size: size * rnd(0.6, 1.3), size1: 0, life: life * rnd(0.6, 1.2), gravity, drag: 2, sprite: Math.random() < 0.5 ? SPR.sparkle : SPR.dot, spin: rnd(-3, 3) })
      }
    },

    // Paper confetti: rainbow rectangles that tumble and drift down.
    confetti(p, count = 60, power = 7) {
      const colors = ['#ff4f86', '#ffd93b', '#4fc8ff', '#7be04a', '#b07cff', '#ffffff', '#ff8a2a']
      for (let i = 0, k = n(count); i < k; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(0.3, 1) * power
        tmpC.set(colors[i % colors.length])
        solid.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s * 0.6, vy: rnd(0.6, 1.2) * power, vz: Math.sin(a) * s * 0.6, color: tmpC, size: rnd(0.18, 0.32), life: rnd(1.6, 2.6), gravity: -9, drag: 2.2, sprite: SPR.square, spin: rnd(-10, 10) })
      }
    },

    // Food crumbs flying off a bite (colours from the food).
    crumbs(p, colors, count = 14) {
      for (let i = 0, k = n(count); i < k; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(1, 3.5)
        tmpC.set(colors[i % colors.length])
        solid.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(2, 5), vz: Math.sin(a) * s, color: tmpC, size: rnd(0.08, 0.18), life: rnd(0.5, 0.9), gravity: -16, drag: 0.5, sprite: SPR.crumb, spin: rnd(-8, 8), fadeIn: 0 })
      }
    },

    hearts(p, count = 6) {
      tmpC.set('#ff5f8a')
      for (let i = 0, k = n(count); i < k; i++) {
        solid.spawn({ x: p.x + rnd(-0.6, 0.6), y: p.y + rnd(0, 0.5), z: p.z + rnd(-0.6, 0.6), vx: rnd(-0.6, 0.6), vy: rnd(1.4, 2.6), vz: rnd(-0.6, 0.6), color: tmpC, size: rnd(0.35, 0.6), size1: 0.2, life: rnd(1, 1.6), gravity: 0.4, drag: 1, sprite: SPR.heart, rot: rnd(-0.3, 0.3), fadeIn: 0.15 })
      }
    },

    // Soft smoke / dust puffs.
    puff(p, color = '#ffffff', count = 8, { size = 0.8, spread = 1.2, up = 1, life = 1.1, alpha = 0.7 } = {}) {
      tmpC.set(color)
      for (let i = 0, k = n(count); i < k; i++) {
        const a = Math.random() * Math.PI * 2
        const s = rnd(0.3, 1) * spread
        solid.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * s, vy: rnd(0.3, 1) * up, vz: Math.sin(a) * s, color: tmpC, size: size * rnd(0.6, 1), size1: size * 2.2, life: life * rnd(0.7, 1.2), alpha, drag: 2.5, sprite: SPR.smoke, spin: rnd(-1, 1), fadeIn: 0.08 })
      }
    },

    // Stars thrown out (fuse result, rare catch).
    stars(p, color = '#ffd93b', count = 12, speed = 6) {
      tmpC.set(color)
      for (let i = 0, k = n(count); i < k; i++) {
        const a = Math.random() * Math.PI * 2
        glow.spawn({ x: p.x, y: p.y, z: p.z, vx: Math.cos(a) * speed * rnd(0.5, 1), vy: rnd(2, 6), vz: Math.sin(a) * speed * rnd(0.5, 1), color: tmpC, size: rnd(0.4, 0.7), size1: 0.1, life: rnd(0.8, 1.3), gravity: -8, drag: 1.5, sprite: SPR.star, spin: rnd(-6, 6) })
      }
    },

    // Rising motes in a disc (collect pad, chest, aura).
    motes(p, color, count, radius = 1.5, { rise = 1.2, size = 0.22, life = 1.4 } = {}) {
      tmpC.set(color)
      for (let i = 0; i < count; i++) {
        if (Math.random() > density) continue
        const a = Math.random() * Math.PI * 2
        const r = Math.sqrt(Math.random()) * radius
        glow.spawn({ x: p.x + Math.cos(a) * r, y: p.y, z: p.z + Math.sin(a) * r, vy: rise * rnd(0.6, 1.3), color: tmpC, size: size * rnd(0.6, 1.3), size1: 0, life: life * rnd(0.7, 1.2), sprite: Math.random() < 0.3 ? SPR.sparkle : SPR.dot, fadeIn: 0.3 })
      }
    },

    // One (or a burst of) area particle(s) of kind (THEMES keys) at p, coloured from colors.
    themed(kind, p, colors, { burst = false, count = 1 } = {}) {
      const T = THEMES[kind] ?? THEMES.petals
      const cloud = T.glow ? glow : solid
      for (let i = 0; i < count; i++) {
        if (count > 1 && Math.random() > density) continue
        tmpC.set(colors[Math.floor(Math.random() * colors.length)])
        const s = burst ? 2.2 : 1
        const size = rnd(T.size[0], T.size[1])
        cloud.spawn({ x: p.x, y: p.y, z: p.z, vx: rnd(-T.drift, T.drift) * s, vy: rnd(T.vy[0], T.vy[1]) + (burst ? rnd(0.5, 2) : 0), vz: rnd(-T.drift, T.drift) * s, color: tmpC, size, size1: T.blink ? 0 : size, life: rnd(T.life[0], T.life[1]) * (burst ? 0.6 : 1), alpha: T.alpha ?? 1, gravity: burst ? -1.5 : 0, drag: burst ? 1.2 : 0, sprite: T.sprite, spin: rnd(-T.spin, T.spin), fadeIn: 0.25 })
      }
    },

    // A blown kiss: a big heart that flies from p toward `to`, trailing little hearts.
    kiss(p, to) {
      tmpC.set('#ff3b78')
      const dx = to.x - p.x
      const dy = to.y - p.y
      const dz = to.z - p.z
      const d = Math.max(0.5, Math.hypot(dx, dy, dz))
      const sp = Math.min(6, d / 0.9)
      solid.spawn({ x: p.x, y: p.y, z: p.z, vx: (dx / d) * sp, vy: (dy / d) * sp + 0.6, vz: (dz / d) * sp, color: tmpC, size: 0.45, size1: 0.8, life: Math.min(1.4, d / sp + 0.2), drag: 0.2, sprite: SPR.heart, rot: 0, fadeIn: 0.05 })
      tmpC.set('#ffb3d0')
      for (let i = 0, k = n(8); i < k; i++) {
        const f = rnd(0.2, 0.9)
        glow.spawn({ x: p.x, y: p.y, z: p.z, vx: (dx / d) * sp * f + rnd(-0.4, 0.4), vy: (dy / d) * sp * f + rnd(0, 0.8), vz: (dz / d) * sp * f + rnd(-0.4, 0.4), color: tmpC, size: rnd(0.12, 0.22), size1: 0, life: rnd(0.6, 1.1), drag: 1, sprite: Math.random() < 0.5 ? SPR.heart : SPR.sparkle, rot: 0, fadeIn: 0.05 })
      }
    },

    // A falling leaf that flutters down from a tree canopy.
    leaf(p) {
      tmpC.set(Math.random() < 0.7 ? '#5fd23a' : '#9be05a')
      solid.spawn({ x: p.x, y: p.y, z: p.z, vx: rnd(-0.8, 0.8), vy: -0.6, vz: rnd(-0.8, 0.8), color: tmpC, size: rnd(0.3, 0.45), life: rnd(4, 7), gravity: 0, drag: 0, sprite: SPR.leaf, spin: rnd(-2, 2), fadeIn: 0.5 })
    },

    // Voxel chunks of a food bursting out of p (colours = the food's palette). floor = the
    // ground height they bounce on; power scales speed.
    chunks(p, colors, count = 24, { power = 1, floor = p.y - 0.3, size = 0.11, up = 1 } = {}) {
      for (let i = 0, k = n(count); i < k; i++) {
        const idx = chunkCursor
        const c = chunks[idx]
        chunkCursor = (chunkCursor + 1) % MAXCH
        if (!c.on) chunksLive++
        c.on = true
        c.p.copy(p)
        const a = Math.random() * Math.PI * 2
        const sp = rnd(1.5, 5.5) * power
        c.v.set(Math.cos(a) * sp, rnd(3, 8) * power * up, Math.sin(a) * sp)
        c.r.set(rnd(0, 6), rnd(0, 6), rnd(0, 6))
        c.w.set(rnd(-14, 14), rnd(-14, 14), rnd(-14, 14))
        c.s = size * rnd(0.55, 1.45)
        c.life = 0
        c.max = rnd(1.1, 1.9)
        c.floor = floor
        chunkMesh.setColorAt(idx, tmpC.set(colors[i % colors.length]))
      }
      chunkMesh.instanceColor.needsUpdate = true
    },

    // Trail dot behind a thrown food.
    trail(p, color) {
      tmpC.set(color)
      glow.spawn({ x: p.x, y: p.y, z: p.z, color: tmpC, size: 0.35, size1: 0, life: 0.35, sprite: SPR.dot, fadeIn: 0 })
    },

    // Coins popping out of p and flying to target() (a function returning a Vector3).
    coins(p, count, target, onArrive) {
      let made = 0
      for (const c of coins) {
        if (made >= count) break
        if (c.on) continue
        c.on = true
        c.p.copy(p)
        const a = Math.random() * Math.PI * 2
        c.v.set(Math.cos(a) * rnd(1.5, 4), rnd(5, 9), Math.sin(a) * rnd(1.5, 4))
        c.t = -made * 0.03
        c.spin = rnd(8, 16)
        c.target = target
        c.done = onArrive
        made++
      }
    },

    // Floating text that pops, rises and fades.
    text(str, p, color = '#7dff4a', { height = 0.9, life = 1.2, rise = 1.4, outline = '#10131f' } = {}) {
      const slot = texts[textCursor]
      textCursor = (textCursor + 1) % texts.length
      paintText(slot, str, color, outline)
      slot.s.position.copy(p)
      slot.s.visible = true
      slot.life = 0
      slot.max = life
      slot.vy = rise
      slot.h = height
      slot.s.material.opacity = 1
    },

    beam(p, color = '#ffffff', { radius = 1.4, height = 14, life = 1.2 } = {}) {
      const b = beams.find((x) => !x.m.visible) ?? beams[0]
      b.m.visible = true
      b.m.position.copy(p)
      b.m.material.color.set(color)
      b.life = 0
      b.max = life
      b.r = radius
      b.m.scale.set(radius, height, radius)
    },

    ring(p, color = '#ffffff', { r0 = 0.4, r1 = 4, life = 0.6 } = {}) {
      const r = rings.find((x) => !x.m.visible) ?? rings[0]
      r.m.visible = true
      r.m.position.set(p.x, p.y + 0.05, p.z)
      r.m.material.color.set(color)
      r.life = 0
      r.max = life
      r.r0 = r0
      r.r1 = r1
    },

    update(dt) {
      glow.update(dt)
      solid.update(dt)
      // Coins: pop up under gravity, then home in.
      for (let i = 0; i < coins.length; i++) {
        const c = coins[i]
        if (!c.on) continue
        c.t += dt
        if (c.t < 0) {
          coinMesh.setMatrixAt(i, hide.matrix)
          continue
        }
        if (c.t < 0.35) {
          c.v.y -= 22 * dt
        } else {
          const tg = c.target()
          const dx = tg.x - c.p.x
          const dy = tg.y - c.p.y
          const dz = tg.z - c.p.z
          const d = Math.hypot(dx, dy, dz)
          if (d < 0.6 || c.t > 2.5) {
            c.on = false
            coinMesh.setMatrixAt(i, hide.matrix)
            c.done?.()
            continue
          }
          const pull = 18 + c.t * 40
          c.v.x += (dx / d) * pull * dt
          c.v.y += (dy / d) * pull * dt
          c.v.z += (dz / d) * pull * dt
          const damp = 1 - Math.min(1, dt * 4)
          c.v.multiplyScalar(damp)
        }
        c.p.addScaledVector(c.v, dt)
        dummy.position.copy(c.p)
        dummy.rotation.set(0, c.t * c.spin, 0.3)
        dummy.scale.setScalar(1.3)
        dummy.updateMatrix()
        coinMesh.setMatrixAt(i, dummy.matrix)
      }
      coinMesh.instanceMatrix.needsUpdate = true
      // Voxel chunks: gravity, a couple of damped bounces, tumble, shrink out at the end.
      if (chunksLive > 0) {
        chunksLive = 0
        for (let i = 0; i < MAXCH; i++) {
          const c = chunks[i]
          if (!c.on) continue
          c.life += dt
          if (c.life >= c.max) {
            c.on = false
            chunkMesh.setMatrixAt(i, hide.matrix)
            continue
          }
          chunksLive++
          c.v.y -= 22 * dt
          c.p.addScaledVector(c.v, dt)
          if (c.p.y < c.floor + c.s * 0.5) {
            c.p.y = c.floor + c.s * 0.5
            if (c.v.y < -1.5) {
              c.v.y *= -0.38
              c.w.multiplyScalar(0.6)
            } else c.v.y = 0
            c.v.x *= 0.7
            c.v.z *= 0.7
          }
          c.r.addScaledVector(c.w, dt)
          const t = c.life / c.max
          dummy.position.copy(c.p)
          dummy.rotation.set(c.r.x, c.r.y, c.r.z)
          dummy.scale.setScalar(c.s * (t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3))
          dummy.updateMatrix()
          chunkMesh.setMatrixAt(i, dummy.matrix)
        }
        chunkMesh.instanceMatrix.needsUpdate = true
      }
      for (const s of texts) {
        if (!s.s.visible) continue
        s.life += dt
        const t = s.life / s.max
        if (t >= 1) {
          s.s.visible = false
          continue
        }
        s.s.position.y += s.vy * dt * (1 - t)
        const pop = t < 0.12 ? 0.6 + (t / 0.12) * 0.55 : t < 0.22 ? 1.15 - ((t - 0.12) / 0.1) * 0.15 : 1
        s.s.scale.set(s.h * 4 * pop, s.h * pop, 1)
        s.s.material.opacity = t < 0.7 ? 1 : 1 - (t - 0.7) / 0.3
      }
      for (const b of beams) {
        if (!b.m.visible) continue
        b.life += dt
        const t = b.life / b.max
        if (t >= 1) {
          b.m.visible = false
          continue
        }
        b.m.material.opacity = (t < 0.15 ? t / 0.15 : 1 - (t - 0.15) / 0.85) * 0.8
        const w = b.r * (1 - t * 0.6)
        b.m.scale.x = b.m.scale.z = w
        b.m.rotation.y += dt
      }
      for (const r of rings) {
        if (!r.m.visible) continue
        r.life += dt
        const t = r.life / r.max
        if (t >= 1) {
          r.m.visible = false
          continue
        }
        const k = r.r0 + (r.r1 - r.r0) * (1 - (1 - t) * (1 - t))
        r.m.scale.set(k, 1, k)
        r.m.material.opacity = (1 - t) * 0.9
      }
    },
  }
  return fx
}
