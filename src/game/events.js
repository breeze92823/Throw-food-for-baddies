// Live events on the UTC clock (EVENTS / SEASON / SEASONS in config): every player computes the same
// ones from the time alone, so no server is needed (the Hungry Giant's feeding is counted by the
// room server, see game/boss.js). Everything here is pure: pass `now` (epoch ms) to test.
import { AREAS, EVENTS, SEASON, SEASONS, SEASON_GIRLS } from '../config.js'

const MIN = 60000
const HOUR = 60 * MIN
const DAY = 24 * HOUR

// Luck hour: the first EVENTS.luckHour.length minutes of every hour. { on, endsAt, nextAt }
export function luckHour(now = Date.now()) {
  const E = EVENTS.luckHour
  const start = Math.floor(now / (E.every * MIN)) * E.every * MIN
  const endsAt = start + E.length * MIN
  return { on: now < endsAt, endsAt, nextAt: start + E.every * MIN }
}

// Weekend boost: Saturday and Sunday, UTC. { on, endsAt }
export function weekend(now = Date.now()) {
  const d = new Date(now)
  const dow = d.getUTCDay() // 0 Sunday .. 6 Saturday
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  if (dow === 6) return { on: true, endsAt: midnight + 2 * DAY }
  if (dow === 0) return { on: true, endsAt: midnight + DAY }
  return { on: false, endsAt: 0, nextAt: midnight + (6 - dow) * DAY }
}

// Featured area: a different one every EVENTS.featured.every minutes (a fixed shuffle, so it
// visits every area). { area, endsAt }
export function featured(now = Date.now()) {
  const E = EVENTS.featured
  const slot = Math.floor(now / (E.every * MIN))
  const n = AREAS.length
  const area = (slot * 7 + 3) % n // 7 is coprime with 12: every area comes round
  return { area, endsAt: (slot + 1) * E.every * MIN }
}

// The Hungry Giant's schedule: { on, startsAt, endsAt, nextAt, key } (key names this visit).
export function bossWindow(now = Date.now()) {
  const E = EVENTS.boss
  const hour = Math.floor(now / HOUR) * HOUR
  for (const h of [hour - HOUR, hour, hour + HOUR]) {
    for (const m of E.at) {
      const startsAt = h + m * MIN
      const endsAt = startsAt + E.length * MIN
      if (now >= startsAt && now < endsAt) return { on: true, startsAt, endsAt, key: startsAt }
    }
  }
  let nextAt = Infinity
  for (const h of [hour, hour + HOUR]) for (const m of E.at) if (h + m * MIN > now) nextAt = Math.min(nextAt, h + m * MIN)
  return { on: false, nextAt }
}

// The running season: { season, endsAt, girls } (always one: they take turns).
export function season(now = Date.now()) {
  const len = SEASON.days * DAY
  const i = Math.floor((now - SEASON.anchor) / len)
  const s = SEASONS[((i % SEASONS.length) + SEASONS.length) % SEASONS.length]
  return { season: s, endsAt: SEASON.anchor + (i + 1) * len, girls: SEASON_GIRLS.filter((g) => g.season === s.id) }
}

// Multipliers the economy applies right now.
export const luckMult = (now = Date.now()) => (luckHour(now).on ? EVENTS.luckHour.luck : 1)
export const incomeMult = (now = Date.now()) => (weekend(now).on ? EVENTS.weekend.income : 1)
export const isFeatured = (area, now = Date.now()) => featured(now).area === area

// Everything running now, for the HUD pills and the Events window:
// [{ id, icon, name, text, endsAt, color }]
export function active(now = Date.now()) {
  const out = []
  const lh = luckHour(now)
  if (lh.on) out.push({ id: 'luckHour', icon: '\u{1F340}', name: 'Luck Hour', text: `${EVENTS.luckHour.luck}x luck`, endsAt: lh.endsAt, color: '#3fd23a' })
  const wk = weekend(now)
  if (wk.on) out.push({ id: 'weekend', icon: '\u{1F4B0}', name: 'Weekend Boost', text: `${EVENTS.weekend.income}x income`, endsAt: wk.endsAt, color: '#ffc21f' })
  const b = bossWindow(now)
  if (b.on) out.push({ id: 'boss', icon: '\u{1F479}', name: 'Hungry Giant', text: 'Throw to feed her!', endsAt: b.endsAt, color: '#ff4f5e' })
  const f = featured(now)
  out.push({ id: 'featured', icon: '\u{2B50}', name: `Featured: ${AREAS[f.area].name}`, text: `${EVENTS.featured.variant}x shiny odds`, endsAt: f.endsAt, color: '#7ae8ff', area: f.area })
  const s = season(now)
  out.push({ id: 'season', icon: s.season.icon, name: s.season.name, text: 'Season girls + tickets', endsAt: s.endsAt, color: s.season.color })
  return out
}
