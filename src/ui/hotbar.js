// The hotbar (bottom centre): baddies you caught but have not placed yet. Click a slot (or
// press its number) to carry that baddie; click it again to put it away. A fresh catch flies
// in as a portrait card from the middle of the screen. main.js does the carrying and placing.
import './hotbar.css'
import { ECONOMY, RARITIES, SIZES, VARIANTS } from '../config.js'
import { BY_ID } from '../game/baddieModel.js'
import { baddiePortrait } from './snapshot.js'

export function createHotbar({ getItems, onSelect }) {
  const bar = document.createElement('div')
  bar.className = 'hotbar'
  document.body.appendChild(bar)
  let selected = -1
  let showTimer = 0

  function render() {
    const items = getItems()
    if (selected >= items.length) selected = -1
    bar.innerHTML = ''
    items.forEach((it, i) => {
      const def = BY_ID[it.id]
      const r = RARITIES[def.rarity]
      const b = document.createElement('button')
      b.type = 'button'
      b.className = `hb-slot${i === selected ? ' on' : ''}`
      b.style.setProperty('--rc', r.color)
      const size = [VARIANTS[it.v | 0]?.name, SIZES[it.size]?.name].filter(Boolean).join(' ')
      b.title = `${size ? `${size} ` : ''}${def.name} (${r.name})`
      if (it.v) b.style.setProperty('--vc', VARIANTS[it.v].color)
      b.innerHTML = `<i class="num">${i + 1}</i><img alt="" src="${baddiePortrait(it.id, 0, false, it.v)}"><span class="nm">${def.name}</span>${size ? `<span class="sz">${size}</span>` : ''}`
      b.addEventListener('pointerdown', (e) => e.stopPropagation())
      b.addEventListener('click', () => select(i === selected ? -1 : i))
      bar.appendChild(b)
    })
    bar.classList.toggle('empty', items.length === 0)
  }
  function select(i) {
    const items = getItems()
    const next = i >= 0 && i < items.length ? i : -1
    if (next === selected) return
    selected = next
    render()
    onSelect(selected)
  }
  window.addEventListener('keydown', (e) => {
    if (e.repeat || document.body.classList.contains('throw-mode')) return
    const m = /^Digit([1-9])$/.exec(e.code)
    if (!m) return
    const i = Number(m[1]) - 1
    if (i >= getItems().length) return
    select(i === selected ? -1 : i)
  })

  return {
    render,
    select,
    get selected() {
      return selected
    },
    // A just-caught baddie's portrait flies from the screen centre into its new slot.
    flyIn(id) {
      bar.classList.add('show')
      clearTimeout(showTimer)
      showTimer = setTimeout(() => bar.classList.remove('show'), 2200)
      render()
      const slot = bar.lastElementChild
      if (!slot) return
      const to = slot.getBoundingClientRect()
      const card = document.createElement('img')
      card.className = 'hb-fly'
      card.src = baddiePortrait(id)
      card.style.setProperty('--rc', RARITIES[BY_ID[id].rarity].color)
      const size = Math.min(window.innerWidth, window.innerHeight) * 0.3
      card.style.width = card.style.height = `${size}px`
      card.style.left = `${window.innerWidth / 2 - size / 2}px`
      card.style.top = `${window.innerHeight / 2 - size / 2}px`
      document.body.appendChild(card)
      slot.classList.add('incoming')
      requestAnimationFrame(() =>
        requestAnimationFrame(() => {
          card.style.left = `${to.left}px`
          card.style.top = `${to.top}px`
          card.style.width = `${to.width}px`
          card.style.height = `${to.height}px`
          card.style.transform = 'rotate(360deg)'
        }),
      )
      setTimeout(() => {
        card.remove()
        slot.classList.remove('incoming')
        slot.classList.add('pop')
      }, 720)
    },
    get slots() {
      return ECONOMY.hotbarSlots
    },
  }
}
