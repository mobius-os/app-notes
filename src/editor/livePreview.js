// Obsidian-style "Live Preview": render markdown in place as you type. A
// ViewPlugin walks the syntax tree (plus a regex pass for math, which the base
// markdown grammar doesn't parse) and builds decorations that:
//   - hide emphasis/heading/strikethrough MARKERS on lines the cursor isn't on
//     (so text just looks bold/italic/big), revealing the raw source when you
//     move into the line to edit it;
//   - replace task `[ ]`/`[x]` with a real checkbox, images with <img>, file
//     refs with a chip, and `$…$`/`$$…$$` with KaTeX.
//
// The whole build is wrapped in try/catch returning Decoration.none, so a
// decoration bug degrades to a plain (still excellent) CodeMirror markdown
// editor rather than crashing the view.
import { syntaxTree } from '@codemirror/language'
import { ViewPlugin, Decoration, EditorView } from '@codemirror/view'
import { StateField } from '@codemirror/state'
import { CheckboxWidget, ImageWidget, FileChipWidget, MathWidget } from './widgets.js'
import { findMathSpans } from '../lib/math-scan.js'

const HIDE_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark'])

// Math decorations live in a StateField, not the ViewPlugin below. A display
// `$$…$$` block spans line breaks, and CodeMirror forbids plugin-provided
// decorations from replacing a line break ("Decorations that replace line
// breaks may not be specified via plugins") — so a multi-line block would throw
// and the whole live-preview would degrade to plain text. StateField-provided
// decorations are allowed to cross line breaks, which is what makes multi-line
// `$$` render at all.
function buildMathDecorations(state) {
  const sel = state.selection.main
  const aFrom = state.doc.lineAt(sel.from).from
  const aTo = state.doc.lineAt(sel.to).to
  const onActive = (from, to) => to >= aFrom && from <= aTo
  const spans = findMathSpans(state.doc.toString())
  const ranges = []
  for (const sp of spans) {
    // Reveal the raw `$…$` source when the selection touches the math range so
    // it can be edited (mirrors the marker-hiding behavior in the ViewPlugin).
    if (onActive(sp.from, sp.to)) continue
    ranges.push(Decoration.replace({ widget: new MathWidget(sp.src, sp.block) }).range(sp.from, sp.to))
  }
  return Decoration.set(ranges, true)
}

export const mathPreview = StateField.define({
  create(state) {
    try { return buildMathDecorations(state) } catch { return Decoration.none }
  },
  update(value, tr) {
    if (!tr.docChanged && !tr.selection) return value
    try { return buildMathDecorations(tr.state) } catch { return Decoration.none }
  },
  provide: (f) => EditorView.decorations.from(f),
})

export function livePreview({ resolveAttachment } = {}) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) { this.decorations = this.build(view) }
      update(u) {
        if (u.docChanged || u.viewportChanged || u.selectionSet) this.decorations = this.build(u.view)
      }
      build(view) {
        try {
          const { state } = view
          const sel = state.selection.main
          const aFrom = state.doc.lineAt(sel.from).from
          const aTo = state.doc.lineAt(sel.to).to
          const onActive = (from, to) => to >= aFrom && from <= aTo
          // Math is decorated by the mathPreview StateField. Skip any tree-mark
          // decoration that falls inside a math span (e.g. `*` inside `$a*b$`)
          // so the two providers never emit overlapping replace decorations,
          // which CodeMirror rejects.
          const mathSpans = findMathSpans(state.doc.toString())
          const inMath = (from, to) => mathSpans.some((s) => from < s.to && to > s.from)
          const out = []
          const tree = syntaxTree(state)
          for (const { from, to } of view.visibleRanges) {
            tree.iterate({
              from, to,
              enter: (node) => {
                if (inMath(node.from, node.to)) return
                const name = node.name
                if (name === 'TaskMarker') {
                  // Show the raw `[ ]` on the cursor's line so typing isn't
                  // corrupted by an atomic replace-widget; render the checkbox
                  // only on inactive lines (Obsidian's Live Preview behavior).
                  if (!onActive(node.from, node.to)) {
                    const text = state.sliceDoc(node.from, node.to)
                    out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new CheckboxWidget(/x/i.test(text), node.from) }) })
                  }
                } else if (name === 'Image') {
                  if (!onActive(node.from, node.to)) {
                    // Use the URL child node directly so alt text with `]` characters
                    // (e.g. filenames like "photo[1].jpg") doesn't break the match.
                    // The regex /!\[([^\]]*)\]\(/ fails for those because [^\]]* stops
                    // at the first ] in the alt, leaving the rest unmatched.
                    const urlChild = node.node.getChild('URL')
                    if (urlChild) {
                      const src = state.sliceDoc(urlChild.from, urlChild.to)
                      // Alt text occupies node.from+2 ("![" prefix) .. urlChild.from-2 ("](" before URL)
                      const alt = state.sliceDoc(node.from + 2, urlChild.from - 2)
                      out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ImageWidget(src, alt, resolveAttachment) }) })
                    }
                  }
                } else if (name === 'Link') {
                  if (!onActive(node.from, node.to)) {
                    const md = state.sliceDoc(node.from, node.to)
                    const mm = /^\[([^\]]*)\]\(([^)\s]+)/.exec(md)
                    if (mm && mm[2].startsWith('attachments/')) {
                      out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new FileChipWidget(mm[1] || 'file', mm[2], resolveAttachment) }) })
                    }
                  }
                } else if (HIDE_MARKS.has(name)) {
                  if (!onActive(node.from, node.to)) out.push({ from: node.from, to: node.to, deco: Decoration.replace({}) })
                }
              },
            })
          }
          // Math decorations come from the mathPreview StateField (block math
          // may cross line breaks, which plugins are forbidden to do).
          out.sort((a, b) => a.from - b.from || a.to - b.to)
          // Drop overlaps (a later decoration starting before the previous ends)
          // — CM requires non-overlapping replace decorations.
          const ranges = []
          let lastTo = -1
          for (const w of out) {
            if (w.from < lastTo) continue
            ranges.push(w.deco.range(w.from, w.to))
            lastTo = w.to
          }
          return Decoration.set(ranges, true)
        } catch (e) {
          return Decoration.none
        }
      }
    },
    { decorations: (v) => v.decorations },
  )
}
