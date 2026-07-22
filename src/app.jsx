// Notes — a markdown notes app for Möbius.
//
// Source entry. esbuild bundles this + src/{lib,ui,editor}/* into the single
// index.jsx the platform installs (npm run build). The platform compiler then
// embeds React, CodeMirror, KaTeX, Marked, DOMPurify, and their dependency
// graphs into the installed module. Pure logic (frontmatter, hashing, indexing)
// lives in src/lib/* and is unit-tested with `node --test`.
//
// PERSISTENCE (migrated to the platform useDocument primitive): each note is a
// JSON document at notes/<id>.json holding { meta, body } (body is the markdown
// string). The platform runtime owns durability — its serialized per-path writer
// + offline outbox replace the app's old shadow-IndexedDB outbox, seq-CAS
// promote, and reconcile driver (all deleted). A note write is durable on a
// 'synced' or 'queued' result; a server refusal rejects DurableWriteError, which
// surfaces as an error (never a false "saved"). Concurrent same-note writes use
// the platform's built-in last-write-wins behavior; Notes does not layer another
// merge, conflict state machine, or resolver on top. See DESIGN.md for the model.

import React, { useState, useEffect, useMemo, useCallback, useRef, useDeferredValue } from 'react'
import { CSS } from './ui/css.js'
import { newNote, bumpRev, contentHash, isBlankNote } from './lib/note.js'
import { notesFromIndex } from './lib/index-cache.js'
import { visibleNotes } from './lib/visible.js'
import * as store from './lib/store.js'
import { bodyAttachmentRefs } from './lib/attachments.js'
import { makeNoteCollection } from './lib/collection.js'
import { notePath } from './lib/note-doc.js'
import { migrateLegacyNotes } from './lib/migrate.js'
import Grid from './ui/Grid.jsx'
import EditorPanel from './ui/EditorPanel.jsx'
import ConfirmModal from './ui/ConfirmModal.jsx'
import { Icon } from './ui/icons.jsx'
import { idleDocumentPath } from './lib/runtime-compat.js'

// A no-op document handle: the value the open-note hook returns under the
// unit-test harness, where window.mobius
// is absent. Keeps a stable shape so callers can read .value/.status/.lastError
// unconditionally.
const NO_DOC = { value: null, status: 'idle', lastError: null, update: async () => {}, set: async () => {}, refresh: async () => {} }
const NOTE_DOC_IDENTITY = (doc) => (doc && doc.meta ? doc.meta.id : undefined)

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
const IDLE_DOCUMENT_PATH = idleDocumentPath(
  HAS_RUNTIME_DOC ? window.mobius.runtimeFeatures : null,
)

function TopBar({ appId, query, onQuery, onCreate }) {
  const [iconOk, setIconOk] = useState(true)

  return (
    <header className="nt-topbar">
      <div className="nt-topbar-inner">
        <div className="nt-topbar-row">
          {/* Brand mark: the app's own glossy icon (downscaled + cached by the
              backend). Falls back to the accent dot if this install has no custom
              icon (the route 404s). */}
          {iconOk
            ? <img
                src={`/api/apps/${appId}/icon?size=128`}
                alt=""
                width={34} height={34}
                className="nt-brand-icon"
                onError={() => setIconOk(false)}
              />
            : <span className="nt-brand-fallback" aria-hidden="true">·</span>}
          <h1 className="nt-app-title">Notes</h1>
          <button
            type="button"
            className="nt-new-note-btn"
            onClick={onCreate}
            aria-label="New note"
            title="New note"
          ><Icon name="plus" size={20} /></button>
        </div>
        <label className="nt-search-wrap">
          <Icon name="search" size={17} />
          <input
            value={query} onChange={(e) => onQuery(e.target.value)}
            name="notes-search"
            autoComplete="off"
            placeholder="Search notes…" aria-label="Search notes"
            className="nt-search"
          />
        </label>
      </div>
    </header>
  )
}

function LoadingGrid() {
  return (
    <div className="nt-loading-grid" role="status" aria-live="polite" aria-label="Loading notes">
      <div className="nt-loading-label">
        <span className="nt-spinner" aria-hidden="true" />
        <span>Loading notes…</span>
      </div>
      <div className="nt-skeleton-grid" aria-hidden="true">
        {Array.from({ length: 6 }, (_, i) => (
          <div className="nt-skeleton-card" key={i}>
            <span className="nt-skeleton-line is-title" />
            <span className="nt-skeleton-line" />
            <span className="nt-skeleton-line" />
            <span className="nt-skeleton-line is-short" />
          </div>
        ))}
      </div>
    </div>
  )
}

function EmptyState({ filtered, onCreate }) {
  return (
    <div className="nt-empty">
      <div className="nt-empty-icon"><Icon name={filtered ? 'search' : 'note'} size={26} /></div>
      <div className="nt-empty-msg">{filtered ? 'No matching notes' : 'No notes yet'}</div>
      <div className="nt-empty-hint">
        {filtered
          ? 'Try another word or clear search to return to your notes.'
          : 'Jot a thought, a list, or a draft. Your agent can read and tidy them later.'}
      </div>
      {!filtered && (
        <button type="button" className="nt-empty-action" onClick={onCreate}>
          New note
        </button>
      )}
    </div>
  )
}

// A render error boundary around the app content: a crash in the grid/editor/preview
// subtree emits a `error {source:'boundary'}` signal (so Reflection sees render
// crashes, not just caught ones) and shows a plain recover-by-reopening message
// instead of a blank frame. It can only catch errors thrown by its CHILDREN, which
// is where the heavy render work (CodeMirror, markdown preview) lives.
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { crashed: false }
  }
  static getDerivedStateFromError() {
    return { crashed: true }
  }
  componentDidCatch(err) {
    window.mobius?.signal?.('error', { message: err?.message ?? 'render crash', source: 'boundary' })
  }
  render() {
    if (this.state.crashed) {
      return (
        <div className="nt-empty" role="alert">
          <div className="nt-empty-msg">Something went wrong</div>
          <div className="nt-empty-hint">Close and reopen Notes to recover. Your notes are safe.</div>
        </div>
      )
    }
    return this.props.children
  }
}

export default function App({ appId }) {
  // KaTeX's renderToString output (used by the live-preview editor for $…$ and
  // $$…$$ math) needs katex.min.css for its fraction/sizing/positioning rules;
  // without it every formula renders as overlapping fallback glyphs. Load the
  // platform's versioned same-origin stylesheet directly: its relative font
  // URLs stay under the same /vendor tree, satisfy CSP/CORS, and are available
  // from the platform's offline precache. No proxy or third-party network hop is
  // part of rendering.
  useEffect(() => {
    if (document.querySelector('link[data-nt-katex]')) return undefined
    const link = document.createElement('link')
    link.rel = 'stylesheet'
    link.href = '/vendor/katex@0.17.0/katex.min.css'
    link.setAttribute('data-nt-katex', '1')
    document.head.appendChild(link)
    return undefined
  }, [])

  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [view, setView] = useState({ mode: 'grid', id: null })
  const [draft, setDraft] = useState(null)
  const [confirmId, setConfirmId] = useState(null)
  const [saveError, setSaveError] = useState(null)
  // Ids whose LAST durable write was REFUSED (dead-lettered). The optimistic
  // upsert leaves such a note's in-memory value equal to its editor buffer, which
  // would make flushSave()/persist() short-circuit as 'nothing changed' and never
  // retry — closing the editor as if saved. Membership here forces the next flush
  // to re-issue the write regardless of buffer equality, until it lands.
  const [failedSaveIds, setFailedSaveIds] = useState(() => new Set())
  const gcTimer = useRef(null)
  const indexTimer = useRef(null)
  const editorNavOwned = useRef(false)
  // EditorPanel installs its durability-aware close function here. Shell Back
  // must use the same flush-before-leave path as the visible Back button; calling
  // App.back() directly would unmount the editor and cancel its 600ms autosave.
  const editorCloseRef = useRef(null)
  // Mirrors of the open-note id and the notes array for the DEBOUNCED gc callback,
  // which fires ~1.5s later and must read the CURRENT values, not the ones closed
  // over when scheduleGc was last created (a stale closure would pin the wrong
  // note's refs). Kept fresh by the effect below.
  const openIdRef = useRef(null)
  const notesRef = useRef([])
  const draftRef = useRef(null)
  const failedSaveIdsRef = useRef(new Set())
  // Connectivity as REACTIVE state (not a render-time store.isOnline() read, which
  // never updated until an unrelated re-render). Driven by the window online/offline
  // events; going online also re-lists the canonical notes (see the effect below),
  // because list() has no offline mirror so a cold offline load can't enumerate.
  const [online, setOnline] = useState(() => store.isOnline())
  const setDraftNow = useCallback((next) => {
    draftRef.current = typeof next === 'function' ? next(draftRef.current) : next
    setDraft(draftRef.current)
  }, [])

  const setNotesNow = useCallback((updater) => {
    const next = typeof updater === 'function' ? updater(notesRef.current) : updater
    notesRef.current = next
    setNotes(next)
    return next
  }, [])

  // The per-note document collection for notes not currently open. Built once so
  // a dynamic, unbounded note set works without
  // breaking React's rules of hooks. The open editor note ALSO gets a real
  // useDocument hook below — its writes and the collection's never target the
  // same path (grid actions act on closed notes; editor actions on the open one).
  const collection = useMemo(() => makeNoteCollection(), [])

  // The live document hook for the currently-open note (literal per-note
  // useDocument). It provides the open note's optimistic value, save status, and
  // lastError. The platform owns last-write-wins reconciliation for this document.
  const openId = view.mode === 'editor' ? view.id : null
  const openNote = openId ? notes.find((n) => n.meta.id === openId && !n.placeholder) : null
  const openPath = openId
    ? (openNote?.storagePath || notePath(openId))
    : IDLE_DOCUMENT_PATH
  // Keep the debounced-gc mirrors current (read in scheduleGc's setTimeout body).
  useEffect(() => { openIdRef.current = openId }, [openId])
  useEffect(() => { notesRef.current = notes }, [notes])
  useEffect(() => { draftRef.current = draft }, [draft])
  useEffect(() => { failedSaveIdsRef.current = failedSaveIds }, [failedSaveIds])
  // A null path is the current runtime's explicit idle document state: no read,
  // subscription, or write. Older embedded runtimes keep the prior sentinel
  // fallback until the app is recompiled, avoiding a bogus "null" document.
  // Keeping the live options stable also prevents an unrelated render from
  // re-arming an open note's subscription.
  const openDocOptions = useMemo(() => ({
    initial: null,
    identity: NOTE_DOC_IDENTITY,
    mode: 'lww',
  }), [])
  // Always called at a stable hook position; the test harness returns NO_DOC.
  const liveDoc = useDocument(openPath, openDocOptions)
  // useDocument returns a FRESH handle object every render, so depending on the whole
  // `liveDoc` in writeNote would rebuild writeNote → persist → the editor's flushSave
  // → its autosave effect on every unrelated parent re-render, churning the debounce
  // timer. Read the stable pieces through a ref instead; writeNote depends only on
  // openId, not the handle identity.
  const liveDocRef = useRef(liveDoc)
  liveDocRef.current = liveDoc

  // Surface the open note's durable-write failure as an actionable error (never a
  // silent loss, never a false save). A 'queued' result is durable success and
  // leaves status 'saving' with no lastError — so we only treat lastError as a
  // failure.
  useEffect(() => {
    if (openId && liveDoc.lastError) {
      setSaveError({ id: openId, message: 'Could not save — your edit is kept. Retrying when possible.' })
      setFailedSaveIds((s) => (s.has(openId) ? s : new Set(s).add(openId)))
    }
  }, [openId, liveDoc.lastError])

  // Mirror the platform's last-write-wins value back into the grid's `notes`
  // array. The editor buffer reconciles via its own note-prop effect.
  useEffect(() => {
    const v = liveDoc.value
    if (!openId || !v || !v.meta || v.meta.id !== openId) return
    setNotesNow((prev) => {
      const cur = prev.find((n) => n.meta.id === openId)
      if (cur && cur.body === v.body && cur.meta.content_hash === v.meta.content_hash) return prev
      return prev.map((n) => (n.meta.id === openId ? { ...n, meta: v.meta, body: v.body } : n))
    })
  }, [openId, liveDoc.value, setNotesNow])

  // Pure state updater — no IO. The derived index.json cache is (re)written by the
  // committed-notes effect below, NOT inside this updater: a side effect inside a
  // setNotes(prev => …) runs on React's StrictMode double-invoke too, which would
  // persist an index for state that gets discarded.
  const upsert = useCallback((meta, body) => {
    setNotesNow((prev) => (prev.some((n) => n.meta.id === meta.id)
      ? prev.map((n) => (n.meta.id === meta.id ? { ...n, meta, body, storagePath: n.storagePath } : n))
      : [{ meta, body }, ...prev]))
  }, [setNotesNow])

  // Debounced attachment GC. Deletes and body edits can orphan content-addressed
  // blobs; sweep them after the dust settles (the durable write has landed)
  // against the current authoritative note set. We PIN the open note's current
  // attachment refs (meta.attachments + every blob its body embeds) as referenced
  // even if the on-disk note write hasn't settled yet — a just-attached image's
  // ref can lag the GC's listNotes() read, and freeing the blob the editor is
  // actively showing is exactly the multi-image broken-link symptom.
  const scheduleGc = useCallback(() => {
    if (gcTimer.current) clearTimeout(gcTimer.current)
    gcTimer.current = setTimeout(() => {
      const open = openIdRef.current
      const cur = open ? notesRef.current.find((n) => n.meta.id === open) : null
      const pin = cur
        ? [...(cur.meta.attachments || []), ...bodyAttachmentRefs(cur.body || '')]
        : []
      store.gcAttachments(pin).catch(() => {})
    }, 1500)
  }, [])

  const canGcAfterDurableResult = useCallback((result) => (
    !(result && (result.durability === 'queued' || result.queued === true))
  ), [])

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
            setNotesNow((prev) => (prev.length ? prev : cached))
            setLoading(false)
          }
        })
        .catch(() => {})
      const canonical = await collection.list().catch(() => null)
      if (!live) return
      setLoading(false)
      if (canonical == null) {
        // Enumeration is UNAVAILABLE (offline cold load — list() has no offline
        // mirror). Do NOT wipe to empty: keep whatever the index.json cache already
        // painted, and report app_ready as offline with the currently-visible count.
        // The online event re-lists the moment we reconnect (effect below).
        window.mobius?.signal?.('app_ready', { item_count: notesRef.current.length, offline: true })
      } else {
        setNotesNow(canonical)
        window.mobius?.signal?.('app_ready', { item_count: canonical.length, offline: false })
      }
    })()
    return () => { live = false }
  }, [collection, setNotesNow])

  // Connectivity: keep `online` reactive to window events, and re-enumerate on
  // reconnect (a cold offline load couldn't list()). A successful re-list replaces
  // the index placeholders with the authoritative records.
  useEffect(() => {
    const goOnline = () => {
      setOnline(true)
      collection.list().then((canonical) => {
        if (canonical != null) { setNotesNow(canonical); setLoading(false) }
      }).catch(() => {})
    }
    const goOffline = () => setOnline(false)
    window.addEventListener('online', goOnline)
    window.addEventListener('offline', goOffline)
    return () => {
      window.removeEventListener('online', goOnline)
      window.removeEventListener('offline', goOffline)
    }
  }, [collection, setNotesNow])

  // Persist the derived index cache as a PURE effect on committed notes — never as a
  // side effect inside a setNotes updater (see upsert). Skip the pre-load paint so
  // we don't rewrite the index from a transient empty state.
  useEffect(() => {
    if (loading) return
    if (indexTimer.current) clearTimeout(indexTimer.current)
    indexTimer.current = setTimeout(() => {
      indexTimer.current = null
      store.writeIndex(notesRef.current).catch(() => {})
    }, 250)
    return () => {
      if (indexTimer.current) clearTimeout(indexTimer.current)
      indexTimer.current = null
    }
  }, [notes, loading])

  // Clear pending debounce timers on unmount.
  useEffect(() => () => {
    if (gcTimer.current) clearTimeout(gcTimer.current)
    if (indexTimer.current) clearTimeout(indexTimer.current)
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
    const cur = notesRef.current.find((n) => n.meta.id === id)
    if (!cur) return null
    if (!cur.placeholder) return cur
    const loaded = await collection.load(id).catch(() => null)
    if (!loaded || !loaded.meta || !loaded.meta.id) return null
    setNotesNow((prev) => prev.map((n) => (n.meta.id === id ? loaded : n)))
    return loaded
  }, [collection, setNotesNow])

  const openEditor = useCallback(async (id) => {
    const cur = notesRef.current.find((n) => n.meta.id === id)
    window.mobius?.signal?.('item_opened', { type: cur?.meta?.type || 'note' })
    setSaveError((e) => (e && failedSaveIdsRef.current.has(e.id) ? e : null))
    if (cur && cur.placeholder && !(await ensureAuthoritative(id))) {
      // The authoritative note isn't cached and we're offline, so it can't be
      // opened without clobbering the display-only placeholder. Tell the user
      // instead of silently no-op'ing; the grid stays put.
      setSaveError({ id, message: 'This note is not cached yet. Reconnect to open it.' })
      return
    }
    if (view.mode === 'editor') {
      setView({ mode: 'editor', id })
      return
    }
    editorNavOwned.current = await pushEditorNav()
    setView({ mode: 'editor', id })
  }, [ensureAuthoritative, pushEditorNav, view.mode])

  const createNote = useCallback(() => {
    const meta = newNote({})
    setDraftNow({ meta, body: '' })
    openEditor(meta.id).catch(() => setView({ mode: 'editor', id: meta.id }))
  }, [openEditor, setDraftNow])

  const handleOpen = useCallback((id) => {
    openEditor(id).catch(() => setView({ mode: 'editor', id }))
  }, [openEditor])

  // Persist a note's full document ({ meta, body }). EXACTLY ONE writer touches a
  // given note path: the OPEN editor note writes through its live useDocument
  // hook (liveDoc.update — the literal per-note document); every other note (grid
  // pin/color/delete on a closed note, a draft's first save) writes through the
  // collection's serialized last-write-wins update. The
  // routing is exclusive — the editor overlay owns the open note, so the grid
  // never acts on that same note — and the two writers can never target the same path
  // concurrently. Both serialize writes per path and resolve DURABLE
  // (synced/queued) or REJECT
  // DurableWriteError on a server refusal. We optimistically upsert the in-memory
  // note, then on a rejection keep the edit and surface an error so it is never
  // lost AND never falsely reported saved.
  const writeNote = useCallback(async (meta, body, { isDraftCommit = false, precomputedHash = null } = {}) => {
    const id = meta.id
    const m = { ...meta, updated: meta.updated || new Date().toISOString() }
    m.content_hash = precomputedHash || await contentHash(m, body)
    upsert(m, body)
    const writeThroughHook = HAS_RUNTIME_DOC && openId === id
    try {
      let result
      if (writeThroughHook) {
        // Read the live document through a ref — the handle identity changes every
        // render, so depending on it would churn this callback (and the editor's
        // autosave debounce) on every unrelated re-render.
        result = await liveDocRef.current.update(() => ({ meta: m, body }))
      } else {
        ;({ result } = await collection.update(id, () => ({ meta: m, body })))
      }
      setSaveError((e) => (e && e.id === id ? null : e))
      setFailedSaveIds((s) => { if (!s.has(id)) return s; const n = new Set(s); n.delete(id); return n })
      if (isDraftCommit) {
        setDraftNow(null)
        // First durable save of a draft == a real creation (distinct from autosaves).
        window.mobius?.signal?.('item_created', { type: m.type || 'note' })
      } else {
        window.mobius?.signal?.('item_updated', { type: m.type || 'note', durability: result?.durability })
      }
      if (canGcAfterDurableResult(result)) scheduleGc()
      return m
    } catch (err) {
      // Durable write REFUSED by the server (DurableWriteError). Do not claim a
      // save and do not lose the edit: keep the optimistic in-memory note (so the
      // buffer is preserved and the user can retry) and surface a visible error.
      // (An OFFLINE write does NOT land here — it resolves 'queued', durable
      // success.) We RE-THROW so callers learn the save failed: the editor's back
      // button must stay open (not close as if saved), and a closed-note grid
      // action must not report success. The saveError we set here drives the
      // visible 'Save failed' banner — in the editor (status) and, when no editor
      // is open, the grid-level banner. Same honest surfacing on both paths.
      window.mobius?.signal?.('error', { message: err?.message ?? 'save failed', source: 'writeNote' })
      setSaveError({ id, message: 'Could not save — your edit is kept. Retrying when possible.' })
      setFailedSaveIds((s) => (s.has(id) ? s : new Set(s).add(id)))
      throw err
    }
  }, [openId, upsert, collection, scheduleGc, setDraftNow, canGcAfterDurableResult])

  // Persist an edit from the editor or a draft. `updated` is stamped only when
  // the content actually changed (hash compare): the grid sorts on it, so a real
  // edit bumps the note to the top while opening a note — or a flush that didn't
  // change anything — never does.
  const persist = useCallback(async (meta, body) => {
    const currentDraft = draftRef.current
    if (currentDraft && currentDraft.meta.id === meta.id) {
      const next = { meta: { ...currentDraft.meta, ...meta }, body }
      setDraftNow(next)
      if (isBlankNote(next.meta, next.body)) return
      const nextHash = await contentHash(next.meta, next.body)
      await writeNote(next.meta, next.body, { isDraftCommit: true, precomputedHash: nextHash })
      return
    }
    const prev = notesRef.current.find((n) => n.meta.id === meta.id)
    if (prev && prev.placeholder) return // display-only; never persist a snippet
    const [nextHash, prevHash] = await Promise.all([
      contentHash(meta, body),
      prev ? contentHash(prev.meta, prev.body) : Promise.resolve(null),
    ])
    const retryingFailedWrite = failedSaveIdsRef.current.has(meta.id) && prevHash === nextHash
    // Skip a no-op write — UNLESS this id's last write FAILED. The optimistic
    // upsert makes `prev` equal the buffer, so the hash matches even though the
    // edit never reached the server; force the retry instead of silently dropping.
    if (!failedSaveIdsRef.current.has(meta.id) && prevHash != null && nextHash === prevHash) return
    // A genuinely new semantic edit advances the canonical revision. A retry of
    // the exact optimistic value keeps the already-bumped revision instead of
    // inventing a revision that was never accepted by storage.
    const stamped = retryingFailedWrite
      ? { ...meta, updated: new Date().toISOString() }
      : bumpRev(meta)
    await writeNote(stamped, body, { precomputedHash: nextHash })
  }, [writeNote, setDraftNow])

  const togglePin = useCallback(async (id) => {
    if (draft && draft.meta.id === id) {
      setDraftNow((d) => ({ ...d, meta: { ...d.meta, pinned: !d.meta.pinned } }))
      return
    }
    const n = await ensureAuthoritative(id)
    if (n) persist({ ...n.meta, pinned: !n.meta.pinned }, n.body).catch(() => {}) // saveError surfaces via the grid banner
  }, [draft, ensureAuthoritative, persist, setDraftNow])
  const setColor = useCallback(async (id, color) => {
    if (draft && draft.meta.id === id) {
      setDraftNow((d) => ({ ...d, meta: { ...d.meta, color } }))
      return
    }
    const n = await ensureAuthoritative(id)
    if (n) persist({ ...n.meta, color }, n.body).catch(() => {}) // saveError surfaces via the grid banner
  }, [draft, ensureAuthoritative, persist, setDraftNow])
  const toggleLock = useCallback(async (id) => {
    if (draft && draft.meta.id === id) {
      setDraftNow((d) => ({ ...d, meta: { ...d.meta, locked: !d.meta.locked } }))
      return
    }
    const n = await ensureAuthoritative(id)
    if (n) persist({ ...n.meta, locked: !n.meta.locked }, n.body).catch(() => {}) // saveError surfaces via the grid banner
  }, [draft, ensureAuthoritative, persist, setDraftNow])

  // Delete a note: remove its canonical document via the collection (the runtime
  // queues the delete offline and drains it on reconnect), then sweep orphaned
  // attachments after.
  const queueDelete = useCallback(async (id) => {
    const result = await collection.remove(id)
    if (canGcAfterDurableResult(result)) scheduleGc()
  }, [collection, scheduleGc, canGcAfterDurableResult])

  const doDelete = useCallback(async (id) => {
    setConfirmId(null)
    if (draft && draft.meta.id === id) {
      // An uncommitted draft (never durably saved) — discarding it is not a
      // deletion of a persisted item, so it emits no item_deleted signal.
      if (view.mode === 'editor' && view.id === id) popEditorNav()
      setDraftNow(null)
      setView({ mode: 'grid' })
      return
    }
    const n = notes.find((x) => x.meta.id === id)
    if (n?.meta?.locked) {
      setSaveError({ id, kind: 'delete', message: 'Unlock this note before deleting it.' })
      return
    }
    if (n) {
      try {
        await queueDelete(id)
        window.mobius?.signal?.('item_deleted', { type: n.meta.type || 'note' })
      } catch (err) {
        window.mobius?.signal?.('error', { message: err?.message ?? 'delete failed', source: 'deleteNote' })
        setSaveError({ id, kind: 'delete', message: 'Could not delete — the note is still here. Try again.' })
        return
      }
    }
    // index.json is rewritten by the committed-notes effect; no write inside the updater.
    setNotesNow((prev) => prev.filter((note) => note.meta.id !== id))
    setView((v) => {
      if (v.mode === 'editor' && v.id === id) {
        popEditorNav()
        return { mode: 'grid' }
      }
      return v
    })
  }, [draft, notes, popEditorNav, queueDelete, view.id, view.mode, setDraftNow, setNotesNow])

  const leaveEditor = useCallback((fromShell = false) => {
    if (!fromShell) popEditorNav()
    else editorNavOwned.current = false
  }, [popEditorNav])

  const back = useCallback(async (fromShell = false) => {
    const currentDraft = draftRef.current
    if (currentDraft && currentDraft.meta.id === view.id) {
      leaveEditor(fromShell)
      setDraftNow(null)
      setView({ mode: 'grid' })
      return
    }
    const n = notesRef.current.find((x) => x.meta.id === view.id)
    if (n && !n.placeholder && isBlankNote(n.meta, n.body)) {
      try {
        await queueDelete(n.meta.id)
      } catch (err) {
        window.mobius?.signal?.('error', { message: err?.message ?? 'delete failed', source: 'deleteBlankNote' })
        setSaveError({ id: n.meta.id, kind: 'delete', message: 'Could not delete — the note is still here. Try again.' })
        return
      }
      // index.json is rewritten by the committed-notes effect; no write inside the updater.
      leaveEditor(fromShell)
      setNotesNow((prev) => prev.filter((x) => x.meta.id !== n.meta.id))
      setView({ mode: 'grid' })
      return
    }
    leaveEditor(fromShell)
    setView({ mode: 'grid' })
  }, [leaveEditor, view.id, queueDelete, setDraftNow, setNotesNow])

  const shellBackRef = useRef(null)
  shellBackRef.current = () => {
    const closeEditor = editorCloseRef.current
    if (typeof closeEditor === 'function') closeEditor(true)
    else back(true)
  }
  useEffect(() => {
    const onMessage = (event) => {
      if (event.origin !== window.location.origin) return
      if (event.data?.type === 'moebius:nav-back') shellBackRef.current?.()
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Keep the controlled search field immediate while the potentially large grid
  // update is interruptible. Combined with near-viewport card hydration, clearing
  // a search no longer blocks the next keystroke on large local notebooks.
  const deferredQuery = useDeferredValue(query)
  const visible = useMemo(() => visibleNotes(notes, deferredQuery), [notes, deferredQuery])

  // A search that lands on zero results, debounced so we emit once per STABLE query
  // (not per keystroke). Only the query LENGTH is sent — never the query text (no
  // PII). Reflection can propose tags/fuzzy search from real failed retrievals.
  useEffect(() => {
    const q = deferredQuery.trim()
    if (loading || !q || visible.length > 0) return undefined
    const h = setTimeout(() => {
      window.mobius?.signal?.('search_no_results', { query_len: q.length })
    }, 700)
    return () => clearTimeout(h)
  }, [deferredQuery, visible.length, loading])

  // The editor only ever mounts an authoritative note (or an in-memory draft) —
  // never a cold-load placeholder; openEditor swaps placeholders out first.
  const editing = view.mode === 'editor'
    ? (notes.find((n) => n.meta.id === view.id && !n.placeholder) || (draft && draft.meta.id === view.id ? draft : null))
    : null
  // Standard: silent when healthy. Saving/pending is plumbing — only Offline and
  // hard save/delete errors surface.
  const status = saveError && editing && saveError.id === editing.meta.id
    ? (saveError.kind === 'delete' ? 'Delete failed' : 'Save failed')
    : !online ? 'Offline'
    : null

  return (
    <div className="nt-root">
      <style>{CSS}</style>
      <ErrorBoundary>
      <div
        className="nt-home"
        aria-hidden={editing ? 'true' : undefined}
        inert={editing ? true : undefined}
      >
      <TopBar appId={appId} query={query} onQuery={setQuery} onCreate={createNote} />
      {/* Closed-note save failure (a grid pin/color, or a back-out after a refused
          save) has no editor to show a status banner — surface it here so a
          dead-lettered write is never silently lost. The edit is kept in memory;
          re-opening the note lets the user retry. Mirrors the editor's honest
          'Save failed' status; only shown when no editor is open (the editor's
          own banner covers the open note). */}
      {!editing && saveError && (
        <div className="nt-save-err" role="alert" aria-live="assertive">
          <span className="nt-save-err-msg">{saveError.message}</span>
          <button
            type="button"
            className="nt-save-err-btn"
            onClick={() => setSaveError(null)}
            aria-label="Dismiss save error"
          >Dismiss</button>
        </div>
      )}
      <main className="nt-scroll">
        {loading
          ? <LoadingGrid />
          : visible.length === 0
            ? <EmptyState filtered={!!deferredQuery.trim()} onCreate={createNote} />
            : <Grid
                notes={visible}
                onOpen={handleOpen}
                onPin={togglePin}
                onColor={setColor}
                onLock={toggleLock}
                onDelete={setConfirmId}
                resolveAttachment={store.attachmentURL}
              />}
      </main>

      </div>

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
          forceSave={failedSaveIds.has(editing.meta.id)}
          closeRequestRef={editorCloseRef}
          inactive={!!confirmId}
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

      {/* Silent when healthy: the pill mounts ONLY when offline, and not over the
          editor overlay (which shows its own 'Offline' status). Plain copy, no
          counts/timestamps. */}
      {!online && view.mode !== 'editor' && (
        <div className="nt-sync-pill" role="status">Offline</div>
      )}
      </ErrorBoundary>
    </div>
  )
}
