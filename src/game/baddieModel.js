// The girls: blocky lego-style figures with big glossy anime eyes, built from vertex-coloured
// boxes merged into one mesh per limb (head, torso, two arms, two legs) plus optional wings,
// a tail, shiny trim and glowing bits. Each look (config.js BADDIES) picks a hair style and
// highlight colour, an outfit (skirt, dress, gown, kimono, overalls, pants, shorts, space suit,
// armour or a mermaid tail), a hat or ears, eyewear, neckwear, wings, a tail and an item she
// holds. A Baddie animates itself from a mode its owner sets: walk / idle / dance / cheer /
// eat / fly, plus the "appeal" moves her pen uses to charm the player (wave, blow a kiss,
// heart hands, twirl, peace pose, shy sway, curtsy). Those raise one-frame cues (takeCue())
// the owner turns into hearts, sparkles and sounds. Her face texture swaps for blinks, the
// kiss wink, heart eyes and a shy look.
import { AdditiveBlending, CanvasTexture, Color, ConeGeometry, DoubleSide, Group, IcosahedronGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, RingGeometry, Sprite, SRGBColorSpace, TorusGeometry } from 'three'
import { BADDIES, RARITIES, SEASON_GIRLS, SIZES, VARIANTS } from '../config.js'
import { label } from '../propkit.js'
import { cbox, ccyl, cgeo, merge } from '../hub/geo.js'
import { paintFace } from '../hub/paint.js'
import { fmt } from './format.js'

export const BY_ID = Object.fromEntries([...BADDIES, ...SEASON_GIRLS].map((b) => [b.id, b]))
const bodyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.58, metalness: 0 })
const shinyMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.22, metalness: 0.7 })
const glowMat = new MeshBasicMaterial({ vertexColors: true, color: new Color(1.7, 1.7, 1.7) }) // HDR: blooms where bloom is on
const sheerMat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, transparent: true, opacity: 0.62, side: DoubleSide, depthWrite: false })
const glassMat = new MeshStandardMaterial({ color: '#d8f4ff', roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.28, depthWrite: false })
const faceMats = new Map()
const partCache = new Map()

function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return h >>> 0
}
const tmpCol = new Color()
const tint = (hex, k) => '#' + tmpCol.set(hex).offsetHSL(0, 0, k).getHexString()
const pick = (a, b) => a ?? b
const ico = (r, d = 1) => new IcosahedronGeometry(r, d)

export function faceMaterial(eyes, style, mood = 'open') {
  const key = `${eyes}|${style}|${mood}`
  if (!faceMats.has(key)) {
    const t = new CanvasTexture(paintFace(eyes, style, mood))
    t.colorSpace = SRGBColorSpace
    faceMats.set(key, new MeshStandardMaterial({ map: t, emissiveMap: t, emissive: '#ffffff', emissiveIntensity: 0.35, transparent: true, alphaTest: 0.05, roughness: 0.4, polygonOffset: true, polygonOffsetFactor: -2 }))
  }
  return faceMats.get(key)
}

// ============================== Hair ==============================
// Head spans x +-0.42, y 0..0.8, z +-0.4 (local to the head pivot at the neck).
function hair(P, L, h) {
  const c = L.hair
  const c2 = L.hair2 ?? tint(c, 0.12)
  const dark = tint(c, -0.1)
  const s = L.hairStyle
  P.body.push(cbox(0.96, 0.3, 0.9, c, 0, 0.8, -0.02)) // cap
  P.body.push(cbox(0.9, 0.12, 0.84, dark, 0, 0.95, -0.04)) // crown shading
  P.body.push(cbox(0.94, 0.16, 0.14, c, 0, 0.7, 0.4)) // fringe
  // Bangs: seven strands, alternating length, every other one in the highlight colour.
  for (let i = -3; i <= 3; i++) {
    const long = (i + 3) % 2 === 0
    P.body.push(cbox(0.14, long ? 0.3 : 0.2, 0.1, long ? c : c2, i * 0.13, long ? 0.53 : 0.58, 0.43, 0.05, 0, i * 0.06))
  }
  if (h % 3 === 0) P.body.push(cbox(0.06, 0.28, 0.06, c, 0.04, 1.05, 0.05, -0.5, 0, -0.3)) // ahoge
  const shortBack = s === 'bob' || s === 'buns' || s === 'pixie' || s === 'curly'
  const back = s === 'pixie' ? 0.4 : shortBack ? 0.58 : s === 'ponytail' || s === 'sidetail' || s === 'braid' ? 0.5 : 1.3
  P.body.push(cbox(0.98, back, 0.2, c, 0, 0.82 - back / 2, -0.42))
  if (!shortBack && back > 1) P.body.push(cbox(0.9, 0.18, 0.18, c2, 0, 0.82 - back + 0.06, -0.44)) // tips
  const side = s === 'pixie' ? 0.4 : shortBack ? 0.66 : 0.92
  for (const x of [-0.5, 0.5]) {
    P.body.push(cbox(0.12, side, 0.62, c, x, 0.82 - side / 2, -0.05))
    if (s === 'bob') P.body.push(cbox(0.14, 0.1, 0.5, c2, x * 0.96, 0.82 - side, -0.02, 0, 0, x * 0.6)) // curled-in ends
  }
  switch (s) {
    case 'long':
    case 'wavy':
    case 'hime':
      for (const x of [-0.5, 0.5]) {
        P.body.push(cbox(0.16, 0.6, 0.24, c, x, -0.2, 0.18)) // locks over the shoulders
        P.body.push(cbox(0.16, 0.14, 0.24, c2, x, -0.54, 0.18))
      }
      if (s === 'wavy') for (let i = 0; i < 5; i++) P.body.push(cbox(0.24, 0.3, 0.14, i % 2 ? c2 : c, -0.4 + i * 0.2, -0.3 - (i % 2) * 0.12, -0.52, 0, 0, (i % 2 ? 1 : -1) * 0.2))
      if (s === 'hime') for (const x of [-0.36, 0.36]) P.body.push(cbox(0.14, 0.7, 0.12, c, x, 0.24, 0.42)) // sidelocks framing the face
      break
    case 'ponytail':
      P.body.push(cbox(0.3, 0.26, 0.3, L.hatColor ?? L.accent, 0, 0.72, -0.6))
      P.body.push(cbox(0.32, 0.8, 0.28, c, 0, 0.22, -0.74, 0.25))
      P.body.push(cbox(0.26, 0.3, 0.24, c2, 0, -0.26, -0.86, 0.35))
      break
    case 'sidetail':
      P.body.push(cbox(0.26, 0.24, 0.26, L.accent, 0.56, 0.78, -0.1))
      P.body.push(cbox(0.3, 0.9, 0.3, c, 0.72, 0.2, -0.12, 0, 0, -0.25))
      P.body.push(cbox(0.24, 0.3, 0.24, c2, 0.88, -0.36, -0.12, 0, 0, -0.45))
      break
    case 'twintails':
      for (const x of [-1, 1]) {
        P.body.push(cbox(0.22, 0.22, 0.22, L.accent, x * 0.56, 0.74, -0.1))
        P.body.push(cbox(0.32, 1.0, 0.32, c, x * 0.74, 0.2, -0.12, 0, 0, x * -0.22))
        P.body.push(cbox(0.26, 0.34, 0.26, c2, x * 0.9, -0.36, -0.12, 0, 0, x * -0.4))
      }
      break
    case 'buns':
      for (const x of [-0.3, 0.3]) {
        P.body.push(cgeo(ico(0.21), c, x, 1.02, -0.08))
        P.body.push(ccyl(0.18, 0.18, 0.06, c2, x, 0.9, -0.08, 0, 0, 0, 10))
      }
      break
    case 'braid':
      for (let i = 0; i < 6; i++) P.body.push(cbox(0.2, 0.2, 0.2, i % 2 ? c2 : c, 0.42 + (i % 2) * 0.06, 0.2 - i * 0.16, 0.18 + i * 0.02, 0, 0, 0.3))
      P.body.push(cbox(0.14, 0.08, 0.14, L.accent, 0.46, -0.78, 0.3))
      break
    case 'pixie':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        P.body.push(cgeo(new ConeGeometry(0.14, 0.32, 4), c, Math.cos(a) * 0.32, 0.98, Math.sin(a) * 0.3 - 0.05, Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7))
      }
      break
    case 'curly':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        P.body.push(cgeo(ico(0.17), i % 3 ? c : c2, Math.cos(a) * 0.48, 0.55 + Math.sin(i * 2.1) * 0.25, Math.sin(a) * 0.45 - 0.05))
      }
      break
    case 'fluffy':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        P.body.push(cgeo(ico(0.22), i % 2 ? c : c2, Math.cos(a) * 0.46, 0.85 + Math.sin(a * 2) * 0.08, Math.sin(a) * 0.44 - 0.04))
      }
      P.body.push(cgeo(ico(0.3), c, 0, 1.02, -0.05))
      break
  }
}

// ============================== Hats, ears, eyewear ==============================
function hat(P, L) {
  const c = L.hatColor
  const d = tint(c, -0.15)
  const B = P.body
  switch (L.hat) {
    case 'flower':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2
        B.push(cbox(0.14, 0.14, 0.06, c, 0.46 + Math.cos(a) * 0.11, 0.74 + Math.sin(a) * 0.11, 0.32))
      }
      B.push(cbox(0.1, 0.1, 0.08, '#ffcf33', 0.46, 0.74, 0.34))
      break
    case 'sunflower':
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2
        B.push(cbox(0.2, 0.08, 0.05, c, 0.46 + Math.cos(a) * 0.18, 0.86 + Math.sin(a) * 0.18, 0.28, 0, 0, a))
      }
      B.push(ccyl(0.12, 0.12, 0.07, '#6b3f22', 0.46, 0.86, 0.3, Math.PI / 2, 0, 0, 10))
      break
    case 'bow':
      B.push(cbox(0.3, 0.22, 0.1, c, -0.18, 1.0, 0.0, 0, 0, 0.4))
      B.push(cbox(0.3, 0.22, 0.1, c, 0.18, 1.0, 0.0, 0, 0, -0.4))
      B.push(cbox(0.12, 0.14, 0.12, d, 0, 1.0, 0.0))
      break
    case 'leafCrown':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        B.push(cbox(0.18, 0.08, 0.1, i % 3 === 0 ? c : '#5fbf4a', Math.cos(a) * 0.5, 0.92, Math.sin(a) * 0.46, 0, -a, 0.3))
      }
      break
    case 'strawHat':
    case 'sunHat': {
      const wide = L.hat === 'sunHat' ? 0.95 : 0.8
      B.push(ccyl(wide, wide, 0.05, c, 0, 0.98, -0.02, -0.08, 0, 0, 20))
      B.push(ccyl(0.48, 0.52, 0.3, c, 0, 1.12, -0.02, 0, 0, 0, 16))
      B.push(ccyl(0.53, 0.53, 0.09, L.accent === c ? '#ff5f8a' : L.accent, 0, 1.03, -0.02, 0, 0, 0, 16))
      if (L.hat === 'sunHat') for (let i = 0; i < 5; i++) B.push(cbox(0.1, 0.1, 0.05, '#ff8ac0', 0.42 + Math.cos(i * 1.26) * 0.08, 1.08 + Math.sin(i * 1.26) * 0.08, 0.42))
      break
    }
    case 'cowboy':
      B.push(ccyl(0.82, 0.82, 0.05, c, 0, 0.98, 0, 0, 0, 0, 20))
      for (const x of [-0.72, 0.72]) B.push(cbox(0.2, 0.18, 1.2, c, x, 1.06, 0, 0, 0, x * -0.9))
      B.push(cbox(0.66, 0.36, 0.6, c, 0, 1.18, 0))
      B.push(cbox(0.2, 0.1, 0.62, d, 0, 1.36, 0))
      B.push(cbox(0.68, 0.08, 0.62, '#3a2414', 0, 1.04, 0))
      break
    case 'beanie':
      B.push(cgeo(ico(0.52, 2), c, 0, 0.9, -0.02, 0, 0, 0, 1, 0.62, 1))
      B.push(ccyl(0.52, 0.52, 0.16, d, 0, 0.84, -0.02, 0, 0, 0, 16))
      B.push(cgeo(ico(0.13), '#ffffff', 0, 1.26, -0.02))
      break
    case 'earmuffs':
      B.push(cgeo(new TorusGeometry(0.52, 0.04, 6, 16, Math.PI), d, 0, 0.5, 0))
      for (const x of [-0.53, 0.53]) B.push(cgeo(ico(0.18), c, x, 0.45, 0))
      break
    case 'beret':
      B.push(ccyl(0.56, 0.5, 0.14, c, 0.08, 1.0, -0.02, 0, 0, -0.2, 18))
      B.push(cbox(0.06, 0.1, 0.06, d, 0.08, 1.1, -0.02))
      break
    case 'witch':
      B.push(ccyl(0.8, 0.8, 0.05, c, 0, 0.98, 0, 0, 0, 0, 18))
      B.push(ccyl(0.52, 0.52, 0.12, L.accent, 0, 1.04, 0, 0, 0, 0, 16))
      B.push(cgeo(new ConeGeometry(0.5, 0.9, 12), c, 0, 1.45, -0.05, -0.15, 0, 0))
      B.push(cgeo(new ConeGeometry(0.16, 0.36, 8), c, 0, 1.92, -0.25, -1.1, 0, 0))
      B.push(cbox(0.14, 0.14, 0.04, '#ffd23a', 0.2, 1.06, 0.5))
      break
    case 'mushroom':
      B.push(cgeo(ico(0.62, 2), c, 0, 0.98, -0.02, 0, 0, 0, 1.15, 0.55, 1.1))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.4
        B.push(cgeo(ico(0.1), '#ffffff', Math.cos(a) * 0.48, 1.12, Math.sin(a) * 0.44, 0, 0, 0, 1, 0.5, 1))
      }
      B.push(cgeo(ico(0.12), '#ffffff', 0, 1.3, 0, 0, 0, 0, 1, 0.5, 1))
      break
    case 'tiara':
      P.shiny.push(ccyl(0.47, 0.47, 0.06, c, 0, 0.9, -0.02, 0, 0, 0, 16))
      for (let i = -2; i <= 2; i++) P.shiny.push(cgeo(new ConeGeometry(0.05, 0.14 + (2 - Math.abs(i)) * 0.08, 4), c, i * 0.13, 1.0 + (2 - Math.abs(i)) * 0.04, 0.4))
      P.glow.push(cgeo(ico(0.06, 0), '#ff6fb8', 0, 1.0, 0.46))
      break
    case 'crown':
      P.shiny.push(ccyl(0.32, 0.3, 0.16, c, 0, 1.02, 0, 0, 0, 0, 12))
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2
        P.shiny.push(cgeo(new ConeGeometry(0.07, 0.22, 4), c, Math.cos(a) * 0.27, 1.18, Math.sin(a) * 0.27))
        P.glow.push(cgeo(ico(0.04, 0), i % 2 ? '#ff3b6b' : '#3ad0ff', Math.cos(a) * 0.31, 1.0, Math.sin(a) * 0.31))
      }
      break
    case 'halo':
      P.glow.push(cgeo(new TorusGeometry(0.36, 0.045, 8, 28), c, 0, 1.32, -0.05, Math.PI / 2 - 0.15))
      break
    case 'horns':
      for (const x of [-1, 1]) {
        B.push(cgeo(new ConeGeometry(0.1, 0.32, 8), c, x * 0.3, 1.08, 0.05, 0, 0, x * -0.5))
        B.push(cgeo(new ConeGeometry(0.06, 0.26, 8), c, x * 0.42, 1.28, 0.05, 0, 0, x * 0.2))
      }
      break
    case 'oniHorns':
      for (const x of [-1, 1]) B.push(cgeo(new ConeGeometry(0.08, 0.34, 6), c, x * 0.2, 1.08, 0.3, 0.2, 0, x * -0.15))
      break
    case 'catEars':
    case 'foxEars': {
      const big = L.hat === 'foxEars' ? 1.35 : 1
      for (const x of [-1, 1]) {
        B.push(cgeo(new ConeGeometry(0.18 * big, 0.36 * big, 4), c, x * 0.32, 1.06 + 0.06 * big, 0, 0, Math.PI / 4, x * -0.25))
        B.push(cgeo(new ConeGeometry(0.09 * big, 0.22 * big, 4), '#ffc8d8', x * 0.32, 1.04 + 0.06 * big, 0.07, 0, Math.PI / 4, x * -0.25))
      }
      break
    }
    case 'bunnyEars':
      for (const x of [-1, 1]) {
        B.push(cbox(0.16, 0.7, 0.1, c, x * 0.2, 1.3, -0.04, 0, 0, x * -0.15))
        B.push(cbox(0.08, 0.5, 0.04, '#ffc8d8', x * 0.2, 1.28, 0.02, 0, 0, x * -0.15))
      }
      break
    case 'dogEars':
    case 'cowEars':
      for (const x of [-1, 1]) {
        B.push(cbox(0.14, 0.36, 0.24, c, x * 0.56, 0.62, 0, 0, 0, x * 0.5))
        if (L.hat === 'cowEars') B.push(cgeo(new ConeGeometry(0.06, 0.18, 6), '#fff2c8', x * 0.26, 1.06, 0, 0, 0, x * -0.4))
      }
      break
    case 'ramHorns':
      for (const x of [-1, 1]) B.push(cgeo(new TorusGeometry(0.16, 0.07, 6, 12, Math.PI * 1.5), c, x * 0.52, 0.78, 0.04, 0, Math.PI / 2, 0))
      break
    case 'antlers':
      for (const x of [-1, 1]) {
        B.push(cbox(0.06, 0.4, 0.06, c, x * 0.26, 1.16, 0, 0, 0, x * -0.3))
        B.push(cbox(0.05, 0.2, 0.05, c, x * 0.42, 1.3, 0, 0, 0, x * -1.1))
        B.push(cbox(0.05, 0.18, 0.05, c, x * 0.32, 1.38, 0, 0, 0, x * 0.3))
      }
      break
    case 'antenna':
      for (const x of [-1, 1]) {
        B.push(cbox(0.04, 0.4, 0.04, c, x * 0.18, 1.16, 0.05, 0, 0, x * -0.35))
        P.glow.push(cgeo(ico(0.07), x > 0 ? c : tint(c, 0.15), x * 0.27, 1.36, 0.05))
      }
      break
    case 'lure':
      B.push(cbox(0.04, 0.5, 0.04, '#2a2a5a', 0, 1.2, 0.1, 0.5))
      B.push(cbox(0.04, 0.3, 0.04, '#2a2a5a', 0, 1.42, 0.38, 1.6))
      P.glow.push(cgeo(ico(0.1), c, 0, 1.36, 0.56))
      break
    case 'frogHood':
    case 'sharkHood':
    case 'bearHood':
      B.push(cbox(1.06, 0.4, 1.0, c, 0, 0.86, -0.04))
      for (const x of [-0.55, 0.55]) B.push(cbox(0.1, 0.8, 0.8, c, x, 0.5, -0.08))
      B.push(cbox(1.06, 0.9, 0.14, c, 0, 0.45, -0.5))
      if (L.hat === 'frogHood') for (const x of [-0.26, 0.26]) {
        B.push(cgeo(ico(0.16), c, x, 1.1, 0.24))
        B.push(cgeo(ico(0.09), '#ffffff', x, 1.12, 0.36))
        B.push(cgeo(ico(0.05), '#1a1a1a', x, 1.12, 0.43))
      }
      if (L.hat === 'sharkHood') {
        B.push(cgeo(new ConeGeometry(0.18, 0.45, 4), c, 0, 1.24, -0.12, -0.3))
        for (let i = -3; i <= 3; i++) B.push(cgeo(new ConeGeometry(0.04, 0.09, 4), '#ffffff', i * 0.12, 1.0, 0.48, Math.PI))
      }
      if (L.hat === 'bearHood') for (const x of [-0.36, 0.36]) B.push(cgeo(ico(0.15), c, x, 1.1, -0.04, 0, 0, 0, 1, 1, 0.6))
      break
    case 'headphones':
      B.push(cgeo(new TorusGeometry(0.52, 0.05, 6, 16, Math.PI), c, 0, 0.55, 0))
      for (const x of [-0.53, 0.53]) B.push(ccyl(0.17, 0.17, 0.14, c, x, 0.42, 0, 0, 0, Math.PI / 2))
      for (const x of [-0.61, 0.61]) P.glow.push(ccyl(0.1, 0.1, 0.02, '#3affff', x, 0.42, 0, 0, 0, Math.PI / 2))
      break
    case 'bandana':
      B.push(ccyl(0.5, 0.5, 0.16, c, 0, 0.84, -0.02, 0.1, 0, 0, 16))
      B.push(cbox(0.16, 0.16, 0.1, c, 0.3, 0.86, -0.48))
      B.push(cbox(0.1, 0.3, 0.06, c, 0.36, 0.7, -0.52, 0, 0, -0.4))
      break
    case 'veil':
      B.push(ccyl(0.5, 0.5, 0.08, L.accent, 0, 0.92, -0.02, 0, 0, 0, 16))
      B.push(cbox(1.04, 1.5, 0.06, c, 0, 0.2, -0.56, 0.08))
      P.glow.push(cgeo(ico(0.06, 0), '#3ad0ff', 0, 0.92, 0.5))
      break
    case 'pharaoh':
      B.push(cbox(1.04, 0.36, 0.96, c, 0, 0.86, -0.04))
      for (const x of [-0.56, 0.56]) for (let i = 0; i < 5; i++) B.push(cbox(0.14, 0.18, 0.5, i % 2 ? '#3a5aff' : c, x, 0.6 - i * 0.18, 0.02))
      B.push(cbox(0.3, 1.0, 0.14, c, 0, 0.3, -0.54))
      P.glow.push(cgeo(new ConeGeometry(0.07, 0.2, 4), '#3ad0ff', 0, 1.06, 0.48))
      break
    case 'comb':
      for (let i = -1; i <= 1; i++) B.push(cgeo(ico(0.12), c, i * 0.12, 1.08 + (1 - Math.abs(i)) * 0.06, 0.05))
      break
    case 'minerHat':
      B.push(cgeo(ico(0.54, 2), c, 0, 0.88, -0.02, 0, 0, 0, 1, 0.66, 1))
      B.push(ccyl(0.6, 0.6, 0.04, c, 0, 0.84, 0.04, 0, 0, 0, 16))
      P.glow.push(ccyl(0.12, 0.12, 0.08, '#fff6a0', 0, 1.04, 0.46, Math.PI / 2, 0, 0, 10))
      break
    case 'wingHelm':
      P.shiny.push(cgeo(ico(0.54, 2), c, 0, 0.86, -0.02, 0, 0, 0, 1, 0.7, 1))
      for (const x of [-1, 1]) for (let i = 0; i < 3; i++) B.push(cbox(0.06, 0.34 - i * 0.07, 0.1, '#ffffff', x * (0.56 + i * 0.07), 1.08 + i * 0.06, -0.1 - i * 0.08, 0, 0, x * (-0.5 - i * 0.2)))
      break
    case 'visor':
      B.push(ccyl(0.48, 0.48, 0.1, '#3a3a5a', 0, 0.86, -0.02, 0, 0, 0, 16))
      P.glow.push(cbox(0.8, 0.1, 0.04, c, 0, 0.62, 0.44))
      break
    case 'helmet':
      P.glass = ico(0.72, 2)
      P.glassAt = 0.45
      P.shiny.push(ccyl(0.56, 0.56, 0.12, '#e0e8f0', 0, -0.06, 0, 0, 0, 0, 16))
      break
    case 'starClip':
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2
        P.shiny.push(cgeo(new ConeGeometry(0.05, 0.16, 4), c, -0.5 + Math.cos(a) * 0.07, 0.75 + Math.sin(a) * 0.07, 0.25, 0, 0, a - Math.PI / 2))
      }
      break
  }
  switch (L.eyewear) {
    case 'glasses':
      for (const x of [-0.19, 0.19]) {
        B.push(cbox(0.26, 0.04, 0.03, L.eyewearColor, x, 0.52, 0.43))
        B.push(cbox(0.26, 0.04, 0.03, L.eyewearColor, x, 0.32, 0.43))
        B.push(cbox(0.04, 0.2, 0.03, L.eyewearColor, x - 0.12, 0.42, 0.43))
        B.push(cbox(0.04, 0.2, 0.03, L.eyewearColor, x + 0.12, 0.42, 0.43))
      }
      B.push(cbox(0.12, 0.03, 0.03, L.eyewearColor, 0, 0.48, 0.43))
      break
    case 'sunglasses':
      for (const x of [-0.19, 0.19]) B.push(cbox(0.28, 0.18, 0.04, '#1a1a24', x, 0.44, 0.43))
      B.push(cbox(0.86, 0.04, 0.04, L.eyewearColor, 0, 0.52, 0.43))
      break
    case 'goggles':
      B.push(ccyl(0.49, 0.49, 0.08, '#3a2a1a', 0, 0.84, -0.02, 0, 0, 0, 16))
      for (const x of [-0.17, 0.17]) {
        B.push(ccyl(0.13, 0.13, 0.08, L.eyewearColor, x, 0.86, 0.45, Math.PI / 2, 0, 0, 12))
        P.glow.push(ccyl(0.09, 0.09, 0.02, '#bfeaff', x, 0.86, 0.5, Math.PI / 2, 0, 0, 12))
      }
      break
  }
}

// ============================== Body ==============================
const LONG = new Set(['gown', 'kimono', 'mermaid'])
function legGeo(L) {
  const o = L.outfit
  const p = []
  const covered = o === 'pants' || o === 'suit' || o === 'overalls' || o === 'armor'
  const upper = covered || o === 'shorts' ? (o === 'suit' ? L.top : L.bottom) : L.skin
  const lower = covered ? (o === 'suit' ? L.top : L.bottom) : L.skin
  p.push(cbox(0.34, 0.44, 0.36, upper, 0, -0.24, 0)) // thigh
  p.push(cbox(0.32, 0.38, 0.33, lower, 0, -0.62, 0)) // shin
  if (o === 'armor') p.push(cbox(0.36, 0.3, 0.37, L.accent, 0, -0.62, 0.01))
  if (o === 'dress' || o === 'skirt' || o === 'gown' || o === 'kimono') p.push(cbox(0.34, 0.3, 0.35, o === 'skirt' ? '#ffffff' : L.accent, 0, -0.6, 0)) // knee socks
  if (o === 'shorts') p.push(cbox(0.36, 0.06, 0.38, L.accent, 0, -0.44, 0))
  p.push(cbox(0.36, 0.17, 0.46, L.shoes, 0, -0.84, 0.05)) // shoe
  p.push(cbox(0.37, 0.05, 0.47, '#ffffff', 0, -0.91, 0.05)) // sole
  p.push(cbox(0.3, 0.08, 0.14, tint(L.shoes, 0.12), 0, -0.78, 0.22)) // toe cap
  if (o === 'dress' || o === 'gown') p.push(cbox(0.16, 0.08, 0.06, L.accent, 0, -0.76, 0.29)) // shoe bow
  return merge(p)
}

function torsoGeo(L, P) {
  const o = L.outfit
  const t = P.torso
  const top = L.top
  const bot = L.bottom
  t.push(cbox(0.8, 0.46, 0.42, top, 0, 0.5, 0)) // chest
  t.push(cbox(0.86, 0.12, 0.4, top, 0, 0.7, 0)) // shoulders
  t.push(cbox(0.72, 0.24, 0.38, o === 'pants' || o === 'shorts' || o === 'overalls' ? bot : top, 0, 0.16, 0)) // waist
  t.push(cbox(0.26, 0.14, 0.26, L.skin, 0, 0.82, 0)) // neck
  t.push(cbox(0.42, 0.1, 0.04, L.accent, 0, 0.68, 0.21)) // collar trim
  switch (o) {
    case 'skirt':
      t.push(cbox(0.76, 0.06, 0.4, L.accent, 0, 0.27, 0)) // belt ribbon
      t.push(cbox(0.94, 0.2, 0.56, bot, 0, 0.0, 0))
      t.push(cbox(1.04, 0.16, 0.64, bot, 0, -0.16, 0))
      for (let i = -2; i <= 2; i++) t.push(cbox(0.04, 0.3, 0.02, tint(bot, -0.08), i * 0.2, -0.08, 0.33)) // pleats
      t.push(cbox(1.06, 0.05, 0.66, '#ffffff', 0, -0.25, 0))
      t.push(cbox(0.16, 0.12, 0.06, L.accent, 0, 0.48, 0.23)) // chest bow
      break
    case 'dress':
      t.push(cbox(0.76, 0.08, 0.4, L.accent, 0, 0.27, 0))
      t.push(cbox(0.94, 0.2, 0.56, bot, 0, 0.06, 0))
      t.push(cbox(1.06, 0.22, 0.66, bot, 0, -0.14, 0))
      t.push(cbox(1.16, 0.18, 0.74, bot, 0, -0.32, 0))
      t.push(cbox(1.18, 0.07, 0.76, L.accent, 0, -0.42, 0)) // frill
      for (const x of [-0.2, 0.2]) t.push(cbox(0.24, 0.16, 0.08, L.accent, x, 0.27, -0.24, 0, 0, x * 2)) // back bow
      t.push(cbox(0.18, 0.12, 0.06, L.accent, 0, 0.6, 0.23))
      break
    case 'gown':
      t.push(cbox(0.76, 0.08, 0.4, L.accent, 0, 0.27, 0))
      t.push(ccyl(0.42, 0.78, 1.0, bot, 0, -0.34, 0, 0, 0, 0, 14))
      t.push(ccyl(0.79, 0.8, 0.07, L.accent, 0, -0.82, 0, 0, 0, 0, 14))
      t.push(cbox(0.28, 0.9, 0.04, tint(bot, 0.15), 0, -0.34, 0.6, -0.36)) // front panel
      P.shiny.push(cgeo(ico(0.06, 0), L.accent, 0, 0.5, 0.23))
      break
    case 'kimono':
      for (const s of [-1, 1]) t.push(cbox(0.06, 0.5, 0.03, L.accent, s * 0.12, 0.5, 0.22, 0, 0, s * 0.45)) // wrap
      t.push(cbox(0.84, 0.24, 0.46, L.accent, 0, 0.24, 0)) // obi
      t.push(cbox(0.5, 0.3, 0.14, L.accent, 0, 0.26, -0.3)) // obi bow
      t.push(ccyl(0.42, 0.52, 0.98, bot, 0, -0.36, 0, 0, 0, 0, 12))
      for (let i = 0; i < 4; i++) t.push(cbox(0.1, 0.1, 0.04, '#ffffff', -0.2 + i * 0.16, -0.4 - (i % 2) * 0.24, 0.5)) // petals
      break
    case 'overalls':
      t.push(cbox(0.56, 0.32, 0.05, bot, 0, 0.44, 0.22)) // bib
      for (const x of [-0.24, 0.24]) {
        t.push(cbox(0.1, 0.36, 0.44, bot, x, 0.62, 0)) // straps
        t.push(cbox(0.08, 0.08, 0.04, '#ffd23a', x, 0.56, 0.25))
      }
      t.push(cbox(0.2, 0.14, 0.04, tint(bot, -0.1), 0, 0.42, 0.25)) // pocket
      break
    case 'pants':
    case 'shorts':
      t.push(cbox(0.76, 0.07, 0.42, '#3a2414', 0, 0.27, 0))
      t.push(cbox(0.14, 0.09, 0.04, '#ffd23a', 0, 0.27, 0.22))
      break
    case 'suit':
      t.push(cbox(0.4, 0.26, 0.05, '#3a3a5a', 0, 0.5, 0.22)) // chest panel
      for (let i = 0; i < 3; i++) P.glow.push(cbox(0.07, 0.07, 0.03, i === 1 ? '#ff5a5a' : L.accent, -0.12 + i * 0.12, 0.52, 0.25))
      t.push(cbox(0.76, 0.08, 0.42, L.accent, 0, 0.27, 0))
      t.push(cbox(0.56, 0.4, 0.2, '#e0e4ee', 0, 0.48, -0.3)) // backpack
      break
    case 'armor':
      P.shiny.push(cbox(0.84, 0.38, 0.46, L.accent, 0, 0.52, 0.0))
      P.shiny.push(cgeo(ico(0.08, 0), '#3ad0ff', 0, 0.54, 0.24))
      for (let i = 0; i < 5; i++) t.push(cbox(0.22, 0.34, 0.06, i % 2 ? bot : L.accent, -0.4 + i * 0.2, -0.04, 0.24))
      t.push(cbox(0.9, 0.3, 0.5, bot, 0, -0.02, -0.04))
      break
    case 'mermaid':
      t.push(cbox(0.76, 0.08, 0.42, L.accent, 0, 0.3, 0))
      for (let i = 0; i < 4; i++) t.push(cbox(0.2, 0.14, 0.04, tint(bot, 0.1 * (i % 2)), -0.3 + i * 0.2, 0.12, 0.2))
      break
  }
  const nc = L.neckColor
  switch (L.neck) {
    case 'scarf':
      t.push(ccyl(0.22, 0.24, 0.16, nc, 0, 0.82, 0, 0, 0, 0, 10))
      t.push(cbox(0.16, 0.42, 0.06, nc, 0.14, 0.6, 0.24, 0, 0, 0.1))
      t.push(cbox(0.16, 0.06, 0.07, '#ffffff', 0.15, 0.4, 0.24))
      break
    case 'lei':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        t.push(cbox(0.1, 0.1, 0.1, i % 2 ? nc : '#ffffff', Math.cos(a) * 0.3, 0.76 - Math.max(0, Math.sin(a)) * 0.14, Math.sin(a) * 0.26 + 0.02))
      }
      break
    case 'choker':
      t.push(ccyl(0.15, 0.15, 0.06, nc, 0, 0.84, 0, 0, 0, 0, 10))
      t.push(cbox(0.06, 0.08, 0.04, '#ffd23a', 0, 0.78, 0.15))
      break
    case 'pendant':
      t.push(cgeo(new TorusGeometry(0.16, 0.012, 4, 16), '#ffd23a', 0, 0.74, 0.08, Math.PI / 2 + 0.6))
      P.glow.push(cgeo(ico(0.06, 0), nc, 0, 0.6, 0.22))
      break
    case 'pearls':
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2
        P.shiny.push(cgeo(ico(0.045, 1), nc, Math.cos(a) * 0.18, 0.78 - Math.max(0, Math.sin(a)) * 0.1, Math.sin(a) * 0.17 + 0.02))
      }
      break
    case 'collar':
      P.shiny.push(ccyl(0.36, 0.42, 0.06, nc, 0, 0.74, 0.02, 0.12, 0, 0, 16))
      P.shiny.push(ccyl(0.28, 0.34, 0.07, '#ffd23a', 0, 0.78, 0.02, 0.12, 0, 0, 16))
      break
    case 'bell':
      t.push(ccyl(0.16, 0.16, 0.06, '#e83a3a', 0, 0.82, 0, 0, 0, 0, 10))
      P.shiny.push(cgeo(ico(0.08, 1), nc, 0, 0.74, 0.18))
      break
    case 'sailor':
      t.push(cbox(0.7, 0.3, 0.05, nc, 0, 0.62, -0.23))
      t.push(cbox(0.7, 0.04, 0.06, '#ffffff', 0, 0.5, -0.24))
      t.push(cbox(0.16, 0.18, 0.06, '#e83a3a', 0, 0.62, 0.23))
      break
  }
}

function armGeo(L, right) {
  const o = L.outfit
  const p = []
  const long = o === 'suit' || o === 'armor' || o === 'pants'
  if (o === 'kimono') {
    p.push(cbox(0.36, 0.42, 0.36, L.top, 0, -0.2, 0))
    p.push(cbox(0.38, 0.4, 0.5, L.top, 0, -0.52, -0.06)) // wide hanging sleeve
    p.push(cbox(0.4, 0.06, 0.52, L.accent, 0, -0.71, -0.06))
  } else if (o === 'dress' || o === 'gown') {
    p.push(cgeo(ico(0.22, 1), L.top, 0, -0.12, 0, 0, 0, 0, 1, 0.9, 1)) // puff sleeve
    p.push(cbox(0.38, 0.05, 0.38, L.accent, 0, -0.27, 0))
  } else {
    p.push(cbox(0.3, long ? 0.62 : 0.36, 0.32, L.top, 0, long ? -0.3 : -0.17, 0))
    p.push(cbox(0.32, 0.06, 0.34, long ? L.accent : '#ffffff', 0, long ? -0.6 : -0.35, 0))
  }
  if (!long) p.push(cbox(0.26, 0.42, 0.28, L.skin, 0, -0.55, 0)) // forearm
  p.push(cbox(0.25, 0.18, 0.27, o === 'suit' ? L.accent : L.skin, 0, -0.82, 0.02)) // hand
  if (o === 'armor') p.push(cbox(0.4, 0.2, 0.4, L.accent, 0, -0.04, 0)) // pauldron
  if (right && L.held) held(p, L)
  return merge(p)
}

// The item in her right hand (hand centre at y -0.82).
function held(p, L) {
  const c = L.heldColor
  const y = -0.86
  switch (L.held) {
    case 'flower':
      p.push(cbox(0.04, 0.5, 0.04, '#3a9a2a', 0, y + 0.1, 0.18))
      for (let i = 0; i < 5; i++) p.push(cbox(0.1, 0.1, 0.04, c, Math.cos(i * 1.26) * 0.08, y + 0.38 + Math.sin(i * 1.26) * 0.08, 0.18))
      p.push(cbox(0.07, 0.07, 0.06, '#ffcf33', 0, y + 0.38, 0.19))
      break
    case 'basket':
      p.push(cbox(0.4, 0.22, 0.3, '#c8904a', 0, y - 0.22, 0.12))
      p.push(cgeo(new TorusGeometry(0.17, 0.025, 4, 12, Math.PI), '#8b5a33', 0, y - 0.1, 0.12))
      for (let i = 0; i < 3; i++) p.push(cgeo(ico(0.08, 0), c, -0.1 + i * 0.1, y - 0.08, 0.12))
      break
    case 'honey':
      p.push(ccyl(0.12, 0.12, 0.2, c, 0, y - 0.14, 0.14, 0, 0, 0, 10))
      p.push(ccyl(0.13, 0.13, 0.05, '#ffffff', 0, y - 0.02, 0.14, 0, 0, 0, 10))
      break
    case 'rod':
      p.push(cbox(0.04, 1.6, 0.04, c, 0, y + 0.5, 0.3, 0.5))
      p.push(cbox(0.08, 0.08, 0.08, '#ff3a3a', 0, y - 0.3, 1.1))
      break
    case 'parasol':
      p.push(cbox(0.03, 1.2, 0.03, '#ffffff', 0, y + 0.5, 0.05))
      p.push(cgeo(new ConeGeometry(0.7, 0.3, 10), c, 0, y + 1.12, 0.05))
      p.push(ccyl(0.7, 0.7, 0.04, '#ffffff', 0, y + 0.97, 0.05, 0, 0, 0, 10))
      break
    case 'lantern':
      p.push(cbox(0.03, 0.2, 0.03, '#3a2a1a', 0, y - 0.08, 0.1))
      p.push(cbox(0.2, 0.26, 0.2, c, 0, y - 0.3, 0.1))
      p.push(cbox(0.24, 0.05, 0.24, '#3a2a1a', 0, y - 0.16, 0.1))
      break
    case 'wand':
      p.push(cbox(0.04, 0.6, 0.04, '#ffffff', 0, y + 0.18, 0.12, 0.3))
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 + Math.PI / 2
        p.push(cgeo(new ConeGeometry(0.05, 0.14, 4), c, Math.cos(a) * 0.06, y + 0.5 + Math.sin(a) * 0.06, 0.22, 0, 0, a - Math.PI / 2))
      }
      break
    case 'staff':
      p.push(cbox(0.06, 2.0, 0.06, '#8b6a4a', 0, y + 0.3, 0.12))
      p.push(cgeo(new TorusGeometry(0.14, 0.03, 6, 14), c, 0, y + 1.36, 0.12))
      p.push(cgeo(ico(0.1, 0), c, 0, y + 1.36, 0.12))
      break
    case 'trident':
      p.push(cbox(0.05, 2.0, 0.05, c, 0, y + 0.3, 0.12))
      p.push(cbox(0.36, 0.05, 0.05, c, 0, y + 1.28, 0.12))
      for (const x of [-0.16, 0, 0.16]) p.push(cgeo(new ConeGeometry(0.04, 0.28, 4), c, x, y + 1.44, 0.12))
      break
    case 'harp':
      p.push(cgeo(new TorusGeometry(0.22, 0.035, 6, 14, Math.PI * 1.3), c, 0, y + 0.1, 0.22, 0, Math.PI / 2, 0.6))
      for (let i = 0; i < 4; i++) p.push(cbox(0.012, 0.3 - i * 0.04, 0.012, '#ffffff', 0, y + 0.1, 0.12 + i * 0.07))
      break
    case 'pitchfork':
    case 'broom':
      p.push(cbox(0.05, 1.8, 0.05, '#8b5a33', 0, y + 0.3, 0.1))
      if (L.held === 'broom') p.push(cgeo(new ConeGeometry(0.2, 0.5, 8), '#e8c64a', 0, y - 0.7, 0.1, Math.PI))
      else for (const x of [-0.1, 0, 0.1]) p.push(cbox(0.03, 0.3, 0.03, '#c8c8d0', x, y + 1.32, 0.1))
      break
    case 'icecream':
      p.push(cgeo(new ConeGeometry(0.09, 0.28, 8), '#e8b060', 0, y + 0.12, 0.16, Math.PI))
      p.push(cgeo(ico(0.12), c, 0, y + 0.32, 0.16))
      break
    case 'book':
      p.push(cbox(0.06, 0.34, 0.26, c, 0.06, y - 0.06, 0.12))
      p.push(cbox(0.04, 0.3, 0.22, '#fff6e0', 0.1, y - 0.06, 0.12))
      break
    case 'gem':
    case 'shell':
    case 'ball':
      p.push(cgeo(ico(0.14, L.held === 'ball' ? 2 : 0), c, 0, y - 0.04, 0.2, 0, 0, 0, 1, L.held === 'shell' ? 0.6 : 1, 1))
      break
    case 'torch':
      p.push(cbox(0.06, 0.6, 0.06, '#5a3a1a', 0, y + 0.2, 0.12))
      p.push(cgeo(new ConeGeometry(0.1, 0.26, 6), c, 0, y + 0.6, 0.12))
      break
    case 'sword':
      p.push(cbox(0.06, 0.18, 0.06, '#3a2414', 0, y, 0.12))
      p.push(cbox(0.3, 0.05, 0.08, '#ffd23a', 0, y + 0.1, 0.12))
      p.push(cbox(0.08, 1.0, 0.03, c, 0, y + 0.62, 0.12))
      break
    case 'surfboard':
      p.push(cbox(0.4, 1.8, 0.08, c, 0, y + 0.3, -0.12))
      p.push(cbox(0.06, 1.7, 0.09, '#ffffff', 0, y + 0.3, -0.12))
      break
  }
}

// Wing geometry for the right wing (+x), local to its root on her back; the left is mirrored.
function wingGeo(L) {
  const c = L.wingColor
  const c2 = tint(c, -0.12)
  const c3 = tint(c, 0.1)
  const out = { body: [], sheer: [], glow: [], shiny: [] }
  switch (L.wings) {
    case 'angel':
    case 'seraph':
      for (let r = 0; r < 3; r++) for (let i = 0; i < 6 - r; i++) {
        const len = 0.5 + i * 0.12 - r * 0.08
        out.body.push(cbox(0.14, len, 0.06, r === 1 ? c2 : c, 0.18 + i * 0.16, 0.26 - r * 0.18 - len / 2 + i * 0.07, -0.04 * r, 0, 0, 0.18 + i * 0.05))
      }
      if (L.wings === 'seraph') for (let i = 0; i < 4; i++) out.body.push(cbox(0.12, 0.36 + i * 0.08, 0.05, c3, 0.14 + i * 0.13, -0.42 - i * 0.03, -0.08, 0, 0, 0.9 + i * 0.1))
      if (L.wings === 'seraph') out.glow.push(cbox(0.04, 0.04, 0.04, c3, 0.9, 0.4, 0))
      break
    case 'bat':
    case 'dragon':
      for (let i = 0; i < 4; i++) out.body.push(cbox(0.05, 0.9 - i * 0.12, 0.05, tint(c, -0.25), 0.2 + i * 0.22, 0.22 - i * 0.05, 0, 0, 0, 0.5 - i * 0.28))
      for (let i = 0; i < 3; i++) out.body.push(cbox(0.24, 0.62 - i * 0.12, 0.03, c, 0.32 + i * 0.22, -0.02 - i * 0.04, 0, 0, 0, 0.3 - i * 0.25))
      out.body.push(cgeo(new ConeGeometry(0.04, 0.12, 4), '#ffffff', 0.38, 0.6, 0, 0, 0, -0.5))
      break
    case 'fairy':
      out.sheer.push(cgeo(ico(0.5, 1), c, 0.55, 0.32, 0, 0, 0, 0.5, 1, 0.55, 0.05))
      out.sheer.push(cgeo(ico(0.34, 1), c3, 0.42, -0.2, 0, 0, 0, -0.6, 1, 0.5, 0.05))
      out.glow.push(cbox(0.03, 0.6, 0.02, '#ffffff', 0.5, 0.3, 0.02, 0, 0, -1))
      break
    case 'butterfly':
      out.body.push(cgeo(ico(0.5, 1), c, 0.55, 0.32, 0, 0, 0, 0.45, 1, 0.62, 0.05))
      out.body.push(cgeo(ico(0.36, 1), c2, 0.44, -0.2, 0, 0, 0, -0.5, 1, 0.6, 0.05))
      out.body.push(cgeo(ico(0.08, 0), '#ffffff', 0.72, 0.42, 0.03))
      out.body.push(cgeo(ico(0.06, 0), '#ffffff', 0.5, -0.24, 0.03))
      out.body.push(cgeo(ico(0.52, 1), '#2a1a2a', 0.56, 0.32, -0.01, 0, 0, 0.45, 1.04, 0.66, 0.04))
      break
    case 'fire':
      for (let i = 0; i < 5; i++) out.glow.push(cgeo(new ConeGeometry(0.16, 0.8 - i * 0.08, 4), i % 2 ? '#ffd23a' : c, 0.22 + i * 0.17, 0.2 + i * 0.08, 0, 0, 0, -0.5 - i * 0.2))
      break
    case 'crystal':
      for (let i = 0; i < 5; i++) out.shiny.push(cgeo(new ConeGeometry(0.1, 0.9 - i * 0.12, 4), i % 2 ? c3 : c, 0.2 + i * 0.16, 0.24 + i * 0.05, 0, 0, 0, -0.6 - i * 0.18))
      out.glow.push(cgeo(ico(0.07, 0), '#ffffff', 0.5, 0.5, 0.03))
      break
  }
  const res = {}
  for (const k in out) res[k] = out[k].length ? merge(out[k]) : null
  return res
}

// Tail segments (3), each local to its own pivot; the chain hangs from her lower back.
function tailGeo(L) {
  const c = L.tailColor
  const segs = [[], [], []]
  switch (L.tail) {
    case 'cat':
    case 'devil':
      for (let i = 0; i < 3; i++) segs[i].push(cbox(0.08, 0.08, 0.36, c, 0, 0, -0.18))
      if (L.tail === 'devil') segs[2].push(cgeo(new ConeGeometry(0.14, 0.24, 4), c, 0, 0, -0.42, -Math.PI / 2))
      break
    case 'fox':
    case 'kitsune':
      segs[0].push(cbox(0.2, 0.2, 0.3, c, 0, 0, -0.15))
      segs[1].push(cgeo(ico(0.24, 1), c, 0, 0, -0.24, 0, 0, 0, 1, 1, 1.4))
      segs[2].push(cgeo(ico(0.2, 1), '#ffffff', 0, 0, -0.2, 0, 0, 0, 1, 1, 1.3))
      if (L.tail === 'kitsune') for (const x of [-0.3, 0.3]) {
        segs[1].push(cgeo(ico(0.2, 1), c, x, 0.05, -0.18, 0, 0, 0, 1, 1, 1.3))
        segs[2].push(cgeo(ico(0.16, 1), '#ffffff', x * 1.4, 0.08, -0.12))
      }
      break
    case 'squirrel':
      segs[0].push(cgeo(ico(0.22, 1), c, 0, 0.1, -0.15))
      segs[1].push(cgeo(ico(0.3, 1), c, 0, 0.25, -0.15, 0, 0, 0, 1, 1.4, 1))
      segs[2].push(cgeo(ico(0.26, 1), tint(c, 0.12), 0, 0.2, 0.05))
      break
    case 'bunny':
      segs[0].push(cgeo(ico(0.15, 1), c, 0, 0, -0.08))
      break
    case 'dragon':
      for (let i = 0; i < 3; i++) {
        segs[i].push(cbox(0.24 - i * 0.06, 0.2 - i * 0.05, 0.4, c, 0, 0, -0.2))
        segs[i].push(cgeo(new ConeGeometry(0.05, 0.14, 4), tint(c, 0.2), 0, 0.12 - i * 0.03, -0.2))
      }
      break
  }
  return segs.map((s) => (s.length ? merge(s) : null))
}

// The mermaid tail in place of legs: 4 segments from the hip down to a fin.
function mermaidGeo(L) {
  const c = L.bottom
  const segs = []
  for (let i = 0; i < 4; i++) {
    const w = 0.66 - i * 0.12
    const p = [cbox(w, 0.28, w * 0.7, i % 2 ? tint(c, 0.08) : c, 0, -0.14, 0)]
    p.push(cbox(w * 0.6, 0.05, 0.02, tint(c, 0.25), 0, -0.1, w * 0.35 + 0.01))
    if (i === 3) {
      for (const x of [-1, 1]) p.push(cbox(0.36, 0.08, 0.5, L.accent, x * 0.2, -0.3, 0.12, 0.2, x * 0.5, x * 0.3))
    }
    segs.push(merge(p))
  }
  return segs
}

// Geometry for one girl (cached), local to each limb's pivot.
function parts(def) {
  if (partCache.has(def.id)) return partCache.get(def.id)
  const L = def.look
  const h = hash(def.id)
  const P = { body: [], shiny: [], glow: [], torso: [], glass: null }
  const out = {}
  out.mermaid = L.outfit === 'mermaid'
  if (out.mermaid) out.tailSegs = mermaidGeo(L)
  else {
    out.legL = legGeo(L)
    out.legR = out.legL
  }
  const T = { body: [], shiny: [], glow: [], torso: [] }
  torsoGeo(L, T)
  out.torso = merge(T.torso)
  out.torsoShiny = T.shiny.length ? merge(T.shiny) : null
  out.torsoGlow = T.glow.length ? merge(T.glow) : null
  out.armL = armGeo(L, false)
  out.armR = armGeo(L, true)
  // Head.
  P.body.push(cbox(0.84, 0.8, 0.8, L.skin, 0, 0.4, 0))
  P.body.push(cbox(0.1, 0.18, 0.12, L.skin, -0.45, 0.38, 0))
  P.body.push(cbox(0.1, 0.18, 0.12, L.skin, 0.45, 0.38, 0))
  hair(P, L, h)
  hat(P, L)
  out.head = merge(P.body)
  out.headShiny = P.shiny.length ? merge(P.shiny) : null
  out.headGlow = P.glow.length ? merge(P.glow) : null
  out.glass = P.glass
  out.glassAt = P.glassAt
  out.wings = L.wings ? wingGeo(L) : null
  out.tail = L.tail ? tailGeo(L) : null
  out.faceStyle = [0, 1, 2, 1][h % 4] // resting: calm, smile or smirk (^ ^ is saved for the happy moves)
  partCache.set(def.id, out)
  return out
}

const auraGeo = new RingGeometry(0.7, 1.15, 40)
auraGeo.rotateX(-Math.PI / 2)
const raysGeo = new RingGeometry(1.15, 1.6, 12, 1, 0, Math.PI * 2)
raysGeo.rotateX(-Math.PI / 2)
const auraMats = new Map()
function auraMat(rarity) {
  if (!auraMats.has(rarity)) auraMats.set(rarity, new MeshBasicMaterial({ color: RARITIES[rarity].glow, transparent: true, opacity: 0.5, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
  return auraMats.get(rarity)
}

// Variants (config VARIANTS): the body tinted gold / ice-blue / cycling rainbow, plus a ring.
const variantMats = new Map()
function variantMat(v) {
  if (!v || !VARIANTS[v]) return null
  if (!variantMats.has(v)) {
    const V = VARIANTS[v]
    variantMats.set(v, new MeshStandardMaterial({ vertexColors: true, color: V.color, roughness: 0.3, metalness: v === 1 ? 0.55 : 0.25, emissive: V.color, emissiveIntensity: 0.18 }))
  }
  return variantMats.get(v)
}
const variantRings = new Map()
function variantRingMat(v) {
  if (!variantRings.has(v)) variantRings.set(v, new MeshBasicMaterial({ color: VARIANTS[v].glow, transparent: true, opacity: 0.65, blending: AdditiveBlending, depthWrite: false, side: DoubleSide }))
  return variantRings.get(v)
}
// The rainbow variant's colour cycles (one shared material, stepped at most 30 times a second).
let rainbowFrame = -1
const rainbowColor = new Color()
const RAINBOW = VARIANTS.findIndex((x) => x.rainbow)
function tickRainbow(t) {
  const f = Math.floor(t * 30)
  if (f === rainbowFrame) return
  rainbowFrame = f
  const m = variantMats.get(RAINBOW)
  if (!m) return
  rainbowColor.setHSL((t * 0.25) % 1, 0.85, 0.72)
  m.color.copy(rainbowColor)
  m.emissive.copy(rainbowColor)
  variantRings.get(RAINBOW)?.color.copy(rainbowColor)
}

const labelCache = new Map()
function labelFor(def, size, v = 0, income = null) {
  const key = `${def.id}|${size}|${v}|${income ?? ''}`
  if (!labelCache.has(key)) labelCache.set(key, makeLabel(def, size, v, income))
  const base = labelCache.get(key)
  const s = new Sprite(base.material)
  s.userData.base = base
  s.scale.copy(base.scale)
  return s
}
function makeLabel(def, size, v = 0, income = null) {
  const sz = SIZES[size]
  const lines = []
  const colors = []
  const top = [VARIANTS[v]?.name, sz.name].filter(Boolean).join(' ')
  if (top) {
    lines.push(top)
    colors.push(VARIANTS[v]?.name ? VARIANTS[v].color : '#ffffff')
  }
  lines.push(def.name)
  colors.push(RARITIES[def.rarity].color)
  lines.push(`$${fmt(income ?? def.income * sz.mult * (VARIANTS[v]?.mult ?? 1))}/s`)
  colors.push('#7dff4a')
  return label(lines.join('\n'), 0.42 * lines.length, { colors, outline: '#10131f', outlineWidth: 16, font: '700 80px Fredoka, "Arial Black", sans-serif' })
}

// Appeal moves and how long each runs (s).
export const APPEAL = { wave: 1.8, kiss: 1.7, heart: 2.2, twirl: 1.2, pose: 2.0, shy: 2.4, curtsy: 1.6 }
const MOOD = { kiss: 'kiss', heart: 'love', shy: 'shy', pose: 'kiss' }

let uid = 0
const BASE_SCALE = 0.74 // a normal-size girl stands a head taller than the player
export class Baddie {
  // variant: VARIANTS index; income: the $/s printed on the label (defaults to the def's figure).
  constructor(id, size = 0, { showLabel = true, variant = 0, income = null } = {}) {
    this.uid = ++uid
    this.def = BY_ID[id]
    this.size = size
    this.variant = variant | 0
    this.group = new Group()
    this.body = new Group() // scaled by the size step; bob/jump/spin live here
    this.group.add(this.body)
    const p = parts(this.def)
    const skinMat = variantMat(this.variant) ?? bodyMat
    const mk = (geo, mat = skinMat, shadow = true) => {
      const m = new Mesh(geo, mat)
      m.castShadow = shadow
      m.receiveShadow = shadow
      return m
    }
    this.hip = new Group()
    this.hip.position.y = 0.92
    this.body.add(this.hip)
    this.torso = mk(p.torso)
    if (p.torsoShiny) this.torso.add(mk(p.torsoShiny, shinyMat))
    if (p.torsoGlow) this.torso.add(mk(p.torsoGlow, glowMat, false))
    this.hip.add(this.torso)
    this.mermaid = p.mermaid
    if (p.mermaid) {
      // A chain of tail segments hanging from the hip.
      this.tailChain = []
      let parent = this.hip
      p.tailSegs.forEach((g, i) => {
        const piv = new Group()
        piv.position.y = i === 0 ? 0.08 : -0.26
        piv.add(mk(g))
        parent.add(piv)
        this.tailChain.push(piv)
        parent = piv
      })
      this.legL = new Group()
      this.legR = new Group()
    } else {
      this.legL = new Group()
      this.legL.position.set(-0.2, 0, 0)
      this.legL.add(mk(p.legL))
      this.legR = new Group()
      this.legR.position.set(0.2, 0, 0)
      this.legR.add(mk(p.legR))
      this.hip.add(this.legL, this.legR)
    }
    this.armL = new Group()
    this.armL.position.set(-0.56, 0.72, 0)
    this.armL.add(mk(p.armL))
    this.armR = new Group()
    this.armR.position.set(0.56, 0.72, 0)
    this.armR.add(mk(p.armR))
    this.torso.add(this.armL, this.armR)
    this.head = new Group()
    this.head.position.y = 0.88
    this.head.add(mk(p.head))
    if (p.headShiny) this.head.add(mk(p.headShiny, shinyMat))
    if (p.headGlow) this.head.add(mk(p.headGlow, glowMat, false))
    if (p.glass) {
      const g = new Mesh(p.glass, glassMat)
      g.position.y = p.glassAt
      g.renderOrder = 2
      this.head.add(g)
    }
    this.faceStyle = p.faceStyle
    this.face = new Mesh(new PlaneGeometry(0.8, 0.76), faceMaterial(this.def.look.eyes, p.faceStyle))
    this.face.position.set(0, 0.38, 0.402)
    this.head.add(this.face)
    this.torso.add(this.head)
    // Wings on her back, mirrored.
    this.wings = null
    if (p.wings) {
      this.wings = []
      for (const side of [-1, 1]) {
        const root = new Group()
        root.position.set(side * 0.1, 0.56, -0.24)
        root.scale.x = side
        for (const [k, mat] of [['body', bodyMat], ['sheer', sheerMat], ['glow', glowMat], ['shiny', shinyMat]]) if (p.wings[k]) root.add(mk(p.wings[k], mat, k === 'body'))
        this.torso.add(root)
        this.wings.push(root)
      }
    }
    // A tail from the lower back.
    this.tail = null
    if (p.tail) {
      this.tail = []
      let parent = this.torso
      p.tail.forEach((g, i) => {
        if (!g) return
        const piv = new Group()
        piv.position.set(0, i === 0 ? 0.12 : 0, i === 0 ? -0.22 : -0.34)
        piv.add(mk(g))
        parent.add(piv)
        this.tail.push(piv)
        parent = piv
      })
      if (this.tail[0]) this.tail[0].rotation.x = 0.5
    }
    this.body.scale.setScalar(SIZES[size].scale * BASE_SCALE)
    if (this.def.rarity >= 3 || this.def.look.glow) {
      this.aura = new Mesh(auraGeo, auraMat(this.def.rarity))
      this.aura.position.y = 0.06
      this.aura.scale.setScalar(SIZES[size].scale * 0.85)
      this.group.add(this.aura)
      if (this.def.rarity >= 6 || this.def.look.glow) {
        this.rays = new Mesh(raysGeo, auraMat(this.def.rarity))
        this.rays.position.y = 0.05
        this.rays.scale.setScalar(SIZES[size].scale * 0.85)
        this.group.add(this.rays)
      }
    }
    if (this.variant && VARIANTS[this.variant]) {
      this.vring = new Mesh(auraGeo, variantRingMat(this.variant))
      this.vring.position.y = 0.08
      this.vring.scale.setScalar(SIZES[size].scale * 1.05)
      this.group.add(this.vring)
    }
    if (showLabel) {
      this.label = labelFor(this.def, size, this.variant, income)
      this.label.position.y = 2.95 * BASE_SCALE * SIZES[size].scale + 0.55
      this.label.renderOrder = 5
      this.group.add(this.label)
    }
    // Animation state (owners set these).
    this.speed = 0 // m/s it is moving now (drives the walk cycle)
    this.mode = 'idle' // idle | walk | dance | cheer | eat | fly | an APPEAL move
    this.phase = Math.random() * 10
    this.t = Math.random() * 10
    this.jumpT = 0
    this.actT = 0 // time into the current appeal move
    this.blinkIn = 1 + Math.random() * 3
    this.blinkT = 0
    this.mood = 'open'
    this.cue = null
    this.spin = 0
  }

  get height() {
    return 2.7 * BASE_SCALE * SIZES[this.size].scale
  }

  hop() {
    this.jumpT = 0.0001
  }

  // Start an appeal move (APPEAL keys). The owner reads cues with takeCue() and puts her back
  // to idle once busy() turns false.
  appeal(move) {
    this.mode = move
    this.actT = 0
    this.cued = 0
    this.spin = 0
  }
  busy() {
    return APPEAL[this.mode] != null && this.actT < APPEAL[this.mode]
  }
  takeCue() {
    const c = this.cue
    this.cue = null
    return c
  }
  setMood(m) {
    if (m === this.mood) return
    this.mood = m
    this.face.material = faceMaterial(this.def.look.eyes, this.faceStyle, m)
  }

  update(dt) {
    this.t += dt
    const t = this.t
    if (this.variant) {
      tickRainbow(performance.now() / 1000)
      if (this.vring) this.vring.rotation.y += dt * 0.8
    }
    const k = Math.min(1, dt * 12)
    const lerp = (o, key, v) => (o[key] += (v - o[key]) * k)
    let legL = 0
    let legR = 0
    let armXL = 0
    let armXR = 0
    let outL = 0.1
    let outR = 0.1
    let bob = 0
    let headTilt = 0
    let headNod = 0
    let headYaw = 0
    let torsoYaw = 0
    let torsoRoll = 0
    let torsoLean = 0
    let mood = 'open'
    let wingFlap = 0.25 + Math.sin(t * 2.2) * 0.12
    const m = this.mode
    const a = this.actT
    if (APPEAL[m] != null) this.actT += dt
    const cueOnce = (at, name) => {
      if (a >= at && (this.cued ?? 0) < at + 0.0001) {
        this.cued = at + 0.0002
        this.cue = name
      }
    }
    if (m === 'walk' || this.speed > 0.3) {
      this.phase += dt * (2.2 + this.speed * 1.4)
      const s = Math.sin(this.phase)
      const sw = Math.min(0.9, 0.35 + this.speed * 0.12) * (LONG.has(this.def.look.outfit) ? 0.45 : 1)
      legL = s * sw
      legR = -s * sw
      armXL = -s * 0.6
      armXR = s * 0.6
      bob = Math.abs(Math.cos(this.phase)) * 0.07
      torsoYaw = s * 0.06
    } else if (m === 'dance') {
      const s = Math.sin(t * 6)
      armXL = -2.6 + s * 0.4
      armXR = -2.6 - s * 0.4
      outL = 0.4
      outR = 0.4
      torsoYaw = Math.sin(t * 3) * 0.35
      torsoRoll = Math.sin(t * 6) * 0.08
      bob = Math.abs(s) * 0.12
      headTilt = s * 0.18
      legL = Math.max(0, s) * 0.35
      legR = Math.max(0, -s) * 0.35
      mood = 'happy'
    } else if (m === 'cheer') {
      const s = Math.sin(t * 10)
      armXL = -2.9 + s * 0.25
      armXR = -2.9 - s * 0.25
      outL = 0.35
      outR = 0.35
      bob = Math.abs(s) * 0.1
      mood = 'happy'
    } else if (m === 'eat') {
      armXR = -1.9 + Math.sin(t * 14) * 0.25
      outR = -0.35
      armXL = -0.7
      headNod = Math.sin(t * 14) * 0.12
      bob = Math.abs(Math.sin(t * 7)) * 0.04
    } else if (m === 'feed') {
      // Pick food up off the ground with both hands and eat it from them. The owner drives
      // reach (bend down to it), hold (hands up in front of her mouth) and chomp (a bite), 0..1.
      const r = this.reach ?? 0
      const h = this.hold ?? 0
      const c = this.chomp ?? 0
      torsoLean = r * 0.75 - c * 0.06
      bob = -r * 0.22
      armXL = armXR = -0.35 * r - (1.75 + c * 0.3) * h
      outL = outR = -0.05 * r - 0.28 * h
      headNod = r * 0.35 + h * 0.12 - c * 0.1
      mood = c > 0.3 ? 'happy' : 'open'
    } else if (m === 'fly') {
      armXL = -2.8
      armXR = -2.8
      outL = 0.5
      outR = 0.5
      legL = Math.sin(t * 16) * 0.4
      legR = -legL
      wingFlap = 0.2 + Math.sin(t * 18) * 0.5
    } else if (m === 'wave') {
      armXR = -2.75
      outR = 0.35 + Math.sin(a * 11) * 0.35
      outL = 0.55
      armXL = 0.2
      headTilt = 0.15
      torsoRoll = -0.05
      bob = Math.abs(Math.sin(a * 5.5)) * 0.03
      mood = 'happy'
      cueOnce(0.2, 'wave')
    } else if (m === 'kiss') {
      // Hand to her lips, a wink, then the kiss is blown toward you.
      const send = a > 0.75
      armXR = send ? -1.7 : -2.25
      outR = send ? 0.05 : -0.75
      armXL = 0.15
      outL = 0.3
      torsoLean = send ? 0.12 : -0.05
      headTilt = send ? -0.12 : 0.2
      headNod = send ? -0.05 : 0.08
      mood = 'kiss'
      cueOnce(0.78, 'kiss')
      if (a > 0.6) wingFlap = 0.2 + Math.sin(t * 14) * 0.4
    } else if (m === 'heart') {
      // Both arms up and in: a heart over her head.
      armXL = -2.95
      armXR = -2.95
      outL = -0.42
      outR = -0.42
      torsoRoll = Math.sin(a * 4) * 0.1
      headTilt = Math.sin(a * 4) * 0.18
      bob = Math.abs(Math.sin(a * 4)) * 0.05
      mood = 'love'
      cueOnce(0.35, 'heart')
      cueOnce(1.3, 'heart')
    } else if (m === 'twirl') {
      const k2 = Math.min(1, a / 0.9)
      this.spin = (k2 * k2 * (3 - 2 * k2)) * Math.PI * 2 // one full turn, eased
      outL = 1.25
      outR = 1.25
      armXL = -0.2
      armXR = -0.2
      bob = Math.sin(k2 * Math.PI) * 0.15
      mood = 'happy'
      cueOnce(0.05, 'twirl')
      wingFlap = 0.2 + Math.sin(t * 16) * 0.45
    } else if (m === 'pose') {
      // Peace sign by her face, other hand on her hip, a wink.
      armXR = -2.4
      outR = -0.2
      armXL = 0.35
      outL = 0.65
      torsoRoll = 0.1
      headTilt = -0.22
      legR = -0.15
      mood = a > 0.3 ? 'kiss' : 'happy'
      cueOnce(0.3, 'pose')
    } else if (m === 'shy') {
      // Hands behind her back, swaying, eyes away, toe scuff.
      armXL = 0.55
      armXR = 0.55
      outL = -0.08
      outR = -0.08
      torsoRoll = Math.sin(a * 3.2) * 0.1
      torsoYaw = Math.sin(a * 3.2) * 0.15
      headNod = 0.22
      headTilt = 0.2
      headYaw = -0.25
      legR = 0.25 + Math.sin(a * 6) * 0.2
      mood = 'shy'
      cueOnce(0.6, 'shy')
    } else if (m === 'curtsy') {
      const d = Math.sin(Math.min(1, a / 1.2) * Math.PI)
      legL = -0.3 * d
      legR = 0.35 * d
      outL = 0.55
      outR = 0.55
      armXL = -0.35
      armXR = -0.35
      headNod = 0.3 * d
      bob = -0.12 * d
      torsoLean = 0.15 * d
      mood = 'happy'
      cueOnce(0.5, 'curtsy')
    } else {
      // Idle: breathing, a slow look round.
      const b = Math.sin(t * 2.1)
      bob = b * 0.015
      headTilt = Math.sin(t * 0.7) * 0.12
      torsoYaw = Math.sin(t * 0.45) * 0.12
      outL = 0.12 + b * 0.03
      outR = 0.12 + b * 0.03
      torsoRoll = Math.sin(t * 0.9) * 0.03
    }
    lerp(this.legL.rotation, 'x', legL)
    lerp(this.legR.rotation, 'x', legR)
    lerp(this.armL.rotation, 'x', armXL)
    lerp(this.armR.rotation, 'x', armXR)
    lerp(this.armL.rotation, 'z', -outL)
    lerp(this.armR.rotation, 'z', outR)
    lerp(this.torso.rotation, 'y', torsoYaw)
    lerp(this.torso.rotation, 'z', torsoRoll)
    lerp(this.torso.rotation, 'x', torsoLean)
    lerp(this.head.rotation, 'z', headTilt)
    lerp(this.head.rotation, 'x', headNod)
    lerp(this.head.rotation, 'y', headYaw)
    this.body.rotation.y = this.spin
    if (this.wings) {
      this.wings[0].rotation.y = wingFlap
      this.wings[1].rotation.y = -wingFlap
    }
    if (this.tail) {
      const sw = Math.sin(t * 2.6)
      this.tail.forEach((s, i) => {
        s.rotation.y = sw * (0.25 + i * 0.12) * (this.speed > 0.3 ? 1.6 : 1)
        if (i > 0) s.rotation.x = -0.35 + Math.sin(t * 2.6 + i) * 0.1
      })
    }
    if (this.tailChain) {
      // Mermaid: the tail sways and the fin flicks; she bobs as if afloat.
      this.tailChain.forEach((s, i) => {
        s.rotation.x = (i === 0 ? 0 : 0.12) + Math.sin(t * 3 - i * 0.8) * 0.12 * (i + 1)
        s.rotation.z = Math.sin(t * 1.7 - i * 0.6) * 0.05 * i
      })
      bob += 0.05 + Math.sin(t * 2) * 0.04
    }
    // Blinks and expressions.
    if (mood === 'open') {
      this.blinkIn -= dt
      if (this.blinkIn <= 0) {
        this.blinkT = 0.13
        this.blinkIn = 2 + Math.random() * 3.5
      }
      if (this.blinkT > 0) {
        this.blinkT -= dt
        mood = 'blink'
      }
    }
    this.setMood(mood)
    // Hop: a little squash on take-off and landing.
    let jy = 0
    if (this.jumpT > 0) {
      this.jumpT += dt
      const jt = this.jumpT / 0.5
      if (jt >= 1) this.jumpT = 0
      else jy = Math.sin(jt * Math.PI) * 0.9
    }
    this.hip.position.y = 0.92 + bob + jy
    if (this.label) this.label.scale.copy(this.label.userData.base.scale) // the base repaints once the font loads
    if (this.aura) {
      this.aura.rotation.y += dt * 0.8
      this.aura.material.opacity = 0.35 + Math.sin(t * 3) * 0.15
    }
    if (this.rays) this.rays.rotation.y -= dt * 0.5
  }

  dispose() {
    this.group.removeFromParent()
  }
}

// A portrait-ready copy (no label, no aura) for UI snapshots.
export function portraitModel(id, size = 0, variant = 0) {
  const b = new Baddie(id, size, { showLabel: false, variant })
  if (b.aura) b.group.remove(b.aura)
  if (b.rays) b.group.remove(b.rays)
  if (b.vring) b.group.remove(b.vring)
  b.blinkIn = 99
  b.update(0.016)
  b.setMood('open')
  return b
}
