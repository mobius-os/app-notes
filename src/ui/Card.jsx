// A single note card: color tab, title, rendered markdown preview, and a footer
// toolbar (pin, color, delete). Tapping the body opens the editor.
import { useState, useEffect } from 'react'
import { T } from './theme.js'
import { colorHex, colorTint } from './colors.js'
import { renderPreviewHTML } from '../lib/preview.js'
import ColorPicker from './ColorPicker.jsx'
import { Icon } from './icons.jsx'

function IconBtn({ children, title, onClick, active, danger }) {
  const t = T()
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      style={{
        width: 30, height: 30, display: 'inline-flex', alignItems: 'center',
        justifyContent: 'center', border: 'none', borderRadius: 8,
        background: active ? `${t.accent}22` : 'transparent',
        color: danger ? t.danger : t.muted, cursor: 'pointer', fontSize: 14,
        opacity: active ? 1 : 0.85,
      }}
    >{children}</button>
  )
}

export default function Card({ note, onOpen, onPin, onColor, onDelete }) {
  const t = T()
  const { meta, body } = note
  const [html, setHtml] = useState('')
  const [showColors, setShowColors] = useState(false)

  useEffect(() => {
    let live = true
    renderPreviewHTML((body || '').slice(0, 700))
      .then((h) => { if (live) setHtml(h) })
      .catch(() => {})
    return () => { live = false }
  }, [body])

  const bar = colorHex(meta.color)
  const tint = colorTint(meta.color)
  const empty = !meta.title && !(body || '').trim()

  return (
    <div style={{ breakInside: 'avoid', marginBottom: 14 }}>
      <div style={{
        position: 'relative',
        background: tint ? `linear-gradient(180deg, ${tint}, ${t.surface} 44%)` : t.surface,
        border: `1px solid ${bar ? colorTint(meta.color, 0.5) : t.border}`,
        borderRadius: 8, overflow: 'hidden',
      }}>
        {bar && <div style={{ height: 4, background: bar }} />}
        <div
          onClick={() => onOpen(meta.id)}
          style={{ cursor: 'pointer', padding: '14px 16px 10px' }}
        >
          {meta.title && <div style={{ fontSize: 15, fontWeight: 650, color: t.text, marginBottom: 6, overflowWrap: 'anywhere' }}>{meta.title}</div>}
          {empty
            ? <div style={{ fontSize: 13.5, color: t.muted, opacity: 0.6, fontStyle: 'italic' }}>Empty note</div>
            : <div
                className="note-preview"
                style={{ fontSize: 13.5, color: t.muted, lineHeight: 1.5, maxHeight: 220, overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: html }}
              />}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '6px 8px', borderTop: `1px solid ${bar ? colorTint(meta.color, 0.32) : t.border}`, background: bar ? colorTint(meta.color, 0.08) : 'transparent' }}>
          <IconBtn title={meta.pinned ? 'Unpin' : 'Pin'} active={meta.pinned} onClick={() => onPin(meta.id)}><Icon name="pin" size={15} /></IconBtn>
          <div style={{ position: 'relative' }}>
            <IconBtn title="Color" onClick={() => setShowColors((v) => !v)}><Icon name="palette" size={16} /></IconBtn>
            {showColors && (
              <ColorPicker
                current={meta.color}
                onPick={(c) => { onColor(meta.id, c); setShowColors(false) }}
              />
            )}
          </div>
          <div style={{ flex: 1 }} />
          <IconBtn title="Delete" danger onClick={() => onDelete(meta.id)}><Icon name="trash" size={15} /></IconBtn>
        </div>
      </div>
    </div>
  )
}
