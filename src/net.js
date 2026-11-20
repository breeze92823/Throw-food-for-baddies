// The game-server layer (Colyseus). One shared room per BASE_COUNT players; the server assigns
// every player one of the hub's bases (`PENS`) and the client builds the hub around it
// (main.js: `myPen`, the spawn). Everything here degrades to offline play: with no server
// reachable `connect()` resolves null and the game keeps the middle pen and the stand-in
// neighbours (`NEIGHBOURS`), like before.
//
// Hosting rules (https://hosting.bloxity.io/docs): players must go through the matchmaker
// (`Legion.SDK.net.resolveEndpoint`, wrapped by bloxity.js), never straight to the backend host;
// every resolve returns an endpoint pinned to one pod, so each join makes a NEW Client; a failed
// resolve is retried with backoff (a cold start takes up to ~45 s); an unexpectedly closed room is
// resolved and joined again.
import { Client } from '@colyseus/sdk'
import { NET, PENS } from './config.js'
import * as bloxity from './bloxity.js'

// Live connection state. `base` is this player's assigned pen index (-1 = offline).
export const net = { room: null, online: false, base: -1, bases: 0, status: 'offline', roomKey: '' }

const rosterListeners = new Set()
const statusListeners = new Set()
const rebaseListeners = new Set()
let identity = { userId: '', username: '', pfp: '' }
let rosterSig = ''
let lastRoster = null
let closing = false

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
function emit(listeners, ...args) {
  for (const fn of listeners) {
    try {
      fn(...args)
    } catch (err) {
      console.warn('[net] listener threw', err)
    }
  }
}

// fn(players) with [{ id, base, name, pfp, me }] whenever the roster (who sits on which base) changes.
export function onRoster(fn) {
  rosterListeners.add(fn)
  if (lastRoster) fn(lastRoster) // the roster that arrived before this listener existed
  return () => rosterListeners.delete(fn)
}
// fn('online' | 'reconnecting' | 'offline').
export function onStatus(fn) {
  statusListeners.add(fn)
  return () => statusListeners.delete(fn)
}
// fn(newBase): after a lost connection the server gave this player a different base than before;
// the hub is built around the old one, so main.js reloads.
export function onRebase(fn) {
  rebaseListeners.add(fn)
  return () => rebaseListeners.delete(fn)
}

function setStatus(status) {
  if (net.status === status) return
  net.status = status
  net.online = status === 'online'
  emit(statusListeners, status)
}

// A fresh, per-page id for players who are not signed in to Bloxity (the server never saves guests).
let guestId = ''
function newGuestId() {
  guestId ||= `guest-${Math.random().toString(36).slice(2, 12)}`
  return guestId
}

// Who this player is, as the server wants it (join options and `identify`).
export function currentIdentity() {
  const { user, guest } = bloxity.authState
  const name = bloxity.displayName()
  return {
    userId: String(user?.id ?? user?.userId ?? user?.uid ?? guest?.id ?? newGuestId()),
    username: name === 'Offline' ? 'Player' : name,
    pfp: bloxity.getPfp(),
    token: bloxity.getToken(), // the server verifies this with Bloxity to learn the real account
    ref: bloxity.launchRef(), // the inviter, when the page was opened from a friend's invite link
  }
}

export function canConnect() {
  return bloxity.canResolveServer() || !!NET.serverUrl
}

// Extra join options (pose, look, pen...), asked fresh on every (re)join: main.js sets it.
let extras = () => ({})
export function setJoinExtras(fn) {
  extras = fn
}

// The matchmaker relay that pinned the current pod ("" locally): friend invites carry
// "<relayRoomId>~<roomId>" (bloxity.js updateRoom / locateRoom).
let relayId = ''

async function resolveEndpoint(userId) {
  if (bloxity.canResolveServer()) {
    const r = await bloxity.resolveServerEndpoint(userId)
    relayId = r.relayRoomId || ''
    return r.endpoint
  }
  relayId = ''
  return NET.serverUrl
}

// A friend invite / Open Rooms "Join" opens the game with ?roomId=: try that room once, and fall
// back to normal matchmaking when it is gone, full or can't be found.
let launchTried = false
async function joinLaunchRoom(options) {
  const id = bloxity.launchRoomId()
  if (launchTried || !id) return null
  launchTried = true
  try {
    const where = await bloxity.locateRoom(id)
    if (!where) return null
    relayId = where.relayRoomId || ''
    return hookGame(await new Client(where.endpoint).joinById(where.roomId, options))
  } catch (err) {
    console.warn('[net] launch room unavailable, matchmaking instead', err)
    return null
  }
}

async function joinOnce(preferredBase) {
  const options = { ...identity, ...extras() }
  if (preferredBase >= 0) options.base = preferredBase
  const launch = preferredBase < 0 ? await joinLaunchRoom(options) : null
  if (launch) return launch
  const endpoint = await resolveEndpoint(identity.userId)
  const client = new Client(endpoint) // a new Client for every resolve: endpoints are pinned to one pod
  return hookGame(await client.joinOrCreate(NET.room, options))
}

// The plaza boards: the server sends { boards: { bestOdds|catches|income: [{ name, value }] }, ranks }
// after the load and every minute. fn runs now with the latest one if it already arrived.
const boardListeners = new Set()
let lastBoards = null
export function onLeaderboard(fn) {
  boardListeners.add(fn)
  if (lastBoards) fn(lastBoards)
  return () => boardListeners.delete(fn)
}

// A friend joined from your invite link while you are online: fn(totalInvites).
const inviteListeners = new Set()
export function onInvites(fn) {
  inviteListeners.add(fn)
  return () => inviteListeners.delete(fn)
}
// This player's account id as the server verified it (the roster carries it): what invite links use as `ref`.
export const myUid = () => net.room?.state?.players?.get?.(net.room.sessionId)?.uid || ''

// --- The save (backend game.ts) ---------------------------------------------------------
// The server answers a join with a `game` message (the stored progress, or null for a new player /
// guest) once it has read the database, or `serverError` when it could not: then saving stays off
// so a save that could not be read is never overwritten. Handlers are registered in the same
// microtask as the join resolving, so the answer cannot be missed.
let gameAnswer = null // Promise<{ ok, game }> of the current room
let saveEnabled = false
let booted = false
let awaitingIdentify = false
const lateGameListeners = new Set()
function hookGame(room) {
  gameAnswer = new Promise((resolve) => {
    room.onMessage('game', (m) => {
      const answer = { ok: true, game: m?.game ?? null, invites: Number(m?.invites) || 0 }
      if (!booted) resolve(answer)
      else if (awaitingIdentify) {
        awaitingIdentify = false // the answer to our `identify`: a mid-session sign-in loaded another account
        emit(lateGameListeners, answer)
      } // else: a rejoin after a drop re-sends the same save, which we already hold
    })
    room.onMessage('serverError', () => {
      saveEnabled = false
      resolve({ ok: false, game: null })
    })
  })
  return room
}

// The stored progress ({ ok, game }): waits for the server's answer. ok = false means it could
// not be read (or never came): the session then runs without saving. Call once, at boot.
export async function loadGame(timeoutMs = NET.gameLoadMs) {
  const timeout = new Promise((r) => setTimeout(() => r({ ok: false, game: null }), timeoutMs))
  const answer = await Promise.race([gameAnswer ?? Promise.resolve({ ok: false, game: null }), timeout])
  saveEnabled = answer.ok
  booted = true
  return answer
}
// fn({ ok, game }) for a `game` answer after boot (the player signed in during the session).
export function onLateGame(fn) {
  lateGameListeners.add(fn)
  return () => lateGameListeners.delete(fn)
}
export function enableSaving(on = true) {
  saveEnabled = on
}
// Stores the whole progress on the server (debounced by state.js).
export function saveGame(S) {
  if (saveEnabled) send('saveGame', S)
}
export const canSave = () => saveEnabled && net.online

// Everything the portal needs to know once we are in a room: where friends can join us (invites,
// Open Rooms) and that this party member landed.
function reportRoom(room) {
  net.roomKey = relayId ? `${relayId}~${room.roomId}` : room.roomId
  bloxity.updateRoom(net.roomKey)
  bloxity.partyJoined(room.roomId)
}

// Typed server events: 'throwFx' { sid, food, from, to, dur, peak, power, lucky } and 'emoteFx'
// { sid, id } relayed from the other players; 'spins' / 'spinResult' (spin wheel), 'daily' /
// 'dailyResult' (Daily Reward), 'boss' / 'bossWin' (the Hungry Giant). The STICKY ones are kept
// and replayed to a listener that subscribes after they arrived (they come right after the load).
const eventListeners = new Map()
const STICKY = new Set(['spins', 'daily', 'boss'])
const lastEvent = new Map()
export function onEvent(type, fn) {
  if (!eventListeners.has(type)) eventListeners.set(type, new Set())
  eventListeners.get(type).add(fn)
  if (lastEvent.has(type)) fn(lastEvent.get(type))
  return () => eventListeners.get(type)?.delete(fn)
}
const SERVER_EVENTS = ['throwFx', 'emoteFx', 'spins', 'spinResult', 'daily', 'dailyResult', 'boss', 'bossWin']

// Rewarded ads: asks the server to verify the ad's reward token with Bloxity. Resolves { ok, reason }
// (ok = true: grant the reward). Offline there is nothing to verify against: { ok: null }.
const adWaiters = new Map()
export function verifyAd(placement, rewardToken) {
  return new Promise((resolve) => {
    if (!net.online) return resolve({ ok: null })
    const timer = setTimeout(() => {
      adWaiters.delete(placement)
      resolve({ ok: false, reason: 'timeout' })
    }, 15000)
    adWaiters.set(placement, (m) => {
      clearTimeout(timer)
      resolve({ ok: !!m?.ok, reason: m?.reason })
    })
    send('adReward', { placement, rewardToken, apiUrl: bloxity.apiUrl() })
  })
}

// Sends a message to the server; silently drops it when offline.
export function send(type, msg) {
  try {
    if (net.online) net.room?.send(type, msg)
  } catch {
    // Connection closing.
  }
}

// Joins with retries until `timeoutMs` has passed. Resolves the room or null.
async function joinWithRetry(preferredBase, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let delay = NET.retryMs
  for (;;) {
    try {
      return await joinOnce(preferredBase)
    } catch (err) {
      console.warn('[net] join failed', err)
      if (closing || Date.now() + delay >= deadline) return null
      await sleep(delay)
      delay = Math.min(delay * 2, NET.retryMaxMs)
    }
  }
}

function readRoster(room) {
  const list = []
  const players = room.state?.players
  if (players?.forEach) {
    // `p` is the live schema object: every other player's drawn state (pose, look, pen, held items).
    players.forEach((p, id) => list.push({ id, p, base: p.base, name: p.username || '', pfp: p.pfp || '', me: id === room.sessionId }))
  }
  return list
}

function publishRoster(room) {
  const list = readRoster(room)
  const sig = list.map((p) => `${p.id}:${p.base}:${p.name}:${p.pfp}`).join('|')
  if (sig === rosterSig) return
  rosterSig = sig
  lastRoster = list
  emit(rosterListeners, list)
}

// The base the server assigned this session: from the roster (state) or the `welcome` message,
// whichever arrives first.
function waitForBase(room) {
  return new Promise((resolve) => {
    let done = false
    const finish = (base, bases) => {
      if (done) return
      done = true
      clearTimeout(timer)
      resolve({ base, bases })
    }
    const timer = setTimeout(() => finish(-1, 0), NET.baseWaitMs)
    room.onMessage('welcome', (m) => {
      if (Number.isInteger(m?.base) && m.base >= 0) finish(m.base, m.bases | 0)
    })
    const check = () => {
      const base = room.state?.players?.get?.(room.sessionId)?.base
      if (Number.isInteger(base) && base >= 0) finish(base, PENS.xs.length)
    }
    room.onStateChange(check)
    check()
  })
}

// Wires up a joined room: roster feed, drop / leave handling.
function attach(room) {
  net.room = room
  net.sessionId = room.sessionId
  setStatus('online')
  rosterSig = ''
  lastRoster = null
  reportRoom(room)
  room.onMessage('adResult', (m) => {
    const done = adWaiters.get(m?.placement)
    adWaiters.delete(m?.placement)
    done?.(m)
  })
  for (const type of SERVER_EVENTS) {
    room.onMessage(type, (m) => {
      if (STICKY.has(type)) lastEvent.set(type, m)
      emit(eventListeners.get(type) ?? [], m)
    })
  }
  // Server messages this client does not use yet: swallow them without the SDK's console warning.
  room.onMessage('invites', (m) => emit(inviteListeners, Number(m?.invites) || 0))
  room.onMessage('leaderboard', (m) => {
    lastBoards = m
    emit(boardListeners, m)
  })
  for (const type of ['noProgress', 'progress']) room.onMessage(type, () => {})
  room.onStateChange(() => publishRoster(room))
  publishRoster(room)
  room.onDrop?.(() => setStatus('reconnecting')) // the SDK reconnects with the same seat by itself
  room.onReconnect?.(() => setStatus('online'))
  room.onError?.((code, message) => console.warn('[net] room error', code, message))
  room.onLeave(() => {
    if (net.room !== room) return
    net.room = null
    if (closing) return
    setStatus('reconnecting')
    void rejoin()
  })
}

// The room closed under us: resolve again and join, asking for the same base back. A different
// base means the hub has to be rebuilt (main.js reloads).
async function rejoin() {
  const previous = net.base
  const room = await joinWithRetry(previous, NET.rejoinTimeoutMs)
  if (!room) return setStatus('offline')
  const { base } = await waitForBase(room)
  if (base < 0) {
    room.leave()
    return setStatus('offline')
  }
  attach(room)
  if (base !== previous) {
    net.base = base
    emit(rebaseListeners, base)
  }
}

// Joins the shared room and resolves { base, bases } (this player's assigned base), or null when
// there is no server to reach or none answered in time (the game then plays offline).
export async function connect(who = currentIdentity()) {
  if (!canConnect()) return null
  identity = who
  const room = await joinWithRetry(-1, bloxity.canResolveServer() ? NET.joinTimeoutMs : NET.localJoinTimeoutMs)
  if (!room) return null
  const { base, bases } = await waitForBase(room)
  if (base < 0) {
    room.leave()
    return null
  }
  net.base = base
  net.bases = bases || PENS.xs.length
  attach(room)
  return { base, bases: net.bases }
}

// A player who signed in or out mid-session: tell the server so the roster shows the new name.
export function identify(who = currentIdentity()) {
  if (who.userId !== identity.userId) awaitingIdentify = true
  identity = who
  try {
    net.room?.send('identify', who)
  } catch {
    // Not connected.
  }
}

export function disconnect() {
  closing = true
  try {
    net.room?.leave(true)
  } catch {
    // Already gone.
  }
  net.room = null
  bloxity.updateRoom('') // not in a joinable room any more
  setStatus('offline')
}
