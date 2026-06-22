// Per-note document collection over window.mobius.storage — the storage glue
// that replaces the old shadow-outbox + seq-CAS promote (local.js) and the
// reconcile driver (reconciler.js + sync.js). Each note is a JSON document at
// notes/<id>.json; this module gives every note the EXACT `useDocument.update()`
// last-write-wins algorithm (read-merge-write, serialized per path), driven
// imperatively so an unbounded, dynamic note set works without breaking React's
// rules of hooks. The merge is `mergeNote` (note-doc.js → merge3 + mergeMeta),
// so concurrent same-note edits 3-way-merge and a real conflict still emits the
// descriptor — identical conflict semantics to the retired reconciler.
//
// Durability comes from the runtime now: storage.durableWrite resolves with
// durability 'synced' | 'queued' (queued = durably enqueued in the offline
// outbox, NOT lost) or rejects DurableWriteError on a dead-lettered write. There
// is no app-side outbox, no base/working pair, no seq, no promote, no reconcile
// pass — the runtime's per-path serialized writer is the single canonical-write
// path, and a queued offline write drains itself on reconnect.
//
// `base` tracking: update() merges base (our last-confirmed value) with mine
// (the new edit) and theirs (whatever the server holds now), mirroring the
// hook's baseRef. We seed base from the value loaded at first sight of a note.

import { notePath, docId, mergeNoteDocs, conflictDescriptorFor } from './note-doc.js'
import { contentHash } from './note.js'

const S = () => window.mobius.storage

// Serialize all writes to one path behind a per-path promise chain — the same
// chainRef serialization useDocument.update() uses, so two overlapping saves of
// the same note never interleave their read-merge-write and lose an edit. The
// chain link is stored already-settled so one failed write can't reject the
// next; the map entry is dropped once its tail drains so it can't grow
// unbounded.
function makeChains() {
  const chains = new Map()
  return function withChain(key, fn) {
    const prev = chains.get(key) || Promise.resolve()
    const result = prev.then(fn, fn)
    const tail = result.then(() => {}, () => {})
    chains.set(key, tail)
    tail.then(() => { if (chains.get(key) === tail) chains.delete(key) })
    return result
  }
}

// makeNoteCollection({ onConflict }) → the imperative note-document store.
// `onConflict(descriptor)` is invoked when a merge produces a genuine body
// conflict; the caller persists the descriptor (store.writeConflict) and flags
// the editor. All methods are async and never throw on a durable result; an
// update() that the server REFUSES rejects with the runtime's DurableWriteError
// so the UI can surface doc.lastError (no silent loss, no false save).
export function makeNoteCollection({ onConflict } = {}) {
  const withChain = makeChains()
  // base[id] = our last-confirmed document for that note (the 3-way ancestor).
  const bases = new Map()

  // Enumerate notes/ and parse each JSON document. Offline-capable (list + get
  // both read through the runtime's cache). Skips anything without a valid id.
  async function list() {
    let entries
    try { entries = await S().list('notes') } catch { entries = [] }
    const out = []
    for (const e of entries || []) {
      if (e.type !== 'file' || !e.name.endsWith('.json')) continue
      let doc
      try { doc = await S().get(e.path) } catch { doc = null }
      if (doc && doc.meta && doc.meta.id) {
        bases.set(doc.meta.id, doc)
        out.push({ meta: doc.meta, body: doc.body ?? '' })
      }
    }
    return out
  }

  async function load(id) {
    let doc
    try { doc = await S().get(notePath(id)) } catch { return null }
    if (!doc || !doc.meta || !doc.meta.id) return null
    bases.set(id, doc)
    return { meta: doc.meta, body: doc.body ?? '' }
  }

  // Seed the merge ancestor on first sight of a note loaded from canonical, when
  // this session has no base yet. An existing base always wins (it is the
  // last-confirmed value the next merge must reconcile against).
  function ensureBase(id, doc) {
    if (!bases.has(id)) bases.set(id, doc)
  }

  // The read-merge-write, per note, serialized by path. `fn(prev)` produces the
  // new document from the current value (read-your-writes via the runtime). We
  // pass base = our last-confirmed doc, mine = fn(prev), theirs = the server's
  // current value, into mergeNote, then durableWrite the result. On success base
  // advances to the written value. Returns the durableWrite result
  // ({ durability: 'synced'|'queued', ... }); rejects DurableWriteError when the
  // server dead-letters the write (the UI surfaces it; the edit is NOT marked
  // saved).
  function update(id, fn) {
    const path = notePath(id)
    return withChain(path, async () => {
      const base = bases.get(id) ?? null
      const mine = fn(base ? { meta: base.meta, body: base.body } : null)
      let theirs = base
      try { theirs = (await S().get(path)) ?? base } catch (e) {}
      const { value: merged, conflict } = mergeNoteDocs(base, mine, theirs)
      // durableWrite resolves DURABLE (synced/queued) or REJECTS DurableWriteError
      // on a dead-letter; we let the rejection propagate so the caller surfaces it
      // (no false "saved"). `base` only advances on a durable write — so a refused
      // write leaves the ancestor intact for the next attempt.
      const result = await S().durableWrite(path, merged, { kind: 'json' })
      bases.set(id, merged)
      // Record the conflict descriptor AFTER the durable write landed, so the
      // editor's "merging…" bar reflects a real on-disk divergence. Awaited (not
      // fire-and-forget) so it's deterministic.
      if (conflict && typeof onConflict === 'function') {
        try {
          const descriptor = await conflictDescriptorFor(base, mine, theirs, contentHash)
          if (descriptor) onConflict(descriptor)
        } catch (e) {}
      }
      return { result, value: merged }
    })
  }

  // Delete a note: remove the canonical document. The runtime queues the delete
  // offline (read-your-writes hides it immediately) and drains it on reconnect.
  // Drop the local base so a re-created note with the same id starts fresh.
  function remove(id) {
    const path = notePath(id)
    return withChain(path, async () => {
      const res = await S().remove(path)
      bases.delete(id)
      return res
    })
  }

  return { list, load, update, remove, ensureBase, notePath, docId }
}
