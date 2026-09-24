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

async function writeJson(path, value, { version, conditional = false } = {}) {
  const storage = S()
  if (typeof storage.durableWrite === 'function') {
    return storage.durableWrite(path, value, {
      kind: 'json',
      ...(conditional ? (version ? { ifMatch: version } : { ifNoneMatch: true }) : {}),
    })
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
  const recoveriesInFlight = new Map()
  // bases[id] = the last document loaded or durably written in this session.
  const bases = new Map()
  // paths[id] = every JSON document path that has presented this meta.id. This
  // deliberately tolerates historical corruption where notes/<file-id>.json and
  // doc.meta.id diverged: deletes and later writes must target the actual file,
  // not only notes/<meta.id>.json, or the broken note resurrects on every list().
  const paths = new Map()

  // A same-note edit made on two offline devices cannot be merged safely at
  // character level without a CRDT. Use conditional writes and preserve the
  // refused full document as a normal recovery note instead of silently losing
  // either version. The platform only reports the transport conflict; this
  // note-specific recovery policy remains app-owned.
  const supportsConflictRecovery = typeof S().onConflict === 'function'
  function stableRecoveryId(writeId) {
    const input = String(writeId || 'unknown')
    let hash = 0xcbf29ce484222325n
    for (let i = 0; i < input.length; i += 1) {
      hash ^= BigInt(input.charCodeAt(i))
      hash = BigInt.asUintN(64, hash * 0x100000001b3n)
    }
    const readable = input.replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48)
    return `recovered-${readable || 'edit'}-${hash.toString(16).padStart(16, '0')}`
  }

  async function existingRecovery(path, writeId) {
    if (typeof S().get !== 'function') return false
    try {
      const existing = await S().get(path)
      return existing?.meta?.recoveredConflictWriteId === writeId
    } catch { return false }
  }

  const detachConflict = supportsConflictRecovery
    ? S().onConflict((conflict) => {
        const mine = conflict?.refusedValue
        if (!/^notes\/[^/]+\.json$/.test(String(conflict?.path || ''))
            || !mine?.meta?.id || !conflict?.writeId) return false
        const key = String(conflict.writeId)
        if (recoveriesInFlight.has(key)) return recoveriesInFlight.get(key)
        const task = (async () => {
          // A second frame may race the same create-only recovery. Its 412 is
          // an idempotency confirmation, not a new edit that needs another copy.
          if (conflict.ifNoneMatch === true && mine.meta.recoveredConflictWriteId) {
            return existingRecovery(conflict.path, mine.meta.recoveredConflictWriteId)
          }
          const recoveredId = stableRecoveryId(key)
          const recoveryPath = notePath(recoveredId)
          if (await existingRecovery(recoveryPath, key)) return true
          const recoveredAt = new Date().toISOString()
          const recovered = {
            ...mine,
            meta: {
              ...mine.meta,
              id: recoveredId,
              title: `${mine.meta.title || 'Untitled'} — recovered offline edit`,
              updated: recoveredAt,
              recoveredFromConflict: mine.meta.id,
              recoveredConflictWriteId: key,
            },
          }
          try {
            await S().durableWrite(recoveryPath, recovered, {
              kind: 'json', ifNoneMatch: true,
            })
            return true
          } catch (error) {
            if (await existingRecovery(recoveryPath, key)) return true
            window.mobius?.signal?.('error', {
              source: 'offline-conflict-recovery',
              message: String(error?.message || error),
            })
            return false
          }
        })()
        recoveriesInFlight.set(key, task)
        task.finally(() => { if (recoveriesInFlight.get(key) === task) recoveriesInFlight.delete(key) })
        return task
      })
    : () => {}

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

  // Enumerate notes/ only from a complete server/last-known snapshot. A cold
  // device may have cached one opened note without ever seeing its siblings;
  // replacing index.json from that partial set would silently hide the rest.
  // `null` means "use the derived index until a complete enumeration exists".
  async function list() {
    let listing
    try {
      listing = typeof S().listWithStatus === 'function'
        ? await S().listWithStatus('notes')
        : { entries: await S().list('notes'), complete: window.mobius?.online !== false }
    } catch { return null }
    if (!listing || listing.complete !== true) return null
    const entries = listing.entries || []
    const documents = await readJsonDocuments(entries)
    // Directory completeness only proves membership. If even one listed body
    // is unavailable, replacing the grid (and its derived index) from the
    // readable subset would silently hide a real note. Keep the prior/index
    // view until every listed body can be assembled.
    if (documents.some(({ doc }) => doc === null)) return null
    const out = []
    for (const { path, doc } of documents) {
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
      let version
      let conditional = false
      try {
        if (typeof S().getWithVersion === 'function') {
          const loaded = await S().getWithVersion(path)
          current = loaded.value ?? remembered
          version = loaded.version
          // An older runtime can perform CAS but cannot report a delayed
          // reconnect conflict back to the app. Use conditional writes only
          // when the matching recovery event exists; otherwise preserve the
          // former explicit LWW compatibility behavior rather than losing an
          // offline edit silently during a rolling platform update.
          conditional = supportsConflictRecovery
        } else {
          current = (await S().get(path)) ?? remembered
        }
      } catch {}
      const mine = fn(current ? { meta: current.meta, body: current.body } : null)
      // durableWrite resolves DURABLE (synced/queued) or REJECTS DurableWriteError
      // on a dead-letter; we let the rejection propagate so the caller surfaces it
      // (no false "saved"). The remembered value advances only after durability.
      const result = await writeJson(path, mine, { version, conditional })
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

  return { list, load, update, remove, notePath, destroy: detachConflict }
}
