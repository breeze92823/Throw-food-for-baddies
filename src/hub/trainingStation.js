// The Training Place: two fluted white lego pillars joined by a lintel, a taped steel
// pull-up bar under it, chalk-dusted plinths, a dashed white ring on the grass round
// it and a floating "TRAINING / Lv N" sign. Static parts are vertex-coloured boxes
// merged into one mesh; the ring, the glow disc, the bar and the sign animate.
import { Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, RingGeometry, CircleGeometry, AdditiveBlending } from 'three'
import { TRAINING } from '../config.js'
import { solidBox } from '../propkit.js'
import { cbox, ccyl, merge } from './geo.js'
import { dashedRing } from './props.js'
import { dynLabel } from './dynlabel.js'

const WHITE = '#f6f8fc'
const SHADE = '#dde3ee'
const DEEP = '#c4ccdb'

function pillar(parts, x, h, s) {
  // Plinth: two stepped slabs.
  parts.push(cbox(s + 0.5, 0.22, s + 0.5, SHADE, x, 0.11, 0))
  parts.push(cbox(s + 0.28, 0.2, s + 0.28, WHITE, x, 0.32, 0))
  // Shaft: a square core with raised flutes down every face (lego ridges).
  const y0 = 0.42
  const y1 = h - 0.62
  const sh = y1 - y0
  parts.push(cbox(s, sh, s, WHITE, x, y0 + sh / 2, 0))
  for (const f of [-1, 0, 1]) {
    const o = f * s * 0.3
    parts.push(cbox(0.1, sh - 0.12, 0.06, SHADE, x + o, y0 + sh / 2, s / 2 + 0.02))
    parts.push(cbox(0.1, sh - 0.12, 0.06, SHADE, x + o, y0 + sh / 2, -s / 2 - 0.02))
    parts.push(cbox(0.06, sh - 0.12, 0.1, SHADE, x + s / 2 + 0.02, y0 + sh / 2, o))
    parts.push(cbox(0.06, sh - 0.12, 0.1, SHADE, x - s / 2 - 0.02, y0 + sh / 2, o))
  }
  // A thin collar near the bottom and a stepped capital at the top.
  parts.push(cbox(s + 0.1, 0.1, s + 0.1, DEEP, x, y0 + 0.3, 0))
  parts.push(cbox(s + 0.14, 0.14, s + 0.14, SHADE, x, y1 + 0.07, 0))
  parts.push(cbox(s + 0.34, 0.2, s + 0.34, WHITE, x, y1 + 0.24, 0))
  // Studs on the plinth corners.
  for (const [dx, dz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) parts.push(ccyl(0.07, 0.07, 0.06, WHITE, x + dx * (s / 2 + 0.07), 0.45, dz * (s / 2 + 0.07), 0, 0, 0, 10))
}

export function buildTrainingStation(root) {
  const { spot, pillar: P } = TRAINING
  const g = new Group()
  g.position.set(spot.x, 0, spot.z)
  root.add(g)

  const half = P.gap / 2
  const h = P.height
  const s = P.size
  const parts = []
  pillar(parts, -half, h, s)
  pillar(parts, half, h, s)
  // Lintel across the tops (a white beam with a darker underside strip and end studs).
  parts.push(cbox(P.gap + s + 0.7, 0.42, s + 0.3, WHITE, 0, h - 0.17, 0))
  parts.push(cbox(P.gap + s + 0.5, 0.06, s + 0.1, SHADE, 0, h - 0.4, 0))
  for (let i = -3; i <= 3; i++) parts.push(ccyl(0.11, 0.11, 0.08, WHITE, (i / 3) * (half + s / 2 + 0.15), h + 0.08, 0, 0, 0, 0, 10))
  const stat = new Mesh(merge(parts), new MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }))
  stat.castShadow = true
  stat.receiveShadow = true
  g.add(stat)

  // The pull-up bar: steel with dark grip tape where the hands go, slung under the lintel.
  const barY = h - 0.62
  const barParts = [
    ccyl(0.075, 0.075, P.gap - s + 0.02, '#cfd6e2', 0, 0, 0, 0, 0, Math.PI / 2, 14),
    ccyl(0.088, 0.088, 0.42, '#2a2f3d', -0.42, 0, 0, 0, 0, Math.PI / 2, 14),
    ccyl(0.088, 0.088, 0.42, '#2a2f3d', 0.42, 0, 0, 0, 0, Math.PI / 2, 14),
    ccyl(0.13, 0.13, 0.12, '#9aa4b6', -half + s / 2 + 0.04, 0, 0, 0, 0, Math.PI / 2, 14),
    ccyl(0.13, 0.13, 0.12, '#9aa4b6', half - s / 2 - 0.04, 0, 0, 0, 0, Math.PI / 2, 14),
  ]
  const bar = new Mesh(merge(barParts), new MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.6 }))
  bar.position.y = barY
  bar.castShadow = true
  g.add(bar)

  // Colliders for the two pillars (you stand between them).
  solidBox((s + 0.3) / 2, h / 2, (s + 0.3) / 2, spot.x - half, h / 2, spot.z)
  solidBox((s + 0.3) / 2, h / 2, (s + 0.3) / 2, spot.x + half, h / 2, spot.z)

  // Dashed ring on the grass, a soft glow disc and a pulse ring for each rep.
  const ring = dashedRing(TRAINING.ringR, '#ffffff', 22)
  ring.position.y = 0.02
  g.add(ring)
  const glowMat = new MeshBasicMaterial({ color: '#7dff4a', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })
  const disc = new Mesh(new CircleGeometry(TRAINING.ringR - 0.3, 48).rotateX(-Math.PI / 2), glowMat)
  disc.position.y = 0.05
  disc.renderOrder = 2
  g.add(disc)
  const pulseMat = new MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -5 })
  const pulse = new Mesh(new RingGeometry(0.82, 1, 48).rotateX(-Math.PI / 2), pulseMat)
  pulse.position.y = 0.06
  pulse.renderOrder = 3
  g.add(pulse)

  // Floating sign.
  const sign = dynLabel(0.62, { width: 720, lines: 2 })
  sign.sprite.position.set(0, h + 1.45, 0)
  g.add(sign.sprite)

  let glow = 0
  let pulseT = 1
  let barKick = 0
  return {
    group: g,
    barY,
    // Where the hands grip (world space): the middle of the bar.
    gripY: barY,
    rep() {
      pulseT = 0
      barKick = 1
    },
    update(t, dt, { active = false, boost = false, level = 1, near = false } = {}) {
      ring.rotation.y += dt * (active ? (boost ? 1.6 : 0.8) : 0.18)
      const k = active ? 1 : near ? 0.35 : 0
      glow += (k - glow) * Math.min(1, dt * 4)
      glowMat.opacity = glow * (0.16 + 0.06 * Math.sin(t * 5)) * (boost ? 1.6 : 1)
      glowMat.color.set(boost ? '#ffd23a' : '#7dff4a')
      ring.material.emissiveIntensity = 0.15 + glow * 0.6
      // The rep pulse: a ring sweeping out from your feet.
      pulseT = Math.min(1, pulseT + dt * 1.8)
      const r = 0.6 + pulseT * (TRAINING.ringR - 0.4)
      pulse.scale.set(r, 1, r)
      pulseMat.opacity = (1 - pulseT) * 0.7
      // The bar flexes a little under each pull.
      barKick = Math.max(0, barKick - dt * 3.5)
      bar.position.y = barY - Math.sin(barKick * Math.PI) * 0.04
      sign.sprite.position.y = h + 1.45 + Math.sin(t * 1.6) * 0.08
      sign.set([
        { text: 'TRAINING', color: '#ffd23a' },
        { text: `Lv ${level}  +${TRAINING.strengthPerLevel} Strength`, color: '#7dff4a', scale: 0.72 },
      ])
    },
  }
}
