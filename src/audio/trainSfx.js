// Training Place sounds, synthesised like the rest (sfx.js): grabbing the steel bar
// is a struck metal tube, each pull-up a breathy "hup" plus a bar creak, the XP tick a
// glockenspiel note that climbs with the level bar, and a level up a fanfare run over
// a bell and a pair of party poppers. Everything returns quietly when audio is off.
import { COARSE_POINTER } from '../config.js'
import { A, isMuted, now, voice } from './core.js'
import { burst, crinkle, modal, rnd, tone, vary } from './synth.js'

const GLOCK = [[1, 1, 1.4], [2.756, 0.32, 0.45], [5.404, 0.1, 0.18], [8.933, 0.04, 0.08]]
const BELL = [[0.5, 0.3, 1.5], [1, 1, 1.3], [1.19, 0.45, 1], [1.5, 0.3, 0.85], [2, 0.42, 0.75], [2.5, 0.18, 0.5], [2.66, 0.22, 0.45], [3.01, 0.1, 0.35], [4.1, 0.06, 0.25]]
const TUBE = [[1, 1, 0.5], [2.76, 0.45, 0.3], [5.4, 0.22, 0.16], [8.93, 0.1, 0.08]]
const PLASTIC = [[1, 1, 0.026], [2.31, 0.5, 0.016], [3.93, 0.28, 0.01]]
const semi = (n) => Math.pow(2, n / 12)
const C6 = 1046.5
const PENTA = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]

function buzz(pattern) {
  if (!COARSE_POINTER || isMuted()) return
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Not allowed in this frame.
  }
}
function glock(t, notes, gap, gain = 0.13, verb = 0.3) {
  notes.forEach((n, i) => modal({ t: t + i * gap, f: C6 * semi(n), modes: GLOCK, gain: gain * rnd(0.85, 1), strike: 0.12, pan: (i / Math.max(1, notes.length - 1) - 0.5) * 0.5, verb }))
}

// Jumping up and grabbing the bar.
export function grab() {
  if (!voice(0.8, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 300, f2: 1500, q: 0.8, a: 0.05, d: 0.12, gain: 0.18 })
  modal({ t: t + 0.2, f: vary(640, 0.03), modes: TUBE, gain: 0.16, strike: 0.3, beat: 3, verb: 0.25 })
  tone({ t: t + 0.2, f: 150, f2: 80, d: 0.08, gain: 0.18 })
}
// Letting go and landing.
export function drop() {
  if (!voice(0.5, 1)) return
  const t = now()
  modal({ t, f: vary(560, 0.03), modes: TUBE, gain: 0.07, strike: 0.2, verb: 0.2 })
  tone({ t: t + 0.18, f: 120, f2: 55, d: 0.1, gain: 0.25 })
  burst({ t: t + 0.18, f: 500, q: 0.7, d: 0.06, gain: 0.12 })
}
// One pull-up: an exhaled "hup" (formant-ish band noise) and the bar creaking.
export function rep(boost = false) {
  if (!voice(0.4, 0.8)) return
  const t = now()
  const p = boost ? 1.12 : 1
  burst({ t, noise: 'pink', f: vary(650, 0.06) * p, f2: 1100 * p, q: 3, a: 0.02, d: 0.13, gain: 0.12 })
  burst({ t, noise: 'pink', f: vary(1700, 0.05) * p, q: 4, a: 0.02, d: 0.09, gain: 0.05 })
  modal({ t: t + 0.04, f: vary(420, 0.05), modes: TUBE, gain: 0.035, strike: 0.05, decay: 0.6 })
}
// XP earned: a glock note that climbs with how full the level bar is (0..1).
export function xp(fill = 0) {
  if (!voice(0.5, 0.6)) return
  const i = Math.min(PENTA.length - 1, Math.floor(fill * (PENTA.length - 1)))
  modal({ t: now(), f: C6 * semi(PENTA[i]), modes: GLOCK, gain: 0.08, strike: 0.15, verb: 0.25, bus: A.ui })
}
// Tapping for the 2x boost.
export function boost() {
  if (!voice(0.2, 0.5)) return
  const t = now()
  modal({ t, f: vary(1500, 0.05), modes: PLASTIC, gain: 0.09, bus: A.ui })
  tone({ t, f: 600, f2: 1300, d: 0.07, gain: 0.04, bus: A.ui })
}
// Level up: poppers, a thump, a bell and a fanfare run.
export function levelUp() {
  if (!voice(2, 3)) return
  const t = now()
  tone({ t, f: 110, f2: 55, d: 0.16, gain: 0.32 })
  burst({ t, type: 'highpass', f: 2800, q: 0.6, a: 0.0005, d: 0.012, gain: 0.35, pan: -0.5, verb: 0.2 })
  burst({ t: t + 0.05, type: 'highpass', f: 2800, q: 0.6, a: 0.0005, d: 0.012, gain: 0.35, pan: 0.5, verb: 0.2 })
  crinkle({ t: t + 0.05, n: COARSE_POINTER ? 10 : 20, dur: 0.8, gain: 0.04, f0: 3000, f1: 9000, width: 0.9, verb: 0.3 })
  modal({ t: t + 0.04, f: 1568, modes: BELL, gain: 0.11, beat: 4, strike: 0.15, verb: 0.4 })
  glock(t + 0.06, [0, 4, 7, 12, 16, 19, 24], 0.055, 0.13, 0.4)
  buzz([20, 30, 40])
}
