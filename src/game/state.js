// The player's progress and the economy rules: money, strength, owned foods and
// upgrades, the baddies in the pen, the Training Bench, the chest timer, quests and
// stats. Saved to localStorage (debounced) and loaded at boot, with offline
// income credited on return. Other modules listen with on(event, fn).
import { AREAS, BADDIES, ECONOMY, FOODS, FUSE, INDEX_BONUS, INDEX_REWARD, LEGACY_IDS, POTIONS, QUESTS, RECORDS, SIZES, STARTER_FOOD, THROW, TRAINING, UPGRADES, VARIANTS, repXp, seasonIncome } from '../config.js'
import { BY_ID } from './baddieModel.js'
import * as events from './events.js'

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
    baddies: [], // { uid, id, size, v?, a? } (v = VARIANTS index, a = area a season girl was caught in)
    hotbar: [], // caught, not placed yet: { id, size, v?, a? }
    discovered: {},
    quests: {},
    train: { level: 1, xp: 0, reps: 0, bench: 0 }, // the Training Place (pull-up bar); bench = tier in TRAINING.benches
    chestAt: Date.now() + 60 * 1000, // the first chest opens a minute in
    stats: { throws: 0, catches: 0, fused: 0, bestOdds: 0, earned: 0, bestDist: 0, bestStreak: 0, bestVariant: 0, bestRarity: -1, bestArea: -1 },
    seen: [], // Index entries looked at (clears the NEW tags)
    adBoostUntil: 0, // epoch ms the rewarded-ad income boost ends
    luckyCredits: 0, // free Lucky Throws (rewarded ads, gifts, daily, spin, event shop)
    tickets: 0, // Event Tickets (earned in seasons, spent in the event shop)
    lures: 0, // Season Lures: the next throw brings out a season girl
    potions: {}, // { luck | cash: epoch ms it lasts until } (POTIONS)
    recordPaid: 0, // distance-record milestones already paid (RECORDS.every metres each)
    indexPaid: [], // areas whose completed Index page has paid its reward
    titles: [], // titles earned (INDEX_REWARD), newest last
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
// Potions: s left of each, and their multipliers.
export const potionLeft = (kind) => Math.max(0, ((S.potions?.[kind] ?? 0) - Date.now()) / 1000)
const potionMult = (kind) => (potionLeft(kind) > 0 ? POTIONS[kind].mult : 1)
export function addPotion(kind, minutes) {
  if (!POTIONS[kind]) return
  const now = Date.now()
  S.potions = { ...S.potions, [kind]: Math.max(now, S.potions?.[kind] ?? 0) + minutes * 60000 }
  emit('potion', kind)
  emit('income', income())
  dirty()
}
export const incomeMult = () => (1 + 0.25 * S.upgrades.cash) * (1 + ECONOMY.friendBoost * friends() + inviteBoostPct()) * indexMult() * (adBoostLeft() > 0 ? ECONOMY.adBoostMult : 1) * events.incomeMult() * potionMult('cash')
// A season girl earns like the area she was caught in; variants and sizes multiply.
export const baseIncome = (b) => {
  const def = BY_ID[b.id]
  return def.season ? seasonIncome(def, b.a) : def.income
}
export const baddieIncome = (b) => baseIncome(b) * SIZES[b.size].mult * (VARIANTS[b.v | 0]?.mult ?? 1)
export const rawIncome = () => S.baddies.reduce((s, b) => s + baddieIncome(b), 0)
export const income = () => rawIncome() * incomeMult()
export const food = () => FOODS.find((f) => f.id === S.food) ?? FOODS.find((f) => f.id === STARTER_FOOD)
export const totalStrength = () => S.strength
// Throwing Strength as a range bonus (0.5 = +50%), capped at THROW.strengthCap.
export const strengthBonus = () => Math.min(THROW.strengthCap, totalStrength() * THROW.strengthPct)
export const range = () => Math.min(THROW.maxRange, food().dist * (1 + strengthBonus()))
// Iron Arms: +xpPerLevel training XP per level.
export const trainXpMult = () => 1 + (UPGRADES.find((u) => u.id === 'arms')?.xpPerLevel ?? 0) * (S.upgrades.arms ?? 0)
// Luck before the throw's own multipliers (grade, streak, distance, Lucky Throw, featured area).
export const luck = () => food().luck * (1 + 0.2 * S.upgrades.luck) * events.luckMult() * potionMult('luck')
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
// The variant / caught-area extras an entry carries (only when set, to keep saves small).
const extras = (from) => ({ ...(from?.v ? { v: from.v } : {}), ...(from?.a != null && BY_ID[from.id ?? '']?.season ? { a: from.a } : {}) })
export function addBaddie(id, size = 0, { catchOdds = 0, source = '', v = 0, a = null } = {}) {
  if (S.baddies.length >= capacity()) {
    emit('deny', 'full')
    return null
  }
  const b = { uid: nextUid++, id, size, ...extras({ id, v, a }) }
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
  if (def && def.area >= 0 && areaFound(def.area) === AREAS[def.area].girls.length) {
    payIndexReward(def.area)
    emit('area-complete', def.area)
    emit('income', income())
  }
  return true
}
// A completed Index page pays once: INDEX_REWARD money and a title.
function payIndexReward(area) {
  if (S.indexPaid.includes(area)) return
  S.indexPaid = [...S.indexPaid, area]
  const title = INDEX_REWARD.title(AREAS[area])
  if (!S.titles.includes(title)) S.titles = [...S.titles, title]
  const cash = Math.max(INDEX_REWARD.min, Math.round(income() * INDEX_REWARD.secs))
  addMoney(cash, 'index')
  emit('index-reward', { area, title, cash })
}
// Free hotbar slots. The hotbar is separate from the pen: a catch only needs a free hotbar slot,
// even when the pen is full (placing it in the pen later needs pen room).
export const hotbarRoom = () => ECONOMY.hotbarSlots - S.hotbar.length
// A catch goes to the hotbar first. Returns the hotbar item, or null if the hotbar is full.
export function catchToHotbar(def, { catchOdds = 0, v = 0, a = null } = {}) {
  if (hotbarRoom() <= 0) {
    emit('deny', 'full')
    return null
  }
  const item = { id: def.id, size: 0, ...extras({ id: def.id, v, a }) }
  S.hotbar.push(item)
  const isNew = discover(def.id)
  if (catchOdds > S.stats.bestOdds) S.stats.bestOdds = catchOdds
  S.stats.bestVariant = Math.max(S.stats.bestVariant | 0, v | 0)
  S.stats.bestRarity = Math.max(S.stats.bestRarity ?? -1, def.rarity)
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
  const b = addBaddie(item.id, item.size, { source: 'place', v: item.v, a: item.a })
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
  const item = { id: b.id, size: b.size, ...extras(b) }
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

// What has to match to fuse: girl, size, variant (and a season girl's area).
export const fuseKey = (b) => `${b.id}|${b.size}|${b.v | 0}|${b.a ?? ''}`
// Groups of 3+ of the same type and size that can still grow (pen and hotbar together).
export function fusable() {
  const groups = new Map()
  for (const e of owned()) {
    if (e.b.size >= SIZES.length - 1) continue
    const k = fuseKey(e.b)
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
  const key = fuseKey(entries[0].b)
  const keep = extras(entries[0].b)
  if (size >= SIZES.length - 1 || !entries.every((e) => fuseKey(e.b) === key)) return null
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
    b = { uid: nextUid++, id, size: newSize, ...keep }
    S.baddies.push(b)
    emit('baddie-added', b, false, 'fuse')
  } else {
    b = { id, size: newSize, ...keep }
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
// Three of a kind like `b` (girl, size, variant), pen entries first so the result lands in the pen.
export function pickTriple(b) {
  const key = fuseKey(b)
  const g = owned().filter((e) => fuseKey(e.b) === key)
  return g.length >= 3 ? g.slice(0, 3) : null
}
export const fuse = (b) => fuseEntries(pickTriple(b))

// --- Rolls --------------------------------------------------------------------------------------
// One of the running season's girls (game/events.js), weighted like rollBaddie.
export function rollSeason(L = luck()) {
  const pool = events.season().girls
  if (!pool.length) return null
  const weights = pool.map((b) => 1 / Math.pow(b.odds, 1 / Math.max(1, Math.sqrt(L))))
  let r = Math.random() * weights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}
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
  const reward = questReward(q)
  emit('quest', { ...q, reward })
  addMoney(reward, 'quest')
  dirty()
  // Anything already achieved further down the list completes in turn.
  const next = currentQuest()
  if (next && pending.has(next.id)) {
    pending.delete(next.id)
    setTimeout(() => complete(next.id), 1200)
  }
}
const pending = new Set()
// A quest's reward right now: its money, or `secs` of income when that is more.
export const questReward = (q) => Math.max(q.reward ?? 0, Math.round(income() * (q.secs ?? 0)))
// The showing quest with its current reward (for the banner), or null.
export function questView() {
  const q = currentQuest()
  return q ? { ...q, reward: questReward(q) } : null
}
// Is a quest's goal met? (QUESTS `goal`)
const bestFoodTier = () => S.foods.reduce((m, id) => Math.max(m, FOODS.find((f) => f.id === id)?.tier ?? 0), 0)
function goalMet(g) {
  switch (g.type) {
    case 'area': return S.stats.bestArea + 1 >= g.n
    case 'catches': return S.stats.catches >= g.n
    case 'food': return bestFoodTier() >= g.n
    case 'bench': return benchTier() >= g.n
    case 'level': return S.train.level >= g.n
    case 'size': return owned().some((e) => e.b.size >= g.n)
    case 'variant': return (S.stats.bestVariant | 0) >= g.n
    case 'rarity': return (S.stats.bestRarity ?? -1) >= g.n
    case 'dist': return S.stats.bestDist >= g.n
    case 'streak': return (S.stats.bestStreak | 0) >= g.n
    case 'index': return areasComplete() >= g.n
    default: return false
  }
}
// Completes the showing quest once its goal is met (main.js calls this a few times a second).
let questBusy = 0
export function checkQuests() {
  const q = currentQuest()
  if (!q?.goal || Date.now() < questBusy || !goalMet(q.goal)) return
  questBusy = Date.now() + 1800 // let the "Done!" banner show before the next one completes
  complete(q.id)
}
export function recordCatch(def) {
  S.stats.catches++
  complete('catch1')
  if (S.stats.catches >= 5) complete('catch5')
  if (def.rarity >= 2) complete('rare1')
  if (def.rarity >= 3) complete('epic1')
}

// --- Throw records, streaks, tickets, prizes ---------------------------------------------------
// A throw landed `m` metres out in area `area`: the furthest area and distance records, and the
// distance-record milestone payouts. Returns { record, paid } (paid = money from milestones).
export function recordThrow(m, area) {
  S.stats.bestArea = Math.max(S.stats.bestArea ?? -1, area)
  const record = m > S.stats.bestDist + 0.5
  if (record) S.stats.bestDist = Math.round(m * 10) / 10
  let paid = 0
  const due = Math.floor(S.stats.bestDist / RECORDS.every)
  while (S.recordPaid < due) {
    S.recordPaid++
    paid += Math.max(RECORDS.min, Math.round(income() * RECORDS.secs))
  }
  if (paid) addMoney(paid, 'record')
  dirty()
  return { record, paid }
}
export function noteStreak(n) {
  if (n > (S.stats.bestStreak | 0)) S.stats.bestStreak = n
}
export function addTickets(n) {
  if (!(n > 0)) return
  S.tickets = (S.tickets | 0) + n
  emit('tickets', S.tickets, n)
  dirty()
}
export function spendTickets(n) {
  if ((S.tickets | 0) < n) return false
  S.tickets -= n
  emit('tickets', S.tickets, -n)
  dirty()
  return true
}
// Grants a prize (PLAYTIME_GIFTS / DAILY.days / SPIN.wedges entries): cash (secs of income, at
// least floor), lucky (free Lucky Throws), potion (minutes), plus optional tickets. Returns a
// short description ("+$1.2K", "2x Luck for 10 min", ...).
export function grantPrize(p, source = 'prize') {
  const parts = []
  if (p.kind === 'cash') {
    const cash = Math.max(p.floor ?? 0, Math.round(income() * (p.secs ?? 0)))
    addMoney(cash, source)
    parts.push(`+$${Math.round(cash).toLocaleString()}`)
  } else if (p.kind === 'lucky') {
    S.luckyCredits = Math.min(99, (S.luckyCredits | 0) + (p.n ?? 1))
    parts.push(`${p.n ?? 1} free Lucky Throw${(p.n ?? 1) > 1 ? 's' : ''}`)
  } else if (p.kind === 'potion') {
    addPotion(p.potion, p.minutes)
    parts.push(`${POTIONS[p.potion].name} for ${p.minutes} min`)
  }
  if (p.tickets) {
    addTickets(p.tickets)
    parts.push(`+${p.tickets} tickets`)
  }
  dirty()
  return parts.join(' + ')
}
// What a prize is, in words (before it is granted).
export function prizeText(p) {
  if (p.kind === 'cash') return `$${Math.round(Math.max(p.floor ?? 0, income() * (p.secs ?? 0))).toLocaleString()}`
  if (p.kind === 'lucky') return `${p.n ?? 1} Lucky Throw${(p.n ?? 1) > 1 ? 's' : ''}`
  if (p.kind === 'potion') return `${POTIONS[p.potion].name} ${p.minutes}m`
  return ''
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
  S.potions = raw.potions && typeof raw.potions === 'object' ? Object.fromEntries(Object.entries(raw.potions).filter(([k, v]) => POTIONS[k] && v > 0)) : {}
  S.indexPaid = Array.isArray(raw.indexPaid) ? raw.indexPaid.filter((a) => Number.isInteger(a)) : []
  S.titles = Array.isArray(raw.titles) ? raw.titles.filter((t) => typeof t === 'string') : []
  // Pages finished before Index rewards existed earn their titles now.
  AREAS.forEach((area, a) => {
    if (areaFound(a) === area.girls.length && !S.indexPaid.includes(a)) {
      S.indexPaid.push(a)
      S.titles.push(INDEX_REWARD.title(area))
    }
  })
  nextUid =S.baddies.reduce((m, b) => Math.max(m, b.uid), 0) + 1
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
