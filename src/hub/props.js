// Hand-built hub props: the Food Shop and Sell stalls, the Fuse Machine, the free
// reward chest, the three leaderboards on the north wall, the friend-boost wall
// sign and the lane entrance (throw line, barrier, arch, zone banners, distance
// markers). Static parts are vertex-coloured boxes merged per prop.
import {
  AdditiveBlending,
  CanvasTexture,
  CylinderGeometry,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RingGeometry,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
} from 'three'
import { HUB, POI, RARITIES, THROW_MODE } from '../config.js'
import { label, neon, solidBox } from '../propkit.js'
import { cbox, ccyl, cgeo, flat, merge } from './geo.js'
import { paintBoard } from './paint.js'
import { studMaterial } from './world.js'
import { foodMesh } from '../game/foods.js'

const vc = new MeshStandardMaterial({ vertexColors: true, roughness: 0.62 })
const vcShiny = new MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.7 })

function mesh(geo, mat = vc, shadows = true) {
  const m = new Mesh(geo, mat)
  m.castShadow = shadows
  m.receiveShadow = true
  return m
}

// A flat glowing ring on the ground (zone markers).
export function groundRing(r, color, width = 0.22) {
  const g = new RingGeometry(r - width, r, 56)
  g.rotateX(-Math.PI / 2)
  const m = new Mesh(g, new MeshBasicMaterial({ color, transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
  m.position.y = 0.04
  m.renderOrder = 2
  return m
}
// A ring of short white dashes (pen gate spot, chest).
export function dashedRing(r, color = '#ffffff', n = 18) {
  const parts = []
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    parts.push(cbox(0.55, 0.04, 0.22, color, Math.cos(a) * r, 0.03, Math.sin(a) * r, 0, -a + Math.PI / 2, 0))
  }
  return mesh(merge(parts), new MeshStandardMaterial({ vertexColors: true, roughness: 0.5, emissive: color, emissiveIntensity: 0.15 }), false)
}

// --- Stalls --------------------------------------------------------------------------------
// A market stall facing +Z (local): posts, counter, striped awning, crates of food.
function stall(stripeA, stripeB, title, titleColor, foods) {
  const g = new Group()
  const p = []
  const wood = '#b8743c'
  const dark = '#7a4a22'
  for (const [x, z] of [[-1.7, -1.1], [1.7, -1.1], [-1.7, 1.0], [1.7, 1.0]]) p.push(cbox(0.24, 2.7, 0.24, dark, x, 1.35, z))
  p.push(cbox(3.6, 1.0, 1.0, wood, 0, 0.5, 0.75)) // counter
  p.push(cbox(3.8, 0.12, 1.2, '#8a5428', 0, 1.06, 0.75)) // counter top
  for (let x = -1.5; x <= 1.5; x += 0.75) p.push(cbox(0.06, 0.9, 0.02, dark, x, 0.5, 1.26)) // plank lines
  p.push(cbox(3.4, 0.1, 0.9, wood, 0, 1.55, -0.9)) // back shelf
  // Awning: alternating stripes, sloping down to the front, with a scalloped valance.
  const n = 8
  for (let i = 0; i < n; i++) {
    const x = -2.1 + (i + 0.5) * (4.2 / n)
    p.push(cbox(4.2 / n + 0.01, 0.14, 3.0, i % 2 ? stripeB : stripeA, x, 3.0, 0, 0.28, 0, 0))
    p.push(cbox(4.2 / n + 0.01, 0.42, 0.1, i % 2 ? stripeB : stripeA, x, 2.4, 1.55))
    p.push(cbox(4.2 / n - 0.12, 0.16, 0.1, i % 2 ? stripeB : stripeA, x, 2.12, 1.55))
  }
  g.add(mesh(merge(p)))
  // Crates of food on the shelf and counter.
  const crate = new MeshStandardMaterial({ color: '#c98a4b', roughness: 0.8 })
  ;[-1.1, 0, 1.1].forEach((x, i) => {
    const c = new Mesh(new CylinderGeometry(0.4, 0.34, 0.32, 4), crate)
    c.rotation.y = Math.PI / 4
    c.position.set(x, 1.76, -0.9)
    c.castShadow = true
    g.add(c)
    const f = foodMesh(foods[i % foods.length])
    f.scale.setScalar(0.7)
    f.position.set(x, 2.08, -0.9)
    f.rotation.y = i
    g.add(f)
  })
  const f2 = foodMesh(foods[0])
  f2.scale.setScalar(0.65)
  f2.position.set(-0.9, 1.35, 0.75)
  g.add(f2)
  const f3 = foodMesh(foods[1 % foods.length])
  f3.scale.setScalar(0.65)
  f3.position.set(0.8, 1.35, 0.7)
  g.add(f3)
  const t = label(title, 1.25, { color: titleColor, outline: '#ffffff', outlineWidth: 18, font: '700 110px Fredoka, "Arial Black", sans-serif' })
  t.position.set(0, 4.5, 0.4)
  g.add(t)
  g.userData.title = t
  return g
}

export function buildFoodShop(root) {
  const { x, z } = POI.foodShop
  const g = stall('#e8262e', '#ffffff', 'Food Shop', '#e8262e', ['apple', 'cookie', 'donut'])
  g.position.set(x, 0, z + 1.8) // behind its ring, awning facing north into the meadow
  g.rotation.y = Math.PI + 0.35
  root.add(g)
  const ring = groundRing(POI.foodShop.r, '#ff3030', 0.28)
  ring.position.set(x, 0.04, z)
  root.add(ring)
  solidBox(1.9, 1.3, 1.25, x, 1.3, z + 1.8, 0.35) // the whole stall footprint
  return { group: g, ring }
}

export function buildSell(root) {
  const { x, z } = POI.sell
  const g = stall('#3fdc4a', '#ffffff', 'Sell', '#3fdc4a', ['burger', 'pizza', 'sushi'])
  g.position.set(x, 0, z - 1.7)
  root.add(g)
  const ring = groundRing(POI.sell.r, '#6aff5a', 0.28)
  ring.position.set(x, 0.04, z + 0.6)
  root.add(ring)
  solidBox(1.9, 1.3, 1.25, x, 1.3, z - 1.7)
  return { group: g, ring }
}

// --- Fuse machine -------------------------------------------------------------------------
export function buildFuse(root) {
  const { x, z } = POI.fuse
  const g = new Group()
  g.position.set(x, 0, z - 2.2)
  root.add(g)
  const blue = studMaterial('#2f6fe0', '#2a63cf', { tile: 1, seed: 41, seam: 0.12 })
  const grey = studMaterial('#5d6675', '#545c6a', { tile: 1, seed: 42, seam: 0.12 })
  const plat = new Mesh(new CylinderGeometry(3.3, 3.5, 0.3, 4), grey)
  plat.rotation.y = Math.PI / 4
  plat.scale.set(1.25, 1, 0.8)
  plat.position.y = 0.15
  plat.receiveShadow = true
  g.add(plat)
  const body = new Mesh(new CylinderGeometry(1, 1, 1, 4), blue)
  body.rotation.y = Math.PI / 4
  body.scale.set(2.3, 2.6, 1.7)
  body.position.set(0.5, 1.6, 0)
  body.castShadow = body.receiveShadow = true
  g.add(body)
  const p = []
  p.push(cbox(3.5, 0.4, 2.6, '#23304f', 0.5, 2.98, 0)) // cap
  p.push(cbox(2.6, 0.5, 1.8, '#2b3a5f', 0.4, 3.4, -0.1)) // top unit
  p.push(cbox(0.9, 0.25, 0.4, '#1a2340', 0.9, 3.75, -0.1)) // vent box
  for (let i = 0; i < 4; i++) p.push(cbox(0.12, 0.2, 0.05, '#3fe0ff', 0.6 + i * 0.2, 3.75, 0.11))
  p.push(cbox(2.0, 2.0, 0.12, '#1b2440', 0.8, 1.65, 1.24)) // screen frame
  p.push(cbox(2.2, 0.16, 0.2, '#c9d6e8', 0.8, 2.72, 1.24))
  p.push(cbox(2.2, 0.16, 0.2, '#c9d6e8', 0.8, 0.58, 1.24))
  for (let i = 0; i < 5; i++) p.push(cbox(0.6, 0.07, 0.06, '#1a2340', -0.65, 0.9 + i * 0.2, 1.24)) // grille
  p.push(ccyl(0.04, 0.04, 1.0, '#9aa6b8', -0.4, 4.0, -0.3)) // antenna
  g.add(mesh(merge(p)))
  // Screen.
  const sc = document.createElement('canvas')
  sc.width = sc.height = 256
  const screenTex = new CanvasTexture(sc)
  screenTex.colorSpace = SRGBColorSpace
  const screen = new Mesh(new PlaneGeometry(1.8, 1.8), new MeshBasicMaterial({ map: screenTex }))
  screen.position.set(0.8, 1.65, 1.31)
  g.add(screen)
  function drawScreen(text = '?', progress = -1, color = '#2f6fe0') {
    const x2 = sc.getContext('2d')
    const gr = x2.createLinearGradient(0, 0, 0, 256)
    gr.addColorStop(0, '#f4fbff')
    gr.addColorStop(1, '#cfe9ff')
    x2.fillStyle = gr
    x2.fillRect(0, 0, 256, 256)
    x2.fillStyle = color
    x2.textAlign = 'center'
    x2.textBaseline = 'middle'
    x2.font = `700 ${text.length > 2 ? 64 : 190}px Fredoka, sans-serif`
    x2.fillText(text, 128, progress >= 0 ? 110 : 138)
    if (progress >= 0) {
      x2.fillStyle = '#1b2440'
      x2.fillRect(28, 196, 200, 28)
      x2.fillStyle = '#3fe0ff'
      x2.fillRect(32, 200, 192 * progress, 20)
    }
    screenTex.needsUpdate = true
  }
  drawScreen()
  // Glass tanks with glowing liquid.
  // Plain transparent glass: transmission would re-render the whole scene every frame.
  const glass = new MeshStandardMaterial({ color: '#bfe8ff', transparent: true, opacity: 0.38, roughness: 0.05, metalness: 0.1, depthWrite: false })
  const liquidMat = neon('#33d6ff', 2.2)
  const tanks = []
  for (let i = 0; i < 3; i++) {
    const tz = -0.75 + i * 0.75
    const tg = new Group()
    tg.position.set(-1.7, 0.3, tz)
    const shell = new Mesh(new CylinderGeometry(0.33, 0.33, 1.7, 16), glass)
    shell.position.y = 0.85
    const liquid = new Mesh(new CylinderGeometry(0.28, 0.28, 1, 16), liquidMat)
    liquid.position.y = 0.4
    liquid.scale.y = 0.6
    const caps = mesh(merge([ccyl(0.38, 0.38, 0.14, '#1b2440', 0, 1.74, 0), ccyl(0.38, 0.38, 0.14, '#1b2440', 0, 0.02, 0)]))
    tg.add(shell, liquid, caps)
    g.add(tg)
    tanks.push(liquid)
  }
  // Pipe from the top unit arcing down to the tanks.
  const pipe = new Mesh(new TorusGeometry(1.1, 0.16, 8, 20, Math.PI * 0.9), new MeshStandardMaterial({ color: '#2a3140', roughness: 0.4, metalness: 0.4 }))
  pipe.position.set(-0.75, 2.75, 0)
  pipe.rotation.set(0, Math.PI / 2, 0)
  pipe.castShadow = true
  g.add(pipe)
  const bulb = new Mesh(new SphereGeometry(0.12, 12, 8), neon('#ff4fa8', 3))
  bulb.position.set(-0.4, 4.55, -0.3)
  g.add(bulb)
  const lights = []
  for (let i = 0; i < 3; i++) {
    const l = new Mesh(new SphereGeometry(0.08, 8, 6), neon(['#ff4f4f', '#ffd93b', '#6aff5a'][i], 2.5))
    l.position.set(1.9, 2.4 - i * 0.3, 1.0)
    g.add(l)
    lights.push(l)
  }
  const title = label('Fuse Machine', 0.95, { color: '#2f8cff', outline: '#ffffff', outlineWidth: 18, font: '700 100px Fredoka, "Arial Black", sans-serif' })
  title.position.set(0.3, 5.7, 0.5)
  g.add(title)
  const ring = groundRing(POI.fuse.r, '#3fe0ff', 0.3)
  ring.position.set(x, 0.04, z + 0.8)
  root.add(ring)
  solidBox(2.6, 2, 1.6, x - 0.3, 2, z - 2.2)
  let countLabel = null
  function setCount(n) {
    countLabel?.removeFromParent()
    countLabel = label(`${n}/3`, 0.8, { color: '#ffffff', outline: '#10131f', outlineWidth: 16 })
    countLabel.position.set(0.3, 4.85, 0.5)
    g.add(countLabel)
  }
  setCount(0)
  let running = 0
  let runFor = 0
  return {
    group: g,
    ring,
    setCount,
    drawScreen,
    // Fusing: the machine shakes, lights race, tanks bubble up.
    run(seconds) {
      running = seconds
      runFor = seconds
    },
    get running() {
      return running > 0
    },
    update(dt, t) {
      bulb.scale.setScalar(1 + Math.sin(t * 4) * 0.15)
      lights.forEach((l, i) => (l.visible = running > 0 ? Math.floor(t * 12 + i) % 3 === 0 : Math.floor(t * 1.5 + i) % 3 !== 0))
      if (running > 0) {
        running -= dt
        const k = 1 - running / runFor
        g.position.x = x + Math.sin(t * 60) * 0.04 * (1 - k * 0.3)
        g.position.z = z - 2.2 + Math.cos(t * 53) * 0.03
        tanks.forEach((l, i) => (l.scale.y = 0.4 + 1.1 * Math.abs(Math.sin(t * 5 + i))))
        if (running <= 0) g.position.set(x, 0, z - 2.2)
      } else {
        tanks.forEach((l, i) => {
          l.scale.y = 0.55 + Math.sin(t * 1.3 + i) * 0.08
          l.position.y = 0.3 + l.scale.y / 2
        })
      }
    },
  }
}

// --- Free reward chest ----------------------------------------------------------------------
export function buildChest(root) {
  const { x, z } = POI.chest
  const g = new Group()
  g.position.set(x, 0, z - 0.6)
  g.rotation.y = -0.3
  root.add(g)
  const wood = '#a2632f'
  const gold = '#ffcc33'
  const p = []
  p.push(cbox(2.2, 1.0, 1.5, wood, 0, 0.5, 0))
  for (const xx of [-0.85, 0.85]) p.push(cbox(0.18, 1.02, 1.54, gold, xx, 0.5, 0))
  p.push(cbox(2.24, 0.14, 1.54, gold, 0, 0.07, 0))
  for (let i = -3; i <= 3; i++) p.push(cbox(0.03, 0.9, 0.02, '#7a4a22', i * 0.28, 0.5, 0.76))
  g.add(mesh(merge(p)))
  const lid = new Group()
  lid.position.set(0, 1.0, -0.75)
  const lp = []
  lp.push(cbox(2.2, 0.5, 1.5, wood, 0, 0.25, 0.75))
  lp.push(cbox(2.0, 0.22, 1.3, '#b8743c', 0, 0.58, 0.75))
  for (const xx of [-0.85, 0.85]) lp.push(cbox(0.18, 0.54, 1.54, gold, xx, 0.27, 0.75))
  lp.push(cbox(0.36, 0.42, 0.08, gold, 0, 0.05, 1.52))
  lp.push(cbox(0.12, 0.14, 0.04, '#5a3a10', 0, 0.02, 1.57))
  lid.add(mesh(merge(lp), vc))
  g.add(lid)
  // Coins spilling round the base.
  const cp = []
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2
    const r = 1.3 + Math.random() * 0.9
    cp.push(ccyl(0.16, 0.16, 0.05, gold, Math.cos(a) * r, 0.03 + Math.random() * 0.05, Math.sin(a) * r, Math.random() * 0.4, 0, Math.random() * 0.4, 10))
  }
  g.add(mesh(merge(cp), vcShiny, false))
  const glowM = new Mesh(new SphereGeometry(0.9, 16, 10), new MeshBasicMaterial({ color: '#ffd34f', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false }))
  glowM.position.y = 1.2
  g.add(glowM)
  const title = label('FREE REWARD!', 1.1, { color: '#4fe03a', outline: '#1a4a10', outlineWidth: 18, font: '700 110px Fredoka, "Arial Black", sans-serif' })
  title.position.set(0, 3.3, 0)
  g.add(title)
  const dash = dashedRing(2.4, '#ffd34f', 20)
  dash.position.set(x, 0, z)
  root.add(dash)
  solidBox(1.1, 0.8, 0.75, x, 0.8, z - 0.6, -0.3)
  let timer = null
  let shownText = ''
  let open = 0
  return {
    group: g,
    setTimer(text) {
      if (text === shownText) return
      shownText = text
      timer?.removeFromParent()
      if (!text) return
      timer = label(text, 0.7, { color: '#ffffff', outline: '#10131f', outlineWidth: 14 })
      timer.position.set(0, 2.45, 0)
      g.add(timer)
    },
    pop() {
      open = 1.6
    },
    update(dt, t, ready) {
      if (open > 0) open -= dt
      const want = open > 0 ? -1.9 : ready ? -0.08 - Math.abs(Math.sin(t * 3)) * 0.12 : 0
      lid.rotation.x += (want - lid.rotation.x) * Math.min(1, dt * 10)
      glowM.material.opacity = open > 0 ? Math.min(0.5, open * 0.4) : ready ? 0.12 + Math.sin(t * 3) * 0.06 : 0
      title.visible = ready
      g.position.y = ready ? Math.max(0, Math.sin(t * 6)) * 0.05 : 0
    },
  }
}

// --- Leaderboards ------------------------------------------------------------------------------
function icon(kind) {
  const p = []
  if (kind === 'clover') {
    for (const [dx, dy] of [[-0.45, 0.45], [0.45, 0.45], [-0.45, -0.45], [0.45, -0.45]]) {
      p.push(cgeo(new SphereGeometry(0.55, 10, 8), '#5fd23a', dx, dy, 0, 0, 0, 0, 1, 1, 0.45))
      p.push(cgeo(new SphereGeometry(0.62, 10, 8), '#ffffff', dx, dy, -0.08, 0, 0, 0, 1, 1, 0.35))
    }
    p.push(cbox(0.16, 0.9, 0.2, '#3a9e20', 0.15, -1.1, 0, 0, 0, 0.3))
  } else if (kind === 'carrot') {
    p.push(cgeo(new CylinderGeometry(0.4, 0.05, 1.9, 10), '#ff8a2a', 0, 0, 0, 0, 0, 0.6))
    for (let i = 0; i < 3; i++) p.push(cbox(0.14, 0.7, 0.14, '#5fd23a', -0.55 + i * 0.15, 0.95 + i * 0.05, 0, 0, 0, 0.6 - i * 0.3))
    for (let i = 0; i < 4; i++) p.push(cbox(0.5, 0.05, 0.05, '#d96a14', -0.2 + i * 0.25, 0.3 - i * 0.35, 0.22, 0, 0, 0.6))
  } else {
    p.push(cbox(2.2, 1.2, 0.12, '#7be04a', 0, 0.1, 0, 0, 0, 0.15))
    p.push(cbox(2.3, 1.3, 0.08, '#ffffff', 0, 0.1, -0.06, 0, 0, 0.15))
    p.push(cbox(0.6, 0.6, 0.05, '#4fc22c', 0.05, 0.12, 0.08, 0, 0, 0.15))
    p.push(ccyl(0.55, 0.55, 0.16, '#ffcc33', -0.7, -0.55, 0.25, Math.PI / 2, 0, 0, 20))
    p.push(ccyl(0.36, 0.36, 0.18, '#ffe27a', -0.7, -0.55, 0.26, Math.PI / 2, 0, 0, 20))
  }
  const m = mesh(merge(p), vc)
  const g = new Group()
  g.add(m)
  return g
}

export function buildBoards(root) {
  const defs = [
    { title: 'BEST PULL', sub: 'Rarest baddie ever caught', color: '#9b5bff', icon: 'clover' },
    { title: 'MOST BADDIES', sub: 'Baddies caught', color: '#ff4fa8', icon: 'carrot' },
    { title: 'TOP MONEY/S', sub: 'Highest income', color: '#3fcf3a', icon: 'cash' },
  ]
  const boards = defs.map((d, i) => {
    const g = new Group()
    g.position.set(POI.boards.x + i * POI.boards.gap, 0, POI.boards.z)
    root.add(g)
    // Wooden frame: a back panel, chunky lighter rails round the screen, two feet.
    const fp = [cbox(7.4, 7.0, 0.5, '#8a5128', 0, 3.5, 0.25)]
    fp.push(cbox(7.6, 0.45, 0.75, '#a8662f', 0, 0.22, 0.4), cbox(0.5, 6.6, 0.75, '#a8662f', -3.55, 3.4, 0.4), cbox(0.5, 6.6, 0.75, '#a8662f', 3.55, 3.4, 0.4))
    for (let k = -3; k <= 3; k += 1.5) fp.push(ccyl(0.14, 0.14, 0.12, '#b8743c', k, 0.5, 0.82, Math.PI / 2, 0, 0, 10))
    g.add(mesh(merge(fp)))
    const hp = []
    hp.push(cbox(7.8, 1.5, 0.8, d.color, 0, 7.4, 0.5))
    hp.push(cbox(7.9, 0.2, 0.85, '#ffffff', 0, 6.62, 0.5))
    g.add(mesh(merge(hp)))
    const t = label(d.title, 0.95, { color: '#ffffff', outline: '#1a1030', outlineWidth: 16, font: '700 100px Fredoka, "Arial Black", sans-serif' })
    t.position.set(0, 7.55, 1.1)
    g.add(t)
    const s = label(d.sub, 0.32, { color: '#ffffffcc', outline: null, font: '600 60px Fredoka, sans-serif' })
    s.position.set(0, 6.95, 1.1)
    g.add(s)
    const c = document.createElement('canvas')
    c.width = 512
    c.height = 560
    const tex = new CanvasTexture(c)
    tex.colorSpace = SRGBColorSpace
    tex.anisotropy = 8
    const screen = new Mesh(new PlaneGeometry(6.2, 6.0), new MeshBasicMaterial({ map: tex, toneMapped: false }))
    screen.position.set(0, 3.45, 0.75)
    g.add(screen)
    const ic = icon(d.icon)
    ic.position.set(0, 10.2, 0.6)
    ic.scale.setScalar(1.3)
    g.add(ic)
    solidBox(3.8, 4, 0.6, g.position.x, 4, g.position.z + 0.3)
    return { c, tex, ic, g }
  })
  return {
    boards,
    draw(i, rows) {
      paintBoard(boards[i].c, rows)
      boards[i].tex.needsUpdate = true
    },
    update(dt, t) {
      boards.forEach((b, i) => {
        b.ic.rotation.y = Math.sin(t * 0.8 + i) * 0.5
        b.ic.position.y = 10.2 + Math.sin(t * 1.6 + i) * 0.25
      })
    },
  }
}

export function buildFriendWall(root) {
  const { x, z } = POI.friendWall
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 400
  const ctx = c.getContext('2d')
  const draw = () => {
    ctx.clearRect(0, 0, 1024, 400)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    ctx.font = '700 150px Fredoka, "Arial Black", sans-serif'
    for (const [line, y] of [['EACH FRIEND =', 110], ['+15% INCOME!', 280]]) {
      ctx.lineWidth = 26
      ctx.strokeStyle = '#1d5a10'
      ctx.strokeText(line, 512, y + 6)
      ctx.strokeText(line, 512, y)
      ctx.fillStyle = '#7dff4a'
      ctx.fillText(line, 512, y)
    }
  }
  draw()
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  document.fonts?.load('700 150px Fredoka').then(() => {
    draw()
    tex.needsUpdate = true
  })
  const m = new Mesh(new PlaneGeometry(9, 3.5), new MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }))
  m.position.set(x, 4.2, z + 0.32)
  root.add(m)
  const ring = groundRing(3.2, '#7dff4a', 0.3)
  ring.position.set(x, 0.04, z + 4)
  root.add(ring)
}

// --- The lane entrance and markers -------------------------------------------------------------
export function buildLaneDeco(root) {
  const L = HUB.lane
  const W = L.halfWidth
  // The lane mouth is open meadow, like the hub. You throw from the mouth: an invisible
  // wall at the throw line keeps feet out; the yellow throw band (buildThrowBand) marks it.
  addFixedBarrier(L.throwLine - 0.4, W)

  // Yellow guide chevrons on the ground, from the player toward the current quest's target
  // (main.js picks it), each pointing the way, with a brightness wave running along them.
  const arm = new PlaneGeometry(1.5, 0.42)
  const arrows = Array.from({ length: 7 }, () => {
    const g = new Group()
    for (const s of [-1, 1]) {
      const m = new Mesh(arm, new MeshBasicMaterial({ color: '#ffe23a', transparent: true, opacity: 0.95, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
      m.rotation.set(-Math.PI / 2, 0, s * 0.75)
      m.position.set(s * 0.5, 0, 0.45) // the V's tip points along local +Z
      g.add(m)
    }
    g.visible = false
    g.renderOrder = 2
    root.add(g)
    return g
  })
  const GAP = 3.2
  return {
    // from: the player's feet; target: { x, z } or null.
    update(t, from, target) {
      const dx = target ? target.x - from.x : 0
      const dz = target ? target.z - from.z : 0
      const d = Math.hypot(dx, dz)
      const yaw = Math.atan2(dx, dz)
      arrows.forEach((g, i) => {
        const at = 2.6 + i * GAP
        g.visible = !!target && d > 4 && at < d - 1.5 && from.y < 3
        if (!g.visible) return
        g.position.set(from.x + (dx / d) * at, 0.04, from.z + (dz / d) * at)
        g.rotation.y = yaw
        const k = 0.5 + 0.5 * Math.sin(t * 5 - i * 0.9)
        for (const m of g.children) m.material.opacity = (0.4 + k * 0.6) * Math.min(1, (d - 1.5 - at) / 3)
        g.scale.setScalar(0.85 + k * 0.2)
      })
    },
  }
}

function addFixedBarrier(z, W) {
  solidBox(W, 3, 0.3, 0, 3, z)
}


// --- The yellow throw band ------------------------------------------------------------------------
// A bright stud plate across the lane mouth: hazard-striped kerbs, "THROW!" painted on it,
// chevrons rippling north, a pulsing spot where you stand, a curtain of light along the
// throw line and two brick pillars with glowing orbs. update() animates it (brighter while
// the player stands on it or is mid-throw).
export function buildThrowBand(root) {
  const B = THROW_MODE.band
  const W = B.halfWidth
  const g = new Group()
  root.add(g)
  const plate = new Mesh(flat(-W, W, B.north, B.south, 0.045, 4), studMaterial('#ffdc3a', '#ffcf1f', { seed: 61, seam: 0.14 }))
  plate.receiveShadow = true
  g.add(plate)
  // Hazard kerbs: alternating orange and white bricks along both edges.
  const kerb = []
  const n = Math.round((W * 2) / 1.2)
  for (const z of [B.north + 0.2, B.south - 0.2]) {
    for (let i = 0; i < n; i++) {
      const x = -W + (i + 0.5) * ((W * 2) / n)
      kerb.push(cbox((W * 2) / n - 0.06, 0.16, 0.4, i % 2 ? '#ffffff' : '#ff8a1f', x, 0.08, z))
      kerb.push(ccyl(0.11, 0.11, 0.06, i % 2 ? '#f2f2f2' : '#f07a12', x - 0.25, 0.19, z, 0, 0, 0, 10))
      kerb.push(ccyl(0.11, 0.11, 0.06, i % 2 ? '#f2f2f2' : '#f07a12', x + 0.25, 0.19, z, 0, 0, 0, 10))
    }
  }
  // Pillars: three stacked bricks, a cap and a lamp holder each side.
  const pillars = []
  for (const sx of [-1, 1]) {
    const x = sx * (W + 0.1)
    const z = (B.north + B.south) / 2
    pillars.push(cbox(1.1, 0.9, 1.1, '#ffd23a', x, 0.45, z), cbox(1.1, 0.9, 1.1, '#ffffff', x, 1.35, z), cbox(1.1, 0.9, 1.1, '#ffd23a', x, 2.25, z))
    for (const [dx, dz] of [[-0.27, -0.27], [0.27, -0.27], [-0.27, 0.27], [0.27, 0.27]]) pillars.push(ccyl(0.17, 0.17, 0.12, '#ffc61a', x + dx, 2.76, z + dz, 0, 0, 0, 10))
    pillars.push(ccyl(0.42, 0.5, 0.25, '#3a3f52', x, 2.95, z, 0, 0, 0, 14))
  }
  g.add(mesh(merge([...kerb, ...pillars])))
  const orbMat = neon('#fff27a', 2.2)
  const orbs = [-1, 1].map((sx) => {
    const o = new Mesh(new SphereGeometry(0.42, 18, 12), orbMat)
    o.position.set(sx * (W + 0.1), 3.45, (B.north + B.south) / 2)
    g.add(o)
    return o
  })
  // "THROW!" painted on the plate (reads from the hub side).
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 256
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const paint = () => {
    const x = c.getContext('2d')
    x.clearRect(0, 0, 1024, 256)
    x.font = '700 190px Fredoka, Arial Rounded MT Bold, sans-serif'
    x.textAlign = 'center'
    x.textBaseline = 'middle'
    x.lineJoin = 'round'
    x.lineWidth = 34
    x.strokeStyle = '#b86a00'
    x.strokeText('THROW!', 512, 136)
    x.fillStyle = '#ffffff'
    x.fillText('THROW!', 512, 136)
    tex.needsUpdate = true
  }
  paint()
  document.fonts?.load('700 190px Fredoka').then(paint)
  const word = new Mesh(new PlaneGeometry(7.6, 1.9).rotateX(-Math.PI / 2), new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, opacity: 0.92 }))
  word.position.set(0, 0.06, B.south - 1.35)
  word.renderOrder = 2
  g.add(word)
  // Chevrons pointing north, a wave of light running along them.
  const arm = new PlaneGeometry(1.2, 0.34)
  const chevrons = []
  for (const x of [-5.6, 5.6]) {
    for (let i = 0; i < 3; i++) {
      const cg = new Group()
      for (const s2 of [-1, 1]) {
        const m = new Mesh(arm, new MeshBasicMaterial({ color: '#ff8a1f', transparent: true, opacity: 0.9, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 }))
        m.rotation.set(-Math.PI / 2, 0, -s2 * 0.75)
        m.position.set(s2 * 0.4, 0, -0.36)
        cg.add(m)
      }
      cg.position.set(x, 0.06, B.south - 1.0 - i * 1.15)
      cg.renderOrder = 2
      g.add(cg)
      chevrons.push(cg)
    }
  }
  // The standing spot.
  const spot = new Group()
  spot.position.set(THROW_MODE.spot.x, 0.06, THROW_MODE.spot.z)
  const ringA = groundRing(1.25, '#ffffff', 0.2)
  ringA.position.y = 0
  const ringB = dashedRing(1.6, '#ffffff', 16)
  ringB.position.y = 0.01
  spot.add(ringA, ringB)
  g.add(spot)
  // Light curtain along the throw line.
  const cc = document.createElement('canvas')
  cc.width = 4
  cc.height = 128
  const cx = cc.getContext('2d')
  const grad = cx.createLinearGradient(0, 0, 0, 128)
  grad.addColorStop(0, 'rgba(255,255,255,0)')
  grad.addColorStop(1, 'rgba(255,255,255,1)')
  cx.fillStyle = grad
  cx.fillRect(0, 0, 4, 128)
  const curtainTex = new CanvasTexture(cc)
  const curtain = new Mesh(new PlaneGeometry(W * 2, 1.4), new MeshBasicMaterial({ map: curtainTex, color: '#ffe23a', transparent: true, opacity: 0.35, depthWrite: false, blending: AdditiveBlending, side: 2, fog: false }))
  curtain.position.set(0, 0.7, B.north + 0.05)
  curtain.renderOrder = 3
  g.add(curtain)
  let glow = 0
  return {
    update(t, dt, near, active) {
      glow += ((active ? 1 : near ? 0.6 : 0) - glow) * Math.min(1, dt * 4)
      chevrons.forEach((cg, i) => {
        const k = 0.5 + 0.5 * Math.sin(t * 5 - (i % 3) * 1.1)
        for (const m of cg.children) m.material.opacity = 0.35 + k * 0.6
        cg.scale.setScalar(0.9 + k * 0.15)
      })
      const pulse = 0.5 + 0.5 * Math.sin(t * 3)
      spot.scale.setScalar(1 + pulse * 0.08 + glow * 0.1)
      ringB.rotation.y = t * 0.6
      ringA.material.opacity = 0.55 + pulse * 0.35
      curtain.material.opacity = (0.16 + pulse * 0.08) * (1 - glow * 0.85)
      for (const o of orbs) o.scale.setScalar(1 + pulse * 0.12 + glow * 0.25)
    },
  }
}
