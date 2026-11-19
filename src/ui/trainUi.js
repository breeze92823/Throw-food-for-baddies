// Training Place overlay: the red STOP button over a "Level N  xp/need" bar (bottom
// centre, above the hotbar), the round "2x" tap badge, and the LEVEL UP pop with
// "+5 Throwing Strength" over it (each pop leaves a fading ghost that drifts up, so a
// quick run of level ups stacks). It also bumps the HUD strength counter. Shown while
// body.training is set.
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

export function createTrainUi({ onStop, onTap }) {
  const root = el('div', 'trn')
  const stop = el('button', 'trn-stop', 'STOP')
  stop.type = 'button'
  const bar = el('div', 'trn-bar', '<i class="fill"></i><i class="gain"></i><span class="lv outline">Level 1</span><span class="xp outline">0/0</span>')
  const lvEl = bar.querySelector('.lv')
  const xpEl = bar.querySelector('.xp')
  const fillEl = bar.querySelector('.fill')
  const gainEl = bar.querySelector('.gain')
  const tap = el('button', 'trn-tap', `${HAND}<b class="outline">2x</b><span class="hint outline">TAP!</span>`)
  tap.type = 'button'
  tap.dataset.silent = ''
  tap.setAttribute('aria-label', 'Tap to train 2x faster')
  const pops = el('div', 'trn-pops')
  root.append(pops, tap, stop, bar)
  document.body.appendChild(root)

  stop.addEventListener('click', (e) => {
    e.stopPropagation()
    onStop()
  })
  // The tap badge is a big target on phones; elsewhere any tap on the world counts (main.js).
  tap.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    onTap()
  })

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

  function boost(on) {
    tap.classList.toggle('on', on)
  }
  function tapped() {
    tap.classList.remove('hit')
    void tap.offsetWidth
    tap.classList.add('hit')
  }

  return {
    show(on) {
      document.body.classList.toggle('training', on)
      root.classList.toggle('show', on)
      if (!on) {
        tap.classList.remove('on', 'hit')
        tap.classList.remove('learned')
      }
    },
    setLevel,
    levelUp,
    boost,
    tapped,
    // After a few taps the "TAP!" hint goes away.
    learned() {
      tap.classList.add('learned')
    },
  }
}
