// CodeMirror 6 extension stack for the Notes editor: markdown language, a
// theme-driven syntax highlight (headings grow, bold/italic styled), the live
// preview decorations (livePreview.js), formatting shortcuts, history, and
// line wrapping. Only the pieces we use are pulled from the vendored bundle.
import {
  EditorSelection,
} from '@codemirror/state'
import {
  history, historyKeymap, defaultKeymap, indentWithTab,
} from '@codemirror/commands'
import { markdown, markdownLanguage } from '@codemirror/lang-markdown'
import {
  syntaxHighlighting, HighlightStyle, indentOnInput,
} from '@codemirror/language'
import { tags } from '@lezer/highlight'
import { EditorView, keymap } from '@codemirror/view'
import { livePreview, mathPreview } from './livePreview.js'

const heading = (size, weight) => ({ fontSize: size, fontWeight: weight, lineHeight: '1.3' })

const highlightStyle = HighlightStyle.define([
  { tag: tags.heading1, ...heading('1.6em', '700') },
  { tag: tags.heading2, ...heading('1.36em', '700') },
  { tag: tags.heading3, ...heading('1.18em', '650') },
  { tag: [tags.heading4, tags.heading5, tags.heading6], ...heading('1.06em', '650') },
  { tag: tags.strong, fontWeight: '700' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, color: 'var(--accent)', textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted)' },
  { tag: [tags.monospace], fontFamily: 'var(--mono)', fontSize: '0.92em', background: 'var(--surface2)', borderRadius: '4px', padding: '0 3px' },
  { tag: tags.quote, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.list, color: 'var(--text)' },
  { tag: tags.processingInstruction, color: 'var(--muted)', opacity: 0.6 },
  { tag: tags.contentSeparator, color: 'var(--border)' },
])

const theme = EditorView.theme({
  '&': { height: '100%', backgroundColor: 'transparent', color: 'var(--text)' },
  '.cm-scroller': { overflow: 'auto', fontFamily: 'var(--font)', lineHeight: '1.65', fontSize: '15px' },
  '.cm-content': { padding: '16px 18px 40vh', caretColor: 'var(--accent)', maxWidth: '760px', margin: '0 auto', width: '100%' },
  '&.cm-focused': { outline: 'none' },
  '.cm-cursor, .cm-dropCursor': { borderLeftColor: 'var(--accent)', borderLeftWidth: '2px' },
  '.cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 22%, transparent)' },
  '&.cm-focused .cm-selectionBackground': { backgroundColor: 'color-mix(in srgb, var(--accent) 30%, transparent)' },
  '.cm-line': { padding: '0' },
}, { dark: true })

// Wrap the selection in `mark`…`markEnd` (bold, italic, code, strike). With no
// selection, inserts the pair and parks the cursor between the markers.
function wrap(mark, markEnd = mark) {
  return (view) => {
    const tr = view.state.changeByRange((range) => {
      const text = view.state.sliceDoc(range.from, range.to)
      return {
        changes: { from: range.from, to: range.to, insert: mark + text + markEnd },
        range: EditorSelection.range(range.from + mark.length, range.to + mark.length),
      }
    })
    view.dispatch(view.state.update(tr, { userEvent: 'input.format', scrollIntoView: true }))
    return true
  }
}

const mdKeymap = [
  { key: 'Mod-b', run: wrap('**') },
  { key: 'Mod-i', run: wrap('*') },
  { key: 'Mod-e', run: wrap('`') },
  { key: 'Mod-Shift-x', run: wrap('~~') },
]

export function buildExtensions({ onDocChange, resolveAttachment }) {
  return [
    history(),
    markdown({ base: markdownLanguage }),
    syntaxHighlighting(highlightStyle),
    indentOnInput(),
    EditorView.lineWrapping,
    livePreview({ resolveAttachment }),
    mathPreview,
    keymap.of([...mdKeymap, indentWithTab, ...historyKeymap, ...defaultKeymap]),
    theme,
    EditorView.updateListener.of((u) => { if (u.docChanged) onDocChange(u.state.doc.toString()) }),
  ]
}
