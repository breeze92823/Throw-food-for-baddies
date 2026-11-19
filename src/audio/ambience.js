// The meadow around the player, all synthesised:
//  - wind: a stereo pink-noise bed through a slowly wandering lowpass, gusting now and then
//  - songbirds by day: little phrases of fast sine chirps and trills, panned around
//  - leaves rustling in the cliff-top trees when a gust passes
//  - crickets by night: amplitude-pulsed high sines
// One scheduler tick plans events ahead of the clock; update() moves continuous levels.
import { AUDIO } from '../config.js'
import { A, onStart, ready } from './core.js'
import { burst, env, rnd, route } from './synth.js'

const M = AUDIO.ambience
const s = { ok: false, wind: null, windLp: null, nextBird: 0, nextGust: 0, night: 0, crickets: [], cricketGain: null }

function build(ctx) {
  const src = ctx.createBufferSource()
  src.buffer = A.noise.pinkStereo
  src.loop = true
  const lp = ctx.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 420
  lp.Q.value = 0.4
  const hp = ctx.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 90
  const g = ctx.createGain()
  g.gain.value = M.wind
  src.connect(hp).connect(lp).connect(g).connect(A.amb)
  src.start()
  s.wind = g
  s.windLp = lp
  // Crickets: three pulsing high sines (silent by day).
  const cg = ctx.createGain()
  cg.gain.value = 0
  cg.connect(A.amb)
  s.cricketGain = cg
  for (const [f, pan, rate] of [[4400, -0.6, 28], [4750, 0.5, 31], [5100, 0.1, 25]]) {
    const o = ctx.createOscillator()
    o.frequency.value = f
    const am = ctx.createGain()
    am.gain.value = 0
    const lfo = ctx.createOscillator()
    lfo.type = 'square'
    lfo.frequency.value = rate
    const depth = ctx.createGain()
    depth.gain.value = M.cricket
    lfo.connect(depth).connect(am.gain)
    const p = ctx.createStereoPanner()
    p.pan.value = pan
    o.connect(am).connect(p).connect(cg)
    o.start()
    lfo.start()
  }
  s.ok = true
  s.nextBird = ctx.currentTime + 1
  s.nextGust = ctx.currentTime + 4
}
onStart((ctx) => {
  // Waits for the graph (noise buffers) to exist.
  const wait = () => (A.noise.pinkStereo ? build(ctx) : setTimeout(wait, 50))
  wait()
})

// One songbird phrase: 2-6 notes, each a fast sine sweep (with an occasional trill).
function bird(t) {
  const ctx = A.ctx
  const pan = rnd(-0.9, 0.9)
  const base = rnd(2400, 4200)
  const notes = 2 + Math.floor(Math.random() * 5)
  const species = Math.floor(Math.random() * 3)
  let at = t
  for (let i = 0; i < notes; i++) {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    const d = species === 2 ? 0.05 : rnd(0.06, 0.14)
    const f0 = base * (species === 0 ? 1 + i * 0.06 : rnd(0.85, 1.15))
    const f1 = f0 * (species === 1 ? 0.7 : rnd(1.15, 1.5))
    o.frequency.setValueAtTime(f0, at)
    o.frequency.exponentialRampToValueAtTime(f1, at + d)
    if (species === 2) {
      // Trill: frequency wobble.
      const lfo = ctx.createOscillator()
      lfo.frequency.value = rnd(30, 45)
      const dep = ctx.createGain()
      dep.gain.value = f0 * 0.06
      lfo.connect(dep).connect(o.frequency)
      lfo.start(at)
      lfo.stop(at + d + 0.05)
    }
    env(g.gain, at, 0.006, M.bird * rnd(0.5, 1), d)
    o.connect(g)
    route(g, { bus: A.amb, pan, verb: 0.35 })
    o.start(at)
    o.stop(at + d + 0.05)
    at += d + rnd(0.03, 0.12)
  }
}

function rustle(t, gain) {
  for (let i = 0; i < 18; i++) burst({ t: t + Math.random() * 1.4, noise: 'pink', f: rnd(2500, 7000), q: rnd(1, 3), a: 0.01, d: rnd(0.03, 0.09), gain: gain * rnd(0.3, 1), pan: rnd(-0.8, 0.8), bus: A.amb })
}

// night 0..1; call every frame.
export function update(dt, night) {
  if (!s.ok || !ready()) return
  const ctx = A.ctx
  const c = ctx.currentTime
  s.night = night
  // The wind wanders.
  const w = 0.5 + 0.5 * Math.sin(c * 0.13) * Math.sin(c * 0.071 + 1)
  s.windLp.frequency.setTargetAtTime(300 + w * 500, c, 0.5)
  s.wind.gain.setTargetAtTime(M.wind * (0.6 + w * 0.6), c, 0.5)
  s.cricketGain.gain.setTargetAtTime(night, c, 0.8)
  if (c > s.nextBird) {
    if (night < 0.5) bird(c + 0.05)
    s.nextBird = c + rnd(M.birdEvery[0], M.birdEvery[1])
  }
  if (c > s.nextGust) {
    rustle(c + 0.05, 0.035)
    s.nextGust = c + rnd(6, 14)
  }
}
