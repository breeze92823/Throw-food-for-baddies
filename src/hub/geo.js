// Geometry helpers for the lego world: blocks and quads with world-space UVs (so
// stud textures line up across neighbouring pieces), and vertex-coloured boxes
// that merge into one mesh per part (characters, small props).
import { BoxGeometry, BufferGeometry, Color, CylinderGeometry, Euler, Float32BufferAttribute, Matrix4, Quaternion, Vector3 } from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// One axis-aligned block from (x0, y0, z0) to (x1, y1, z1). Returns { sides, top } geometries:
// sides UV: u = run along the face / sideTile, v = (y - y0) / sideH; top UV: world x, z / topTile.
export function block(x0, x1, z0, z1, y0, y1, { sideTile = 16, sideH = y1 - y0, topTile = 4 } = {}) {
  const sp = []
  const sn = []
  const su = []
  const quad = (a, b, c, d, n, uv) => {
    // a b c d counter-clockwise seen from outside.
    for (const i of [0, 1, 2, 0, 2, 3]) {
      const p = [a, b, c, d][i]
      sp.push(...p)
      sn.push(...n)
      su.push(...uv[i])
    }
  }
  const v0 = 0
  const v1 = (y1 - y0) / sideH
  // North face (-Z), seen from -Z: x runs from x1 to x0 left to right.
  quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[-x1 / sideTile, v0], [-x0 / sideTile, v0], [-x0 / sideTile, v1], [-x1 / sideTile, v1]])
  // South face (+Z).
  quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[x0 / sideTile, v0], [x1 / sideTile, v0], [x1 / sideTile, v1], [x0 / sideTile, v1]])
  // West face (-X).
  quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[z0 / sideTile, v0], [z1 / sideTile, v0], [z1 / sideTile, v1], [z0 / sideTile, v1]])
  // East face (+X).
  quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[-z1 / sideTile, v0], [-z0 / sideTile, v0], [-z0 / sideTile, v1], [-z1 / sideTile, v1]])
  const sides = new BufferGeometry()
  sides.setAttribute('position', new Float32BufferAttribute(sp, 3))
  sides.setAttribute('normal', new Float32BufferAttribute(sn, 3))
  sides.setAttribute('uv', new Float32BufferAttribute(su, 2))
  return { sides, top: flat(x0, x1, z0, z1, y1, topTile) }
}

// A flat quad facing up from (x0, z0) to (x1, z1) at height y, UVs in world metres / tile.
export function flat(x0, x1, z0, z1, y, tile = 4) {
  const g = new BufferGeometry()
  const p = [x0, y, z1, x1, y, z1, x1, y, z0, x0, y, z1, x1, y, z0, x0, y, z0]
  const uv = [x0, -z1, x1, -z1, x1, -z0, x0, -z1, x1, -z0, x0, -z0].map((v) => v / tile)
  g.setAttribute('position', new Float32BufferAttribute(p, 3))
  g.setAttribute('normal', new Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3))
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2))
  return g
}

export function merge(list) {
  const out = mergeGeometries(list.filter(Boolean))
  for (const g of list) g?.dispose()
  return out
}

// --- Vertex-coloured parts --------------------------------------------------------------
const m4 = new Matrix4()
const q = new Quaternion()
const e = new Euler()
const one = new Vector3(1, 1, 1)
const pos = new Vector3()
const col = new Color()

function colorize(g, color, shadeTop = 0.06) {
  const n = g.attributes.position.count
  const c = new Float32Array(n * 3)
  col.set(color)
  const normals = g.attributes.normal
  for (let i = 0; i < n; i++) {
    // A touch of baked light: tops brighter, bottoms darker (reads well on tiny parts).
    const ny = normals.getY(i)
    const k = 1 + ny * shadeTop
    c[i * 3] = Math.min(1, col.r * k)
    c[i * 3 + 1] = Math.min(1, col.g * k)
    c[i * 3 + 2] = Math.min(1, col.b * k)
  }
  g.setAttribute('color', new Float32BufferAttribute(c, 3))
  return g
}

function place(g, x, y, z, rx = 0, ry = 0, rz = 0) {
  e.set(rx, ry, rz)
  q.setFromEuler(e)
  pos.set(x, y, z)
  m4.compose(pos, q, one)
  g.applyMatrix4(m4)
  return g
}

// Box w x h x d centred at (x, y, z), rotated by (rx, ry, rz), coloured.
export function cbox(w, h, d, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) {
  const g = new BoxGeometry(w, h, d).toNonIndexed()
  g.deleteAttribute('uv')
  return place(colorize(g, color), x, y, z, rx, ry, rz)
}

// Cylinder (radius top/bottom, height) along Y, centred at (x, y, z).
export function ccyl(rt, rb, h, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, seg = 12) {
  const g = new CylinderGeometry(rt, rb, h, seg).toNonIndexed()
  g.deleteAttribute('uv')
  return place(colorize(g, color, 0.1), x, y, z, rx, ry, rz)
}

// Any geometry, coloured and placed (cones, tori, spheres...).
export function cgeo(geometry, color, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1) {
  const g = (geometry.index ? geometry.toNonIndexed() : geometry).clone()
  g.deleteAttribute('uv')
  if (sx !== 1 || sy !== 1 || sz !== 1) g.scale(sx, sy, sz)
  return place(colorize(g, color, 0.1), x, y, z, rx, ry, rz)
}
