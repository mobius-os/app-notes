// A small swatch popover for choosing a note's color tag.
import { T } from './theme.js'
import { NOTE_COLORS } from './colors.js'

export default function ColorPicker({ current, onPick, placement = 'above' }) {
  const t = T()
  const vertical = placement === 'below'
    ? { top: 'calc(100% + 6px)' }
    : { bottom: 'calc(100% + 6px)' }
  return (
    <div
      role="menu"
      aria-label="Note color"
      onClick={(e) => e.stopPropagation()}
      style={{
        position: 'absolute', left: 0, zIndex: 20, ...vertical,
        display: 'flex', gap: 6, padding: 8, background: t.surface2,
        border: `1px solid ${t.border}`, borderRadius: 12,
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
            width: 22, height: 22, borderRadius: '50%', cursor: 'pointer', padding: 0,
            border: current === c.name ? `2px solid ${t.text}` : `1px solid ${t.border}`,
            background: c.hex || `linear-gradient(135deg, ${t.surface} 49%, ${t.muted} 51%)`,
          }}
        />
      ))}
    </div>
  )
}
