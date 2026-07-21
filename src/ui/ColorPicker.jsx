// A small swatch popover for choosing a note's color tag.
//
// The popover is rendered through a React portal into document.body with
// position:fixed, coordinates computed from the trigger's getBoundingClientRect().
// This is deliberate: the toolbar rows that host the trigger use overflowX:'auto'
// (editor header) or overflow:'hidden' (grid card), and an overflow on one axis
// clips BOTH axes — an absolutely-positioned child would mount but stay invisible.
// A body-level fixed popover has no clipping ancestor, so it shows while the
// toolbar keeps its horizontal scroll.
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTE_COLORS, normalizeColorName } from './colors.js'

const MARGIN = 12 // keep the popover this far from the viewport edges

export default function ColorPicker({ anchorRef, current, onPick, onDismiss, placement = 'above', align = 'start' }) {
  const [pos, setPos] = useState(null)
  const pickerRef = useRef(null)
  const openerRef = useRef(null)
  const dismissRef = useRef(onDismiss)
  dismissRef.current = onDismiss
  const normalizedCurrent = normalizeColorName(current)
  const ready = !!pos

  // Estimate the rendered size so we can flip/clamp against the viewport. Must
  // match the .nt-color-picker CSS: repeat(4, 44px) swatches, gap 8, padding 8.
  const width = 4 * 44 + 3 * 8 + 2 * 8
  const rows = Math.ceil(NOTE_COLORS.length / 4)
  const height = rows * 44 + (rows - 1) * 8 + 2 * 8

  useLayoutEffect(() => {
    function place() {
      const el = anchorRef && anchorRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      let top = placement === 'below' ? r.bottom + 6 : r.top - 6 - height
      if (placement === 'below' && top + height > window.innerHeight - MARGIN) top = r.top - 6 - height
      if (placement === 'above' && top < MARGIN) top = r.bottom + 6
      let left = align === 'end' ? r.right - width : r.left
      const maxLeft = window.innerWidth - width - MARGIN
      left = Math.max(MARGIN, Math.min(left, maxLeft))
      const maxTop = Math.max(MARGIN, window.innerHeight - height - MARGIN)
      setPos({ top: Math.max(MARGIN, Math.min(top, maxTop)), left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, placement, align, height, width])

  // Move focus into the popover, dismiss on an outside press, and return focus
  // to the trigger when the portaled content unmounts.
  useEffect(() => {
    if (!ready) return undefined
    const anchor = anchorRef?.current
    const trigger = anchor?.matches?.('button') ? anchor : anchor?.querySelector?.('button')
    openerRef.current = trigger || document.activeElement
    const buttons = pickerRef.current?.querySelectorAll('button') || []
    const currentIndex = Math.max(0, NOTE_COLORS.findIndex((c) => c.name === normalizedCurrent))
    buttons[currentIndex]?.focus?.()
    const onPointerDown = (e) => {
      if (pickerRef.current?.contains(e.target) || anchor?.contains?.(e.target)) return
      dismissRef.current?.()
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      const opener = openerRef.current
      const stillMounted = typeof document.contains !== 'function' || document.contains(opener)
      if (opener && stillMounted && typeof opener.focus === 'function') opener.focus()
    }
  }, [anchorRef, normalizedCurrent, ready])

  const onKeyDown = (e) => {
    const buttons = Array.from(pickerRef.current?.querySelectorAll('button') || [])
    if (!buttons.length) return
    if (e.key === 'Escape' || e.key === 'Tab') {
      e.preventDefault()
      e.stopPropagation()
      onDismiss?.()
      return
    }
    const currentIndex = Math.max(0, buttons.indexOf(document.activeElement))
    let nextIndex = null
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') nextIndex = (currentIndex + 1) % buttons.length
    else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') nextIndex = (currentIndex - 1 + buttons.length) % buttons.length
    else if (e.key === 'Home') nextIndex = 0
    else if (e.key === 'End') nextIndex = buttons.length - 1
    if (nextIndex != null) {
      e.preventDefault()
      buttons[nextIndex].focus()
    }
  }

  if (!pos) return null

  return createPortal(
    <div
      ref={pickerRef}
      role="radiogroup"
      aria-label="Note color"
      onKeyDown={onKeyDown}
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="nt-color-picker"
      style={{ top: pos.top, left: pos.left }}
    >
      {NOTE_COLORS.map((c) => (
        <button
          key={c.name || 'default'}
          type="button"
          role="radio"
          title={c.label}
          aria-label={c.label}
          aria-checked={normalizedCurrent === c.name}
          tabIndex={normalizedCurrent === c.name ? 0 : -1}
          onClick={() => onPick(c.name)}
          className={[
            'nt-swatch',
            c.name ? `nt-swatch--${c.name}` : 'nt-swatch--default',
            // Legacy stored names normalize to a tone so the matching swatch highlights.
            normalizedCurrent === c.name ? 'is-current' : '',
          ].filter(Boolean).join(' ')}
        />
      ))}
    </div>,
    document.body,
  )
}
