// A world-space text sprite whose lines can change (pad totals, plot income, timers).
// Repaints its own canvas only when the text actually changes.
import { CanvasTexture, Sprite, SpriteMaterial, SRGBColorSpace } from 'three'
import { fontReady } from '../propkit.js'

export function dynLabel(lineHeight = 0.7, { width = 640, lines = 2, outline = '#10131f', font = 700 } = {}) {
  const c = document.createElement('canvas')
  const px = 96
  c.width = width
  c.height = Math.ceil(px * 1.25 * lines + 24)
  const tex = new CanvasTexture(c)
  tex.colorSpace = SRGBColorSpace
  const sprite = new Sprite(new SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false }))
  sprite.scale.set((lineHeight * lines * c.width) / (c.height - 24), lineHeight * lines, 1)
  sprite.renderOrder = 6
  let key = ''
  let last = null
  function draw(rows) {
    const ctx = c.getContext('2d')
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.lineJoin = 'round'
    rows.forEach((r, i) => {
      if (!r) return
      const size = Math.round(px * (r.scale ?? 1))
      ctx.font = `${font} ${size}px Fredoka, "Arial Black", sans-serif`
      let w = ctx.measureText(r.text).width
      const fit = Math.min(1, (c.width - 30) / Math.max(1, w))
      if (fit < 1) ctx.font = `${font} ${Math.floor(size * fit)}px Fredoka, "Arial Black", sans-serif`
      const y = 12 + px * 1.25 * (i + 0.5)
      ctx.lineWidth = 18
      ctx.strokeStyle = r.outline ?? outline
      ctx.strokeText(r.text, c.width / 2, y)
      ctx.fillStyle = r.color ?? '#ffffff'
      ctx.fillText(r.text, c.width / 2, y)
    })
    tex.needsUpdate = true
  }
  fontReady.then(() => last && draw(last))
  return {
    sprite,
    // rows: [{ text, color, outline?, scale? }] (null rows leave a gap)
    set(rows) {
      const k = rows.map((r) => (r ? `${r.text}|${r.color}` : '-')).join('/')
      if (k === key) return
      key = k
      last = rows
      draw(rows)
    },
  }
}
