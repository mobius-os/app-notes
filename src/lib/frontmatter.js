// Tiny YAML-subset frontmatter parser/serializer for note files.
//
// A note file is `---\n<yaml>\n---\n<body>`. The YAML we support is the strict
// subset notes actually use: one `key: value` per line, scalar values that are
// booleans / null / numbers / strings, and `[a, b]` flow arrays. No nesting, no
// block sequences, no anchors. Anything richer is out of scope by design — a
// note's frontmatter is a flat record, and hand-rolling this keeps the app
// dependency-free (DESIGN §4, plan Phase C / Task C1).

const FENCE = '---'

// Parse a single scalar token (the part after `key:`, or an array element).
// Order matters: a bare `true`/`false`/`null` is the keyword, not a string;
// a fully-numeric token is a number; ISO date strings stay strings so they
// round-trip byte-for-byte (notes store timestamps as ISO text, not Date).
function parseScalar(raw) {
  const s = raw.trim()
  if (s === '') return ''
  if (s === 'true') return true
  if (s === 'false') return false
  if (s === 'null' || s === '~') return null
  // Quoted string: strip the quotes, no escape processing needed for our values.
  if ((s[0] === '"' && s[s.length - 1] === '"') ||
      (s[0] === "'" && s[s.length - 1] === "'")) {
    return s.slice(1, -1)
  }
  // Number: only when the whole token is numeric (so `2026-06-03…` stays a string).
  if (/^-?\d+(\.\d+)?$/.test(s)) return Number(s)
  return s
}

function parseValue(raw) {
  const s = raw.trim()
  if (s[0] === '[' && s[s.length - 1] === ']') {
    const inner = s.slice(1, -1).trim()
    if (inner === '') return []
    return inner.split(',').map((el) => parseScalar(el))
  }
  return parseScalar(s)
}

// Split a document into its frontmatter block (if any) and the body. The body
// keeps its own `---` lines intact — only a `---` fence in the first line opens
// frontmatter, and the first subsequent lone `---` closes it.
export function parseFrontmatter(md) {
  const text = String(md)
  if (!text.startsWith(FENCE + '\n') && text !== FENCE) {
    return {meta: {}, body: text}
  }
  const lines = text.split('\n')
  // lines[0] is the opening fence. Find the closing fence.
  let close = -1
  for (let i = 1; i < lines.length; i++) {
    if (lines[i] === FENCE) {
      close = i
      break
    }
  }
  if (close === -1) {
    // No closing fence → treat the whole thing as body (malformed frontmatter).
    return {meta: {}, body: text}
  }
  const meta = {}
  for (let i = 1; i < close; i++) {
    const line = lines[i]
    if (line.trim() === '') continue
    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim()
    const value = line.slice(colon + 1)
    meta[key] = parseValue(value)
  }
  const body = lines.slice(close + 1).join('\n')
  return {meta, body}
}

// Serialize a scalar back to YAML text. Strings that could be misread on parse
// (look like a keyword/number, or contain a comma/colon/brackets) are quoted so
// the round-trip is lossless.
function serializeScalar(v) {
  if (v === null) return 'null'
  if (v === true) return 'true'
  if (v === false) return 'false'
  if (typeof v === 'number') return String(v)
  const s = String(v)
  const ambiguous =
    s === '' ||
    s === 'true' || s === 'false' || s === 'null' || s === '~' ||
    /^-?\d+(\.\d+)?$/.test(s) ||
    /[:,#\[\]]/.test(s) ||
    s.trim() !== s
  return ambiguous ? JSON.stringify(s) : s
}

function serializeValue(v) {
  if (Array.isArray(v)) {
    return '[' + v.map((el) => serializeScalar(el)).join(', ') + ']'
  }
  return serializeScalar(v)
}

// Stable key order so two metas with the same content serialize identically
// (content-hash and snapshot diffs both depend on this). Known note fields come
// first in their logical order; any extra keys follow, sorted, so unknown
// fields are still deterministic.
const KEY_ORDER = [
  'id', 'title', 'pinned', 'color', 'tags',
  'created', 'updated', 'mobius_rev', 'parent_rev', 'parent_revs',
  'content_hash', 'attachments',
]

function orderedKeys(meta) {
  const known = KEY_ORDER.filter((k) => k in meta)
  const extra = Object.keys(meta).filter((k) => !KEY_ORDER.includes(k)).sort()
  return [...known, ...extra]
}

export function serializeNote(meta, body) {
  const keys = orderedKeys(meta)
  const yaml = keys.map((k) => `${k}: ${serializeValue(meta[k])}`).join('\n')
  return `${FENCE}\n${yaml}\n${FENCE}\n${String(body)}`
}
