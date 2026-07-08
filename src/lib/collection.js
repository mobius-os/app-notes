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

import { notePath, legacyPath, docId, mergeNoteDocs } from './note-doc.js'

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
// `onConflict({ base, mine, theirs })` is invoked when a merge produces a genuine
// overlapping-body conflict — the SAME sides shape makeMergeNote (the open-editor
// liveDoc path) passes, so both writers drive one handler. The handler (app.jsx)
// owns building + DURABLY persisting the descriptor and flagging the editor;
// keeping the build there (not here) means there is exactly one descriptor
// builder and one shape, so the handler never receives an already-built
// descriptor it would mis-handle. All methods are async and never throw on a
// durable result; an update() that the server REFUSES rejects with the runtime's
// DurableWriteError so the UI can surface doc.lastError (no silent loss, no false
// save).
export function makeNoteCollection({ onConflict } = {}) {
  const withChain = makeChains()
  // base[id] = our last-confirmed document for that note (the 3-way ancestor).
  const bases = new Map()
  // paths[id] = every JSON document path that has presented this meta.id. This
  // deliberately tolerates historical corruption where notes/<file-id>.json and
  // doc.meta.id diverged: deletes and later writes must target the actual file,
  // not only notes/<meta.id>.json, or the broken note resurrects on every list().
  const paths = new Map()

  function rememberPath(id, path) {
    if (!id || !path) return
    let set = paths.get(id)
    if (!set) { set = new Set(); paths.set(id, set) }
    set.add(path)
  }

  function knownPaths(id) {
    return paths.get(id) ? [...paths.get(id)] : []
  }

  function primaryPath(id) {
    return knownPaths(id)[0] || notePath(id)
  }

  function jsonIdFromPath(path) {
    const name = String(path || '').split('/').pop() || ''
    return name.endsWith('.json') ? name.slice(0, -5) : null
  }

  async function findPathsForId(id) {
    let entries
    try { entries = await S().list('notes') } catch { return [] }
    const found = []
    for (const e of entries || []) {
      if (e.type !== 'file' || !e.name.endsWith('.json')) continue
      let doc
      try { doc = await S().get(e.path) } catch { doc = null }
      if (doc && doc.meta && doc.meta.id) {
        rememberPath(doc.meta.id, e.path)
        if (doc.meta.id === id) found.push(e.path)
      }
    }
    return found
  }

  // Enumerate notes/ and parse each JSON document. `storage.list()` has NO offline
  // mirror (unlike get()): it returns `null` on a network failure and throws on a
  // hard error, and `[]` ONLY for a genuinely-empty successful enumeration. We must
  // preserve that distinction — collapsing "enumeration unavailable" to `[]` is what
  // let an offline cold-load wipe the cached grid to "No notes yet". So: return
  // `null` when enumeration is unavailable (offline / error) and `[]` only for a
  // confirmed-empty list. Callers keep the cached placeholders on `null`.
  async function list() {
    let entries
    try { entries = await S().list('notes') } catch { return null }
    if (entries == null) return null
    const out = []
    for (const e of entries) {
      if (e.type !== 'file' || !e.name.endsWith('.json')) continue
      let doc
      try { doc = await S().get(e.path) } catch { doc = null }
      if (doc && doc.meta && doc.meta.id) {
        bases.set(doc.meta.id, doc)
        rememberPath(doc.meta.id, e.path)
        out.push({ meta: doc.meta, body: doc.body ?? '', storagePath: e.path })
      }
    }
    return out
  }

  async function load(id) {
    let doc = null
    let path = notePath(id)
    try { doc = await S().get(path) } catch { doc = null }
    if (!doc || !doc.meta || doc.meta.id !== id) {
      const found = await findPathsForId(id)
      path = found[0] || path
      try { doc = found[0] ? await S().get(path) : null } catch { doc = null }
    }
    if (!doc || !doc.meta || doc.meta.id !== id) return null
    bases.set(id, doc)
    rememberPath(id, path)
    return { meta: doc.meta, body: doc.body ?? '', storagePath: path }
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
    const path = primaryPath(id)
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
      rememberPath(id, path)
      // Surface a genuine conflict AFTER the durable note write landed, so the
      // editor's "merging…" bar reflects a real on-disk divergence. We forward the
      // raw sides ({ base, mine, theirs }) — the SAME shape makeMergeNote passes —
      // so the handler is the single place that builds + durably persists the
      // descriptor (the descriptor is the sole surviving copy of THEIRS's body, so
      // its write must be durable-or-loud, which the handler owns). Awaiting the
      // handler keeps the descriptor's persistence deterministic for this path.
      if (conflict && typeof onConflict === 'function') {
        try { await onConflict({ base, mine, theirs }) } catch (e) {}
      }
      return { result, value: merged }
    })
  }

  // Delete a note: remove the canonical document. The runtime queues the delete
  // offline (read-your-writes hides it immediately) and drains it on reconnect.
  // Drop the local base so a re-created note with the same id starts fresh.
  function remove(id) {
    return withChain(`remove:${id}`, async () => {
      const candidates = new Set([notePath(id), ...knownPaths(id)])
      for (const p of await findPathsForId(id)) candidates.add(p)
      let res = null
      let firstError = null
      for (const path of candidates) {
        try { res = await S().remove(path) } catch (err) { if (!firstError) firstError = err }
      }
      if (firstError) throw firstError
      // Also drop the dormant legacy .md, if any: the startup migration would
      // otherwise re-create (resurrect) this just-deleted note from it.
      try { await S().remove(legacyPath(id)) } catch {}
      for (const path of candidates) {
        const fileId = jsonIdFromPath(path)
        if (fileId && fileId !== id) {
          try { await S().remove(legacyPath(fileId)) } catch {}
        }
      }
      bases.delete(id)
      paths.delete(id)
      return res
    })
  }

  return { list, load, update, remove, ensureBase, notePath, docId }
}
