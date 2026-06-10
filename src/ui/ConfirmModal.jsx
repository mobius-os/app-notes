// In-app confirm dialog. The iframe sandbox has no `allow-modals`, so
// window.confirm/alert silently no-op + return false — we MUST build our own.

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  if (!open) return null
  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onCancel}
      className="nt-modal-scrim"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="nt-modal"
      >
        {title && <h2 className="nt-modal-title">{title}</h2>}
        {message && <p className="nt-modal-msg">{message}</p>}
        <div className="nt-modal-actions">
          <button onClick={onCancel} className="nt-modal-btn nt-modal-cancel">Cancel</button>
          <button
            onClick={onConfirm}
            className="nt-modal-btn nt-modal-confirm"
            style={{ background: danger ? 'var(--danger)' : 'var(--accent)' }}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
