// The Rewards window (a tile in the HUD's left column): three tabs.
//   Gifts - PLAYTIME_GIFTS, claimable once each after N minutes of play this session.
//   Daily - DAILY.days: one day unlocks per UTC day on the SERVER's clock (backend daily.ts);
//           claims go through the server (`claimDaily` -> `dailyResult`) and only then pay.
//   Spin  - SPIN.wedges: the server owns the spins and rolls the prize (`spin` -> `spinResult`),
//           the wheel only animates to it. One free spin every SPIN.everyMin minutes.
// Offline (no server) Daily and Spin run locally for the session. Rewards are money, free Lucky
// Throws, potions and Event Tickets only: never premium currency (see the root CLAUDE.md).
import './rewards.css'
import { DAILY, PLAYTIME_GIFTS, SPIN } from '../config.js'
import * as net from '../net.js'
import * as state from '../game/state.js'
import { clock } from '../game/format.js'

// 5h 12m for long waits, m:ss under an hour.
const wait = (s) => (s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : clock(s))
const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

export function createRewards({ hud, sfx, celebrate }) {
  // --- Tile ---
  const btn = el('button', 'hud-btn rewards', '<span class="gift-ico">\u{1F3A1}</span><span class="outline">Rewards</span>')
  const badge = el('i', 'badge outline')
  badge.style.display = 'none'
  btn.appendChild(badge)
  hud.tiles.appendChild(btn)
  btn.addEventListener('click', () => (hud.isOpen('rewards') ? hud.close() : hud.show('rewards')))

  // --- Playtime (this session, only while the tab is visible) ---
  let played = 0 // s
  const claimedGifts = new Set()
  const giftReady = (g, i) => !claimedGifts.has(i) && played >= g.min * 60

  // --- Daily: server view { unlocked, claimed[], nextAt, serverTime } (offline: local) ---
  let daily = null
  let dailyOffset = 0 // server clock - local clock
  let dailyBusy = false
  net.onEvent('daily', (m) => setDaily(m))
  net.onEvent('dailyResult', (m) => {
    dailyBusy = false
    if (m) setDaily(m)
    if (m?.ok) payDay(m.day)
    else if (m?.reason === 'save') hud.toast('Could not save the claim. Try again.', 'warn')
    redraw()
  })
  function setDaily(m) {
    daily = { unlocked: m.unlocked | 0, claimed: Array.isArray(m.claimed) ? m.claimed : [], nextAt: m.nextAt }
    dailyOffset = (m.serverTime ?? Date.now()) - Date.now()
    redraw()
  }
  const localDaily = () => (daily ??= { unlocked: 1, claimed: [], nextAt: (Math.floor(Date.now() / 864e5) + 1) * 864e5, local: true })
  const dayReady = (i) => daily && i < daily.unlocked && !daily.claimed.includes(i)
  function claimDay(i) {
    if (!dayReady(i) || dailyBusy) return
    if (net.net.online && !daily.local) {
      dailyBusy = true
      net.send('claimDaily', { day: i })
      redraw()
      return
    }
    daily.claimed.push(i)
    payDay(i)
    redraw()
  }
  function payDay(i) {
    const text = state.grantPrize(DAILY.days[i], 'daily')
    sfx.upgrade()
    celebrate?.()
    hud.toast(`Day ${i + 1} reward: ${text}!`, 'good')
  }

  // --- Spin: { spins, nextAt } (server clock) ---
  let spins = null
  let spinOffset = 0
  let spinning = false
  let wheelAngle = 0
  net.onEvent('spins', (m) => setSpins(m))
  net.onEvent('spinResult', (m) => {
    if (m) setSpins(m)
    if (!m?.ok) {
      spinning = false
      if (m?.reason === 'none') hud.toast('No spins left. A free one comes soon!', 'warn')
      redraw()
      return
    }
    // An id this client does not know (a server on an older prize list) still pays the first wedge.
    animateTo(SPIN.wedges.find((x) => x.id === m.id) ?? SPIN.wedges[0])
  })
  function setSpins(m) {
    spins = { spins: m.spins | 0, nextAt: m.nextAt }
    spinOffset = (m.serverTime ?? Date.now()) - Date.now()
    redraw()
  }
  const localSpins = () => (spins ??= { spins: SPIN.start, nextAt: Date.now() + SPIN.everyMin * 60000, local: true })
  function accrueLocal() {
    if (!spins?.local) return
    while (spins.spins < SPIN.cap && Date.now() >= spins.nextAt) {
      spins.spins++
      spins.nextAt += SPIN.everyMin * 60000
    }
    if (spins.spins >= SPIN.cap) spins.nextAt = Date.now() + SPIN.everyMin * 60000
  }
  function rollLocal() {
    const total = SPIN.wedges.reduce((n, w) => n + w.weight, 0)
    let r = Math.random() * total
    for (const w of SPIN.wedges) {
      if (r < w.weight) return w
      r -= w.weight
    }
    return SPIN.wedges[0]
  }
  function spin() {
    if (spinning) return
    if (net.net.online && !spins?.local) {
      if (!spins || spins.spins < 1) return hud.toast('No spins left. A free one comes soon!', 'warn')
      spinning = true
      net.send('spin', {})
      redraw()
      return
    }
    localSpins()
    accrueLocal()
    if (spins.spins < 1) return hud.toast('No spins left. A free one comes soon!', 'warn')
    spins.spins--
    if (spins.spins === SPIN.cap - 1) spins.nextAt = Date.now() + SPIN.everyMin * 60000
    spinning = true
    animateTo(rollLocal())
  }
  // Turns the wheel a few times and stops with wedge `w` under the pointer (top), then pays.
  function animateTo(w) {
    const n = SPIN.wedges.length
    const i = SPIN.wedges.indexOf(w)
    const seg = 360 / n
    const target = 360 - (i * seg + seg / 2) + (Math.random() - 0.5) * seg * 0.6
    wheelAngle = wheelAngle - (wheelAngle % 360) + 360 * 5 + target
    const wheel = view?.body.querySelector('.rw-wheel')
    sfx.chargeStart?.()
    if (wheel) wheel.style.transform = `rotate(${wheelAngle}deg)`
    setTimeout(() => {
      spinning = false
      const text = state.grantPrize(w, 'spin')
      sfx.upgrade()
      if (w.id === 'jackpot') celebrate?.()
      hud.toast(`${w.label}: ${text}!`, w.id === 'jackpot' ? 'rare' : 'good')
      redraw()
    }, wheel ? 4200 : 50)
  }

  // --- Window ---
  let tab = 'gifts'
  let view = null // { body, sub }
  function render(body, sub) {
    view = { body, sub }
    if (!net.net.online) {
      localDaily()
      localSpins()
    }
    sub.textContent = 'Free rewards for playing'
    const tabs = el('div', 'rw-tabs')
    for (const [id, name] of [['gifts', 'Gifts'], ['daily', 'Daily'], ['spin', 'Spin']]) {
      const t = el('button', `rw-tab${tab === id ? ' on' : ''}`, `<span class="outline">${name}</span><i class="dot"></i>`)
      t.dataset.tab = id
      t.addEventListener('click', () => {
        tab = id
        sfx.click?.()
        rebuild()
      })
      tabs.appendChild(t)
    }
    const page = el('div', `rw-page rw-${tab}`)
    body.append(tabs, page)
    if (tab === 'gifts') giftsPage(page)
    else if (tab === 'daily') dailyPage(page)
    else spinPage(page)
    update()
  }
  function rebuild() {
    if (!view || !hud.isOpen('rewards')) return
    view.body.innerHTML = ''
    render(view.body, view.sub)
  }
  function giftsPage(page) {
    PLAYTIME_GIFTS.forEach((g, i) => {
      const card = el('div', 'rw-card')
      card.dataset.gift = i
      card.innerHTML = `<div class="ico">${g.icon}</div><b>${state.prizeText(g)}</b><small class="t"></small>`
      const b = el('button', 'big', 'Claim')
      b.addEventListener('click', () => {
        if (!giftReady(g, i)) return sfx.deny()
        claimedGifts.add(i)
        const text = state.grantPrize(g, 'gift')
        sfx.upgrade()
        celebrate?.()
        hud.toast(`Gift: ${text}!`, 'good')
        update()
      })
      card.appendChild(b)
      page.appendChild(card)
    })
  }
  function dailyPage(page) {
    DAILY.days.forEach((d, i) => {
      const card = el('div', 'rw-card day')
      card.dataset.day = i
      card.innerHTML = `<div class="dn outline">Day ${i + 1}</div><div class="ico">${d.icon}</div><b>${state.prizeText(d)}${d.tickets ? ` + ${d.tickets} tickets` : ''}</b>`
      const b = el('button', 'big', 'Claim')
      b.addEventListener('click', () => claimDay(i))
      card.appendChild(b)
      page.appendChild(card)
    })
    page.appendChild(el('div', 'rw-note', ''))
  }
  function spinPage(page) {
    const n = SPIN.wedges.length
    const seg = 360 / n
    const stops = SPIN.wedges.map((w, i) => `${w.color} ${i * seg}deg ${(i + 1) * seg}deg`).join(',')
    const wrap = el('div', 'rw-wheelwrap')
    const wheel = el('div', 'rw-wheel')
    wheel.style.background = `conic-gradient(${stops})`
    wheel.style.transform = `rotate(${wheelAngle}deg)`
    SPIN.wedges.forEach((w, i) => {
      const lab = el('div', 'rw-wl', `<span class="outline">${w.label}</span>`)
      lab.style.transform = `rotate(${i * seg + seg / 2}deg)`
      wheel.appendChild(lab)
    })
    wrap.append(wheel, el('i', 'rw-pointer'))
    const go = el('button', 'big rw-go', 'SPIN')
    go.addEventListener('click', spin)
    page.append(wrap, go, el('div', 'rw-note', ''))
  }
  // Countdowns, button states and the badge (also called every half second while open).
  function update() {
    const ready = readyCount()
    badge.textContent = String(ready)
    badge.style.display = ready ? '' : 'none'
    if (!view || !hud.isOpen('rewards')) return
    const body = view.body
    for (const t of body.querySelectorAll('.rw-tab')) {
      const n = t.dataset.tab === 'gifts' ? giftsReady() : t.dataset.tab === 'daily' ? daysReady() : spins?.spins ?? 0
      t.querySelector('.dot').style.display = n ? '' : 'none'
    }
    for (const c of body.querySelectorAll('[data-gift]')) {
      const i = +c.dataset.gift
      const g = PLAYTIME_GIFTS[i]
      const b = c.querySelector('button')
      const left = g.min * 60 - played
      c.classList.toggle('done', claimedGifts.has(i))
      c.classList.toggle('ready', giftReady(g, i))
      c.querySelector('.t').textContent = claimedGifts.has(i) ? 'Claimed' : left > 0 ? clock(left) : 'Ready!'
      b.disabled = !giftReady(g, i)
      b.textContent = claimedGifts.has(i) ? '✓' : 'Claim'
    }
    for (const c of body.querySelectorAll('[data-day]')) {
      const i = +c.dataset.day
      const got = daily?.claimed.includes(i)
      const b = c.querySelector('button')
      c.classList.toggle('done', !!got)
      c.classList.toggle('ready', dayReady(i))
      c.classList.toggle('locked', !daily || i >= daily.unlocked)
      b.disabled = !dayReady(i) || dailyBusy
      b.textContent = got ? '✓' : dayReady(i) ? 'Claim' : '\u{1F512}'
    }
    const note = body.querySelector('.rw-note')
    if (tab === 'daily' && note) note.textContent = daily ? `Next day unlocks in ${wait((daily.nextAt - (Date.now() + dailyOffset)) / 1000)}` : 'Connecting...'
    if (tab === 'spin') {
      accrueLocal()
      const go = body.querySelector('.rw-go')
      if (go) {
        go.disabled = spinning || !spins || spins.spins < 1
        go.textContent = spinning ? '...' : `SPIN (${spins?.spins ?? 0})`
      }
      if (note) note.textContent = !spins ? 'Connecting...' : spins.spins >= SPIN.cap ? 'Spins are full: use one!' : `Free spin in ${clock((spins.nextAt - (Date.now() + spinOffset)) / 1000)}`
    }
  }
  const redraw = () => update()
  const giftsReady = () => PLAYTIME_GIFTS.reduce((n, g, i) => n + (giftReady(g, i) ? 1 : 0), 0)
  const daysReady = () => DAILY.days.reduce((n, _, i) => n + (dayReady(i) ? 1 : 0), 0)
  const readyCount = () => giftsReady() + daysReady() + (spins?.spins ?? 0)
  hud.addWindow('rewards', { title: 'Rewards', accent: '#ff9a2e', render, update: () => update(), cls: 'win-rewards' })

  let tickT = 0
  return {
    // Every frame: playtime (while visible); the window and badge refresh twice a second.
    update(dt) {
      if (!document.hidden) played += dt
      tickT += dt
      if (tickT < 0.5) return
      tickT = 0
      if (!net.net.online) {
        localDaily()
        localSpins()
        accrueLocal()
      }
      update()
    },
  }
}
