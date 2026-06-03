// Full-screen note editor: header (back, title, pin, color, attach, status,
// delete) + body. In Phase E the body is a plain textarea; Phase F swaps in the
// CodeMirror live-inline editor behind the SAME onChange(body) contract.
import { useState, useEffect, useRef } from 'react'
import { T } from './theme.js'
import { colorHex } from './colors.js'
import ColorPicker from './ColorPicker.jsx'

const AUTOSAVE_MS = 600

export default function EditorPanel({ note, onSave, onBack, onPin, onColor, onDelete, onAttach, status, BodyEditor }) {
  const t = T()
  const [title, setTitle] = useState(note.meta.title || '')
  const [body, setBody] = useState(note.body || '')
  const [showColors, setShowColors] = useState(false)
  const timer = useRef(null)

  // Re-sync local state when a different note is opened.
  useEffect(() => {
    setTitle(note.meta.title || '')
    setBody(note.body || '')
  }, [note.meta.id])

  // Debounced autosave — but only when the user has actually changed something
  // (so opening or switching a note doesn't bump `updated` / re-save).
  useEffect(() => {
    if (title === (note.meta.title || '') && body === (note.body || '')) return
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => onSave({ ...note.meta, title }, body), AUTOSAVE_MS)
    return () => clearTimeout(timer.current)
  }, [title, body])

  const bar = colorHex(note.meta.color)
  const statusColor = status === 'Synced' ? t.green : status === 'Resolving…' ? t.accent : t.muted

  return (
    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', background: t.bg, zIndex: 10 }}>
      <header style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '10px 12px',
        borderBottom: `1px solid ${t.border}`,
      }}>
        <button onClick={onBack} aria-label="Back" style={hdrBtn(t)}>←</button>
        {bar && <span style={{ width: 8, height: 8, borderRadius: '50%', background: bar }} />}
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          style={{
            flex: 1, minWidth: 0, padding: '6px 8px', border: 'none', outline: 'none',
            background: 'transparent', color: t.text, fontSize: 17, fontWeight: 600,
          }}
        />
        {status && <span style={{ fontSize: 12, color: statusColor, whiteSpace: 'nowrap', marginRight: 4 }}>{status}</span>}
        <button onClick={() => onPin(note.meta.id)} aria-label={note.meta.pinned ? 'Unpin' : 'Pin'}
          style={hdrBtn(t, note.meta.pinned)}>📌</button>
        <div style={{ position: 'relative' }}>
          <button onClick={() => setShowColors((v) => !v)} aria-label="Color" style={hdrBtn(t)}>🎨</button>
          {showColors && <ColorPicker current={note.meta.color} onPick={(c) => { onColor(note.meta.id, c); setShowColors(false) }} />}
        </div>
        {onAttach && <button onClick={onAttach} aria-label="Attach" style={hdrBtn(t)}>📎</button>}
        <button onClick={() => onDelete(note.meta.id)} aria-label="Delete" style={hdrBtn(t, false, true)}>🗑</button>
      </header>

      <div style={{ flex: 1, overflow: 'auto' }}>
        {BodyEditor
          ? <BodyEditor value={body} onChange={setBody} />
          : <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write in markdown…"
              aria-label="Note body"
              style={{
                width: '100%', height: '100%', minHeight: '60vh', resize: 'none',
                border: 'none', outline: 'none', background: 'transparent', color: t.text,
                fontSize: 15, lineHeight: 1.6, padding: '16px 18px',
                fontFamily: t.mono,
              }}
            />}
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
