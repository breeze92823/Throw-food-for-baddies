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

// --- Training Bench upgrade -------------------------------------------------------------------
// Stepping on the pad with the money: a cash-register ka-ching, a rising whoosh while the old
// bench shudders and crunches into the ground (`swapAt` s), then a deep boom as the new one bursts
// up, hammer clanks settling it, a shimmer and a fanfare that climbs higher for better benches.
export function upgrade(tier = 1, swapAt = 0.42) {
  if (!voice(3, 4)) return
  const t = now()
  // Ka-ching.
  modal({ t, f: 2093, modes: BELL, gain: 0.07, strike: 0.2, verb: 0.2, bus: A.ui })
  modal({ t: t + 0.07, f: 2637, modes: BELL, gain: 0.06, strike: 0.1, verb: 0.25, bus: A.ui })
  // Riser + rumble while it crushes down.
  burst({ t, noise: 'pink', type: 'bandpass', f: 300, f2: 3800, q: 1.4, a: swapAt * 0.8, d: 0.06, gain: 0.22, verb: 0.2 })
  tone({ t, type: 'sawtooth', f: 70, f2: 140, a: swapAt * 0.7, d: 0.1, gain: 0.08, lp: 400 })
  for (let i = 0; i < 4; i++) burst({ t: t + i * 0.09, noise: 'brown', f: 180 + i * 40, q: 0.8, d: 0.07, gain: 0.16, pan: (i % 2 ? 0.3 : -0.3) })
  // Boom as the new bench bursts up.
  const s = t + swapAt
  tone({ t: s, f: 120, f2: 38, d: 0.5, gain: 0.45 })
  burst({ t: s, noise: 'brown', type: 'lowpass', f: 900, f2: 120, d: 0.5, gain: 0.35, verb: 0.3 })
  burst({ t: s, type: 'highpass', f: 2600, q: 0.6, a: 0.0005, d: 0.02, gain: 0.3, pan: -0.4, verb: 0.2 })
  burst({ t: s + 0.04, type: 'highpass', f: 2600, q: 0.6, a: 0.0005, d: 0.02, gain: 0.3, pan: 0.4, verb: 0.2 })
  // Hammer clanks.
  for (let i = 0; i < 3; i++) modal({ t: s + 0.22 + i * 0.13, f: vary(820 - i * 90, 0.03), modes: TUBE, gain: 0.11, strike: 0.5, beat: 3, verb: 0.25, pan: (i - 1) * 0.4 })
  crinkle({ t: s + 0.1, n: COARSE_POINTER ? 12 : 26, dur: 1.1, gain: 0.04, f0: 3500, f1: 10000, width: 0.9, verb: 0.4 })
  // Fanfare: brass-ish stabs and a glock run, a step higher for every tier.
  const k = semi(Math.min(12, tier))
  for (const [i, n] of [[0, 0], [1, 4], [2, 7]]) {
    tone({ t: s + 0.45 + i * 0.11, type: 'sawtooth', f: 392 * k * semi(n), d: 0.22, gain: 0.07, lp: 2400, verb: 0.3 })
    tone({ t: s + 0.45 + i * 0.11, type: 'square', f: 196 * k * semi(n), d: 0.22, gain: 0.03, lp: 1400 })
  }
  tone({ t: s + 0.8, type: 'sawtooth', f: 392 * k * semi(12), hold: 0.25, d: 0.5, gain: 0.08, lp: 2600, verb: 0.45 })
  tone({ t: s + 0.8, type: 'sawtooth', f: 392 * k * semi(7), hold: 0.25, d: 0.5, gain: 0.05, lp: 2000, verb: 0.45, detune: 6 })
  glock(s + 0.8, [0, 4, 7, 12, 16, 19, 24].map((n) => n + Math.min(7, tier)), 0.05, 0.11, 0.45)
  modal({ t: s + 0.8, f: 1568, modes: BELL, gain: 0.1, beat: 4, strike: 0.15, verb: 0.5 })
  buzz([30, 40, 60, 40, 30])
}
// Stepping on the pad without the money: a low double buzz.
export function deny() {
  if (!voice(0.5, 0.6)) return
  const t = now()
  tone({ t, type: 'square', f: 180, d: 0.1, gain: 0.07, lp: 900, bus: A.ui })
  tone({ t: t + 0.13, type: 'square', f: 140, d: 0.16, gain: 0.07, lp: 900, bus: A.ui })
  buzz([25, 40, 25])
}
// The bench is already the best one.
export function maxed() {
  if (!voice(0.4, 0.5)) return
  glock(now(), [12, 7], 0.08, 0.08, 0.3)
}

// --- Random XP boosts -------------------------------------------------------------------------
// A boost button pops up: a bright "bloop" + sparkle, bigger values get a little chord.
export function dropSpawn(mult = 2) {
  if (!voice(0.6, 0.8)) return
  const t = now()
  tone({ t, f: 500, f2: 1400, d: 0.12, gain: 0.08, bus: A.ui })
  modal({ t: t + 0.05, f: 1760, modes: GLOCK, gain: 0.07, strike: 0.1, verb: 0.3, bus: A.ui })
  if (mult >= 5) glock(t + 0.1, [7, 12, 16], 0.06, 0.08, 0.4)
  buzz(15)
}
// Grabbed it: a power-up sweep, a whoomph and a chord run that grows with the multiplier.
export function dropGrab(mult = 2) {
  if (!voice(1.5, 2)) return
  const t = now()
  burst({ t, noise: 'pink', f: 600, f2: 6000, q: 1.2, a: 0.01, d: 0.3, gain: 0.18, verb: 0.3 })
  tone({ t, type: 'sawtooth', f: 220, f2: 880, d: 0.32, gain: 0.07, lp: 2600 })
  tone({ t, type: 'square', f: 330, f2: 1320, d: 0.32, gain: 0.03, lp: 1800 })
  tone({ t: t + 0.02, f: 90, f2: 50, d: 0.2, gain: 0.3 })
  const steps = mult >= 10 ? [0, 4, 7, 12, 16, 19, 24, 28] : mult >= 5 ? [0, 4, 7, 12, 16, 19] : mult >= 3 ? [0, 4, 7, 12, 16] : [0, 4, 7, 12]
  glock(t + 0.12, steps, 0.045, 0.12, 0.4)
  if (mult >= 5) modal({ t: t + 0.12, f: 1568, modes: BELL, gain: 0.1, beat: 4, strike: 0.15, verb: 0.5 })
  buzz([30, 30, 50])
}
// A boost runs out: a falling two-note blip.
export function boostEnd() {
  if (!voice(0.4, 0.5)) return
  const t = now()
  tone({ t, f: 1200, f2: 500, d: 0.25, gain: 0.06, bus: A.ui })
  glock(t + 0.05, [7, 0], 0.09, 0.07, 0.3)
}
// Each boosted rep: a bright shimmer on top of the normal rep sound.
export function boostRep(mult = 2) {
  if (!voice(0.3, 0.5)) return
  const t = now()
  modal({ t, f: C6 * semi(mult >= 5 ? 12 : 7), modes: GLOCK, gain: 0.06, strike: 0.05, verb: 0.35, bus: A.ui })
  crinkle({ t, n: 5, dur: 0.25, gain: 0.025, f0: 5000, f1: 11000, width: 0.8, verb: 0.3 })
}
