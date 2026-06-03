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
import { ViewPlugin, Decoration, syntaxTree } from 'codemirror'
import { CheckboxWidget, ImageWidget, FileChipWidget, MathWidget } from './widgets.js'

const HIDE_MARKS = new Set(['HeaderMark', 'EmphasisMark', 'StrikethroughMark'])

const INLINE_MATH = /(?<!\$)\$([^$\n]+?)\$(?!\$)/g
const BLOCK_MATH = /\$\$([^\n]+?)\$\$/g

function scanMath(state, ranges, onActive, out) {
  for (const { from, to } of ranges) {
    let startLine = state.doc.lineAt(from).number
    const endLine = state.doc.lineAt(to).number
    for (let n = startLine; n <= endLine; n++) {
      const line = state.doc.line(n)
      const text = line.text
      let m
      BLOCK_MATH.lastIndex = 0
      const blocked = []
      while ((m = BLOCK_MATH.exec(text))) {
        const f = line.from + m.index
        const t = f + m[0].length
        blocked.push([m.index, m.index + m[0].length])
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), true) }) })
      }
      INLINE_MATH.lastIndex = 0
      while ((m = INLINE_MATH.exec(text))) {
        const insideBlock = blocked.some(([a, b]) => m.index >= a && m.index < b)
        if (insideBlock) continue
        const f = line.from + m.index
        const t = f + m[0].length
        if (!onActive(f, t)) out.push({ from: f, to: t, deco: Decoration.replace({ widget: new MathWidget(m[1].trim(), false) }) })
      }
    }
  }
}

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
          const out = []
          const tree = syntaxTree(state)
          for (const { from, to } of view.visibleRanges) {
            tree.iterate({
              from, to,
              enter: (node) => {
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
                    const md = state.sliceDoc(node.from, node.to)
                    const mm = /!\[([^\]]*)\]\(([^)\s]+)/.exec(md)
                    if (mm) out.push({ from: node.from, to: node.to, deco: Decoration.replace({ widget: new ImageWidget(mm[2], mm[1], resolveAttachment) }) })
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
          scanMath(state, view.visibleRanges, onActive, out)
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
