// Full-screen note editor: header (back, title, pin, color, attach, status,
// delete) + the live-inline CodeMirror body. Title + body autosave (debounced).
import { useState, useEffect, useRef } from 'react'
import { T } from './theme.js'
import { colorHex } from './colors.js'
import ColorPicker from './ColorPicker.jsx'
import Editor from '../editor/Editor.jsx'

const AUTOSAVE_MS = 600

export default function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, resolveAttachment, putAttachment, status }) {
  const t = T()
  const [title, setTitle] = useState(note.meta.title || '')
  const [body, setBody] = useState(note.body || '')
  const [showColors, setShowColors] = useState(false)
  const [attachErr, setAttachErr] = useState('')
  const timer = useRef(null)
  const viewRef = useRef(null)
  const fileRef = useRef(null)

  useEffect(() => {
    setTitle(note.meta.title || '')
    setBody(note.body || '')
  }, [note.meta.id])

  useEffect(() => {
    if (title === (note.meta.title || '') && body === (note.body || '')) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave({ ...note.meta, title }, body), AUTOSAVE_MS)
    return () => clearTimeout(timer.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, body])

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
        <button onClick={onBack} aria-label="Back" style={hdrBtn(t)}>←</button>
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
