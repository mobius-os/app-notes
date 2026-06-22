// Notes — a markdown notes app for Möbius.
//
// Source entry. esbuild bundles this + src/{lib,ui,editor}/* into the single
// index.jsx the platform installs (npm run build). React comes from the import
// map (/vendor/react); the live-inline editor from `codemirror`; math from
// `katex`; card previews lazy-load marked + DOMPurify from esm.sh. Pure logic
// (frontmatter, hashing, merge) lives in src/lib/* and is unit-tested with
// `node --test`.
//
// PERSISTENCE (migrated to the platform useDocument primitive): each note is a
// JSON document at notes/<id>.json holding { meta, body } (body is the markdown
// string). The platform runtime owns durability — its serialized per-path writer
// + offline outbox replace the app's old shadow-IndexedDB outbox, seq-CAS
// promote, and reconcile driver (all deleted). A note write is durable on a
// 'synced' or 'queued' result; a server refusal rejects DurableWriteError, which
// surfaces as an error (never a false "saved"). Concurrent same-note edits
// 3-way-merge via merge3 (note-doc.js → merge.js, conflict semantics preserved
// exactly); a real conflict still emits the immutable conflicts/<id>/…json
// descriptor the cron/agent resolver reads. See DESIGN.md for the model.

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { CSS } from './ui/css.js'
import { newNote, contentHash, isBlankNote } from './lib/note.js'
import { notesFromIndex } from './lib/index-cache.js'
import { visibleNotes } from './lib/visible.js'
import * as store from './lib/store.js'
import { makeNoteCollection } from './lib/collection.js'
import { notePath, makeMergeNote, conflictDescriptorFor } from './lib/note-doc.js'
import { migrateLegacyNotes } from './lib/migrate.js'
import Grid from './ui/Grid.jsx'
import EditorPanel from './ui/EditorPanel.jsx'
import ConfirmModal from './ui/ConfirmModal.jsx'
import { Icon } from './ui/icons.jsx'

// A no-op document handle: the value the open-note hook returns when no note is
// open (the sentinel path) or under the unit-test harness, where window.mobius
// is absent. Keeps a stable shape so callers can read .value/.status/.lastError
// unconditionally.
const NO_DOC = { value: null, status: 'idle', lastError: null, update: async () => {}, set: async () => {}, refresh: async () => {} }

// Bind the platform document hook ONCE at module top with the app's own React,
// as the runtime requires (window.mobius.useDocument is intentionally NOT
// self-bound — see mobius-runtime.js: it must run on the app's React instance).
// When the runtime is absent (the node:test unit harness imports this bundle),
// fall back to a trivial hook that returns NO_DOC, so the hook is ALWAYS called
// (one fixed position in the hook order — never a conditional hook call).
const HAS_RUNTIME_DOC =
  typeof window !== 'undefined' && !!(window.mobius && window.mobius.createUseDocument)
const useDocument = HAS_RUNTIME_DOC
  ? window.mobius.createUseDocument(React)
  : () => NO_DOC

function TopBar({ appId, query, onQuery }) {
  return (
    <header className="nt-topbar">
      {/* Brand mark: the app's own glossy icon (downscaled + cached by the
          backend). Falls back to the accent dot if this install has no custom
          icon (the route 404s). No app-name text — icon only. */}
      <img
        src={`/api/apps/${appId}/icon?size=128`}
        alt=""
        width={44} height={44}
        className="nt-brand-icon"
        onError={(e) => {
          e.currentTarget.style.display = 'none'
          const f = e.currentTarget.nextElementSibling
          if (f) f.style.display = 'flex'
        }}
      />
      <span className="nt-brand-fallback" style={{ display: 'none' }} aria-hidden="true">·</span>
      <div className="nt-search-wrap">
        <input
          value={query} onChange={(e) => onQuery(e.target.value)}
          placeholder="Search notes" aria-label="Search notes"
          className="nt-search"
        />
      </div>
    </header>
  )
}

function EmptyState({ filtered }) {
  return (
    <div className="nt-empty">
      <div className="nt-empty-icon"><Icon name="edit" size={40} /></div>
      <div className="nt-empty-msg">{filtered ? 'No matching notes' : 'No notes yet'}</div>
      {!filtered && <div className="nt-empty-hint">Tap + to write your first note.</div>}
    </div>
  )
}

export default function App({ appId, token }) {
  // KaTeX's renderToString output (used by the live-preview editor for $…$ and
  // $$…$$ math) needs katex.min.css for its fraction/sizing/positioning rules;
  // without it every formula renders as overlapping fallback glyphs. A plain CDN
  // <link> is blocked by the prod CSP (style-src does not allow jsdelivr), so we
  // fetch the stylesheet through the same-origin /api/proxy and inject it as an
  // inline <style> (style-src allows 'unsafe-inline'). Pinned to the importmap's
  // katex version. The @font-face URLs inside the sheet stay CDN-relative and are
  // blocked by font-src, so the glyphs fall back to the system math font —
  // readable and correctly laid out, which is the bug being fixed; bundling the
  // woff2 fonts same-origin would be a platform change.
  useEffect(() => {
    if (document.querySelector('style[data-nt-katex]')) return undefined
    let cancelled = false
    const CSS_URL = 'https://cdn.jsdelivr.net/npm/katex@0.16.22/dist/katex.min.css'
    fetch(`/api/proxy?url=${encodeURIComponent(CSS_URL)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    }).then((r) => {
      if (!r.ok) throw new Error(`KaTeX CSS proxy failed (${r.status})`)
      return r.text()
    }).then((css) => {
      if (cancelled || document.querySelector('style[data-nt-katex]')) return
      const style = document.createElement('style')
      style.setAttribute('data-nt-katex', '1')
      style.textContent = css
      document.head.appendChild(style)
    }).catch(() => {
      // No math styling — KaTeX still renders, just without its layout rules.
      // Better than a blocked-resource console error loop.
    })
    return () => { cancelled = true }
  }, [token])

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState({ mode: 'grid', id: null })
  const [draft, setDraft] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [pending, setPending] = useState(0)
  const [conflicts, setConflicts] = useState(() => new Set())
  const [saveError, setSaveError] = useState(null)
  const gcTimer = useRef(null)
  const editorNavOwned = useRef(false)
  const online = store.isOnline()

  // The conflict callback for any merge that detects a genuine overlapping-body
  // conflict: persist the immutable descriptor (so the cron/agent resolver and
  // "Resolve now" can act) and flag the note so the editor shows the merging bar.
  // Async hashing runs here, off the synchronous merge.
  const onConflict = useCallback((sides) => {
    setConflicts((prev) => {
      const id = sides?.mine?.meta?.id ?? sides?.theirs?.meta?.id ?? sides?.base?.meta?.id
      if (id == null || prev.has(id)) return prev
      const n = new Set(prev); n.add(id); return n
    })
    conflictDescriptorFor(sides.base, sides.mine, sides.theirs, contentHash)
      .then((d) => { if (d) store.writeConflict(d.path, d).catch(() => {}) })
      .catch(() => {})
  }, [])

  // The per-note document collection (the sole note-document writer). Built once;
  // its update()/remove() run the same lww read-merge-write the platform
  // useDocument hook uses, so a dynamic, unbounded note set works without
  // breaking React's rules of hooks. The open editor note ALSO gets a real
  // useDocument hook below — its writes and the collection's never target the
  // same path (grid actions act on closed notes; editor actions on the open one).
  const collection = useMemo(() => makeNoteCollection({ onConflict }), [onConflict])

  // The live document hook for the currently-open note (literal per-note
  // useDocument). It provides the open note's optimistic value, save status, and
  // lastError. Its merge is mergeNote (merge3 + mergeMeta), identity the note id,
  // mode 'lww' (per-note files avoid same-path clobber; backend CAS isn't live).
  const openId = view.mode === 'editor' ? view.id : null
  const openPath = openId ? notePath(openId) : '__notes_no_open__.json'
  const mergeNote = useMemo(() => makeMergeNote(onConflict), [onConflict])
  // Always called (stable hook position); inert when no note is open (the
  // sentinel path is never written) or under the test harness (returns NO_DOC).
  const liveDoc = useDocument(openPath, {
    initial: null,
    identity: (d) => (d && d.meta ? d.meta.id : undefined),
    merge: mergeNote,
    mode: 'lww',
  })

  // Surface the open note's durable-write failure as an actionable error (never a
  // silent loss, never a false save). A 'queued' result is durable success and
  // leaves status 'saving' with no lastError — so we only treat lastError as a
  // failure.
  useEffect(() => {
    if (openId && liveDoc.lastError) {
      setSaveError({ id: openId, message: 'Could not save — your edit is kept. Retrying when possible.' })
    }
  }, [openId, liveDoc.lastError])

  // Mirror the open note's live document value back into the grid's `notes`
  // array (replaces the old reconciler's onApplied callback): when a concurrent
  // server edit 3-way-merges into the open note, the merged value lands in
  // liveDoc.value; reflect it so the grid card and a later re-open show the
  // merged content, not the stale optimistic copy. The editor buffer reconciles
  // via its own note-prop effect.
  useEffect(() => {
    const v = liveDoc.value
    if (!openId || !v || !v.meta || v.meta.id !== openId) return
    setNotes((prev) => {
      const cur = prev.find((n) => n.meta.id === openId)
      if (cur && cur.body === v.body && cur.meta.content_hash === v.meta.content_hash) return prev
      return prev.map((n) => (n.meta.id === openId ? { meta: v.meta, body: v.body } : n))
    })
  }, [openId, liveDoc.value])

  const upsert = useCallback((meta, body) => {
    setNotes((prev) => {
      const next = prev.some((n) => n.meta.id === meta.id)
        ? prev.map((n) => (n.meta.id === meta.id ? { meta, body } : n))
        : [{ meta, body }, ...prev]
      store.writeIndex(next).catch(() => {})
      return next
    })
  }, [])

  // Debounced attachment GC. Deletes and body edits can orphan content-addressed
  // blobs; sweep them after the dust settles (the durable write has landed)
  // against the current authoritative note set.
  const scheduleGc = useCallback(() => {
    if (gcTimer.current) clearTimeout(gcTimer.current)
    gcTimer.current = setTimeout(() => {
      store.gcAttachments().catch(() => {})
    }, 1500)
  }, [])

  // Initial load: migrate any legacy markdown notes to the JSON document model
  // (idempotent, before the first read so old notes never vanish), paint the
  // derived index.json cache for an instant grid, then read the canonical note
  // documents (the runtime overlays any queued offline write, so an offline edit
  // survives a reload).
  useEffect(() => {
    let live = true
    ;(async () => {
      await migrateLegacyNotes().catch(() => {})
      // Fast cold-load: the index is a strictly-derived cache, so render its
      // placeholders immediately while the authoritative files are enumerated.
      store.readIndex()
        .then((index) => {
          const cached = notesFromIndex(index)
          if (live && cached.length) {
            setNotes((prev) => (prev.length ? prev : cached))
            setLoading(false)
          }
        })
        .catch(() => {})
      const canonical = await collection.list().catch(() => [])
      if (!live) return
      setNotes(canonical)
      setLoading(false)
      window.mobius?.signal('app_ready', { item_count: canonical.length })
    })()
    return () => { live = false }
  }, [collection])

  useEffect(() => {
    let live = true
    const tick = () => store.pendingCount().then((n) => { if (live) setPending(n) }).catch(() => {})
    tick(); const h = setInterval(tick, 1500)
    return () => { live = false; clearInterval(h) }
  }, [])

  // Clear pending debounce timers on unmount.
  useEffect(() => () => {
    if (gcTimer.current) clearTimeout(gcTimer.current)
  }, [])

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

  // Cold-load placeholders (reconstituted from index.json) are DISPLAY-ONLY:
  // their body is a lossy markdown-stripped snippet and their meta is a partial
  // projection (no attachments / rev fields). Any path that edits, opens, or
  // deletes a note must first swap in the authoritative note from storage —
  // flushing a placeholder buffer back to disk is what destroyed image embeds
  // (`![alt](attachments/…)` collapsed to bare alt text) in real notes.
  // Returns the authoritative record, or null when it can't be loaded yet.
  const ensureAuthoritative = useCallback(async (id) => {
    const cur = notes.find((n) => n.meta.id === id)
    if (!cur) return null
    if (!cur.placeholder) return cur
    const loaded = await collection.load(id).catch(() => null)
    if (!loaded || !loaded.meta || !loaded.meta.id) return null
    setNotes((prev) => prev.map((n) => (n.meta.id === id ? loaded : n)))
    return loaded
  }, [notes, collection])

  const openEditor = useCallback(async (id) => {
    window.mobius?.signal('note_opened')
    setSaveError(null)
    const cur = notes.find((n) => n.meta.id === id)
    if (cur && cur.placeholder && !(await ensureAuthoritative(id))) return
    if (view.mode === 'editor') {
      setView({ mode: 'editor', id })
      return
    }
    editorNavOwned.current = await pushEditorNav()
    setView({ mode: 'editor', id })
  }, [ensureAuthoritative, notes, pushEditorNav, view.mode])

  const createNote = useCallback(() => {
    const meta = newNote({})
    setDraft({ meta, body: '' })
    openEditor(meta.id).catch(() => setView({ mode: 'editor', id: meta.id }))
  }, [openEditor])

  // Persist a note's full document ({ meta, body }). EXACTLY ONE writer touches a
  // given note path: the OPEN editor note writes through its live useDocument
  // hook (liveDoc.update — the literal per-note document); every other note (grid
  // pin/color/delete on a closed note, a draft's first save) writes through the
  // collection's update, which runs the IDENTICAL lww read-merge-write. The
  // routing is exclusive — the editor is full-screen, so the grid never acts on
  // the open note — so the two writers can never target the same path
  // concurrently. Both serialize the read-merge-write per path, merge concurrent
  // edits via merge3, and resolve DURABLE (synced/queued) or REJECT
  // DurableWriteError on a server refusal. We optimistically upsert the in-memory
  // note, then on a rejection keep the edit and surface an error so it is never
  // lost AND never falsely reported saved.
  const writeNote = useCallback(async (meta, body, { isDraftCommit = false } = {}) => {
    const id = meta.id
    const m = { ...meta, updated: meta.updated || new Date().toISOString() }
    m.content_hash = await contentHash(m, body)
    upsert(m, body)
    const writeThroughHook = HAS_RUNTIME_DOC && openId === id
    try {
      let result
      if (writeThroughHook) {
        result = await liveDoc.update(() => ({ meta: m, body }))
      } else {
        ;({ result } = await collection.update(id, () => ({ meta: m, body })))
      }
      setSaveError((e) => (e && e.id === id ? null : e))
      if (isDraftCommit) setDraft(null)
      scheduleGc()
      const wordCount = (body || '').trim().split(/\s+/).filter(Boolean).length
      window.mobius?.signal('note_saved', {
        word_count: wordCount || undefined,
        durability: result?.durability,
      })
      return m
    } catch (err) {
      // Durable write REFUSED by the server (DurableWriteError). Do not claim a
      // save and do not lose the edit: keep the optimistic in-memory note (so the
      // buffer is preserved and the user can retry) and surface an error. A draft
      // is kept open so its content isn't dropped. (An OFFLINE write does NOT land
      // here — it resolves 'queued', which is durable success.)
      window.mobius?.signal('error', { message: err?.message ?? 'save failed', source: 'writeNote' })
      setSaveError({ id, message: 'Could not save — your edit is kept. Retrying when possible.' })
      return m
    }
  }, [openId, liveDoc, upsert, collection, scheduleGc])

  // Persist an edit from the editor or a draft. `updated` is stamped only when
  // the content actually changed (hash compare): the grid sorts on it, so a real
  // edit bumps the note to the top while opening a note — or a flush that didn't
  // change anything — never does.
  const persist = useCallback(async (meta, body) => {
    if (draft && draft.meta.id === meta.id) {
      const next = { meta: { ...draft.meta, ...meta }, body }
      setDraft(next)
      if (isBlankNote(next.meta, next.body)) return
      await writeNote(next.meta, next.body, { isDraftCommit: true })
      return
    }
    const prev = notes.find((n) => n.meta.id === meta.id)
    if (prev && prev.placeholder) return // display-only; never persist a snippet
    const nextHash = await contentHash(meta, body)
    const prevHash = prev ? await contentHash(prev.meta, prev.body) : null
    if (prevHash != null && nextHash === prevHash) return // nothing changed — don't bump order
    await writeNote({ ...meta, updated: new Date().toISOString() }, body)
  }, [draft, notes, writeNote])

  const togglePin = useCallback(async (id) => {
    if (draft && draft.meta.id === id) {
      setDraft((d) => ({ ...d, meta: { ...d.meta, pinned: !d.meta.pinned } }))
      return
    }
    const n = await ensureAuthoritative(id)
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body)
  }, [draft, ensureAuthoritative, persist])
  const setColor = useCallback(async (id, color) => {
    if (draft && draft.meta.id === id) {
      setDraft((d) => ({ ...d, meta: { ...d.meta, color } }))
      return
    }
    const n = await ensureAuthoritative(id)
    if (n) persist({ ...n.meta, color }, n.body)
  }, [draft, ensureAuthoritative, persist])

  // Delete a note: remove its canonical document via the collection (the runtime
  // queues the delete offline and drains it on reconnect). Clear any conflict
  // flag and sweep orphaned attachments after.
  const queueDelete = useCallback(async (id) => {
    await collection.remove(id).catch(() => {})
    setConflicts((prev) => { if (!prev.has(id)) return prev; const n = new Set(prev); n.delete(id); return n })
    scheduleGc()
  }, [collection, scheduleGc])

  const doDelete = useCallback((id) => {
    window.mobius?.signal('item_deleted')
    if (draft && draft.meta.id === id) {
      if (view.mode === 'editor' && view.id === id) popEditorNav()
      setDraft(null)
      setConfirmId(null)
      setView({ mode: 'grid' })
      return
    }
    const n = notes.find((x) => x.meta.id === id)
    if (n) queueDelete(id).catch(() => {})
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
    if (n && !n.placeholder && isBlankNote(n.meta, n.body)) {
      queueDelete(n.meta.id).catch(() => {})
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

  const visible = useMemo(() => visibleNotes(notes, query), [notes, query])

  // The editor only ever mounts an authoritative note (or an in-memory draft) —
  // never a cold-load placeholder; openEditor swaps placeholders out first.
  const editing = view.mode === 'editor'
    ? (notes.find((n) => n.meta.id === view.id && !n.placeholder) || (draft && draft.meta.id === view.id ? draft : null))
    : null
  // Standard: silent when healthy. Saving/pending is plumbing — only Offline, an
  // actionable conflict state, and a hard save error ever surface.
  const status = saveError && editing && saveError.id === editing.meta.id
    ? 'Save failed'
    : !online ? 'Offline'
    : (editing && conflicts.has(editing.meta.id)) ? 'Resolving…'
    : null

  return (
    <div className="nt-root">
      <style>{CSS}</style>
      <TopBar appId={appId} query={query} onQuery={setQuery} />
      <main className="nt-scroll">
        {loading
          ? <div className="nt-loading" role="status" aria-live="polite">
              <span className="nt-spinner" aria-hidden="true" />
              <span>Loading…</span>
            </div>
          : visible.length === 0
            ? <EmptyState filtered={!!query.trim()} />
            : <Grid
                notes={visible}
                onOpen={(id) => { openEditor(id).catch(() => setView({ mode: 'editor', id })) }}
                onPin={togglePin}
                onColor={setColor}
                onDelete={setConfirmId}
                resolveAttachment={store.attachmentURL}
              />}
      </main>

      {/* FAB — the single way to create a note; hidden while the editor is open */}
      {view.mode !== 'editor' && (
        <button
          className="nt-fab"
          onClick={createNote}
          aria-label="New note"
          title="New note"
        >+</button>
      )}

      {editing && (
        <EditorPanel
          appId={appId}
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
