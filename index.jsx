// Notes — a markdown notes app for Möbius.
//
// Single-file mini-app: esbuild compiles this to an ES module; React comes from
// the importmap (/vendor/react), the live-inline editor from `codemirror`, math
// from `katex`, and card previews lazy-load marked + DOMPurify from esm.sh.
// Pure logic (frontmatter, hashing, merge, reconcile) lives in src/lib/* and is
// unit-tested with `node --test`; this file is the React + storage glue.
//
// Notes persist as plain markdown files (frontmatter + body) under the app's
// storage so the dreaming agent can read them. See DESIGN.md for the full model.

import { useState } from 'react'

// Read a Möbius theme CSS var (the frame injects the live theme), with a
// fallback so the app still looks right before/without theme injection.
export function cssVar(name, fallback) {
  if (typeof document === 'undefined') return fallback
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim()
  return v || fallback
}

function TopBar({ query, onQuery, onNew }) {
  const border = cssVar('--border', '#2a2a2a')
  const surface = cssVar('--surface2', '#212121')
  const text = cssVar('--text', '#ececec')
  const muted = cssVar('--muted', '#a8a8a8')
  const accent = cssVar('--accent', '#a78bfa')
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: `1px solid ${border}`, position: 'sticky', top: 0,
      background: cssVar('--bg', '#0d0d0d'), zIndex: 5,
    }}>
      <h1 style={{ fontSize: 18, fontWeight: 650, color: text, letterSpacing: '-0.01em' }}>Notes</h1>
      <div style={{ flex: 1 }}>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          style={{
            width: '100%', maxWidth: 520, padding: '8px 12px', borderRadius: 10,
            border: `1px solid ${border}`, background: surface, color: text,
            fontSize: 14, outline: 'none',
          }}
        />
      </div>
      <button
        onClick={onNew}
        aria-label="New note"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          borderRadius: 10, border: 'none', background: accent, color: '#0d0d0d',
          fontSize: 14, fontWeight: 600, cursor: 'pointer',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New
      </button>
    </header>
  )
}

function EmptyState({ muted }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, padding: '20vh 24px', textAlign: 'center',
      color: muted,
    }}>
      <div style={{ fontSize: 40, opacity: 0.5 }}>✎</div>
      <div style={{ fontSize: 15 }}>No notes yet</div>
      <div style={{ fontSize: 13, opacity: 0.8 }}>Tap <strong>+ New</strong> to write your first note.</div>
    </div>
  )
}

export default function App({ appId, token }) {
  const [query, setQuery] = useState('')
  const muted = cssVar('--muted', '#a8a8a8')
  const bg = cssVar('--bg', '#0d0d0d')

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: bg, color: cssVar('--text', '#ececec'),
      fontFamily: cssVar('--font', "'Inter', system-ui, sans-serif"),
    }}>
      <TopBar query={query} onQuery={setQuery} onNew={() => { /* Phase E */ }} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        <EmptyState muted={muted} />
      </main>
    </div>
  )
}
