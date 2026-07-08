// Storage IO for Notes — the glue that touches window.mobius.storage for the
// non-note-document concerns: attachments (content-addressed blobs), the derived
// index cache, and conflict descriptors. The per-note documents themselves now
// live behind collection.js (each note is a JSON document at notes/<id>.json,
// written through the platform's useDocument-style serialized writer). Pure logic
// (parse/serialize/hash/index/merge) lives in the other src/lib/* modules so it
// stays unit-testable; this glue is browser-only.
//
// Canonical notes live at notes/<id>.json ({ meta, body }); body is the markdown
// string. Attachments are content-addressed blobs at attachments/<sha>.<ext>
// (immutable, dedup'd). index.json is a DERIVED cache (titles/snippets) — rebuilt
// from the notes, never authoritative.

import { buildIndex } from './index-cache.js'
import { attachmentPath, extFromType, referencedAttachments } from './attachments.js'
import { notePath } from './note-doc.js'
import { leaseAttachment, releaseAttachment, inflightAttachmentPaths } from './attachment-leases.js'

// Re-export so callers that already reach for attachments through the store can
// release a lease without a second import; the editor imports it directly from
// attachment-leases.js to avoid pulling the merge stack into its bundle.
export { releaseAttachment }

const S = () => window.mobius.storage

// Hash raw bytes for content-addressed attachments (crypto.subtle is available
// in the same-origin secure-context iframe). hash.js handles string hashing for
// note content; binary is hashed here to avoid a lossy string round-trip.
async function sha256Bytes(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function extFromName(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || '')
  return m ? m[1].toLowerCase() : null
}

// Enumerate notes/ and read each JSON document. Offline-capable (list + get both
// read through the runtime's cache). Skips anything without a valid id and any
// non-.json entry (a half-migrated dir may still hold a legacy .md the migration
// pass converts). The collection owns this for the app; this copy backs the
// attachment GC, which must read the AUTHORITATIVE on-disk note set.
export async function listNotes() {
  let entries
  try { entries = await S().list('notes') } catch { entries = [] }
  const out = []
  for (const e of entries || []) {
    if (e.type !== 'file' || !e.name.endsWith('.json')) continue
    let doc
    try { doc = await S().get(e.path) } catch { doc = null }
    if (doc && doc.meta && doc.meta.id) out.push({ meta: doc.meta, body: doc.body ?? '' })
  }
  return out
}

export async function loadNote(id) {
  let doc
  try { doc = await S().get(notePath(id)) } catch { return null }
  return doc && doc.meta && doc.meta.id ? { meta: doc.meta, body: doc.body ?? '' } : null
}

// Rewrite the derived index from the current in-memory notes. A cache for fast
// cold-load + the dreaming agent; discard-and-rebuild if ever stale.
export async function writeIndex(notes) {
  return S().set('index.json', buildIndex(notes))
}

export async function readIndex() {
  try { return await S().get('index.json') } catch { return null }
}

// Persist a conflict descriptor (a JSON object) at its
// conflicts/<id>/<hashes>.json path so the in-app "Resolve now" agent can find
// it. This descriptor is the SOLE surviving copy of
// the losing side's body in a real two-device conflict (the note file keeps only
// MINE's body), so its write must be durable-or-loud: durableWrite resolves
// 'synced'|'queued' (queued offline is durable success, drains on reconnect) and
// REJECTS DurableWriteError on a fatal dead-letter. The legacy set() would LIE —
// report success while persisting nothing on a 4xx — silently destroying the
// server side; the caller relies on this rejection to keep the note flagged and
// surface a visible error instead.
export async function writeConflict(path, descriptor) {
  return S().durableWrite(path, descriptor, { kind: 'json' })
}

// Store a File/Blob as a content-addressed attachment; returns
// {sha, ext, path, name}. Same bytes -> same sha -> same path (dedupe). The
// 25 MiB cap is enforced by setBlob (throws); callers surface an in-app message.
// The returned path is LEASED as in-flight (GC-pinned) from before the blob hits
// disk; the caller MUST releaseAttachment(path) once a note durably references it
// (or the blob is otherwise abandoned), or the pin persists until reload.
export async function putAttachment(file) {
  const buf = await file.arrayBuffer()
  const sha = await sha256Bytes(buf)
  const ext = extFromType(file.type) || extFromName(file.name) || 'bin'
  const path = attachmentPath(sha, ext)
  // Lease BEFORE the write: if setBlob makes the blob visible to list() before its
  // promise settles, a concurrent GC must already see this path as referenced.
  leaseAttachment(path)
  try {
    await S().setBlob(path, file, { contentType: file.type || 'application/octet-stream' })
  } catch (err) {
    // The blob never landed — drop the lease so we don't pin a nonexistent path.
    releaseAttachment(path)
    throw err
  }
  return { sha, ext, path, name: file.name || `${sha}.${ext}` }
}

// Garbage-collect orphaned attachment blobs: build the referenced set from the
// AUTHORITATIVE on-disk notes, then remove any blob in attachments/ that nothing
// still references. Content-addressed blobs are shared, so a blob survives while
// ANY note keeps it. Runs after a delete or an editor save, so deleting a note —
// or editing an image/file ref out of a body — eventually frees its now-
// unreachable blobs. Best-effort: a failed list/remove is swallowed (the blob
// persists until the next sweep).
//
// Unlike the pre-migration version, there is no separate "pending working copy"
// union to add: the runtime's read-your-writes means listNotes() already sees an
// in-flight edit's attachment ref (the queued write overlays the canonical read),
// so the authoritative note set is the complete referenced set.
// `pin` is an extra set/array of attachment paths to treat as referenced even if
// no on-disk note record names them yet — the OPEN editor's live body refs. A GC
// can fire (the 1.5s debounce) before a just-attached image's note write has
// settled to the canonical file; listNotes() then misses that fresh ref and would
// free the blob the editor is actively showing (a momentary stale revision could
// also transiently drop a ref). Pinning the open body's refs closes that window —
// belt-and-suspenders over the merge-based fix in the editor, so a transient stale
// write can never orphan an in-use blob.
export async function gcAttachments(pin = []) {
  let entries
  try { entries = await S().list('attachments') } catch { return }
  const live = entries && entries.length ? entries.filter((e) => e.type === 'file' && e.path.startsWith('attachments/')) : []
  if (!live.length) return
  const notes = await listNotes().catch(() => null)
  if (notes == null) return // couldn't read the authoritative set — skip; never free blindly
  const referenced = referencedAttachments(notes)
  for (const p of pin) if (typeof p === 'string') referenced.add(p)
  // Pin every in-flight attachment: its blob exists but no note references it YET
  // (the note write is still in flight). Freeing it here is the multi-image race.
  for (const p of inflightAttachmentPaths()) referenced.add(p)
  for (const e of live) {
    if (referenced.has(e.path)) continue
    try { await S().remove(e.path) } catch {}
  }
}

// Resolve an attachment path to an object URL for <img>/download. The caller
// OWNS the URL lifetime — revoke it on unmount / next render.
export async function attachmentURL(path) {
  let blob
  try { blob = await S().getBlob(path) } catch { return null }
  return blob ? URL.createObjectURL(blob) : null
}

export const pendingCount = () => S().pendingCount()
export const isOnline = () => (window.mobius ? window.mobius.online : true)
