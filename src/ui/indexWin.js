// The Index window: every lane area as a section (its painted scenery on the left, a grid of
// its ten girls, a progress bar "n/10" and the bonus for completing it), and a detail panel
// on the right with the selected girl's big portrait, name, rarity, catch odds and income.
// Girls you have not found are black silhouettes under "???" on their rarity colour; ones
// found since you last looked wear a NEW tag. Portraits are drawn a few per frame as their
// cards scroll into view (snapshot.js queuePortrait). The built DOM is kept between HUD
// refreshes and only rebuilt when what it shows changes.
import './indexWin.css'
import { AREAS, BADDIES, HUB, INDEX_BONUS, RARITIES } from '../config.js'
import { fmt } from '../game/format.js'
import * as state from '../game/state.js'
import { areaArt } from './areaArt.js'
import { queuePortrait } from './snapshot.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
function el(tag, cls, html) {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}
// The NEW tags already looked at live in the save (state.S.seen, stored on the server).
function loadSeen() {
  return new Set(state.S.seen)
}
function saveSeen(set) {
  state.S.seen = [...set]
  state.save()
}
// Metres from the throw line to where an area starts.
const areaDistance = (a) => Math.max(0, Math.round(HUB.lane.throwLine - HUB.zones[a].from))

export function createIndexView({ sfx, girlSfx }) {
  let built = null // { root, list, sig }
  let selected = null
  let seen = null
  let observer = null

  const owned = (id) => state.owned().filter((e) => e.b.id === id).length
  const signature = () => BADDIES.map((b) => (state.S.discovered[b.id] ? 1 : 0)).join('') + '|' + Math.floor(state.range()) + '|' +state.owned().map((e) => e.b.id).join(',')

  function cardStyle(e, def) {
    const r = RARITIES[def.rarity]
    e.style.setProperty('--c1', r.card[0])
    e.style.setProperty('--c2', r.card[1])
    e.style.setProperty('--rc', r.color)
    if (r.shimmer) e.classList.add('shimmer')
  }

  function setImg(img, id, silhouette) {
    queuePortrait(id, silhouette, (url) => {
      if (url) img.src = url
      img.classList.add('in')
    })
  }

  function fillDetail(detail) {
    const def = BADDIES.find((b) => b.id === selected) ?? BADDIES[0]
    const known = !!state.S.discovered[def.id]
    const r = RARITIES[def.rarity]
    detail.className = `ix-detail${r.shimmer ? ' shimmer' : ''}${known ? '' : ' unknown'}`
    cardStyle(detail, def)
    const n = owned(def.id)
    detail.innerHTML = `<div class="ix-portrait"><img alt=""><i class="ix-glow"></i></div>
      <div class="ix-info">
        <b class="ix-name outline">${known ? esc(def.name) : '???'}</b>
        <span class="ix-rarity outline">${esc(r.name)}</span>
        <span class="ix-odds outline">1 in ${fmt(def.odds)}${known ? ` <em>•</em> <span class="inc">$${fmt(def.income)}/s</span>` : ''}</span>
        <small class="ix-where">${esc(AREAS[def.area].name)}${known && n ? ` • You have ${n}` : ''}</small>
      </div>`
    setImg(detail.querySelector('img'), def.id, !known)
  }

  function build() {
    if (!seen) seen = loadSeen()
    const root = el('div', 'ix')
    const list = el('div', 'ix-list')
    const detail = el('div', 'ix-detail')
    root.append(list, detail)
    if (!selected) selected = (BADDIES.find((b) => state.S.discovered[b.id]) ?? BADDIES[0]).id
    observer?.disconnect()
    observer = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        const img = en.target
        observer.unobserve(img)
        setImg(img, img.dataset.id, img.dataset.sil === '1')
      }
    }, { root: list, rootMargin: '200px 0px' })
    const range = state.range()
    const fresh = []
    AREAS.forEach((area, a) => {
      const girls = BADDIES.filter((b) => b.area === a)
      const found = girls.filter((b) => state.S.discovered[b.id]).length
      const done = found === girls.length
      const dist = areaDistance(a)
      const locked = a > 0 && range < dist
      const sec = el('section', `ix-area${done ? ' done' : ''}${locked ? ' locked' : ''}`)
      sec.style.setProperty('--b1', area.banner[0])
      sec.style.setProperty('--b2', area.banner[1])
      const art = el('div', 'ix-art', `<img alt="" src="${areaArt(area.id)}"><span class="ix-art-tag outline">AREA ${a + 1}</span><b class="ix-art-name outline">${esc(area.name)}</b>${locked ? `<span class="ix-lock outline">\u{1F512} Throw ${dist} m</span>` : ''}`)
      const main = el('div', 'ix-main')
      const cards = el('div', 'ix-cards')
      for (const def of girls) {
        const known = !!state.S.discovered[def.id]
        const isNew = known && !seen.has(def.id)
        if (isNew) fresh.push(def.id)
        const c = el('button', `ix-card${known ? '' : ' unknown'}${def.id === selected ? ' sel' : ''}`)
        c.type = 'button'
        c.dataset.id = def.id
        cardStyle(c, def)
        c.innerHTML = `<img alt="" data-id="${def.id}" data-sil="${known ? 0 : 1}"><span class="ix-q outline">${known ? esc(def.name) : '???'}</span>${isNew ? '<span class="ix-new outline">NEW!</span>' : ''}${known && owned(def.id) ? '<i class="ix-own"></i>' : ''}`
        c.addEventListener('click', (e) => {
          e.stopPropagation()
          if (selected === def.id) return
          root.querySelector('.ix-card.sel')?.classList.remove('sel')
          c.classList.add('sel')
          selected = def.id
          girlSfx.select(def.rarity, known)
          fillDetail(detail)
        })
        cards.appendChild(c)
        observer.observe(c.querySelector('img'))
      }
      const pct = Math.round(INDEX_BONUS * 100)
      const prog = el('div', 'ix-prog', `<div class="bar"><i style="width:${(found / girls.length) * 100}%"></i><span class="outline">${found}/${girls.length}</span></div><small class="outline">${done ? `✔ +${pct}% income` : `Complete: +${pct}% income`}</small>`)
      main.append(cards, prog)
      sec.append(art, main)
      list.appendChild(sec)
    })
    fillDetail(detail)
    // Found since the last look: tagged NEW this time, plain next time.
    for (const id of fresh) seen.add(id)
    if (fresh.length) saveSeen(seen)
    return { root, list, detail, sig: signature() }
  }

  function render(body, sub) {
    const found = BADDIES.filter((b) => state.S.discovered[b.id]).length
    const bonus = Math.round((state.indexMult() - 1) * 100)
    sub.textContent = `${found}/${BADDIES.length} found${bonus ? ` • +${bonus}% income` : ''}`
    const sig = signature()
    const scroll = built?.list.scrollTop ?? 0
    if (!built || built.sig !== sig) built = build()
    body.appendChild(built.root)
    built.list.scrollTop = scroll
  }

  return {
    render,
    // Opening fresh: start at the selected girl's area and give the page a sound.
    opened() {
      girlSfx.indexOpen()
      built = null
    },
    // Jump to (and select) a girl, e.g. right after she was caught.
    focus(id) {
      selected = id
      built = null
    },
  }
}
