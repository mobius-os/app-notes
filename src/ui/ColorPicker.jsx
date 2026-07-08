// A small swatch popover for choosing a note's color tag.
//
// The popover is rendered through a React portal into document.body with
// position:fixed, coordinates computed from the trigger's getBoundingClientRect().
// This is deliberate: the toolbar rows that host the trigger use overflowX:'auto'
// (editor header) or overflow:'hidden' (grid card), and an overflow on one axis
// clips BOTH axes — an absolutely-positioned child would mount but stay invisible.
// A body-level fixed popover has no clipping ancestor, so it shows while the
// toolbar keeps its horizontal scroll.
import { useEffect, useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTE_COLORS, normalizeColorName } from './colors.js'

const MARGIN = 12 // keep the popover this far from the viewport edges

export default function ColorPicker({ anchorRef, current, onPick, onDismiss, placement = 'above', align = 'start' }) {
  const [pos, setPos] = useState(null)
  const normalizedCurrent = normalizeColorName(current)

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
      const top = placement === 'below' ? r.bottom + 6 : r.top - 6 - height
      let left = align === 'end' ? r.right - width : r.left
      const maxLeft = window.innerWidth - width - MARGIN
      left = Math.max(MARGIN, Math.min(left, maxLeft))
      setPos({ top: Math.max(MARGIN, top), left })
    }
    place()
    window.addEventListener('scroll', place, true)
    window.addEventListener('resize', place)
    return () => {
      window.removeEventListener('scroll', place, true)
      window.removeEventListener('resize', place)
    }
  }, [anchorRef, placement, align, height, width])

  useEffect(() => {
    if (!onDismiss) return undefined
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [onDismiss])

  if (!pos) return null

  return createPortal(
    <div
      role="listbox"
      aria-label="Note color"
      onClick={(e) => e.stopPropagation()}
      onPointerDown={(e) => e.stopPropagation()}
      className="nt-color-picker"
      style={{ top: pos.top, left: pos.left }}
    >
      {NOTE_COLORS.map((c) => (
        <button
          key={c.name || 'default'}
          type="button"
          role="option"
          title={c.label}
          aria-label={c.label}
          aria-selected={normalizedCurrent === c.name}
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
