// The Food Shop window (opened from the stall ring; hud.js hosts it as the `foodShop`
// window): a red title bar over a dark-green panel holding one horizontal row of tall food
// cards (name, "Rarity • Tier N", the food's portrait floating over a rarity glow, its
// range / luck, and the price / Equip / Equipped button), scrolled by swipe, drag or wheel,
// with a white position pill under it. Cards are coloured by FOOD_RARITIES (higher tiers
// get sheens, spotlights, twinkles). Built once per opening; state changes only update
// the buttons (update()), so scrolling and animations never restart while it is open.
import './foodShop.css'
import { FOOD_RARITIES, FOODS } from '../config.js'
import { fmt } from '../game/format.js'
import * as state from '../game/state.js'
import { foodPortrait } from './snapshot.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const num = (n) => (Number.isInteger(n) ? String(n) : n < 10 ? n.toFixed(2).replace(/0$/, '') : n.toFixed(1).replace(/\.0$/, ''))
const BURST = ['#ffffff', '#ffe14a', '#7dff4a', '#4fc8ff', '#ff6aa0', '#c07dff']

export function createFoodShop({ sfx, toast, celebrate }) {
  let cards = new Map() // id -> { el, btn, def }
  let track = null
  let pill = null
  let lastIdx = -1

  // Portraits are rendered a couple per frame (nearest the view first) so opening is instant.
  let queue = []
  let pumping = false
  function pump() {
    if (!queue.length) {
      pumping = false
      return
    }
    pumping = true
    for (let i = 0; i < 2 && queue.length; i++) {
      const c = queue.shift()
      if (!c.el.isConnected) continue
      const img = c.el.querySelector('.fs-art img')
      img.src = foodPortrait(c.def.id)
      img.classList.add('ready')
    }
    requestAnimationFrame(pump)
  }

  function stateOf(def) {
    if (state.S.food === def.id) return 'eq'
    if (state.S.foods.includes(def.id)) return 'own'
    return state.S.money >= def.price ? 'buy' : 'poor'
  }
  function paint(c) {
    const s = stateOf(c.def)
    if (c.state === s) return
    c.state = s
    c.el.classList.toggle('owned', s === 'own' || s === 'eq')
    c.el.classList.toggle('equipped', s === 'eq')
    c.btn.className = `fs-btn ${s === 'eq' ? 'eq' : s === 'poor' ? '' : 'go'}`
    c.btn.querySelector('span').textContent = s === 'eq' ? 'Equipped' : s === 'own' ? 'Equip' : `$${fmt(c.def.price)}`
  }

  function burst(card, color) {
    const fx = document.createElement('div')
    fx.className = 'fs-burst'
    for (let i = 0; i < 22; i++) {
      const p = document.createElement('i')
      const a = (i / 22) * Math.PI * 2 + Math.random() * 0.3
      const d = 30 + Math.random() * 45
      p.style.setProperty('--dx', `${Math.cos(a) * d}cqw`)
      p.style.setProperty('--dy', `${Math.sin(a) * d * 0.8 - 10}cqh`)
      p.style.setProperty('--r', `${Math.random() * 720 - 360}deg`)
      p.style.background = i % 3 === 0 ? color : BURST[i % BURST.length]
      p.style.animationDelay = `${Math.random() * 60}ms`
      fx.appendChild(p)
    }
    card.appendChild(fx)
    setTimeout(() => fx.remove(), 1100)
  }
  function replay(el, cls) {
    el.classList.remove(cls)
    void el.offsetWidth
    el.classList.add(cls)
  }

  function press(c) {
    const s = stateOf(c.def)
    const r = FOOD_RARITIES[c.def.rarity]
    if (s === 'eq') {
      sfx.tick()
      replay(c.el, 'nudge')
      return
    }
    if (s === 'own') {
      state.equipFood(c.def.id)
      sfx.equip()
      sfx.foodEquip?.(r.fx)
      replay(c.el, 'pop')
      update()
      return
    }
    if (!state.buyFood(c.def.id)) {
      sfx.deny()
      replay(c.btn, 'shake')
      return
    }
    sfx.foodBuy?.(r.fx)
    replay(c.el, 'bought')
    burst(c.el, r.glow)
    celebrate?.()
    toast?.(`New food: ${c.def.name}! Range ${num(c.def.dist)} m • Luck x${num(c.def.luck)}`, 'good')
    update()
  }

  function makeCard(def, i) {
    const r = FOOD_RARITIES[def.rarity]
    const el = document.createElement('div')
    el.className = `fs-card r-${r.key}`
    el.style.setProperty('--glow', r.glow)
    el.style.setProperty('--len', String(Math.max(8, def.name.length)))
    el.style.setProperty('--d', `${Math.min(i, 6) * 45}ms`)
    el.style.setProperty('--bob', `${(i % 5) * -0.55}s`)
    const sub = def.special ? r.name : `${r.name} • Tier ${def.tier}`
    const twinkles = r.fx >= 6 ? Array.from({ length: 5 }, (_, k) => `<b class="fs-tw" style="left:${12 + ((k * 37 + i * 13) % 76)}%;top:${8 + ((k * 23 + i * 7) % 70)}%;animation-delay:${(k * 0.43 + i * 0.17) % 2}s"></b>`).join('') : ''
    el.innerHTML = `<div class="fs-fx"></div><div class="fs-name">${esc(def.name)}</div><div class="fs-sub">${esc(sub)}</div><div class="fs-art"><div class="fs-halo"></div>${twinkles}<img alt="" draggable="false"><div class="fs-stats"><span>Range ${num(def.dist)} m</span><span>Luck x${num(def.luck)}</span></div></div><button class="fs-btn" data-silent><span></span></button>`
    const btn = el.querySelector('.fs-btn')
    const c = { el, btn, def, state: '' }
    btn.addEventListener('click', (e) => {
      e.stopPropagation()
      if (dragMoved) return
      press(c)
    })
    return c
  }

  // --- Scrolling: wheel -> horizontal, mouse drag, ticks as cards pass, the position pill ---
  let dragMoved = false
  let down = null
  let winWired = false
  function step() {
    // Layout offsets, not bounding rects: the cards scale in on open.
    const a = track.children[0]
    const b = track.children[1]
    return a && b ? Math.max(1, b.offsetLeft - a.offsetLeft) : 1
  }
  function onScroll() {
    const max = track.scrollWidth - track.clientWidth
    const w = Math.min(1, track.clientWidth / Math.max(1, track.scrollWidth))
    pill.style.width = `${Math.max(8, w * 100)}%`
    pill.style.left = `${max > 0 ? (track.scrollLeft / max) * (100 - Math.max(8, w * 100)) : 0}%`
    const idx = Math.round(track.scrollLeft / step())
    if (idx !== lastIdx) {
      if (lastIdx >= 0) sfx.tick()
      lastIdx = idx
    }
  }
  function wire() {
    track.addEventListener('scroll', onScroll, { passive: true })
    track.addEventListener(
      'wheel',
      (e) => {
        if (Math.abs(e.deltaY) <= Math.abs(e.deltaX)) return
        e.preventDefault()
        track.scrollBy({ left: e.deltaY * 1.4, behavior: 'smooth' })
      },
      { passive: false },
    )
    track.addEventListener('pointerdown', (e) => {
      if (e.pointerType !== 'mouse' || e.button !== 0) return
      down = { x: e.clientX, left: track.scrollLeft }
      dragMoved = false
    })
    if (winWired) return
    winWired = true
    window.addEventListener('pointermove', (e) => {
      if (!down || !track) return
      const dx = e.clientX - down.x
      if (Math.abs(dx) > 6 && !dragMoved) {
        dragMoved = true
        track.classList.add('dragging')
      }
      if (dragMoved) track.scrollLeft = down.left - dx
    })
    window.addEventListener('pointerup', () => {
      if (!down) return
      down = null
      track?.classList.remove('dragging')
      setTimeout(() => (dragMoved = false), 0)
    })
  }

  function render(body) {
    cards = new Map()
    const wrap = document.createElement('div')
    wrap.className = 'fs-wrap'
    track = document.createElement('div')
    track.className = 'fs-track'
    const bar = document.createElement('div')
    bar.className = 'fs-scroll'
    pill = document.createElement('i')
    bar.appendChild(pill)
    FOODS.forEach((def, i) => {
      const c = makeCard(def, i)
      cards.set(def.id, c)
      track.appendChild(c.el)
    })
    wrap.append(track, bar)
    body.appendChild(wrap)
    wire()
    update()
    // Open on the food you would buy next (second slot), so progress is in view.
    const list = [...cards.values()]
    const next = Math.max(0, list.findIndex((c) => !c.def.special && (c.state === 'buy' || c.state === 'poor')))
    const target = Math.max(0, next - 1)
    lastIdx = -1
    // The window is already in the document, so layout is available right away.
    track.scrollTo({ left: target * step(), behavior: 'instant' })
    onScroll()
    queue = list.map((c, i) => ({ c, d: Math.abs(i - target - 1) })).sort((a, b) => a.d - b.d).map((e) => e.c)
    if (!pumping) requestAnimationFrame(pump)
  }
  function update() {
    for (const c of cards.values()) paint(c)
  }
  return { render, update }
}

// Render food portraits during idle time after boot so the shop opens fully drawn.
export function warmFoodPortraits() {
  const ids = FOODS.map((f) => f.id)
  const idle = window.requestIdleCallback ?? ((fn) => setTimeout(() => fn({ timeRemaining: () => 8 }), 120))
  const next = (dl) => {
    while (ids.length && dl.timeRemaining() > 6) foodPortrait(ids.shift())
    if (ids.length) idle(next)
  }
  idle(next)
}
