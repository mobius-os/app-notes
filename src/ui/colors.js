// Per-note color tones. Stored as a NAME in frontmatter (color: moss) so the
// palette can be re-themed without rewriting notes; the UI renders via the
// nt-card--<tone> / nt-swatch--<tone> classes generated in css.js from this list.
//
// The palette is deliberately muted — desaturated ink tones that sit well on the
// Möbius charcoal+emerald shell instead of competing with it. Card backgrounds
// blend each tone into var(--surface) with color-mix (see css.js), so the same
// names track light/dark theme switches.
export const NOTE_COLORS = [
  { name: null, label: 'Default', hex: null },
  { name: 'slate', label: 'Slate', hex: '#7d96b4' },
  { name: 'moss', label: 'Moss', hex: '#84a583' },
  { name: 'sand', label: 'Sand', hex: '#c2ab82' },
  { name: 'clay', label: 'Clay', hex: '#bd8d7c' },
  { name: 'plum', label: 'Plum', hex: '#a98ab4' },
]

// Notes written before the palette redesign carry the old saturated names.
// Map each to its nearest muted tone ON READ — existing notes keep their stored
// frontmatter value until their next real edit, but always render a current tone.
const LEGACY_TONES = {
  violet: 'plum',
  pink: 'plum',
  green: 'moss',
  amber: 'sand',
  coral: 'clay',
  sky: 'slate',
}

// Resolve a stored color name (current, legacy, or unknown) to a current tone
// name, or null for default/unrecognized. Every read path goes through this so
// legacy data can never produce a broken style.
export function normalizeColorName(name) {
  if (!name) return null
  if (NOTE_COLORS.some((c) => c.name === name)) return name
  return LEGACY_TONES[name] ?? null
}

export function colorHex(name) {
  const tone = normalizeColorName(name)
  const c = NOTE_COLORS.find((x) => x.name === tone)
  return c ? c.hex : null
}
