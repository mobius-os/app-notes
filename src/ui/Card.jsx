// A single note card: tone-class background, on-demand footer toolbar
// (hover/focus/long-press), rendered markdown preview.
// Tapping the body opens the editor.
import { useState, useEffect, useRef, useMemo, useCallback, memo } from 'react'
import { normalizeColorName } from './colors.js'
import { localImageRefs, renderPreviewHTML } from '../lib/preview.js'
import ColorPicker from './ColorPicker.jsx'
import { Icon } from './icons.jsx'

// Card previews are useful before they enter the viewport, but parsing/sanitizing
// every note and resolving every thumbnail during the first grid paint is not.
// One observer is shared by the entire grid so a large notebook does not create
// one native observer per card. Parsed HTML stays cached after first view, while
// offscreen DOM and object URLs are released so memory stays bounded as users
// scroll through a large notebook.
const nearCardCallbacks = new WeakMap()
let nearCardObserver = null

function observeNearCard(node, callback) {
  if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
    callback(true)
    return () => {}
  }
  if (!nearCardObserver) {
    nearCardObserver = new window.IntersectionObserver((entries) => {
      for (const entry of entries) {
        const show = nearCardCallbacks.get(entry.target)
        show?.(entry.isIntersecting)
      }
    }, { rootMargin: '720px 0px' })
  }
  nearCardCallbacks.set(node, callback)
  nearCardObserver.observe(node)
  return () => {
    nearCardCallbacks.delete(node)
    nearCardObserver?.unobserve(node)
  }
}

function useNearViewport(ref) {
  const [near, setNear] = useState(() =>
    typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function')
  useEffect(() => {
    const node = ref.current
    if (!node) {
      // Non-DOM renderers and unusual mount races should show content, never leave
      // a permanently blank card because there was nothing observable yet.
      setNear(true)
      return undefined
    }
    return observeNearCard(node, setNear)
  }, [ref])
  return near
}

function IconBtn({ children, title, onClick, active, danger, disabled }) {
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={(e) => { e.stopPropagation(); if (!disabled && typeof onClick === 'function') onClick() }}
      className={`nt-icon-btn${active ? ' is-active' : ''}${danger ? ' is-danger' : ''}`}
    >{children}</button>
  )
}

const DATE_FORMATTER = new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' })

function formatCardDate(meta) {
  const raw = meta.updated || meta.created
  if (!raw) return ''
  const d = new Date(raw)
  if (Number.isNaN(d.getTime())) return ''
  return DATE_FORMATTER.format(d)
}

function Card({ note, onOpen, onPin, onColor, onLock, onDelete, resolveAttachment }) {
  const { meta, body } = note
  const [html, setHtml] = useState('')
  const [showColors, setShowColors] = useState(false)
  const [thumbUrls, setThumbUrls] = useState([])
  const [toolsOpen, setToolsOpen] = useState(false)
  const renderedPreviewBody = useRef(null)
  const colorBtnRef = useRef(null)
  const longPressTimer = useRef(null)
  const cardRef = useRef(null)
  const nearViewport = useNearViewport(cardRef)
  // Set true the instant a long-press opens the tools, so the finger-up click that
  // fires next (the pointerup → click sequence a touch always produces) is consumed
  // by the body handler instead of opening the editor over the just-revealed tools.
  const suppressNextClick = useRef(false)

  const previewBody = (body || '').slice(0, 700)
  useEffect(() => {
    if (!nearViewport) return undefined
    if (renderedPreviewBody.current === previewBody) return undefined
    let live = true
    renderPreviewHTML(previewBody)
      .then((h) => {
        if (!live) return
        renderedPreviewBody.current = previewBody
        setHtml(h)
      })
      .catch(() => {})
    return () => { live = false }
  }, [nearViewport, previewBody])

  useEffect(() => {
    if (nearViewport) return
    // A portaled picker cannot follow an anchor after its offscreen toolbar is
    // released. Dismiss transient card tools before that happens.
    setShowColors(false)
    setToolsOpen(false)
  }, [nearViewport])

  // Only the image refs (not the whole meta object) drive thumbnail resolution.
  // Keying the effect on a stable serialization of the refs stops it re-running
  // — and re-reading blobs / re-creating object URLs (a visible flash) — on
  // unrelated metadata changes like pin/color toggles, which mint a new `meta`
  // object reference every time.
  const imageRefs = useMemo(
    () => nearViewport ? localImageRefs(meta, body, 4) : [],
    [nearViewport, meta, body],
  )
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

  // Close tools panel / portaled color picker when clicking outside the card.
  useEffect(() => {
    if (!toolsOpen && !showColors) return undefined
    const onPointerDown = (e) => {
      if (cardRef.current && !cardRef.current.contains(e.target)) {
        setToolsOpen(false)
        setShowColors(false)
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [toolsOpen, showColors])

  // Tone class drives background/border/footer styling (css.js TONE_CSS);
  // legacy stored names (violet, sky, …) normalize to a current tone on read.
  const tone = normalizeColorName(meta.color)
  const empty = !meta.title && !(body || '').trim()
  const isChecklist = meta.type === 'checklist'
  const locked = !!meta.locked
  const cardDate = formatCardDate(meta)

  // Long-press detection (~300ms) via pointer events. Touch/pen only — a mouse
  // reveals the tools on hover, so arming a long-press for it would wrongly suppress
  // a slow desktop click. pointerdown arms the timer; pointerup/move/cancel/leave
  // clear it. When the timer fires it opens the tools AND flags suppressNextClick,
  // so the click the OS synthesizes on finger release doesn't also open the editor.
  // (The old touch-timing version called e.preventDefault() inside the timer, after
  // the original touch event had already dispatched — too late to stop the click.)
  const onPointerDown = useCallback((e) => {
    if (e.pointerType === 'mouse') return
    longPressTimer.current = setTimeout(() => {
      longPressTimer.current = null
      setToolsOpen(true)
      suppressNextClick.current = true
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
        className={`nt-card${tone ? ` nt-card--${tone}` : ''}${toolsOpen ? ' nt-card--tools' : ''}${locked ? ' is-locked' : ''}`}
        onPointerDown={onPointerDown}
        onPointerUp={cancelLongPress}
        onPointerMove={cancelLongPress}
        onPointerCancel={cancelLongPress}
        onPointerLeave={cancelLongPress}
      >
        {/* The card body is the open affordance. It can't be a real <button>:
            it holds flow content (the thumbnail grid + the markdown preview's
            block-level dangerouslySetInnerHTML), which is invalid inside a
            button. So it carries the button SEMANTICS instead — role=button +
            keyboard focus + Enter/Space activation + an aria-label naming the
            note — so keyboard and screen-reader users get the same open action
            pointer users get from the click. */}
        <div
          className="nt-card-body"
          role="button"
          tabIndex={0}
          aria-label={meta.title ? `Open note: ${meta.title}` : 'Open untitled note'}
          onClick={() => {
            // A long-press just opened the tools; swallow the release-click so it
            // doesn't open the editor over them. One-shot: clear and bail.
            if (suppressNextClick.current) { suppressNextClick.current = false; return }
            onOpen(meta.id)
          }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault()
              onOpen(meta.id)
            }
          }}
        >
          {nearViewport && (
            <>
              {thumbUrls.length > 0 && (
                <div className={`nt-card-thumbs nt-card-thumbs--${thumbUrls.length}`} aria-hidden="true">
                  {thumbUrls.map((url, index) => (
                    <img
                      key={url}
                      src={url}
                      alt=""
                      className={`nt-card-thumb${thumbUrls.length === 3 && index === 0 ? ' is-wide' : ''}`}
                    />
                  ))}
                </div>
              )}
              <div className="nt-card-main" aria-hidden="true">
                {meta.title && (
                  <div className="nt-card-title">
                    <span>{meta.title}</span>
                  </div>
                )}
                {!meta.title && isChecklist && (
                  <div className="nt-card-kicker">
                    Checklist
                  </div>
                )}
                {empty
                  ? <div className="nt-card-empty">Empty note</div>
                  : <div
                      className="note-preview nt-card-preview"
                      dangerouslySetInnerHTML={{ __html: html }}
                    />}
              </div>
              {(tone || cardDate) && (
                <div className="nt-card-meta" aria-hidden="true">
                  {tone && <span className="nt-card-tone-dot" aria-hidden="true" />}
                  {cardDate && <span className="nt-card-date">{cardDate}</span>}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer toolbar: pin + color + lock + delete */}
        {nearViewport && <div className="nt-card-footer">
          <IconBtn
            title={meta.pinned ? 'Unpin' : 'Pin'}
            active={meta.pinned}
            onClick={() => onPin(meta.id)}
          ><Icon name="pin" size={15} /></IconBtn>
          <div ref={colorBtnRef} className="nt-color-anchor">
            <IconBtn title="Color" onClick={() => setShowColors((v) => !v)}><Icon name="palette" size={16} /></IconBtn>
            {showColors && (
              <ColorPicker
                anchorRef={colorBtnRef}
                current={meta.color}
                onPick={(c) => { onColor(meta.id, c); setShowColors(false) }}
                onDismiss={() => setShowColors(false)}
              />
            )}
          </div>
          <IconBtn
            title={locked ? 'Unlock note' : 'Lock note'}
            active={locked}
            onClick={() => onLock(meta.id)}
          ><Icon name={locked ? 'lock' : 'unlock'} size={15} /></IconBtn>
          <div className="nt-spacer" />
          <IconBtn
            title={locked ? 'Unlock to delete' : 'Delete'}
            danger
            disabled={locked}
            onClick={() => onDelete(meta.id)}
          ><Icon name="trash" size={15} /></IconBtn>
        </div>}
      </div>
    </div>
  )
}

export default memo(Card)
