// The HUD (quest banner, Shop / Index buttons, strength and money, friend boost,
// charge meter, toasts, big pops) and every window (Food Shop, Sell, Fuse Machine,
// Pen upgrade, Shop upgrades, Index, My Baddies, Settings, rewards). Windows are
// rebuilt from state each time they open or the state changes while open.
import './hud.css'
import { BADDIES, ECONOMY, FUSE, RARITIES, SIZES, UPGRADES, VARIANTS } from '../config.js'
import { BY_ID } from '../game/baddieModel.js'
import { fmt, money } from '../game/format.js'
import * as state from '../game/state.js'
import { ICON } from './icons.js'
import { createFoodShop } from './foodShop.js'
import { createIndexView } from './indexWin.js'
import * as girlSfx from '../audio/girlSfx.js'
import { baddiePortrait } from './snapshot.js'

function el(tag, cls, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const sizeName = (s) => SIZES[s].name
// "Big Sakuro": size word in title case, then the name.
const sizeWord = (s) => (SIZES[s].name ? SIZES[s].name[0] + SIZES[s].name.slice(1).toLowerCase() + ' ' : '')
// "Gold ": the variant word in title case (VARIANTS).
const variantWord = (v) => (VARIANTS[v | 0]?.name ? VARIANTS[v | 0].name[0] + VARIANTS[v | 0].name.slice(1).toLowerCase() + ' ' : '')
const fullName = (b) => `${variantWord(b.v)}${sizeWord(b.size)}${BY_ID[b.id].name}`
const isPricey = (b) => BY_ID[b.id].rarity >= 3 || b.size > 0 || (b.v | 0) > 0 // selling these asks twice

export function createHud({ sfx, actions, onReservedAreas }) {
  const root = el('div', '')
  root.id = 'hud'
  document.body.appendChild(root)
  const layer = el('div', 'win-layer')
  document.body.appendChild(layer)

  // --- Static HUD ---
  const quest = el('div', 'hud-quest hidden')
  const left = el('div', 'hud-left')
  const shopBtn = el('button', 'hud-btn shop', `${ICON.basket}<span class="outline">Shop</span>`)
  const indexBtn = el('button', 'hud-btn index', `${ICON.book}<span class="outline">Index</span>`)
  const indexBadge = el('i', 'badge outline')
  indexBadge.style.display = 'none'
  indexBtn.appendChild(indexBadge)
  left.append(shopBtn, indexBtn)
  const portrait = el('button', 'hud-portrait', '<img alt=""><span class="count outline"></span>')
  portrait.title = 'My Baddies'
  const stats = el('div', 'hud-stats')
  const strRow = el('div', 'hud-row hud-strength', `${ICON.arm}<span class="val outline">10</span>`)
  const moneyRow = el('div', 'hud-row hud-money', `${ICON.cash}<span class="val">$0</span><em class="hud-gain"></em>`)
  stats.append(strRow, moneyRow)
  const friend = el('div', 'hud-friend', '<b>FRIEND BOOST +0%</b><small>Play with friends: +15% each!</small>')
  const charge = el('div', 'hud-charge', '<div class="bar"><i></i></div><span>Range</span>')
  const hint = el('div', 'hud-hint')
  const toasts = el('div', 'hud-toasts')
  const pops = el('div', 'hud-pop')
  // Active panel (right): the baddies placed in your pen (they earn), each with Unequip
  // (back to the hotbar), and Equip Best (place the best hotbar baddies). The red tab folds
  // it away; folded, the portrait button above shows instead and opens it again.
  const active = el('div', 'hud-active')
  const activeTab = el('button', 'ha-tab outline', '&gt;')
  activeTab.title = 'Hide'
  const activeMain = el('div', 'ha-main')
  const activeHead = el('div', 'ha-head outline')
  const activeList = el('div', 'ha-list')
  const equipBest = el('button', 'ha-best', '<span class="outline">Equip Best</span>')
  activeMain.append(activeHead, activeList, equipBest)
  active.append(activeTab, activeMain)
  root.append(quest, left, portrait, active, stats, friend, charge, hint, toasts, pops)

  const strVal = strRow.querySelector('.val')
  const moneyVal = moneyRow.querySelector('.val')
  const gain = moneyRow.querySelector('.hud-gain')
  const chargeBar = charge.querySelector('i')
  const chargeText = charge.querySelector('span')

  // Boxity's reserved rectangles (toolbar along the top-left, chat feed under it) drive the
  // phone layouts in hud.css:
  //   --reserved-top   below everything reserved (left column on portrait phones)
  //   --reserved-bar-r / --reserved-bar-b   the toolbar's right / bottom edge
  //   --reserved-side-r  the right edge of the widest reserved box (chat feed)
  //   --reserved-tr    how far the top-right corner is taken (full-width toolbar on narrow phones)
  //   --quest-l / --quest-r / --quest-t   landscape phones: the quest banner sits in the widest
  //                    gap, either beside the toolbar or beside the chat feed.
  let reserved = []
  const px = (v) => `${Math.round(v)}px`
  function layoutReserved() {
    const w = window.innerWidth
    const box = (a) => {
      const l = a.left ?? a.x ?? 0
      const t = a.top ?? a.y ?? 0
      return { l, t, r: l + (a.width ?? 0), b: t + (a.height ?? 0) }
    }
    const boxes = reserved.map(box)
    const bottom = boxes.reduce((m, b) => Math.max(m, b.b), 0)
    const bar = boxes.filter((b) => b.t <= 8)
    const barR = bar.reduce((m, b) => Math.max(m, b.r), 0)
    const barB = bar.reduce((m, b) => Math.max(m, b.b), 0)
    const sideR = boxes.reduce((m, b) => Math.max(m, b.r), 0)
    const rightBtns = 130 // the touch-top buttons (2 x 44 px + gaps + margin)
    const tr = barR > w - rightBtns ? barB : 0
    const s = document.documentElement.style
    s.setProperty('--reserved-top', px(bottom + 12))
    s.setProperty('--reserved-bar-r', px(barR))
    s.setProperty('--reserved-bar-b', px(barB))
    s.setProperty('--reserved-side-r', px(sideR))
    s.setProperty('--reserved-tr', px(tr))
    // Landscape quest: beside the toolbar (top row, left of the touch-top buttons) or, when
    // that gap is narrow, beside the chat feed just under the toolbar (left of the right column).
    const besideBar = w - barR - rightBtns - 16
    const besideChat = w - sideR - 190 - 16
    if (besideBar >= Math.min(260, besideChat)) {
      s.setProperty('--quest-l', px(barR + 8))
      s.setProperty('--quest-r', px(rightBtns))
      s.setProperty('--quest-t', '0px')
    } else {
      s.setProperty('--quest-l', px(sideR + 8))
      s.setProperty('--quest-r', px(190))
      s.setProperty('--quest-t', px(barB))
    }
  }
  onReservedAreas?.((areas) => {
    reserved = areas
    layoutReserved()
  })
  window.addEventListener('resize', layoutReserved)
  layoutReserved()

  // --- Money / strength ---
  let shownMoney = state.S.money
  let targetMoney = state.S.money
  let gainTimer = 0
  function showGain(delta) {
    gain.textContent = `${delta > 0 ? '+' : '-'}$${fmt(Math.abs(delta))}`
    gain.classList.toggle('spend', delta < 0)
    gain.classList.remove('show')
    void gain.offsetWidth
    gain.classList.add('show')
    clearTimeout(gainTimer)
  }
  function setMoney(v, delta = 0, { popup = true } = {}) {
    targetMoney = v
    if (popup && delta) showGain(delta)
    if (delta > 0) {
      moneyVal.classList.add('bump')
      setTimeout(() => moneyVal.classList.remove('bump'), 120)
    }
  }
  function setStrength(v) {
    strVal.textContent = fmt(v, 2)
  }

  // --- Quest ---
  let questKey = ''
  function setQuest(q, flash = false) {
    const key = q ? q.id : ''
    if (key === questKey && !flash) return
    questKey = key
    if (!q) {
      quest.classList.add('hidden')
      return
    }
    quest.classList.remove('hidden', 'done')
    quest.innerHTML = `<span>${esc(q.text)}</span><small class="outline">Reward: $${fmt(q.reward)}</small>`
  }
  function questDone(q) {
    quest.classList.add('done')
    quest.innerHTML = `<span>Done! +$${fmt(q.reward)}</span>`
    setTimeout(() => {
      questKey = '__'
      setQuest(state.currentQuest())
    }, 1600)
  }

  // --- Toasts / pops / prompt ---
  function toast(text, kind = '') {
    const t = el('div', `toast outline ${kind}`, esc(text))
    toasts.appendChild(t)
    while (toasts.children.length > 3) toasts.firstChild.remove()
    setTimeout(() => t.classList.add('out'), 2600)
    setTimeout(() => t.remove(), 3000)
  }
  function pop({ img, line1, line2, color = '#fff' }) {
    pops.innerHTML = ''
    const p = el('div', 'pop', `${img ? `<img src="${img}" alt="">` : ''}<div class="t1 outline">${esc(line1 ?? '')}</div><div class="t2 outline" style="color:${color}">${esc(line2 ?? '')}</div>`)
    pops.appendChild(p)
    setTimeout(() => p.remove(), 2500)
  }
  function setHint(text) {
    hint.textContent = text || ''
    hint.classList.toggle('on', !!text)
  }
  function setCharge(k, rangeM = 0, zone = '') {
    charge.classList.toggle('on', k >= 0)
    if (k >= 0) {
      chargeBar.style.width = `${Math.round(k * 100)}%`
      chargeText.textContent = zone ? `${Math.round(rangeM)} m \u2022 ${zone}` : `${Math.round(rangeM)} m`
    }
  }
  function setPortrait(url) {
    portrait.querySelector('img').src = url
  }
  function setCount() {
    portrait.querySelector('.count').textContent = `${state.S.baddies.length}/${state.capacity()}`
    refreshActive()
  }

  // --- Active panel ---
  const foldKey = `${ECONOMY.saveKey}.activeFolded`
  let folded = matchMedia('(pointer: coarse)').matches || window.innerWidth < 700
  // Phones always start folded (the open panel would cover the view); elsewhere the saved choice wins.
  const phone = Math.min(window.innerWidth, window.innerHeight) < 500
  try {
    const v = localStorage.getItem(foldKey)
    if (v != null && !phone) folded = v === '1'
  } catch {
    // Ignore.
  }
  function setFolded(v) {
    folded = v
    root.classList.toggle('active-open', !folded)
    try {
      localStorage.setItem(foldKey, folded ? '1' : '0')
    } catch {
      // Ignore.
    }
  }
  setFolded(folded)
  activeTab.addEventListener('click', () => {
    setFolded(true)
    sfx.windowClose()
  })
  for (const n of [active, portrait]) n.addEventListener('pointerdown', (e) => e.stopPropagation())
  let activeKey = ''
  function refreshActive() {
    const list = [...state.S.baddies].sort((a, b) => state.baddieIncome(b) - state.baddieIncome(a))
    const hotFull = state.S.hotbar.length >= ECONOMY.hotbarSlots
    const canEquip = state.S.hotbar.length > 0 && state.S.baddies.length < state.capacity()
    const key = `${list.map((b) => b.uid).join(',')}|${state.capacity()}|${state.incomeMult()}|${hotFull}|${canEquip}`
    if (key === activeKey) return
    activeKey = key
    activeHead.textContent = `${list.length}/${state.capacity()} Active`
    activeList.innerHTML = ''
    if (!list.length) activeList.appendChild(el('div', 'ha-empty outline', state.S.hotbar.length ? 'Tap Equip Best to put your baddies to work!' : 'Catch baddies in the lane, then place them in your pen.'))
    for (const b of list) {
      const def = BY_ID[b.id]
      const r = el('div', 'ha-row')
      r.style.setProperty('--rc', RARITIES[def.rarity].color)
      r.innerHTML = `<img src="${baddiePortrait(def.id, 0, true)}" alt=""><div class="ha-txt"><b class="outline">${esc(fullName(b))}</b><span class="outline">($${fmt(state.baddieIncome(b) * state.incomeMult())}/s)</span></div>`
      const un = el('button', `ha-un ${hotFull ? 'off' : ''}`, '<span class="outline">Unequip</span>')
      un.title = hotFull ? 'Your hotbar is full' : 'Back to your hotbar (stops earning)'
      un.addEventListener('click', () => {
        if (hotFull) {
          sfx.deny()
          toast('Your hotbar is full! Place or sell a baddie first.', 'warn')
          return
        }
        actions.unequip(b.uid)
      })
      r.appendChild(un)
      activeList.appendChild(r)
    }
    equipBest.classList.toggle('off', !canEquip)
  }
  equipBest.addEventListener('click', () => {
    if (!state.S.hotbar.length) {
      sfx.deny()
      toast('Your hotbar is empty: catch some baddies first!', 'warn')
      return
    }
    actions.equipBest()
  })

  // ================================ Windows ================================
  let open = null // { id, el, body, render, proximity }
  function closeWindow(silent = false) {
    if (!open) return
    const w = open
    open = null
    w.el.classList.add('closing')
    setTimeout(() => w.el.remove(), 170)
    if (!silent) sfx.windowClose()
    actions.onWindow?.(null, w.id)
  }
  function openWindow(id, { title, accent, sub = '', render, update = null, proximity = false, foot = null, cls = '' }) {
    if (open?.id === id) return
    if (open) closeWindow(true)
    const w = el('div', `win ${cls}`)
    w.style.setProperty('--accent', accent)
    const head = el('div', 'win-head', `<h2>${esc(title)}</h2><span class="sub"></span>`)
    const x = el('button', 'win-x', ICON.close)
    x.addEventListener('click', () => closeWindow())
    head.appendChild(x)
    const body = el('div', 'win-body')
    w.append(head, body)
    let footEl = null
    if (foot) {
      footEl = el('div', 'win-foot')
      w.appendChild(footEl)
    }
    layer.appendChild(w)
    open = { id, el: w, body, sub: head.querySelector('.sub'), render, update, built: false, foot: footEl, footFn: foot, proximity }
    if (sub) open.sub.textContent = sub
    refresh()
    sfx.windowOpen()
    actions.onWindow?.(id)
  }
  function refresh() {
    if (!open) return
    // Windows with an update hook are built once and then only updated in place.
    if (open.update && open.built) {
      open.update(open.body, open.sub)
      return
    }
    open.built = true
    const scroll = open.body.scrollTop
    open.body.innerHTML = ''
    open.render(open.body, open.sub)
    if (open.foot) {
      open.foot.innerHTML = ''
      open.footFn(open.foot)
    }
    open.body.scrollTop = scroll
  }
  const isOpen = (id) => (id ? open?.id === id : !!open)

  function button(text, cls, fn, disabled = false) {
    const b = el('button', `big ${cls}`, text)
    b.disabled = disabled
    b.addEventListener('click', (e) => {
      e.stopPropagation()
      fn(b)
    })
    return b
  }

  // --- Food Shop (ui/foodShop.js) ---
  const foodShop = createFoodShop({ sfx, toast: (t, k) => toast(t, k), celebrate: () => actions.celebrate?.() })

  // --- Card for an owned baddie ---
  function baddieCard(b, { price = null, count = 0, dim = false, onClick = null } = {}) {
    const def = BY_ID[b.id]
    const c = el(onClick ? 'button' : 'div', `card ${dim ? 'dim' : ''}`)
    c.style.setProperty('--rc', RARITIES[def.rarity].color)
    const sz = sizeName(b.size)
    const V = VARIANTS[b.v | 0]
    c.innerHTML = `${sz ? `<span class="tag ${b.size >= 2 ? 'huge' : ''}">${sz}</span>` : ''}${V?.name ? `<span class="vtag" style="--vc:${V.color}">${V.name}</span>` : ''}${count ? `<span class="count">x${count}</span>` : ''}<img src="${baddiePortrait(def.id, 0, false, b.v)}" alt=""><b>${esc(def.name)}</b><small style="color:${RARITIES[def.rarity].color}">${RARITIES[def.rarity].name}</small><small class="inc">$${fmt(state.baddieIncome(b))}/s</small>${price != null ? `<span class="price">${price}</span>` : ''}`
    if (onClick) c.addEventListener('click', (e) => onClick(c, e))
    return c
  }

  // --- Sell ---
  // Left: everything you own as cards (hotbar first, then the pen); tap to select. Right: a
  // preview of the selection and the Sell button. Sell All sells the hotbar only: the
  // baddies placed in your pen keep earning.
  const sellSel = new Set() // selected entries' b objects (pen entries or hotbar items)
  let sellConfirm = false
  function sell(body, sub) {
    const all = state.owned()
    for (const b of [...sellSel]) if (!all.some((e) => e.b === b)) sellSel.delete(b)
    sub.textContent = `${state.S.baddies.length}/${state.capacity()} in your pen`
    const busy = actions.fusing()
    const wrap = el('div', 'sellw')
    const leftCol = el('div', 'sellw-left')
    const grid = el('div', 'sellw-grid')
    const hot = all.filter((e) => e.kind === 'hot')
    const pen = all.filter((e) => e.kind === 'pen').sort((a, b) => state.baddieIncome(a.b) - state.baddieIncome(b.b))
    const section = (title, list) => {
      if (!list.length) return
      grid.appendChild(el('div', 'sellw-sec outline', `${esc(title)} <small>${list.length}</small>`))
      for (const e of list) grid.appendChild(sellCard(e))
    }
    section('Not placed', hot)
    section('In your pen', pen)
    if (!all.length) grid.appendChild(el('div', 'note sellw-empty', 'No baddies to sell yet. Throw food in the lane to catch some!'))
    const hotTotal = hot.reduce((t, e) => t + state.sellPrice(e.b), 0)
    const sellAll = el('button', `sellw-all ${hot.length ? '' : 'off'}`, `${ICON.cash}<span class="outline">Sell All (${money(hotTotal)})</span>`)
    sellAll.disabled = !hot.length || busy
    sellAll.addEventListener('click', () => {
      const got = actions.sellMany(hot)
      if (got) toast(`Sold ${hot.length} baddie${hot.length > 1 ? 's' : ''} for ${money(got)}`, 'good')
      sellSel.clear()
      sellConfirm = false
      refresh()
    })
    leftCol.append(grid, sellAll, el('div', 'sellw-keep outline', 'Keeps baddies in your pen'))

    const right = el('div', 'sellw-right')
    const picked = all.filter((e) => sellSel.has(e.b))
    const total = picked.reduce((t, e) => t + state.sellPrice(e.b), 0)
    const pv = el('div', `sellw-preview ${picked.length ? 'has' : ''}`)
    const box = el('div', 'pv-box')
    picked.slice(0, 3).forEach((e, i) => {
      const img = el('img', `pv-img n${Math.min(3, picked.length)} i${i}`)
      img.alt = ''
      img.src = baddiePortrait(e.b.id)
      box.appendChild(img)
    })
    const label = picked.length === 1 ? fullName(picked[0].b) : picked.length ? `${picked.length} baddies` : 'Tap baddies to sell'
    pv.append(box, el('b', 'pv-label outline', esc(label)))
    if (picked.length) pv.appendChild(el('span', 'pv-price outline', `+${money(total)}`))
    const sellBtn = el('button', `sellw-sell ${picked.length ? (sellConfirm ? 'confirm' : 'on') : ''}`, `<span class="outline">${picked.length && sellConfirm ? 'Sure?' : 'Sell'}</span>`)
    sellBtn.disabled = !picked.length || busy
    sellBtn.addEventListener('click', () => {
      if (picked.some((e) => isPricey(e.b)) && !sellConfirm) {
        sellConfirm = true
        sfx.click?.()
        refresh()
        return
      }
      const got = actions.sellMany(picked)
      if (got) toast(picked.length === 1 ? `Sold ${fullName(picked[0].b)} for ${money(got)}` : `Sold ${picked.length} baddies for ${money(got)}`, 'good')
      sellSel.clear()
      sellConfirm = false
      refresh()
    })
    right.append(pv, sellBtn)
    wrap.append(leftCol, right)
    body.appendChild(wrap)
  }
  function sellCard(e) {
    const def = BY_ID[e.b.id]
    const on = sellSel.has(e.b)
    const c = el('button', `scard ${on ? 'on' : ''}`)
    c.type = 'button'
    c.style.setProperty('--rc', RARITIES[def.rarity].color)
    c.innerHTML = `<b class="nm outline">${esc(fullName(e.b))}</b><img src="${baddiePortrait(def.id)}" alt=""><span class="pr outline">${money(state.sellPrice(e.b))}</span>${on ? '<i class="tick">✔</i>' : ''}`
    c.addEventListener('click', () => {
      if (sellSel.has(e.b)) sellSel.delete(e.b)
      else sellSel.add(e.b)
      sellConfirm = false
      sfx.click?.()
      refresh()
    })
    return c
  }

  // --- Fuse Machine ---
  // Three slots ("Empty" + plus) piped into a result box. A plus opens a picker of what you
  // own (pen and hotbar); once one slot is filled the others only take the same baddie and
  // size. "Add N more" auto-fills, then turns into FUSE!; FUSE ALL fuses every triple.
  const fuseSel = [null, null, null] // entries { kind, b }
  let picking = -1
  const maxSize = SIZES.length - 1
  function fuseCandidates() {
    const used = new Set(fuseSel.filter(Boolean).map((e) => e.b))
    const first = fuseSel.find(Boolean)
    return state.owned().filter((e) => !used.has(e.b) && e.b.size < maxSize && (!first || state.fuseKey(e.b) === state.fuseKey(first.b)))
  }
  function groupsOf(list) {
    const m = new Map()
    for (const e of list) {
      const k = state.fuseKey(e.b)
      if (!m.has(k)) m.set(k, [])
      m.get(k).push(e)
    }
    return [...m.values()]
  }
  function autoFill() {
    const empty = fuseSel.filter((x) => !x).length
    let cands = fuseCandidates()
    if (!cands.length || !empty) return false
    if (!fuseSel.some(Boolean)) {
      // Best group first: one that can finish a fuse, then the most valuable.
      const gs = groupsOf(cands).sort((a, b) => (b.length >= 3) - (a.length >= 3) || state.baddieIncome(b[0].b) - state.baddieIncome(a[0].b))
      cands = gs[0]
    }
    for (let i = 0; i < 3 && cands.length; i++) if (!fuseSel[i]) fuseSel[i] = cands.shift()
    return true
  }
  function fuseWin(body, sub) {
    const own = state.owned()
    for (let i = 0; i < 3; i++) if (fuseSel[i] && !own.some((e) => e.b === fuseSel[i].b)) fuseSel[i] = null
    sub.textContent = ''
    const busy = actions.fusing()
    actions.fuseSlots?.(fuseSel.filter(Boolean).length)
    const w = el('div', 'fusew')
    w.innerHTML = `<div class="fw-title outline">Bring <em>3</em> same Baddies to Fuse</div><div class="fw-sub outline"><em>Always</em> a bigger size, sometimes even <em>Luckier</em>!</div>`
    if (picking >= 0 && !busy) {
      w.appendChild(fusePicker())
      body.appendChild(w)
      return
    }
    const stage = el('div', 'fw-stage')
    const slots = el('div', 'fw-slots')
    for (let i = 0; i < 3; i++) {
      const e = fuseSel[i]
      const s = el('div', `fw-slot ${e ? 'full' : ''}`)
      if (e) {
        const def = BY_ID[e.b.id]
        s.style.setProperty('--rc', RARITIES[def.rarity].color)
        s.innerHTML = `<b class="outline">${esc(fullName(e.b))}</b>`
        const pic = el('button', 'fw-pic', `<img src="${baddiePortrait(def.id)}" alt=""><i class="x">${ICON.close}</i>`)
        pic.title = 'Take out'
        pic.disabled = busy
        pic.addEventListener('click', () => {
          fuseSel[i] = null
          sfx.click?.()
          refresh()
        })
        s.appendChild(pic)
      } else {
        s.innerHTML = '<b class="outline">Empty</b>'
        const plus = el('button', 'fw-plus', '<i></i>')
        plus.title = 'Add a baddie'
        plus.disabled = busy
        plus.addEventListener('click', () => {
          picking = i
          sfx.click?.()
          refresh()
        })
        s.appendChild(plus)
      }
      slots.appendChild(s)
    }
    const pipes = el('div', 'fw-pipes', '<svg viewBox="0 0 300 100" preserveAspectRatio="none" aria-hidden="true"><path class="o" d="M50 0V40L138 72M150 0V64M250 0V40L162 72"/><path d="M50 0V40L138 72M150 0V64M250 0V40L162 72"/></svg>')
    const full = fuseSel.every(Boolean)
    const res = el('div', `fw-result ${busy ? 'busy' : ''} ${full ? 'ready' : ''}`)
    if (busy) res.innerHTML = '<div class="fw-spin"></div><b class="outline">Fusing...</b>'
    else if (full) {
      const b = fuseSel[0].b
      const next = { id: b.id, size: b.size + 1, v: b.v, a: b.a }
      const def = BY_ID[b.id]
      res.style.setProperty('--rc', RARITIES[def.rarity].color)
      const lucky = b.size + 2 <= maxSize ? `Lucky: ${SIZES[b.size + 2].name}!` : 'Lucky: bonus cash!'
      res.innerHTML = `<span class="tag outline">${SIZES[next.size].name}</span><img src="${baddiePortrait(def.id)}" alt=""><small class="inc outline">$${fmt(state.baddieIncome(next))}/s</small><small class="luck outline">${Math.round(FUSE.luckyChance * 100)}% ${lucky}</small>`
    } else res.innerHTML = '<span class="q outline">?</span>'
    stage.append(slots, pipes, res)
    w.appendChild(stage)

    const btns = el('div', 'fw-btns')
    const empty = fuseSel.filter((x) => !x).length
    let left
    if (full) {
      left = el('button', 'fw-btn go', '<span class="outline">FUSE!</span>')
      left.disabled = busy
      left.addEventListener('click', () => {
        actions.fuse([...fuseSel])
        refresh()
      })
    } else {
      const can = fuseCandidates().length > 0
      left = el('button', `fw-btn ${can ? 'blue' : ''}`, `<span class="outline">Add ${empty} more</span>`)
      left.disabled = busy || !can
      left.addEventListener('click', () => {
        if (autoFill()) sfx.equip?.()
        else sfx.deny?.()
        refresh()
      })
    }
    const ready = state.fusable().length
    const all = el('button', `fw-btn ${ready ? 'gold' : ''}`, '<span class="outline">FUSE ALL</span>')
    all.disabled = busy || !ready
    all.addEventListener('click', () => {
      fuseSel.fill(null)
      actions.fuseAll()
      refresh()
    })
    btns.append(left, all)
    w.appendChild(btns)
    if (!own.length) w.appendChild(el('div', 'fw-hint outline', 'Catch baddies in the lane first: 3 of a kind make a BIG one (4x income), 3 BIG make a HUGE (20x)!'))
    body.appendChild(w)
  }
  function fusePicker() {
    const p = el('div', 'fw-picker')
    const head = el('div', 'fw-pick-head')
    const back = el('button', 'big grey', 'Back')
    back.addEventListener('click', () => {
      picking = -1
      refresh()
    })
    head.append(el('b', 'outline', 'Pick a baddie'), back)
    p.appendChild(head)
    const gs = groupsOf(fuseCandidates()).sort((a, b) => b.length - a.length || state.baddieIncome(b[0].b) - state.baddieIncome(a[0].b))
    if (!gs.length) {
      p.appendChild(el('div', 'note', fuseSel.some(Boolean) ? 'You have no more of this baddie.' : 'Nothing to fuse yet. HUGE baddies are already the biggest!'))
      return p
    }
    const grid = el('div', 'grid')
    const have = fuseSel.filter(Boolean).length
    for (const g of gs) {
      const n = Math.min(3, g.length + have)
      const card = baddieCard(g[0].b, {
        count: g.length,
        price: n >= 3 ? 'Ready!' : `${n}/3`,
        onClick: () => {
          const slot = picking >= 0 && !fuseSel[picking] ? picking : fuseSel.indexOf(null)
          if (slot >= 0) fuseSel[slot] = g[0]
          picking = -1
          sfx.equip?.()
          refresh()
        },
      })
      grid.appendChild(card)
    }
    p.appendChild(grid)
    return p
  }

  // --- Pen upgrade ---
  function penUpgrade(body, sub) {
    const cap = state.capacity()
    sub.textContent = `${state.S.baddies.length}/${cap} baddies`
    if (state.capacityMaxed()) {
      body.appendChild(el('div', 'note', `Your pen is at its biggest: ${cap} baddies.`))
      return
    }
    const next = cap + 2
    const cost = state.capacityCost()
    const r = el('div', 'row')
    r.innerHTML = `<div class="row-img" style="font-size:2.2em">\u{1F3E0}</div><div class="row-text"><b>Pen capacity ${cap} → ${next}</b><small>Room for 2 more baddies earning money</small></div>`
    r.appendChild(button(money(cost), state.S.money >= cost ? '' : 'poor', () => {
      if (state.upgradeCapacity()) {
        sfx.upgrade()
        actions.celebrate?.()
        toast(`Pen upgraded! Holds ${state.capacity()} baddies`, 'good')
        refresh()
      } else sfx.deny()
    }))
    body.appendChild(r)
  }

  // --- Shop (upgrades) ---
  function shop(body, sub) {
    sub.textContent = 'Spend your money'
    const rows = el('div', 'rows')
    const emoji = { cash: '\u{1F4B0}', arms: '\u{1F4AA}', luck: '\u{1F340}', speed: '\u{1F45F}', magnet: '\u{1F9F2}' }
    for (const u of UPGRADES) {
      const level = state.S.upgrades[u.id] ?? 0
      const maxed = level >= u.max
      const cost = maxed ? 0 : u.cost(level)
      const r = el('div', 'row')
      const pips = u.max > 1 ? `<div class="pips">${Array.from({ length: u.max }, (_, i) => `<i class="${i < level ? 'on' : ''}"></i>`).join('')}</div>` : ''
      r.innerHTML = `<div class="row-img" style="font-size:2.4em">${emoji[u.id] ?? '⭐'}</div><div class="row-text"><b>${esc(u.name)}</b><small>${esc(u.desc)}${u.max > 1 ? ` • Level ${level}/${u.max}` : ''}</small>${pips}</div>`
      r.appendChild(maxed ? button(u.max > 1 ? 'MAX' : 'Owned', 'grey', () => {}, true) : button(money(cost), state.S.money >= cost ? '' : 'poor', () => {
        if (state.buyUpgrade(u.id)) {
          sfx.upgrade()
          toast(`${u.name} upgraded!`, 'good')
          refresh()
        } else sfx.deny()
      }))
      rows.appendChild(r)
    }
    body.appendChild(rows)
  }

  // --- Index (ui/indexWin.js: areas, girls, detail panel) ---
  const indexView = createIndexView({ sfx, girlSfx })
  const index = (body, sub) => indexView.render(body, sub)

  // --- My Baddies ---
  function mine(body, sub) {
    sub.textContent = `${state.S.baddies.length}/${state.capacity()} • $${fmt(state.income())}/s`
    if (!state.S.baddies.length) {
      body.appendChild(el('div', 'note', 'Your pen is empty. Walk north to the lane, hold to charge and throw food near a baddie!'))
      return
    }
    const grid = el('div', 'grid')
    for (const b of [...state.S.baddies].sort((a, c) => state.baddieIncome(c) - state.baddieIncome(a))) grid.appendChild(baddieCard(b))
    body.appendChild(grid)
  }

  // --- Settings ---
  function settings(body, sub) {
    sub.textContent = ''
    const s = el('div', 'settings')
    const vol = el('label', '', `Sound <input type="range" min="0" max="1" step="0.05">`)
    const range = vol.querySelector('input')
    range.value = actions.getVolume()
    range.addEventListener('input', () => actions.setVolume(Number(range.value)))
    const mute = el('label', '', 'Mute')
    mute.appendChild(button(actions.isMuted() ? 'Muted' : 'On', actions.isMuted() ? 'grey' : '', () => {
      actions.toggleMuted()
      refresh()
    }))
    const day = el('label', '', 'Day / Night')
    day.appendChild(button('Toggle', 'blue', () => actions.dayNight()))
    const reset = el('label', '', 'Reset progress')
    let armed = false
    reset.appendChild(button('Reset', 'red', (b) => {
      if (!armed) {
        armed = true
        b.textContent = 'Tap again'
        return
      }
      state.reset()
    }))
    s.append(vol, mute, day, reset)
    body.appendChild(s)
    body.appendChild(el('div', 'keys', '<kbd>WASD</kbd> move • <kbd>Shift</kbd> run • <kbd>Space</kbd> jump • <b>Hold click</b> or <kbd>F</kbd> charge a throw • <kbd>V</kbd> camera • <kbd>N</kbd> day/night • <kbd>R</kbd> respawn • Walk into the coloured rings to shop'))
  }

  const WINDOWS = {
    foodShop: { title: 'Food Shop', accent: '#ff4f4f', cls: 'food-win', render: foodShop.render, update: foodShop.update },
    sell: { title: 'Sell', accent: '#4fd23a', render: sell, cls: 'win-sell' },
    fuse: { title: 'Fuse Machine', accent: '#2f8cff', render: fuseWin, cls: 'win-fuse' },
    pen: { title: 'Upgrade Pen', accent: '#ff9a2e', render: penUpgrade },
    shop: { title: 'Shop', accent: '#4fd23a', render: shop },
    index: { title: 'Index', accent: '#b04aff', render: index, cls: 'win-index' },
    mine: { title: 'My Baddies', accent: '#ff7fb8', render: mine },
    settings: { title: 'Settings', accent: '#8e96a6', render: settings },
  }
  function show(id, proximity = false) {
    if (open?.id === id) return
    if (id === 'sell') {
      sellSel.clear()
      sellConfirm = false
    }
    if (id === 'fuse') {
      fuseSel.fill(null)
      picking = -1
    }
    if (id === 'index') indexView.opened()
    openWindow(id, { ...WINDOWS[id], proximity })
  }
  shopBtn.addEventListener('click', () => (isOpen('shop') ? closeWindow() : show('shop')))
  indexBtn.addEventListener('click', () => {
    indexBadge.style.display = 'none'
    isOpen('index') ? closeWindow() : show('index')
  })
  portrait.title = 'Active baddies'
  portrait.addEventListener('click', () => {
    setFolded(false)
    sfx.windowOpen()
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && open) {
      e.stopImmediatePropagation()
      closeWindow()
    }
  }, { capture: true })

  function frame(dt) {
    // Count the money display toward its target (fast, so big rewards roll up visibly).
    if (shownMoney !== targetMoney) {
      const diff = targetMoney - shownMoney
      shownMoney = Math.abs(diff) < 1 ? targetMoney : shownMoney + diff * Math.min(1, dt * 9)
      moneyVal.textContent = `$${fmt(shownMoney)}`
    }
  }
  moneyVal.textContent = `$${fmt(shownMoney)}`

  return {
    setMoney,
    setStrength,
    setQuest,
    questDone,
    toast,
    pop,
    setHint,
    setCharge,
    setPortrait,
    setCount,
    show,
    close: closeWindow,
    refresh,
    isOpen,
    openProximity: () => (open?.proximity ? open.id : null),
    refreshActive,
    focusIndex(id) {
      indexView.focus(id)
    },
    newDiscovery() {
      indexBadge.textContent = '!'
      indexBadge.style.display = ''
    },
    setFriendBoost(pct) {
      friend.querySelector('b').textContent = `FRIEND BOOST +${pct}%`
    },
    // Other modules' windows (ui/rewards.js, ui/eventsUi.js): { title, accent, render, cls? }.
    addWindow(id, def) {
      WINDOWS[id] = def
    },
    // The left column of tiles (Shop, Index, ...), for other modules' buttons.
    tiles: left,
    frame,
  }
}
