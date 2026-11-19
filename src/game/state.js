// The player's progress and the economy rules: money, strength, owned foods and
// upgrades, the baddies in the pen, the Training Bench, the chest timer, quests and
// stats. Saved to localStorage (debounced) and loaded at boot, with offline
// income credited on return. Other modules listen with on(event, fn).
import { AREAS, BADDIES, ECONOMY, FOODS, FUSE, INDEX_BONUS, LEGACY_IDS, QUESTS, SIZES, STARTER_FOOD, THROW, TRAINING, UPGRADES, repXp } from '../config.js'
import { BY_ID } from './baddieModel.js'

const listeners = new Map()
export function on(event, fn) {
  if (!listeners.has(event)) listeners.set(event, new Set())
  listeners.get(event).add(fn)
  return () => listeners.get(event).delete(fn)
}
function emit(event, ...args) {
  for (const fn of listeners.get(event) ?? []) {
    try {
      fn(...args)
    } catch (e) {
      console.warn('[state]', event, e)
    }
  }
}

let nextUid = 1
function fresh() {
  return {
    money: ECONOMY.startMoney,
    strength: ECONOMY.startStrength,
    capacityLevel: 0,
    foods: [STARTER_FOOD],
    food: STARTER_FOOD,
    foodsV: 2, // food list version (v1 saves had the old 8-food list; see load())
    upgrades: Object.fromEntries(UPGRADES.map((u) => [u.id, 0])),
    baddies: [], // { uid, id, size }
    hotbar: [], // caught, not placed yet: { id, size }
    discovered: {},
    quests: {},
    train: { level: 1, xp: 0, reps: 0, bench: 0 }, // the Training Place (pull-up bar); bench = tier in TRAINING.benches
    chestAt: Date.now() + 60 * 1000, // the first chest opens a minute in
    stats: { throws: 0, catches: 0, fused: 0, bestOdds: 0, earned: 0 },
    seen: [], // Index entries looked at (clears the NEW tags)
    adBoostUntil: 0, // epoch ms the rewarded-ad income boost ends
    luckyCredits: 0, // free Lucky Throws from rewarded ads
    lastSeen: Date.now(),
  }
}

export const S = fresh()

// --- Derived values ----------------------------------------------------------------------
export const capacity = () => Math.min(ECONOMY.maxCapacity, ECONOMY.startCapacity + S.capacityLevel * ECONOMY.capacityStep)
export const capacityCost = () => ECONOMY.capacityCost(S.capacityLevel)
export const capacityMaxed = () => capacity() >= ECONOMY.maxCapacity
// Friends of the player (Bloxity friends) who are in the same room: each adds ECONOMY.friendBoost.
const PENS_MAX_FRIENDS = 4 // a room has at most 5 players
let friendCount = 0
export const friends = () => friendCount
// Friends who joined the game from this player's invite link (the server counts them, once each).
let inviteCount = 0
export const invites = () => inviteCount
export function setInvites(n) {
  inviteCount = Math.max(0, Math.min(1e6, n | 0))
}
export const inviteBoostPct = () => Math.min(ECONOMY.inviteMax, inviteCount) * ECONOMY.inviteBoost
export function setFriends(n) {
  friendCount = Math.max(0, Math.min(PENS_MAX_FRIENDS, n | 0))
}
// Index: how many of an area's girls you have discovered, and the areas you have completed.
export const areaGirls = (a) => BADDIES.filter((b) => b.area === a)
export const areaFound = (a) => areaGirls(a).filter((b) => S.discovered[b.id]).length
export const areasComplete = () => AREAS.reduce((n, _, a) => n + (areaFound(a) === AREAS[a].girls.length ? 1 : 0), 0)
export const indexMult = () => 1 + INDEX_BONUS * areasComplete()
export const adBoostLeft = () => Math.max(0, (S.adBoostUntil - Date.now()) / 1000) // s of the rewarded-ad income boost left
export const incomeMult = () => (1 + 0.25 * S.upgrades.cash) * (1 + ECONOMY.friendBoost * friends() + inviteBoostPct()) * indexMult() * (adBoostLeft() > 0 ? ECONOMY.adBoostMult : 1)
export const baddieIncome = (b) => BY_ID[b.id].income * SIZES[b.size].mult
export const rawIncome = () => S.baddies.reduce((s, b) => s + baddieIncome(b), 0)
export const income = () => rawIncome() * incomeMult()
export const food = () => FOODS.find((f) => f.id === S.food) ?? FOODS.find((f) => f.id === STARTER_FOOD)
export const totalStrength = () => S.strength
// Throwing Strength as a range bonus (0.5 = +50%), capped at THROW.strengthCap.
export const strengthBonus = () => Math.min(THROW.strengthCap, totalStrength() * THROW.strengthPct)
export const range = () => Math.min(THROW.maxRange, food().dist * (1 + strengthBonus()))
// Iron Arms: +xpPerLevel training XP per level.
export const trainXpMult = () => 1 + (UPGRADES.find((u) => u.id === 'arms')?.xpPerLevel ?? 0) * (S.upgrades.arms ?? 0)
export const luck = () => food().luck * (1 + 0.2 * S.upgrades.luck)
export const walkMult = () => 1 + 0.1 * S.upgrades.speed
export const sellPrice = (b) => Math.max(1, Math.round(baddieIncome(b) * ECONOMY.sellSeconds))
export const nextFood = () => FOODS.filter((f) => !f.special).find((f) => !S.foods.includes(f.id)) ?? null
export const chestReady = () => Date.now() >= S.chestAt
export const chestReward = () => Math.max(ECONOMY.chestMin, Math.round(income() * ECONOMY.chestSeconds))

// --- Money --------------------------------------------------------------------------------
export function addMoney(n, source = '') {
  if (!(n > 0)) return
  S.money += n
  S.stats.earned += n
  emit('money', S.money, n, source)
  dirty()
}
export function spend(n) {
  if (S.money < n) {
    emit('deny', 'money')
    return false
  }
  S.money -= n
  emit('money', S.money, -n, 'spend')
  dirty()
  return true
}

// --- Baddies ----------------------------------------------------------------------------------
export function addBaddie(id, size = 0, { catchOdds = 0, source = '' } = {}) {
  if (S.baddies.length >= capacity()) {
    emit('deny', 'full')
    return null
  }
  const b = { uid: nextUid++, id, size }
  S.baddies.push(b)
  const isNew = discover(id)
  if (catchOdds > S.stats.bestOdds) S.stats.bestOdds = catchOdds
  emit('baddie-added', b, isNew, source)
  emit('income', income())
  dirty()
  return b
}
// Mark a girl found in the Index. Returns true the first time; completing an area's page
// emits 'area-complete' (its income bonus applies at once).
function discover(id) {
  if (S.discovered[id]) return false
  S.discovered[id] = true
  const def = BY_ID[id]
  emit('discover', def)
  if (def && areaFound(def.area) === AREAS[def.area].girls.length) {
    emit('area-complete', def.area)
    emit('income', income())
  }
  return true
}
// Room left in the pen, counting the baddies still waiting in the hotbar.
export const penRoom = () => capacity() - S.baddies.length - S.hotbar.length
// A catch goes to the hotbar first. Returns the hotbar item, or null if there is no room.
export function catchToHotbar(def, { catchOdds = 0 } = {}) {
  if (penRoom() <= 0 || S.hotbar.length >= ECONOMY.hotbarSlots) {
    emit('deny', 'full')
    return null
  }
  const item = { id: def.id, size: 0 }
  S.hotbar.push(item)
  const isNew = discover(def.id)
  if (catchOdds > S.stats.bestOdds) S.stats.bestOdds = catchOdds
  emit('hotbar', S.hotbar, { added: item, isNew })
  dirty()
  return item
}
// Place hotbar slot i into the pen. Returns the new pen entry, or null.
export function placeFromHotbar(i) {
  const item = S.hotbar[i]
  if (!item || S.baddies.length >= capacity()) {
    emit('deny', 'full')
    return null
  }
  S.hotbar.splice(i, 1)
  const b = addBaddie(item.id, item.size, { source: 'place' })
  emit('hotbar', S.hotbar, { removed: item })
  return b
}
export function removeBaddie(uid) {
  const i = S.baddies.findIndex((b) => b.uid === uid)
  if (i < 0) return null
  const [b] = S.baddies.splice(i, 1)
  emit('baddie-removed', b)
  emit('income', income())
  dirty()
  return b
}
export function sellBaddie(uid) {
  const b = S.baddies.find((x) => x.uid === uid)
  if (!b) return 0
  const price = sellPrice(b)
  removeBaddie(uid)
  addMoney(price, 'sell')
  return price
}

// Everything you own, as fuse/sell entries: the pen first, then the hotbar.
// { kind: 'pen' | 'hot', b } where b is the pen entry or the hotbar item (compared by identity).
export function owned() {
  return [...S.baddies.map((b) => ({ kind: 'pen', b })), ...S.hotbar.map((b) => ({ kind: 'hot', b }))]
}
export const ownsEntry = (e) => (e.kind === 'pen' ? S.baddies.includes(e.b) : S.hotbar.includes(e.b))

// Sell a hotbar item (a caught baddie you have not placed). Returns the price, or 0.
export function sellHotbarItem(item) {
  const i = S.hotbar.indexOf(item)
  if (i < 0) return 0
  const price = sellPrice(item)
  S.hotbar.splice(i, 1)
  emit('hotbar', S.hotbar, { removed: item })
  addMoney(price, 'sell')
  dirty()
  return price
}

// Active panel: move a pen baddie back to the hotbar (it stops earning). Returns the item or null.
export function unequip(uid) {
  if (S.hotbar.length >= ECONOMY.hotbarSlots) {
    emit('deny', 'hotbar')
    return null
  }
  const b = removeBaddie(uid)
  if (!b) return null
  const item = { id: b.id, size: b.size }
  S.hotbar.push(item)
  emit('hotbar', S.hotbar, { added: item, unequipped: true })
  dirty()
  return item
}
// Active panel: place the best hotbar baddies into the pen while it has room. Returns the new pen entries.
export function equipBest() {
  const order = [...S.hotbar].sort((a, b) => baddieIncome(b) - baddieIncome(a))
  const placed = []
  for (const item of order) {
    if (S.baddies.length >= capacity()) break
    const b = placeFromHotbar(S.hotbar.indexOf(item))
    if (b) placed.push(b)
  }
  return placed
}

// Groups of 3+ of the same type and size that can still grow (pen and hotbar together).
export function fusable() {
  const groups = new Map()
  for (const e of owned()) {
    if (e.b.size >= SIZES.length - 1) continue
    const k = `${e.b.id}|${e.b.size}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k).push(e)
  }
  return [...groups.values()].filter((g) => g.length >= 3)
}
// Fuse three owned entries of the same type and size into one of the next size (a lucky fuse
// skips a size, or pays a bonus at the top). The result goes to the pen when all three came
// from the pen, otherwise to the hotbar. Returns { b, where, lucky, bonus } or null.
export function fuseEntries(entries) {
  if (entries?.length !== 3 || !entries.every(ownsEntry) || new Set(entries.map((e) => e.b)).size !== 3) return null
  const { id, size } = entries[0].b
  if (size >= SIZES.length - 1 || !entries.every((e) => e.b.id === id && e.b.size === size)) return null
  for (const e of entries) {
    if (e.kind === 'pen') {
      S.baddies.splice(S.baddies.indexOf(e.b), 1)
      emit('baddie-removed', e.b)
    } else {
      S.hotbar.splice(S.hotbar.indexOf(e.b), 1)
      emit('hotbar', S.hotbar, { removed: e.b })
    }
  }
  const lucky = Math.random() < FUSE.luckyChance
  const top = SIZES.length - 1
  const newSize = Math.min(top, size + (lucky ? 2 : 1))
  const where = entries.every((e) => e.kind === 'pen') ? 'pen' : 'hot'
  let b
  if (where === 'pen') {
    b = { uid: nextUid++, id, size: newSize }
    S.baddies.push(b)
    emit('baddie-added', b, false, 'fuse')
  } else {
    b = { id, size: newSize }
    S.hotbar.push(b)
    emit('hotbar', S.hotbar, { added: b, fused: true })
  }
  S.stats.fused++
  emit('income', income())
  let bonus = 0
  if (lucky && size + 2 > top) {
    bonus = Math.max(1, Math.round(baddieIncome(b) * FUSE.luckyBonusSeconds))
    addMoney(bonus, 'fuse')
  }
  complete('fuse1')
  dirty()
  return { b, where, lucky, bonus }
}
// Three of a kind for (id, size), pen entries first so the result lands in the pen when it can.
export function pickTriple(id, size) {
  const g = owned().filter((e) => e.b.id === id && e.b.size === size)
  return g.length >= 3 ? g.slice(0, 3) : null
}
export const fuse = (id, size) => fuseEntries(pickTriple(id, size))

// --- Rolls --------------------------------------------------------------------------------------
// Pick a girl of a lane area: weighted by 1/odds ("1 in N" on her Index card), with luck
// flattening the odds of the rare ones.
export function rollBaddie(area, L = luck()) {
  const pool = areaGirls(area)
  const weights = pool.map((b) => 1 / Math.pow(b.odds, 1 / Math.max(1, Math.sqrt(L))))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}

// --- Purchases ------------------------------------------------------------------------------------
export function buyFood(id) {
  const f = FOODS.find((x) => x.id === id)
  if (!f || S.foods.includes(id)) return false
  if (!spend(f.price)) return false
  S.foods.push(id)
  S.food = id
  emit('food', id, true)
  const done = S.foods.length - 1
  if (done >= 1) complete('food1')
  if (done >= 2) complete('food2')
  if (done >= 3) complete('food3')
  dirty()
  return true
}
export function equipFood(id) {
  if (!S.foods.includes(id)) return false
  S.food = id
  emit('food', id, false)
  dirty()
  return true
}
export function upgradeCapacity() {
  if (capacityMaxed()) return false
  if (!spend(capacityCost())) return false
  S.capacityLevel++
  emit('capacity', capacity())
  complete('pen1')
  dirty()
  return true
}
export function buyUpgrade(id) {
  const u = UPGRADES.find((x) => x.id === id)
  const level = S.upgrades[id] ?? 0
  if (!u || level >= u.max) return false
  if (!spend(u.cost(level))) return false
  S.upgrades[id] = level + 1
  emit('upgrade', id, level + 1)
  emit('income', income())
  dirty()
  return true
}

// --- Strength, Training Bench, chest ---------------------------------------------------------
export function addStrength(n) {
  S.strength += n
  emit('strength', totalStrength(), n)
  dirty()
}
// Training Place: one pull-up's XP (the bench's XP/s x a rep's length, times `mult` for an XP
// boost). Returns { xp, levels } (levels gained by this rep).
export const trainNeed = () => TRAINING.need(S.train.level)
export const benchTier = () => Math.min(TRAINING.benches.length - 1, Math.max(0, S.train.bench | 0))
export const bench = () => TRAINING.benches[benchTier()]
export const benchNext = () => TRAINING.benches[benchTier() + 1] ?? null
export function trainRep(mult = 1) {
  const xp = Math.round(repXp(benchTier()) * mult * trainXpMult())
  S.train.xp += xp
  S.train.reps++
  let levels = 0
  while (S.train.xp >= TRAINING.need(S.train.level)) {
    S.train.xp -= TRAINING.need(S.train.level)
    S.train.level++
    levels++
  }
  if (levels) addStrength(levels * TRAINING.strengthPerLevel)
  emit('train', S.train, xp, levels)
  complete('train1')
  dirty()
  return { xp, levels }
}
// Buys the next Training Bench with money. { ok, tier } or { ok: false, need } (money short) /
// { ok: false, max: true }.
export function upgradeBench() {
  const next = benchNext()
  if (!next) return { ok: false, max: true }
  if (!spend(next.price)) return { ok: false, need: next.price - S.money }
  S.train.bench = benchTier() + 1
  emit('bench', S.train.bench)
  complete('bench1')
  dirty()
  return { ok: true, tier: S.train.bench }
}
export function claimChest() {
  if (!chestReady()) return 0
  const reward = chestReward()
  S.chestAt = Date.now() + ECONOMY.chestEvery * 1000
  addMoney(reward, 'chest')
  dirty()
  return reward
}

// --- Quests ------------------------------------------------------------------------------------
export const currentQuest = () => QUESTS.find((q) => !S.quests[q.id]) ?? null
export function complete(id) {
  if (S.quests[id]) return
  const q = QUESTS.find((x) => x.id === id)
  if (!q) return
  // Only the showing quest (or an earlier one) completes, so the banner reads in order.
  const cur = currentQuest()
  if (cur && QUESTS.indexOf(q) > QUESTS.indexOf(cur)) {
    pending.add(id)
    return
  }
  S.quests[id] = true
  emit('quest', q)
  addMoney(q.reward, 'quest')
  dirty()
  // Anything already achieved further down the list completes in turn.
  const next = currentQuest()
  if (next && pending.has(next.id)) {
    pending.delete(next.id)
    setTimeout(() => complete(next.id), 1200)
  }
}
const pending = new Set()
export function recordCatch(def) {
  S.stats.catches++
  complete('catch1')
  if (S.stats.catches >= 5) complete('catch5')
  if (def.rarity >= 2) complete('rare1')
  if (def.rarity >= 3) complete('epic1')
}

// --- Save / load -------------------------------------------------------------------------------
// The save lives on the game server only (net.js saveGame / loadGame, backend game.ts): nothing is
// kept in the browser. main.js hydrate()s the loaded document at boot and installs the saver; without
// a saver (offline, a guest, a server that could not be read) progress lasts the session.
let saver = null
let saveTimer = 0
export function setSaver(fn) {
  saver = fn
}
function dirty() {
  if (saveTimer) return
  saveTimer = setTimeout(save, ECONOMY.saveEveryMs)
}
export function save() {
  clearTimeout(saveTimer)
  saveTimer = 0
  S.lastSeen = Date.now()
  try {
    saver?.(S)
  } catch {
    // Connection closing: the next save retries.
  }
}
// Loads a saved document (null = a new player) into S. Returns the offline income credited.
export function hydrate(raw) {
  if (!raw || typeof raw !== 'object') return { offline: 0, cash: 0 }
  const base = fresh()
  Object.assign(S, base, raw)
  S.upgrades = { ...base.upgrades, ...(raw.upgrades ?? {}) }
  S.stats = { ...base.stats, ...(raw.stats ?? {}) }
  S.train = { ...base.train, ...(raw.train ?? {}) }
  S.train.bench = Math.min(TRAINING.benches.length - 1, Math.max(0, S.train.bench | 0))
  // The collect pad (cash + XP pile) is now the Training Bench's upgrade pad: what was left on it
  // is paid out once, and the Pad Magnet upgrade it needed is refunded.
  const oldPad = raw.pad && typeof raw.pad === 'object' ? raw.pad : null
  if (oldPad) {
    S.money += Math.max(0, Math.floor(oldPad.cash || 0))
    S.strength += Math.max(0, Math.floor(oldPad.xp || 0))
  }
  delete S.pad
  if (S.upgrades.magnet) S.money += 30000
  delete S.upgrades.magnet
  S.seen = Array.isArray(raw.seen) ? raw.seen.filter((id) => BY_ID[id]) : []
  // Saves from the first version name girls by their old ids.
  const remap = (b) => ({ ...b, id: LEGACY_IDS[b.id] ?? b.id })
  S.baddies = (raw.baddies ?? []).map(remap).filter((b) => BY_ID[b.id] && SIZES[b.size])
  S.hotbar = (raw.hotbar ?? []).map(remap).filter((b) => BY_ID[b.id] && SIZES[b.size]).slice(0, ECONOMY.hotbarSlots)
  S.discovered = Object.fromEntries(Object.keys(raw.discovered ?? {}).map((id) => [LEGACY_IDS[id] ?? id, true]).filter(([id]) => BY_ID[id]))
  S.foods = (raw.foods ?? [STARTER_FOOD]).filter((id) => FOODS.some((f) => f.id === id))
  if ((raw.foodsV ?? 1) < 2) {
    // v1 had 8 foods (apple .. taco) that now sit much higher in the 49-tier list: swap
    // them for the tier that matched their old price, and equip the best one.
    const OLD = { apple: 2, cookie: 3, donut: 4, burger: 5, pizza: 6, sushi: 7, cake: 8, taco: 9 }
    const top = Math.max(1, ...(raw.foods ?? []).map((id) => OLD[id] ?? 0))
    S.foods = FOODS.filter((f) => !f.special && f.tier <= top).map((f) => f.id)
    S.food = S.foods[S.foods.length - 1]
    S.foodsV = 2
  }
  if (!S.foods.includes(STARTER_FOOD)) S.foods.unshift(STARTER_FOOD)
  if (!S.foods.includes(S.food)) S.food = S.foods[S.foods.length - 1]
  nextUid = S.baddies.reduce((m, b) => Math.max(m, b.uid), 0) + 1
  const away = Math.min(ECONOMY.offlineCap, Math.max(0, (Date.now() - (raw.lastSeen ?? Date.now())) / 1000))
  const cash = away > 60 ? Math.floor(income() * away * ECONOMY.offlineShare) : 0
  if (cash > 0) {
    S.money += cash
    S.stats.earned += cash
  }
  return { offline: away, cash }
}
// Starts over: a fresh save on the server, then a reload.
export function reset() {
  Object.assign(S, fresh())
  saver?.(S)
  setTimeout(() => location.reload(), 300)
}
window.addEventListener('beforeunload', save)
document.addEventListener('visibilitychange', () => document.hidden && save())
