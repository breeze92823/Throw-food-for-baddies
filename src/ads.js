// Rewarded ads and gameplay banners (https://docs.bloxity.io, ads).
//
// Rewarded: a "Free Gift" button on the HUD (only while Bloxity can serve ads) opens a small window
// of rewards (ADS in config: 2x income, a cash boost, a free Lucky Throw: Wins / money only, never
// premium currency). Watching plays Bloxity's ad; the reward is granted only when the ad status is
// 'completed' AND the server verified the reward token with Bloxity (net.verifyAd). Offline there is
// nothing to verify against, so the portal's 'completed' is the proof. In `npm run dev` without the
// SDK the ad is simulated so the flow can be tried.
//
// Banners: the portal draws them along the screen edges for the screen type last reported
// (bloxity.setAdScreen): only 'panel' while a window is open; none while playing, in cutscenes and during
// ad breaks (no gameplay banners, by request).
import './ads.css'
import { ADS } from './config.js'
import * as bloxity from './bloxity.js'
import * as net from './net.js'
import * as state from './game/state.js'
import { clock, money } from './game/format.js'

const MESSAGES = {
  skipped: 'Watch the whole ad to get the reward.',
  'no-fill': 'No ad is available right now. Try again later.',
  blocked: 'An ad blocker stopped the ad.',
  denied: "Too soon, or today's gifts are used up. Try again later.",
  error: 'Ads are not available right now.',
  disabled: 'Ads are not available right now.',
}

const el = (tag, cls, html) => {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  if (html != null) e.innerHTML = html
  return e
}

export function createAds({ hud, sfx, fx, playerChest, onChange, isBusy, isPaused }) {
  const simulated = import.meta.env.DEV && !bloxity.sdk()
  const available = () => simulated || bloxity.adsAvailable()
  let busy = false
  let cooldownUntil = 0
  let wasBoosted = false

  // --- Button + window ---
  const btn = el('button', 'hud-btn gift', '<span class="gift-ico">🎁</span><span class="outline"><span class="opt">Free </span>Gift</span>')
  btn.hidden = true
  document.querySelector('.hud-left')?.appendChild(btn)
  const overlay = el('div', 'ads-overlay')
  const card = el('div', 'ads-card')
  const title = el('div', 'ads-title outline', 'Free Gifts')
  const close = el('button', 'ads-close', '✕')
  close.setAttribute('aria-label', 'Close')
  const list = el('div', 'ads-list')
  const note = el('div', 'ads-note', 'Watch a short ad to claim a gift.')
  card.append(title, close, list, note)
  overlay.appendChild(card)
  document.body.appendChild(overlay)

  const open = () => {
    if (!available() || isBusy()) return
    overlay.classList.add('on')
    render()
  }
  const hide = () => overlay.classList.remove('on')
  btn.addEventListener('click', () => (overlay.classList.contains('on') ? hide() : open()))
  close.addEventListener('click', hide)
  overlay.addEventListener('pointerdown', (e) => {
    if (e.target === overlay) hide()
  })
  window.addEventListener('keydown', (e) => {
    if (e.code === 'Escape' && overlay.classList.contains('on')) hide()
  })

  function render() {
    list.textContent = ''
    for (const r of ADS.rewards) {
      const b = el('button', 'ads-reward', `<span class="ico">${r.icon}</span><span class="txt"><b>${r.name}</b><small>${r.desc}</small></span><span class="go outline">${busy ? '...' : 'WATCH'}</span>`)
      b.disabled = busy
      b.addEventListener('click', () => watch(r))
      list.appendChild(b)
    }
  }

  // --- The reward flow ---
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
  async function watch(r) {
    if (busy) return
    if (Date.now() < cooldownUntil) return hud.toast('Next gift in a moment...', 'warn')
    busy = true
    render()
    try {
      const result = simulated ? await sleep(1500).then(() => ({ status: 'completed', rewardToken: 'dev-simulated' })) : await bloxity.showRewarded(r.placement)
      if (result.status !== 'completed') return hud.toast(MESSAGES[result.status] ?? MESSAGES.error, 'warn')
      // Verified by the server (Bloxity's token check) before anything is granted.
      const verdict = simulated ? { ok: true } : await net.verifyAd(r.placement, result.rewardToken)
      if (verdict.ok === false) return hud.toast('Could not verify the ad. Try again later.', 'warn')
      grant(r)
      cooldownUntil = Date.now() + ADS.cooldownMs
    } finally {
      busy = false
      if (overlay.classList.contains('on')) render()
    }
  }

  function grant(r) {
    const S = state.S
    let text = ''
    if (r.id === 'double-income') {
      const now = Date.now()
      S.adBoostUntil = Math.min(now + ADS.maxBoostMinutes * 60000, Math.max(now, S.adBoostUntil) + r.minutes * 60000)
      text = `Income x2 for ${Math.ceil(state.adBoostLeft() / 60)} minutes!`
    } else if (r.id === 'cash-boost') {
      const amount = Math.max(r.min, Math.floor(state.income() * r.seconds))
      state.addMoney(amount, 'ad')
      text = `+${money(amount)}!`
    } else if (r.id === 'lucky-throw') {
      S.luckyCredits = Math.min(99, (S.luckyCredits ?? 0) + 1)
      text = 'Free Lucky Throw ready! Step on the band to use it.'
    }
    state.save()
    onChange()
    sfx.arrive()
    fx.confetti(playerChest(), 50)
    hud.toast(text, 'rare')
    hide()
  }

  // --- Boost chip (under the money) ---
  const chip = el('div', 'hud-adboost outline')
  chip.hidden = true
  document.querySelector('.hud-stats')?.appendChild(chip)

  // --- Per-second upkeep: button visibility, boost timer, banner screen ---
  let last = 0
  function update() {
    const now = performance.now() // real time: this keeps running through ad breaks (dt is 0 then)
    if (now - last < 500) return
    last = now
    const show = available()
    if (btn.hidden === show) btn.hidden = !show
    if (!show && overlay.classList.contains('on')) hide()
    const left = state.adBoostLeft()
    chip.hidden = left <= 0
    if (left > 0) chip.textContent = `2x INCOME ${clock(Math.ceil(left))}`
    if ((left > 0) !== wasBoosted) {
      wasBoosted = left > 0
      onChange() // the boost ended: the income shown drops back
    }
    bloxity.setAdScreen(!isPaused() && !isBusy() && hud.isOpen() ? 'panel' : null) // never while playing
  }

  return { update, open, hide }
}
