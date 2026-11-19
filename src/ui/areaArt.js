// Painted scenery for the Index: one tall picture per lane area (a path through a meadow, a
// red barn and wheat, a willow and a pier on a lake, a desert arch, ice peaks, an autumn tree,
// a crystal waterfall, a beach sunset, a coral reef, a gate in the clouds, a lava gate, a
// cosmic portal). Drawn once on a canvas and kept as a data URL.
const W = 200
const H = 360
const cache = new Map()

function grad(x, y0, y1, stops) {
  const g = x.createLinearGradient(0, y0, 0, y1)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  return g
}
function rgrad(x, cx, cy, r, stops) {
  const g = x.createRadialGradient(cx, cy, 0, cx, cy, r)
  stops.forEach((c, i) => g.addColorStop(i / (stops.length - 1), c))
  return g
}
function sky(x, stops) {
  x.fillStyle = grad(x, 0, H, stops)
  x.fillRect(0, 0, W, H)
}
function hill(x, y, amp, color, seed = 1) {
  x.fillStyle = color
  x.beginPath()
  x.moveTo(0, H)
  for (let i = 0; i <= 20; i++) x.lineTo((i / 20) * W, y + Math.sin(i * 0.7 + seed) * amp + Math.sin(i * 1.9 + seed * 2) * amp * 0.4)
  x.lineTo(W, H)
  x.fill()
}
function cloud(x, cx, cy, s, color = 'rgba(255,255,255,0.95)') {
  x.fillStyle = color
  for (const [dx, dy, r] of [[-1, 0.2, 0.7], [0, -0.2, 1], [1, 0.2, 0.75], [0.4, 0.4, 0.6], [-0.5, 0.45, 0.55]]) {
    x.beginPath()
    x.arc(cx + dx * s, cy + dy * s, r * s, 0, Math.PI * 2)
    x.fill()
  }
}
function path(x, top, wTop, wBot, color, edge) {
  x.fillStyle = color
  x.beginPath()
  x.moveTo(W / 2 - wTop, top)
  x.bezierCurveTo(W * 0.2, top + 80, W * 0.85, top + 140, W / 2 - wBot, H)
  x.lineTo(W / 2 + wBot, H)
  x.bezierCurveTo(W * 1.1, top + 150, W * 0.35, top + 80, W / 2 + wTop, top)
  x.fill()
  if (edge) {
    x.strokeStyle = edge
    x.lineWidth = 3
    x.stroke()
  }
}
function tree(x, cx, by, s, leaf, trunk = '#7a4b29') {
  x.fillStyle = trunk
  x.fillRect(cx - 5 * s, by - 50 * s, 10 * s, 50 * s)
  x.fillStyle = leaf
  for (const [dx, dy, r] of [[0, -70, 30], [-22, -55, 22], [22, -55, 22], [0, -95, 22], [-14, -82, 18], [14, -82, 18]]) {
    x.beginPath()
    x.arc(cx + dx * s, by + dy * s, r * s, 0, Math.PI * 2)
    x.fill()
  }
}
function sparkles(x, n, color, y0 = 0, y1 = H, seed = 3) {
  x.fillStyle = color
  for (let i = 0; i < n; i++) {
    const px = ((i * 73 + seed * 31) % 197) + 1
    const py = y0 + (((i * 131 + seed * 17) % 1000) / 1000) * (y1 - y0)
    const r = 1 + ((i * 7) % 3)
    x.beginPath()
    x.moveTo(px, py - r * 2)
    x.lineTo(px + r * 0.6, py)
    x.lineTo(px, py + r * 2)
    x.lineTo(px - r * 0.6, py)
    x.fill()
    x.fillRect(px - r * 2, py - 0.5, r * 4, 1)
  }
}

const PAINT = {
  meadow(x) {
    sky(x, ['#5ab8ff', '#bfe8ff', '#e8f8ff'])
    cloud(x, 50, 50, 16)
    cloud(x, 150, 90, 12)
    hill(x, 170, 10, '#8fd86a', 1)
    hill(x, 210, 8, '#6fc84a', 2)
    tree(x, 150, 220, 1.1, '#4fae3a')
    path(x, 200, 6, 60, '#e8c890', '#c8a070')
    for (let i = 0; i < 30; i++) {
      x.fillStyle = ['#ff8ac0', '#fff27a', '#ffffff'][i % 3]
      x.beginPath()
      x.arc((i * 47) % W, 230 + ((i * 89) % 120), 3, 0, Math.PI * 2)
      x.fill()
    }
  },
  farm(x) {
    sky(x, ['#7ac8ff', '#ffe8b8'])
    x.fillStyle = rgrad(x, 160, 60, 40, ['#fff6c0', 'rgba(255,240,180,0)'])
    x.fillRect(0, 0, W, 140)
    hill(x, 175, 6, '#9ed06a', 3)
    // Barn.
    x.fillStyle = '#c83a2a'
    x.fillRect(40, 120, 110, 80)
    x.fillStyle = '#a82a1a'
    x.beginPath()
    x.moveTo(30, 122)
    x.lineTo(95, 80)
    x.lineTo(160, 122)
    x.fill()
    x.fillStyle = '#ffffff'
    x.fillRect(78, 150, 34, 50)
    x.strokeStyle = '#ffffff'
    x.lineWidth = 4
    x.strokeRect(78, 150, 34, 50)
    x.beginPath()
    x.moveTo(78, 150)
    x.lineTo(112, 200)
    x.moveTo(112, 150)
    x.lineTo(78, 200)
    x.stroke()
    x.fillStyle = '#fff6e0'
    x.fillRect(86, 104, 18, 14)
    // Wheat field and a path.
    x.fillStyle = grad(x, 200, H, ['#f2c84a', '#e8a830'])
    x.fillRect(0, 200, W, H)
    path(x, 200, 8, 48, '#c8905a')
    for (let i = 0; i < 60; i++) {
      x.strokeStyle = i % 2 ? '#ffd85a' : '#d9a830'
      x.lineWidth = 2
      const px = (i * 37) % W
      const py = 215 + ((i * 53) % 140)
      x.beginPath()
      x.moveTo(px, py)
      x.lineTo(px + 2, py - 14)
      x.stroke()
    }
  },
  lake(x) {
    sky(x, ['#6ac0ff', '#d8f0ff'])
    hill(x, 150, 6, '#7bc04a', 4)
    x.fillStyle = grad(x, 170, H, ['#5ac8e8', '#2a8ac0'])
    x.fillRect(0, 170, W, H)
    for (let i = 0; i < 12; i++) {
      x.fillStyle = 'rgba(255,255,255,0.35)'
      x.fillRect((i * 61) % W, 185 + i * 14, 30, 2)
    }
    // Willow.
    x.fillStyle = '#6a4a2a'
    x.fillRect(22, 70, 12, 110)
    x.fillStyle = '#8ad04a'
    x.beginPath()
    x.arc(40, 70, 50, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = '#9be05a'
    x.lineWidth = 3
    for (let i = 0; i < 16; i++) {
      x.beginPath()
      x.moveTo(i * 6, 80)
      x.quadraticCurveTo(i * 6 + 4, 130, i * 6 - 2, 170)
      x.stroke()
    }
    // Pier.
    x.fillStyle = '#b07a44'
    x.beginPath()
    x.moveTo(60, 250)
    x.lineTo(150, 230)
    x.lineTo(170, 260)
    x.lineTo(70, 290)
    x.fill()
    x.fillStyle = '#7a4b29'
    for (const px of [72, 100, 128, 156]) x.fillRect(px, 250, 6, 40)
    x.fillStyle = '#5fbf4a'
    x.beginPath()
    x.ellipse(150, 320, 18, 7, 0, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = '#ff8ac0'
    x.beginPath()
    x.arc(150, 316, 5, 0, Math.PI * 2)
    x.fill()
  },
  desert(x) {
    sky(x, ['#ffb86a', '#ffe0a0', '#fff4d8'])
    x.fillStyle = rgrad(x, 150, 70, 30, ['#ffffff', '#fff2a0', 'rgba(255,240,160,0)'])
    x.fillRect(100, 20, 100, 100)
    hill(x, 200, 12, '#f2c47a', 5)
    // Arch.
    x.fillStyle = '#d97a3a'
    x.fillRect(30, 90, 34, 130)
    x.fillRect(130, 100, 34, 120)
    x.beginPath()
    x.moveTo(30, 100)
    x.quadraticCurveTo(97, 20, 164, 110)
    x.lineTo(164, 135)
    x.quadraticCurveTo(97, 60, 64, 120)
    x.lineTo(30, 120)
    x.fill()
    x.fillStyle = 'rgba(160,70,30,0.35)'
    x.fillRect(30, 140, 34, 6)
    x.fillRect(130, 150, 34, 6)
    x.fillStyle = grad(x, 220, H, ['#f2d28c', '#e8b870'])
    x.fillRect(0, 220, W, H)
    path(x, 220, 6, 50, '#f8e0a8')
    x.fillStyle = '#4fa83a'
    x.fillRect(165, 250, 10, 50)
    x.fillRect(155, 262, 10, 6)
    x.fillRect(153, 248, 6, 18)
  },
  snow(x) {
    sky(x, ['#7ab0e8', '#d8ecff'])
    x.fillStyle = '#e8f4ff'
    x.beginPath()
    x.moveTo(-20, 220)
    x.lineTo(60, 60)
    x.lineTo(120, 200)
    x.fill()
    x.fillStyle = '#c8e0f8'
    x.beginPath()
    x.moveTo(60, 230)
    x.lineTo(150, 90)
    x.lineTo(230, 230)
    x.fill()
    // Ice spires.
    x.fillStyle = grad(x, 120, 260, ['#bfeaff', '#7ac8f0'])
    for (const [px, h] of [[40, 120], [70, 160], [110, 110], [150, 140]]) {
      x.beginPath()
      x.moveTo(px - 18, 260)
      x.lineTo(px, 260 - h)
      x.lineTo(px + 18, 260)
      x.fill()
    }
    x.fillStyle = grad(x, 250, H, ['#ffffff', '#e0f0fa'])
    x.fillRect(0, 250, W, H)
    path(x, 250, 6, 50, '#d8ecf8')
    for (let i = 0; i < 40; i++) {
      x.fillStyle = 'rgba(255,255,255,0.9)'
      x.beginPath()
      x.arc((i * 53) % W, (i * 97) % H, 1.5 + (i % 3), 0, Math.PI * 2)
      x.fill()
    }
  },
  autumn(x) {
    sky(x, ['#8ac8ff', '#ffe8c8'])
    hill(x, 190, 8, '#c8a050', 6)
    x.fillStyle = '#5ab0d8'
    x.fillRect(0, 200, W, 30)
    tree(x, 80, 260, 1.6, '#ff7a2a', '#6b3f22')
    x.fillStyle = '#ffa83a'
    for (const [dx, dy, r] of [[-30, -130, 24], [30, -140, 22], [0, -160, 20]]) {
      x.beginPath()
      x.arc(80 + dx, 260 + dy, r, 0, Math.PI * 2)
      x.fill()
    }
    x.fillStyle = grad(x, 250, H, ['#d8b060', '#b88a3a'])
    x.fillRect(0, 255, W, H)
    path(x, 255, 6, 50, '#e8c890')
    for (let i = 0; i < 26; i++) {
      x.fillStyle = ['#ff7a2a', '#e8502a', '#ffc23a'][i % 3]
      x.save()
      x.translate((i * 41) % W, 200 + ((i * 67) % 160))
      x.rotate(i)
      x.fillRect(-4, -2, 8, 4)
      x.restore()
    }
  },
  crystal(x) {
    sky(x, ['#1a3a6a', '#3a7ab0', '#7ae8ff'])
    // Waterfall.
    x.fillStyle = grad(x, 0, 260, ['#bff4ff', '#5ad0ff'])
    x.fillRect(70, 0, 60, 260)
    x.fillStyle = 'rgba(255,255,255,0.5)'
    for (let i = 0; i < 8; i++) x.fillRect(74 + i * 7, 0, 2, 260)
    x.fillStyle = '#2a4a7a'
    x.fillRect(0, 0, 70, 260)
    x.fillRect(130, 0, 70, 260)
    // Crystals.
    const cols = ['#7ae8ff', '#c8a0ff', '#ff9bd2']
    for (let i = 0; i < 9; i++) {
      x.fillStyle = cols[i % 3]
      const px = i < 5 ? 8 + i * 13 : 136 + (i - 5) * 15
      const h = 30 + ((i * 23) % 40)
      x.beginPath()
      x.moveTo(px - 7, 260)
      x.lineTo(px, 260 - h)
      x.lineTo(px + 7, 260)
      x.fill()
    }
    x.fillStyle = grad(x, 255, H, ['#5ad0ff', '#2a7ac0'])
    x.fillRect(0, 255, W, H)
    sparkles(x, 30, 'rgba(255,255,255,0.95)', 0, H, 7)
  },
  beach(x) {
    sky(x, ['#5a3a8a', '#ff7a5a', '#ffc070'])
    x.fillStyle = rgrad(x, 100, 190, 60, ['#fff6c0', '#ffb04a', 'rgba(255,140,60,0)'])
    x.fillRect(0, 100, W, 160)
    x.fillStyle = '#ffd25a'
    x.beginPath()
    x.arc(100, 190, 34, Math.PI, 0)
    x.fill()
    x.fillStyle = grad(x, 190, 280, ['#ff8a5a', '#a03a6a'])
    x.fillRect(0, 190, W, 90)
    for (let i = 0; i < 10; i++) {
      x.fillStyle = 'rgba(255,220,140,0.6)'
      x.fillRect(100 - 40 + (i % 3) * 10, 196 + i * 8, 80 - i * 6, 2)
    }
    x.fillStyle = grad(x, 280, H, ['#f8d0a0', '#e8b07a'])
    x.fillRect(0, 280, W, H)
    // Palm silhouette.
    x.strokeStyle = '#3a1a3a'
    x.lineWidth = 7
    x.beginPath()
    x.moveTo(170, 330)
    x.quadraticCurveTo(160, 220, 180, 140)
    x.stroke()
    x.fillStyle = '#3a1a3a'
    for (let i = 0; i < 6; i++) {
      x.save()
      x.translate(180, 140)
      x.rotate(-2.6 + i * 0.75)
      x.beginPath()
      x.ellipse(28, 0, 30, 6, 0, 0, Math.PI * 2)
      x.fill()
      x.restore()
    }
  },
  reef(x) {
    sky(x, ['#5ae0ff', '#1a8ac8', '#0a3a7a'])
    x.fillStyle = 'rgba(255,255,255,0.18)'
    for (let i = 0; i < 6; i++) {
      x.beginPath()
      x.moveTo(20 + i * 35, 0)
      x.lineTo(40 + i * 35, 0)
      x.lineTo(i * 35 - 20, H)
      x.lineTo(i * 35 - 40, H)
      x.fill()
    }
    x.fillStyle = '#e8d8a8'
    x.fillRect(0, 300, W, H)
    const cols = ['#ff6f61', '#ff9bd2', '#ffaa33', '#b07cff']
    for (let i = 0; i < 8; i++) {
      x.strokeStyle = cols[i % 4]
      x.lineWidth = 6
      const px = 12 + i * 25
      x.beginPath()
      x.moveTo(px, 305)
      x.lineTo(px - 6, 270 - (i % 3) * 10)
      x.moveTo(px, 290)
      x.lineTo(px + 10, 262 - (i % 2) * 12)
      x.stroke()
    }
    x.strokeStyle = '#2fae6a'
    x.lineWidth = 5
    for (const px of [30, 110, 175]) {
      x.beginPath()
      x.moveTo(px, 305)
      x.bezierCurveTo(px - 12, 250, px + 12, 210, px - 4, 170)
      x.stroke()
    }
    for (let i = 0; i < 20; i++) {
      x.strokeStyle = 'rgba(255,255,255,0.8)'
      x.lineWidth = 1.5
      x.beginPath()
      x.arc((i * 61) % W, (i * 37) % 280, 2 + (i % 4), 0, Math.PI * 2)
      x.stroke()
    }
  },
  heaven(x) {
    sky(x, ['#fff8d8', '#ffeec0', '#ffffff'])
    x.fillStyle = rgrad(x, 100, 110, 110, ['rgba(255,255,255,1)', 'rgba(255,230,150,0.6)', 'rgba(255,240,200,0)'])
    x.fillRect(0, 0, W, 260)
    for (let i = 0; i < 12; i++) {
      x.fillStyle = 'rgba(255,230,140,0.25)'
      x.beginPath()
      x.moveTo(100, 110)
      const a = -Math.PI / 2 + (i - 6) * 0.22
      x.lineTo(100 + Math.cos(a - 0.05) * 300, 110 + Math.sin(a - 0.05) * 300)
      x.lineTo(100 + Math.cos(a + 0.05) * 300, 110 + Math.sin(a + 0.05) * 300)
      x.fill()
    }
    // Gate.
    x.strokeStyle = '#e8b040'
    x.lineWidth = 8
    x.beginPath()
    x.moveTo(55, 210)
    x.lineTo(55, 110)
    x.arc(100, 110, 45, Math.PI, 0)
    x.lineTo(145, 210)
    x.stroke()
    x.fillStyle = 'rgba(255,250,220,0.85)'
    x.fillRect(59, 110, 82, 100)
    // Stairs.
    for (let i = 0; i < 9; i++) {
      x.fillStyle = i % 2 ? '#fff4d8' : '#ffffff'
      const w = 50 + i * 12
      x.fillRect(100 - w / 2, 210 + i * 16, w, 16)
    }
    cloud(x, 25, 230, 22)
    cloud(x, 175, 240, 24)
    cloud(x, 30, 330, 28)
    cloud(x, 170, 335, 28)
  },
  lava(x) {
    sky(x, ['#2a0a0a', '#7a1a0a', '#ff5a1a'])
    // Demon gate.
    x.fillStyle = '#3a1a1a'
    x.fillRect(35, 70, 130, 170)
    x.fillStyle = rgrad(x, 100, 190, 60, ['#fff2a0', '#ff7a1a', '#a01a0a'])
    x.beginPath()
    x.moveTo(60, 240)
    x.lineTo(60, 160)
    x.arc(100, 160, 40, Math.PI, 0)
    x.lineTo(140, 240)
    x.fill()
    x.fillStyle = '#2a0a0a'
    x.beginPath()
    x.moveTo(35, 80)
    x.lineTo(15, 30)
    x.lineTo(55, 70)
    x.moveTo(165, 80)
    x.lineTo(185, 30)
    x.lineTo(145, 70)
    x.fill()
    x.fillStyle = '#ffcc33'
    x.beginPath()
    x.ellipse(78, 110, 10, 6, 0.3, 0, Math.PI * 2)
    x.ellipse(122, 110, 10, 6, -0.3, 0, Math.PI * 2)
    x.fill()
    x.fillStyle = grad(x, 240, H, ['#3a1a1a', '#1a0a0a'])
    x.fillRect(0, 240, W, H)
    // A winding lava path.
    path(x, 240, 10, 55, '#ff6a1a', '#ffcc33')
    sparkles(x, 24, 'rgba(255,200,80,0.9)', 0, 240, 9)
  },
  cosmic(x) {
    sky(x, ['#0a0620', '#2a1a5a', '#4a2a7a'])
    for (let i = 0; i < 60; i++) {
      x.fillStyle = `rgba(255,255,255,${0.4 + (i % 5) * 0.12})`
      x.fillRect((i * 67) % W, (i * 113) % H, 1.5, 1.5)
    }
    // Ringed planet.
    x.fillStyle = rgrad(x, 140, 60, 32, ['#e8d0ff', '#9a6aff'])
    x.beginPath()
    x.arc(140, 60, 30, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = 'rgba(220,200,255,0.8)'
    x.lineWidth = 4
    x.beginPath()
    x.ellipse(140, 60, 50, 10, -0.3, 0, Math.PI * 2)
    x.stroke()
    // Portal.
    x.fillStyle = rgrad(x, 100, 190, 60, ['#d8fff0', '#3affb0', 'rgba(58,255,176,0)'])
    x.beginPath()
    x.ellipse(100, 190, 50, 70, 0, 0, Math.PI * 2)
    x.fill()
    x.strokeStyle = '#6a5aa0'
    x.lineWidth = 10
    x.beginPath()
    x.ellipse(100, 190, 52, 72, 0, Math.PI * 0.95, Math.PI * 2.05)
    x.stroke()
    x.fillStyle = '#3a2a5a'
    x.fillRect(0, 270, W, H)
    path(x, 265, 8, 50, '#5a3a8a', '#3affb0')
    for (const [px, h, c] of [[20, 50, '#b04aff'], [175, 60, '#3affd0'], [40, 30, '#3affd0']]) {
      x.fillStyle = c
      x.beginPath()
      x.moveTo(px - 8, 300)
      x.lineTo(px, 300 - h)
      x.lineTo(px + 8, 300)
      x.fill()
    }
  },
}

export function areaArt(id) {
  if (!cache.has(id)) {
    const c = document.createElement('canvas')
    c.width = W
    c.height = H
    const x = c.getContext('2d')
    ;(PAINT[id] ?? PAINT.meadow)(x)
    cache.set(id, c.toDataURL('image/png'))
  }
  return cache.get(id)
}
