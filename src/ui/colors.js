// Per-note color tags. Stored as a NAME in frontmatter (color: violet) so the
// palette can be re-themed without rewriting notes; the card renders the hex.
export const NOTE_COLORS = [
  { name: null, label: 'Default', hex: null },
  { name: 'violet', label: 'Violet', hex: '#a78bfa' },
  { name: 'green', label: 'Green', hex: '#6ee7b7' },
  { name: 'amber', label: 'Amber', hex: '#fbbf24' },
  { name: 'coral', label: 'Coral', hex: '#f87171' },
  { name: 'sky', label: 'Sky', hex: '#60a5fa' },
  { name: 'pink', label: 'Pink', hex: '#f472b6' },
]

export function colorHex(name) {
  const c = NOTE_COLORS.find((x) => x.name === name)
  return c ? c.hex : null
}

export function colorTint(name, alpha = 0.16) {
  const hex = colorHex(name)
  if (!hex) return null
  const n = hex.replace('#', '')
  const r = parseInt(n.slice(0, 2), 16)
  const g = parseInt(n.slice(2, 4), 16)
  const b = parseInt(n.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}
