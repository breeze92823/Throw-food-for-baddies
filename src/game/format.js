// Number formatting for money and stats: 950, 1.2K, 278.89K, 1.64M, 3.1B ...
const UNITS = ['', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc']

export function fmt(n, digits = 2) {
  if (!Number.isFinite(n)) return '0'
  const neg = n < 0
  n = Math.abs(n)
  if (n < 1000) {
    const s = n < 10 && n % 1 ? n.toFixed(1).replace(/\.0$/, '') : String(Math.floor(n))
    return (neg ? '-' : '') + s
  }
  let u = 0
  while (n >= 1000 && u < UNITS.length - 1) {
    n /= 1000
    u++
  }
  const s = n >= 100 ? n.toFixed(Math.max(0, digits - 2)) : n >= 10 ? n.toFixed(Math.max(0, digits - 1)) : n.toFixed(digits)
  return (neg ? '-' : '') + s.replace(/\.?0+$/, '') + UNITS[u]
}

export const money = (n) => `$${fmt(n)}`

export function clock(seconds) {
  const s = Math.max(0, Math.ceil(seconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
