// The Bloxity (Legion) SDK facade. Every SDK call goes through here. Nothing
// here may throw when the SDK is missing: a blocked sdk.bloxity.io leaves the
// game fully playable on the default avatar and keyboard controls.
// Docs: https://docs.bloxity.io/#html5
import { GAME_SLUG, GAME_TITLE, SETTINGS, DEV_MODE, PENS, LEADERBOARDS, coerceSetting } from './config.js'

export function sdk() {
  if (DEV_MODE) return null
  return (typeof window !== 'undefined' && window.Legion && window.Legion.SDK) || null
}

// --- State --------------------------------------------------------------
export const settings = {}
for (const key of Object.keys(SETTINGS)) settings[key] = coerceSetting(key, SETTINGS[key].def)

// `user` is only written from onUserChanged (re-reading getUser()). `ready`
// flips once auth has settled so the signed-in avatar load isn't pre-empted.
export const authState = { ready: false, user: null, guest: null }

let latestEquipped = null
let latestProportions = null
const avatarListeners = new Set()
const proportionListeners = new Set()
const authListeners = new Set()
const settingListeners = new Set()
const respawnListeners = new Set()
const emoteListeners = new Set()
const chatListeners = new Set()
const adListeners = new Set()
const unsubscribers = []

function emit(listeners, ...args) {
  for (const fn of listeners) {
    try {
      fn(...args)
    } catch (err) {
      console.warn('[bloxity] listener threw', err)
    }
  }
}

// Fires on any customizer change (may fire twice: optimistic, then confirmed;
// keep handlers idempotent). Each returns an unsubscribe.
export function onAvatarChanged(fn) {
  avatarListeners.add(fn)
  return () => avatarListeners.delete(fn)
}
export function onProportionsChanged(fn) {
  proportionListeners.add(fn)
  return () => proportionListeners.delete(fn)
}
export function subscribeAuth(fn) {
  authListeners.add(fn)
  fn(authState)
  return () => authListeners.delete(fn)
}
// fn(key, value) on every change of a SETTINGS key (already coerced).
export function onSetting(fn) {
  settingListeners.add(fn)
  return () => settingListeners.delete(fn)
}
// The portal's own pause-menu "Respawn" button.
export function onRespawnRequest(fn) {
  respawnListeners.add(fn)
  return () => respawnListeners.delete(fn)
}
// fn(emoteId) when the player picks an emote in the portal's picker ('' = stop).
export function onEmote(fn) {
  emoteListeners.add(fn)
  return () => emoteListeners.delete(fn)
}
// fn(message) for every chat message of the game: { userId, username, text, isGif, at, isLocalPlayer }.
export function onChat(fn) {
  chatListeners.add(fn)
  return () => chatListeners.delete(fn)
}
// fn(true) when an ad break starts (pause + mute), fn(false) when it ends.
export function onAdBreak(fn) {
  adListeners.add(fn)
  return () => adListeners.delete(fn)
}

// --- Auth ---------------------------------------------------------------
// The SDK fires onUserChanged immediately with a null user, then again once the
// portal handshake answers; a null user only settles auth after a grace period.
const GUEST_SETTLE_MS = 2500
let settleTimer = null

function settleAuth() {
  settleTimer = null
  if (authState.ready) return
  authState.ready = true
  emit(authListeners, authState)
}

function onUser() {
  const SDK = sdk()
  const user = SDK ? SDK.auth.getUser() : null
  latestEquipped = null // a different account's equip event must not linger
  latestProportions = null

  if (user || authState.ready) {
    if (settleTimer) clearTimeout(settleTimer)
    settleTimer = null
    authState.ready = true
  } else if (!settleTimer) {
    settleTimer = setTimeout(settleAuth, GUEST_SETTLE_MS)
  }
  authState.user = user
  try {
    authState.guest = user || typeof SDK.auth.getGuest !== 'function' ? null : SDK.auth.getGuest()
  } catch {
    authState.guest = null
  }
  emit(authListeners, authState)
}

// The player's Bloxity token: the game server verifies it with Bloxity and only then believes who the
// player is (it never trusts a user id the client sends). '' for guests / without the SDK.
export function getToken() {
  try {
    return sdk()?.auth?.getToken?.() || ''
  } catch {
    return ''
  }
}

// Name for the HUD badge.
export function displayName() {
  const u = authState.user
  if (u) return u.displayName || u.username || u.name || 'Player'
  const g = authState.guest
  if (g) return g.displayName || g.username || g.name || 'Guest'
  return sdk() ? 'Guest' : 'Offline'
}

// The player's Bloxity profile picture (user, else the guest's derived one) as an absolute
// http(s) URL, '' when there is none. Relative paths resolve against the CDN (staticUrl).
export function getPfp() {
  const raw = authState.user?.pfp || authState.guest?.pfp
  if (typeof raw !== 'string' || !raw) return ''
  try {
    let base = 'https://static.bloxity.io'
    try {
      base = sdk()?.environment?.()?.staticUrl || base
    } catch {
      // Older SDK builds have no environment().
    }
    const url = new URL(raw, base)
    return /^https?:$/.test(url.protocol) ? url.href : ''
  } catch {
    return ''
  }
}

// --- Init ---------------------------------------------------------------
let initialised = false

export function init() {
  if (initialised) return
  initialised = true

  const SDK = sdk()
  if (!SDK) {
    if (DEV_MODE) console.info('[bloxity] VITE_DEV_MODE=true: skipping SDK/CDN, running on the default avatar')
    else console.info('[bloxity] SDK not loaded: running offline on the default avatar')
    authState.ready = true
    emit(authListeners, authState)
    return
  }

  try {
    const onLocalhost = /^(localhost|127\.0\.0\.1)$/.test(window.location.hostname)
    SDK.init(onLocalhost ? { gameSlug: GAME_SLUG, portalUrl: 'https://bloxity.io' } : { gameSlug: GAME_SLUG })
    SDK.game.loadingStep(`Loading ${GAME_TITLE}`)

    for (const key of Object.keys(SETTINGS)) {
      const off = SDK.settings.listen(key, (raw) => {
        const next = coerceSetting(key, raw)
        if (settings[key] === next) return
        settings[key] = next
        emit(settingListeners, key, next)
      })
      if (typeof off === 'function') unsubscribers.push(off)
    }
    SDK.settings.triggerAll?.()

    unsubscribers.push(SDK.auth.onUserChanged(onUser))

    if (typeof SDK.avatar?.onAvatarChanged === 'function') {
      unsubscribers.push(
        SDK.avatar.onAvatarChanged((equipped) => {
          // The event payload wins over getEquipped(), which can lag the event.
          if (equipped && typeof equipped === 'object') latestEquipped = equipped
          emit(avatarListeners)
        }),
      )
    }
    if (typeof SDK.avatar?.onProportionsChanged === 'function') {
      unsubscribers.push(
        SDK.avatar.onProportionsChanged((proportions) => {
          if (proportions && typeof proportions === 'object') latestProportions = proportions
          emit(proportionListeners)
        }),
      )
    }

    unsubscribers.push(
      SDK.player.onEvent((event, data) => {
        if (event === 'respawn_request') emit(respawnListeners)
        else if (event === 'play_emote') emit(emoteListeners, typeof data === 'string' ? data : data?.emoteId || data?.id || '')
        else if (event === 'stop_emote') emit(emoteListeners, '')
      }),
    )

    // Capabilities (right after init, not after loading): the emote picker, friend joins, parties.
    try {
      SDK.game.registerFeature?.('emotes')
      SDK.game.registerFeature?.('play_with_friends')
      SDK.party?.enable?.({ maxPartySize: PENS.xs.length }) // a room holds one player per base
    } catch (err) {
      console.warn('[bloxity] feature registration failed', err)
    }

    // Chat bubbles: every message of the game's chat.
    try {
      const off = SDK.chat?.onMessage?.((m) => emit(chatListeners, m))
      if (typeof off === 'function') unsubscribers.push(off)
    } catch {
      // No chat in this SDK build.
    }

    // Ad breaks (required by Bloxity): pause and mute while one plays. The screens are declared but
    // all off; rewarded ads and gameplay banners are the developer's call.
    try {
      const a = SDK.ads
      if (a) {
        const off1 = a.onBreakStart?.(() => emit(adListeners, true))
        const off2 = a.onBreakEnd?.(() => emit(adListeners, false))
        for (const off of [off1, off2]) if (typeof off === 'function') unsubscribers.push(off)
        // Banner screens: no banners while the player plays (gameplay is declared off and never
        // reported); only 'panel' (a window is open) may show one. Rewarded ads are opt-in.
        a.declareScreens?.({ gameplay: { show: false }, panel: {} })
      }
    } catch (err) {
      console.warn('[bloxity] ads setup failed', err)
    }

    defineLeaderboards()
    SDK.game.loadingStep('Building the island')
  } catch (err) {
    console.warn('[bloxity] init failed; running without the SDK', err)
    authState.ready = true
    emit(authListeners, authState)
  }
}

export function loadingStep(text) {
  try {
    sdk()?.game.loadingStep(text)
  } catch {
    // Non-fatal.
  }
}

let announcedFirstFrame = false

// Call once the scene has rendered: tells the portal loading is done.
export function notifyFirstFrame() {
  if (announcedFirstFrame) return
  announcedFirstFrame = true
  const SDK = sdk()
  if (!SDK) return
  try {
    SDK.game.loadingEnd()
    SDK.game.gameplayStart()
  } catch {
    // Non-fatal.
  }
}

export function teardown() {
  for (const off of unsubscribers.splice(0)) {
    try {
      off()
    } catch {
      // Tearing down anyway.
    }
  }
  try {
    sdk()?.game.gameplayEnd()
  } catch {
    // Non-fatal.
  }
}

// --- Avatar accessors (null when the SDK is unavailable or the call throws) ---
export function getEquippedAvatar() {
  if (latestEquipped) return latestEquipped
  try {
    return sdk()?.avatar.getEquipped() ?? null
  } catch {
    return null
  }
}

// { height, shoulderWidth, armLength, legOffsetX, torsoScaleX, neckHeight,
// headScale }, normalised around 1.0; loader.js applyProportions() consumes it.
export function getProportions() {
  try {
    const current = sdk()?.avatar.getProportions()
    return latestProportions ? { ...current, ...latestProportions } : current ?? null
  } catch {
    return latestProportions
  }
}

// Skin texture URL with the worn face, shirt and pants already drawn on.
export function getSkinTextureUrl() {
  try {
    const url = sdk()?.avatar?.getSkinTextureUrl?.()
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

export const canCustomize = () => typeof sdk()?.avatar?.toggleCustomizer === 'function'

// Opens / closes the portal's avatar editor; edits come back through onAvatarChanged.
export function toggleCustomizer() {
  try {
    sdk()?.avatar.toggleCustomizer()
  } catch {
    // Ignore.
  }
}

// --- Game server ------------------------------------------------------
// Bloxity hosting has no fixed socket URL: the matchmaker picks a pod with room (or wakes one) and
// the SDK returns its endpoint (the dev channel reaches the dev backend, prod the prod one). Each
// endpoint is pinned to one pod, so net.js builds a new Client per resolve.
export function canResolveServer() {
  try {
    return typeof sdk()?.net?.resolveEndpoint === 'function'
  } catch {
    return false
  }
}
// { endpoint, relayRoomId }: relayRoomId is the matchmaker relay pinning the pod (the endpoint is
// {playUrl}/v1/ws/<relayRoomId>). Rejects (net.js retries with backoff) when the matchmaker can't answer.
export async function resolveServerEndpoint(userId) {
  const { endpoint, roomId, cold } = await sdk().net.resolveEndpoint(GAME_SLUG, userId ? { userId } : undefined)
  if (cold) console.info('[net] waking up a server...')
  return { endpoint, relayRoomId: roomId }
}

// The ?roomId= the page was opened with: the game page's Open Rooms Join button (a bare Colyseus
// room id) or a friend invite (what updateRoom() reported: "<relayRoomId>~<colyseusRoomId>").
export function launchRoomId() {
  try {
    return new URLSearchParams(location.search).get('roomId') || ''
  } catch {
    return ''
  }
}

// Where a launch room lives: { endpoint, roomId, relayRoomId }, or null when it is gone, full or
// can't be found. A bare id needs the matchmaker's cross-pod directory (a plain joinById through
// any relay would usually land on another pod); a relay~room id is joined through its relay.
export async function locateRoom(id) {
  const playUrl = (() => {
    try {
      return sdk()?.environment?.()?.playUrl
    } catch {
      return '' // Older SDK builds have no environment().
    }
  })()
  if (!playUrl || !id) return null
  const base = playUrl.replace(/\/$/, '')
  const [relay, roomId] = id.includes('~') ? id.split('~', 2) : ['', id]
  if (relay) return { endpoint: `${base.replace(/^http/i, 'ws')}/v1/ws/${encodeURIComponent(relay)}`, roomId, relayRoomId: relay }
  const res = await fetch(`${base}/v1/dir/${encodeURIComponent(GAME_SLUG)}/list`)
  const rooms = res.ok ? (await res.json())?.rooms ?? [] : []
  const r = rooms.find((r) => r.colyseusRoomId === roomId && !r.locked && r.players < r.maxPlayers)
  return r ? { endpoint: r.joinUrl, roomId: r.colyseusRoomId, relayRoomId: r.relayRoomId } : null
}

// Reports the room this player is in ('' = not in a joinable room), so the portal's friend invites
// land in it.
export function updateRoom(roomId) {
  try {
    sdk()?.game?.updateRoom?.(roomId)
  } catch {
    // Ignore.
  }
}

// --- Portal -----------------------------------------------------------
export function showMenu() {
  try {
    sdk()?.portal.showMenu(true)
  } catch {
    // Ignore.
  }
}

// Where Boxity draws its own controls over the game: the toolbar in the top-left corner and
// the chat feed under it, as [{ id, left, top, width, height }] in CSS px. fn runs now and on
// every change (resize, toolbar change). Without the SDK (dev mode, blocked CDN) it gets the
// default footprint the SDK itself assumes until the portal reports, so the HUD is laid out
// the same everywhere. Returns an unsubscribe.
export function onReservedAreas(fn) {
  try {
    const off = sdk()?.ui?.onReservedAreasChange?.((areas) => fn(Array.isArray(areas) ? areas : []))
    if (typeof off === 'function') return off
  } catch {
    // Fall back to the estimate below.
  }
  const update = () => fn(estimatedReservedAreas(window.innerWidth, window.innerHeight))
  window.addEventListener('resize', update)
  update()
  return () => window.removeEventListener('resize', update)
}

// The SDK's estimate (legion-sdk ui.estimatedAreas): an 8 px margin round one row of buttons,
// the whole width on narrow phones, and the chat feed under it.
function estimatedReservedAreas(w, h) {
  const compact = w < 640 || h <= 500
  const toolbarHeight = 16 + (w < 640 ? 32 : w < 768 ? 40 : 44)
  const chatWidth = compact ? Math.min(w * 0.7, 260) : Math.min(w * 0.8, 360)
  return [
    { id: 'toolbar', left: 0, top: 0, width: Math.min(w, w < 480 ? w : 330), height: toolbarHeight },
    { id: 'chat', left: 0, top: toolbarHeight, width: Math.round(chatWidth + 8), height: compact ? 140 : 180 },
  ]
}

export function requestFullscreen(on) {
  try {
    const SDK = sdk()
    if (!SDK) return
    if (on) SDK.portal.requestFullscreen()
    else SDK.portal.exitFullscreen()
  } catch {
    // Ignore.
  }
}

// --- Multiplayer helpers ------------------------------------------------------
// Tells the portal this party member landed in the room (parties must share one room).
export function partyJoined(roomId) {
  try {
    sdk()?.party?.joined?.(roomId)
  } catch {
    // Ignore.
  }
}

// Friend-join notifications (the portal shows "X joined" to their friends).
export function playerJoined(username) {
  try {
    sdk()?.game?.playerJoined?.(username)
  } catch {
    // Ignore.
  }
}
export function playerInRoom(username) {
  try {
    sdk()?.game?.playerInRoom?.(username)
  } catch {
    // Ignore.
  }
}

// A shareable link that opens the game in this room (the page reads ?roomId=, see launchRoomId).
export function inviteLink(roomId, ref = '') {
  try {
    const s = sdk()
    // `ref` is the inviter's account id: the page opens with ?ref= and the game server credits them.
    if (s) return s.social?.getInviteFriendsLink?.({ roomId, ref }) ?? ''
  } catch {
    return ''
  }
  // No SDK (local dev): a plain link to this page.
  const u = new URL(location.href)
  u.search = ''
  if (roomId) u.searchParams.set('roomId', roomId)
  if (ref) u.searchParams.set('ref', ref)
  return u.href
}

// The ?ref= the page was opened with: the account whose invite link this is ('' = none).
export function launchRef() {
  try {
    return (new URLSearchParams(location.search).get('ref') || '').slice(0, 128)
  } catch {
    return ''
  }
}

// Chat bubble text for a message (trimmed to two short lines; "sent a GIF" for GIFs).
export function chatText(m) {
  try {
    return sdk()?.chat?.bubbleText?.(m) ?? String(m?.text ?? '').slice(0, 60)
  } catch {
    return String(m?.text ?? '').slice(0, 60)
  }
}
export const chatSeconds = () => sdk()?.chat?.bubbleSeconds ?? 4

// The SDK's camera-facing bubble over `target` (an Object3D); THREE is passed in because the SDK
// does not bundle it. Returns { remove() } or null.
export function attachChatBubble(THREE, target, text) {
  try {
    return sdk()?.chat?.attachBubble?.(THREE, target, text) ?? null
  } catch {
    return null
  }
}

// Another player's skin texture (pants, shirt and face drawn on) from their replicated equipped ids.
export function skinTextureUrlFor(equipped) {
  try {
    const url = sdk()?.avatar?.getSkinTextureUrlFor?.(equipped)
    return typeof url === 'string' && url ? url : null
  } catch {
    return null
  }
}

// The emote catalogue (GET {apiUrl}/v1/avatar/emotes): clips keyed by id, each { len, loop, tracks }
// with tracks[bone] = [[timeSec, xDeg, yDeg, zDeg], ...]. null when unreachable.
let emoteCatalogue = null
export async function loadEmotes() {
  if (emoteCatalogue) return emoteCatalogue
  try {
    const apiUrl = sdk()?.environment?.()?.apiUrl
    if (!apiUrl) return null
    const res = await fetch(`${apiUrl.replace(/\/$/, '')}/v1/avatar/emotes`)
    if (!res.ok) return null
    const json = await res.json()
    const list = Array.isArray(json) ? json : json?.emotes ?? json?.items ?? []
    emoteCatalogue = new Map()
    for (const e of list) {
      const id = String(e?._id ?? e?.id ?? '')
      if (id && e.tracks) emoteCatalogue.set(id, e)
    }
    return emoteCatalogue
  } catch {
    return null
  }
}

// --- Leaderboards -------------------------------------------------------------
// LEADERBOARDS in config.js (max 10, declared once): submit() when a stat improves, top() for the
// plaza boards. Both degrade to nothing without the SDK / outside Bloxity.
function defineLeaderboards() {
  try {
    sdk()?.leaderboard?.define?.(LEADERBOARDS.map(({ id, label, order, mode, format, reset }) => ({ id, label, order, mode, format, reset })))
  } catch (err) {
    console.warn('[bloxity] leaderboard.define failed', err)
  }
}
export function submitScore(id, score) {
  try {
    if (Number.isFinite(score) && score > 0) void Promise.resolve(sdk()?.leaderboard?.submit?.(id, score)).catch(() => {})
  } catch {
    // Ignore.
  }
}
// [{ name, score, me }] (best first) or null when the board cannot be read.
export async function topScores(id, limit = 10) {
  try {
    const top = await sdk()?.leaderboard?.getTop?.(id, { period: 'current', limit })
    const rows = top?.rows
    if (!Array.isArray(rows) || !rows.length) return null
    return rows.map((r) => ({
      name: String(r.username ?? r.displayName ?? r.name ?? r.user?.username ?? 'Player'),
      score: Number(r.score ?? r.value ?? 0),
      me: !!(r.isMe ?? r.me ?? r.isLocalPlayer),
    }))
  } catch {
    return null
  }
}

// Ids of the player's Bloxity friends (for the friend income boost: friends in the same room).
export async function getFriendIds() {
  try {
    const list = await sdk()?.social?.getFriends?.()
    const ids = new Set()
    for (const f of Array.isArray(list) ? list : []) {
      const id = f?._id ?? f?.id ?? f?.userId ?? f?.user?._id
      if (id) ids.add(String(id))
    }
    return ids
  } catch {
    return new Set()
  }
}

// --- Ads ----------------------------------------------------------------------
// Rewarded ads: true only when embedded in a Bloxity portal that serves ads.
export function adsAvailable() {
  try {
    return !!sdk()?.ads?.isAvailable?.()
  } catch {
    return false
  }
}
// Plays a rewarded ad for the placement; resolves { status, rewardToken?, reason? } and never rejects.
// Grant only on status 'completed' (and verify the token on the server first).
export async function showRewarded(placement) {
  try {
    const r = await sdk()?.ads?.showRewarded?.(placement)
    return r && typeof r === 'object' ? r : { status: 'disabled' }
  } catch {
    return { status: 'error' }
  }
}
export function apiUrl() {
  try {
    return sdk()?.environment?.()?.apiUrl || ''
  } catch {
    return ''
  }
}

// Banner screens. The portal draws banners along the edges of the screen of the type last reported
// (only one at a time; a new call replaces the previous one): 'panel' while a window is open, null =
// none (all the time the player is playing, cutscenes, ad breaks). There is no 'gameplay' screen on
// purpose: no ads while playing. (Platform midrolls are Bloxity's; the game only pauses for them.)
const KEEP_FREE = ['top-left', 'top-center', 'middle-left', 'middle-right', 'bottom-left', 'bottom-center']
const SCREEN_OPTIONS = {
  panel: { skip: KEEP_FREE, sizes: { 'top-right': '320x50', 'bottom-right': '320x50' } },
}
let screenType = null
export function setAdScreen(type) {
  if (type === screenType) return
  screenType = type
  try {
    const ads = sdk()?.ads
    if (!ads) return
    if (type) ads.screen?.(type, SCREEN_OPTIONS[type])
    else ads.hideScreen?.()
  } catch {
    // Ignore.
  }
}
