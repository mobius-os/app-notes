// React wrapper around a CodeMirror 6 EditorView running the Notes live-preview
// extension stack. Controlled-ish: `value` seeds the doc and an external change
// (switching notes / a resolver landing a merge) replaces it; local typing
// flows out through `onChange`. `viewRef` exposes the EditorView so the panel
// can insert attachment markdown at the cursor.
import { useRef, useEffect } from 'react'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { buildExtensions } from './extensions.js'

export default function Editor({ value, onChange, resolveAttachment, viewRef }) {
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

  // External value change (note switch / live resolver update) -> replace doc.
  useEffect(() => {
    const v = view.current
    if (!v) return
    const cur = v.state.doc.toString()
    if (value != null && value !== cur) {
      v.dispatch({ changes: { from: 0, to: cur.length, insert: value } })
    }
  }, [value])

  return <div ref={host} style={{ height: '100%' }} />
}
