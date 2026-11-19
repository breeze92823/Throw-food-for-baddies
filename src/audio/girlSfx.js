// The girls' sounds, synthesised like the rest (sfx.js): a blown kiss is a lip "pop" (a
// short bandpassed noise smack over a falling sine) followed by a sparkly rising chime, the
// heart pose a warm two-note bell with a shimmer, a twirl a whoosh under a glissando, a wave
// a light "hi!" chirp, the shy sway a breathy giggle made of quick vibrato blips, the curtsy
// a little music-box phrase. The Index gets a page sound, a card select, a NEW discovery
// sting and an area-complete fanfare. Everything returns quietly when audio is off, and the
// pen sounds are rate-limited so a crowd of girls never turns into noise.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { bubble, burst, crinkle, modal, rnd, tone, vary } from './synth.js'

const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const GLASS = [[1, 1, 0.45], [2.32, 0.5, 0.28], [4.25, 0.28, 0.16], [6.63, 0.14, 0.1]]
const BOX = [[1, 1, 0.9], [3.9, 0.25, 0.3], [9.2, 0.08, 0.12]] // music-box tine
const semi = (n) => Math.pow(2, n / 12)
const C6 = 1046.5

const lastAt = new Map()
function limit(name, ms) {
  const t = performance.now()
  if (t - (lastAt.get(name) ?? -1e9) < ms) return false
  lastAt.set(name, t)
  return true
}
function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}
function glock(t, notes, gap, gain = 0.1, verb = 0.35, pan = 0, bus = A.sfx) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan, verb, bus }))
}
// Sparkle dust: a few random high glass pings.
function shimmer(t, n, dur, gain = 0.02, pan = 0) {
  for (let i = 0; i < n; i++) modal({ t: t + Math.random() * dur, f: rnd(3000, 7000), modes: GLASS, gain, decay: 0.5, pan: pan + rnd(-0.3, 0.3), verb: 0.4 })
}
const ok = (name, ms, cost = 1, max = 3) => !!A.ctx && limit(name, ms) && voice(cost, max)

// A blown kiss: "mwah" then a rising sparkle as the heart flies.
export function kiss(pan = 0, gain = 1) {
  if (!ok('kiss', 450, 1.2, 3)) return
  const t = now()
  burst({ t, type: 'bandpass', f: vary(1800, 0.1), q: 3, a: 0.002, d: 0.035, gain: 0.32 * gain, pan })
  tone({ t, f: vary(620, 0.06), f2: 380, d: 0.09, gain: 0.12 * gain, pan, lp: 1800 })
  tone({ t: t + 0.06, type: 'triangle', f: 700, f2: 1400, glide: 0.25, a: 0.02, d: 0.2, gain: 0.05 * gain, pan, lp: 3000 })
  glock(t + 0.12, [12, 16, 19, 24], 0.045, 0.07 * gain, 0.45, pan)
  shimmer(t + 0.2, 5, 0.5, 0.018 * gain, pan)
}

// Heart hands: a warm bell pair and a shimmer.
export function heart(pan = 0, gain = 1) {
  if (!ok('heart', 600, 1.2, 3)) return
  const t = now()
  modal({ t, f: 784, modes: BELL, gain: 0.08 * gain, beat: 3, strike: 0.15, verb: 0.45, pan })
  modal({ t: t + 0.14, f: 1047, modes: BELL, gain: 0.07 * gain, beat: 3, strike: 0.15, verb: 0.45, pan })
  bubble({ t: t + 0.05, f: 600, d: 0.08, gain: 0.12 * gain, rise: 1.3, pan })
  shimmer(t + 0.1, 6, 0.6, 0.016 * gain, pan)
}

// A twirl: whoosh plus a glissando.
export function twirl(pan = 0, gain = 1) {
  if (!ok('twirl', 600, 1, 3)) return
  const t = now()
  burst({ t, noise: 'pink', f: 500, f2: 3000, q: 1.2, a: 0.2, d: 0.4, gain: 0.12 * gain, pan })
  glock(t + 0.05, [0, 4, 7, 12, 16, 19], 0.06, 0.06 * gain, 0.4, pan)
}

// A wave: a light two-note "hi!".
export function wave(pan = 0, gain = 1) {
  if (!ok('wave', 500, 0.6, 3)) return
  const t = now()
  tone({ t, type: 'triangle', f: vary(880, 0.04), f2: 1100, glide: 0.08, a: 0.01, d: 0.1, gain: 0.07 * gain, pan, lp: 3500 })
  tone({ t: t + 0.11, type: 'triangle', f: vary(1320, 0.04), f2: 1200, glide: 0.1, a: 0.01, d: 0.14, gain: 0.06 * gain, pan, lp: 3500 })
}

// A peace-sign pose: a camera-shutter click and a twinkle.
export function pose(pan = 0, gain = 1) {
  if (!ok('pose', 500, 0.8, 3)) return
  const t = now()
  burst({ t, type: 'highpass', f: 3000, q: 0.7, a: 0.001, d: 0.02, gain: 0.2 * gain, pan })
  burst({ t: t + 0.05, type: 'bandpass', f: 1500, q: 1.2, a: 0.001, d: 0.03, gain: 0.14 * gain, pan })
  glock(t + 0.08, [19, 24], 0.06, 0.07 * gain, 0.4, pan)
}

// A shy giggle: quick vibrato blips falling in pitch, breathy.
export function giggle(pan = 0, gain = 1) {
  if (!ok('giggle', 700, 1, 3)) return
  const t = now()
  const base = rnd(820, 980)
  for (let i = 0; i < 4; i++) {
    const tt = t + i * 0.085
    tone({ t: tt, type: 'triangle', f: base * (1 - i * 0.05), f2: base * (1 - i * 0.05) * 0.92, a: 0.008, d: 0.06, gain: 0.05 * gain, pan, lp: 2600 })
    burst({ t: tt, type: 'bandpass', f: 2400, q: 2, a: 0.005, d: 0.04, gain: 0.025 * gain, pan })
  }
}

// A curtsy: a short music-box phrase.
export function curtsy(pan = 0, gain = 1) {
  if (!ok('curtsy', 700, 1, 3)) return
  const t = now()
  ;[0, 7, 12, 11, 12].forEach((n, i) => modal({ t: t + i * 0.11, f: 1568 * semi(n), modes: BOX, gain: 0.05 * gain, strike: 0.05, pan, verb: 0.35 }))
}

// --- Index -----------------------------------------------------------------------------------
export function indexOpen() {
  if (!A.ctx || !voice(0.8, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 900, f2: 3000, q: 0.8, a: 0.05, d: 0.18, gain: 0.12, bus: A.ui })
  glock(t + 0.06, [7, 12, 16], 0.05, 0.06, 0.3, 0, A.ui)
}
export function pageTurn() {
  if (!A.ctx || !limit('page', 120) || !voice(0.4, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 2600, f2: 900, q: 0.9, a: 0.02, d: 0.09, gain: 0.08, bus: A.ui })
}
export function select(rarity = 0, known = true) {
  if (!A.ctx || !limit('sel', 60) || !voice(0.5, 3)) return
  const t = now()
  modal({ t, f: C6 * semi(known ? 7 + Math.min(9, rarity) : 0), modes: GLOCK, gain: known ? 0.08 : 0.05, strike: 0.12, verb: 0.25, bus: A.ui })
  if (known && rarity >= 4) shimmer(t + 0.04, 3, 0.25, 0.015)
}
// A new girl found: a bright sting.
export function discover() {
  if (!A.ctx || !limit('disc', 400) || !voice(1, 3)) return
  const t = now()
  glock(t, [12, 16, 19, 24, 28], 0.05, 0.09, 0.4, 0, A.ui)
  shimmer(t + 0.15, 6, 0.5, 0.02)
}
// An area's Index page completed: fanfare, bells, a sparkle shower.
export function areaComplete() {
  if (!A.ctx || !voice(2.5, 5)) return
  const t = now()
  ;[[0, 4, 7], [5, 9, 12], [7, 11, 14], [12, 16, 19, 24]].forEach((ch, i) => ch.forEach((n) => tone({ t: t + i * 0.16, type: 'triangle', f: 523 * semi(n), a: 0.01, d: i === 3 ? 0.9 : 0.18, gain: 0.05, lp: 3200, verb: 0.35 })))
  modal({ t: t + 0.5, f: 1047, modes: BELL, gain: 0.14, beat: 3, strike: 0.2, verb: 0.5 })
  crinkle({ t: t + 0.5, n: COARSE_POINTER ? 10 : 22, dur: 1, gain: 0.04, f0: 2500, f1: 8000, width: 0.9 })
  shimmer(t + 0.5, 12, 1.2, 0.025)
  buzz([30, 40, 30, 40, 80])
}

export const APPEAL_SFX = { wave, kiss, heart, twirl, pose, shy: giggle, curtsy }
