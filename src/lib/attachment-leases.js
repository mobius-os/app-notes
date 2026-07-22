// In-flight attachment leases — a tiny, dependency-free registry shared by the
// store (which acquires a lease before a blob hits disk and treats every leased
// path as GC-referenced) and the editor (which releases a lease once a note
// durably references the path). It lives in its OWN module — not store.js — so
// the editor can release a lease without importing the rest of the storage layer,
// keeping the dependency graph small and the editor independently testable.
//
// WHY this exists: putAttachment writes the blob, but the NOTE that references it
// is written by a SEPARATE, later await (the editor's onSave → writeNote upsert).
// In the window between the two the blob is real yet UNREFERENCED by any note —
// listNotes() can't see it and the open-editor body pin can't either. A debounced
// GC firing then would delete the brand-new blob (the multi-image broken-link
// race). Leasing the path from before the blob hits disk until a note durably
// references it closes that window. The counter handles content-addressed dedupe
// (the same sha leased more than once) and the "release only when the LAST holder
// is done" invariant. Module-scoped, so it clears on reload — a backstop against
// a permanently-leaked pin if a caller forgets to release (e.g. a save that never
// lands), without ever risking the race in the normal path.

const inflight = new Map() // path -> outstanding lease count

export function leaseAttachment(path) {
  inflight.set(path, (inflight.get(path) || 0) + 1)
}

// Release one lease on `path`. Safe to over-release (clamps at 0). Call this ONLY
// after a note durably references the path, or after the blob write FAILED so the
// blob doesn't exist. Never release merely because onSave was called — a rejected
// save still shows the image in the editor, so the blob must stay pinned until a
// real save lands.
export function releaseAttachment(path) {
  const n = inflight.get(path)
  if (!n) return
  if (n <= 1) inflight.delete(path)
  else inflight.set(path, n - 1)
}

// The set of paths currently leased (GC must treat these as referenced).
export function inflightAttachmentPaths() {
  return inflight.keys()
}
