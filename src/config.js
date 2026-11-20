// Every tunable constant lives here; the rest of src/ holds no theme values.

// --- Identity -------------------------------------------------------------
export const GAME_SLUG = 'throw-food-for-baddies' // slug registered on bloxity.io
export const GAME_TITLE = 'Throw Food for Baddies'

// Forces the Bloxity SDK and avatar CDN to be treated as unavailable (see .env.example).
export const DEV_MODE = import.meta.env.VITE_DEV_MODE === 'true'

// --- World (metres: +X east, +Z south, +Y up) -------------------------------
export const GROUND_Y = 0
export const SPAWN = { x: 0, y: 0.05, z: -3 } // in the meadow in front of your own pen, facing the lane
export const SPAWN_FACING = Math.PI // yaw the character faces on spawn (PI = toward -Z = north)

// --- Player modes (modes.js) -------------------------------------------------
// 'character' = third-person chase cam with the avatar on screen.
// 'player' = first-person, the camera is the player's eyes and the avatar is hidden.
export const MODES = ['character', 'player']
export const START_MODE = 'character'

// --- Physics (physics.js, player.js) ------------------------------------------
export const PHYSICS = {
  gravity: -22, // m/s^2 for dynamic bodies and the player
  fixedStep: 1 / 60, // s per physics tick; rendering interpolates between ticks
  maxSubSteps: 5, // a long frame never runs more ticks than this
  walkSpeed: 8, // m/s
  sprintSpeed: 14, // m/s with Shift held
  accel: 70, // m/s^2 toward the target velocity on the ground
  airAccel: 22, // m/s^2 steering while airborne
  decel: 60, // m/s^2 when no key is held
  turnSpeed: 12, // rad/s the body turns toward its heading
  jumpSpeed: 8.5, // m/s
  coyoteTime: 0.1, // s after leaving a ledge a jump still counts
  jumpBuffer: 0.12, // s a jump pressed before landing is remembered
  stepHeight: 0.45, // m autostep
  maxSlope: 50, // degrees the player can walk up
  snapToGround: 0.4, // m the controller stays glued to downward steps and slopes
  pushMass: 80, // kg the character weighs when shoving crates
  killY: -6, // sank this far: respawn
}
export const PLAYER_DIMS = { radius: 0.75, height: 1.8 } // capsule the character controller moves

// --- Look ------------------------------------------------------------------
export const RENDER = { exposure: 1.0 }
export const FOG = { near: 180, far: 620 }
// The two lighting moods lighting.js blends between (key N toggles).
export const TIME_OF_DAY = {
  transition: 2.5, // s to blend day <-> night
  day: {
    zenith: '#1576f0',
    horizon: '#a9e2ff',
    sunColor: '#fff4de',
    // Sun + hemi + env together keep the pale sand (#eed39c) near its own tan;
    // much more and ACES washes it (and the props) out to grey-white.
    sunIntensity: 2.4,
    sunElevation: 55, // degrees above the horizon
    sunAzimuth: 35, // degrees, 0 = from +Z
    hemiSky: '#e4f2ff',
    hemiGround: '#8fcf63',
    hemiIntensity: 0.8,
    envIntensity: 0.45,
    lampIntensity: 0,
    stars: 0,
    exposure: 0.95,
  },
  night: {
    zenith: '#050b22',
    horizon: '#24345e',
    sunColor: '#9fb4ff', // the moon
    sunIntensity: 0.55,
    sunElevation: 38,
    sunAzimuth: -60,
    hemiSky: '#3a4c80',
    hemiGround: '#1a1a22',
    hemiIntensity: 0.35,
    envIntensity: 0.25,
    lampIntensity: 30,
    stars: 1,
    exposure: 1.15,
  },
}
export const LIGHT = {
  shadowRange: 40, // half-width of the sun's shadow box around the player
  lampColor: '#ffb35c',
  lampDistance: 22,
}

// Default (fallback) character look, used only when player.glb cannot load.
export const CHARACTER_COLORS = { skin: '#f2c79a', suit: '#2f6fd0', hair: '#4a2f1c' }

export const MATERIAL_PBR = {
  PLAYER: { roughness: 0.7, metalness: 0 },
  GROUND: { roughness: 0.95, metalness: 0 },
}

// --- Graphics presets, picked by the Bloxity graphics_quality setting ----------
export const GRAPHICS_PRESETS = {
  Low: { shadows: false, shadowMap: 512, antialias: false, dpr: 1, bloom: false, particles: 0.35 },
  Medium: { shadows: true, shadowMap: 1024, antialias: false, dpr: 1.25, bloom: false, particles: 0.6 },
  High: { shadows: true, shadowMap: 2048, antialias: true, dpr: 2, bloom: true, particles: 1 },
  Ultra: { shadows: true, shadowMap: 4096, antialias: true, dpr: 2, bloom: true, particles: 1 },
}

// Bloom (postfx.js): only HDR-bright pixels (above threshold, linear, before
// tone mapping) glow: neon rails, waterfall, VIP gate, particles. Sunlit sand
// stays under the threshold.
export const BLOOM = { strength: 0.6, radius: 0.35, threshold: 2.0 }
// Neon materials (propkit.js): k = HDR colour multiplier with bloom on; with
// bloom off they are capped at plainMax so they stay coloured, not white.
export const NEON = { k: 3.5, plainMax: 1.2 }

// Phones and tablets default to a lighter preset when the portal sends no value,
// and any preset is capped there (a phone at DPR 3 renders 9x the pixels; bloom
// is a full-screen multi-pass blur, so it stays off on phones).
export const COARSE_POINTER = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches
export const DEFAULT_GRAPHICS = COARSE_POINTER ? 'Medium' : 'High'
export const MOBILE_GRAPHICS_CAP = { dpr: 1.5, shadowMap: 1024, particles: 0.6 }

// The preset to render with on this device.
export function graphicsPreset(name) {
  const p = GRAPHICS_PRESETS[name] ?? GRAPHICS_PRESETS[DEFAULT_GRAPHICS]
  if (!COARSE_POINTER) return p
  const cap = MOBILE_GRAPHICS_CAP
  return { ...p, dpr: Math.min(p.dpr, cap.dpr), shadowMap: Math.min(p.shadowMap, cap.shadowMap), bloom: false, particles: Math.min(p.particles, cap.particles) }
}

// --- Touch controls (touch.js) --------------------------------------------------
export const TOUCH = {
  deadZone: 0.12, // fraction of the joystick radius that does nothing
  lookScale: 1.5, // touch drag pixels -> look, relative to a mouse pixel
  pinchPixelsPerNotch: 30, // finger spread change that equals one wheel notch
}

// --- Camera (camera.js) -------------------------------------------------------
export const CAMERA = {
  fov: 70,
  near: 0.1,
  far: 1200,
  startPitch: 0.32, // radians above the horizon (low chase cam)
  minPitch: -0.35,
  maxPitch: 1.25,
  firstPersonPitch: 1.45, // |pitch| limit looking up/down in player mode
  eyeHeight: 0.92, // eye height as a fraction of player height (player mode)
  distance: 12.4, // resting boom length, m
  minDistance: 2.5, // wheel in past this enters player mode
  maxDistance: 26,
  followLerp: 14, // 1/s: the one smoothing stage, on the point the camera follows
  targetHeight: 1.2, // look-at point as a fraction of player height
  lookSensitivity: 0.0026, // rad per pixel of mouse movement
  zoomStep: 0.9, // m per wheel notch
  zoomEase: 12, // 1/s the zoom glides to its target
  speedFov: 6, // degrees the FOV widens at sprint speed
  speedEase: 3, // 1/s the speed framing eases in and out
  clearEase: 6, // 1/s the boom eases back out once a wall stops blocking it
}

// --- Bloxity (bloxity.js, avatar/) -------------------------------------------------
// SDK setting keys this game listens for; registering a listener makes the control
// appear in the portal's settings menu.
export const SETTINGS = {
  graphics_quality: { def: DEFAULT_GRAPHICS, type: 'enum', values: ['Low', 'Medium', 'High', 'Ultra'] },
  camera_sensitivity: { def: '1', type: 'number', min: 0.1, max: 5 },
  show_fps: { def: 'false', type: 'bool' },
  fullscreen: { def: 'false', type: 'bool' },
  master_volume: { def: '100', type: 'number', min: 0, max: 100 },
  music_volume: { def: '100', type: 'number', min: 0, max: 100 },
}

// Rewarded ads (ads.js, bloxity.js showRewarded): a button on the HUD offers these; the reward is
// granted only after Bloxity's ad completed AND the server verified the reward token. Rewards are
// Wins / money only (see the root CLAUDE.md). Placements: lowercase letters, digits and hyphens.
export const ADS = {
  cooldownMs: 20000, // the portal also refuses ads that come too soon / past a daily cap ('denied')
  maxBoostMinutes: 60,
  rewards: [
    { id: 'double-income', placement: 'double-income', name: '2x Income', desc: 'Double money for 10 minutes', icon: '💰', minutes: 10 },
    { id: 'cash-boost', placement: 'cash-boost', name: 'Cash Boost', desc: '10 minutes of income, right now', icon: '💵', seconds: 600, min: 500 },
    { id: 'lucky-throw', placement: 'lucky-throw', name: 'Free Lucky Throw', desc: '100x luck on your next throw', icon: '🍀' },
  ],
}

// Remote players (remote.js): how far away they are drawn / animated at full rate (metres).
export const REMOTE = {
  follow: 12, // pose smoothing, 1/s
  farDist: 70, // beyond this the animator ticks at a third of the rate
  labelDist: 60, // name tags
  fxDist: 160, // trails and landing bursts of their throws
  hideDist: 260, // beyond this they are not drawn at all
  poseHz: 10, // how often the local pose is sent
}

// Bloxity leaderboards (bloxity.js, declared once, max 10): the plaza boards read them when the SDK
// answers and fall back to the offline stand-ins (BOARD_BOTS) otherwise.
// Same ids and settings as the backend's LEADERBOARDS (constants.ts): the first declaration is
// permanent, and the server reports the scores of verified players. `stat` is the field of the save the
// plaza board ranks (the server sends the top lists as boards[stat]).
export const LEADERBOARDS = [
  { id: 'best-pull', label: 'Best pull (1 in N)', stat: 'bestOdds', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
  { id: 'baddies-caught', label: 'Baddies caught', stat: 'catches', order: 'desc', mode: 'best', format: 'number', reset: 'none' },
  { id: 'money-per-second', label: 'Money per second', stat: 'income', order: 'desc', mode: 'best', format: 'compact', reset: 'none' },
]

// The base rig, measured from player.glb: origin at the feet, 6.4 units tall at bind pose.
export const RIG_HEIGHT = 6.4
// Bind-pose values of the rig nodes the SDK proportions drive.
export const RIG = { armOffsetX: 2, legOffsetX: 0.6, neckOffsetY: 0.6 }
// getProportions() ranges, straight from the SDK spec; clamped before they reach the scene graph.
export const PROPORTIONS = {
  height: { def: 1, min: 0.5, max: 1.6 },
  shoulderWidth: { def: 1, min: 0.5, max: 1.5 },
  armLength: { def: 1, min: 0.05, max: 3 },
  legOffsetX: { def: 1, min: -0.7, max: 5 },
  torsoScaleX: { def: 1, min: 0.3, max: 2 },
  neckHeight: { def: 1, min: 0.94, max: 1.2 },
  headScale: { def: 1, min: 0.3, max: 2.6 },
}

// Procedural animation (avatar/animator.js), ported from Clean Leaves for Loot.
// Rotations are radians in CHARACTER space: +X swings a limb backward, +Y yaws, +Z rolls.
const deg = (d) => (d * Math.PI) / 180
export const ANIM = {
  airborneDelay: 0.07, // s off the ground before the air pose (ignores a step down a ledge)
  // Walk -> run is one cycle at two depths; phase advances with distance travelled.
  locomotion: {
    minFrequency: 0.7,
    maxFrequency: 3.6,
    strideDistance: 3.8, // m per cycle
    idleSpeed: 0.6,
    walkSpeed: 2.5,
    runSpeed: 8,
    sprintSpeed: 13,
    hipSwing: { walk: deg(22), run: deg(42), sprint: deg(56) },
    kneeBend: { walk: deg(30), run: deg(58), sprint: deg(72) },
    armSwing: { walk: deg(18), run: deg(36), sprint: deg(52) },
    elbowBend: { walk: deg(14), run: deg(44), sprint: deg(70) },
    torsoTwist: { walk: deg(4), run: deg(7), sprint: deg(9) },
    torsoLean: { walk: deg(3), run: deg(10), sprint: deg(18) },
    headCounterTwist: { walk: deg(2), run: deg(4), sprint: deg(5) },
    torsoRoll: { walk: deg(2), run: deg(3), sprint: deg(3) },
    bob: { walk: 0.03, run: 0.07, sprint: 0.09 }, // m, on the avatar root
    bankAngle: deg(9),
    bankRate: 8,
  },
  idle: {
    breathFrequency: 0.35,
    breathAmount: deg(1.8),
    breathBob: 0.007,
    basePose: {
      ArmL1: { x: deg(-4), z: deg(8) },
      ArmL2: { x: deg(12) },
      ArmR1: { x: deg(-4), z: deg(-8) },
      ArmR2: { x: deg(12) },
      LegL1: { x: deg(-4) },
      LegR1: { x: deg(4) },
    },
  },
  airborne: {
    rise: {
      LegL1: { x: deg(-38) }, LegR1: { x: deg(8) }, LegL2: { x: deg(62) }, LegR2: { x: deg(40) },
      ArmL1: { x: deg(-40), z: deg(34) }, ArmR1: { x: deg(-30), z: deg(-34) },
      ArmL2: { x: deg(30) }, ArmR2: { x: deg(30) }, Spine1: { x: deg(6) },
    },
    fall: {
      LegL1: { x: deg(-14) }, LegR1: { x: deg(10) }, LegL2: { x: deg(22) }, LegR2: { x: deg(18) },
      ArmL1: { x: deg(-70), z: deg(40) }, ArmR1: { x: deg(-60), z: deg(-40) },
      ArmL2: { x: deg(20) }, ArmR2: { x: deg(20) }, Spine1: { x: deg(-4) },
    },
    velocityReference: 8, // m/s vertical speed that reads as fully rising / falling
  },
  landing: {
    duration: 0.16,
    pose: {
      LegL1: { x: deg(-34) }, LegR1: { x: deg(-34) }, LegL2: { x: deg(58) }, LegR2: { x: deg(58) },
      ArmL1: { x: deg(-18), z: deg(20) }, ArmR1: { x: deg(-18), z: deg(-20) }, Spine1: { x: deg(14) },
    },
    bobY: -0.2,
  },
  transitions: { toLocomotion: 0.14, toAirborne: 0.12, toLanding: 0.06 }, // s to blend a pose change
}

export const FONT_FAMILY = 'Fredoka'

export function clamp(n, min, max) {
  return n < min ? min : n > max ? max : n
}

// Coerce one raw SDK string against its SETTINGS entry.
export function coerceSetting(key, raw) {
  const spec = SETTINGS[key]
  if (!spec) return raw
  const value = raw === '' || raw == null ? spec.def : raw
  if (spec.type === 'bool') return value === 'true' || value === true
  if (spec.type === 'enum') return spec.values.includes(value) ? value : spec.def
  const n = Number(value)
  return clamp(Number.isFinite(n) ? n : Number(spec.def), spec.min, spec.max)
}

// =====================================================================================
// Throw Food for Baddies: the hub, the lane and the economy
// =====================================================================================
// Metres, +X east, +Z south, north = -Z. The hub is a sunken lego meadow walled in by
// two tiers of grass-topped dirt cliffs. Five fenced pens line the south side (the
// middle one is the player's), the yellow road runs east-west across the north half,
// and the lane opens north between the leaderboards (west) and the sell stall, fuse
// machine and free chest (east).
export const HUB = {
  minX: -58,
  maxX: 58,
  minZ: -30, // north wall (the lane cuts through it)
  maxZ: 34, // south wall
  tierHeight: 7, // m per cliff tier
  tierDepth: [12, 18], // m deep each terrace is, inner to outer
  studTile: 4, // m per ground stud tile (2 x 2 checker cells of 4 x 4 studs)
  road: { z: -16, halfWidth: 2.4, minX: -54, maxX: 54 },
  // The lane is a sunken canyon: past the throw line its floor drops floorY metres below the hub
  // (a sheer dirt face under the throw band), so you throw down into it.
  lane: { halfWidth: 9, start: -30, end: -412, throwLine: -31.5, floorY: -10 },
  // The themed areas down the lane: filled from AREAS (below) once it exists.
  zones: [],
}

// The five pens ("bases"), west to east. Online, the server assigns each player one (net.js; the
// room holds exactly xs.length players, the backend's BASE_COUNT / ROOM_MAX_CLIENTS: keep them in
// step). playerIndex is the base used offline; the rest are then neighbour plots.
export const PENS = {
  xs: [-42, -21, 0, 21, 42],
  z: 21, // centre
  halfW: 8,
  halfD: 7,
  playerIndex: 2,
  floorHeight: 0.25,
}

// The game server (net.js). Built games reach it through the Bloxity matchmaker
// (Legion.SDK.net.resolveEndpoint, see bloxity.js). Set VITE_SERVER_URL (e.g. ws://localhost:2567)
// to play against a local backend without the SDK; unset and no SDK means offline play.
export const NET = {
  room: 'world', // the backend's room name (WorldRoom)
  serverUrl: import.meta.env.VITE_SERVER_URL || '',
  joinTimeoutMs: 60000, // matchmaker cold starts take up to ~45 s (hosting docs: give up after ~60 s)
  localJoinTimeoutMs: 6000, // a local backend either answers at once or is not running
  rejoinTimeoutMs: 60000,
  retryMs: 500, // first retry delay, doubled up to retryMaxMs
  retryMaxMs: 5000,
  gameLoadMs: 20000, // how long boot waits for the stored progress before playing without saving
  baseWaitMs: 8000, // how long to wait for the server to tell the player their base after joining
}

// Points of interest (walk into a ring to open its window).
export const POI = {
  foodShop: { x: -6.2, z: 9.2, r: 2.6 },
  padOffset: { x: 5.4, z: -5.2 }, // the Training Bench's upgrade pad, relative to the pen front centre
  gateOffset: { x: 0, z: 0 },
  signOffset: { x: 3.4, z: 0.4 },
  sell: { x: 20, z: -24, r: 2.8 },
  fuse: { x: 29, z: -24.6, r: 2.8 },
  chest: { x: 38.6, z: -25.4, r: 2.6 },
  boards: { x: -34, z: -29.5, gap: 8.8 }, // west-most board, then east by gap
  friendWall: { x: -48, z: -29.6 },
}

// Every player owns one unit: their base (pen) + Food Shop + Training Place. POI.foodShop and
// TRAINING.spot are written for the middle base (PENS.playerIndex); main.js calls placeUnit() once
// the server has assigned this player a base, which moves both beside that base. Only the local
// player's own shop and training station are ever built: other players' are not shown.
export function placeUnit(baseIndex) {
  const dx = PENS.xs[baseIndex] - PENS.xs[PENS.playerIndex]
  POI.foodShop.x += dx
  // The ring must stay on the meadow (the east-most base would push it into the cliff).
  const maxX = HUB.maxX - TRAINING.ringR - 1.2
  TRAINING.spot.x = Math.min(TRAINING.spot.x + dx, maxX)
}

export const RARITIES = [
  { name: 'Common', color: '#e4e7ec', glow: '#ffffff', card: ['#c9ced8', '#5d6474'] },
  { name: 'Uncommon', color: '#69e05a', glow: '#7dff6a', card: ['#7fe060', '#245a1c'] },
  { name: 'Rare', color: '#3fa6ff', glow: '#4fb8ff', card: ['#4fb4ff', '#123a6a'] },
  { name: 'Epic', color: '#c27dff', glow: '#c27dff', card: ['#b46aff', '#3a1466'] },
  { name: 'Legendary', color: '#ffc21f', glow: '#ffd34f', card: ['#ffc23a', '#6a3a08'] },
  { name: 'Mythic', color: '#ff4f5e', glow: '#ff6a7a', card: ['#ff5a4a', '#5a0a14'] },
  { name: 'Secret', color: '#2ef2d0', glow: '#7ffce0', card: ['#2ed8c0', '#0a3a3a'] },
  { name: 'Divine', color: '#fff3c4', glow: '#fff6d8', card: ['#fff6e0', '#a8b8d8'], shimmer: true },
  { name: 'Celestial', color: '#8a7aff', glow: '#a99cff', card: ['#7a5cff', '#1a0f4a'], shimmer: true },
  { name: 'Eternal', color: '#ff7af2', glow: '#ffffff', card: ['#3a3450', '#08070e'], shimmer: true },
]

// --- Areas and their girls --------------------------------------------------------------------
// The lane is split into twelve themed areas, near to far. Each has its floor colours, the
// props along its walls (`cover`: the girls step out from behind them), a gate banner, the
// particles that drift through it (`fx`, also around its girls in your pen) and ten girls.
// A girl's slot (0..9, her place in the area's list) sets her rarity (RARITY_SLOTS + one step
// every three areas), her catch odds (SLOT_ODDS, a little longer each area) and her income
// (AREA_INCOME(area) x SLOT_INCOME). Short keys: n name, hs hair style, hc / h2 hair colour /
// highlight, sk skin, e eyes, o outfit, t top, b bottom, a accent, sh shoes, hat, ew eyewear,
// nk neckwear, w wings, tl tail, hd held item (each with a ...C colour), glow = shining aura.
export const RARITY_SLOTS = [0, 0, 1, 1, 2, 2, 3, 4, 5, 6]
export const SLOT_ODDS = [2, 3, 5, 9, 16, 28, 60, 150, 500, 2000]
export const SLOT_INCOME = [1, 1.5, 2.2, 3.2, 5, 8, 13, 22, 40, 80]
export const AREA_INCOME = (a) => 2 * Math.pow(2.2, a)
export const INDEX_BONUS = 0.05 // +5% income for every area whose Index page is complete

export const AREAS = [
  {
    id: 'meadow', name: 'Sunny Meadow', color: '#6fdc3c', alt: '#63d132', banner: ['#7be04a', '#2f8f2a'], text: '#ffffff',
    cover: ['tree', 'bush', 'flowerBush'], fx: 'petals', fxColors: ['#ffffff', '#ffd6e8', '#fff27a', '#ffb3d9'], dust: '#cfeeb8',
    girls: [
      { n: 'Daisy', hs: 'bob', hc: '#ffe27a', e: '#4f9a3a', o: 'skirt', t: '#ffffff', b: '#ffd23a', a: '#7be04a', sh: '#ffffff', hat: 'flower', hatC: '#ffffff', hd: 'flower', hdC: '#ffffff' },
      { n: 'Clover', hs: 'ponytail', hc: '#3e9f3a', e: '#2f7a2f', o: 'overalls', t: '#fff6d8', b: '#5fbf4a', sh: '#8b5a33', hat: 'bow', hatC: '#7be04a' },
      { n: 'Bunnie', hs: 'twintails', hc: '#fff0f6', h2: '#ffc6dd', e: '#ff6fa8', o: 'dress', t: '#ffc6dd', b: '#ff9ec7', a: '#ffffff', sh: '#ffffff', hat: 'bunnyEars', hatC: '#ffffff', tl: 'bunny', tlC: '#ffffff' },
      { n: 'Ladybell', hs: 'bob', hc: '#2a1a1a', e: '#e03a3a', o: 'dress', t: '#e83a3a', b: '#e83a3a', a: '#1a1a1a', sh: '#1a1a1a', hat: 'antenna', hatC: '#1a1a1a', w: 'fairy', wC: '#ff8a8a' },
      { n: 'Honey', hs: 'buns', hc: '#ffcc33', h2: '#3a2414', e: '#ffaa00', o: 'skirt', t: '#ffd23a', b: '#2a2020', a: '#ffd23a', sh: '#2a2020', hat: 'antenna', hatC: '#2a2020', w: 'fairy', wC: '#e8f7ff', hd: 'honey', hdC: '#ffb020' },
      { n: 'Poppy', hs: 'wavy', hc: '#ff5a3a', e: '#3a7a3a', o: 'dress', t: '#ffffff', b: '#ff5a3a', a: '#ffffff', sh: '#ff5a3a', hat: 'sunHat', hatC: '#fff2c8', hd: 'flower', hdC: '#ff3a3a' },
      { n: 'Fawnie', hs: 'long', hc: '#b8743a', h2: '#e8c08a', e: '#6a3b1e', o: 'skirt', t: '#f0e0c0', b: '#8a5a30', a: '#ffffff', sh: '#6a3b1e', hat: 'antlers', hatC: '#c89a6a', tl: 'bunny', tlC: '#f0e0c0' },
      { n: 'Flutter', hs: 'twintails', hc: '#b07cff', h2: '#ff9bf0', e: '#7a4bff', o: 'dress', t: '#e6d8ff', b: '#b07cff', a: '#ffffff', sh: '#b07cff', hat: 'antenna', hatC: '#2a1a3a', w: 'butterfly', wC: '#ff9bf0' },
      { n: 'Sunny', hs: 'hime', hc: '#ffb02a', h2: '#ffe680', e: '#ff7a00', o: 'gown', t: '#fff2a0', b: '#ffd23a', a: '#ffffff', sh: '#ffd23a', hat: 'sunflower', hatC: '#ffd23a', w: 'fairy', wC: '#fff6a0', hd: 'wand', hdC: '#ffd23a' },
      { n: 'Primrose', hs: 'long', hc: '#ffffff', h2: '#ff9bd2', e: '#ff4fa8', o: 'gown', t: '#fff0fa', b: '#ffb3d9', a: '#ffd23a', sh: '#ffffff', hat: 'leafCrown', hatC: '#ff9bd2', w: 'butterfly', wC: '#ffd6f0', hd: 'staff', hdC: '#ff9bd2' },
    ],
  },
  {
    id: 'farm', name: 'Harvest Farm', color: '#e8cf6a', alt: '#dcc25c', banner: ['#ff8a3a', '#a83a1a'], text: '#fff6d8',
    cover: ['hay', 'crate', 'corn'], fx: 'wheat', fxColors: ['#ffd85a', '#f0c040', '#fff2a0'], dust: '#f2e0a0',
    girls: [
      { n: 'Hayley', hs: 'braid', hc: '#c96a2a', e: '#3a6a2a', o: 'overalls', t: '#ff5a5a', b: '#3f6fd0', sh: '#6b3f22', hat: 'strawHat', hatC: '#f2d27a', hd: 'pitchfork', hdC: '#8b5a33' },
      { n: 'Moomoo', hs: 'bob', hc: '#ffffff', h2: '#1a1a1a', e: '#6a3b1e', o: 'dress', t: '#ffffff', b: '#1a1a1a', a: '#ff9ec7', sh: '#1a1a1a', hat: 'cowEars', hatC: '#ffffff', nk: 'bell', nkC: '#ffd23a' },
      { n: 'Chickie', hs: 'buns', hc: '#ffe14a', e: '#2a2a2a', o: 'skirt', t: '#fff6a0', b: '#ffd23a', a: '#ff8a2a', sh: '#ff8a2a', hat: 'comb', hatC: '#ff3a3a', hd: 'basket', hdC: '#fff6e0' },
      { n: 'Cinna', hs: 'ponytail', hc: '#8b3a1a', e: '#3a8a3a', o: 'dress', t: '#fff0d8', b: '#e83a3a', a: '#ffffff', sh: '#8b3a1a', hat: 'bandana', hatC: '#e83a3a', hd: 'basket', hdC: '#e83a3a' },
      { n: 'Wooly', hs: 'fluffy', hc: '#fff8ee', e: '#6a5040', o: 'skirt', t: '#fff8ee', b: '#c9a07a', a: '#ffffff', sh: '#5a4030', hat: 'ramHorns', hatC: '#c9a07a', nk: 'bell', nkC: '#ffd23a' },
      { n: 'Cornelia', hs: 'long', hc: '#ffd23a', h2: '#fff6a0', e: '#3aa04a', o: 'overalls', t: '#ffffff', b: '#5fbf4a', sh: '#8b5a33', hat: 'strawHat', hatC: '#f2d27a', hd: 'flower', hdC: '#ffd23a' },
      { n: 'Beatrix', hs: 'sidetail', hc: '#3a2414', e: '#ffaa00', o: 'pants', t: '#fff8e0', b: '#fff8e0', a: '#ffd23a', sh: '#3a2414', hat: 'sunHat', hatC: '#fff8e0', hd: 'honey', hdC: '#ffb020' },
      { n: 'Scarlett', hs: 'curly', hc: '#e8b04a', e: '#ff8a00', o: 'overalls', t: '#e8823a', b: '#6a5aa0', a: '#e8c64a', sh: '#5a3a1a', hat: 'witch', hatC: '#8b6a3a', hd: 'pitchfork', hdC: '#8b5a33' },
      { n: 'Goldie Dawn', hs: 'wavy', hc: '#ffb02a', h2: '#ff5a3a', e: '#ff5a1a', o: 'gown', t: '#fff0c0', b: '#ff8a2a', a: '#ffd23a', sh: '#ff8a2a', hat: 'crown', hatC: '#ffd23a', w: 'angel', wC: '#ffcf7a', hd: 'staff', hdC: '#ffd23a' },
      { n: 'Harvesta', hs: 'hime', hc: '#ffd23a', h2: '#ffffff', e: '#ffd23a', o: 'gown', t: '#fff2c0', b: '#e8b04a', a: '#ffffff', sh: '#ffd23a', hat: 'leafCrown', hatC: '#ffd23a', w: 'angel', wC: '#ffe680', hd: 'staff', hdC: '#ffd23a', glow: true },
    ],
  },
  {
    id: 'lake', name: 'Willow Lake', color: '#8fe0c0', alt: '#80d4b2', banner: ['#4fc8ff', '#1a6aa0'], text: '#ffffff',
    cover: ['willow', 'reeds', 'lilyRock'], fx: 'fireflies', fxColors: ['#e8ff7a', '#b8ff6a', '#fff6a0'], dust: '#c8f0e0',
    girls: [
      { n: 'Reeda', hs: 'bob', hc: '#5a8a3a', e: '#2a8aa0', o: 'skirt', t: '#e0f8ff', b: '#3fa6c0', a: '#ffffff', sh: '#3fa6c0', hat: 'sunHat', hatC: '#ffffff', hd: 'rod', hdC: '#8b5a33' },
      { n: 'Froggy', hs: 'bob', hc: '#7be04a', e: '#1a7a2a', o: 'pants', t: '#ffd23a', b: '#7be04a', a: '#ffd23a', sh: '#ffd23a', hat: 'frogHood', hatC: '#7be04a', hd: 'parasol', hdC: '#7be04a' },
      { n: 'Duckie', hs: 'buns', hc: '#ffe14a', e: '#2a6aa0', o: 'dress', t: '#ffffff', b: '#ffe14a', a: '#ff8a2a', sh: '#ff8a2a', hat: 'bow', hatC: '#ff8a2a' },
      { n: 'Lily', hs: 'long', hc: '#ffb3d9', e: '#3aa06a', o: 'dress', t: '#ffd6ea', b: '#5fbf6a', a: '#ffffff', sh: '#5fbf6a', hat: 'flower', hatC: '#ff8ac0', hd: 'flower', hdC: '#ff8ac0' },
      { n: 'Rowan', hs: 'ponytail', hc: '#3a2414', e: '#3a6aa0', o: 'shorts', t: '#ffffff', b: '#2a4a8a', a: '#e83a3a', sh: '#ffffff', hat: 'beret', hatC: '#ffffff', nk: 'sailor', nkC: '#2a4a8a' },
      { n: 'Libelle', hs: 'pixie', hc: '#3ad0c0', e: '#3a6aff', o: 'skirt', t: '#2a8aa0', b: '#3ad0c0', a: '#ffffff', sh: '#2a8aa0', ew: 'goggles', ewC: '#3ad0c0', w: 'fairy', wC: '#a0f0ff' },
      { n: 'Willowa', hs: 'long', hc: '#8ad04a', h2: '#c8f07a', e: '#5aa03a', o: 'gown', t: '#a0d070', b: '#6a9a3a', a: '#ffffff', sh: '#6a9a3a', hat: 'leafCrown', hatC: '#5fbf4a', hd: 'staff', hdC: '#8b5a33' },
      { n: 'Koi', hs: 'sidetail', hc: '#ff7a3a', h2: '#ffffff', e: '#ff5a1a', o: 'kimono', t: '#ffffff', b: '#ff7a3a', a: '#e83a3a', sh: '#e83a3a', hat: 'flower', hatC: '#ff3a3a', hd: 'parasol', hdC: '#ff7a3a' },
      { n: 'Swanna', hs: 'hime', hc: '#ffffff', h2: '#e0e8ff', e: '#3a5aa0', o: 'gown', t: '#ffffff', b: '#e8f0ff', a: '#ffd23a', sh: '#ffffff', hat: 'tiara', hatC: '#ffd23a', w: 'angel', wC: '#ffffff' },
      { n: 'Selune', hs: 'long', hc: '#c8d8ff', h2: '#ffffff', e: '#6a7aff', o: 'gown', t: '#2a2a6a', b: '#c8d8ff', a: '#ffffff', sh: '#2a2a6a', hat: 'tiara', hatC: '#c8d8ff', w: 'angel', wC: '#c8d8ff', hd: 'lantern', hdC: '#fff6a0', glow: true },
    ],
  },
  {
    id: 'desert', name: 'Desert Canyon', color: '#f2d28c', alt: '#e8c57a', banner: ['#ffb84a', '#a85a1a'], text: '#fff6d8',
    cover: ['cactus', 'mesaRock', 'deadBush'], fx: 'sand', fxColors: ['#f2d28c', '#e8b870', '#fff0c0'], dust: '#f2d8a0',
    girls: [
      { n: 'Dusty', hs: 'ponytail', hc: '#8b5a33', e: '#3a6aa0', o: 'shorts', t: '#ffd8a0', b: '#4a6aa0', a: '#ffffff', sh: '#8b5a33', hat: 'cowboy', hatC: '#c98a4a', nk: 'scarf', nkC: '#e83a3a' },
      { n: 'Prickle', hs: 'buns', hc: '#5fa04a', e: '#2a7a2a', o: 'dress', t: '#7be04a', b: '#5fa04a', a: '#ffffff', sh: '#5fa04a', hat: 'flower', hatC: '#ff5fa8' },
      { n: 'Fennie', hs: 'bob', hc: '#f2c88a', e: '#ffaa00', o: 'skirt', t: '#ffffff', b: '#f2c88a', a: '#e8823a', sh: '#e8823a', hat: 'foxEars', hatC: '#f2c88a', tl: 'fox', tlC: '#f2c88a' },
      { n: 'Scorpia', hs: 'sidetail', hc: '#2a1a1a', h2: '#e83a3a', e: '#e83a3a', o: 'pants', t: '#2a1a1a', b: '#8a2a2a', a: '#e83a3a', sh: '#2a1a1a', hat: 'bandana', hatC: '#2a1a1a', tl: 'devil', tlC: '#8a2a2a' },
      { n: 'Sahara', hs: 'long', hc: '#2a1a10', e: '#2a8a8a', o: 'gown', t: '#f2e0b0', b: '#e8c070', a: '#ffd23a', sh: '#e8c070', hat: 'veil', hatC: '#fff2d0', nk: 'pendant', nkC: '#3ad0c0' },
      { n: 'Oasia', hs: 'wavy', hc: '#3ad0c0', e: '#2aa0a0', o: 'dress', t: '#ffffff', b: '#3ad0c0', a: '#ffd23a', sh: '#ffffff', hat: 'flower', hatC: '#ffffff', hd: 'parasol', hdC: '#ffe14a' },
      { n: 'Indie', hs: 'braid', hc: '#6a3a1a', e: '#4a8a3a', o: 'shorts', t: '#e8d8b0', b: '#8b6a3a', a: '#5a3a1a', sh: '#5a3a1a', hat: 'sunHat', hatC: '#c8a870', ew: 'goggles', ewC: '#8b6a3a', hd: 'book', hdC: '#c8a870' },
      { n: 'Mirage', hs: 'hime', hc: '#b07cff', h2: '#ff9bf0', e: '#ff7ad9', o: 'gown', t: '#ffe0f8', b: '#b07cff', a: '#ffd23a', sh: '#b07cff', hat: 'veil', hatC: '#ff9bf0', nk: 'pendant', nkC: '#ffd23a' },
      { n: 'Solara', hs: 'wavy', hc: '#ffcc33', h2: '#ffffff', e: '#ff8a00', o: 'gown', t: '#ffffff', b: '#ffcc33', a: '#3a5aa0', sh: '#ffd23a', hat: 'crown', hatC: '#ffd23a', nk: 'collar', nkC: '#ffd23a', w: 'angel', wC: '#ffd23a', hd: 'staff', hdC: '#ffd23a' },
      { n: 'Nefira', hs: 'hime', hc: '#1a1a2a', h2: '#ffd23a', e: '#3ad0ff', o: 'gown', t: '#ffffff', b: '#ffd23a', a: '#3a5aff', sh: '#ffd23a', hat: 'pharaoh', hatC: '#ffd23a', nk: 'collar', nkC: '#3a5aff', hd: 'staff', hdC: '#ffd23a', glow: true },
    ],
  },
  {
    id: 'snow', name: 'Frost Peaks', color: '#f4fbff', alt: '#e2f0fa', banner: ['#9fe0ff', '#3a7ad0'], text: '#ffffff',
    cover: ['pine', 'snowMound', 'iceBlock'], fx: 'snow', fxColors: ['#ffffff', '#e8f6ff', '#c8ecff'], dust: '#ffffff',
    girls: [
      { n: 'Flurry', hs: 'bob', hc: '#ffffff', h2: '#bfeaff', e: '#4fa8ff', o: 'pants', t: '#ff9ec7', b: '#ffffff', a: '#ffffff', sh: '#ff9ec7', hat: 'earmuffs', hatC: '#ff9ec7', nk: 'scarf', nkC: '#ff5f8a' },
      { n: 'Skye', hs: 'ponytail', hc: '#ffd23a', e: '#3a6aff', o: 'pants', t: '#3a8aff', b: '#2a2a4a', a: '#ffffff', sh: '#2a2a4a', hat: 'beanie', hatC: '#ff5a3a', ew: 'goggles', ewC: '#ff8a2a' },
      { n: 'Pengi', hs: 'bob', hc: '#1a1a2a', e: '#3a3a6a', o: 'dress', t: '#ffffff', b: '#1a1a2a', a: '#ffaa00', sh: '#ffaa00', hat: 'beanie', hatC: '#1a1a2a', nk: 'scarf', nkC: '#ffd23a' },
      { n: 'Glissa', hs: 'long', hc: '#c8a0ff', e: '#7a4bff', o: 'skirt', t: '#e6e0ff', b: '#b8a0ff', a: '#ffffff', sh: '#ffffff', hat: 'earmuffs', hatC: '#ffffff' },
      { n: 'Yetina', hs: 'fluffy', hc: '#e8f4ff', e: '#3ab0ff', o: 'pants', t: '#e8f4ff', b: '#c8dcf0', a: '#ffffff', sh: '#c8dcf0', hat: 'bearHood', hatC: '#f0f8ff' },
      { n: 'Polara', hs: 'hime', hc: '#ffffff', h2: '#d8f0ff', e: '#4ad0ff', o: 'dress', t: '#ffffff', b: '#bfe6ff', a: '#ffffff', sh: '#bfe6ff', hat: 'foxEars', hatC: '#ffffff', tl: 'fox', tlC: '#ffffff' },
      { n: 'Crystelle', hs: 'twintails', hc: '#bfeaff', h2: '#ffffff', e: '#3ab0ff', o: 'dress', t: '#e6f7ff', b: '#7fd0ff', a: '#ffffff', sh: '#ffffff', w: 'fairy', wC: '#bfeaff', hd: 'wand', hdC: '#bfeaff' },
      { n: 'Borea', hs: 'wavy', hc: '#5affc8', h2: '#b07cff', e: '#5affc8', o: 'gown', t: '#2a3a6a', b: '#5affc8', a: '#b07cff', sh: '#2a3a6a', hat: 'starClip', hatC: '#b07cff', w: 'fairy', wC: '#8affe0' },
      { n: 'Glacia', hs: 'hime', hc: '#e0f6ff', h2: '#7fd0ff', e: '#4fc8ff', o: 'gown', t: '#e6f7ff', b: '#7fd0ff', a: '#ffffff', sh: '#ffffff', hat: 'crown', hatC: '#bfeaff', nk: 'pendant', nkC: '#4fc8ff', w: 'crystal', wC: '#bfeaff', hd: 'staff', hdC: '#bfeaff' },
      { n: 'Niveria', hs: 'long', hc: '#ffffff', h2: '#a0e8ff', e: '#a0e8ff', o: 'gown', t: '#ffffff', b: '#e0f6ff', a: '#a0e8ff', sh: '#ffffff', hat: 'tiara', hatC: '#a0e8ff', w: 'crystal', wC: '#e0f8ff', hd: 'staff', hdC: '#a0e8ff', glow: true },
    ],
  },
  {
    id: 'autumn', name: 'Autumn Grove', color: '#f0a24a', alt: '#e6923c', banner: ['#ff8a3a', '#8a2a1a'], text: '#fff0d8',
    cover: ['autumnTree', 'pumpkin', 'redBush'], fx: 'leaves', fxColors: ['#ff8a2a', '#e8502a', '#ffc23a', '#c8401a'], dust: '#f0c890',
    girls: [
      { n: 'Maple', hs: 'bob', hc: '#c84a1a', e: '#6a3b1e', o: 'skirt', t: '#ffe0b0', b: '#c84a1a', a: '#ffffff', sh: '#6a3b1e', hat: 'beret', hatC: '#8a2a1a', nk: 'scarf', nkC: '#e8823a' },
      { n: 'Nutmeg', hs: 'buns', hc: '#8b5a33', e: '#5a3a1a', o: 'dress', t: '#e8c890', b: '#8b5a33', a: '#ffffff', sh: '#5a3a1a', hat: 'beret', hatC: '#6a3a1a', tl: 'squirrel', tlC: '#b8743a', hd: 'basket', hdC: '#c8a060' },
      { n: 'Patchy', hs: 'curly', hc: '#ff8a2a', e: '#3a8a2a', o: 'overalls', t: '#3a2a2a', b: '#ff8a2a', sh: '#3a2a2a', hat: 'witch', hatC: '#2a2a3a', hd: 'lantern', hdC: '#ff8a2a' },
      { n: 'Shroomi', hs: 'bob', hc: '#fff0e0', e: '#e83a3a', o: 'dress', t: '#ffffff', b: '#e83a3a', a: '#ffffff', sh: '#e83a3a', hat: 'mushroom', hatC: '#e83a3a' },
      { n: 'Owlivia', hs: 'wavy', hc: '#8b6a4a', h2: '#f0e0c0', e: '#ffaa00', o: 'skirt', t: '#f0e0c0', b: '#6a4a2a', a: '#ffffff', sh: '#6a4a2a', hat: 'catEars', hatC: '#8b6a4a', ew: 'glasses', ewC: '#3a2414', hd: 'book', hdC: '#8a2a1a' },
      { n: 'Cider', hs: 'ponytail', hc: '#e8b04a', e: '#8a3a1a', o: 'pants', t: '#c84a1a', b: '#3a3a5a', a: '#ffffff', sh: '#5a3a1a', hat: 'beanie', hatC: '#e8823a', nk: 'scarf', nkC: '#ffd23a' },
      { n: 'Hazel', hs: 'long', hc: '#6a2a8a', h2: '#ff8a2a', e: '#ff8a2a', o: 'dress', t: '#3a2a4a', b: '#6a2a8a', a: '#ff8a2a', sh: '#3a2a4a', hat: 'witch', hatC: '#3a2a4a', hd: 'broom', hdC: '#8b5a33' },
      { n: 'Kohana', hs: 'hime', hc: '#ff9a3a', h2: '#ffffff', e: '#ffcc33', o: 'kimono', t: '#ffffff', b: '#e83a3a', a: '#ffd23a', sh: '#e83a3a', hat: 'foxEars', hatC: '#ff9a3a', tl: 'kitsune', tlC: '#ff9a3a' },
      { n: 'Mabon', hs: 'wavy', hc: '#e8823a', h2: '#ffd23a', e: '#ffd23a', o: 'gown', t: '#6a2a1a', b: '#c84a1a', a: '#ffd23a', sh: '#6a2a1a', hat: 'leafCrown', hatC: '#e8823a', w: 'butterfly', wC: '#ff8a2a', hd: 'staff', hdC: '#8b5a33' },
      { n: 'Autumna', hs: 'long', hc: '#ff5a1a', h2: '#ffd23a', e: '#ffcc33', o: 'gown', t: '#ffe0b0', b: '#ff7a2a', a: '#ffd23a', sh: '#ff7a2a', hat: 'crown', hatC: '#ffd23a', w: 'butterfly', wC: '#ffaa33', glow: true },
    ],
  },
  {
    id: 'crystal', name: 'Crystal Falls', color: '#9fe8ff', alt: '#8adcf5', banner: ['#7ae8ff', '#3a5ad0'], text: '#ffffff',
    cover: ['crystals', 'blueRock', 'crystals'], fx: 'gems', fxColors: ['#7ae8ff', '#c8a0ff', '#ff9bd2', '#ffffff'], dust: '#d8f6ff',
    girls: [
      { n: 'Quartzy', hs: 'bob', hc: '#ffc8e8', e: '#ff5fa8', o: 'skirt', t: '#ffffff', b: '#ffc8e8', a: '#ff9bd2', sh: '#ff9bd2', hat: 'starClip', hatC: '#ff9bd2', hd: 'gem', hdC: '#ff9bd2' },
      { n: 'Pickette', hs: 'ponytail', hc: '#3a2a1a', e: '#3ab0ff', o: 'overalls', t: '#e8e8f0', b: '#3a5a8a', sh: '#3a2a1a', hat: 'minerHat', hatC: '#ffd23a', hd: 'lantern', hdC: '#7ae8ff' },
      { n: 'Amethia', hs: 'wavy', hc: '#9a5aff', e: '#b07cff', o: 'dress', t: '#e0d0ff', b: '#9a5aff', a: '#ffffff', sh: '#9a5aff', hat: 'tiara', hatC: '#c8a0ff', nk: 'pendant', nkC: '#9a5aff' },
      { n: 'Sapphira', hs: 'hime', hc: '#2a5aff', e: '#3a8aff', o: 'gown', t: '#e0e8ff', b: '#2a5aff', a: '#ffffff', sh: '#2a5aff', hat: 'tiara', hatC: '#3a8aff' },
      { n: 'Emeralda', hs: 'sidetail', hc: '#2ad06a', e: '#2ad06a', o: 'dress', t: '#e0ffe8', b: '#1aa04a', a: '#ffffff', sh: '#1aa04a', hat: 'starClip', hatC: '#2ad06a', nk: 'pendant', nkC: '#2ad06a' },
      { n: 'Nymphia', hs: 'long', hc: '#5ae0ff', h2: '#ffffff', e: '#3ab0ff', o: 'gown', t: '#c8f4ff', b: '#5ae0ff', a: '#ffffff', sh: '#5ae0ff', w: 'fairy', wC: '#a0f0ff', hd: 'shell', hdC: '#ffd6ea' },
      { n: 'Prisma', hs: 'twintails', hc: '#ff9bf0', h2: '#7ae0ff', e: '#b07cff', o: 'dress', t: '#ffffff', b: '#c8a0ff', a: '#7ae0ff', sh: '#ffffff', w: 'butterfly', wC: '#a0f0ff', hd: 'wand', hdC: '#ff9bf0' },
      { n: 'Opaline', hs: 'curly', hc: '#fff0ff', h2: '#a0f0ff', e: '#ff9bd2', o: 'gown', t: '#ffffff', b: '#e0f0ff', a: '#ff9bd2', sh: '#ffffff', hat: 'crown', hatC: '#a0f0ff', w: 'crystal', wC: '#e0f8ff' },
      { n: 'Drakaria', hs: 'long', hc: '#3ad0ff', h2: '#e0f8ff', e: '#ff5fd2', o: 'armor', t: '#2a5a8a', b: '#3ad0ff', a: '#e0f8ff', sh: '#2a5a8a', hat: 'horns', hatC: '#e0f8ff', w: 'dragon', wC: '#3ad0ff', tl: 'dragon', tlC: '#3ad0ff' },
      { n: 'Adamantia', hs: 'hime', hc: '#ffffff', h2: '#c8f4ff', e: '#3ad0ff', o: 'gown', t: '#ffffff', b: '#c8f4ff', a: '#3ad0ff', sh: '#ffffff', hat: 'crown', hatC: '#e0f8ff', w: 'crystal', wC: '#ffffff', hd: 'staff', hdC: '#c8f4ff', glow: true },
    ],
  },
  {
    id: 'beach', name: 'Sunset Beach', color: '#ffd2a0', alt: '#f8c28c', banner: ['#ff7a5a', '#a02a6a'], text: '#fff0d8',
    cover: ['palm', 'umbrella', 'sandcastle'], fx: 'sunset', fxColors: ['#ffb05a', '#ff7a8a', '#ffe08a'], dust: '#ffe0b8',
    girls: [
      { n: 'Shelly', hs: 'ponytail', hc: '#ffd23a', e: '#3ab0ff', o: 'shorts', t: '#ff8ac0', b: '#3ab0ff', a: '#ffffff', sh: '#ff8ac0', hat: 'sunHat', hatC: '#fff2c8', hd: 'shell', hdC: '#ffd6ea' },
      { n: 'Coco', hs: 'buns', hc: '#6a3a1a', e: '#3a8a3a', o: 'dress', t: '#ffffff', b: '#3ad0a0', a: '#ffffff', sh: '#3ad0a0', nk: 'lei', nkC: '#ff5fa8', hd: 'icecream', hdC: '#ff9ec7' },
      { n: 'Wavey', hs: 'long', hc: '#ffd23a', h2: '#ffffff', e: '#3a8aff', o: 'shorts', t: '#3ad0ff', b: '#ff8a2a', a: '#ffffff', sh: '#ffffff', ew: 'sunglasses', ewC: '#ff5a3a', hd: 'surfboard', hdC: '#ff5a3a' },
      { n: 'Flamina', hs: 'wavy', hc: '#ff8ac0', e: '#ff5fa8', o: 'dress', t: '#ffb3d9', b: '#ff8ac0', a: '#ffffff', sh: '#ff8ac0', hat: 'flower', hatC: '#ffffff' },
      { n: 'Marina', hs: 'ponytail', hc: '#e8823a', e: '#3a6aa0', o: 'shorts', t: '#e83a3a', b: '#e83a3a', a: '#ffffff', sh: '#ffffff', ew: 'sunglasses', ewC: '#1a1a1a', nk: 'pendant', nkC: '#ffd23a' },
      { n: 'Lani', hs: 'long', hc: '#2a1a10', e: '#3a8a3a', o: 'skirt', t: '#ff5a3a', b: '#7be04a', a: '#ffd23a', sh: '#8b5a33', hat: 'flower', hatC: '#ff3a6a', nk: 'lei', nkC: '#ffd23a', hd: 'flower', hdC: '#ff3a6a' },
      { n: 'Sora', hs: 'sidetail', hc: '#ff5a3a', e: '#3ab0ff', o: 'shorts', t: '#ffffff', b: '#3a5aff', a: '#ff5a3a', sh: '#ffffff', hat: 'bandana', hatC: '#ff5a3a', hd: 'ball', hdC: '#ffffff' },
      { n: 'Dusk', hs: 'wavy', hc: '#ff7a5a', h2: '#b07cff', e: '#ff5fa8', o: 'gown', t: '#ffb08a', b: '#ff7a5a', a: '#b07cff', sh: '#ff7a5a', hat: 'flower', hatC: '#b07cff', hd: 'harp', hdC: '#ffd23a' },
      { n: 'Solstice', hs: 'hime', hc: '#ffaa33', h2: '#ff5a5a', e: '#ffcc33', o: 'gown', t: '#fff0c0', b: '#ff8a2a', a: '#ffd23a', sh: '#ff8a2a', hat: 'halo', hatC: '#ffaa33', w: 'fire', wC: '#ffaa33' },
      { n: 'Helia', hs: 'long', hc: '#ffcc66', h2: '#ff6a8a', e: '#ff6a3a', o: 'gown', t: '#ffffff', b: '#ffaa66', a: '#ff6a8a', sh: '#ffffff', hat: 'crown', hatC: '#ffcc66', w: 'seraph', wC: '#ffcc88', hd: 'staff', hdC: '#ffcc66', glow: true },
    ],
  },
  {
    id: 'reef', name: 'Coral Reef', color: '#3fc4d8', alt: '#34b6cc', banner: ['#3ad0ff', '#1a3a8a'], text: '#ffffff',
    cover: ['coral', 'seaweed', 'coral'], fx: 'bubbles', fxColors: ['#c8f8ff', '#ffffff', '#a0e8ff'], dust: '#c8f8ff',
    girls: [
      { n: 'Bubbly', hs: 'bob', hc: '#7fd8ff', e: '#3a8aff', o: 'mermaid', t: '#ff8ac0', b: '#3ad0c0', a: '#ffffff', sh: '#3ad0c0', hat: 'shell', hatC: '#ffb3d9' },
      { n: 'Starla', hs: 'buns', hc: '#ff8a5a', e: '#ff5a3a', o: 'dress', t: '#ffd0b0', b: '#ff8a5a', a: '#ffffff', sh: '#ff8a5a', hat: 'starClip', hatC: '#ff8a5a' },
      { n: 'Pearl', hs: 'long', hc: '#fff6ff', h2: '#e0d0ff', e: '#b07cff', o: 'mermaid', t: '#e0d0ff', b: '#c8a0ff', a: '#ffffff', sh: '#c8a0ff', nk: 'pearls', nkC: '#ffffff', hd: 'shell', hdC: '#ffffff' },
      { n: 'Jelli', hs: 'long', hc: '#ffb3f0', h2: '#c8a0ff', e: '#ff5fd2', o: 'dress', t: '#ffd0f8', b: '#c8a0ff', a: '#ffffff', sh: '#c8a0ff', hat: 'mushroom', hatC: '#ffb3f0' },
      { n: 'Octavia', hs: 'wavy', hc: '#b04aff', e: '#ff5fd2', o: 'dress', t: '#e0b0ff', b: '#8a2ad0', a: '#ffffff', sh: '#8a2ad0', hat: 'bow', hatC: '#ff5fd2', hd: 'book', hdC: '#3ad0c0' },
      { n: 'Sharky', hs: 'bob', hc: '#3a6a9a', e: '#3a8aff', o: 'pants', t: '#5a8aba', b: '#e8f0ff', a: '#ffffff', sh: '#3a6a9a', hat: 'sharkHood', hatC: '#5a8aba', tl: 'dragon', tlC: '#5a8aba' },
      { n: 'Hippa', hs: 'ponytail', hc: '#ffd23a', e: '#ff8a2a', o: 'mermaid', t: '#ffaa33', b: '#ffd23a', a: '#ffffff', sh: '#ffd23a', hat: 'starClip', hatC: '#ff8a2a' },
      { n: 'Coralia', hs: 'hime', hc: '#ff6f61', h2: '#ffd0c0', e: '#2ad1c9', o: 'mermaid', t: '#ff8a7a', b: '#2ad1c9', a: '#ffd23a', sh: '#2ad1c9', hat: 'crown', hatC: '#ff6f61', hd: 'trident', hdC: '#ffd23a' },
      { n: 'Lumina', hs: 'long', hc: '#2a2a5a', h2: '#3affff', e: '#3affff', o: 'gown', t: '#1a1a3a', b: '#2a2a5a', a: '#3affff', sh: '#1a1a3a', hat: 'lure', hatC: '#3affff', hd: 'lantern', hdC: '#3affff' },
      { n: 'Thalassa', hs: 'long', hc: '#3affd0', h2: '#ffffff', e: '#3affd0', o: 'mermaid', t: '#e0fff8', b: '#2ad1c9', a: '#ffd23a', sh: '#2ad1c9', hat: 'crown', hatC: '#ffd23a', hd: 'trident', hdC: '#ffd23a', glow: true },
    ],
  },
  {
    id: 'heaven', name: 'Cloud Heaven', color: '#fffaf0', alt: '#f3ecdc', banner: ['#fff0b0', '#c89a3a'], text: '#ffffff',
    cover: ['cloud', 'pillar', 'cloud'], fx: 'feathers', fxColors: ['#ffffff', '#fff6d8', '#ffe8a0'], dust: '#ffffff',
    girls: [
      { n: 'Cherie', hs: 'curly', hc: '#ffe680', e: '#3a8aff', o: 'dress', t: '#ffffff', b: '#ffffff', a: '#ffd23a', sh: '#ffffff', hat: 'halo', hatC: '#ffe680', w: 'angel', wC: '#ffffff', hd: 'harp', hdC: '#ffd23a' },
      { n: 'Nimbus', hs: 'fluffy', hc: '#ffffff', h2: '#c8e0ff', e: '#6aa0ff', o: 'dress', t: '#f0f6ff', b: '#c8e0ff', a: '#ffffff', sh: '#ffffff', hat: 'halo', hatC: '#ffe680', w: 'angel', wC: '#ffffff' },
      { n: 'Lyra', hs: 'long', hc: '#ffd8a0', e: '#3a8aff', o: 'gown', t: '#ffffff', b: '#ffe6b0', a: '#ffd23a', sh: '#ffffff', hat: 'leafCrown', hatC: '#ffd23a', hd: 'harp', hdC: '#ffd23a' },
      { n: 'Stella', hs: 'twintails', hc: '#fff6c0', h2: '#ffd23a', e: '#ffcc33', o: 'dress', t: '#ffffff', b: '#ffe680', a: '#ffd23a', sh: '#ffe680', hat: 'starClip', hatC: '#ffd23a', w: 'fairy', wC: '#fff6c0', hd: 'wand', hdC: '#ffd23a' },
      { n: 'Iris', hs: 'wavy', hc: '#ff8ac0', h2: '#7ae0ff', e: '#b07cff', o: 'dress', t: '#ffffff', b: '#b8f0ff', a: '#ff8ac0', sh: '#ffffff', hat: 'halo', hatC: '#ffe680', w: 'butterfly', wC: '#ffd6f0' },
      { n: 'Brynja', hs: 'braid', hc: '#ffe680', e: '#3a8aff', o: 'armor', t: '#e8e8f0', b: '#3a5aa0', a: '#ffd23a', sh: '#e8e8f0', hat: 'wingHelm', hatC: '#e8e8f0', w: 'angel', wC: '#ffffff', hd: 'sword', hdC: '#e8e8f0' },
      { n: 'Eos', hs: 'long', hc: '#ffb08a', h2: '#ffe680', e: '#ff8a5a', o: 'gown', t: '#fff0e0', b: '#ffb08a', a: '#ffd23a', sh: '#ffffff', hat: 'halo', hatC: '#ffcc66', w: 'angel', wC: '#ffe6d0' },
      { n: 'Seraphina', hs: 'hime', hc: '#ffffff', h2: '#ffe680', e: '#ffcc33', o: 'gown', t: '#ffffff', b: '#fff6d8', a: '#ffd23a', sh: '#ffffff', hat: 'halo', hatC: '#ffe680', w: 'seraph', wC: '#ffffff', hd: 'staff', hdC: '#ffd23a' },
      { n: 'Aurelia', hs: 'long', hc: '#ffd23a', h2: '#ffffff', e: '#ffd23a', o: 'gown', t: '#ffffff', b: '#ffe680', a: '#ffd23a', sh: '#ffffff', hat: 'crown', hatC: '#ffd23a', w: 'seraph', wC: '#fff6c0', hd: 'staff', hdC: '#ffd23a' },
      { n: 'Celesta', hs: 'long', hc: '#ffffff', h2: '#ffd6f0', e: '#ff9bf0', o: 'gown', t: '#ffffff', b: '#fff0fa', a: '#ffd23a', sh: '#ffffff', hat: 'crown', hatC: '#ffe680', w: 'seraph', wC: '#fff0ff', hd: 'staff', hdC: '#ffe680', glow: true },
    ],
  },
  {
    id: 'lava', name: 'Lava Inferno', color: '#5a2a24', alt: '#4a201c', banner: ['#ff5a1a', '#5a0a0a'], text: '#ffe0a0',
    cover: ['obsidian', 'charTree', 'lavaRock'], fx: 'embers', fxColors: ['#ff7a1a', '#ffcc33', '#ff3a1a'], dust: '#5a4a48',
    girls: [
      { n: 'Impy', hs: 'bob', hc: '#e83a3a', e: '#ffcc33', o: 'skirt', t: '#2a1a1a', b: '#e83a3a', a: '#ffcc33', sh: '#2a1a1a', hat: 'horns', hatC: '#2a1a1a', tl: 'devil', tlC: '#e83a3a' },
      { n: 'Cinder', hs: 'pixie', hc: '#3a3a3a', h2: '#ff5a1a', e: '#ff5a1a', o: 'pants', t: '#3a2a2a', b: '#2a2a2a', a: '#ff5a1a', sh: '#2a2a2a', hd: 'torch', hdC: '#ff7a1a' },
      { n: 'Blaze', hs: 'ponytail', hc: '#ff5a1a', h2: '#ffd23a', e: '#ffd23a', o: 'shorts', t: '#ff8a2a', b: '#2a1a1a', a: '#ffd23a', sh: '#2a1a1a', hat: 'bandana', hatC: '#2a1a1a', hd: 'torch', hdC: '#ff8a2a' },
      { n: 'Cerbie', hs: 'wavy', hc: '#2a1a1a', h2: '#e83a3a', e: '#e83a3a', o: 'skirt', t: '#2a1a1a', b: '#5a1a1a', a: '#e83a3a', sh: '#2a1a1a', hat: 'dogEars', hatC: '#2a1a1a', tl: 'fox', tlC: '#2a1a1a', nk: 'choker', nkC: '#e83a3a' },
      { n: 'Basalta', hs: 'curly', hc: '#ff7a1a', h2: '#ffd23a', e: '#ffcc33', o: 'armor', t: '#3a2a2a', b: '#4a2020', a: '#ff5a1a', sh: '#3a2a2a', hat: 'oniHorns', hatC: '#ffd23a' },
      { n: 'Morwen', hs: 'long', hc: '#8a8a9a', e: '#ff5a1a', o: 'dress', t: '#2a2a2a', b: '#5a5a6a', a: '#ff5a1a', sh: '#2a2a2a', hat: 'witch', hatC: '#2a2a2a', hd: 'broom', hdC: '#5a3a1a' },
      { n: 'Akane', hs: 'hime', hc: '#e83a3a', e: '#ffd23a', o: 'kimono', t: '#2a1a1a', b: '#e83a3a', a: '#ffd23a', sh: '#2a1a1a', hat: 'oniHorns', hatC: '#ffe0a0', hd: 'sword', hdC: '#e8e8f0' },
      { n: 'Pyra', hs: 'wavy', hc: '#ff5a1a', h2: '#ffd23a', e: '#ffd23a', o: 'gown', t: '#ffd23a', b: '#ff5a1a', a: '#ff2a1a', sh: '#ff5a1a', hat: 'crown', hatC: '#ffaa00', w: 'fire', wC: '#ff7a1a' },
      { n: 'Infernia', hs: 'long', hc: '#2a0a1a', h2: '#ff2a4a', e: '#ff2a4a', o: 'gown', t: '#2a0a1a', b: '#8a1020', a: '#ffd23a', sh: '#2a0a1a', hat: 'horns', hatC: '#ffd23a', w: 'bat', wC: '#5a1020', tl: 'devil', tlC: '#8a1020', hd: 'staff', hdC: '#ff2a4a' },
      { n: 'Ignis', hs: 'hime', hc: '#ffcc33', h2: '#ff2a1a', e: '#ffffff', o: 'armor', t: '#2a1a1a', b: '#ff5a1a', a: '#ffd23a', sh: '#2a1a1a', hat: 'crown', hatC: '#ff5a1a', w: 'fire', wC: '#ffaa33', tl: 'dragon', tlC: '#ff5a1a', hd: 'sword', hdC: '#ff7a1a', glow: true },
    ],
  },
  {
    id: 'cosmic', name: 'Cosmic Rift', color: '#3a2a6a', alt: '#30225c', banner: ['#b04aff', '#1a0a4a'], text: '#e0f8ff',
    cover: ['alienCrystal', 'alienPlant', 'meteor'], fx: 'stars', fxColors: ['#ffffff', '#b07cff', '#3affff', '#ff9bf0'], dust: '#8a7aff',
    girls: [
      { n: 'Astra', hs: 'bob', hc: '#ff9ec7', e: '#3a8aff', o: 'suit', t: '#ffffff', b: '#ffffff', a: '#ff5a3a', sh: '#ff5a3a', hat: 'helmet', hatC: '#bfeaff' },
      { n: 'Zeeble', hs: 'bob', hc: '#3aff8a', sk: '#b8ffb0', e: '#1a1a2a', o: 'dress', t: '#3a2a8a', b: '#3aff8a', a: '#ffffff', sh: '#3a2a8a', hat: 'antenna', hatC: '#3aff8a' },
      { n: 'Lunette', hs: 'twintails', hc: '#ffffff', h2: '#ffe680', e: '#ff5fa8', o: 'dress', t: '#e0e0ff', b: '#ffffff', a: '#ffe680', sh: '#ffffff', hat: 'bunnyEars', hatC: '#ffffff', tl: 'bunny', tlC: '#ffffff', hd: 'icecream', hdC: '#ffe680' },
      { n: 'Vega', hs: 'ponytail', hc: '#3a2a8a', e: '#3affff', o: 'suit', t: '#2a2a4a', b: '#3a5aff', a: '#3affff', sh: '#2a2a4a', hat: 'visor', hatC: '#3affff' },
      { n: 'Nebby', hs: 'wavy', hc: '#b04aff', h2: '#3affff', e: '#ff5fd2', o: 'gown', t: '#2a1a5a', b: '#b04aff', a: '#3affff', sh: '#2a1a5a', hat: 'starClip', hatC: '#3affff', w: 'fairy', wC: '#b04aff' },
      { n: 'Cyra', hs: 'bob', hc: '#e0e8ff', h2: '#3affff', e: '#3affff', o: 'suit', t: '#e0e8ff', b: '#3a3a5a', a: '#3affff', sh: '#3a3a5a', hat: 'headphones', hatC: '#3a3a5a' },
      { n: 'Cometta', hs: 'sidetail', hc: '#7ae0ff', h2: '#ffffff', e: '#3a8aff', o: 'dress', t: '#ffffff', b: '#3a8aff', a: '#ffd23a', sh: '#3a8aff', w: 'fairy', wC: '#7ae0ff', hd: 'wand', hdC: '#ffd23a' },
      { n: 'Astraea', hs: 'long', hc: '#2a1a5a', h2: '#ff5fd2', e: '#ffd23a', o: 'dress', t: '#1a1a3a', b: '#4a2a8a', a: '#ffd23a', sh: '#1a1a3a', hat: 'witch', hatC: '#2a1a5a', hd: 'staff', hdC: '#ffd23a' },
      { n: 'Nyx', hs: 'hime', hc: '#1a1a2a', h2: '#b04aff', e: '#b04aff', o: 'gown', t: '#0a0a1a', b: '#2a1a3a', a: '#b04aff', sh: '#0a0a1a', hat: 'crown', hatC: '#b04aff', w: 'bat', wC: '#2a1a3a' },
      { n: 'Omnia', hs: 'long', hc: '#ffffff', h2: '#b04aff', e: '#ff5fd2', o: 'gown', t: '#0a0a1a', b: '#3a1a6a', a: '#3affff', sh: '#0a0a1a', hat: 'halo', hatC: '#b04aff', w: 'seraph', wC: '#b04aff', hd: 'staff', hdC: '#3affff', glow: true },
    ],
  },
]

const SKINS = ['#ffe0c8', '#f6caa0', '#ffd9b8', '#e9b98f', '#c98e64', '#fbe3d0', '#f2c49a', '#a8714a']
const niceRound = (v) => {
  if (v < 10) return Math.round(v)
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1)
  return Math.round(v / p) * p
}
// Every girl, flattened: { id, name, area, slot, rarity, odds, income, look }.
// A girl's look from her short keys (see AREAS above); `place` = { fx, fxColors } for her particles.
const lookOf = (g, skinIdx, place) => ({
  skin: g.sk ?? SKINS[skinIdx % SKINS.length],
  hair: g.hc,
  hair2: g.h2 ?? null,
  hairStyle: g.hs,
  eyes: g.e,
  outfit: g.o,
  top: g.t,
  bottom: g.b,
  accent: g.a ?? '#ffffff',
  shoes: g.sh ?? g.b,
  hat: g.hat ?? null,
  hatColor: g.hatC ?? g.a ?? '#ffffff',
  eyewear: g.ew ?? null,
  eyewearColor: g.ewC ?? '#202028',
  neck: g.nk ?? null,
  neckColor: g.nkC ?? g.a ?? '#ffffff',
  wings: g.w ?? null,
  wingColor: g.wC ?? '#ffffff',
  tail: g.tl ?? null,
  tailColor: g.tlC ?? g.hc,
  held: g.hd ?? null,
  heldColor: g.hdC ?? '#ffffff',
  glow: !!g.glow,
  fx: place.fx,
  fxColors: place.fxColors,
})
// Every lane girl, flattened (see above).
export const BADDIES = AREAS.flatMap((area, ai) => {
  const shift = Math.floor(ai / 3)
  return area.girls.map((g, slot) => ({
    id: `${area.id}_${g.n.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    name: g.n,
    area: ai,
    slot,
    rarity: Math.min(RARITIES.length - 1, RARITY_SLOTS[slot] + shift),
    odds: niceRound(SLOT_ODDS[slot] * (1 + ai * 0.35)),
    income: niceRound(AREA_INCOME(ai) * SLOT_INCOME[slot]),
    look: lookOf(g, ai * 7 + slot * 3, area),
  }))
})
// The lane areas as z ranges: twelve equal stretches from the lane mouth to its far end.
{
  const L = HUB.lane
  const len = (L.end + 2 - L.start) / AREAS.length
  AREAS.forEach((a, i) => {
    HUB.zones.push({ ...a, index: i, from: L.start + i * len, to: i === AREAS.length - 1 ? L.end - 30 : L.start + (i + 1) * len })
  })
}

// Ids from the first version of the game (one flat list of 18) -> the girl they became.
export const LEGACY_IDS = {
  pip: 'meadow_daisy', momo: 'meadow_clover', taffy: 'meadow_bunnie', juniper: 'meadow_ladybell', kiki: 'farm_cinna', bolt: 'meadow_honey',
  sable: 'lake_rowan', coral: 'beach_flamina', nova: 'lake_libelle', vexa: 'lava_cerbie', mirage: 'desert_mirage', rune: 'snow_borea',
  solara: 'desert_solara', onyx: 'cosmic_nyx', frostine: 'snow_glacia', cosmia: 'cosmic_nebby', emberqueen: 'lava_pyra', glitchling: 'cosmic_cyra',
}

// Size steps a fuse climbs: three of one size make one of the next.
export const SIZES = [
  { name: '', scale: 1, mult: 1 },
  { name: 'BIG', scale: 1.4, mult: 4 },
  { name: 'HUGE', scale: 2, mult: 20 },
  { name: 'GIANT', scale: 2.5, mult: 100 },
  { name: 'TITAN', scale: 3, mult: 500 },
]

// Variants: a rare shiny version of any girl, rolled on every catch (`v` on a pen / hotbar
// entry). chance = 1 in N before boosts (the featured-area event multiplies it). Fusing needs
// three of the same girl, size AND variant; the result keeps the variant.
export const VARIANTS = [
  { name: '', mult: 1, chance: 0 },
  { name: 'GOLD', mult: 2, chance: 20, color: '#ffd23a', glow: '#ffe680' },
  { name: 'DIAMOND', mult: 5, chance: 200, color: '#7ae8ff', glow: '#c8f6ff' },
  { name: 'RAINBOW', mult: 15, chance: 2000, color: '#ff7af2', glow: '#ffffff', rainbow: true },
]

// Live events (game/events.js). All of them run on the UTC clock, so every player sees the same
// ones at the same time without a server. Money / Wins / earned tickets only: no premium currency.
export const EVENTS = {
  luckHour: { every: 60, length: 10, luck: 2 }, // the first `length` minutes of every hour: luck x2
  weekend: { income: 2 }, // Saturday and Sunday (UTC): income x2
  featured: { every: 30, luck: 1.5, variant: 3 }, // one area at a time: luck x1.5, variants x3 as likely
  // The Hungry Giant (game/boss.js; the server counts a room's throws): turns up at these minutes
  // past every hour for `length` minutes; every throw anyone in the room makes feeds her.
  boss: { at: [20, 50], length: 4, needPerPlayer: 8, rewardSecs: 60, perThrowSecs: 10, maxSecs: 180, tickets: 10 },
}

// Seasonal events: one theme at a time, `days` long each, cycling from `anchor` (UTC ms). While a
// season runs, a throw sometimes brings one of its girls out instead of a lane girl (`chance` =
// 1 in N), every throw pays `ticketsPerThrow` Event Tickets and a season girl pays `ticketsPerGirl`.
// Tickets are earned only (never bought) and are spent in the event shop (EVENT_SHOP).
export const SEASON = { anchor: Date.UTC(2026, 0, 5), days: 14, chance: 18, ticketsPerThrow: 1, ticketsPerGirl: 5 }
// A season girl earns like a girl of the area she was caught in (`a` on her entry):
// AREA_INCOME(a) x SLOT_INCOME[slot]. Odds are within the season's own four.
const SEASON_SLOTS = [
  { rarity: 3, odds: 5, slot: 4 },
  { rarity: 4, odds: 20, slot: 5 },
  { rarity: 5, odds: 80, slot: 6 },
  { rarity: 6, odds: 400, slot: 8 },
]
export const SEASONS = [
  {
    id: 'candy', name: 'Candy Carnival', icon: '\u{1F36C}', color: '#ff7ac8', banner: ['#ff9ad8', '#c42f8a'], fx: 'gems', fxColors: ['#ff9ad8', '#ffffff', '#7ae8ff', '#ffe680'],
    girls: [
      { n: 'Gumdrop', hs: 'twintails', hc: '#ff7ac8', h2: '#ffffff', e: '#ff3fa8', o: 'skirt', t: '#ffffff', b: '#ff7ac8', a: '#7ae8ff', sh: '#ff7ac8', hat: 'bow', hatC: '#7ae8ff', hd: 'icecream', hdC: '#ff9ad8' },
      { n: 'Taffeta', hs: 'buns', hc: '#9a6bff', h2: '#ffd6f0', e: '#ff6fa8', o: 'dress', t: '#ffd6f0', b: '#9a6bff', a: '#ffffff', sh: '#ffffff', hat: 'catEars', hatC: '#9a6bff', tl: 'cat', tlC: '#9a6bff' },
      { n: 'Bonbonne', hs: 'curly', hc: '#6a3b1e', h2: '#ffb3d9', e: '#ff4f8a', o: 'gown', t: '#ff4f8a', b: '#ffd6f0', a: '#6a3b1e', sh: '#6a3b1e', hat: 'crown', hatC: '#ffd23a', hd: 'wand', hdC: '#ff4f8a', w: 'fairy', wC: '#ffd6f0' },
      { n: 'Sugarstar', hs: 'long', hc: '#ffffff', h2: '#ff9ad8', e: '#7a4bff', o: 'gown', t: '#fff0fa', b: '#ff9ad8', a: '#ffd23a', sh: '#ffffff', hat: 'tiara', hatC: '#ffd23a', w: 'butterfly', wC: '#ff9ad8', hd: 'staff', hdC: '#ffd23a', glow: true },
    ],
  },
  {
    id: 'frost', name: 'Frost Festival', icon: '\u{2744}\u{FE0F}', color: '#7ae8ff', banner: ['#9ff0ff', '#2f7cc8'], fx: 'snow', fxColors: ['#ffffff', '#c8f6ff', '#9fd8ff'],
    girls: [
      { n: 'Mittens', hs: 'bob', hc: '#e8f4ff', e: '#3d8fd6', o: 'overalls', t: '#ff5a5a', b: '#3d8fd6', sh: '#ffffff', hat: 'earmuffs', hatC: '#ff5a5a', nk: 'scarf', nkC: '#ff5a5a' },
      { n: 'Snowdrop', hs: 'ponytail', hc: '#bfeaff', h2: '#ffffff', e: '#2f7cc8', o: 'skirt', t: '#ffffff', b: '#7cc8f2', a: '#ffffff', sh: '#7cc8f2', hat: 'beanie', hatC: '#7cc8f2', hd: 'lantern', hdC: '#ffe680' },
      { n: 'Aurora', hs: 'wavy', hc: '#c8a0ff', h2: '#7ae8ff', e: '#7a4bff', o: 'kimono', t: '#e6d8ff', b: '#7ae8ff', a: '#ffffff', sh: '#ffffff', hat: 'starClip', hatC: '#7ae8ff', w: 'fairy', wC: '#7ae8ff' },
      { n: 'Glacielle', hs: 'hime', hc: '#ffffff', h2: '#9fe8ff', e: '#3d8fd6', o: 'gown', t: '#e8f8ff', b: '#9fe8ff', a: '#ffffff', sh: '#bfeaff', hat: 'crown', hatC: '#bfeaff', w: 'angel', wC: '#ffffff', hd: 'staff', hdC: '#9fe8ff', glow: true },
    ],
  },
  {
    id: 'moon', name: 'Spooky Moon', icon: '\u{1F383}', color: '#ff8a2e', banner: ['#ffa84a', '#5a2a8a'], fx: 'embers', fxColors: ['#ff8a2e', '#b07cff', '#ffe14a'],
    girls: [
      { n: 'Pumpkina', hs: 'pixie', hc: '#ff8a2e', e: '#3a7a3a', o: 'dress', t: '#ff8a2e', b: '#2a1a1a', a: '#3fd23a', sh: '#2a1a1a', hat: 'witch', hatC: '#2a1a3a' },
      { n: 'Batsy', hs: 'sidetail', hc: '#2a1a2a', h2: '#b07cff', e: '#ff3a5a', o: 'skirt', t: '#2a1a2a', b: '#b07cff', a: '#ff3a5a', sh: '#2a1a2a', hat: 'bow', hatC: '#ff3a5a', w: 'bat', wC: '#3a2a4a' },
      { n: 'Hexie', hs: 'long', hc: '#7a4bff', h2: '#3fd23a', e: '#3fd23a', o: 'gown', t: '#3a2a5a', b: '#7a4bff', a: '#3fd23a', sh: '#2a1a3a', hat: 'witch', hatC: '#7a4bff', hd: 'broom', hdC: '#c89a5e' },
      { n: 'Moonshade', hs: 'hime', hc: '#e8e8ff', h2: '#b07cff', e: '#ffd23a', o: 'gown', t: '#2a2040', b: '#b07cff', a: '#ffd23a', sh: '#2a2040', hat: 'horns', hatC: '#b07cff', w: 'dragon', wC: '#5a3a8a', hd: 'lantern', hdC: '#ffd23a', glow: true },
    ],
  },
]
// Season girls (SEASONS): area -1 (not in a lane area's Index page), `season` = the season id,
// `incomeSlot` = the SLOT_INCOME step she earns at in the area she was caught in (entry `a`).
// `income` is her Sunny Meadow figure (for display before she is caught).
export const SEASON_GIRLS = SEASONS.flatMap((season, si) =>
  season.girls.map((g, i) => ({
    id: `${season.id}_${g.n.toLowerCase().replace(/[^a-z0-9]+/g, '')}`,
    name: g.n,
    area: -1,
    season: season.id,
    slot: i,
    rarity: SEASON_SLOTS[i].rarity,
    odds: SEASON_SLOTS[i].odds,
    incomeSlot: SEASON_SLOTS[i].slot,
    income: niceRound(AREA_INCOME(0) * SLOT_INCOME[SEASON_SLOTS[i].slot]),
    look: lookOf(g, si * 5 + i * 3 + 1, season),
  })),
)
// What a season girl earns when caught in area `a`.
export const seasonIncome = (def, a) => niceRound(AREA_INCOME(Math.max(0, a | 0)) * SLOT_INCOME[def.incomeSlot ?? 0])

// The event shop (Events window): money-free, paid in earned Event Tickets.
export const EVENT_SHOP = [
  { id: 'luck', name: 'Luck Potion', desc: '2x luck for 10 minutes', icon: '\u{1F340}', price: 25, potion: 'luck', minutes: 10 },
  { id: 'cash', name: 'Cash Potion', desc: '2x income for 10 minutes', icon: '\u{1F4B0}', price: 40, potion: 'cash', minutes: 10 },
  { id: 'lucky', name: 'Lucky Throw', desc: '100x luck on your next throw', icon: '\u{2618}\u{FE0F}', price: 30, lucky: 1 },
  { id: 'lure', name: 'Season Lure', desc: 'Your next throw brings out a season girl', icon: '\u{1F3A3}', price: 60, lure: 1 },
]
// Potions (event shop, Daily Reward, spin wheel): S.potions[kind] = epoch ms it lasts until.
export const POTIONS = { luck: { mult: 2, name: 'Luck x2', icon: '\u{1F340}' }, cash: { mult: 2, name: 'Income x2', icon: '\u{1F4B0}' } }

// PERFECT streak: every PERFECT in a row adds `step` luck (up to `max` steps); GOOD or WEAK
// ends the streak, GREAT keeps it.
export const STREAK = { step: 0.1, max: 10 }
// Distance records: a new longest throw is announced; every `every` metres of record pays
// `secs` of income (at least `min`).
export const RECORDS = { every: 50, secs: 30, min: 100 }
// Finishing an area's Index page also pays `secs` of income (at least `min`) and a title.
export const INDEX_REWARD = { secs: 300, min: 1000, title: (area) => `${area.name} Master` }

// Playtime gifts (Rewards window): claimable once each after this many minutes of play in one
// session. kind: cash (secs of income, at least min), lucky (free Lucky Throws), potion.
export const PLAYTIME_GIFTS = [
  { min: 5, kind: 'cash', secs: 30, floor: 200, icon: '\u{1F4B5}' },
  { min: 10, kind: 'lucky', n: 1, icon: '\u{2618}\u{FE0F}' },
  { min: 15, kind: 'cash', secs: 60, floor: 500, icon: '\u{1F4B5}' },
  { min: 30, kind: 'potion', potion: 'luck', minutes: 10, icon: '\u{1F340}' },
  { min: 45, kind: 'cash', secs: 120, floor: 2000, icon: '\u{1F4B0}' },
  { min: 60, kind: 'potion', potion: 'cash', minutes: 10, icon: '\u{1F4B0}' },
]
// Daily Reward (server clock; backend daily.ts): one day unlocks per UTC day, 7 in a cycle.
export const DAILY = {
  days: [
    { kind: 'cash', secs: 60, floor: 500, icon: '\u{1F4B5}' },
    { kind: 'lucky', n: 1, icon: '\u{2618}\u{FE0F}' },
    { kind: 'cash', secs: 180, floor: 2000, icon: '\u{1F4B5}' },
    { kind: 'potion', potion: 'luck', minutes: 15, icon: '\u{1F340}' },
    { kind: 'potion', potion: 'cash', minutes: 15, icon: '\u{1F4B0}' },
    { kind: 'lucky', n: 2, icon: '\u{2618}\u{FE0F}' },
    { kind: 'cash', secs: 600, floor: 20000, tickets: 20, icon: '\u{1F381}' },
  ],
}
// Spin wheel. Online the server owns the spins and rolls them (backend constants.ts SPIN_*: same
// ids, weights and timing); offline the client does, for the session only.
export const SPIN = {
  everyMin: 15, // one free spin every this many minutes
  cap: 5, // spins that can pile up
  start: 1, // a new player's spins
  wedges: [
    { id: 'cash1', weight: 30, kind: 'cash', secs: 60, floor: 300, label: '1 min cash', color: '#6ee04a' },
    { id: 'luck', weight: 22, kind: 'potion', potion: 'luck', minutes: 10, label: 'Luck x2', color: '#2fb8a0' },
    { id: 'cash5', weight: 20, kind: 'cash', secs: 300, floor: 1500, label: '5 min cash', color: '#3fa6ff' },
    { id: 'lucky', weight: 15, kind: 'lucky', n: 1, label: 'Lucky Throw', color: '#c97bff' },
    { id: 'income', weight: 12, kind: 'potion', potion: 'cash', minutes: 10, label: 'Income x2', color: '#ffb020' },
    { id: 'jackpot', weight: 1, kind: 'cash', secs: 1800, floor: 10000, label: 'JACKPOT', color: '#ff4f5e' },
  ],
}

// The Fuse Machine (ui/hud.js window, main.js startFuse). Bring 3 of the same baddie and
// size (from your pen and/or hotbar): you always get the next size up, and a lucky fuse skips
// a size (normal -> HUGE) or, when there is no bigger size left, pays a cash bonus.
export const FUSE = {
  duration: 2.6, // s the machine runs
  luckyChance: 0.1,
  luckyBonusSeconds: 120, // a lucky BIG -> HUGE also pays this many seconds of the result's income
}

// Food rarities (the Food Shop card colours and the throw effects; separate from the
// baddie RARITIES). key = CSS card class, color = text/accent, glow = trails, auras and
// impact light, fx = how loud the throw effects get (0 plain .. 10 everything),
// emissive = how much the model itself glows (bloom picks up its glow voxels).
export const FOOD_RARITIES = [
  { key: 'common', name: 'Common', color: '#e9edf2', glow: '#ffffff', fx: 0, emissive: 0 },
  { key: 'uncommon', name: 'Uncommon', color: '#69e05a', glow: '#8aff6a', fx: 1, emissive: 0 },
  { key: 'rare', name: 'Rare', color: '#3fa6ff', glow: '#5fc0ff', fx: 2, emissive: 0 },
  { key: 'epic', name: 'Epic', color: '#d36bff', glow: '#d98aff', fx: 3, emissive: 0 },
  { key: 'legendary', name: 'Legendary', color: '#ffc21f', glow: '#ffd84f', fx: 4, emissive: 0 },
  { key: 'mythic', name: 'Mythic', color: '#ff5a3a', glow: '#ff7a3a', fx: 5, emissive: 0.03 },
  { key: 'celestial', name: 'Celestial', color: '#3fe0c0', glow: '#8affea', fx: 6, emissive: 0.05, rainbow: true },
  { key: 'cosmic', name: 'Cosmic', color: '#7a5bff', glow: '#9a7dff', fx: 7, emissive: 0.08 },
  { key: 'divine', name: 'Divine', color: '#ffd6f0', glow: '#fff0b0', fx: 8, emissive: 0.1 },
  { key: 'secret', name: 'Secret', color: '#d8d8e8', glow: '#e8e8ff', fx: 9, emissive: 0.06 },
  { key: 'exotic', name: 'Exotic', color: '#ffe04a', glow: '#7ffcff', fx: 10, emissive: 0.12 },
  { key: 'special', name: 'Special Food', color: '#ffe04a', glow: '#c07dff', fx: 8, emissive: 0.1 },
]

// Foods you can throw (the Food Shop, ui/hud.js; models in game/foods.js). Bought once
// with money and kept; buying one equips it. dist = the food's base throw distance in metres
// (Throwing Strength multiplies it, see THROW), luck scales the rarity roll; both climb with
// every tier. kind = what it sounds like and how it breaks up when it lands (crunch, squish,
// soft, meat, jelly, metal, cosmic).
// The Galaxy Donut is the reference art's premium-currency food: here it costs money like
// everything else (priced a bit above the tier it matches), as the root CLAUDE.md requires.
// Pacing (tested in a progression sim): a player who throws and trains reaches the last area
// in about 2 hours (the prices up to tier ~32 set that pace; above it they climb x1.7 a tier,
// so the whole list takes about a day of top-end income).
const FOOD_DIST = (tier) => Math.round(20 * Math.pow(1.08, tier - 1) * 10) / 10
const FOOD_LUCK = (tier) => {
  const l = Math.pow(1.1, tier - 1)
  return l < 10 ? Math.round(l * 100) / 100 : Math.round(l * 10) / 10
}
const FOOD_LIST = [
  // id, name, rarity, price (money; tuned tier by tier in a progression sim, then x2.5 to make
  // room for the event / reward cash: still about 2 hours to the last area), kind
  ['carrot', 'Carrot', 0, 0, 'crunch'],
  ['apple', 'Apple', 0, 10, 'crunch'],
  ['banana', 'Banana', 0, 15, 'squish'],
  ['orange', 'Orange', 0, 25, 'squish'],
  ['strawberry', 'Strawberry', 1, 38, 'squish'],
  ['pear', 'Pear', 1, 60, 'squish'],
  ['lemon', 'Lemon', 1, 98, 'squish'],
  ['cherry', 'Cherry', 1, 190, 'squish'],
  ['grapes', 'Grapes', 2, 400, 'squish'],
  ['corn', 'Corn', 2, 980, 'crunch'],
  ['broccoli', 'Broccoli', 2, 2500, 'crunch'],
  ['mushroom', 'Mushroom', 2, 4500, 'soft'],
  ['eggplant', 'Eggplant', 3, 8200, 'soft'],
  ['avocado', 'Avocado', 3, 15e3, 'squish'],
  ['watermelon', 'Watermelon Slice', 3, 35e3, 'squish'],
  ['pineapple', 'Pineapple', 3, 68e3, 'crunch'],
  ['toast', 'Toast', 4, 130e3, 'crunch'],
  ['bread', 'Bread Loaf', 4, 450e3, 'soft'],
  ['cheese', 'Cheese Wedge', 4, 900e3, 'soft'],
  ['croissant', 'Croissant', 4, 2.8e6, 'soft'],
  ['cookie', 'Cookie', 5, 5.8e6, 'crunch'],
  ['pancakes', 'Pancakes', 5, 12e6, 'soft'],
  ['donut', 'Donut', 5, 28e6, 'soft'],
  ['chocolate', 'Chocolate Bar', 5, 90e6, 'crunch'],
  ['lollipop', 'Lollipop', 6, 280e6, 'crunch'],
  ['popsicle', 'Popsicle', 6, 900e6, 'jelly'],
  ['cupcake', 'Cupcake', 6, 2.5e9, 'soft'],
  ['icecream', 'Ice Cream', 6, 12e9, 'jelly'],
  ['fries', 'Fries', 7, 13e9, 'crunch'],
  ['hotdog', 'Hot Dog', 7, 15e9, 'meat'],
  ['burger', 'Burger', 7, 18e9, 'meat'],
  ['pizza', 'Pizza Slice', 7, 42e9, 'soft'],
  ['taco', 'Taco', 7, 72e9, 'crunch'],
  ['sushi', 'Sushi', 8, 120e9, 'meat'],
  ['ramen', 'Ramen', 8, 210e9, 'jelly'],
  ['drumstick', 'Drumstick', 8, 350e9, 'meat'],
  ['steak', 'Steak', 9, 600e9, 'meat'],
  ['cake', 'Cake Slice', 9, 1e12, 'soft'],
  ['milkshake', 'Milkshake', 9, 1.8e12, 'jelly'],
  ['goldenapple', 'Golden Apple', 9, 3e12, 'metal'],
  ['dragonfruit', 'Dragon Fruit', 9, 5e12, 'squish'],
  ['rainbowcake', 'Rainbow Cake', 9, 8.5e12, 'soft'],
  ['dango', 'Dango', 9, 14e12, 'jelly'],
  ['ghostpepper', 'Ghost Pepper', 9, 25e12, 'squish'],
  ['lavacake', 'Lava Cake', 9, 42e12, 'jelly'],
  ['hotwings', 'Hot Wings', 9, 72e12, 'meat'],
  ['starfruit', 'Star Fruit', 10, 120e12, 'cosmic'],
  ['mooncheese', 'Moon Cheese', 10, 210e12, 'cosmic'],
  ['nebulajelly', 'Nebula Jelly', 10, 350e12, 'cosmic'],
]
export const FOODS = [
  // Special: Robux in the reference, money here. Distance of tier 14, luck of tier 16, priced as tier 17.
  { id: 'galaxydonut', name: 'Galaxy Donut', rarity: 11, tier: 0, special: true, price: 130e3, dist: FOOD_DIST(14), luck: FOOD_LUCK(16), kind: 'cosmic' },
  ...FOOD_LIST.map(([id, name, rarity, price, kind], i) => ({ id, name, rarity, tier: i + 1, price, dist: FOOD_DIST(i + 1), luck: FOOD_LUCK(i + 1), kind })),
]
export const STARTER_FOOD = 'carrot'

// Throw range = the food's distance x (1 + strength bonus), at most maxRange. The bonus is
// strengthPct per Throwing Strength point (training levels give 5, every throw 1), capped.
export const THROW = {
  strengthPct: 0.00125, // +0.125% range per strength point
  strengthCap: 3, // at most +300%
  maxRange: 376, // the lane is about this long past the throw line
  flightTime: [1.1, 3.8], // s in the air at no range / max range
  strengthPerThrow: 1,
}

// The Training Place (game/training.js, hub/trainingStation.js, ui/trainUi.js): the Training
// Bench (two pillars + a pull-up bar) stands right in front of your pad, so you train with the
// pad at your back. Walk in under the bar and you jump up and do pull-ups: every rep earns
// training XP (the bench's XP/s), every training level gives Throwing Strength. STOP, Esc / Q,
// walking or jumping gets off.
// The pad shows the bench's XP/s and the money price of the next bench: step on it to upgrade.
// Every tier is its own 3D model (`style`, built in hub/trainingStation.js). Money only.
const PAD_Z = PENS.z - PENS.halfD + POI.padOffset.z // the upgrade pad's z (all bases)
const PAD_GAP = 4.3 // m from the bar to the pad centre: about 2.3 m of open grass between them
export const TRAINING = {
  // Centre of the bench; the bar runs east-west over it, the pad sits `padGap` m behind it.
  padGap: PAD_GAP,
  spot: { x: PENS.xs[PENS.playerIndex] + POI.padOffset.x, z: PAD_Z - PAD_GAP },
  ringR: 4.7, // the dashed ring round bench + pad (decoration and the "near" glow)
  enterR: 1.45, // step this close to the bar's centre to start training
  facing: Math.PI, // you face north (toward the lane) on the bar, the pad behind you
  pillar: { gap: 2.7, height: 3.4, size: 0.78 }, // centre-to-centre gap, height to the lintel top
  // The hands are pinned to the bar (2-bone arm IK sized from the avatar's own bones): you
  // hang with the arms nearly straight and pull until your shoulders are `top` m under the bar.
  grip: { drop: 0.05, top: 0.14, forward: 0.06 }, // hand centre under the bar, shoulders at the top, bar ahead of the shoulders
  rep: { up: 0.32, hold: 0.1, down: 0.42, rest: 0.1 }, // s per phase at 1x speed
  strengthPerLevel: 5,
  // XP to finish a level: about 3 reps at level 1 on the first bench, +4% every level.
  need: (level) => Math.round(10 * Math.pow(1.04, level)),
  // The benches, in order: XP per second of training at 1x, the money price to upgrade INTO it,
  // and its look (`style` picks the model, `colors` its palette, `glow` its accent light).
  benches: [
    { name: 'Rookie Logs', xps: 4, price: 0, style: 'logs', colors: ['#9a6334', '#6e4220', '#c99a5e', '#e8d6a8'], glow: '#ffd27a' },
    { name: 'Brick Gym', xps: 6, price: 150, style: 'brick', colors: ['#f6f8fc', '#dde3ee', '#c4ccdb', '#2a2f3d'], glow: '#ffffff' },
    { name: 'Iron Rig', xps: 9, price: 1400, style: 'iron', colors: ['#5d6678', '#3a4150', '#e0313f', '#cfd6e2'], glow: '#ff5a5a' },
    { name: 'Neon Arena', xps: 14, price: 12e3, style: 'neon', colors: ['#1d2236', '#10131f', '#25e8ff', '#ff3df2'], glow: '#25e8ff' },
    { name: 'Golden Temple', xps: 20, price: 110e3, style: 'gold', colors: ['#ffc93a', '#d99a12', '#c4202f', '#fff2b0'], glow: '#ffd34f' },
    { name: 'Frost Crystal', xps: 30, price: 1e6, style: 'ice', colors: ['#bfeaff', '#7cc8f2', '#ffffff', '#3d8fd6'], glow: '#9fe8ff' },
    { name: 'Lava Forge', xps: 46, price: 9e6, style: 'lava', colors: ['#3e3446', '#241c2a', '#ff6a1a', '#ffd23a'], glow: '#ff6a1a' },
    { name: 'Royal Diamond', xps: 68, price: 80e6, style: 'royal', colors: ['#7a3cf0', '#4a1fa8', '#ffffff', '#ffd34f'], glow: '#c79bff' },
    { name: 'Celestial Gate', xps: 103, price: 720e6, style: 'celestial', colors: ['#fff6e0', '#ffe7a3', '#8a7aff', '#ffd34f'], glow: '#fff3c4' },
    { name: 'Cosmic Titan', xps: 154, price: 6.5e9, style: 'cosmic', colors: ['#1a1240', '#0a0820', '#ff7af2', '#7ffce0'], glow: '#ff7af2' },
  ],
  // Random XP boosts: while you train a round "2x" tap button pops up somewhere on screen at a
  // random time (it is never there all the time); tap it before it runs out and every rep pays
  // that many times the XP for `dur` s, then it ends. The value is rolled by weight (rarer = bigger).
  drops: {
    first: [3, 7], // s into a session before the first one
    every: [8, 16], // s between one leaving and the next appearing
    life: 4.2, // s it stays up
    values: [
      { mult: 2, weight: 60, dur: 10, color: '#7dff4a' },
      { mult: 3, weight: 25, dur: 10, color: '#3fd0ff' },
      { mult: 5, weight: 11, dur: 10, color: '#c27dff' },
      { mult: 10, weight: 4, dur: 10, color: '#ffc21f' },
    ],
  },
}
// XP one rep pays on bench `tier` (before boosts): its XP/s times the length of a 1x rep.
export const repXp = (tier) => {
  const r = TRAINING.rep
  return Math.max(1, Math.round(TRAINING.benches[tier].xps * (r.up + r.hold + r.down + r.rest)))
}

// The throw sequence (game/throw.js + ui/throwUi.js). Step onto the yellow band at the lane
// mouth: the camera settles behind you, a power meter sweeps up and down, tap to throw. The
// camera chases the food down the lane (luck climbs with every metre), slow-mo touchdown,
// then a baddie comes out to eat it and is revealed on a card.
export const THROW_MODE = {
  band: { north: -31.75, south: -26.6, halfWidth: 8.6 }, // the yellow band (z range, |x|)
  spot: { x: 0, z: -29.2 }, // where you stand on it
  meterSpeed: 0.95, // full bottom -> top sweeps per second
  minPower: 0.12, // the bottom of the meter still throws this fraction of your range
  // Where the slider stops (0 bottom .. 1 top) grades the throw: power is the slider value,
  // and the grade multiplies luck.
  grades: [
    { min: 0.9, name: 'PERFECT!', color: '#7dff4a', luck: 1.5 },
    { min: 0.7, name: 'GREAT!', color: '#d4ff3a', luck: 1.2 },
    { min: 0.4, name: 'GOOD', color: '#ffd23a', luck: 1 },
    { min: 0, name: 'WEAK', color: '#ff8a3a', luck: 1 },
  ],
  luckPerMeters: 75, // the luck multiplier climbs +1x for every this many metres flown
  slowMo: { last: 0.42, scale: 0.28 }, // s of flight before touchdown played in slow motion, time scale
  hitStop: 0.08, // s frozen on impact
  // The money-priced 100x luck offer (no premium currency anywhere): price = max(min, income x seconds).
  lucky: { mult: 100, minPrice: 2500, incomeSeconds: 420 },
  auto: { stopAt: [0.8, 0.99], continueAfter: 1.0, revealHold: 1.9 },
  typeEvery: 0.085, // s per letter of the name reveal
  // The girl picks the food up in both hands and eats it from them (s unless noted):
  // bend down (reach), the food leaves the ground at grab for grabLen, she straightens and
  // lifts it to her mouth (lift), bites, then a short beat (after) before the reveal.
  eat: { reach: 0.55, grab: 0.4, grabLen: 0.35, lift: 0.5, bites: 3, biteEvery: 0.42, after: 0.25, holdScale: 0.62, biteShrink: 0.72, inFront: 0.1, skipSpeed: 3.5 },
  // Camera shots (metres, degrees).
  cam: {
    aim: { back: 6.4, up: 4.4, side: 1.6, lookAhead: 34, lookUp: -5.5, fov: 60 },
    chase: { back: 3.6, up: 1.1, fov: 82 },
    landed: { radius: 5.4, up: 2, fov: 54, orbit: 0.22 },
    meet: { radius: 8.5, up: 3.2, fov: 58 },
    reveal: { dist: 4.1, up: 1.55, fov: 44 },
  },
}

export const ECONOMY = {
  startMoney: 50,
  startStrength: 10,
  startCapacity: 4,
  capacityStep: 2,
  maxCapacity: 24,
  capacityCost: (level) => Math.round(250 * Math.pow(4.2, level)), // level 0 = first upgrade
  sellSeconds: 45, // a baddie sells for this many seconds of its income
  friendBoost: 0.15, // per Bloxity friend in your room
  inviteBoost: 0.1, // per friend who joined the game from your invite link (permanent)
  inviteMax: 10, // invited friends that count
  chestEvery: 600, // s between free chest rewards
  chestSeconds: 120, // the chest pays this many seconds of income (at least chestMin)
  chestMin: 100,
  offlineCap: 2 * 3600, // s of offline income credited on return
  offlineShare: 0.5,
  saveEveryMs: 4000, // progress goes to the server this often while it changes (net.js saveGame)
  // Rewarded ads (ADS below): Wins / money rewards only, never premium currency.
  adBoostMult: 2, // income multiplier while the ad boost lasts
  hotbarSlots: 9, // caught baddies wait here (select one to carry it, click to place it in your pen)
}

// The Shop. Money only: nothing in this game costs premium currency.
export const UPGRADES = [
  { id: 'cash', name: 'Cash Boost', desc: '+25% income', max: 10, cost: (l) => Math.round(600 * Math.pow(4, l)) },
  { id: 'arms', name: 'Iron Arms', desc: '+20% training XP', max: 25, xpPerLevel: 0.2, cost: (l) => Math.round(200 * Math.pow(2.6, l)) },
  { id: 'luck', name: 'Lucky Charm', desc: '+20% luck', max: 10, cost: (l) => Math.round(1500 * Math.pow(4.5, l)) },
  { id: 'speed', name: 'Speedy Shoes', desc: '+10% walk speed', max: 5, cost: (l) => Math.round(400 * Math.pow(3, l)) },
]

// The objective banner (top centre). The first unfinished one shows; each pays a reward: `reward`
// money, or `secs` seconds of income when that is more. Quests with a `goal` complete themselves
// once it is met (state.js checkQuests); the others are completed by the action they name.
// goal types: area (reach area n, 1-based), catches, food (own food tier n), bench (bench tier n,
// 0-based), level (training level), size (own one this size), variant (catch one this variant),
// rarity (catch one this rarity), dist (throw n metres), streak (PERFECT streak), index (pages done).
export const QUESTS = [
  { id: 'catch1', text: 'Throw food at a baddie in the lane', reward: 50 },
  { id: 'train1', text: 'Do pull-ups at the Training Bench', reward: 100 },
  { id: 'bench1', text: 'Upgrade your Training Bench on its pad', reward: 150 },
  { id: 'food1', text: 'Buy new food', reward: 150 },
  { id: 'area2', text: 'Throw into Area 2: Harvest Farm', reward: 200, goal: { type: 'area', n: 2 } },
  { id: 'catch5', text: 'Catch 5 baddies', reward: 400 },
  { id: 'pen1', text: 'Upgrade your pen', reward: 800 },
  { id: 'level10', text: 'Reach Training Level 10', reward: 300, secs: 20, goal: { type: 'level', n: 10 } },
  { id: 'area3', text: 'Throw into Area 3: Willow Lake', reward: 500, secs: 30, goal: { type: 'area', n: 3 } },
  { id: 'fuse1', text: 'Fuse 3 baddies in the Fuse Machine', reward: 2500 },
  { id: 'food2', text: 'Buy new food', reward: 6000 },
  { id: 'dist50', text: 'Throw 50 metres', reward: 1000, secs: 30, goal: { type: 'dist', n: 50 } },
  { id: 'rare1', text: 'Catch a Rare baddie', reward: 9000 },
  { id: 'area4', text: 'Throw into Area 4: Desert Canyon', reward: 2000, secs: 40, goal: { type: 'area', n: 4 } },
  { id: 'streak3', text: 'Throw 3 PERFECTs in a row', reward: 2000, secs: 30, goal: { type: 'streak', n: 3 } },
  { id: 'food3', text: 'Buy new food', reward: 25000 },
  { id: 'catch25', text: 'Catch 25 baddies', reward: 5000, secs: 40, goal: { type: 'catches', n: 25 } },
  { id: 'bench3', text: 'Upgrade to the Neon Arena bench', reward: 5000, secs: 40, goal: { type: 'bench', n: 3 } },
  { id: 'epic1', text: 'Catch an Epic baddie', reward: 60000 },
  { id: 'area5', text: 'Throw into Area 5: Frost Peaks', reward: 10000, secs: 50, goal: { type: 'area', n: 5 } },
  { id: 'gold1', text: 'Catch a GOLD baddie', reward: 10000, secs: 50, goal: { type: 'variant', n: 1 } },
  { id: 'index1', text: 'Complete a page of the Index', reward: 10000, secs: 50, goal: { type: 'index', n: 1 } },
  { id: 'area6', text: 'Throw into Area 6: Autumn Grove', reward: 20000, secs: 60, goal: { type: 'area', n: 6 } },
  { id: 'huge1', text: 'Fuse a HUGE baddie', reward: 20000, secs: 60, goal: { type: 'size', n: 2 } },
  { id: 'dist150', text: 'Throw 150 metres', reward: 20000, secs: 60, goal: { type: 'dist', n: 150 } },
  { id: 'area7', text: 'Throw into Area 7: Crystal Falls', reward: 50000, secs: 70, goal: { type: 'area', n: 7 } },
  { id: 'legend1', text: 'Catch a Legendary baddie', reward: 50000, secs: 70, goal: { type: 'rarity', n: 4 } },
  { id: 'catch100', text: 'Catch 100 baddies', reward: 50000, secs: 70, goal: { type: 'catches', n: 100 } },
  { id: 'area8', text: 'Throw into Area 8: Sunset Beach', reward: 100000, secs: 80, goal: { type: 'area', n: 8 } },
  { id: 'streak5', text: 'Throw 5 PERFECTs in a row', reward: 100000, secs: 60, goal: { type: 'streak', n: 5 } },
  { id: 'food20', text: 'Buy the Croissant', reward: 100000, secs: 80, goal: { type: 'food', n: 20 } },
  { id: 'area9', text: 'Throw into Area 9: Coral Reef', reward: 200000, secs: 90, goal: { type: 'area', n: 9 } },
  { id: 'diamond1', text: 'Catch a DIAMOND baddie', reward: 200000, secs: 90, goal: { type: 'variant', n: 2 } },
  { id: 'area10', text: 'Throw into Area 10: Cloud Heaven', reward: 500000, secs: 100, goal: { type: 'area', n: 10 } },
  { id: 'giant1', text: 'Fuse a GIANT baddie', reward: 500000, secs: 100, goal: { type: 'size', n: 3 } },
  { id: 'area11', text: 'Throw into Area 11: Lava Inferno', reward: 1e6, secs: 110, goal: { type: 'area', n: 11 } },
  { id: 'dist300', text: 'Throw 300 metres', reward: 1e6, secs: 110, goal: { type: 'dist', n: 300 } },
  { id: 'area12', text: 'Throw into Area 12: Cosmic Rift', reward: 2e6, secs: 180, goal: { type: 'area', n: 12 } },
  { id: 'mythic1', text: 'Catch a Mythic baddie', reward: 2e6, secs: 120, goal: { type: 'rarity', n: 5 } },
  { id: 'titan1', text: 'Fuse a TITAN baddie', reward: 5e6, secs: 300, goal: { type: 'size', n: 4 } },
  { id: 'rainbow1', text: 'Catch a RAINBOW baddie', reward: 5e6, secs: 300, goal: { type: 'variant', n: 3 } },
  { id: 'index6', text: 'Complete 6 pages of the Index', reward: 1e7, secs: 300, goal: { type: 'index', n: 6 } },
]

// Neighbour plots (offline stand-ins for other players). Names are made up.
export const NEIGHBOURS = [
  { name: 'PixelPanda22', hair: '#2a1a12', skin: '#f2c79a', shirt: '#3fa6ff', team: ['meadow_honey', 'farm_cinna', 'meadow_daisy', 'lake_lily', 'meadow_flutter'] },
  { name: 'sunny_bricks', hair: '#ff9a3c', skin: '#ffe0c4', shirt: '#ff5f8a', team: ['lake_libelle', 'desert_fennie', 'lake_koi', 'farm_moomoo'] },
  null, // the player
  { name: 'MoonLoaf', hair: '#1a1a24', skin: '#e2b08a', shirt: '#7be04a', team: ['desert_mirage', 'snow_polara', 'autumn_kohana', 'beach_flamina', 'farm_wooly', 'snow_crystelle'] },
  { name: 'TacoTurbo7', hair: '#6b3f22', skin: '#c98e64', shirt: '#ffd54a', team: ['meadow_bunnie', 'meadow_clover', 'farm_chickie'] },
]

// Leaderboard stand-ins: [name, baddies caught, best pull (1 in N), money/s].
export const BOARD_BOTS = [
  ['StarSprinkle', 31200, 1.2e6, 9.1e9], ['blocky_bea', 18800, 6.5e5, 7.6e9], ['NoodleKnight', 15100, 4.2e5, 6.4e9],
  ['MintyMax', 13900, 2.9e5, 5.0e9], ['ZoomZebra', 12100, 1.9e5, 4.9e8], ['CloudCobbler', 10400, 1.1e5, 4.1e8],
  ['tofu_titan', 9800, 9.0e4, 3.9e7], ['LavaLlama', 9700, 6.2e4, 3.1e6], ['GummyGolem', 9400, 4.1e4, 2.8e5],
  ['RiverRook', 9100, 2.7e4, 2.2e4], ['PebblePilot', 8000, 9.0e3, 1.0e3],
]

export const FX = {
  maxGlow: 2400, // additive particles (sparkles, motes, beams)
  maxSolid: 1800, // alpha particles (confetti, crumbs, hearts, smoke, leaves)
  maxCoins: 140,
  maxChunks: 220, // voxel food chunks that burst off a landing and bounce on the ground
  maxTexts: 24,
}

export const AUDIO = {
  volume: 0.8,
  storageKey: 'throw-food-for-baddies.sound',
  buses: { ui: 0.8, sfx: 0.9, amb: 0.5, engine: 0.5 },
  duck: 0.5, // world (ambience) level while a menu window is open
  maxVoices: 48,
  maxVoicesTouch: 24,
  latency: 0.04,
  latencyTouch: 0.07,
  lead: 0.02,
  // Generated impulse response: an open meadow inside dirt cliffs (short slap, soft tail).
  reverb: { seconds: 1.6, preDelay: 0.014, early: [[23, 0.42], [41, 0.3], [63, 0.22], [91, 0.14]], decay: 1.1, tail: 0.16, darken: 1.8, send: 0.85 },
  ambience: { wind: 0.1, birdEvery: [1.2, 4.5], bird: 0.045, cricket: 0.02 },
  stepEvery: 1.6, // m between footsteps
}
