// React wrapper around a CodeMirror 6 EditorView running the Notes live-preview
// extension stack. CodeMirror is the body source of truth while a note is open:
// `value` seeds the doc, and only an explicit `syncKey` change is allowed to
// replace the document. Local typing flows out through `onChange`. `viewRef`
// exposes the EditorView so the panel can insert attachment markdown at the
// cursor.
import { useRef, useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions.js'

export default function Editor({ value, onChange, resolveAttachment, viewRef, syncKey }) {
  const host = useRef(null)
  const view = useRef(null)
  const onChangeRef = useRef(onChange)
  const resolveRef = useRef(resolveAttachment)
  onChangeRef.current = onChange
  resolveRef.current = resolveAttachment

  useEffect(() => {
    const state = EditorState.create({
      doc: value || '',
      extensions: buildExtensions({
        onDocChange: (t) => { if (onChangeRef.current) onChangeRef.current(t) },
        resolveAttachment: (p) => (resolveRef.current ? resolveRef.current(p) : Promise.resolve(null)),
      }),
    })
    const v = new EditorView({ state, parent: host.current })
    view.current = v
    if (viewRef) viewRef.current = v
    return () => { v.destroy(); view.current = null; if (viewRef) viewRef.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // External value change (note switch) -> replace doc. Deliberately keyed on
  // syncKey, not value: during rapid typing React can briefly render an older
  // `value` than the live CodeMirror doc. Re-dispatching that stale prop is what
  // scrambled characters in production.
  useEffect(() => {
    const v = view.current
    if (!v) return
    const cur = v.state.doc.toString()
    if (value != null && value !== cur) {
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [syncKey])

  return <div ref={host} style={{ height: '100%' }} />
}
