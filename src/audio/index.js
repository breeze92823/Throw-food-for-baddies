// Game audio, the one import the rest of the game uses:
//   import { sfx, installAudio, updateAudio } from './audio/index.js'
// installAudio() once at boot (audio starts on the first gesture), updateAudio(dt, night)
// every frame for the ambience, and sfx.<name>() for one-shots. Every button press
// anywhere gets its click here (one capture-phase listener), so menus need no wiring.
import { installAudio as installCore, isMuted, setDucked, setMuted, setVolume, toggleMuted } from './core.js'
import * as sfx from './sfx.js'
import * as ambience from './ambience.js'

export { sfx, setVolume, setMuted, isMuted, toggleMuted, setDucked }

function onPress(e) {
  if (e.button > 0) return
  const b = e.target.closest?.('button, [role="button"]')
  if (!b || b.disabled || b.dataset.silent != null) return
  const pan = Math.max(-0.6, Math.min(0.6, (e.clientX / window.innerWidth - 0.5) * 1.2))
  if (b.classList.contains('card')) sfx.tick(pan)
  else if (b.classList.contains('big')) sfx.press(pan)
  else sfx.click(pan)
}

export function installAudio() {
  installCore()
  window.addEventListener('pointerdown', onPress, { capture: true, passive: true })
}

export function updateAudio(dt, night) {
  ambience.update(dt, night)
}
