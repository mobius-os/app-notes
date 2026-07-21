// Overlay note editor: header (back, title, pin, color, lock, type toggle,
// attach, status, delete) + live-inline CodeMirror body. Image attachments the
// body no longer embeds render in a strip below the editor (see strandedImageRefs).
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { strandedImageRefs, bodyAttachmentRefs } from '../lib/attachments.js'
import { releaseAttachment } from '../lib/attachment-leases.js'
import { toSdrImage } from '../lib/sdr-image.js'
import { merge3 } from '../lib/merge.js'
import ColorPicker from './ColorPicker.jsx'
import Editor from '../editor/Editor.jsx'
import { Icon } from './icons.jsx'

const AUTOSAVE_MS = 600
const EDITOR_DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

// Ask the owner shell to spawn an agent chat to resolve a note's merge conflict.
// The on-disk data dir is keyed by the app's NUMERIC storage id, not the slug:
// the frame hands the app as `appId`. Building the draft's paths from `appId`
// keeps the on-demand chat pointed at the dir that actually exists; a hard-coded slug
// path (`/data/apps/notes/`) does not exist, so the agent's reads always fail.
// Notes are JSON documents ({ meta, body }) at notes/<id>.json now (post the
// useDocument migration); the body field holds the markdown.
function resolveNow(note, appId) {
  try {
    const data = `/data/apps/${appId}`
    window.parent.postMessage({
      type: 'moebius:new-chat',
      draft: `Resolve the Notes merge conflict for note ${note.meta.id}: read the descriptor under ${data}/conflicts/${note.meta.id}/, 3-way-merge mine + server against base (preserve attachment refs), write the result to ${data}/notes/${note.meta.id}.json as a JSON object {"meta":{...},"body":"<merged markdown>"}, then mark the descriptor resolved.`,
    }, window.location.origin)
  } catch (e) {}
}

// Map status string to modifier class for the status indicator. Using modifier
// classes instead of a per-render cssVar snapshot avoids stale values on live
// theme switches. 'Synced' is not shown (standard: nothing when online+idle).
function statusClass(status) {
  if (status === 'Resolving…') return 'is-resolving'
  return 'is-default'
}

function editorDate(meta) {
  const raw = meta.updated || meta.created
  if (!raw) return 'Draft'
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return 'Draft'
  return `Edited ${EDITOR_DATE_FORMATTER.format(d)}`
}

function wordCount(body) {
  const words = String(body || '').trim().match(/\S+/g)
  return words ? words.length : 0
}

function taskSummary(body) {
  const tasks = String(body || '').match(/^- \[[ x]\] /gim) || []
  if (!tasks.length) return ''
  const done = tasks.filter((task) => /\[[xX]\]/.test(task)).length
  return `${tasks.length} task${tasks.length === 1 ? '' : 's'} · ${done} done`
}

export default function EditorPanel({ appId, note, onSave, onBack, onPin, onColor, onDelete, onExternalConflict, resolveAttachment, putAttachment, conflict, status, forceSave, closeRequestRef, inactive = false }) {
  const [title, setTitle] = useState(note.meta.title || '')
  const [body, setBody] = useState(note.body || '')
  const [showColors, setShowColors] = useState(false)
  const [attachErr, setAttachErr] = useState('')
  const [externalConflict, setExternalConflict] = useState(false)
  const [closing, setClosing] = useState(false)
  const timer = useRef(null)
  const viewRef = useRef(null)
  const sheetRef = useRef(null)
  const backRef = useRef(null)
  const titleRef = useRef(null)
  const openerRef = useRef(null)
  const focusTimer = useRef(null)
  const closeInFlight = useRef(null)
  const pendingSaves = useRef(new Set())
  const imageRef = useRef(null)
  const fileRef = useRef(null)
  const colorBtnRef = useRef(null)
  // `latest` always names the note the title/body BUFFER currently belongs to.
  // It is only re-pointed at a new note AFTER that note's edits have been
  // flushed (see the id-change effect), so a debounced flush never writes the
  // outgoing buffer under the incoming note's meta.
  const latest = useRef({ note, title: note.meta.title || '', body: note.body || '' })
  // The `note.body` prop value the editor buffer was last reconciled against — the
  // 3-way merge BASE for an EXTERNAL rewrite of the SAME note (agent conflict
  // resolve or another device). When `note.body` changes while the
  // id is unchanged, the reconcile effect merges the live buffer (mine) with the
  // incoming body (theirs) against this base and repoints it. Seeded to the first
  // note body; reset on every note-swap and every reconcile.
  const reconciledBody = useRef(note.body || '')
  const reconciledTitle = useRef(note.meta.title || '')
  const localSaveBodies = useRef(new Set())
  const externalConflictRef = useRef(false)
  const externalConflictKey = useRef('')

  const isChecklist = note.meta.type === 'checklist'
  const locked = !!note.meta.locked

  useEffect(() => {
    // Keep the buffer in sync only while the note identity is unchanged; the
    // id-change effect below owns the note swap (and the pre-swap flush).
    if (latest.current.note.meta.id === note.meta.id) {
      latest.current = { note, title, body }
    }
  }, [note, title, body])

  const saveCurrentNote = useCallback((meta, nextBody) => {
    if (externalConflictRef.current) {
      return Promise.reject(new Error('Resolve the incoming edit before saving this note.'))
    }
    localSaveBodies.current.add(nextBody ?? '')
    let request
    try { request = Promise.resolve(onSave(meta, nextBody)) }
    catch (err) { request = Promise.reject(err) }
    pendingSaves.current.add(request)
    const clear = () => pendingSaves.current.delete(request)
    request.then(clear, clear)
    return request
  }, [onSave])

  const liveBody = useCallback(() => (
    viewRef.current ? viewRef.current.state.doc.toString() : latest.current.body
  ), [])

  const replaceEditorBody = useCallback((nextBody) => {
    const v = viewRef.current
    if (v) {
      const cur = v.state.doc.toString()
      if (cur !== nextBody) {
        v.dispatch({ changes: { from: 0, to: cur.length, insert: nextBody } })
      }
    } else {
      setBody(nextBody)
    }
  }, [])

  const saveMetaPatch = useCallback((patch, bodyOverride) => {
    const cur = latest.current
    if (!cur?.note) return Promise.resolve()
    if (timer.current) clearTimeout(timer.current)
    const nextBody = bodyOverride ?? liveBody()
    const attachments = Array.from(new Set([
      ...(cur.note.meta.attachments || []),
      ...bodyAttachmentRefs(nextBody),
    ]))
    const nextMeta = { ...cur.note.meta, title: cur.title, attachments, ...patch }
    latest.current = { note: { ...cur.note, meta: nextMeta, body: nextBody }, title: cur.title, body: nextBody }
    return saveCurrentNote(nextMeta, nextBody)
  }, [liveBody, saveCurrentNote])

  const flushSave = useCallback(() => {
    const cur = latest.current
    if (!cur?.note) return Promise.resolve()
    if (cur.note.meta.locked && !forceSave) return Promise.resolve()
    // Source the body from the LIVE CodeMirror doc, not the lagging React `body`
    // state: an image insert dispatches into the editor and returns the new doc
    // synchronously, but the React state that the autosave debounce captured may
    // still be a pre-insert snapshot. Persisting that snapshot would drop a just-
    // inserted `![](attachments/…)` ref (the multi-image broken-link bug). The CM
    // doc is the single source of truth for the visible body, so flush it.
    const currentBody = liveBody()
    // Normally a buffer that equals the note is a no-op. But after a REFUSED save
    // the optimistic note prop already equals the buffer, so that equality would
    // make us skip the retry and close as if saved. `forceSave` (the app flagging
    // this id's last write as failed) overrides the skip so the write is re-issued
    // until it actually lands.
    if (!forceSave && cur.title === (cur.note.meta.title || '') && currentBody === (cur.note.body || '')) {
      // The prop can already equal the buffer because writeNote optimistically
      // upserts before its durable write settles. That is not a true no-op on
      // exit: wait for every save already in flight so a slow write cannot be
      // mistaken for saved content and bypass the close gate.
      return pendingSaves.current.size
        ? Promise.all([...pendingSaves.current]).then(() => undefined)
        : Promise.resolve()
    }
    if (timer.current) clearTimeout(timer.current)
    // Preserve attachments: persist's merge unions meta.attachments, but a flush
    // that wrote `{ ...meta, title }` with no attachments key still carried the
    // note's existing attachments via the prop spread — keep that, and additionally
    // union any attachment refs the live body embeds, so an autosave can never drop
    // an image record that the body still references mid-attach.
    const attachments = Array.from(new Set([
      ...(cur.note.meta.attachments || []),
      ...bodyAttachmentRefs(currentBody),
    ]))
    const alreadyPending = [...pendingSaves.current]
    const request = saveCurrentNote({ ...cur.note.meta, title: cur.title, attachments }, currentBody)
    return Promise.all([...alreadyPending, request]).then(() => undefined)
  }, [saveCurrentNote, forceSave, liveBody])

  const closeEditor = useCallback((fromShell = false) => {
    if (closeInFlight.current) return closeInFlight.current
    setShowColors(false)
    setClosing(true)
    const run = (async () => {
      try {
        await flushSave()
      } catch {
        setClosing(false)
        return false
      }
      setClosing(false)
      await onBack(fromShell)
      return true
    })()
    closeInFlight.current = run
    const clear = () => { if (closeInFlight.current === run) closeInFlight.current = null }
    run.then(clear, clear)
    return run
  }, [flushSave, onBack])

  // Give the owner shell the exact same close path as the visible Back button.
  // This closes the debounce-loss bypass where shell Back unmounted the editor
  // before its pending buffer had been flushed.
  useEffect(() => {
    if (!closeRequestRef) return undefined
    closeRequestRef.current = closeEditor
    return () => {
      if (closeRequestRef.current === closeEditor) closeRequestRef.current = null
    }
  }, [closeEditor, closeRequestRef])

  // Treat the editor as the modal its ARIA contract advertises: move focus into
  // it on open and restore the card/FAB that launched it on close.
  useEffect(() => {
    const active = typeof document !== 'undefined' ? document.activeElement : null
    openerRef.current = active && active !== document.body ? active : null
    const focusEditor = () => {
      focusTimer.current = null
      if (locked) backRef.current?.focus?.()
      else if (viewRef.current?.focus) viewRef.current.focus()
      else titleRef.current?.focus?.()
    }
    if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
      focusTimer.current = window.requestAnimationFrame(focusEditor)
    } else {
      focusTimer.current = setTimeout(focusEditor, 0)
    }
    return () => {
      if (focusTimer.current != null) {
        if (typeof window !== 'undefined' && typeof window.cancelAnimationFrame === 'function') window.cancelAnimationFrame(focusTimer.current)
        else clearTimeout(focusTimer.current)
      }
      const opener = openerRef.current
      const stillMounted = typeof document === 'undefined' || typeof document.contains !== 'function' || document.contains(opener)
      if (opener && stillMounted && typeof opener.focus === 'function') opener.focus()
      else {
        const focusFallback = () => document.querySelector?.('.nt-fab:not([hidden])')?.focus?.()
        if (typeof window !== 'undefined' && typeof window.requestAnimationFrame === 'function') {
          window.requestAnimationFrame(focusFallback)
        } else {
          setTimeout(focusFallback, 0)
        }
      }
    }
    // Focus is an open/close concern; a later lock toggle must not steal focus.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const onDialogKeyDown = useCallback((e) => {
    if (inactive) return
    if (e.key === 'Escape') {
      e.preventDefault()
      e.stopPropagation()
      if (showColors) setShowColors(false)
      else closeEditor()
      return
    }
    if (e.defaultPrevented) return
    if (e.key !== 'Tab' || showColors) return
    const candidates = sheetRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [contenteditable="true"], [tabindex]:not([tabindex="-1"])'
    )
    const focusable = Array.from(candidates || []).filter((el) => (
      typeof el.getClientRects !== 'function' || el.getClientRects().length > 0
    ))
    if (!focusable.length) {
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [closeEditor, inactive, showColors])

  // Switching directly from one note to another in the editor: flush the
  // OUTGOING note's pending edits (held in `latest`, still pointing at the old
  // note) BEFORE resetting the buffer to the incoming note. Without this, the
  // debounced autosave for the old note never fires and its unsaved edits are
  // silently dropped.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    flushSave().catch(() => {}) // a refused save surfaces via the saveError banner; don't throw on note-swap
    latest.current = { note, title: note.meta.title || '', body: note.body || '' }
    reconciledBody.current = note.body || ''
    reconciledTitle.current = note.meta.title || ''
    localSaveBodies.current.clear()
    externalConflictRef.current = false
    externalConflictKey.current = ''
    setExternalConflict(false)
    setTitle(note.meta.title || '')
    setBody(note.body || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.meta.id])

  useEffect(() => {
    if (latest.current.note.meta.id !== note.meta.id) return
    const incoming = note.meta.title || ''
    const base = reconciledTitle.current
    if (incoming === base) return
    if (title === base) setTitle(incoming)
    reconciledTitle.current = incoming
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.meta.title, note.meta.id, title])

  // Reconcile the live buffer with an EXTERNAL rewrite of the OPEN note. When the
  // agent conflict-resolver or another device writes
  // notes/<id>.json, the app mirrors the new value into the grid and re-passes it as
  // `note` (same id, new `note.body`). Without this effect the buffer keeps the OLD
  // body: the editor never repaints AND the ~600ms autosave then writes the stale
  // buffer back over the external body (the data-loss bug). Here we 3-way merge the
  // incoming body (theirs) with the live buffer (mine) against the last-reconciled
  // body (base) and push the result into CodeMirror, so the editor repaints and the
  // autosave no-op check sees buffer == note.body (no stale clobber). A same-id
  // note.body change is the only trigger; the note-swap effect above owns id changes
  // (it resets reconciledBody first, so a swap short-circuits on incoming === base).
  useEffect(() => {
    if (latest.current.note.meta.id !== note.meta.id) return // a swap; handled above
    const incoming = note.body || ''
    const base = reconciledBody.current
    if (incoming === base) return // no external change (our own save echo, or a no-op)
    const v = viewRef.current
    const mineBuf = v ? v.state.doc.toString() : body
    // A local save echo is not an external rewrite. It may be older than the live
    // editor if the user kept typing after autosave started; pushing it back into
    // CodeMirror is the random-letter/duplication bug. Advance the merge base so
    // future real external edits merge against the acknowledged snapshot, but do
    // not touch the live buffer.
    if (localSaveBodies.current.has(incoming)) {
      localSaveBodies.current.delete(incoming)
      reconciledBody.current = incoming
      return
    }
    // No local unsaved edits → adopt theirs verbatim; otherwise 3-way merge so the
    // user's in-flight edits are preserved alongside the external change.
    const mergedResult = mineBuf === base ? { conflict: false, text: incoming } : merge3(base, mineBuf, incoming)
    if (mergedResult.conflict) {
      if (timer.current) clearTimeout(timer.current)
      const key = `${note.meta.id}\u0000${base}\u0000${mineBuf}\u0000${incoming}`
      externalConflictRef.current = true
      setExternalConflict(true)
      if (externalConflictKey.current !== key) {
        externalConflictKey.current = key
        const cur = latest.current
        const attachments = Array.from(new Set([
          ...(cur.note.meta.attachments || []),
          ...bodyAttachmentRefs(mineBuf),
        ]))
        const baseMeta = { ...cur.note.meta, title: reconciledTitle.current }
        const mineMeta = { ...cur.note.meta, title: cur.title, attachments }
        Promise.resolve(onExternalConflict?.({
          base: { meta: baseMeta, body: base },
          mine: { meta: mineMeta, body: mineBuf },
          theirs: { meta: note.meta, body: incoming },
        })).catch(() => {})
      }
      return
    }
    const merged = mergedResult.text
    reconciledBody.current = incoming
    externalConflictRef.current = false
    externalConflictKey.current = ''
    setExternalConflict(false)
    if (v) {
      const cur = v.state.doc.toString()
      if (cur !== merged) {
        // Preserve the caret as best we can across a full-doc replace (clamped to
        // the new length). The updateListener turns this dispatch into onChange →
        // setBody, keeping React state in sync; guard so this isn't retreated as a
        // fresh local edit (merged === note.body when there were no local edits → the
        // autosave effect sees a no-op; otherwise autosave persists the merged buffer).
        const head = v.state.selection.main.head
        v.dispatch({
          changes: { from: 0, to: cur.length, insert: merged },
          selection: { anchor: Math.min(head, merged.length) },
        })
      } else {
        setBody(merged)
      }
    } else {
      setBody(merged)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.body])

  useEffect(() => {
    if (locked) {
      if (timer.current) clearTimeout(timer.current)
      return undefined
    }
    if (title === (note.meta.title || '') && body === (note.body || '')) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { flushSave().catch(() => {}) }, AUTOSAVE_MS)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, flushSave, locked])

  useEffect(() => {
    const flushOnHide = () => { if (document.visibilityState === 'hidden') flushSave().catch(() => {}) }
    const flushOnUnload = () => { flushSave().catch(() => {}) }
    document.addEventListener('visibilitychange', flushOnHide)
    window.addEventListener('beforeunload', flushOnUnload)
    return () => {
      document.removeEventListener('visibilitychange', flushOnHide)
      window.removeEventListener('beforeunload', flushOnUnload)
    }
  }, [flushSave])

  // Toggle note type between 'note' and 'checklist'. When switching TO checklist
  // and the body has no list items yet, prepend a starter item.
  const toggleType = useCallback(() => {
    if (locked) return
    const nextType = isChecklist ? 'note' : 'checklist'
    const currentBody = liveBody()
    let nextBody = currentBody
    if (nextType === 'checklist' && currentBody.trim() && !/^- \[[ x]\] /m.test(currentBody)) {
      // Wrap existing content as first checklist item
      nextBody = currentBody.replace(/^(.+)/m, '- [ ] $1')
    } else if (nextType === 'checklist' && !currentBody.trim()) {
      nextBody = '- [ ] '
    }
    if (nextBody !== currentBody) replaceEditorBody(nextBody)
    // A refused save rejects; the saveError banner surfaces it. Swallow here so a
    // type-toggle doesn't raise an unhandled rejection.
    saveMetaPatch({ type: nextType }, nextBody).catch(() => {})
  }, [isChecklist, liveBody, replaceEditorBody, saveMetaPatch, locked])

  function insertMarkdown(md) {
    if (locked) return liveBody()
    const v = viewRef.current
    if (v) {
      v.dispatch(v.state.replaceSelection(md))
      v.focus()
      return v.state.doc.toString()
    }
    const next = body + md
    setBody(next)
    return next
  }

  async function handleFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (locked) return
    if (!f || !putAttachment) return
    // CANCEL the pending autosave before the (slow) async attach work. The SDR
    // flatten (toSdrImage) re-encodes through a canvas, which widens the window in
    // which a debounce armed by a keystroke BEFORE the attach could fire a PRE-
    // insert snapshot mid-await — a second writer that clobbers the just-inserted
    // image ref (the multi-image broken-link race). With the timer cleared, the
    // single write below is the only one in flight for this attach.
    if (timer.current) clearTimeout(timer.current)
    const isImage = (f.type || '').startsWith('image/')
    let res
    let nextBody
    try {
      // Flatten images to SDR sRGB before storing: an Android "Ultra HDR" capture
      // would otherwise promote the whole display surface to HDR on render and
      // tone-shift the surrounding SDR UI (shell + app). toSdrImage drops the gain
      // map by re-encoding through a 2D canvas; on any decode/encode failure it
      // returns the original file so the attachment is never lost.
      const upload = isImage ? await toSdrImage(f) : f
      res = await putAttachment(upload)
      // Escape brackets in the filename before it becomes markdown alt/link text:
      // a literal `]` would terminate the `![alt]`/`[text]` span early and leave
      // raw filename characters visible (or break the ref). The URL comes from
      // res.path (sha-based, bracket-free), so only the display name needs it.
      const label = String(res.name || '').replace(/[[\]]/g, '')
      const md = isImage ? `\n![${label}](${res.path})\n` : `[${label}](${res.path})`
      // Insert into the LIVE editor and read back the resulting doc — this already
      // contains EVERY prior image ref plus the one just inserted, so basing the
      // write on it (not a captured React snapshot) is what makes a second/third
      // image survive.
      nextBody = insertMarkdown(md)
    } catch (err) {
      // The ATTACH itself failed (SDR flatten, putAttachment, or the 25 MB cap):
      // the image was never inserted, so the live body is unchanged. Show the
      // attach error and rescue the pre-existing unsaved text (its autosave was
      // cancelled up-front, so a crash before the next trigger would lose it).
      setAttachErr(String(err && err.message || err).includes('limit') ? 'File too large (max 25 MB).' : 'Could not attach file.')
      setTimeout(() => setAttachErr(''), 3500)
      flushSave().catch(() => {})
      return
    }
    // The blob landed and the ref is in the body; now persist. Union meta.attachments
    // from the note's existing record AND every ref the live body now embeds, so no
    // ref is ever dropped and no in-body blob is left without an attachments record
    // for the GC to reclaim.
    const attachments = Array.from(new Set([
      ...(note.meta.attachments || []),
      ...bodyAttachmentRefs(nextBody),
      res.path,
    ]))
    // putAttachment leased res.path as in-flight (GC-pinned) before the blob hit
    // disk. Hold that lease across onSave so a debounced GC firing in the pre-write
    // window can't free the brand-new blob, then release ONLY after onSave resolves
    // — the note now durably references the path, so the listNotes()-derived
    // referenced set covers it.
    try {
      await saveCurrentNote({ ...note.meta, title, attachments }, nextBody)
      releaseAttachment(res.path)
      setAttachErr('')
      window.mobius?.signal?.('attachment_added', { kind: isImage ? 'image' : 'file', bytes: f.size || 0, flattened: isImage })
    } catch (err) {
      // The SAVE was refused (durable-write dead-letter), NOT the attach. The app
      // surfaces this via its own 'Save failed' banner (writeNote sets saveError) —
      // do NOT mislabel it "Could not attach file" (the attach succeeded and the
      // image IS in the editor). KEEP the in-flight lease so a retry can't let the
      // GC free the still-referenced blob.
    }
  }

  // Image attachments with no embed left in the body — render them in a strip
  // so they stay visible inside the note (they already show on the card).
  const stranded = useMemo(() => strandedImageRefs(note.meta, body), [note.meta, body])
  const strandedKey = stranded.join('\n')
  const [strandedUrls, setStrandedUrls] = useState([])
  useEffect(() => {
    let live = true
    let urls = []
    const refs = strandedKey ? strandedKey.split('\n') : []
    setStrandedUrls([])
    if (!refs.length || !resolveAttachment) return () => {}
    Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null)))
      .then((resolved) => {
        const next = resolved.filter(Boolean)
        if (!live) { next.forEach((u) => URL.revokeObjectURL(u)); return }
        urls = next
        setStrandedUrls(next)
      })
      .catch(() => {})
    return () => { live = false; urls.forEach((u) => URL.revokeObjectURL(u)) }
  }, [strandedKey, resolveAttachment])

  const count = wordCount(body)
  const tasks = taskSummary(body)

  return (
    <div
      className="nt-editor-root"
      aria-hidden={inactive ? 'true' : undefined}
      inert={inactive ? true : undefined}
      onClick={(e) => { if (!inactive && e.target === e.currentTarget) closeEditor() }}
    >
      <section
        ref={sheetRef}
        className={`nt-editor-sheet${locked ? ' is-locked' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-busy={closing ? 'true' : undefined}
        aria-label={title || 'Untitled note'}
        onKeyDown={onDialogKeyDown}
        onClick={(e) => e.stopPropagation()}
      >
      <header className="nt-editor-hdr">
        <div className="nt-editor-toolbar">
          <button
            ref={backRef}
            type="button"
            onClick={() => closeEditor()}
            aria-label="Back"
            disabled={closing}
            className="nt-hdr-btn"
          ><Icon name="back" size={18} /></button>
          <div className="nt-editor-actions" role="toolbar" aria-label="Note actions">
            <button
              type="button"
              onClick={() => {
                const current = latest.current?.note?.meta?.pinned
                saveMetaPatch({ pinned: !current }).catch(() => {})
              }}
              aria-label={note.meta.pinned ? 'Unpin' : 'Pin'}
              aria-pressed={note.meta.pinned}
              disabled={closing}
              title={note.meta.pinned ? 'Unpin' : 'Pin'}
              className={`nt-hdr-btn${note.meta.pinned ? ' is-active' : ''}`}
            ><Icon name="pin" size={16} /></button>
            <div ref={colorBtnRef} className="nt-color-anchor">
              <button
                type="button"
                onClick={() => setShowColors((v) => !v)}
                aria-label="Color"
                title="Color"
                disabled={closing}
                className="nt-hdr-btn"
              ><Icon name="palette" size={17} /></button>
              {showColors && (
                <ColorPicker
                  anchorRef={colorBtnRef}
                  placement="below"
                  align="start"
                  current={note.meta.color}
                  onPick={(c) => { saveMetaPatch({ color: c }).catch(() => {}); setShowColors(false) }}
                  onDismiss={() => setShowColors(false)}
                />
              )}
            </div>
            <button
              type="button"
              onClick={() => saveMetaPatch({ locked: !locked }).catch(() => {})}
              aria-label={locked ? 'Unlock note' : 'Lock note'}
              aria-pressed={locked}
              disabled={closing}
              title={locked ? 'Unlock note' : 'Lock note'}
              className={`nt-hdr-btn${locked ? ' is-active' : ''}`}
            ><Icon name={locked ? 'lock' : 'unlock'} size={16} /></button>
            <button
              type="button"
              onClick={toggleType}
              aria-label={isChecklist ? 'Switch to note' : 'Switch to checklist'}
              aria-pressed={isChecklist}
              disabled={locked || closing}
              title={isChecklist ? 'Switch to note' : 'Switch to checklist'}
              className={`nt-hdr-btn${isChecklist ? ' is-active' : ''}`}
            ><Icon name={isChecklist ? 'checklist' : 'note'} size={16} /></button>
            <button
              type="button"
              onClick={() => imageRef.current && imageRef.current.click()}
              aria-label="Insert image"
              title="Insert image"
              disabled={locked || closing}
              className="nt-hdr-btn"
            ><Icon name="image" size={16} /></button>
            <button
              type="button"
              onClick={() => fileRef.current && fileRef.current.click()}
              aria-label="Attach file"
              title="Attach file"
              disabled={locked || closing}
              className="nt-hdr-btn"
            ><Icon name="file" size={16} /></button>
          </div>
          <div className="nt-hdr-spacer" />
          {(closing || status) && (
            <span className={`nt-status ${statusClass(closing ? null : status)}`} role="status" aria-live="polite">
              {closing ? 'Saving…' : status}
            </span>
          )}
          <button
            type="button"
            onClick={() => onDelete(note.meta.id)}
            aria-label="Delete"
            title={locked ? 'Unlock to delete' : 'Delete'}
            disabled={locked || closing}
            className="nt-hdr-btn is-danger"
          ><Icon name="trash" size={16} /></button>
        </div>
        <input ref={imageRef} type="file" name="note-image-attachment" accept="image/*" onChange={handleFile} disabled={locked} className="nt-file-input" />
        <input ref={fileRef} type="file" name="note-file-attachment" onChange={handleFile} disabled={locked} className="nt-file-input" />
      </header>

      {(conflict || externalConflict) && (
        <div className="nt-conflict-bar" role="status">
          <span className="nt-conflict-msg">Edited in two places — merging…</span>
          {conflict && <button type="button" onClick={() => resolveNow(note, appId)} className="nt-conflict-btn">Resolve now</button>}
        </div>
      )}

      {attachErr && (
        <div className="nt-attach-err" role="alert">{attachErr}</div>
      )}

      <div className="nt-editor-title-band">
        <input
          ref={titleRef}
          name="note-title"
          autoComplete="off"
          value={title}
          readOnly={locked || closing}
          onChange={(e) => { if (!locked && !closing) setTitle(e.target.value) }}
          placeholder="Title"
          aria-label="Note title"
          className="nt-title-input"
        />
      </div>

      <div className="nt-editor-body">
        <Editor value={body} onChange={locked || closing ? () => {} : setBody} resolveAttachment={resolveAttachment} viewRef={viewRef} syncKey={note.meta.id} readOnly={locked || closing} />
      </div>

      <footer className="nt-editor-foot" aria-label="Note metadata">
        <span>{editorDate(note.meta)}</span>
        <span>{count} word{count === 1 ? '' : 's'}</span>
        {tasks && <span>{tasks}</span>}
        {locked && <span>Locked</span>}
      </footer>

      {strandedUrls.length > 0 && (
        <div className="nt-attach-strip" aria-label="Attached images">
          {strandedUrls.map((u) => (
            <img key={u} src={u} alt="" className="nt-attach-thumb" />
          ))}
        </div>
      )}
      </section>
    </div>
  )
}
