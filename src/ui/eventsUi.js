// Live events on the HUD (game/events.js): a row of pills over the money (what is running and for
// how long), a toast when one starts, and the Events window (a tile in the left column): what is
// on and coming up, the Hungry Giant (game/boss.js), and the season: its girls (found or not) and
// the event shop, paid in earned Event Tickets (never premium currency, see the root CLAUDE.md).
import { AREAS, EVENT_SHOP, EVENTS, POTIONS, RARITIES, SEASON } from '../config.js'
import * as events from '../game/events.js'
import * as state from '../game/state.js'
import { clock, fmt } from '../game/format.js'
import { baddiePortrait } from './snapshot.js'

const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
const left = (endsAt) => clock(Math.max(0, (endsAt - Date.now()) / 1000))
const span = (ms) => {
  const s = Math.max(0, ms / 1000)
  return s >= 86400 ? `${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h` : s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m` : clock(s)
}

export function createEventsUi({ hud, sfx, boss, celebrate }) {
  // --- Pills (over the money) ---
  const pills = el('div', 'hud-events')
  document.querySelector('.hud-stats')?.prepend(pills)
  let pillKey = ''
  const seen = new Set() // events already announced this session
  function drawPills() {
    const list = events.active()
    // Potions are personal events too.
    for (const [kind, P] of Object.entries(POTIONS)) {
      const s = state.potionLeft(kind)
      if (s > 0) list.push({ id: `potion-${kind}`, icon: P.icon, name: P.name, text: '', endsAt: Date.now() + s * 1000, color: '#c97bff' })
    }
    const key = list.map((e) => e.id).join(',')
    if (key !== pillKey) {
      pillKey = key
      pills.innerHTML = ''
      for (const e of list) {
        const p = el('button', `ev-pill ev-${e.id}`, `<span class="i">${e.icon}</span><span class="n outline">${e.name}</span><span class="t outline"></span>`)
        p.style.setProperty('--ec', e.color)
        p.title = `${e.name}: ${e.text}`
        p.addEventListener('click', () => hud.show('events'))
        p.addEventListener('pointerdown', (ev) => ev.stopPropagation())
        pills.appendChild(p)
      }
      for (const e of list) {
        if (seen.has(e.id + e.endsAt) || e.id === 'featured' || e.id === 'season' || e.id.startsWith('potion')) continue
        seen.add(e.id + e.endsAt)
        hud.toast(`${e.icon} ${e.name} started: ${e.text}!`, 'rare')
      }
    }
    list.forEach((e, i) => {
      const t = pills.children[i]?.querySelector('.t')
      if (t) t.textContent = e.id === 'season' ? span(e.endsAt - Date.now()) : left(e.endsAt)
    })
  }

  // --- Tile ---
  const btn = el('button', 'hud-btn events', '<span class="gift-ico">\u{1F389}</span><span class="outline">Events</span>')
  const badge = el('i', 'badge outline', '!')
  badge.style.display = 'none'
  btn.appendChild(badge)
  hud.tiles.appendChild(btn)
  btn.addEventListener('click', () => (hud.isOpen('events') ? hud.close() : hud.show('events')))

  // --- Window ---
  let view = null
  function render(body, sub) {
    view = { body, sub }
    const s = events.season()
    sub.textContent = `${s.season.icon} ${s.season.name}`

    // Live and coming up.
    const live = el('div', 'ev-sec')
    live.innerHTML = '<h3 class="outline">Live events</h3>'
    const rows = el('div', 'ev-rows')
    rows.dataset.live = '1'
    live.appendChild(rows)

    // The Hungry Giant.
    const giant = el('div', 'ev-sec ev-giant')
    giant.innerHTML = `<h3 class="outline">\u{1F479} Hungry Giant</h3><p>She stomps up to the end of the lane at :${String(EVENTS.boss.at[0]).padStart(2, '0')} and :${String(EVENTS.boss.at[1]).padStart(2, '0')} every hour. Every throw anyone in your server makes feeds her. Fill her up in ${EVENTS.boss.length} minutes and everyone who threw gets cash (more for more throws) and ${EVENTS.boss.tickets} tickets!</p><div class="ev-bar"><i></i><span class="outline"></span></div>`

    // The season: tickets, girls, shop.
    const sea = el('div', 'ev-sec ev-season')
    sea.style.setProperty('--sc', s.season.color)
    sea.innerHTML = `<h3 class="outline">${s.season.icon} ${s.season.name}</h3><p>Season girls sometimes come out for your food in any area (1 in ${SEASON.chance}) and earn like the area you catch them in. Every throw gives ${SEASON.ticketsPerThrow} ticket, a season girl ${SEASON.ticketsPerGirl} more.</p><div class="ev-tickets outline"></div>`
    const girls = el('div', 'ev-girls')
    for (const g of s.girls) {
      const found = !!state.S.discovered[g.id]
      const c = el('div', `ev-girl${found ? '' : ' unknown'}`)
      c.style.setProperty('--rc', RARITIES[g.rarity].color)
      c.innerHTML = `<img alt="" src="${baddiePortrait(g.id)}"><b class="outline">${found ? g.name : '???'}</b><small style="color:${RARITIES[g.rarity].color}">${RARITIES[g.rarity].name}</small><small>1 in ${fmt(g.odds)}</small>`
      girls.appendChild(c)
    }
    sea.appendChild(girls)
    const shop = el('div', 'rows ev-shop')
    for (const item of EVENT_SHOP) {
      const r = el('div', 'row')
      r.innerHTML = `<div class="row-img" style="font-size:2.2em">${item.icon}</div><div class="row-text"><b>${item.name}</b><small>${item.desc}</small></div>`
      const b = el('button', 'big', `\u{1F39F}\u{FE0F} ${item.price}`)
      b.dataset.price = item.price
      b.addEventListener('click', () => buy(item))
      r.appendChild(b)
      shop.appendChild(r)
    }
    sea.appendChild(shop)
    body.append(live, giant, sea)
    update()
  }
  function buy(item) {
    if (!state.spendTickets(item.price)) {
      sfx.deny()
      hud.toast(`You need ${item.price - (state.S.tickets | 0)} more tickets. Keep throwing!`, 'warn')
      return
    }
    if (item.potion) state.addPotion(item.potion, item.minutes)
    if (item.lucky) state.S.luckyCredits = Math.min(99, (state.S.luckyCredits | 0) + item.lucky)
    if (item.lure) state.S.lures = (state.S.lures | 0) + item.lure
    state.save()
    sfx.upgrade()
    celebrate?.()
    hud.toast(`${item.name}! ${item.desc}.`, 'good')
    update()
  }
  function update() {
    const b = boss?.status()
    badge.style.display = b?.on || events.luckHour().on ? '' : 'none'
    if (!view || !hud.isOpen('events')) return
    const body = view.body
    const rows = body.querySelector('[data-live]')
    if (rows) {
      const now = Date.now()
      const lh = events.luckHour(now)
      const wk = events.weekend(now)
      const f = events.featured(now)
      const bw = events.bossWindow(now)
      const line = (on, icon, name, text, when) => `<div class="ev-row${on ? ' on' : ''}"><span class="i">${icon}</span><span class="tx"><b>${name}</b><small>${text}</small></span><span class="w outline">${when}</span></div>`
      rows.innerHTML = [
        line(lh.on, '\u{1F340}', 'Luck Hour', `${EVENTS.luckHour.luck}x luck for the first ${EVENTS.luckHour.length} minutes of every hour`, lh.on ? `${left(lh.endsAt)} left` : `in ${left(lh.nextAt)}`),
        line(wk.on, '\u{1F4B0}', 'Weekend Boost', `${EVENTS.weekend.income}x income all Saturday and Sunday (UTC)`, wk.on ? `${span(wk.endsAt - now)} left` : `in ${span(wk.nextAt - now)}`),
        line(true, '\u{2B50}', `Featured: ${AREAS[f.area].name}`, `Area ${f.area + 1}: ${EVENTS.featured.luck}x luck and ${EVENTS.featured.variant}x GOLD / DIAMOND / RAINBOW odds`, `${left(f.endsAt)} left`),
        line(bw.on, '\u{1F479}', 'Hungry Giant', 'Feed her together with your server', bw.on ? `${left(bw.endsAt)} left` : `in ${left(bw.nextAt)}`),
      ].join('')
    }
    const bar = body.querySelector('.ev-giant .ev-bar')
    if (bar && b) {
      bar.querySelector('i').style.width = `${Math.round(Math.min(1, b.need ? b.fill / b.need : 0) * 100)}%`
      bar.querySelector('span').textContent = b.on ? (b.won ? 'FULL! Rewards sent!' : `${b.fill} / ${b.need} • your throws: ${b.mine}`) : `Next visit in ${left(b.nextAt)}`
      bar.classList.toggle('on', b.on)
    }
    const t = body.querySelector('.ev-tickets')
    if (t) t.textContent = `\u{1F39F}\u{FE0F} ${fmt(state.S.tickets | 0)} tickets • season ends in ${span(events.season().endsAt - Date.now())}${state.S.lures ? ` • Lure ready!` : ''}`
    for (const b2 of body.querySelectorAll('.ev-shop button')) b2.classList.toggle('poor', (state.S.tickets | 0) < +b2.dataset.price)
  }
  hud.addWindow('events', { title: 'Events', accent: '#ff6fb8', render, update: () => update(), cls: 'win-events' })

  let tickT = 0
  return {
    update(dt) {
      tickT += dt
      if (tickT < 0.5) return
      tickT = 0
      drawPills()
      update()
    },
  }
}
