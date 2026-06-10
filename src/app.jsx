// Notes — a markdown notes app for Möbius.
//
// Source entry. esbuild bundles this + src/{lib,ui,editor}/* into the single
// index.jsx the platform installs (npm run build). React comes from the import
// map (/vendor/react); the live-inline editor from `codemirror`; math from
// `katex`; card previews lazy-load marked + DOMPurify from esm.sh. Pure logic
// (frontmatter, hashing, merge, reconcile) lives in src/lib/* and is unit-tested
// with `node --test`. Notes persist as plain markdown files (frontmatter + body)
// so the dreaming agent can read them. See DESIGN.md for the model.

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { CSS } from './ui/css.js'
import { newNote, contentHash, isBlankNote } from './lib/note.js'
import * as store from './lib/store.js'
import { ensureBase, recordWorking, recordDeletion, promote, unsyncedLocals } from './lib/local.js'
import { reconcileAll } from './lib/reconciler.js'
import Grid from './ui/Grid.jsx'
import EditorPanel from './ui/EditorPanel.jsx'
import ConfirmModal from './ui/ConfirmModal.jsx'
import { Icon } from './ui/icons.jsx'

function TopBar({ query, onQuery, onNew }) {
  return (
    <header className="nt-topbar">
      <h1 className="nt-title">Notes</h1>
      <div className="nt-search-wrap">
        <input
          value={query} onChange={(e) => onQuery(e.target.value)}
          placeholder="Search notes…" aria-label="Search notes"
          className="nt-search"
        />
      </div>
      <button onClick={onNew} aria-label="New note" className="nt-new-btn">
        <span className="nt-new-plus">+</span> New
      </button>
    </header>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="nt-empty">
      <div className="nt-empty-icon"><Icon name="edit" size={40} /></div>
      <div className="nt-empty-msg">{filtered ? 'No matching notes' : 'No notes yet'}</div>
      {!filtered && <div className="nt-empty-hint">Tap <strong>+ New</strong> to write your first note.</div>}
    </div>
  )
}

export default function App({ appId, token }) {
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState({ mode: 'grid', id: null })
  const [draft, setDraft] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(() => new Set())
  const reconTimer = useRef(null)
  const editorNavOwned = useRef(false)
  const online = store.isOnline()

  const upsert = useCallback((meta, body) => {
    setNotes((prev) => {
      const next = prev.some((n) => n.meta.id === meta.id)
        ? prev.map((n) => (n.meta.id === meta.id ? { meta, body } : n))
        : [{ meta, body }, ...prev]
      store.writeIndex(next).catch(() => {})
      return next
    })
  }, [])

  const onApplied = useCallback((id, note) => {
    setConflicts((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n })
    setNotes((prev) => prev.map((n) => (n.meta.id === id ? { meta: note.meta, body: note.body } : n)))
  }, [])
  const onDeleted = useCallback((id) => {
    setConflicts((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n })
    setNotes((prev) => prev.filter((n) => n.meta.id !== id))
  }, [])
  const onConflict = useCallback((id) => {
    setConflicts((prev) => { const n = new Set(prev); n.add(id); return n })
  }, [])

  const runReconcile = useCallback(() => { reconcileAll({ onApplied, onDeleted, onConflict }).catch(() => {}) }, [onApplied, onDeleted, onConflict])
  const scheduleReconcile = useCallback(() => {
    if (reconTimer.current) clearTimeout(reconTimer.current)
    reconTimer.current = setTimeout(runReconcile, 400)
  }, [runReconcile])

  // Initial load: canonical notes overlaid with any unsynced local edits (so an
  // offline edit survives a reload), then seed bases + flush the reconcile queue.
  useEffect(() => {
    let live = true
    ;(async () => {
      const canonical = await store.listNotes().catch(() => [])
      let merged = canonical
      try {
        const unsynced = await unsyncedLocals()
        if (unsynced.length) {
          const map = new Map(canonical.map((n) => [n.meta.id, n]))
          for (const [id, rec] of unsynced) map.set(id, { meta: rec.working.meta, body: rec.working.body })
          merged = [...map.values()]
        }
      } catch (e) {}
      if (!live) return
      setNotes(merged)
      setLoading(false)
      // Seed a base for notes we haven't tracked yet (background; non-blocking).
      for (const n of canonical) {
        contentHash(n.meta, n.body).then((hash) => ensureBase(n.meta.id, { meta: n.meta, body: n.body, hash })).catch(() => {})
      }
      runReconcile()
    })()
    return () => { live = false }
  }, [runReconcile])

  // Re-reconcile when connectivity / focus returns.
  useEffect(() => {
    const h = () => runReconcile()
    for (const ev of ['online', 'focus']) window.addEventListener(ev, h)
    const vis = () => { if (document.visibilityState === 'visible') runReconcile() }
    document.addEventListener('visibilitychange', vis)
    return () => {
      for (const ev of ['online', 'focus']) window.removeEventListener(ev, h)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [runReconcile])

  useEffect(() => {
    let live = true
    const tick = () => store.pendingCount().then((n) => { if (live) setPending(n) }).catch(() => {})
    tick(); const h = setInterval(tick, 1500)
    return () => { live = false; clearInterval(h) }
  }, [])

  // A brand-new note opens as an in-memory draft first. It is not inserted into
  // the grid until the user actually writes something, avoiding the distracting
  // empty-card flash before the full editor opens. Once meaningful, the first
  // save lands canonical directly (no ancestor yet, so no conflict is possible)
  // and seeds its base; later edits go through the working copy + reconcile.
  const pushEditorNav = useCallback(() => {
    if (typeof window === 'undefined' || !window.parent) return Promise.resolve(false)
    const requestId = `notes-editor-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
    return new Promise((resolve) => {
      const done = (owned) => {
        clearTimeout(timer)
        window.removeEventListener('message', onMessage)
        resolve(owned)
      }
      const timer = setTimeout(() => done(false), 1200)
      const onMessage = (event) => {
        if (event.origin !== window.location.origin) return
        if (event.data?.requestId !== requestId) return
        if (event.data.type === 'moebius:nav-push-ack') done(true)
        else if (event.data.type === 'moebius:nav-push-rejected') done(false)
      }
      window.addEventListener('message', onMessage)
      try {
        window.parent.postMessage(
          { type: 'moebius:nav-push', label: 'notes-editor', requestId },
          window.location.origin,
        )
      } catch {
        done(false)
      }
    })
  }, [])

  const popEditorNav = useCallback(() => {
    if (!editorNavOwned.current || typeof window === 'undefined' || !window.parent) return
    editorNavOwned.current = false
    try {
      window.parent.postMessage({ type: 'moebius:nav-pop' }, window.location.origin)
    } catch {}
  }, [])

  const openEditor = useCallback(async (id) => {
    if (view.mode === 'editor') {
      setView({ mode: 'editor', id })
      return
    }
    editorNavOwned.current = await pushEditorNav()
    setView({ mode: 'editor', id })
  }, [pushEditorNav, view.mode])

  const createNote = useCallback(() => {
    const meta = newNote({})
    setDraft({ meta, body: '' })
    openEditor(meta.id).catch(() => setView({ mode: 'editor', id: meta.id }))
  }, [openEditor])

  const commitDraft = useCallback(async (meta, body) => {
    const m = { ...meta, updated: meta.updated || new Date().toISOString() }
    m.content_hash = await contentHash(m, body)
    upsert(m, body)
    setDraft(null)
    await store.saveNote(m, body).catch(() => {})
    await promote(m.id, { meta: m, body, hash: m.content_hash }).catch(() => {})
    scheduleReconcile()
    return m
  }, [scheduleReconcile, upsert])

  // Persist an edit: stamp the working copy + update the UI, then let the
  // reconcile driver (the sole canonical writer) land it / merge / flag conflict.
  const persist = useCallback(async (meta, body) => {
    if (draft && draft.meta.id === meta.id) {
      const next = { meta: { ...draft.meta, ...meta }, body }
      setDraft(next)
      if (isBlankNote(next.meta, next.body)) return
      await commitDraft(next.meta, next.body)
      return
    }
    const m = { ...meta, updated: new Date().toISOString() }
    m.content_hash = await contentHash(m, body)
    upsert(m, body)
    await recordWorking(m.id, { meta: m, body, hash: m.content_hash }).catch(() => {})
    scheduleReconcile()
  }, [commitDraft, draft, upsert, scheduleReconcile])

  const togglePin = useCallback((id) => {
    const n = notes.find((x) => x.meta.id === id); if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body)
    else if (draft && draft.meta.id === id) setDraft((d) => ({ ...d, meta: { ...d.meta, pinned: !d.meta.pinned } }))
  }, [draft, notes, persist])
  const setColor = useCallback((id, color) => {
    const n = notes.find((x) => x.meta.id === id); if (n) persist({ ...n.meta, color }, n.body)
    else if (draft && draft.meta.id === id) setDraft((d) => ({ ...d, meta: { ...d.meta, color } }))
  }, [draft, notes, persist])

  const queueDelete = useCallback(async (note) => {
    const hash = await contentHash(note.meta, note.body)
    await recordDeletion(note.meta.id, { meta: note.meta, body: note.body, hash }).catch(() => {})
    scheduleReconcile()
  }, [scheduleReconcile])

  const doDelete = useCallback((id) => {
    if (draft && draft.meta.id === id) {
      if (view.mode === 'editor' && view.id === id) popEditorNav()
      setDraft(null)
      setConfirmId(null)
      setView({ mode: 'grid' })
      return
    }
    const n = notes.find((x) => x.meta.id === id)
    if (n) queueDelete(n).catch(() => {})
    setNotes((prev) => {
      const next = prev.filter((note) => note.meta.id !== id)
      store.writeIndex(next).catch(() => {})
      return next
    })
    setConfirmId(null)
    setView((v) => {
      if (v.mode === 'editor' && v.id === id) {
        popEditorNav()
        return { mode: 'grid' }
      }
      return v
    })
  }, [draft, notes, popEditorNav, queueDelete, view.id, view.mode])

  const back = useCallback((fromShell = false) => {
    if (!fromShell) popEditorNav()
    else editorNavOwned.current = false
    if (draft && draft.meta.id === view.id) {
      setDraft(null)
      setView({ mode: 'grid' })
      return
    }
    const n = notes.find((x) => x.meta.id === view.id)
    if (n && isBlankNote(n.meta, n.body)) {
      queueDelete(n).catch(() => {})
      setNotes((prev) => {
        const next = prev.filter((x) => x.meta.id !== n.meta.id)
        store.writeIndex(next).catch(() => {})
        return next
      })
    }
    setView({ mode: 'grid' })
  }, [draft, notes, popEditorNav, view.id, queueDelete])

  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'moebius:nav-back') back(true)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [back])

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

  const editing = view.mode === 'editor' ? (notes.find((n) => n.meta.id === view.id) || (draft && draft.meta.id === view.id ? draft : null)) : null
  const status = !online ? 'Offline' : (editing && conflicts.has(editing.meta.id)) ? 'Resolving…' : pending > 0 ? 'Saving…' : 'Synced'

  return (
    <div className="nt-root">
      <style>{CSS}</style>
      <TopBar query={query} onQuery={setQuery} onNew={createNote} />
      <main className="nt-scroll">
        {loading
          ? <div className="nt-loading">Loading…</div>
          : visible.length === 0
            ? <EmptyState filtered={!!query.trim()} />
            : <Grid notes={visible} onOpen={(id) => { openEditor(id).catch(() => setView({ mode: 'editor', id })) }} onPin={togglePin} onColor={setColor} onDelete={setConfirmId} resolveAttachment={store.attachmentURL} />}
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
          conflict={conflicts.has(editing.meta.id)}
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
