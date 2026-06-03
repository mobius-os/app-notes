// Notes — a markdown notes app for Möbius.
//
// Single-file mini-app entry: esbuild compiles this (and everything under src/)
// to one ES module. React comes from the importmap (/vendor/react); the
// live-inline editor from `codemirror` (Phase F); math from `katex`; card
// previews lazy-load marked + DOMPurify from esm.sh. Pure logic (frontmatter,
// hashing, merge, reconcile) lives in src/lib/* and is unit-tested with
// `node --test`; this file is the React + storage glue.
//
// Notes persist as plain markdown files (frontmatter + body) under the app's
// storage so the dreaming agent can read them. See DESIGN.md for the model.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { T } from './ui/theme.js'
import { newNote, contentHash } from './lib/note.js'
import * as store from './lib/store.js'
import Grid from './ui/Grid.jsx'
import EditorPanel from './ui/EditorPanel.jsx'
import ConfirmModal from './ui/ConfirmModal.jsx'

function TopBar({ query, onQuery, onNew }) {
  const t = T()
  return (
    <header style={{
      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
      borderBottom: `1px solid ${t.border}`, position: 'sticky', top: 0,
      background: t.bg, zIndex: 5,
    }}>
      <h1 style={{ fontSize: 18, fontWeight: 650, color: t.text, letterSpacing: '-0.01em' }}>Notes</h1>
      <div style={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <input
          value={query}
          onChange={(e) => onQuery(e.target.value)}
          placeholder="Search notes…"
          aria-label="Search notes"
          style={{
            width: '100%', maxWidth: 520, padding: '8px 12px', borderRadius: 10,
            border: `1px solid ${t.border}`, background: t.surface2, color: t.text,
            fontSize: 14, outline: 'none',
          }}
        />
      </div>
      <button onClick={onNew} aria-label="New note" style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px',
        borderRadius: 10, border: 'none', background: t.accent, color: '#0d0d0d',
        fontSize: 14, fontWeight: 600, cursor: 'pointer', flexShrink: 0,
      }}>
        <span style={{ fontSize: 18, lineHeight: 1 }}>+</span> New
      </button>
    </header>
  )
}

function EmptyState({ filtered }) {
  const t = T()
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 8, padding: '18vh 24px', textAlign: 'center', color: t.muted,
    }}>
      <div style={{ fontSize: 40, opacity: 0.5 }}>✎</div>
      <div style={{ fontSize: 15 }}>{filtered ? 'No matching notes' : 'No notes yet'}</div>
      {!filtered && <div style={{ fontSize: 13, opacity: 0.8 }}>Tap <strong>+ New</strong> to write your first note.</div>}
    </div>
  )
}

export default function App({ appId, token }) {
  const t = T()
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState({ mode: 'grid', id: null })
  const [confirmId, setConfirmId] = useState(null)
  const [pending, setPending] = useState(0)
  const online = store.isOnline()

  useEffect(() => {
    let live = true
    store.listNotes().then((list) => {
      if (live) { setNotes(list); setLoading(false) }
    }).catch(() => { if (live) setLoading(false) })
    return () => { live = false }
  }, [])

  // Lightweight save indicator: poll the outbox depth.
  useEffect(() => {
    let live = true
    const tick = () => store.pendingCount().then((n) => { if (live) setPending(n) }).catch(() => {})
    tick()
    const h = setInterval(tick, 1500)
    return () => { live = false; clearInterval(h) }
  }, [])

  const upsert = useCallback((meta, body) => {
    setNotes((prev) => {
      const next = prev.some((n) => n.meta.id === meta.id)
        ? prev.map((n) => (n.meta.id === meta.id ? { meta, body } : n))
        : [{ meta, body }, ...prev]
      store.writeIndex(next).catch(() => {})
      return next
    })
  }, [])

  // Persist a note: stamp updated + content hash, write canonical, update state.
  const persist = useCallback(async (meta, body) => {
    const m = { ...meta, updated: new Date().toISOString() }
    m.content_hash = await contentHash(m, body)
    upsert(m, body)
    await store.saveNote(m, body)
  }, [upsert])

  const createNote = useCallback(async () => {
    const meta = newNote({})
    meta.content_hash = await contentHash(meta, '')
    upsert(meta, '')
    store.saveNote(meta, '').catch(() => {})
    setView({ mode: 'editor', id: meta.id })
  }, [upsert])

  const togglePin = useCallback((id) => {
    const n = notes.find((x) => x.meta.id === id)
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body)
  }, [notes, persist])

  const setColor = useCallback((id, color) => {
    const n = notes.find((x) => x.meta.id === id)
    if (n) persist({ ...n.meta, color }, n.body)
  }, [notes, persist])

  const doDelete = useCallback((id) => {
    store.deleteNote(id).catch(() => {})
    setNotes((prev) => {
      const next = prev.filter((n) => n.meta.id !== id)
      store.writeIndex(next).catch(() => {})
      return next
    })
    setConfirmId(null)
    setView((v) => (v.mode === 'editor' && v.id === id ? { mode: 'grid' } : v))
  }, [])

  // Leaving an untouched brand-new note discards it (no empty-note litter).
  const back = useCallback(() => {
    const n = notes.find((x) => x.meta.id === view.id)
    if (n && !(n.meta.title || '').trim() && !(n.body || '').trim()) {
      store.deleteNote(n.meta.id).catch(() => {})
      setNotes((prev) => prev.filter((x) => x.meta.id !== n.meta.id))
    }
    setView({ mode: 'grid' })
  }, [notes, view.id])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q
      ? notes.filter((n) =>
          (n.meta.title || '').toLowerCase().includes(q) ||
          (n.body || '').toLowerCase().includes(q) ||
          (n.meta.tags || []).join(' ').toLowerCase().includes(q))
      : notes
    return [...list].sort((a, b) => {
      if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1
      return (b.meta.updated || '').localeCompare(a.meta.updated || '')
    })
  }, [notes, query])

  const editing = view.mode === 'editor' ? notes.find((n) => n.meta.id === view.id) : null
  const status = !online ? 'Offline' : pending > 0 ? 'Saving…' : 'Synced'

  return (
    <div style={{
      position: 'relative', height: '100%', display: 'flex', flexDirection: 'column',
      background: t.bg, color: t.text, fontFamily: t.font,
    }}>
      <TopBar query={query} onQuery={setQuery} onNew={createNote} />
      <main style={{ flex: 1, overflow: 'auto' }}>
        {loading
          ? <div style={{ padding: '18vh 0', textAlign: 'center', color: t.muted, fontSize: 14 }}>Loading…</div>
          : visible.length === 0
            ? <EmptyState filtered={!!query.trim()} />
            : <Grid notes={visible} onOpen={(id) => setView({ mode: 'editor', id })}
                onPin={togglePin} onColor={setColor} onDelete={setConfirmId} />}
      </main>

      {editing && (
        <EditorPanel
          note={editing}
          onSave={persist}
          onBack={back}
          onPin={togglePin}
          onColor={setColor}
          onDelete={setConfirmId}
          resolveAttachment={store.attachmentURL}
          putAttachment={store.putAttachment}
          status={status}
        />
      )}

      <ConfirmModal
        open={!!confirmId}
        title="Delete note?"
        message="This note will be permanently deleted."
        confirmLabel="Delete"
        danger
        onConfirm={() => doDelete(confirmId)}
        onCancel={() => setConfirmId(null)}
      />
    </div>
  )
}
