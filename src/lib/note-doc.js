// The per-note JSON document model for the platform `useDocument` migration.
//
// Each note is ONE JSON document at notes/<id>.json holding { meta, body } —
// `body` is still the note's markdown string, so the content the dreaming agent
// reads is unchanged; only the on-disk envelope moved from frontmatter-markdown
// to JSON so it fits window.mobius.createUseDocument (which is JSON-only). The
// homemade outbox + seq-CAS promote + reconcile driver that previously owned the
// canonical write are GONE — the runtime's serialized per-path writer + offline
// outbox now provide durability, and `mergeNoteDocs` / `makeMergeNote` below are
// the 3-way merge the runtime calls when a concurrent same-note write landed on
// the server first.
//
// PURE + nearly IO-free: the only side-effect is the injected `onConflict`
// callback (so the conflict descriptor write stays in the storage layer and this
// module is unit-testable in isolation). merge3 / mergeMeta are reused VERBATIM
// from merge.js so the conflict-detection semantics are preserved exactly.

import { merge3, mergeMeta } from './merge.js'

export const notePath = (id) => `notes/${id}.json`

// Synchronous content-identity equality of two note documents — the same fields
// note.js' contentHash digests (title, body, pinned, color, tags, type,
// archived), with the same defaults, so it agrees with the async hash without
// awaiting. Used to decide a fast-forward (server unchanged since our ancestor)
// inside the SYNCHRONOUS merge useDocument requires. Volatile bookkeeping
// (updated, rev, content_hash, id, created) is intentionally excluded.
function sameContent(a, b) {
  if (a == null || b == null) return a == null && b == null
  const am = a.meta ?? {}
  const bm = b.meta ?? {}
  const eqArr = (x, y) => {
    const xs = Array.isArray(x) ? x : []
    const ys = Array.isArray(y) ? y : []
    return xs.length === ys.length && xs.every((v, i) => v === ys[i])
  }
  return (
    (am.title ?? '') === (bm.title ?? '') &&
    String(a.body ?? '') === String(b.body ?? '') &&
    (am.pinned ?? false) === (bm.pinned ?? false) &&
    (am.color ?? null) === (bm.color ?? null) &&
    (am.type ?? 'note') === (bm.type ?? 'note') &&
    (am.archived ?? false) === (bm.archived ?? false) &&
    eqArr(am.tags, bm.tags)
  )
}

// A stored note document is the plain object { meta, body }. `id` is read off
// meta.id so useDocument's identity (and our collection keying) is the note id.
export const docId = (doc) => (doc && doc.meta ? doc.meta.id : undefined)

// The conflict descriptor is immutable and content-addressed by the three
// hashes, so two distinct conflicts on the same note never collide and the same
// conflict is idempotent to re-emit. It carries full base/mine/server for the
// agent resolver (tick.sh + the in-app "Resolve now"), which reasons about
// semantics rather than diff hunks. This mirrors the old reconciler's
// buildConflict EXACTLY — same shape, same path — so the cron resolver and the
// "Resolve now" prompt keep working unchanged.
export function buildConflictDescriptor({ noteId, base, mine, server, hashes }) {
  const { baseHash, mineHash, serverHash } = hashes
  return {
    noteId,
    baseHash,
    mineHash,
    serverHash,
    base,
    mine,
    server,
    attachmentsMine: mine?.meta?.attachments ?? [],
    attachmentsServer: server?.meta?.attachments ?? [],
    status: 'open',
    path: `conflicts/${noteId}/${baseHash}.${mineHash}.${serverHash}.json`,
  }
}

// mergeNoteDocs(base, mine, theirs) → { value, conflict }.
//
// The pure 3-way merge of two note documents ({ meta, body } or null). `value`
// is the merged document useDocument must land (LWW: it is ALWAYS produced, so
// the local edit is never blocked or lost). `conflict` is true when merge3
// reports a genuine overlapping-body conflict; in that case `value` keeps MINE's
// body (the user's edit lands canonically and is never silently dropped) and the
// caller — which runs in async context and has the hasher — builds the immutable
// conflict descriptor for the agent resolver + the editor's "merging…" bar.
//
// Keeping the hashing OUT of here (instead of a fire-and-forget inside a
// synchronous merge) makes the conflict path deterministic and awaitable: the
// storage layer (collection.js) emits the descriptor and can await it.
export function mergeNoteDocs(base, mine, theirs) {
  // Nothing local to write (defensive — useDocument only calls merge with a real
  // `mine` from fn(prev)). Fall back to theirs, then base.
  if (mine == null) return { value: theirs ?? base ?? null, conflict: false }
  // First write of a note the server has never seen: no remote to merge.
  if (theirs == null) return { value: mine, conflict: false }

  // Fast-forward: the server has NOT diverged from our ancestor in CONTENT (no
  // concurrent edit landed — body AND the content-identity meta match base).
  // Land MINE verbatim, preserving the caller's stamped meta (content_hash,
  // parent_rev, the freshly-bumped mobius_rev) exactly as the old reconciler's
  // fast-forward did (it compared the full content hash, not just the body). This
  // is the common save path; routing it through mergeMeta would needlessly
  // rewrite the rev bookkeeping and drop content_hash. We only 3-way-merge when
  // the server actually moved. `base` may be null on the very first observed edit
  // (no tracked ancestor) — then we cannot fast-forward, so fall through.
  if (base != null && sameContent(theirs, base)) {
    return { value: mine, conflict: false }
  }

  const baseBody = base?.body ?? ''
  const bodyMerge = merge3(baseBody, mine.body ?? '', theirs.body ?? '')
  const meta = mergeMeta(base?.meta ?? {}, mine.meta ?? {}, theirs.meta ?? {})

  if (bodyMerge.clean) {
    return { value: { meta, body: bodyMerge.text }, conflict: false }
  }
  // Genuine body conflict: LWW lands MINE's body; the caller records the
  // descriptor.
  return { value: { meta, body: mine.body }, conflict: true }
}

// makeMergeNote(onConflict) → the SYNCHRONOUS merge(base, mine, theirs) → value
// that window.mobius.createUseDocument calls in 'lww' mode (its merge must return
// the merged value directly). It is mergeNoteDocs with the conflict surfaced via
// the `onConflict({ base, mine, theirs })` callback — the caller (an effect with
// the hasher) builds + persists the descriptor, keeping this merge sync. LWW:
// always returns a value; a conflict keeps MINE so the local edit is never lost.
export function makeMergeNote(onConflict) {
  return function mergeNote(base, mine, theirs) {
    const { value, conflict } = mergeNoteDocs(base, mine, theirs)
    if (conflict && typeof onConflict === 'function') {
      try { onConflict({ base, mine, theirs }) } catch (e) {}
    }
    return value
  }
}

// Build the immutable conflict descriptor for a note. Async because the three
// content hashes are computed with the injected `hashOf` (note.js contentHash).
// Returns null when the note id can't be derived (defensive).
export async function conflictDescriptorFor(base, mine, theirs, hashOf) {
  const noteId = docId(mine) ?? docId(theirs) ?? docId(base)
  if (noteId == null) return null
  const [baseHash, mineHash, serverHash] = await Promise.all([
    base ? hashOf(base.meta, base.body) : Promise.resolve(null),
    hashOf(mine.meta, mine.body),
    hashOf(theirs.meta, theirs.body),
  ])
  return buildConflictDescriptor({
    noteId, base, mine, server: theirs, hashes: { baseHash, mineHash, serverHash },
  })
}
