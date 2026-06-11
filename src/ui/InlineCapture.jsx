// InlineCapture — the Keep-style "Take a note…" affordance.
// Collapsed: a single-row pill you tap to expand.
// Expanded: title + textarea in-place, with Done / discard semantics.
// On blur-outside or Done: commits if non-empty, discards if blank.
// A small checklist toggle lets you start in checklist mode.
import { useState, useRef, useCallback, useEffect } from 'react'
import { Icon } from './icons.jsx'

export default function InlineCapture({ onCreate }) {
  const [expanded, setExpanded] = useState(false)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [isChecklist, setIsChecklist] = useState(false)
  const wrapRef = useRef(null)
  const bodyRef = useRef(null)

  // Commit: non-blank → call onCreate; blank → discard.
  const commit = useCallback(() => {
    const t = title.trim()
    const b = body.trim()
    if (t || b) {
      let finalBody = b
      // If checklist mode and there's body content, format as list items if not already
      if (isChecklist && finalBody && !/^- \[[ x]\] /m.test(finalBody)) {
        finalBody = finalBody.split('\n').filter(Boolean).map((l) => `- [ ] ${l}`).join('\n')
      } else if (isChecklist && !finalBody) {
        finalBody = ''
      }
      onCreate({ title: t, body: finalBody, type: isChecklist ? 'checklist' : 'note' })
    }
    // Always reset
    setExpanded(false)
    setTitle('')
    setBody('')
    setIsChecklist(false)
  }, [title, body, isChecklist, onCreate])

  // Click-outside: commit and collapse
  useEffect(() => {
    if (!expanded) return undefined
    const onPointerDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        commit()
      }
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [expanded, commit])

  // Auto-focus body when expanded
  useEffect(() => {
    if (expanded && bodyRef.current) {
      bodyRef.current.focus()
    }
  }, [expanded])

  // Auto-grow textarea
  const autoGrow = useCallback((el) => {
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }, [])

  if (!expanded) {
    return (
      <div className="nt-capture-wrap">
        <div
          className="nt-capture-pill"
          role="button"
          tabIndex={0}
          aria-label="Take a note"
          onClick={() => setExpanded(true)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setExpanded(true) } }}
        >
          <span className="nt-capture-placeholder">Take a note…</span>
          <button
            className={`nt-capture-type-toggle${isChecklist ? ' is-checklist' : ''}`}
            title={isChecklist ? 'Switch to note' : 'New checklist'}
            aria-label={isChecklist ? 'Switch to note' : 'New checklist'}
            onClick={(e) => {
              e.stopPropagation()
              setIsChecklist((v) => !v)
              setExpanded(true)
            }}
          >
            <Icon name={isChecklist ? 'checklist' : 'checklist'} size={18} />
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="nt-capture-wrap" ref={wrapRef}>
      <div className="nt-capture-card">
        <input
          className="nt-capture-title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          aria-label="Note title"
          onKeyDown={(e) => {
            if (e.key === 'Escape') { commit() }
            if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); bodyRef.current?.focus() }
          }}
        />
        <textarea
          ref={bodyRef}
          className="nt-capture-body"
          value={body}
          onChange={(e) => { setBody(e.target.value); autoGrow(e.target) }}
          placeholder={isChecklist ? 'List item' : 'Take a note…'}
          aria-label="Note body"
          rows={3}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { commit() }
          }}
        />
        <div className="nt-capture-footer">
          <button
            className={`nt-capture-type-toggle${isChecklist ? ' is-checklist' : ''}`}
            title={isChecklist ? 'Switch to note' : 'Switch to checklist'}
            aria-label={isChecklist ? 'Switch to note' : 'Switch to checklist'}
            onClick={() => setIsChecklist((v) => !v)}
          >
            <Icon name="checklist" size={17} />
          </button>
          <button className="nt-capture-done" onClick={commit}>Done</button>
        </div>
      </div>
    </div>
  )
}
