// The derived grid index: a small projection of every note (id, title,
// snippet, pinned, color, updated) so the home grid loads fast without parsing
// every note body. It is STRICTLY DERIVED from `notes/*.md` — never merged,
// never authoritative. If `index.json` is ever stale or conflicting, discard it
// and `rebuildFromFiles` (DESIGN §5, plan Task C5). Pure functions, no IO.

const SNIPPET_LEN = 140

// Reduce a markdown body to a short plain-text preview: drop the structural
// markers (headings, emphasis, code fences, list/quote bullets, link/image
// syntax) so the grid shows readable prose, then collapse whitespace and clip.
// This is a lightweight strip for previews — not a full markdown parser; the
// card itself renders real markdown via marked+DOMPurify.
function stripMarkdown(body) {
  let s = String(body ?? '')
  // Images: ![alt](url) → alt. Do images before links (same bracket shape).
  s = s.replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Links: [text](url) → text.
  s = s.replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
  // Inline/code-fence backticks.
  s = s.replace(/`+/g, '')
  // Emphasis runs: ** __ * _ ~~.
  s = s.replace(/(\*\*|__|~~|\*|_)/g, '')
  // Leading line markers: heading #, blockquote >, list bullets, ordered nums.
  s = s.replace(/^\s{0,3}(#{1,6}\s+|>\s?|[-*+]\s+|\d+\.\s+)/gm, '')
  // Collapse all whitespace (incl. newlines) to single spaces.
  s = s.replace(/\s+/g, ' ').trim()
  return s
}

function snippetOf(body) {
  const text = stripMarkdown(body)
  return text.length > SNIPPET_LEN ? text.slice(0, SNIPPET_LEN) : text
}

// Project one `{meta, body}` to its index entry.
function toEntry({meta, body}) {
  return {
    id: meta.id,
    title: meta.title ?? '',
    snippet: snippetOf(body),
    pinned: meta.pinned ?? false,
    color: meta.color ?? null,
    updated: meta.updated,
  }
}

// Pinned notes first, then most-recently-updated first within each group.
// String comparison on ISO timestamps is chronological, so we sort on the raw
// `updated` value (missing → sorts last via empty string).
function byPinnedThenUpdatedDesc(a, b) {
  if (a.pinned !== b.pinned) return a.pinned ? -1 : 1
  const ua = a.updated ?? ''
  const ub = b.updated ?? ''
  if (ua === ub) return 0
  return ua < ub ? 1 : -1
}

// Build the derived index from an array of `{meta, body}` notes. Does not mutate
// the input (sorts a copy).
export function buildIndex(notes) {
  const entries = (notes ?? []).map(toEntry)
  entries.sort(byPinnedThenUpdatedDesc)
  return {notes: entries}
}

// Alias used by the reconcile/storage layers when they rebuild the cache from
// the canonical files on disk. Same pure projection — named for the call site.
export function rebuildFromFiles(arr) {
  return buildIndex(arr)
}

// Reconstitute lightweight `{meta, body}` placeholders from a previously written
// index.json so the grid can paint instantly on cold load, before the canonical
// notes/*.md files are enumerated and parsed. The index has no full body, so the
// snippet stands in as the preview text until listNotes() replaces these with
// the authoritative notes (a brief transient — thumbnails/attachments appear on
// the full load). Returns [] for a missing/malformed index.
export function notesFromIndex(index) {
  const entries = index && Array.isArray(index.notes) ? index.notes : []
  return entries
    .filter((e) => e && e.id)
    .map((e) => ({
      meta: {
        id: e.id,
        title: e.title ?? '',
        pinned: e.pinned ?? false,
        color: e.color ?? null,
        updated: e.updated,
      },
      body: e.snippet ?? '',
    }))
}
