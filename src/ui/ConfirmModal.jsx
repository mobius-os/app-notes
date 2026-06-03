// In-app confirm dialog. The iframe sandbox has no `allow-modals`, so
// window.confirm/alert silently no-op + return false — we MUST build our own.
import { T } from './theme.js'

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  const t = T()
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      style={{
        position: 'fixed', inset: 0, zIndex: 50, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 20,
        background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(2px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 360, background: t.surface,
          border: `1px solid ${t.border}`, borderRadius: 16, padding: 20,
          boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
        }}
      >
        {title && <h2 style={{ fontSize: 16, fontWeight: 650, color: t.text, marginBottom: 8 }}>{title}</h2>}
        {message && <p style={{ fontSize: 14, color: t.muted, lineHeight: 1.5, marginBottom: 18 }}>{message}</p>}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 16px', borderRadius: 10, border: `1px solid ${t.border}`,
              background: 'transparent', color: t.text, fontSize: 14, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 16px', borderRadius: 10, border: 'none',
              background: danger ? t.danger : t.accent, color: '#0d0d0d',
              fontSize: 14, fontWeight: 600, cursor: 'pointer',
            }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
