// A single note card: color tab, title, rendered markdown preview, and a footer
// toolbar (pin, color, delete). Tapping the body opens the editor.
import { useState, useEffect, useRef } from 'react'
import { colorHex, colorTint } from './colors.js'
import { localImageRefs, renderPreviewHTML } from '../lib/preview.js'
import ColorPicker from './ColorPicker.jsx'
import { Icon } from './icons.jsx'

function IconBtn({ children, title, onClick, active, danger }) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={(e) => { e.stopPropagation(); onClick() }}
      className={`nt-icon-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
    >{children}</button>
  )
}

export default function Card({ note, onOpen, onPin, onColor, onDelete, resolveAttachment }) {
  const { meta, body } = note
  const [html, setHtml] = useState('')
  const [showColors, setShowColors] = useState(false)
  const [thumbUrls, setThumbUrls] = useState([])
  const colorBtnRef = useRef(null)

  useEffect(() => {
    let live = true
    renderPreviewHTML((body || '').slice(0, 700))
      .then((h) => { if (live) setHtml(h) })
      .catch(() => {})
    return () => { live = false }
  }, [body])

  useEffect(() => {
    let live = true
    let urls = []
    const refs = localImageRefs(meta, body, 4)
    setThumbUrls([])
    if (!refs.length || !resolveAttachment) return () => {}
    Promise.all(refs.map((ref) => resolveAttachment(ref).catch(() => null)))
      .then((resolved) => {
        const next = resolved.filter(Boolean)
        if (!live) {
          next.forEach((u) => URL.revokeObjectURL(u))
          return
        }
        urls = next
        setThumbUrls(next)
      })
      .catch(() => {})
    return () => {
      live = false
      urls.forEach((u) => URL.revokeObjectURL(u))
    }
  }, [body, meta, resolveAttachment])

  const bar = colorHex(meta.color)
  const tint = colorTint(meta.color)
  const tintBorder = bar ? colorTint(meta.color, 0.5) : null
  const footerBorder = bar ? colorTint(meta.color, 0.32) : null
  const footerBg = bar ? colorTint(meta.color, 0.08) : null
  const thumbBorder = bar ? colorTint(meta.color, 0.28) : null
  const empty = !meta.title && !(body || '').trim()

  // Dynamic: card background gradient and border depend on per-note color
  const cardStyle = {
    background: tint ? `linear-gradient(180deg, ${tint}, var(--surface) 44%)` : 'var(--surface)',
    border: `1px solid ${tintBorder || 'var(--border)'}`,
  }
  // Dynamic: footer border and tinted background
  const footerStyle = {
    borderTop: `1px solid ${footerBorder || 'var(--border)'}`,
    background: footerBg || 'transparent',
  }

  return (
    <div className="nt-card-wrap">
      <div className="nt-card" style={cardStyle}>
        {bar && <div style={{ height: 4, background: bar }} />}
        <div className="nt-card-body" onClick={() => onOpen(meta.id)}>
          {thumbUrls.length > 0 && (
            <div
              className="nt-card-thumbs"
              style={{ gridTemplateColumns: thumbUrls.length === 1 ? '1fr' : 'repeat(2, minmax(0, 1fr))' }}
            >
              {thumbUrls.map((url, index) => (
                <img
                  key={url}
                  src={url}
                  alt=""
                  className="nt-card-thumb"
                  style={{
                    aspectRatio: thumbUrls.length === 1 ? '16 / 10' : '1 / 1',
                    border: `1px solid ${thumbBorder || 'var(--border)'}`,
                    background: 'var(--surface2, var(--surface))',
                    gridColumn: thumbUrls.length === 3 && index === 0 ? 'span 2' : undefined,
                  }}
                />
              ))}
            </div>
          )}
          {meta.title && <div className="nt-card-title">{meta.title}</div>}
          {empty
            ? <div className="nt-card-empty">Empty note</div>
            : <div
                className="note-preview nt-card-preview"
                dangerouslySetInnerHTML={{ __html: html }}
              />}
        </div>
        <div className="nt-card-footer" style={footerStyle}>
          <IconBtn title={meta.pinned ? 'Unpin' : 'Pin'} active={meta.pinned} onClick={() => onPin(meta.id)}><Icon name="pin" size={15} /></IconBtn>
          <div ref={colorBtnRef} className="nt-color-anchor">
            <IconBtn title="Color" onClick={() => setShowColors((v) => !v)}><Icon name="palette" size={16} /></IconBtn>
            {showColors && (
              <ColorPicker
                anchorRef={colorBtnRef}
                current={meta.color}
                onPick={(c) => { onColor(meta.id, c); setShowColors(false) }}
              />
            )}
          </div>
          <div className="nt-spacer" />
          <IconBtn title="Delete" danger onClick={() => onDelete(meta.id)}><Icon name="trash" size={15} /></IconBtn>
        </div>
      </div>
    </div>
  )
}
