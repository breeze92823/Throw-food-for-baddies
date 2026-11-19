// The hub world: a sunken lego meadow, two tiers of grass-topped dirt cliffs all
// round it, the long lane cut north through them (twelve themed areas), the
// road, voxel trees and flowers on the terraces, an endless grass plateau beyond
// and puffy clouds. Static geometry is merged into a few meshes per material.
import { BoxGeometry, CanvasTexture, Color, ConeGeometry, Group, IcosahedronGeometry, InstancedMesh, Mesh, MeshBasicMaterial, MeshLambertMaterial, MeshStandardMaterial, Object3D, PlaneGeometry, SRGBColorSpace, Vector2 } from 'three'
import { HUB } from '../config.js'
import { RAPIER, addFixed } from '../physics.js'
import { mulberry32 } from '../textures.js'
import { block, cbox, ccyl, cgeo, flat, merge } from './geo.js'
import { zoneAt } from '../game/lane.js'
import { cliffMaps, paintStuds, roadMaps, tex } from './paint.js'

const T = HUB.tierHeight

export function studMaterial(a, b, { tile = 1, seed = 1, roughness = 0.82, seam = 0.18, normalScale = 0.55 } = {}) {
  const m = paintStuds({ a, b, seam, seed })
  return new MeshStandardMaterial({
    map: tex(m.color, { rx: tile, ry: tile }),
    normalMap: tex(m.normal, { srgb: false, rx: tile, ry: tile }),
    normalScale: new Vector2(normalScale, normalScale),
    roughness,
    metalness: 0,
  })
}

function cliffMaterial() {
  const m = cliffMaps()
  return new MeshStandardMaterial({
    map: tex(m.color),
    normalMap: tex(m.normal, { srgb: false }),
    normalScale: new Vector2(0.6, 0.6),
    roughness: 0.9,
  })
}

// Bare dirt (the cliff painter with dirt where the grass would be) for the canyon below the hub.
function dirtMaterial() {
  const m = cliffMaps({ grass: '#8b5a33', grassAlt: '#7a4b29' })
  return new MeshStandardMaterial({
    map: tex(m.color),
    normalMap: tex(m.normal, { srgb: false }),
    normalScale: new Vector2(0.6, 0.6),
    roughness: 0.92,
    color: '#d8c8b8',
  })
}

// Solid block both drawn (sides + top) and collided.
function addBlock(lists, x0, x1, z0, z1, y0, y1, collide = true) {
  const b = block(x0, x1, z0, z1, y0, y1, { sideH: T })
  lists.sides.push(b.sides)
  lists.tops.push(b.top)
  if (collide) addFixed(RAPIER.ColliderDesc.cuboid((x1 - x0) / 2, (y1 - y0) / 2, (z1 - z0) / 2), { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: (z0 + z1) / 2 })
}

function makeClouds() {
  const rand = mulberry32(77)
  const geo = new IcosahedronGeometry(1, 3)
  const mat = new MeshLambertMaterial({ color: '#ffffff', emissive: '#dcebff', emissiveIntensity: 0.6, fog: false })
  const group = new Group()
  for (let i = 0; i < 26; i++) {
    const ang = rand() * Math.PI * 2
    const dist = 260 + rand() * 200
    const cloud = new Group()
    const puffs = 5 + Math.floor(rand() * 4)
    const len = 24 + rand() * 30
    for (let p = 0; p < puffs; p++) {
      const t = p / (puffs - 1) - 0.5
      const r = (1 - Math.abs(t) * 1.1) * (9 + rand() * 7)
      const puff = new Mesh(geo, mat)
      puff.scale.set(r, r * 0.8, r)
      puff.position.set(t * len, r * 0.25 + rand() * 3, (rand() - 0.5) * 8)
      cloud.add(puff)
    }
    const base = new Mesh(geo, mat)
    base.scale.set(len * 0.6, 4, 9)
    cloud.add(base)
    cloud.position.set(Math.cos(ang) * dist, 60 + rand() * 70, Math.sin(ang) * dist - 60)
    cloud.lookAt(0, cloud.position.y, -60)
    cloud.userData.speed = 0.6 + rand() * 0.8
    group.add(cloud)
  }
  return group
}

// Voxel trees, flowers and bushes on the terraces (instanced).
function makeFlora(root, spots) {
  const rand = mulberry32(99)
  const leafMat = studMaterial('#5fd23a', '#52c62e', { tile: 1.25, seed: 21, seam: 0.12 })
  const leafDark = studMaterial('#43ac25', '#3a9e20', { tile: 1.25, seed: 22, seam: 0.12 })
  const trunkMat = studMaterial('#8b5a33', '#7a4b29', { tile: 0.5, seed: 23, seam: 0.1 })
  const cube = new BoxGeometry(1, 1, 1)
  const trunk = new InstancedMesh(cube, trunkMat, spots.length)
  const layers = [new InstancedMesh(cube, leafDark, spots.length), new InstancedMesh(cube, leafMat, spots.length), new InstancedMesh(cube, leafMat, spots.length)]
  const fruitCount = spots.length * 3
  const fruit = new InstancedMesh(new BoxGeometry(0.45, 0.45, 0.45), new MeshStandardMaterial({ color: '#ff3b3b', roughness: 0.45 }), fruitCount)
  const o = new Object3D()
  let f = 0
  spots.forEach(([x, y, z], i) => {
    const s = 0.8 + rand() * 0.7
    const h = (3 + rand() * 2.5) * s
    const ry = Math.floor(rand() * 4) * (Math.PI / 2) + (rand() - 0.5) * 0.3
    o.rotation.set(0, ry, 0)
    o.position.set(x, y + h / 2, z)
    o.scale.set(0.9 * s, h, 0.9 * s)
    o.updateMatrix()
    trunk.setMatrixAt(i, o.matrix)
    const sizes = [[6.2, 1.8], [5, 1.6], [3.2, 1.3]]
    let top = y + h
    sizes.forEach(([w, lh], k) => {
      o.position.set(x + (rand() - 0.5) * 0.6 * s, top + (lh * s) / 2 - 0.15, z + (rand() - 0.5) * 0.6 * s)
      o.scale.set(w * s, lh * s, w * s * (0.85 + rand() * 0.3))
      o.updateMatrix()
      layers[k].setMatrixAt(i, o.matrix)
      top += lh * s - 0.2
    })
    for (let a = 0; a < 3; a++) {
      const ang = rand() * Math.PI * 2
      const r = 2.6 * s
      o.position.set(x + Math.cos(ang) * r, y + h + 0.3 + rand() * 0.6, z + Math.sin(ang) * r)
      o.scale.setScalar(rand() < 0.4 ? 0.0001 : 1)
      o.rotation.set(0, ang, 0)
      o.updateMatrix()
      fruit.setMatrixAt(f++, o.matrix)
    }
  })
  for (const m of [trunk, ...layers, fruit]) {
    m.castShadow = true
    m.receiveShadow = true
    root.add(m)
  }
  return spots
}

function makeFlowers(root, area, count, seed) {
  const rand = mulberry32(seed)
  const colors = ['#ff5f8a', '#ffd93b', '#ffffff', '#b07cff', '#ff8a2a']
  const stem = new InstancedMesh(new BoxGeometry(0.12, 0.5, 0.12), new MeshStandardMaterial({ color: '#2f9a2a' }), count)
  const head = new InstancedMesh(new BoxGeometry(0.42, 0.22, 0.42), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 }), count)
  const centre = new InstancedMesh(new BoxGeometry(0.18, 0.26, 0.18), new MeshStandardMaterial({ color: '#ffcf33' }), count)
  const o = new Object3D()
  const c = new Color()
  for (let i = 0; i < count; i++) {
    const [x, y, z] = area(rand)
    o.position.set(x, y + 0.25, z)
    o.rotation.set(0, rand() * Math.PI, 0)
    o.scale.setScalar(1)
    o.updateMatrix()
    stem.setMatrixAt(i, o.matrix)
    o.position.y = y + 0.55
    o.updateMatrix()
    head.setMatrixAt(i, o.matrix)
    centre.setMatrixAt(i, o.matrix)
    head.setColorAt(i, c.set(colors[Math.floor(rand() * colors.length)]))
  }
  for (const m of [stem, head, centre]) root.add(m)
}

// Along the lane floor, tucked against both walls: each area's own props (meadow trees and
// bushes, hay bales and corn, willows and reeds, cacti and mesas, snowy pines and ice, autumn
// trees and pumpkins, crystal clusters, palms and parasols, coral and kelp, clouds and gold
// pillars, obsidian and lava pools, alien crystals and meteors). The girls step out from
// behind them when food lands nearby. All merged into one vertex-coloured mesh plus one
// glowing (HDR, blooms) mesh. Each area boundary also gets a glowing line across the floor
// and a name sign on a post by each wall, angled toward the throw line.
export const laneCover = [] // { x, z, side, y, zone } filled by makeLaneEdges
const PROPS = {
  tree(B, G, x, y, z, k, r) {
    const h = 1.6 * k
    B.push(cbox(0.35 * k, h, 0.35 * k, '#8b5a33', x, y + h / 2, z))
    B.push(cbox(2.1 * k, 0.9 * k, 2.1 * k, '#5fd23a', x, y + h + 0.45 * k, z))
    B.push(cbox(1.3 * k, 0.7 * k, 1.3 * k, '#6fe04a', x, y + h + 1.15 * k, z))
    for (let i = 0; i < 3; i++) B.push(cbox(0.25, 0.25, 0.25, r() < 0.5 ? '#ff5f8a' : '#ffffff', x + (r() - 0.5) * 1.8 * k, y + h + 0.95 * k, z + 1.06 * k))
  },
  bush(B, G, x, y, z, k) {
    B.push(cbox(1.5 * k, 1.1 * k, 1.4 * k, '#48b82a', x, y + 0.55 * k, z))
    B.push(cbox(0.9 * k, 0.6 * k, 0.9 * k, '#52c62e', x, y + 1.25 * k, z + 0.2))
  },
  flowerBush(B, G, x, y, z, k, r) {
    PROPS.bush(B, G, x, y, z, k)
    const cols = ['#ff5f8a', '#ffd93b', '#ffffff', '#b07cff']
    for (let i = 0; i < 6; i++) B.push(cbox(0.22, 0.22, 0.22, cols[i % 4], x + (r() - 0.5) * 1.4 * k, y + (0.6 + r() * 0.9) * k, z + 0.72 * k))
  },
  hay(B, G, x, y, z, k) {
    B.push(ccyl(0.75 * k, 0.75 * k, 1.6 * k, '#e8c64a', x, y + 0.75 * k, z, 0, 0, Math.PI / 2, 12))
    for (const o of [-0.45, 0.45]) B.push(ccyl(0.77 * k, 0.77 * k, 0.08, '#a8742a', x + o * k, y + 0.75 * k, z, 0, 0, Math.PI / 2, 12))
    B.push(cbox(1.1 * k, 0.9 * k, 1.1 * k, '#f0d35c', x, y + 1.9 * k, z - 0.2, 0, 0.3, 0))
  },
  crate(B, G, x, y, z, k) {
    B.push(cbox(1.3 * k, 1.1 * k, 1.1 * k, '#b07a44', x, y + 0.55 * k, z))
    for (const o of [-0.4, 0.4]) B.push(cbox(0.12, 1.12 * k, 1.12 * k, '#7a4b29', x + o * k, y + 0.55 * k, z))
    B.push(cgeo(new IcosahedronGeometry(0.35 * k, 1), '#ff3b3b', x, y + 1.3 * k, z))
    B.push(cgeo(new IcosahedronGeometry(0.3 * k, 1), '#ff8a2a', x + 0.4 * k, y + 1.25 * k, z + 0.2))
  },
  corn(B, G, x, y, z, k, r) {
    for (let i = 0; i < 4; i++) {
      const ox = x + (r() - 0.5) * 1.4
      const oz = z + (r() - 0.5) * 1.2
      const h = (2.2 + r()) * k
      B.push(cbox(0.14, h, 0.14, '#6aa83a', ox, y + h / 2, oz))
      B.push(cbox(0.7, 0.08, 0.2, '#7bc04a', ox + 0.3, y + h * 0.6, oz, 0, 0, -0.4))
      B.push(cbox(0.7, 0.08, 0.2, '#7bc04a', ox - 0.3, y + h * 0.45, oz, 0, 0, 0.4))
      B.push(cbox(0.2, 0.5, 0.2, '#ffd23a', ox + 0.12, y + h * 0.7, oz))
    }
  },
  willow(B, G, x, y, z, k, r) {
    const h = 2.4 * k
    B.push(cbox(0.45 * k, h, 0.45 * k, '#7a5a3a', x, y + h / 2, z))
    B.push(cgeo(new IcosahedronGeometry(1.5 * k, 1), '#8ad04a', x, y + h + 0.6 * k, z, 0, 0, 0, 1, 0.6, 1))
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2
      const l = (1.6 + r() * 0.8) * k
      B.push(cbox(0.14, l, 0.14, i % 2 ? '#9be05a' : '#7bc04a', x + Math.cos(a) * 1.4 * k, y + h + 0.4 * k - l / 2, z + Math.sin(a) * 1.3 * k))
    }
  },
  reeds(B, G, x, y, z, k, r) {
    for (let i = 0; i < 7; i++) {
      const ox = x + (r() - 0.5) * 1.6
      const oz = z + (r() - 0.5) * 1.4
      const h = (1.4 + r() * 0.9) * k
      B.push(cbox(0.08, h, 0.08, '#6aa83a', ox, y + h / 2, oz, (r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2))
      if (i % 2) B.push(cbox(0.16, 0.4, 0.16, '#7a4b29', ox, y + h, oz))
    }
  },
  lilyRock(B, G, x, y, z, k) {
    B.push(cgeo(new IcosahedronGeometry(0.8 * k, 0), '#9aa1ad', x, y + 0.4 * k, z, 0, 0.4, 0, 1.2, 0.8, 1))
    B.push(ccyl(1.0 * k, 1.0 * k, 0.05, '#3fa6c0', x + 0.9 * k, y + 0.03, z + 0.5, 0, 0, 0, 16))
    B.push(ccyl(0.45 * k, 0.45 * k, 0.06, '#5fbf4a', x + 0.9 * k, y + 0.07, z + 0.5, 0, 0, 0, 10))
    B.push(cgeo(new ConeGeometry(0.18, 0.3, 6), '#ff8ac0', x + 0.9 * k, y + 0.24, z + 0.5))
  },
  cactus(B, G, x, y, z, k) {
    const h = 2.4 * k
    B.push(cbox(0.5 * k, h, 0.5 * k, '#4fa83a', x, y + h / 2, z))
    for (const s of [-1, 1]) {
      B.push(cbox(0.5 * k, 0.32 * k, 0.32 * k, '#4fa83a', x + s * 0.45 * k, y + h * (s > 0 ? 0.5 : 0.62), z))
      B.push(cbox(0.32 * k, 0.8 * k, 0.32 * k, '#5ab846', x + s * 0.62 * k, y + h * (s > 0 ? 0.5 : 0.62) + 0.4 * k, z))
    }
    B.push(cbox(0.3, 0.2, 0.3, '#ff5fa8', x, y + h + 0.1, z))
  },
  mesaRock(B, G, x, y, z, k) {
    B.push(cbox(2.0 * k, 0.9 * k, 1.6 * k, '#d9824a', x, y + 0.45 * k, z))
    B.push(cbox(1.5 * k, 0.7 * k, 1.2 * k, '#e8a060', x + 0.1, y + 1.25 * k, z))
    B.push(cbox(0.9 * k, 0.5 * k, 0.8 * k, '#c8703a', x - 0.1, y + 1.85 * k, z))
  },
  deadBush(B, G, x, y, z, k, r) {
    for (let i = 0; i < 7; i++) B.push(cbox(0.08, 1.1 * k, 0.08, '#a87a4a', x + (r() - 0.5) * 0.4, y + 0.5 * k, z + (r() - 0.5) * 0.4, (r() - 0.5) * 1.2, 0, (r() - 0.5) * 1.2))
    B.push(cgeo(new IcosahedronGeometry(0.45 * k, 0), '#c8a070', x + 0.6, y + 0.25, z + 0.4))
  },
  pine(B, G, x, y, z, k) {
    B.push(cbox(0.35 * k, 0.8 * k, 0.35 * k, '#6b3f22', x, y + 0.4 * k, z))
    for (let i = 0; i < 3; i++) {
      const w = (1.5 - i * 0.4) * k
      B.push(cgeo(new ConeGeometry(w, 1.3 * k, 8), '#2f7a4a', x, y + (1.2 + i * 0.8) * k, z))
      B.push(cgeo(new ConeGeometry(w * 0.7, 0.5 * k, 8), '#ffffff', x, y + (1.5 + i * 0.8) * k, z))
    }
  },
  snowMound(B, G, x, y, z, k, r) {
    for (let i = 0; i < 3; i++) B.push(cgeo(new IcosahedronGeometry((0.7 - i * 0.15) * k, 1), '#ffffff', x + (r() - 0.5) * 1.2, y + 0.3 * k, z + (r() - 0.5) * 0.9, 0, 0, 0, 1, 0.6, 1))
    B.push(cbox(0.1, 0.4, 0.1, '#ff8a2a', x, y + 1.0 * k, z + 0.3, 1.4))
  },
  iceBlock(B, G, x, y, z, k) {
    B.push(cbox(1.2 * k, 1.4 * k, 1.0 * k, '#bfeaff', x, y + 0.7 * k, z, 0, 0.3, 0))
    B.push(cbox(0.7 * k, 0.9 * k, 0.7 * k, '#9fdcff', x + 0.7 * k, y + 0.45 * k, z + 0.4, 0, -0.2, 0))
    G.push(cgeo(new ConeGeometry(0.15, 0.6, 4), '#d8f6ff', x, y + 1.6 * k, z))
  },
  autumnTree(B, G, x, y, z, k, r) {
    const h = 1.8 * k
    B.push(cbox(0.38 * k, h, 0.38 * k, '#6b3f22', x, y + h / 2, z))
    const c = ['#ff8a2a', '#e8502a', '#ffc23a'][Math.floor(r() * 3)]
    B.push(cbox(2.2 * k, 1.0 * k, 2.2 * k, c, x, y + h + 0.5 * k, z))
    B.push(cbox(1.4 * k, 0.7 * k, 1.4 * k, '#ffaa3a', x, y + h + 1.2 * k, z))
  },
  pumpkin(B, G, x, y, z, k) {
    for (const [ox, s] of [[0, 1], [0.9, 0.7]]) {
      B.push(cgeo(new IcosahedronGeometry(0.6 * k * s, 1), '#ff8a2a', x + ox * k, y + 0.45 * k * s, z, 0, 0, 0, 1.2, 0.85, 1.1))
      B.push(cbox(0.1, 0.3 * s, 0.1, '#4a7a2a', x + ox * k, y + 0.95 * k * s, z))
    }
    for (const ex of [-0.18, 0.18]) G.push(cgeo(new ConeGeometry(0.1 * k, 0.16 * k, 3), '#ffd23a', x + ex * k, y + 0.55 * k, z + 0.6 * k, Math.PI / 2))
    G.push(cbox(0.4 * k, 0.08 * k, 0.04, '#ffd23a', x, y + 0.32 * k, z + 0.64 * k))
  },
  redBush(B, G, x, y, z, k) {
    B.push(cbox(1.5 * k, 1.0 * k, 1.4 * k, '#c8401a', x, y + 0.5 * k, z))
    B.push(cbox(0.9 * k, 0.6 * k, 0.9 * k, '#e8602a', x, y + 1.2 * k, z + 0.2))
  },
  crystals(B, G, x, y, z, k, r) {
    B.push(cgeo(new IcosahedronGeometry(0.8 * k, 0), '#6a7aa0', x, y + 0.3 * k, z, 0, 0, 0, 1.3, 0.6, 1))
    const cols = ['#7ae8ff', '#c8a0ff', '#ff9bd2']
    for (let i = 0; i < 5; i++) G.push(cgeo(new ConeGeometry(0.22 * k, (1.2 + r() * 1.2) * k, 5), cols[i % 3], x + (r() - 0.5) * 1.2, y + 0.9 * k, z + (r() - 0.5) * 0.8, (r() - 0.5) * 0.6, 0, (r() - 0.5) * 0.6))
  },
  blueRock(B, G, x, y, z, k) {
    B.push(cgeo(new IcosahedronGeometry(0.9 * k, 0), '#5a6a9a', x, y + 0.5 * k, z, 0, 0.5, 0, 1.2, 0.9, 1))
    G.push(cgeo(new ConeGeometry(0.15, 0.6, 5), '#7ae8ff', x + 0.4, y + 1.2 * k, z + 0.3))
  },
  palm(B, G, x, y, z, k) {
    let px = x
    let py = y
    for (let i = 0; i < 6; i++) {
      B.push(cbox(0.36 * k, 0.6 * k, 0.36 * k, i % 2 ? '#a8743a' : '#c8904a', px, py + 0.3 * k, z, 0, 0, -0.08 * i))
      px += 0.06 * i * k
      py += 0.56 * k
    }
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      B.push(cbox(1.8 * k, 0.1, 0.5 * k, '#3fa83a', px + Math.cos(a) * 0.8 * k, py + 0.1, z + Math.sin(a) * 0.8 * k, 0, -a, -0.35))
    }
    for (let i = 0; i < 3; i++) B.push(cgeo(new IcosahedronGeometry(0.16 * k, 0), '#6b3f22', px + (i - 1) * 0.2, py - 0.15, z + 0.2))
  },
  umbrella(B, G, x, y, z, k) {
    B.push(cbox(0.08, 2.2 * k, 0.08, '#ffffff', x, y + 1.1 * k, z))
    for (let i = 0; i < 8; i++) B.push(cgeo(new ConeGeometry(1.4 * k, 0.6 * k, 8, 1, false, (i / 8) * Math.PI * 2, Math.PI / 4), i % 2 ? '#ff5f8a' : '#ffffff', x, y + 2.3 * k, z))
    B.push(cbox(1.0 * k, 0.04, 1.8 * k, '#3ad0ff', x + 0.8, y + 0.03, z + 0.3))
  },
  sandcastle(B, G, x, y, z, k) {
    B.push(cbox(1.6 * k, 0.6 * k, 1.2 * k, '#e8c890', x, y + 0.3 * k, z))
    for (const [ox, oz] of [[-0.6, -0.4], [0.6, -0.4], [-0.6, 0.4], [0.6, 0.4]]) B.push(ccyl(0.22 * k, 0.26 * k, 1.0 * k, '#f0d8a0', x + ox * k, y + 0.5 * k, z + oz * k, 0, 0, 0, 8))
    B.push(cbox(0.03, 0.6, 0.03, '#ffffff', x, y + 1.0 * k, z))
    B.push(cbox(0.3, 0.2, 0.02, '#ff3a3a', x + 0.15, y + 1.2 * k, z))
  },
  coral(B, G, x, y, z, k, r) {
    const c = ['#ff6f61', '#ff9bd2', '#ffaa33', '#b07cff'][Math.floor(r() * 4)]
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2
      B.push(ccyl(0.1 * k, 0.16 * k, (1 + r()) * k, c, x + Math.cos(a) * 0.4 * k, y + 0.7 * k, z + Math.sin(a) * 0.4 * k, Math.sin(a) * 0.4, 0, -Math.cos(a) * 0.4, 6))
      G.push(cgeo(new IcosahedronGeometry(0.08 * k, 0), '#ffffff', x + Math.cos(a) * 0.75 * k, y + 1.4 * k, z + Math.sin(a) * 0.75 * k))
    }
    B.push(cgeo(new IcosahedronGeometry(0.55 * k, 1), '#ff8ac0', x + 0.8, y + 0.35, z + 0.4, 0, 0, 0, 1, 0.7, 1))
  },
  seaweed(B, G, x, y, z, k, r) {
    for (let j = 0; j < 4; j++) {
      const ox = x + (r() - 0.5) * 1.2
      const oz = z + (r() - 0.5) * 1.0
      for (let i = 0; i < 6; i++) B.push(cbox(0.22, 0.5 * k, 0.1, i % 2 ? '#2fae6a' : '#3fc47a', ox + Math.sin(i * 1.3 + j) * 0.15, y + (0.25 + i * 0.45) * k, oz, 0, 0, Math.sin(i + j) * 0.25))
    }
  },
  cloud(B, G, x, y, z, k, r) {
    for (let i = 0; i < 5; i++) B.push(cgeo(new IcosahedronGeometry((0.7 + r() * 0.4) * k, 1), i % 2 ? '#ffffff' : '#f4f0ff', x + (r() - 0.5) * 1.8, y + (0.5 + r() * 0.6) * k, z + (r() - 0.5) * 1.2))
    G.push(cgeo(new IcosahedronGeometry(0.1, 0), '#fff6c0', x, y + 1.8 * k, z))
  },
  pillar(B, G, x, y, z, k) {
    B.push(cbox(1.1 * k, 0.3 * k, 1.1 * k, '#ffe680', x, y + 0.15 * k, z))
    B.push(ccyl(0.36 * k, 0.4 * k, 3.0 * k, '#fffaf0', x, y + 1.8 * k, z, 0, 0, 0, 10))
    B.push(cbox(1.0 * k, 0.3 * k, 1.0 * k, '#ffd23a', x, y + 3.4 * k, z))
    G.push(cgeo(new IcosahedronGeometry(0.22 * k, 1), '#fff6c0', x, y + 3.85 * k, z))
  },
  obsidian(B, G, x, y, z, k, r) {
    for (let i = 0; i < 4; i++) B.push(cgeo(new ConeGeometry(0.4 * k, (1.2 + r() * 1.2) * k, 5), '#1a1418', x + (r() - 0.5) * 1.2, y + 0.6 * k, z + (r() - 0.5) * 0.9, (r() - 0.5) * 0.5, 0, (r() - 0.5) * 0.5))
    G.push(cbox(0.08, 1.0 * k, 0.08, '#ff5a1a', x + 0.2, y + 0.5 * k, z + 0.45 * k, 0, 0, 0.4))
  },
  charTree(B, G, x, y, z, k) {
    const h = 2.4 * k
    B.push(cbox(0.36 * k, h, 0.36 * k, '#2a1a1a', x, y + h / 2, z))
    for (const s of [-1, 1]) B.push(cbox(0.14, 1.2 * k, 0.14, '#2a1a1a', x + s * 0.4 * k, y + h * 0.8, z, 0, 0, s * -0.7))
    for (let i = 0; i < 3; i++) G.push(cgeo(new IcosahedronGeometry(0.07, 0), '#ff7a1a', x + (i - 1) * 0.3, y + h * (0.4 + i * 0.2), z + 0.2))
  },
  lavaRock(B, G, x, y, z, k) {
    B.push(cgeo(new IcosahedronGeometry(0.9 * k, 0), '#3a2a2a', x, y + 0.45 * k, z, 0, 0.3, 0, 1.3, 0.8, 1))
    G.push(ccyl(0.9 * k, 0.9 * k, 0.04, '#ff6a1a', x + 1.0 * k, y + 0.03, z + 0.6, 0, 0, 0, 10))
    G.push(ccyl(0.5 * k, 0.5 * k, 0.05, '#ffcc33', x + 1.0 * k, y + 0.05, z + 0.6, 0, 0, 0, 10))
  },
  alienCrystal(B, G, x, y, z, k, r) {
    B.push(cgeo(new IcosahedronGeometry(0.7 * k, 0), '#2a1a4a', x, y + 0.3 * k, z, 0, 0, 0, 1.2, 0.6, 1))
    for (let i = 0; i < 4; i++) G.push(cgeo(new ConeGeometry(0.2 * k, (1.4 + r() * 1.4) * k, 6), i % 2 ? '#b04aff' : '#3affd0', x + (r() - 0.5), y + 1 * k, z + (r() - 0.5) * 0.8, (r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7))
  },
  alienPlant(B, G, x, y, z, k, r) {
    for (let i = 0; i < 3; i++) {
      const ox = x + (r() - 0.5) * 1.2
      const h = (1.4 + r()) * k
      B.push(cbox(0.12, h, 0.12, '#3a8a6a', ox, y + h / 2, z + (r() - 0.5)))
      G.push(cgeo(new IcosahedronGeometry(0.22 * k, 1), i % 2 ? '#3affd0' : '#ff5fd2', ox, y + h, z))
    }
  },
  meteor(B, G, x, y, z, k) {
    B.push(cgeo(new IcosahedronGeometry(1.0 * k, 0), '#3a3448', x, y + 0.5 * k, z, 0.4, 0.3, 0, 1.2, 0.8, 1))
    G.push(cbox(0.06, 0.9 * k, 0.06, '#b04aff', x + 0.3, y + 0.6 * k, z + 0.75 * k, 0, 0, 0.6))
    G.push(cbox(0.06, 0.7 * k, 0.06, '#3affff', x - 0.3, y + 0.5 * k, z + 0.75 * k, 0, 0, -0.5))
  },
}
const ROCKS = { meadow: '#a7adb8', farm: '#b8a080', lake: '#9aa1ad', desert: '#d9a06a', snow: '#e0ecf4', autumn: '#a89080', crystal: '#7a8ab0', beach: '#e8d0a8', reef: '#8ab0c0', heaven: '#ffffff', lava: '#2a2224', cosmic: '#4a4060' }

// A sign board for an area: its number, name and colours, painted once.
function areaSign(zone, i) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 256
  const x = c.getContext('2d')
  const g = x.createLinearGradient(0, 0, 0, 256)
  g.addColorStop(0, zone.banner[0])
  g.addColorStop(1, zone.banner[1])
  x.fillStyle = g
  x.beginPath()
  x.roundRect(8, 8, 496, 240, 36)
  x.fill()
  x.lineWidth = 12
  x.strokeStyle = '#ffffff'
  x.stroke()
  x.textAlign = 'center'
  x.lineJoin = 'round'
  x.font = '700 46px Fredoka, "Arial Black", sans-serif'
  x.strokeStyle = 'rgba(0,0,0,0.55)'
  x.lineWidth = 10
  x.strokeText(`AREA ${i + 1}`, 256, 82)
  x.fillStyle = '#ffffff'
  x.fillText(`AREA ${i + 1}`, 256, 82)
  const name = zone.name.toUpperCase()
  x.font = `700 ${name.length > 12 ? 62 : 72}px Fredoka, "Arial Black", sans-serif`
  x.lineWidth = 14
  x.strokeText(name, 256, 178)
  x.fillStyle = zone.text
  x.fillText(name, 256, 178)
  const t = new CanvasTexture(c)
  t.colorSpace = SRGBColorSpace
  t.anisotropy = 4
  return t
}

function makeLaneEdges(root, lane) {
  const rand = mulberry32(404)
  const W = lane.halfWidth
  const Y = lane.floorY
  const B = []
  const G = []
  for (const side of [-1, 1]) {
    for (let z = lane.start - 4; z > lane.end + 3; z -= 3 + rand() * 5.5) {
      const zone = zoneAt(Math.min(z, lane.throwLine - 0.5)) ?? HUB.zones[0]
      const r = rand()
      const isRock = r > 0.82
      const kind = isRock ? 'rock' : zone.cover[Math.floor(rand() * zone.cover.length)]
      const x = side * (W - 0.8 - rand() * 0.9)
      const k = 0.7 + rand() * 0.6
      if (isRock) {
        const c = ROCKS[zone.id] ?? '#a7adb8'
        B.push(cbox(0.9 * k, 0.7 * k, 0.8 * k, c, x, Y + 0.35 * k, z, 0, rand(), 0))
        B.push(cbox(0.45 * k, 0.4 * k, 0.5 * k, tintHex(c, -0.08), x + 0.5 * k, Y + 0.2 * k, z + 0.5, 0, rand(), 0))
      } else {
        PROPS[kind](B, G, x, Y, z, k, rand)
        laneCover.push({ x, z, side, y: Y, zone: zone.index })
      }
    }
  }
  // Floor accents for the wilder areas: lava channels and cracks, star specks, crystal glints,
  // a golden path through the clouds.
  for (const zone of HUB.zones) {
    const z0 = Math.min(zone.from, lane.throwLine - 1)
    const z1 = Math.max(zone.to, lane.end + 1)
    const len = z0 - z1
    if (zone.id === 'lava') {
      for (const sx of [-1, 1]) {
        G.push(cbox(0.9, 0.05, len - 1, '#ff6a1a', sx * (W - 2.9), Y + 0.03, (z0 + z1) / 2))
        G.push(cbox(0.4, 0.06, len - 1, '#ffcc33', sx * (W - 2.9), Y + 0.04, (z0 + z1) / 2))
      }
      for (let i = 0; i < 26; i++) G.push(cbox(0.12, 0.05, 1.2 + rand() * 2.2, rand() < 0.5 ? '#ff5a1a' : '#ff8a2a', (rand() - 0.5) * (W * 2 - 8), Y + 0.03, z1 + rand() * len, 0, rand() * Math.PI, 0))
    } else if (zone.id === 'cosmic') {
      for (let i = 0; i < 70; i++) G.push(cbox(0.14, 0.04, 0.14, ['#ffffff', '#b07cff', '#3affff'][i % 3], (rand() - 0.5) * (W * 2 - 3), Y + 0.03, z1 + rand() * len, 0, rand(), 0))
    } else if (zone.id === 'crystal') {
      for (let i = 0; i < 40; i++) G.push(cgeo(new ConeGeometry(0.08, 0.3, 4), ['#7ae8ff', '#c8a0ff', '#ff9bd2'][i % 3], (rand() - 0.5) * (W * 2 - 4), Y + 0.12, z1 + rand() * len))
    } else if (zone.id === 'heaven') {
      for (let z = z0 - 1; z > z1; z -= 2.2) G.push(cbox(2.4, 0.04, 0.9, '#ffe680', 0, Y + 0.03, z))
    }
  }
  // Area boundaries: a glowing line across the floor and a name sign by each wall.
  const signMats = []
  HUB.zones.forEach((zone, i) => {
    const z = i === 0 ? lane.throwLine - 9 : zone.from
    if (i > 0) {
      G.push(cbox(W * 2 - 0.4, 0.06, 0.5, zone.banner[0], 0, Y + 0.04, z))
      for (let s = -W + 1; s < W; s += 2) G.push(cbox(0.5, 0.08, 0.5, '#ffffff', s, Y + 0.05, z - 0.5))
    }
    const mat = new MeshStandardMaterial({ map: areaSign(zone, i), roughness: 0.6, emissive: '#ffffff', emissiveMap: null, emissiveIntensity: 0 })
    mat.emissiveMap = mat.map
    mat.emissiveIntensity = 0.35
    signMats.push(mat)
    for (const side of [-1, 1]) {
      const x = side * (W - 1.1)
      B.push(cbox(0.4, 5.2, 0.4, zone.banner[1], x, Y + 2.6, z))
      B.push(cbox(0.7, 0.3, 0.7, zone.banner[0], x, Y + 0.15, z))
      G.push(cgeo(new IcosahedronGeometry(0.28, 1), zone.banner[0], x, Y + 7.6, z))
      const board = new Mesh(new PlaneGeometry(4.4, 2.2), mat)
      board.position.set(x - side * 0.2, Y + 6.1, z + 0.25)
      board.rotation.y = -side * 0.55
      root.add(board)
      const back = new Mesh(new BoxGeometry(4.6, 2.4, 0.18), new MeshStandardMaterial({ color: zone.banner[1], roughness: 0.7 }))
      back.position.copy(board.position)
      back.rotation.y = board.rotation.y
      back.translateZ(-0.1)
      back.castShadow = true
      root.add(back)
    }
  })
  const body = new Mesh(merge(B), new MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }))
  body.castShadow = true
  body.receiveShadow = true
  const glowMesh = new Mesh(merge(G), new MeshBasicMaterial({ vertexColors: true, color: new Color(1.8, 1.8, 1.8) }))
  root.add(body, glowMesh)
}

const tcol = new Color()
const tintHex = (hex, k) => '#' + tcol.set(hex).offsetHSL(0, 0, k).getHexString()

// The tops of the lane cliffs: tall wheat-coloured grass fringing both edges and beds of
// lavender and pink flowers a little further back.
function makeRimCrops(root, lane, W1, W2, nz1, nz2, d1) {
  const rand = mulberry32(808)
  const blade = new BoxGeometry(0.16, 1, 0.16)
  blade.translate(0, 0.5, 0)
  const count = 3200
  const wheat = new InstancedMesh(blade, new MeshStandardMaterial({ color: '#ffffff', roughness: 0.8 }), count)
  const maxF = 1000
  const flower = new InstancedMesh(new BoxGeometry(0.5, 0.5, 0.5), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.7 }), maxF)
  const o = new Object3D()
  const c = new Color()
  const golds = ['#e8c64a', '#f0d35c', '#d9b43a', '#c9d84a']
  const purples = ['#a77cf0', '#b88cff', '#9466e0', '#ff8fd0']
  let i = 0
  let f = 0
  const fringe = (x0, x1, z0, z1, y, n) => {
    for (let k = 0; k < n && i < count; k++) {
      // Clumps: a few blades round one root.
      const cx = x0 + rand() * (x1 - x0)
      const cz = z0 + rand() * (z1 - z0)
      for (let b = 0; b < 4 && i < count; b++) {
        o.position.set(cx + (rand() - 0.5) * 0.6, y, cz + (rand() - 0.5) * 0.6)
        o.rotation.set((rand() - 0.5) * 0.35, rand() * 3, (rand() - 0.5) * 0.35)
        o.scale.set(1, 0.7 + rand() * 0.9, 1)
        o.updateMatrix()
        wheat.setMatrixAt(i, o.matrix)
        wheat.setColorAt(i++, c.set(golds[Math.floor(rand() * golds.length)]))
      }
    }
  }
  const beds = (x0, x1, z0, z1, y, n) => {
    for (let k = 0; k < n && f < maxF; k++) {
      o.position.set(x0 + rand() * (x1 - x0), y + 0.2, z0 + rand() * (z1 - z0))
      o.rotation.set(0, rand() * 3, 0)
      o.scale.set(0.8 + rand() * 0.8, 0.6 + rand() * 0.6, 0.8 + rand() * 0.8)
      o.updateMatrix()
      flower.setMatrixAt(f, o.matrix)
      flower.setColorAt(f++, c.set(purples[Math.floor(rand() * purples.length)]))
    }
  }
  const len = nz1 - lane.end
  for (const s of [-1, 1]) {
    const edge = (w, wide) => (s < 0 ? [-w - wide, -w] : [w, w + wide])
    const [a1, b1] = edge(W1, 1.6)
    fringe(a1, b1, lane.end, nz1, 7, Math.round(len / 1.0))
    const [a2, b2] = edge(W2, 1.6)
    fringe(a2, b2, lane.end - d1, nz2, 14, Math.round(len / 1.5))
    const [a3, b3] = edge(W1 + 1.8, 4)
    beds(a3, b3, lane.end, nz1, 7, 280)
    const [a4, b4] = edge(W2 + 1.8, 5)
    beds(a4, b4, lane.end, nz2, 14, 200)
  }
  wheat.count = i
  flower.count = f
  root.add(wheat, flower)
}

export function buildHub(scene) {
  const root = new Group()
  scene.add(root)
  const { minX, maxX, minZ, maxZ, lane } = HUB
  const [d1, d2] = HUB.tierDepth

  // --- Floor ---
  const grass = studMaterial('#6fdc3c', '#63d132', { seed: 3 })
  const floor = new Mesh(flat(minX, maxX, lane.start, maxZ, 0, HUB.studTile), grass)
  floor.receiveShadow = true
  root.add(floor)
  const dropZ = lane.throwLine - 0.4 // the hub edge: the lane floor is lane.floorY below from here north
  addFixed(RAPIER.ColliderDesc.cuboid(700, 1, 350), { x: 0, y: -1, z: dropZ + 350 }, null, { friction: 0.9 })
  addFixed(RAPIER.ColliderDesc.cuboid(700, 1, 350), { x: 0, y: lane.floorY - 1, z: dropZ - 350 }, null, { friction: 0.9 })

  // --- Road (east-west), running right past the lane mouth ---
  const road = roadMaps()
  const roadMat = new MeshStandardMaterial({ map: tex(road.color), normalMap: tex(road.normal, { srgb: false }), normalScale: new Vector2(0.5, 0.5), roughness: 0.8 })
  const R = HUB.road
  const roadGeo = flat(R.minX, R.maxX, R.z - R.halfWidth, R.z + R.halfWidth, 0.02, 4)
  const roadMesh = new Mesh(roadGeo, roadMat)
  roadMesh.receiveShadow = true
  root.add(roadMesh)
  // White dashes along both road edges.
  const dashes = []
  for (let x = R.minX + 1; x < R.maxX - 1; x += 3) {
    for (const s of [-1, 1]) dashes.push(flat(x, x + 1.6, R.z + s * (R.halfWidth - 0.35) - 0.12, R.z + s * (R.halfWidth - 0.35) + 0.12, 0.04, 4))
  }
  root.add(new Mesh(merge(dashes), new MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })))

  // --- Lane floor: one coloured stud zone after another ---
  for (const z of HUB.zones) {
    const mat = studMaterial(z.color, z.alt, { seed: 7 })
    const parts = []
    if (z.from > dropZ) parts.push(flat(-lane.halfWidth, lane.halfWidth, Math.max(z.to, dropZ), z.from, 0, HUB.studTile))
    if (z.to < dropZ) parts.push(flat(-lane.halfWidth, lane.halfWidth, z.to, Math.min(z.from, dropZ), lane.floorY, HUB.studTile))
    const m = new Mesh(parts.length > 1 ? merge(parts) : parts[0], mat)
    m.receiveShadow = true
    root.add(m)
  }

  // --- Cliffs: tier 1 (0..T) and tier 2 (T..2T), lane walls through the north side ---
  const lists = { sides: [], tops: [] }
  const W1 = lane.halfWidth
  const ox1 = maxX + d1
  const oz1 = maxZ + d1
  const nz1 = minZ - d1
  // Tier 1.
  addBlock(lists, -ox1, ox1, maxZ, oz1, 0, T)
  addBlock(lists, -ox1, minX, nz1, maxZ, 0, T)
  addBlock(lists, maxX, ox1, nz1, maxZ, 0, T)
  addBlock(lists, minX, -W1, nz1, minZ, 0, T)
  addBlock(lists, W1, maxX, nz1, minZ, 0, T)
  addBlock(lists, -W1 - d1, -W1, lane.end, nz1, 0, T)
  addBlock(lists, W1, W1 + d1, lane.end, nz1, 0, T)
  addBlock(lists, -W1 - d1, W1 + d1, lane.end - d1, lane.end, 0, T)
  // Tier 2.
  const ox2 = ox1 + d2
  const oz2 = oz1 + d2
  const nz2 = nz1 - d2
  const W2 = W1 + d1
  addBlock(lists, -ox2, ox2, oz1, oz2, T, 2 * T)
  addBlock(lists, -ox2, -ox1, nz2, oz1, T, 2 * T)
  addBlock(lists, ox1, ox2, nz2, oz1, T, 2 * T)
  addBlock(lists, -ox1, -W2, nz2, nz1, T, 2 * T)
  addBlock(lists, W2, ox1, nz2, nz1, T, 2 * T)
  addBlock(lists, -W2 - d2, -W2, lane.end - d1, nz2, T, 2 * T)
  addBlock(lists, W2, W2 + d2, lane.end - d1, nz2, T, 2 * T)
  addBlock(lists, -W2 - d2, W2 + d2, lane.end - d1 - d2, lane.end - d1, T, 2 * T)
  // The canyon below hub level: plain dirt skirts under both lane walls, the far end, and the
  // sheer drop face under the throw band.
  const skirt = { sides: [], tops: [] }
  addBlock(skirt, -W1 - d1, -W1, lane.end - d1, dropZ, lane.floorY, 0, false)
  addBlock(skirt, W1, W1 + d1, lane.end - d1, dropZ, lane.floorY, 0, false)
  addBlock(skirt, -W1, W1, lane.end - d1, lane.end, lane.floorY, 0, false)
  addBlock(skirt, -W1, W1, dropZ - 0.01, dropZ + 1.2, lane.floorY, 0, false)
  const skirtMesh = new Mesh(merge(skirt.sides), dirtMaterial())
  skirtMesh.receiveShadow = true
  root.add(skirtMesh)
  for (const g of skirt.tops) g.dispose()
  const cliffSides = new Mesh(merge(lists.sides), cliffMaterial())
  cliffSides.receiveShadow = true
  cliffSides.castShadow = true
  const tops = new Mesh(merge(lists.tops), grass)
  tops.receiveShadow = true
  root.add(cliffSides, tops)

  // The plateau beyond tier 2, out to the horizon (top faces only, no collision needed).
  const far = 700
  const fx = W2 + d2
  const plateau = merge([
    flat(-far, far, oz2, far, 2 * T, HUB.studTile),
    flat(-far, -ox2, -far, oz2, 2 * T, HUB.studTile),
    flat(ox2, far, -far, oz2, 2 * T, HUB.studTile),
    flat(-ox2, ox2, -far, lane.end - d1 - d2, 2 * T, HUB.studTile),
    flat(-ox2, -fx, lane.end - d1 - d2, nz2, 2 * T, HUB.studTile),
    flat(fx, ox2, lane.end - d1 - d2, nz2, 2 * T, HUB.studTile),
  ])
  root.add(new Mesh(plateau, grass))

  // --- Flora on the terraces ---
  const rand = mulberry32(5)
  const spots = []
  const ring1 = (n, x0, x1, z0, z1, y) => {
    for (let i = 0; i < n; i++) spots.push([x0 + rand() * (x1 - x0), y, z0 + rand() * (z1 - z0)])
  }
  // Tier 1 tops: a row near the outer half so the cliff edge stays clear.
  ring1(14, -ox1 + 2, ox1 - 2, maxZ + d1 * 0.45, oz1 - 2, T)
  ring1(7, -ox1 + 2, minX - d1 * 0.4, minZ, maxZ, T)
  ring1(7, maxX + d1 * 0.4, ox1 - 2, minZ, maxZ, T)
  ring1(6, minX, -W1 - 4, nz1 + 2, minZ - d1 * 0.4, T)
  ring1(6, W1 + 4, maxX, nz1 + 2, minZ - d1 * 0.4, T)
  // The lane rims: a dense row of trees right along both cliff edges, a few further back.
  for (const side of [-1, 1]) {
    for (let z = nz1 - 2; z > lane.end + 4; z -= 7 + rand() * 4) spots.push([side * (W1 + 2.6 + rand() * 1.6), T, z])
    ring1(14, side < 0 ? -W1 - d1 + 2 : W1 + 6, side < 0 ? -W1 - 6 : W1 + d1 - 2, lane.end, nz1, T)
  }
  // Tier 2 tops.
  ring1(18, -ox2 + 2, ox2 - 2, oz1 + 3, oz2 - 2, 2 * T)
  ring1(10, -ox2 + 2, -ox1 - 3, nz2, oz1, 2 * T)
  ring1(10, ox1 + 3, ox2 - 2, nz2, oz1, 2 * T)
  ring1(12, -ox1, -W2 - 3, nz2 + 2, nz1 - 3, 2 * T)
  ring1(12, W2 + 3, ox1, nz2 + 2, nz1 - 3, 2 * T)
  for (const side of [-1, 1]) {
    for (let z = nz2 - 2; z > lane.end - d1 + 4; z -= 8 + rand() * 5) spots.push([side * (W2 + 2.8 + rand() * 2), 2 * T, z])
    ring1(16, side < 0 ? -W2 - d2 + 2 : W2 + 7, side < 0 ? -W2 - 7 : W2 + d2 - 2, lane.end, nz2, 2 * T)
  }
  makeFlora(root, spots)
  makeFlowers(root, (r) => {
    const side = r() < 0.5 ? -1 : 1
    return [side * (W1 + 1 + r() * (d1 - 2)), T, lane.end + r() * (nz1 - lane.end)]
  }, 160, 31)
  makeFlowers(root, (r) => [-ox1 + r() * ox1 * 2, T, maxZ + 1 + r() * (d1 - 2)], 60, 32)
  makeLaneEdges(root, lane)
  makeRimCrops(root, lane, W1, W2, nz1, nz2, d1)

  const clouds = makeClouds()
  scene.add(clouds)

  return {
    root,
    treeSpots: spots,
    update(dt) {
      for (const c of clouds.children) {
        c.position.x += c.userData.speed * dt
        if (c.position.x > 520) c.position.x = -520
      }
    },
  }
}
