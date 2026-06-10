// A small swatch popover for choosing a note's color tag.
//
// The popover is rendered through a React portal into document.body with
// position:fixed, coordinates computed from the trigger's getBoundingClientRect().
// This is deliberate: the toolbar rows that host the trigger use overflowX:'auto'
// (editor header) or overflow:'hidden' (grid card), and an overflow on one axis
// clips BOTH axes — an absolutely-positioned child would mount but stay invisible.
// A body-level fixed popover has no clipping ancestor, so it shows while the
// toolbar keeps its horizontal scroll.
import { useLayoutEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { NOTE_COLORS } from './colors.js'

const MARGIN = 12 // keep the popover this far from the viewport edges

export default function ColorPicker({ anchorRef, current, onPick, placement = 'above', align = 'start' }) {
  const [pos, setPos] = useState(null)

  // Estimate the rendered size so we can flip/clamp against the viewport. The
  // grid is repeat(4, 28px) swatches with gap 7 and padding 8 on each side.
  const width = 4 * 28 + 3 * 7 + 2 * 8
  const rows = Math.ceil(NOTE_COLORS.length / 4)
  const height = rows * 28 + (rows - 1) * 7 + 2 * 8

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

  if (!pos) return null

  return createPortal(
    <div
      role="menu"
      aria-label="Note color"
      onClick={(e) => e.stopPropagation()}
      className="nt-color-picker"
      style={{ top: pos.top, left: pos.left }}
    >
      {NOTE_COLORS.map((c) => (
        <button
          key={c.name || 'default'}
          title={c.label}
          aria-label={c.label}
          onClick={() => onPick(c.name)}
          className="nt-swatch"
          style={{
            // Dynamic: swatch background is the note color hex (or the "default" diagonal)
            border: current === c.name ? '2px solid var(--text)' : '1px solid var(--border)',
            background: c.hex || 'linear-gradient(135deg, var(--surface) 49%, var(--muted) 51%)',
          }}
        />
      ))}
    </div>,
    document.body,
  )
}
