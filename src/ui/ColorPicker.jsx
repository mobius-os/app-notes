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
import { T } from './theme.js'
import { NOTE_COLORS } from './colors.js'

const MARGIN = 12 // keep the popover this far from the viewport edges

export default function ColorPicker({ anchorRef, current, onPick, placement = 'above', align = 'start' }) {
  const t = T()
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
      style={{
        position: 'fixed', zIndex: 1000, top: pos.top, left: pos.left,
        display: 'grid', gridTemplateColumns: 'repeat(4, 28px)', gap: 7,
        maxWidth: `calc(100vw - ${2 * MARGIN}px)`, padding: 8, background: t.surface2,
        border: `1px solid ${t.border}`, borderRadius: 8,
        boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
      }}
    >
      {NOTE_COLORS.map((c) => (
        <button
          key={c.name || 'default'}
          title={c.label}
          aria-label={c.label}
          onClick={() => onPick(c.name)}
          style={{
            width: 28, height: 28, borderRadius: 7, cursor: 'pointer', padding: 0,
            border: current === c.name ? `2px solid ${t.text}` : `1px solid ${t.border}`,
            background: c.hex || `linear-gradient(135deg, ${t.surface} 49%, ${t.muted} 51%)`,
          }}
        />
      ))}
    </div>,
    document.body,
  )
}
