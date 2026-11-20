// The Hungry Giant (EVENTS.boss; schedule in game/events.js): for a few minutes twice an hour a
// giant season girl stands at the far end of the lane with a hunger bar over her head. Every throw
// anyone in the room makes feeds her; the room server counts them (backend boss.ts: `boss` state,
// `bossWin` { key, throws: { sessionId: n } } once she is full) so the whole room shares one bar.
// Offline the client counts its own throws against a one-player bar. Everyone who threw gets
// cash (more for more throws, capped) and Event Tickets: earned rewards only, no premium currency.
import { Vector3 } from 'three'
import { EVENTS, HUB } from '../config.js'
import { dynLabel } from '../hub/dynlabel.js'
import { Baddie } from './baddieModel.js'
import * as events from './events.js'
import * as state from './state.js'
import * as net from '../net.js'

const B = EVENTS.boss
const SCALE = 12 // x a normal girl: she towers over the lane end

export function createBoss(scene, { fx, sfx, hud, celebrate }) {
  const L = HUB.lane
  const at = new Vector3(0, L.floorY, L.end + 16)
  let model = null
  let modelSeason = ''
  const bar = dynLabel(9, { lines: 2, width: 900 })
  bar.sprite.visible = false
  scene.add(bar.sprite)

  // { key, on, fill, need, mine, won, endsAt } for the current visit (server or local).
  let cur = { key: 0, on: false, fill: 0, need: B.needPerPlayer, mine: 0, won: false, endsAt: 0 }
  let serverKey = 0 // the visit the server last told us about (0 = none / offline)

  net.onEvent('boss', (m) => {
    if (!m) return
    serverKey = m.key | 0
    const mine = cur.key === m.key ? cur.mine : 0
    cur = { key: m.key, on: !!m.on, fill: m.fill | 0, need: Math.max(1, m.need | 0), mine, won: !!m.won, endsAt: m.endsAt }
  })
  net.onEvent('bossWin', (m) => {
    const n = m?.throws?.[net.net.sessionId] | 0
    if (m?.key === cur.key) cur.won = true
    if (n > 0) pay(n)
  })

  function pay(n) {
    const secs = Math.min(B.maxSecs, B.rewardSecs + B.perThrowSecs * n)
    const cash = Math.max(500, Math.round(state.income() * secs))
    state.addMoney(cash, 'boss')
    state.addTickets(B.tickets)
    sfx.upgrade()
    celebrate?.()
    hud.toast(`\u{1F479} The Giant is full! You fed her ${n}x: +$${cash.toLocaleString()} and ${B.tickets} tickets!`, 'rare')
    if (model) {
      model.mode = 'cheer'
      model.hop()
      fx.confetti(at.clone().setY(L.floorY + 12), 160, 10)
      fx.beam(at, '#ffd23a', { radius: 6, height: 40, life: 2 })
    }
  }

  // Your throw (main.js calls this from the thrower's onThrow).
  function noteThrow() {
    const w = events.bossWindow()
    if (!w.on) return
    if (cur.key !== w.key) cur = { key: w.key, on: true, fill: 0, need: B.needPerPlayer, mine: 0, won: false, endsAt: w.endsAt }
    cur.mine++
    // Offline (or before the server's first word): count it here.
    if (!net.net.online || serverKey !== w.key) {
      if (cur.won) return
      cur.fill++
      if (cur.fill >= cur.need) {
        cur.won = true
        pay(cur.mine)
      }
    }
  }

  function ensureModel() {
    const s = events.season()
    const girl = s.girls[s.girls.length - 1]
    if (model && modelSeason === s.season.id) return
    model?.dispose()
    model = new Baddie(girl.id, 0, { showLabel: false })
    modelSeason = s.season.id
    model.group.scale.setScalar(SCALE)
    model.group.position.copy(at)
    model.group.rotation.y = 0 // facing the hub (+z)
    scene.add(model.group)
  }

  let wasOn = false
  return {
    noteThrow,
    status() {
      const w = events.bossWindow()
      if (!w.on) return { on: false, fill: 0, need: 0, mine: 0, won: false, nextAt: w.nextAt }
      return { ...cur, on: true, endsAt: w.endsAt, key: w.key }
    },
    update(dt) {
      const w = events.bossWindow()
      if (w.on && cur.key !== w.key && (!net.net.online || serverKey !== w.key)) cur = { key: w.key, on: true, fill: 0, need: B.needPerPlayer, mine: 0, won: false, endsAt: w.endsAt }
      if (w.on !== wasOn) {
        wasOn = w.on
        if (w.on) {
          ensureModel()
          model.group.visible = true
          sfx.zoneCross?.(11)
          fx.ring(at.clone().setY(L.floorY + 0.2), '#ff4f5e', { r0: 2, r1: 30, life: 1.2 })
        } else if (model) model.group.visible = false
      }
      bar.sprite.visible = w.on
      if (!w.on || !model) return
      model.update(dt)
      if (model.mode !== 'cheer' || !cur.won) model.mode = cur.won ? 'dance' : 'idle'
      bar.sprite.position.set(at.x, L.floorY + model.height * SCALE + 10, at.z)
      const pct = Math.min(1, cur.fill / Math.max(1, cur.need))
      const blocks = Math.round(pct * 10)
      bar.set([
        { text: cur.won ? '\u{1F479} SHE IS FULL!' : '\u{1F479} HUNGRY GIANT', color: cur.won ? '#7dff4a' : '#ff6a7a' },
        { text: `${'█'.repeat(blocks)}${'░'.repeat(10 - blocks)} ${cur.fill}/${cur.need}`, color: '#ffd23a', scale: 0.8 },
      ])
    },
  }
}
