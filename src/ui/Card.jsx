// A single note card: full-card color tint background, pin top-right,
// on-demand toolbar (hover/focus/long-press), rendered markdown preview.
// Tapping the body opens the editor.
import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
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

export default function Card({ note, onOpen, onPin, onColor, onDelete, onArchive, resolveAttachment }) {
  const { meta, body } = note
  const [html, setHtml] = useState('')
  const [showColors, setShowColors] = useState(false)
  const [thumbUrls, setThumbUrls] = useState([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const colorBtnRef = useRef(null)
  const longPressTimer = useRef(null)
  const cardRef = useRef(null)

  useEffect(() => {
    let live = true
    renderPreviewHTML((body || '').slice(0, 700))
      .then((h) => { if (live) setHtml(h) })
      .catch(() => {})
    return () => { live = false }
  }, [body])

  // Only the image refs (not the whole meta object) drive thumbnail resolution.
  // Keying the effect on a stable serialization of the refs stops it re-running
  // — and re-reading blobs / re-creating object URLs (a visible flash) — on
  // unrelated metadata changes like pin/color toggles, which mint a new `meta`
  // object reference every time.
  const imageRefs = useMemo(() => localImageRefs(meta, body, 4), [meta, body])
  const imageRefsKey = imageRefs.join('\n')

  useEffect(() => {
    let live = true
    let urls = []
    const refs = imageRefsKey ? imageRefsKey.split('\n') : []
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
  }, [imageRefsKey, resolveAttachment])

  // Close tools panel when clicking outside the card
  useEffect(() => {
    if (!toolsOpen) return undefined
    const onPointerDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setToolsOpen(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [toolsOpen])

  const bar = colorHex(meta.color)

  // Full card background: solid tint for colored notes, surface default otherwise.
  // The tint alpha is boosted (0.22 light / respects dark via surface blend) so
  // it reads clearly. Title uses a slightly darkened version via CSS opacity layering.
  const tintBg = bar ? colorTint(meta.color, 0.22) : null
  const footerBorder = bar ? colorTint(meta.color, 0.35) : null
  const footerBg = bar ? colorTint(meta.color, 0.12) : null
  const thumbBorder = bar ? colorTint(meta.color, 0.28) : null
  const empty = !meta.title && !(body || '').trim()
  const tags = Array.isArray(meta.tags) ? meta.tags : []
  const isChecklist = meta.type === 'checklist'
  const isArchived = meta.archived === true

  // Full-card background tint replaces the gradient strip approach
  const cardStyle = {
    background: tintBg || 'var(--surface)',
    border: `1px solid ${bar ? colorTint(meta.color, 0.45) : 'var(--border)'}`,
  }
  const footerStyle = {
    borderTop: `1px solid ${footerBorder || 'var(--border)'}`,
    background: footerBg || 'transparent',
  }

  // Long-press detection (~300ms) for touch devices
  const onTouchStart = useCallback((e) => {
    longPressTimer.current = setTimeout(() => {
      setToolsOpen(true)
      // Prevent the tap-to-open from firing after a long press
      e.preventDefault()
    }, 300)
  }, [])
  const cancelLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current)
      longPressTimer.current = null
    }
  }, [])

  return (
    <div className="nt-card-wrap">
      <div
        ref={cardRef}
        className={`nt-card${toolsOpen ? ' nt-card--tools' : ''}`}
        style={cardStyle}
        onTouchStart={onTouchStart}
        onTouchEnd={cancelLongPress}
        onTouchMove={cancelLongPress}
        onTouchCancel={cancelLongPress}
      >
        {/* Archive badge — top-left, only in archive view */}
        {isArchived && (
          <span className="nt-card-archived" aria-label="Archived">
            <Icon name="archive" size={13} />
          </span>
        )}

        {/* Pin button — top-right corner */}
        <button
          title={meta.pinned ? 'Unpin' : 'Pin'}
          aria-label={meta.pinned ? 'Unpin' : 'Pin'}
          onClick={(e) => { e.stopPropagation(); onPin(meta.id) }}
          className={`nt-card-pin${meta.pinned ? ' is-pinned' : ''}`}
        >
          <Icon name="pin" size={14} />
        </button>

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
          {meta.title && (
            <div className="nt-card-title" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              {isChecklist && <Icon name="checklist" size={13} />}
              {meta.title}
            </div>
          )}
          {!meta.title && isChecklist && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 4, opacity: 0.55, fontSize: 12 }}>
              <Icon name="checklist" size={12} />Checklist
            </div>
          )}
          {empty
            ? <div className="nt-card-empty">Empty note</div>
            : <div
                className="note-preview nt-card-preview"
                dangerouslySetInnerHTML={{ __html: html }}
              />}
        </div>

        {/* Tag chips — shown below body */}
        {tags.length > 0 && (
          <div className="nt-card-tags">
            {tags.map((t) => <span key={t} className="nt-card-tag">{t}</span>)}
          </div>
        )}

        {/* Footer toolbar: color + archive + delete (pin moved to top-right) */}
        <div className="nt-card-footer" style={footerStyle}>
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
          {onArchive && (
            <IconBtn
              title={isArchived ? 'Unarchive' : 'Archive'}
              onClick={() => onArchive(meta.id)}
            >
              <Icon name={isArchived ? 'unarchive' : 'archive'} size={15} />
            </IconBtn>
          )}
          <div className="nt-spacer" />
          <IconBtn title="Delete" danger onClick={() => onDelete(meta.id)}><Icon name="trash" size={15} /></IconBtn>
        </div>
      </div>
    </div>
  )
}
