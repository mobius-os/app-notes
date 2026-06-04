// Full-screen note editor: header (back, title, pin, color, attach, status,
// delete) + the live-inline CodeMirror body. Title + body autosave (debounced).
import { useState, useEffect, useRef, useCallback } from 'react'
import { T } from './theme.js'
import { colorHex } from './colors.js'
import ColorPicker from './ColorPicker.jsx'
import Editor from '../editor/Editor.jsx'

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

export default function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment, conflict, status }) {
  const t = T()
  const [title, setTitle] = useState(note.meta.title || '')
  const [body, setBody] = useState(note.body || '')
  const [showColors, setShowColors] = useState(false)
  const [attachErr, setAttachErr] = useState('')
  const timer = useRef(null)
  const viewRef = useRef(null)
  const fileRef = useRef(null)
  const latest = useRef({ note, title: note.meta.title || '', body: note.body || '' })

  useEffect(() => {
    latest.current = { note, title, body }
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

  useEffect(() => {
    setTitle(note.meta.title || '')
    setBody(note.body || '')
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

  async function handleFile(e) {
    const f = e.target.files && e.target.files[0]
    e.target.value = ''
    if (!f || !putAttachment) return
    try {
      const res = await putAttachment(f)
      const isImage = (f.type || '').startsWith('image/')
      const md = isImage ? `\n![${res.name}](${res.path})\n` : `[${res.name}](${res.path})`
      const v = viewRef.current
      if (v) { v.dispatch(v.state.replaceSelection(md)); v.focus() } else { setBody((b) => b + md) }
      setAttachErr('')
    } catch (err) {
      setAttachErr(String(err && err.message || err).includes('limit') ? 'File too large (max 25 MB).' : 'Could not attach file.')
      setTimeout(() => setAttachErr(''), 3500)
    }
  }

  const statusColor = status === 'Synced' ? t.green : status === 'Resolving…' ? t.accent : t.muted

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: t.bg, zIndex: 10 }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '10px 12px', borderBottom: `1px solid ${t.border}` }}>
        <button onClick={async () => { await flushSave(); onBack() }} aria-label="Back" style={hdrBtn(t)}>←</button>
        {colorHex(note.meta.color) && <span style={{ width: 8, height: 8, borderRadius: '50%', background: colorHex(note.meta.color) }} />}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          style={{ flex: 1, minWidth: 0, padding: '6px 8px', border: 'none', outline: 'none', background: 'transparent', color: t.text, fontSize: 17, fontWeight: 600 }}
        />
        {status && <span style={{ fontSize: 12, color: statusColor, whiteSpace: 'nowrap', marginRight: 2 }}>{status}</span>}
        <button onClick={() => onPin(note.meta.id)} aria-label={note.meta.pinned ? 'Unpin' : 'Pin'} style={hdrBtn(t, note.meta.pinned)}>📌</button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColors((v) => !v)} aria-label="Color" style={hdrBtn(t)}>🎨</button>
          {showColors && <ColorPicker current={note.meta.color} onPick={(c) => { onColor(note.meta.id, c); setShowColors(false) }} />}
        </div>
        <button onClick={() => fileRef.current && fileRef.current.click()} aria-label="Attach image or file" style={hdrBtn(t)}>📎</button>
        <input ref={fileRef} type="file" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => onDelete(note.meta.id)} aria-label="Delete" style={hdrBtn(t, false, true)}>🗑</button>
      </header>

      {conflict && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', background: `${t.accent}1f`, color: t.text, fontSize: 13 }}>
          <span style={{ flex: 1 }}>Edited in two places — merging…</span>
          <button onClick={() => resolveNow(note)} style={{ border: `1px solid ${t.accent}`, background: 'transparent', color: t.accent, borderRadius: 8, padding: '4px 10px', fontSize: 12, cursor: 'pointer' }}>Resolve now</button>
        </div>
      )}

      {attachErr && (
        <div style={{ padding: '8px 16px', background: `${t.danger}22`, color: t.danger, fontSize: 13 }}>{attachErr}</div>
      )}

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <Editor value={body} onChange={setBody} resolveAttachment={resolveAttachment} viewRef={viewRef} />
      </div>
    </div>
  )
}

function hdrBtn(t, active, danger) {
  return {
    width: 34, height: 34, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', border: 'none', borderRadius: 9,
    background: active ? `${t.accent}22` : 'transparent',
    color: danger ? t.danger : t.text, cursor: 'pointer', fontSize: 16, flexShrink: 0,
  }
}
