// Canvas painters for the lego hub: studded brick tiles (colour + normal), the
// grass-topped dirt cliff face, the road, baddie faces, plot badges and the
// leaderboard screens. Everything is drawn once at load (and cached by key).
import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from 'three'
import { heightToNormal, mulberry32 } from '../textures.js'

const cache = new Map()
function cached(key, make) {
  if (!cache.has(key)) cache.set(key, make())
  return cache.get(key)
}

function canvas(w, h = w) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

export function tex(c, { srgb = true, rx = 1, ry = 1, repeat = true } = {}) {
  const t = new CanvasTexture(c)
  if (repeat) t.wrapS = t.wrapT = RepeatWrapping
  t.repeat.set(rx, ry)
  t.anisotropy = 8
  if (srgb) t.colorSpace = SRGBColorSpace
  return t
}

function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16)
  const f = (v) => Math.max(0, Math.min(255, Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k))))
  return `rgb(${f((n >> 16) & 255)},${f((n >> 8) & 255)},${f(n & 255)})`
}

// One stud at (x, y) of radius r: colour (lit top-left rim, shadowed bottom-right) and height.
function stud(ctx, hctx, x, y, r, base) {
  ctx.fillStyle = shade(base, 0.06)
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.fill()
  ctx.lineWidth = Math.max(2, r * 0.16)
  ctx.strokeStyle = 'rgba(255,255,255,0.38)'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.92, Math.PI * 0.85, Math.PI * 1.7)
  ctx.stroke()
  ctx.strokeStyle = 'rgba(0,0,0,0.26)'
  ctx.beginPath()
  ctx.arc(x, y, r * 0.92, Math.PI * 1.85, Math.PI * 0.7)
  ctx.stroke()
  // Soft contact shadow below-right.
  ctx.strokeStyle = 'rgba(0,0,0,0.08)'
  ctx.lineWidth = r * 0.22
  ctx.beginPath()
  ctx.arc(x + r * 0.12, y + r * 0.14, r * 1.08, Math.PI * 1.95, Math.PI * 0.6)
  ctx.stroke()
  if (hctx) {
    const g = hctx.createRadialGradient(x, y, r * 0.6, x, y, r * 1.02)
    g.addColorStop(0, '#d0d0d0')
    g.addColorStop(1, '#202020')
    hctx.fillStyle = g
    hctx.beginPath()
    hctx.arc(x, y, r * 1.02, 0, Math.PI * 2)
    hctx.fill()
  }
}

function toHeights(hc) {
  const { width, height } = hc
  const d = hc.getContext('2d').getImageData(0, 0, width, height).data
  const out = new Float32Array(width * height)
  for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255
  return out
}

// A square brick tile: cells x cells checker of a / b, studs x studs per cell.
// Returns { color, normal } canvases; tiles seamlessly.
export function paintStuds({ a, b = a, size = 512, cells = 2, studs = 4, seam = 0.18, speckle = 0.04, seed = 1 }) {
  return cached(`studs|${a}|${b}|${size}|${cells}|${studs}|${seam}|${seed}`, () => {
    const c = canvas(size)
    const h = canvas(size)
    const ctx = c.getContext('2d')
    const hctx = h.getContext('2d')
    hctx.fillStyle = '#202020'
    hctx.fillRect(0, 0, size, size)
    const cell = size / cells
    const rand = mulberry32(seed)
    for (let cy = 0; cy < cells; cy++) {
      for (let cx = 0; cx < cells; cx++) {
        const col = (cx + cy) % 2 ? b : a
        ctx.fillStyle = col
        ctx.fillRect(cx * cell, cy * cell, cell, cell)
        // Faint per-brick tone variation.
        ctx.fillStyle = `rgba(${rand() < 0.5 ? '255,255,255' : '0,0,0'},${rand() * speckle})`
        ctx.fillRect(cx * cell, cy * cell, cell, cell)
        if (seam) {
          ctx.strokeStyle = `rgba(0,0,0,${seam})`
          ctx.lineWidth = 2
          ctx.strokeRect(cx * cell + 1, cy * cell + 1, cell - 2, cell - 2)
          ctx.strokeStyle = `rgba(255,255,255,${seam * 0.6})`
          ctx.beginPath()
          ctx.moveTo(cx * cell + 3, (cy + 1) * cell - 3)
          ctx.lineTo(cx * cell + 3, cy * cell + 3)
          ctx.lineTo((cx + 1) * cell - 3, cy * cell + 3)
          ctx.stroke()
          hctx.strokeStyle = '#000'
          hctx.lineWidth = 3
          hctx.strokeRect(cx * cell, cy * cell, cell, cell)
        }
        const pitch = cell / studs
        for (let sy = 0; sy < studs; sy++) {
          for (let sx = 0; sx < studs; sx++) stud(ctx, hctx, cx * cell + (sx + 0.5) * pitch, cy * cell + (sy + 0.5) * pitch, pitch * 0.3, col)
        }
      }
    }
    return { color: c, normal: heightToNormal(toHeights(h), size, 1.6) }
  })
}

// The cliff face: 16 m wide x 7 m tall at 64 px/m. Grass on top dripping down in
// half-metre steps, dirt checker below, studs everywhere. Tiles horizontally.
export function paintCliff({ grass = '#5fd23a', grassAlt = '#4fc22c', dirt = '#8b5a33', dirtAlt = '#7a4b29', w = 1024, h = 448, seed = 11 } = {}) {
  return cached(`cliff|${grass}|${dirt}|${w}|${h}|${seed}`, () => {
    const c = canvas(w, h)
    const hc = canvas(w, h)
    const ctx = c.getContext('2d')
    const hctx = hc.getContext('2d')
    hctx.fillStyle = '#202020'
    hctx.fillRect(0, 0, w, h)
    const px = 64 // per metre
    const pitch = px / 2
    const rand = mulberry32(seed)
    const cols = w / pitch
    // Drip depth per half-metre column (in studs), smoothed into blocky runs.
    const drip = []
    let run = 0
    let depth = 2
    for (let i = 0; i < cols; i++) {
      if (run <= 0) {
        depth = 2 + Math.floor(rand() * 4) + (rand() < 0.18 ? 3 : 0)
        run = 1 + Math.floor(rand() * 4)
      }
      drip.push(depth)
      run--
    }
    drip[cols - 1] = drip[0] // seam matches
    const rows = h / pitch
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const isGrass = ry < drip[rx]
        const block = Math.floor(rx / 4) + Math.floor(ry / 4)
        const base = isGrass ? (block % 2 ? grassAlt : grass) : block % 2 ? dirtAlt : dirt
        ctx.fillStyle = base
        ctx.fillRect(rx * pitch, ry * pitch, pitch, pitch)
      }
    }
    // Brick seams every 2 m on the dirt, and a dark lip under the grass.
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'
    ctx.lineWidth = 2
    for (let x = 0; x <= w; x += px * 2) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let y = 0; y <= h; y += px * 2) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }
    for (let rx = 0; rx < cols; rx++) {
      const y = drip[rx] * pitch
      ctx.fillStyle = 'rgba(30,60,10,0.35)'
      ctx.fillRect(rx * pitch, y, pitch, 4)
      hctx.fillStyle = '#000'
      hctx.fillRect(rx * pitch, y, pitch, 3)
    }
    for (let ry = 0; ry < rows; ry++) {
      for (let rx = 0; rx < cols; rx++) {
        const isGrass = ry < drip[rx]
        const block = Math.floor(rx / 4) + Math.floor(ry / 4)
        const base = isGrass ? (block % 2 ? grassAlt : grass) : block % 2 ? dirtAlt : dirt
        stud(ctx, hctx, rx * pitch + pitch / 2, ry * pitch + pitch / 2, pitch * 0.3, base)
      }
    }
    // Ambient occlusion where the wall meets the floor.
    const g = ctx.createLinearGradient(0, h - px * 1.2, 0, h)
    g.addColorStop(0, 'rgba(0,0,0,0)')
    g.addColorStop(1, 'rgba(0,0,0,0.3)')
    ctx.fillStyle = g
    ctx.fillRect(0, h - px * 1.2, w, px * 1.2)
    return { color: c, normal: rectNormal(toHeights(hc), w, h), w, h }
  })
}

// heightToNormal works on square fields; the cliff face is not square.
export function rectNormal(heights, w, h, strength = 1.4) {
  const c = canvas(w, h)
  const ctx = c.getContext('2d')
  const img = ctx.createImageData(w, h)
  const H = (x, y) => heights[((y + h) % h) * w + ((x + w) % w)]
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (H(x + 1, y) - H(x - 1, y)) * strength * 2
      const dy = (H(x, y + 1) - H(x, y - 1)) * strength * 2
      let nx = -dx
      let ny = dy
      const len = Math.hypot(nx, ny, 1)
      const i = (y * w + x) * 4
      img.data[i] = (nx / len * 0.5 + 0.5) * 255
      img.data[i + 1] = (ny / len * 0.5 + 0.5) * 255
      img.data[i + 2] = (1 / len * 0.5 + 0.5) * 255
      img.data[i + 3] = 255
    }
  }
  ctx.putImageData(img, 0, 0)
  return c
}

export const cliffMaps = (opts) => paintCliff(opts)

// The road: warm yellow-orange bricks with studs (tiles 4 m).
export const roadMaps = () => paintStuds({ a: '#ffbe3b', b: '#f7b22c', seam: 0.12, seed: 5 })

// --- Faces -----------------------------------------------------------------------------
// A baddie face on a transparent 256 canvas: big glossy anime eyes in the iris colour
// (two highlights, lower lashes, a lash flick), brows, blush and a mouth. style picks her
// resting expression (0 calm, 1 open smile, 2 smirk, 3 happy ^ ^); mood swaps it for an
// animation frame: 'blink' (closed lids), 'kiss' (wink + puckered lips), 'shy' (looking
// away, heavy blush), 'love' (heart eyes), 'happy' (^ ^ and an open smile).
export function paintFace(eyes, style = 0, mood = 'open') {
  return cached(`face|${eyes}|${style}|${mood}`, () => {
    const s = 256
    const c = canvas(s)
    const ctx = c.getContext('2d')
    const ink = '#1a1018'
    const closed = (cx, up = true) => {
      ctx.strokeStyle = ink
      ctx.lineWidth = 9
      ctx.lineCap = 'round'
      ctx.beginPath()
      if (up) ctx.arc(cx, 142, 24, Math.PI * 1.15, Math.PI * 1.85)
      else ctx.arc(cx, 118, 26, Math.PI * 0.2, Math.PI * 0.8)
      ctx.stroke()
      ctx.lineWidth = 5
      for (const k of [-1, 1]) {
        ctx.beginPath()
        ctx.moveTo(cx + k * 22, up ? 128 : 136)
        ctx.lineTo(cx + k * 32, up ? 120 : 146)
        ctx.stroke()
      }
    }
    const heartEye = (cx) => {
      ctx.fillStyle = '#ff3b78'
      ctx.beginPath()
      const y = 128
      ctx.moveTo(cx, y + 30)
      ctx.bezierCurveTo(cx - 44, y + 2, cx - 22, y - 34, cx, y - 12)
      ctx.bezierCurveTo(cx + 22, y - 34, cx + 44, y + 2, cx, y + 30)
      ctx.fill()
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(cx - 12, y - 8, 7, 9, -0.4, 0, Math.PI * 2)
      ctx.fill()
    }
    const eye = (ex, flip, look = 0) => {
      const ey = 128
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ex, ey, 30, 38, 0, 0, Math.PI * 2)
      ctx.fill()
      const ix = ex + (flip ? -2 : 2) + look
      const g = ctx.createLinearGradient(0, ey - 34, 0, ey + 34)
      g.addColorStop(0, shade(eyes, -0.5))
      g.addColorStop(0.5, eyes)
      g.addColorStop(1, shade(eyes, 0.55))
      ctx.fillStyle = g
      ctx.beginPath()
      ctx.ellipse(ix, ey + 3, 23, 33, 0, 0, Math.PI * 2)
      ctx.fill()
      // A lighter ring low in the iris and the pupil.
      ctx.strokeStyle = shade(eyes, 0.7)
      ctx.globalAlpha = 0.55
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.ellipse(ix, ey + 6, 16, 24, 0, Math.PI * 0.1, Math.PI * 0.9)
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.fillStyle = shade(eyes, -0.75)
      ctx.beginPath()
      ctx.ellipse(ix, ey + 4, 10, 15, 0, 0, Math.PI * 2)
      ctx.fill()
      // Highlights.
      ctx.fillStyle = '#ffffff'
      ctx.beginPath()
      ctx.ellipse(ix + (flip ? -10 : 8), ey - 12, 9, 11, 0, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 0.85
      ctx.beginPath()
      ctx.arc(ix + (flip ? 8 : -8), ey + 16, 4.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
      // Upper lash line, a flick at the outer corner, a short lower lash.
      ctx.strokeStyle = ink
      ctx.lineWidth = 10
      ctx.lineCap = 'round'
      ctx.beginPath()
      ctx.ellipse(ex, ey + 2, 33, 40, 0, Math.PI * 1.08, Math.PI * 1.92)
      ctx.stroke()
      const tip = flip ? -1 : 1
      ctx.lineWidth = 6
      ctx.beginPath()
      ctx.moveTo(ex + tip * 30, ey - 20)
      ctx.lineTo(ex + tip * 44, ey - 31)
      ctx.moveTo(ex + tip * 33, ey - 10)
      ctx.lineTo(ex + tip * 45, ey - 15)
      ctx.stroke()
      ctx.lineWidth = 3
      ctx.globalAlpha = 0.6
      ctx.beginPath()
      ctx.ellipse(ex, ey - 2, 30, 40, 0, Math.PI * 0.3, Math.PI * 0.7)
      ctx.stroke()
      ctx.globalAlpha = 1
    }
    const lookAway = mood === 'shy' ? 6 : 0
    if (mood === 'love') {
      heartEye(84)
      heartEye(172)
    } else if (mood === 'blink') {
      closed(84, false)
      closed(172, false)
    } else if (mood === 'kiss') {
      eye(84, true)
      closed(172, true)
    } else if ((style === 3 && mood === 'open') || mood === 'happy') {
      closed(84)
      closed(172)
    } else {
      eye(84, true, lookAway)
      eye(172, false, lookAway)
    }
    // Brows.
    ctx.strokeStyle = 'rgba(40,20,20,0.75)'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    const browTilt = mood === 'shy' ? -8 : style === 2 ? 8 : -2
    ctx.beginPath()
    ctx.moveTo(60, 76 - browTilt)
    ctx.lineTo(104, 72 + browTilt)
    ctx.moveTo(152, 72 + browTilt)
    ctx.lineTo(196, 76 - browTilt)
    ctx.stroke()
    // Blush (heavier when shy or in love), with little diagonal hatch marks.
    const hot = mood === 'shy' || mood === 'love' || mood === 'kiss'
    ctx.fillStyle = hot ? 'rgba(255,70,110,0.55)' : 'rgba(255,90,120,0.32)'
    for (const cx of [62, 194]) {
      ctx.beginPath()
      ctx.ellipse(cx, 184, hot ? 28 : 22, hot ? 14 : 11, 0, 0, Math.PI * 2)
      ctx.fill()
      if (hot) {
        ctx.strokeStyle = 'rgba(255,255,255,0.7)'
        ctx.lineWidth = 3
        for (let k = -1; k <= 1; k++) {
          ctx.beginPath()
          ctx.moveTo(cx + k * 10 - 4, 190)
          ctx.lineTo(cx + k * 10 + 4, 178)
          ctx.stroke()
        }
      }
    }
    // Mouth.
    ctx.strokeStyle = '#5a1a24'
    ctx.fillStyle = '#c23a4e'
    ctx.lineWidth = 6
    if (mood === 'kiss') {
      // Puckered "3".
      ctx.beginPath()
      ctx.moveTo(122, 192)
      ctx.quadraticCurveTo(140, 196, 126, 204)
      ctx.quadraticCurveTo(140, 212, 122, 216)
      ctx.stroke()
    } else if (mood === 'shy') {
      ctx.beginPath()
      ctx.moveTo(116, 204)
      ctx.quadraticCurveTo(122, 198, 128, 204)
      ctx.quadraticCurveTo(134, 210, 140, 204)
      ctx.stroke()
    } else if (style === 1 || mood === 'love' || mood === 'happy') {
      ctx.beginPath()
      ctx.moveTo(110, 196)
      ctx.quadraticCurveTo(128, 228, 146, 196)
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
      ctx.fillStyle = '#ff8a9c'
      ctx.beginPath()
      ctx.ellipse(128, 210, 9, 5, 0, 0, Math.PI * 2)
      ctx.fill()
    } else if (style === 2) {
      ctx.beginPath()
      ctx.moveTo(114, 204)
      ctx.quadraticCurveTo(134, 212, 148, 198)
      ctx.stroke()
    } else {
      // Cat mouth.
      ctx.beginPath()
      ctx.moveTo(108, 200)
      ctx.quadraticCurveTo(118, 212, 128, 202)
      ctx.quadraticCurveTo(138, 212, 148, 200)
      ctx.stroke()
    }
    return c
  })
}

// --- Plot badges -----------------------------------------------------------------------
// A round portrait: gradient backdrop, a blocky head with hair and a friendly face, white rim.
export function paintBadge({ skin = '#f2c79a', hair = '#3a2416', shirt = '#3fa6ff', bg = '#2b3a66', img = null } = {}) {
  const s = 256
  const c = canvas(s)
  const ctx = c.getContext('2d')
  ctx.save()
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2)
  ctx.clip()
  const g = ctx.createRadialGradient(s / 2, s * 0.35, 10, s / 2, s / 2, s / 2)
  g.addColorStop(0, shade(bg, 0.35))
  g.addColorStop(1, shade(bg, -0.35))
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  if (img) {
    ctx.drawImage(img, 0, 0, s, s)
  } else {
    // Shoulders.
    ctx.fillStyle = shirt
    ctx.beginPath()
    ctx.roundRect(40, 196, 176, 90, 30)
    ctx.fill()
    // Head.
    ctx.fillStyle = skin
    ctx.beginPath()
    ctx.roundRect(66, 62, 124, 128, 26)
    ctx.fill()
    // Hair cap.
    ctx.fillStyle = hair
    ctx.beginPath()
    ctx.roundRect(58, 44, 140, 56, [30, 30, 10, 10])
    ctx.fill()
    ctx.fillRect(58, 70, 22, 60)
    ctx.fillRect(176, 70, 22, 50)
    // Face.
    ctx.fillStyle = '#1a1414'
    ctx.beginPath()
    ctx.ellipse(104, 128, 8, 12, 0, 0, Math.PI * 2)
    ctx.ellipse(152, 128, 8, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.strokeStyle = '#1a1414'
    ctx.lineWidth = 6
    ctx.lineCap = 'round'
    ctx.beginPath()
    ctx.arc(128, 150, 20, Math.PI * 0.15, Math.PI * 0.85)
    ctx.stroke()
  }
  ctx.restore()
  // Rim.
  ctx.lineWidth = 12
  ctx.strokeStyle = '#ffe6ef'
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 10, 0, Math.PI * 2)
  ctx.stroke()
  ctx.lineWidth = 3
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.beginPath()
  ctx.arc(s / 2, s / 2, s / 2 - 3, 0, Math.PI * 2)
  ctx.stroke()
  return c
}

// --- Leaderboards ----------------------------------------------------------------------
// rows: [{ name, value, me }], drawn on a navy screen with medal ranks.
export function paintBoard(c, rows, { footer = 'Updates every minute' } = {}) {
  const w = c.width
  const h = c.height
  const ctx = c.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, 0, h)
  g.addColorStop(0, '#1d2750')
  g.addColorStop(1, '#131a38')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  const rowH = (h - 70) / 10
  ctx.textBaseline = 'middle'
  rows.slice(0, 10).forEach((r, i) => {
    const y = 18 + i * rowH
    ctx.fillStyle = r.me ? 'rgba(255,220,80,0.22)' : i % 2 ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.08)'
    ctx.fillRect(12, y + 2, w - 24, rowH - 4)
    const medal = ['#ffcc33', '#d6dde6', '#e08a4a'][i]
    ctx.fillStyle = medal ?? 'rgba(255,255,255,0.0)'
    ctx.beginPath()
    ctx.arc(40, y + rowH / 2, rowH * 0.32, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = medal ? '#2a1a00' : '#c9d3ff'
    ctx.font = `700 ${Math.round(rowH * 0.42)}px Fredoka, sans-serif`
    ctx.textAlign = 'center'
    ctx.fillText(String(i + 1), 40, y + rowH / 2 + 1)
    // Little avatar dot.
    ctx.fillStyle = r.color ?? '#7fa8ff'
    ctx.beginPath()
    ctx.arc(80, y + rowH / 2, rowH * 0.26, 0, Math.PI * 2)
    ctx.fill()
    ctx.textAlign = 'left'
    ctx.fillStyle = r.me ? '#ffe680' : '#ffffff'
    ctx.font = `600 ${Math.round(rowH * 0.44)}px Fredoka, sans-serif`
    let name = r.name
    while (ctx.measureText(name).width > w * 0.5 && name.length > 4) name = name.slice(0, -2)
    if (name !== r.name) name += '...'
    ctx.fillText(name, 102, y + rowH / 2 + 1)
    ctx.textAlign = 'right'
    ctx.fillStyle = r.valueColor ?? '#9dff6a'
    ctx.fillText(r.value, w - 26, y + rowH / 2 + 1)
  })
  ctx.textAlign = 'center'
  ctx.fillStyle = 'rgba(255,255,255,0.55)'
  ctx.font = '500 22px Fredoka, sans-serif'
  ctx.fillText(footer, w / 2, h - 26)
}

// A wooden plank sign face: brown boards with a darker frame (for pen signs).
export function paintPlanks(w = 256, h = 128, base = '#c98a4b') {
  return cached(`planks|${w}|${h}|${base}`, () => {
    const c = canvas(w, h)
    const ctx = c.getContext('2d')
    ctx.fillStyle = base
    ctx.fillRect(0, 0, w, h)
    const rand = mulberry32(42)
    for (let y = 0; y < h; y += h / 4) {
      ctx.fillStyle = `rgba(0,0,0,${0.05 + rand() * 0.08})`
      ctx.fillRect(0, y, w, h / 4)
      ctx.fillStyle = 'rgba(0,0,0,0.25)'
      ctx.fillRect(0, y, w, 2)
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = 'rgba(90,50,20,0.25)'
        ctx.fillRect(rand() * w, y + rand() * (h / 4), 20 + rand() * 60, 1.5)
      }
    }
    return c
  })
}
