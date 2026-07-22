// Per-note document collection over window.mobius.storage — the storage glue
// that replaces the old shadow-outbox + seq-CAS promote (local.js) and the
// reconcile driver (reconciler.js + sync.js). Each note is a JSON document at
// notes/<id>.json; this module serializes last-write-wins updates per path for
// the unbounded, dynamic set of notes that cannot each own a React hook.
//
// Durability comes from the runtime now: storage.durableWrite resolves with
// durability 'synced' | 'queued' (queued = durably enqueued in the offline
// outbox, NOT lost) or rejects DurableWriteError on a dead-lettered write. There
// is no app-side outbox, no base/working pair, no seq, no promote, no reconcile
// pass — the runtime's per-path serialized writer is the single canonical-write
// path, and a queued offline write drains itself on reconnect.
//
// `bases` retains the last value seen for each note as an offline/error fallback
// for updater callbacks. It is bookkeeping only; it is not a merge ancestor.

import { notePath, legacyPath } from './note-doc.js'

const S = () => window.mobius.storage
const READ_BATCH_SIZE = 8

// Note documents are independent reads. Small batches remove the serial
// waterfall without creating an unbounded request/memory spike for users with
// very large notebooks or locally-modified runtimes.
async function readJsonDocuments(entries) {
  const files = (entries || []).filter((e) => e.type === 'file' && e.name.endsWith('.json'))
  const records = []
  for (let i = 0; i < files.length; i += READ_BATCH_SIZE) {
    const batch = files.slice(i, i + READ_BATCH_SIZE)
    const resolved = await Promise.all(batch.map(async (entry) => {
      try { return { path: entry.path, doc: await S().get(entry.path) } }
      catch { return { path: entry.path, doc: null } }
    }))
    records.push(...resolved)
  }
  return records
}

// Serialize all writes to one path behind a per-path promise chain — the same
// chainRef serialization useDocument.update() uses, so two overlapping saves of
// the same note never interleave their writes and lose an edit. The
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

async function writeJson(path, value) {
  const storage = S()
  if (typeof storage.durableWrite === 'function') {
    return storage.durableWrite(path, value, { kind: 'json' })
  }
  const result = await storage.set(path, value)
  return {
    durability: result?.queued ? 'queued' : 'synced',
    path,
    legacy: true,
  }
}

// The imperative note-document store. All methods are async; an update that the
// server refuses rejects with the runtime's DurableWriteError so the UI never
// reports a false save.
export function makeNoteCollection() {
  const withChain = makeChains()
  // bases[id] = the last document loaded or durably written in this session.
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
    for (const { path, doc } of await readJsonDocuments(entries)) {
      if (doc && doc.meta && doc.meta.id) {
        rememberPath(doc.meta.id, path)
        if (doc.meta.id === id) found.push(path)
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
    for (const { path, doc } of await readJsonDocuments(entries)) {
      if (doc && doc.meta && doc.meta.id) {
        bases.set(doc.meta.id, doc)
        rememberPath(doc.meta.id, path)
        out.push({ meta: doc.meta, body: doc.body ?? '', storagePath: path })
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

  // A last-write-wins update serialized per note. `fn(prev)` receives the newest
  // readable value (including the runtime's queued-write overlay), falling back
  // to the last value this session saw when a read is temporarily unavailable.
  // The produced document is written verbatim; no second merge layer or conflict
  // state machine sits on top of the platform. Returns the durableWrite result
  // ({ durability: 'synced'|'queued', ... }); rejects DurableWriteError when the
  // server dead-letters the write (the UI surfaces it; the edit is NOT marked
  // saved).
  function update(id, fn) {
    const path = primaryPath(id)
    return withChain(path, async () => {
      const remembered = bases.get(id) ?? null
      let current = remembered
      try { current = (await S().get(path)) ?? remembered } catch {}
      const mine = fn(current ? { meta: current.meta, body: current.body } : null)
      // durableWrite resolves DURABLE (synced/queued) or REJECTS DurableWriteError
      // on a dead-letter; we let the rejection propagate so the caller surfaces it
      // (no false "saved"). The remembered value advances only after durability.
      const result = await writeJson(path, mine)
      bases.set(id, mine)
      rememberPath(id, path)
      return { result, value: mine }
    })
  }

  // Delete a note: remove the canonical document. The runtime queues the delete
  // offline (read-your-writes hides it immediately) and drains it on reconnect.
  // Drop the local base so a re-created note with the same id starts fresh.
  function remove(id) {
    return withChain(`remove:${id}`, async () => {
      const remembered = knownPaths(id)
      const candidates = new Set([notePath(id), ...remembered])
      // Normal notes are known from list()/load() and live at notes/<id>.json, so
      // delete is O(1). Only scan as a compatibility fallback for the rare legacy
      // corruption where a document filename and meta.id diverged and this session
      // has not listed/loaded that path yet.
      if (remembered.length === 0) {
        for (const p of await findPathsForId(id)) candidates.add(p)
      }
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

  return { list, load, update, remove, notePath }
}
