// The lane: an empty coloured runway between tall cliffs, split into rarity zones
// (HUB.zones). Nothing roams it; the throw sequence (throw.js) sends a baddie of the zone
// the food lands in out from the nearest cover (laneCover in hub/world.js).
import { HUB } from '../config.js'

// The rarity zone at z (null on the hub side of the throw line).
export function zoneAt(z) {
  const L = HUB.lane
  if (z > L.throwLine) return null
  return HUB.zones.find((zn) => z <= zn.from && z > zn.to) ?? HUB.zones[HUB.zones.length - 1]
}
