// Pure 3-way merge for note bodies and frontmatter.
//
// The only runtime dependency is node-diff3 (vendored via esm.sh at runtime,
// devDependency in tests). This module is IO-free so Phase C/D stay testable in
// isolation — the caller injects everything else.

import { mergeDigIn, diffIndices } from 'node-diff3'

// ---------------------------------------------------------------------------
// Body merge
// ---------------------------------------------------------------------------

// Split a document into lines for line-wise 3-way merge. We deliberately split
// on '\n' only (not on '\r\n' / final-newline normalization) so the merge is a
// faithful, reversible transform of the bytes the editor produced.
function toLines(text) {
  return text.split('\n')
}

// Each diffIndices entry describes a base-line range one side replaced. We
// normalize it to {start, len, repl} against base coordinates so two sides'
// edits can be compared and re-applied independently.
function changedRanges(baseLines, sideLines) {
  return diffIndices(baseLines, sideLines).map((d) => ({
    start: d.buffer1[0],
    len: d.buffer1[1],
    repl: d.buffer2Content,
  }))
}

// Two base-line ranges overlap when they touch any common base line. A pure
// insertion (len 0) is a point between lines: it only collides with another
// insertion at the exact same point, never with a replacement beside it.
function rangesOverlap(a, b) {
  if (a.len === 0 && b.len === 0) return a.start === b.start
  const aEnd = a.start + Math.max(a.len, 0)
  const bEnd = b.start + Math.max(b.len, 0)
  return a.start < bEnd && b.start < aEnd
}

// When line-level diff3 reports a conflict purely because both sides edited
// ADJACENT base lines (no unchanged anchor between them), the edits are still
// semantically disjoint. Resolve by applying both sides' base-line edits to the
// base — but only if no two edits touch the same base line. Returns merged lines
// on success, or null when the edits genuinely overlap (a real conflict).
function resolveDisjoint(baseLines, mineLines, theirsLines) {
  const mineRanges = changedRanges(baseLines, mineLines)
  const theirsRanges = changedRanges(baseLines, theirsLines)
  for (const a of mineRanges) {
    for (const b of theirsRanges) {
      if (rangesOverlap(a, b)) return null
    }
  }
  // Apply edits from the end backwards so earlier splice indices stay valid.
  const edits = [...mineRanges, ...theirsRanges].sort((p, q) => q.start - p.start)
  const out = baseLines.slice()
  for (const e of edits) out.splice(e.start, e.len, ...e.repl)
  return out
}

// Extract the structured hunks of a conflicted merge so the agent resolver (and
// tests) can inspect base/mine/theirs for each conflicting region instead of
// re-parsing conflict markers out of text.
function conflictHunks(baseLines, mineLines, theirsLines) {
  const mineRanges = changedRanges(baseLines, mineLines)
  const theirsRanges = changedRanges(baseLines, theirsLines)
  const hunks = []
  for (const a of mineRanges) {
    for (const b of theirsRanges) {
      if (!rangesOverlap(a, b)) continue
      const start = Math.min(a.start, b.start)
      const end = Math.max(a.start + Math.max(a.len, 0), b.start + Math.max(b.len, 0))
      hunks.push({
        conflict: true,
        base: baseLines.slice(start, end),
        mine: a.repl,
        theirs: b.repl,
      })
    }
  }
  return hunks
}

// merge3(base, mine, theirs) -> {clean, text, conflict, hunks?}
//
// Non-overlapping edits (including adjacent single-line edits like the canonical
// 'a\nb\nc' / 'a\nB\nc' / 'a\nb\nC' -> 'a\nB\nC') merge clean; identical edits on
// both sides merge clean; overlapping edits on the same base line(s) produce a
// conflict with base/mine/theirs retained in `hunks`.
export function merge3(base, mine, theirs) {
  const baseLines = toLines(base)
  const mineLines = toLines(mine)
  const theirsLines = toLines(theirs)

  // First pass: node-diff3's line-level merge. It cleanly handles edits with an
  // unchanged anchor between them, one-sided edits, and identical edits.
  const dig = mergeDigIn(mineLines, baseLines, theirsLines)
  if (!dig.conflict) {
    return { clean: true, conflict: false, text: dig.result.join('\n') }
  }

  // Second pass: line-level diff3 over-reports a conflict when both sides edit
  // adjacent base lines. Recover the clean merge if the edits are disjoint.
  const merged = resolveDisjoint(baseLines, mineLines, theirsLines)
  if (merged) {
    return { clean: true, conflict: false, text: merged.join('\n') }
  }

  // Genuine conflict: surface the regions for the agent resolver.
  return {
    clean: false,
    conflict: true,
    text: dig.result.join('\n'),
    hunks: conflictHunks(baseLines, mineLines, theirsLines),
  }
}

// ---------------------------------------------------------------------------
// Frontmatter merge
// ---------------------------------------------------------------------------

// Pick the side whose `updated` timestamp is later. Ties and missing values fall
// back to `mine` so a no-op reconcile is deterministic.
function laterSide(mine, theirs) {
  const m = mine?.updated ?? ''
  const t = theirs?.updated ?? ''
  return t > m ? theirs : mine
}

// mergeMeta(base, mine, theirs) -> merged frontmatter object.
//
// tags: set-union of both sides. title/color/pinned/type/archived: taken from
// the side with the later `updated`. mobius_rev: max(mine, theirs) + 1.
// parent_revs records both source revs. id/created are pinned to base
// (stable identity).
export function mergeMeta(base, mine, theirs) {
  const winner = laterSide(mine, theirs)

  const tags = [...new Set([...(mine?.tags ?? []), ...(theirs?.tags ?? [])])]

  const mineRev = mine?.mobius_rev ?? 0
  const theirsRev = theirs?.mobius_rev ?? 0

  return {
    id: base?.id,
    created: base?.created,
    title: winner?.title,
    color: winner?.color ?? null,
    pinned: winner?.pinned ?? false,
    tags,
    type: winner?.type ?? 'note',
    archived: winner?.archived ?? false,
    updated: winner?.updated,
    mobius_rev: Math.max(mineRev, theirsRev) + 1,
    parent_revs: [mineRev, theirsRev],
  }
}
