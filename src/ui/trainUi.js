// Training Place overlay: the red STOP button over a "Level N  xp/need" bar (bottom
// centre, above the hotbar) and the LEVEL UP pop with
// "+5 Throwing Strength" over it (each pop leaves a fading ghost that drifts up, so a
// quick run of level ups stacks). It also bumps the HUD strength counter. Shown while
// body.training is set.
// Random XP boosts: drop(v) pops the round gold "2x" hand button (3x, 5x, 10x) at a random
// spot, only now and then (a ring drains as it runs out); tapping it calls onGrab. While a boost runs, a pill under the pops counts it
// down and the screen edges glow in its colour (body.trn-boosted).
// benchUp(def) is the BENCH UPGRADED banner (shown in the hub too, not only while training).
import './trainUi.css'
import { TRAINING } from '../config.js'
import { fmt } from '../game/format.js'

function el(tag, cls, html = '') {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  e.innerHTML = html
  return e
}

const HAND = `<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M26 8c3 0 5 2 5 5v17l2-1c2-6 9-5 9 0l1-1c2-5 9-4 9 1v1c2-4 8-3 8 2v13c0 9-6 16-15 16h-6c-6 0-10-3-13-8L16 38c-2-3 0-7 4-7 2 0 3 1 4 2l-3-2V13c0-3 2-5 5-5z" fill="#fff" stroke="#10131f" stroke-width="3.5" stroke-linejoin="round"/><path d="M33 36v8M42 36v8M51 37v7" stroke="#10131f" stroke-width="3" stroke-linecap="round"/></svg>`

export function createTrainUi({ onStop, onGrab }) {
  const root = el('div', 'trn')
  const stop = el('button', 'trn-stop', 'STOP')
  stop.type = 'button'
  const bar = el('div', 'trn-bar', '<i class="fill"></i><i class="gain"></i><span class="lv outline">Level 1</span><span class="xp outline">0/0</span>')
  const lvEl = bar.querySelector('.lv')
  const xpEl = bar.querySelector('.xp')
  const fillEl = bar.querySelector('.fill')
  const gainEl = bar.querySelector('.gain')
  const pops = el('div', 'trn-pops')
  const edge = el('div', 'trn-edge')
  const pill = el('div', 'trn-pill', '<b class="outline">x2 XP</b><span class="outline">10s</span><i></i>')
  const pillMult = pill.querySelector('b')
  const pillTime = pill.querySelector('span')
  const pillFill = pill.querySelector('i')
  const dropBtn = el('button', 'trn-drop', `<svg class="timer" viewBox="0 0 100 100" aria-hidden="true"><circle class="trk" cx="50" cy="50" r="46"/><circle class="arc" cx="50" cy="50" r="46" pathLength="100"/></svg>${HAND.replace('<svg ', '<svg class="hand" ')}<b class="outline">2x</b><span class="hint outline">TAP!</span>`)
  dropBtn.type = 'button'
  dropBtn.dataset.silent = ''
  const dropMult = dropBtn.querySelector('b')
  const dropArc = dropBtn.querySelector('.arc')
  root.append(edge, pops, pill, dropBtn, stop, bar)
  document.body.appendChild(root)
  // The upgrade banner lives outside the overlay (you upgrade from the pad, not on the bar).
  const banner = el('div', 'trn-banner')
  document.body.appendChild(banner)

  stop.addEventListener('click', (e) => {
    e.stopPropagation()
    onStop()
  })
  dropBtn.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    if (!dropBtn.classList.contains('up')) return
    onGrab?.()
  })

  // --- Random XP boost button ---
  let dropLife = 0
  let dropT = 0
  function drop(v, life) {
    dropMult.textContent = `${v.mult}x`
    dropBtn.style.setProperty('--c', v.color)
    dropBtn.setAttribute('aria-label', `Tap for ${v.mult}x XP`)
    // A random spot in the middle band of the screen, clear of STOP / the bar / the tap badge.
    // Portrait phones: the HUD panels fill the top third, so keep to the band above STOP.
    const portrait = innerHeight > innerWidth
    const left = portrait ? 42 + Math.random() * 34 : 22 + Math.random() * 56
    const top = portrait ? 40 + Math.random() * 16 : 24 + Math.random() * 30
    dropBtn.style.left = `${left}%`
    dropBtn.style.top = `${top}%`
    dropBtn.classList.remove('up', 'gone', 'grab', 'big')
    void dropBtn.offsetWidth
    dropBtn.classList.add('up')
    if (v.mult >= 5) dropBtn.classList.add('big')
    dropLife = life
    dropT = 0
  }
  function dropOff(grabbed = false) {
    if (!dropBtn.classList.contains('up')) return
    dropBtn.classList.remove('up')
    dropBtn.classList.add(grabbed ? 'grab' : 'gone')
  }
  // --- Active XP boost (pill + edge glow) ---
  let boostDur = 0
  function xpBoost(v) {
    if (!v) {
      pill.classList.remove('on')
      document.body.classList.remove('trn-boosted')
      return
    }
    boostDur = v.dur
    pillMult.textContent = `x${v.mult} XP`
    root.style.setProperty('--bc', v.color)
    document.body.style.setProperty('--trn-boost', v.color)
    pill.classList.remove('on')
    void pill.offsetWidth
    pill.classList.add('on')
    document.body.classList.add('trn-boosted')
    const p = el('div', 'trn-grabpop outline', `x${v.mult} XP!`)
    p.style.color = v.color
    pops.appendChild(p)
    setTimeout(() => p.remove(), 1400)
  }
  // Called every frame with the seconds left on the boost.
  function tick(dt, left) {
    if (dropBtn.classList.contains('up')) {
      dropT += dt
      dropArc.style.strokeDashoffset = `${Math.min(100, (dropT / dropLife) * 100)}`
    }
    if (left > 0) {
      pillTime.textContent = `${Math.ceil(left)}s`
      pillFill.style.width = `${(left / boostDur) * 100}%`
    }
  }

  // --- BENCH UPGRADED banner ---
  let bannerTimer = 0
  function benchUp(def, tier, total) {
    banner.innerHTML = `<div class="t outline">BENCH UPGRADED!</div><div class="n outline">${def.name}</div><div class="r outline">+${fmt(def.xps, 0)} XP/s  <small>(${tier + 1}/${total})</small></div>`
    banner.style.setProperty('--c', def.glow === '#ffffff' ? '#ffd23a' : def.glow)
    banner.classList.remove('show')
    void banner.offsetWidth
    banner.classList.add('show')
    clearTimeout(bannerTimer)
    bannerTimer = setTimeout(() => banner.classList.remove('show'), 2600)
  }

  let shownFill = 0
  function setLevel(level, xp, need, { animate = true } = {}) {
    lvEl.textContent = `Level ${fmt(level, 0)}`
    xpEl.textContent = `${fmt(Math.floor(xp), 0)}/${fmt(need, 0)}`
    const k = Math.max(0, Math.min(1, xp / need))
    if (!animate) {
      fillEl.style.transition = 'none'
      gainEl.style.transition = 'none'
    }
    // The pale "gain" bar jumps first, the blue fill follows.
    gainEl.style.width = `${k * 100}%`
    fillEl.style.width = `${k * 100}%`
    if (k < shownFill) {
      fillEl.style.transition = 'none'
      gainEl.style.transition = 'none'
    }
    shownFill = k
    if (!animate || fillEl.style.transition === 'none') {
      void fillEl.offsetWidth
      fillEl.style.transition = ''
      gainEl.style.transition = ''
    }
    bar.classList.remove('kick')
    void bar.offsetWidth
    bar.classList.add('kick')
  }

  function levelUp(levels, level) {
    const n = levels * TRAINING.strengthPerLevel
    const pop = el('div', 'trn-pop', `<div class="str outline">+${fmt(n, 0)} Throwing Strength</div><div class="lvl outline">LEVEL UP</div>`)
    pops.appendChild(pop)
    // Older pops become ghosts that drift up and fade.
    for (const old of pops.querySelectorAll('.trn-pop:not(:last-child)')) old.classList.add('ghost')
    setTimeout(() => pop.classList.add('ghost'), 1500)
    setTimeout(() => pop.remove(), 2600)
    bar.classList.remove('lvup')
    void bar.offsetWidth
    bar.classList.add('lvup')
    // Bump the HUD strength counter and float a "+5" off it.
    const strRow = document.querySelector('.hud-strength')
    if (strRow) {
      strRow.classList.remove('trn-bump')
      void strRow.offsetWidth
      strRow.classList.add('trn-bump')
      const plus = el('span', 'trn-plus outline', `+${fmt(n, 0)}`)
      strRow.appendChild(plus)
      setTimeout(() => plus.remove(), 1100)
    }
    void level
  }


  return {
    show(on) {
      document.body.classList.toggle('training', on)
      root.classList.toggle('show', on)
      if (!on) {
        dropBtn.classList.remove('up', 'grab', 'big')
        xpBoost(null)
      }
    },
    setLevel,
    levelUp,
    drop,
    dropOff,
    xpBoost,
    tick,
    benchUp,
  }
}
