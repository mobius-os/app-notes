// In-app confirm dialog. The iframe sandbox has no `allow-modals`, so
// window.confirm/alert silently no-op + return false — we MUST build our own.
import { useEffect, useId, useRef, useCallback } from 'react'

export default function ConfirmModal({ open, title, message, confirmLabel = 'Confirm', danger, onConfirm, onCancel }) {
  const dialogRef = useRef(null)
  const cancelRef = useRef(null)
  // The element focus returns to on close — captured once at open, before
  // focus moves into the dialog. A ref (not state) so it survives re-renders
  // without being a dependency.
  const openerRef = useRef(null)
  // A stable id ties the dialog to its title for aria-labelledby; the
  // component is reusable, so it can't share a hardcoded id with another
  // instance.
  const titleId = useId()
  const messageId = useId()

  // Focus Cancel on open, restore the opener on close. Cancel is the safe
  // default so keyboard/AT users land on "back out", not on a destructive
  // confirm.
  useEffect(() => {
    if (!open) return
    openerRef.current = document.activeElement
    cancelRef.current?.focus()
    return () => {
      const opener = openerRef.current
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) {
        opener.focus()
      }
    }
  }, [open])

  // Escape cancels; Tab is trapped to the dialog's focusable elements so focus
  // can't wander to the inert content behind the scrim. The focusable set is
  // computed per-keydown so it always reflects the current DOM.
  const onKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onCancel()
      return
    }
    if (e.key !== 'Tab') return
    const focusable = dialogRef.current?.querySelectorAll(
      'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
    if (!focusable || focusable.length === 0) {
      e.preventDefault()
      return
    }
    const first = focusable[0]
    const last = focusable[focusable.length - 1]
    const active = document.activeElement
    if (e.shiftKey && active === first) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active === last) {
      e.preventDefault()
      first.focus()
    }
  }, [onCancel])

  if (!open) return null
  return (
    <div
      onClick={onCancel}
      onKeyDown={onKeyDown}
      className="nt-modal-scrim"
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={message ? messageId : undefined}
        onClick={(e) => e.stopPropagation()}
        className="nt-modal"
      >
        {title && <h2 id={titleId} className="nt-modal-title">{title}</h2>}
        {message && <p id={messageId} className="nt-modal-msg">{message}</p>}
        <div className="nt-modal-actions">
          <button type="button" ref={cancelRef} onClick={onCancel} className="nt-modal-btn nt-modal-cancel">Cancel</button>
          <button
            type="button"
            onClick={onConfirm}
            className={`nt-modal-btn nt-modal-confirm${danger ? ' is-danger' : ''}`}
          >{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}
