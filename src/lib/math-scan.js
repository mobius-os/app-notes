// Pure math-delimiter scanning for the live-preview editor. No IO, no
// CodeMirror — so it stays unit-testable (node --test); the editor's
// livePreview.js maps the returned offsets onto the document and renders each
// span with KaTeX.

// Display math `$$…$$` may span multiple lines, so it is matched over the whole
// document text rather than line-by-line ([\s\S], not [^\n]).
const BLOCK_MATH = /\$\$([\s\S]+?)\$\$/g
// Inline math `$…$` stays on one line. It is matched only OUTSIDE block-math
// regions, with a KaTeX/pandoc-style delimiter guard (see isInlineMathDelims)
// so prose with stray dollar amounts ("$5 and $10") is not glued into one
// bogus span.
const INLINE_MATH = /\$([^$\n]+?)\$/g

// A `$…$` run is treated as inline math only if its delimiters look like math
// rather than currency: the opening `$` is not followed by whitespace or a
// digit, and the closing `$` is not preceded by whitespace. This is the rule
// markdown-it-katex / pandoc use; it rejects "$5 and $10" (opening `$` is
// followed by the digit 5) while accepting "$x+1$".
export function isInlineMathDelims(content) {
  if (content.length === 0) return false
  const first = content[0]
  const last = content[content.length - 1]
  if (first === ' ' || first === '\t' || /[0-9]/.test(first)) return false
  if (last === ' ' || last === '\t') return false
  return true
}

// Scan a text string and return absolute-offset math spans
// ({from, to, src, block}). Block spans are found first; inline spans are
// emitted only where they don't overlap a block span.
export function findMathSpans(text) {
  const src = String(text || '')
  const spans = []
  const blocked = []
  BLOCK_MATH.lastIndex = 0
  let m
  while ((m = BLOCK_MATH.exec(src))) {
    const from = m.index
    const to = from + m[0].length
    blocked.push([from, to])
    spans.push({ from, to, src: m[1].trim(), block: true })
  }
  const insideBlock = (i) => blocked.some(([a, b]) => i >= a && i < b)
  INLINE_MATH.lastIndex = 0
  while ((m = INLINE_MATH.exec(src))) {
    if (insideBlock(m.index)) continue
    if (!isInlineMathDelims(m[1])) continue
    const from = m.index
    const to = from + m[0].length
    spans.push({ from, to, src: m[1].trim(), block: false })
  }
  return spans
}
