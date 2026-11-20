// Portrait images of 3D models for the UI (Index cards, shop rows, the right-side
// button): a small offscreen renderer draws the model under studio lights to a
// canvas and keeps the data URL. Made lazily the first time a window needs one.
import { ACESFilmicToneMapping, AmbientLight, Box3, DirectionalLight, MeshBasicMaterial, PerspectiveCamera, Scene, SRGBColorSpace, Vector3, WebGLRenderer } from 'three'
import { portraitModel } from '../game/baddieModel.js'
import { foodMesh } from '../game/foods.js'

let renderer = null
let scene = null
let camera = null
const cache = new Map()

function setup() {
  if (renderer) return true
  try {
    renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true })
  } catch {
    return false
  }
  renderer.setSize(192, 192, false)
  renderer.setPixelRatio(1)
  renderer.outputColorSpace = SRGBColorSpace
  renderer.toneMapping = ACESFilmicToneMapping
  renderer.toneMappingExposure = 1.15
  renderer.setClearColor(0x000000, 0)
  scene = new Scene()
  scene.add(new AmbientLight('#ffffff', 1.4))
  const key = new DirectionalLight('#ffffff', 2.6)
  key.position.set(2, 3, 4)
  const rim = new DirectionalLight('#bcd6ff', 1.4)
  rim.position.set(-3, 2, -2)
  scene.add(key, rim)
  camera = new PerspectiveCamera(30, 1, 0.1, 100)
  return true
}

const box = new Box3()
const centre = new Vector3()
const size = new Vector3()
function shoot(obj, { headOnly = false, yaw = 0.35 } = {}) {
  if (!setup()) return ''
  obj.rotation.y = yaw
  scene.add(obj)
  obj.updateMatrixWorld(true)
  box.setFromObject(obj)
  box.getCenter(centre)
  box.getSize(size)
  if (headOnly) {
    // Frame the top 45 % (head and shoulders).
    centre.y = box.max.y - size.y * 0.24
    size.y *= 0.5
  }
  const r = Math.max(size.x, size.y, size.z) * 0.55
  const dist = r / Math.tan((camera.fov * Math.PI) / 360) + r * 0.4
  camera.position.set(centre.x + dist * 0.12, centre.y + r * 0.15, centre.z + dist)
  camera.lookAt(centre)
  renderer.render(scene, camera)
  const url = renderer.domElement.toDataURL('image/png')
  scene.remove(obj)
  return url
}

export function baddiePortrait(id, sizeIdx = 0, headOnly = false, variant = 0) {
  const key = `b|${id}|${sizeIdx}|${headOnly}|${variant | 0}`
  if (!cache.has(key)) {
    const b = portraitModel(id, 0, variant | 0)
    if (headOnly) b.mode = 'idle'
    cache.set(key, shoot(b.group, { headOnly }))
  }
  return cache.get(key)
}

export function foodPortrait(id) {
  const key = `f|${id}`
  if (!cache.has(key)) {
    // The display pose is baked into the model (game/foods.js); draw it bigger for the shop cards.
    if (setup()) renderer.setSize(256, 256, false)
    const m = foodMesh(id)
    const url = shoot(m, { yaw: 0 })
    renderer?.setSize(192, 192, false)
    cache.set(key, url)
  }
  return cache.get(key)
}

// --- Index portraits -----------------------------------------------------------------------
// A girl's bust (head and shoulders, framed on her head so wings and staffs never shrink it)
// in colour, or as a flat black silhouette for the girls you have not found yet. Drawn at
// 256 px. indexPortrait() returns a cached URL or null; queuePortrait() draws it a few per
// frame and calls back, so opening the Index never stalls on 120 renders.
const black = new MeshBasicMaterial({ color: '#0a0610' })
const headBox = new Box3()
function shootBust(id, silhouette) {
  if (!setup()) return ''
  const b = portraitModel(id, 0)
  const obj = b.group
  obj.rotation.y = 0.32
  scene.add(obj)
  obj.updateMatrixWorld(true)
  headBox.setFromObject(b.head.children[0])
  headBox.getCenter(centre)
  headBox.getSize(size)
  centre.y -= size.y * 0.22
  const r = Math.max(size.x, size.y) * 0.95
  const dist = r / Math.tan((camera.fov * Math.PI) / 360)
  camera.position.set(centre.x + dist * 0.08, centre.y + r * 0.12, centre.z + dist)
  camera.lookAt(centre)
  renderer.setSize(256, 256, false)
  scene.overrideMaterial = silhouette ? black : null
  renderer.render(scene, camera)
  scene.overrideMaterial = null
  const url = renderer.domElement.toDataURL('image/png')
  renderer.setSize(192, 192, false)
  scene.remove(obj)
  return url
}
export function indexPortrait(id, silhouette = false) {
  return cache.get(`ix|${id}|${silhouette}`) ?? null
}
const queue = []
let pumping = false
export function queuePortrait(id, silhouette, done) {
  const key = `ix|${id}|${silhouette}`
  if (cache.has(key)) return done(cache.get(key))
  queue.push({ key, id, silhouette, done })
  if (!pumping) {
    pumping = true
    requestAnimationFrame(pump)
  }
}
function pump() {
  const t0 = performance.now()
  while (queue.length && performance.now() - t0 < 12) {
    const q = queue.shift()
    if (!cache.has(q.key)) cache.set(q.key, shootBust(q.id, q.silhouette))
    q.done(cache.get(q.key))
  }
  if (queue.length) requestAnimationFrame(pump)
  else pumping = false
}
