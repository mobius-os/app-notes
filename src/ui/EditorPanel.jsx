// Full-screen note editor: header (back, title, pin, color, type toggle,
// attach, status, delete) + live-inline CodeMirror body. Image attachments the
// body no longer embeds render in a strip below the editor (see strandedImageRefs).
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { normalizeColorName } from './colors.js'
import { strandedImageRefs } from '../lib/attachments.js'
import ColorPicker from './ColorPicker.jsx'
import Editor from '../editor/Editor.jsx'
import { Icon } from './icons.jsx'

const AUTOSAVE_MS = 600

// Ask the owner shell to spawn an agent chat to resolve a note's merge conflict
// (the autonomous cron resolver also handles it; this is the on-demand path).
function resolveNow(note) {
  try {
    window.parent.postMessage({
      type: 'moebius:new-chat',
      draft: `Resolve the Notes merge conflict for note ${note.meta.id}: read the descriptor under /data/apps/notes/conflicts/${note.meta.id}/, 3-way-merge mine + server against base (preserve attachment refs), write the result to /data/apps/notes/notes/${note.meta.id}.md, then mark the descriptor resolved.`,
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

export default function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment, conflict, status }) {
  const [title, setTitle] = useState(note.meta.title || '')
  const [body, setBody] = useState(note.body || '')
  const [showColors, setShowColors] = useState(false)
  const [attachErr, setAttachErr] = useState('')
  const timer = useRef(null)
  const viewRef = useRef(null)
  const imageRef = useRef(null)
  const fileRef = useRef(null)
  const colorBtnRef = useRef(null)
  // `latest` always names the note the title/body BUFFER currently belongs to.
  // It is only re-pointed at a new note AFTER that note's edits have been
  // flushed (see the id-change effect), so a debounced flush never writes the
  // outgoing buffer under the incoming note's meta.
  const latest = useRef({ note, title: note.meta.title || '', body: note.body || '' })

  const isChecklist = note.meta.type === 'checklist'

  useEffect(() => {
    // Keep the buffer in sync only while the note identity is unchanged; the
    // id-change effect below owns the note swap (and the pre-swap flush).
    if (latest.current.note.meta.id === note.meta.id) {
      latest.current = { note, title, body }
    }
  }, [note, title, body])

  const flushSave = useCallback(() => {
    const cur = latest.current
    if (!cur?.note) return Promise.resolve()
    if (cur.title === (cur.note.meta.title || '') && cur.body === (cur.note.body || '')) {
      return Promise.resolve()
    }
    if (timer.current) clearTimeout(timer.current)
    return Promise.resolve(onSave({ ...cur.note.meta, title: cur.title }, cur.body))
  }, [onSave])

  // Switching directly from one note to another in the editor: flush the
  // OUTGOING note's pending edits (held in `latest`, still pointing at the old
  // note) BEFORE resetting the buffer to the incoming note. Without this, the
  // debounced autosave for the old note never fires and its unsaved edits are
  // silently dropped.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current)
    flushSave()
    latest.current = { note, title: note.meta.title || '', body: note.body || '' }
    setTitle(note.meta.title || '')
    setBody(note.body || '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [note.meta.id])

  useEffect(() => {
    if (title === (note.meta.title || '') && body === (note.body || '')) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => { flushSave() }, AUTOSAVE_MS)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body, flushSave])

  useEffect(() => {
    const flushOnHide = () => { if (document.visibilityState === 'hidden') flushSave() }
    const flushOnUnload = () => { flushSave() }
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
    const nextType = isChecklist ? 'note' : 'checklist'
    let nextBody = body
    if (nextType === 'checklist' && body.trim() && !/^- \[[ x]\] /m.test(body)) {
      // Wrap existing content as first checklist item
      nextBody = body.replace(/^(.+)/m, '- [ ] $1')
    } else if (nextType === 'checklist' && !body.trim()) {
      nextBody = '- [ ] '
    }
    if (nextBody !== body) setBody(nextBody)
    onSave({ ...note.meta, title, type: nextType }, nextBody)
  }, [isChecklist, body, note.meta, title, onSave])

  function insertMarkdown(md) {
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
    if (!f || !putAttachment) return
    try {
      const res = await putAttachment(f)
      const isImage = (f.type || '').startsWith('image/')
      const md = isImage ? `\n![${res.name}](${res.path})\n` : `[${res.name}](${res.path})`
      const nextBody = insertMarkdown(md)
      const attachments = Array.from(new Set([...(note.meta.attachments || []), res.path]))
      await onSave({ ...note.meta, title, attachments }, nextBody)
      setAttachErr('')
    } catch (err) {
      setAttachErr(String(err && err.message || err).includes('limit') ? 'File too large (max 25 MB).' : 'Could not attach file.')
      setTimeout(() => setAttachErr(''), 3500)
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

  const tone = normalizeColorName(note.meta.color)

  return (
    <div className="nt-editor-root">
      <header className="nt-editor-hdr">
        <div className="nt-editor-row1">
          <button
            onClick={async () => { await flushSave(); onBack() }}
            aria-label="Back"
            className="nt-hdr-btn"
          ><Icon name="back" size={18} /></button>
          {tone && <span className={`nt-color-dot nt-color-dot--${tone}`} />}
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Title"
            aria-label="Note title"
            className="nt-title-input"
          />
          {status && (
            <span className={`nt-status ${statusClass(status)}`}>{status}</span>
          )}
        </div>
        <div className="nt-editor-row2">
          <button
            onClick={() => onPin(note.meta.id)}
            aria-label={note.meta.pinned ? 'Unpin' : 'Pin'}
            title={note.meta.pinned ? 'Unpin' : 'Pin'}
            className={`nt-hdr-btn${note.meta.pinned ? ' is-active' : ''}`}
          ><Icon name="pin" size={16} /></button>
          <div ref={colorBtnRef} style={{ position: 'relative', flexShrink: 0 }}>
            <button
              onClick={() => setShowColors((v) => !v)}
              aria-label="Color"
              title="Color"
              className="nt-hdr-btn"
            ><Icon name="palette" size={17} /></button>
            {showColors && (
              <ColorPicker
                anchorRef={colorBtnRef}
                placement="below"
                align="start"
                current={note.meta.color}
                onPick={(c) => { onColor(note.meta.id, c); setShowColors(false) }}
              />
            )}
          </div>
          <button
            onClick={toggleType}
            aria-label={isChecklist ? 'Switch to note' : 'Switch to checklist'}
            title={isChecklist ? 'Switch to note' : 'Switch to checklist'}
            className={`nt-hdr-btn${isChecklist ? ' is-active' : ''}`}
          ><Icon name={isChecklist ? 'checklist' : 'note'} size={16} /></button>
          <button
            onClick={() => imageRef.current && imageRef.current.click()}
            aria-label="Insert image"
            title="Insert image"
            className="nt-label-btn"
          ><Icon name="image" size={16} />Image</button>
          <button
            onClick={() => fileRef.current && fileRef.current.click()}
            aria-label="Attach file"
            title="Attach file"
            className="nt-label-btn"
          ><Icon name="file" size={16} />File</button>
          <div className="nt-hdr-spacer" />
          <button
            onClick={() => onDelete(note.meta.id)}
            aria-label="Delete"
            title="Delete"
            className="nt-hdr-btn is-danger"
          ><Icon name="trash" size={16} /></button>
        </div>
        <input ref={imageRef} type="file" accept="image/*" onChange={handleFile} style={{ display: 'none' }} />
        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
      </header>

      {conflict && (
        <div className="nt-conflict-bar">
          <span className="nt-conflict-msg">Edited in two places — merging…</span>
          <button onClick={() => resolveNow(note)} className="nt-conflict-btn">Resolve now</button>
        </div>
      )}

      {attachErr && (
        <div className="nt-attach-err">{attachErr}</div>
      )}

      <div className="nt-editor-body">
        <Editor value={body} onChange={setBody} resolveAttachment={resolveAttachment} viewRef={viewRef} />
      </div>

      {strandedUrls.length > 0 && (
        <div className="nt-attach-strip" aria-label="Attached images">
          {strandedUrls.map((u) => (
            <img key={u} src={u} alt="" className="nt-attach-thumb" />
          ))}
        </div>
      )}
    </div>
  )
}
