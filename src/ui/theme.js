// Read a Möbius theme CSS var (the app frame injects the live theme), with a
// fallback so the app looks right before/without injection. Shared by every UI
// module so colors stay theme-driven (never hardcode a hex that --theme owns).
export function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

export const T = () => ({
  bg: cssVar('--bg', '#0d0d0d'),
  surface: cssVar('--surface', '#171717'),
  surface2: cssVar('--surface2', '#212121'),
  border: cssVar('--border', '#2a2a2a'),
  text: cssVar('--text', '#ececec'),
  muted: cssVar('--muted', '#a8a8a8'),
  accent: cssVar('--accent', '#a78bfa'),
  green: cssVar('--green', '#6ee7b7'),
  danger: cssVar('--danger', '#f87171'),
  font: cssVar('--font', "'Inter', system-ui, sans-serif"),
  mono: cssVar('--mono', "'JetBrains Mono', ui-monospace, monospace"),
})
