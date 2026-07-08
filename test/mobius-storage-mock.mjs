// An in-memory window.mobius.storage that faithfully models the platform
// runtime contract the Notes app depends on (frontend/public/mobius-runtime.js):
//
//   - get(path)/getText(path) -> the stored value (JSON object / string) or null.
//     READ-YOUR-WRITES: a local overlay (a queued offline write) shadows the
//     server value, so an offline write is visible to a later get() even though
//     the server doesn't have it yet.
//   - set(path,obj)/setText(path,str) -> { synced:true } online, { queued:true }
//     offline (both DURABLE). This is the LEGACY path: on a path FORCED to a fatal
//     4xx it still returns { synced:true } (it LIES) but the server is left
//     unchanged and the optimistic value is rolled back — exactly the runtime
//     behavior that makes set() unsafe for a write whose success must gate a
//     destructive follow-up (deleting the legacy .md).
//   - setBlob(path,blob) -> same durability result; throws over the size cap
//   - durableWrite(path,val,{kind}) -> { durability:'synced' } when the write
//     reaches the server (online), { durability:'queued' } when durably outboxed
//     offline (a LOCAL overlay, NOT yet on the server, guaranteed retry), or
//     REJECTS DurableWriteError({code}) when the path is FORCED to dead-letter (a
//     fatal 4xx the server refuses — nothing is persisted).
//   - remove(path) -> { synced } | { queued }; read-your-writes hides it at once
//   - list(prefix) -> [{ name, path, type }] of the immediate children
//   - onDeadLetter(cb) -> fires when an offline-QUEUED write is later refused on
//     drain (drain() below moves overlays to the server, or dead-letters a forced
//     path and drops its overlay)
//   - subscribe / pendingCount / online flag
//
// Tests drive online/offline + per-path forced outcomes to exercise the queued =
// durable-success and dead-letter = error (no false save) paths the migration
// must honor. This mirrors the runtime's observable behavior without pulling in
// IndexedDB; the real runtime is unit-tested separately in the platform repo.
//
// STATE MODEL: `server` is the canonical (server-confirmed) store; `overlay` is
// the local read-your-writes layer (queued offline writes + their tombstones).
// get() reads overlay-then-server, so a queued write is visible locally but is
// NOT on the server until a drain() promotes it. `raw` is an alias of `server`,
// so existing tests that assert "durably on the server" via h.raw stay correct.

export class DurableWriteError extends Error {
  constructor(message, fields = {}) {
    super(message)
    this.name = 'DurableWriteError'
    this.code = fields.code || 'dead_letter'
    this.status = fields.status
    this.path = fields.path
    this.refusedValue = fields.refusedValue
    this.retryable = fields.retryable === true
  }
}

const TOMBSTONE = Symbol('overlay-tombstone')

export function makeMockStorage() {
  const server = new Map()  // path -> { kind, value } : server-confirmed canonical
  const overlay = new Map() // path -> { kind, value } | TOMBSTONE : queued offline layer
  let online = true
  const forced = new Map()  // path -> { status } : forces a fatal 4xx on the next write
  const subs = new Map()
  let queued = 0
  const deadLetterCbs = new Set()

  // Read-your-writes: the overlay (a queued offline write or delete) shadows the
  // server value until a drain promotes/clears it.
  function effective(path) {
    if (overlay.has(path)) {
      const o = overlay.get(path)
      return o === TOMBSTONE ? null : o
    }
    return server.get(path) ?? null
  }

  function notify(path) {
    const set = subs.get(path)
    if (!set) return
    const rec = effective(path)
    const v = rec ? rec.value : null
    for (const cb of set) { try { cb(v) } catch {} }
  }

  // The legacy set() path. Online + NOT forced: writes to the server, returns
  // { synced:true }. Online + FORCED fatal: returns { synced:true } anyway (the
  // LIE) but leaves the server untouched and the optimistic value not effective —
  // any prior server value remains the truth. Offline: a durable overlay queue.
  function legacyWrite(path, rec) {
    const f = forced.get(path)
    if (f) {
      forced.delete(path)
      // The lie: report success, persist nothing. (No overlay either — the
      // optimistic value is rolled back on a fatal refusal.)
      return { synced: true }
    }
    if (online) { server.set(path, rec); overlay.delete(path); notify(path); return { synced: true } }
    overlay.set(path, rec); queued++; notify(path); return { queued: true }
  }

  const storage = {
    // ── reads (read-your-writes: overlay shadows server) ──────────────────
    async get(path) {
      const rec = effective(path)
      if (!rec || rec.value == null) return null
      return JSON.parse(JSON.stringify(rec.value))
    },
    async getText(path) {
      const rec = effective(path)
      if (!rec || rec.value == null) return null
      return String(rec.value)
    },
    async getBlob(path) {
      const rec = effective(path)
      return rec ? rec.value : null
    },
    // ── durable write (the useDocument path) ──────────────────────────────
    async durableWrite(path, value, opts = {}) {
      const f = forced.get(path)
      if (f) {
        // Fatal 4xx: the server refuses. Nothing is persisted (server + overlay
        // untouched); we REJECT so the caller never treats it as saved. (This is
        // the synchronous refusal — onDeadLetter is for the OFFLINE-queued write
        // that is refused later on drain(); see drain().)
        forced.delete(path)
        throw new DurableWriteError(`durableWrite ${path} rejected (${f.status})`, {
          code: f.status === 412 ? 'conflict' : 'dead_letter',
          status: f.status,
          path,
          refusedValue: value,
        })
      }
      const rec = { kind: opts.kind || 'json', value }
      if (online) {
        server.set(path, rec)
        overlay.delete(path)
        notify(path)
        return { durability: 'synced', path }
      }
      // Offline: durably outboxed as a local overlay; NOT on the server yet.
      overlay.set(path, rec)
      queued++
      notify(path)
      return { durability: 'queued', path }
    },
    // ── legacy writes (store.js set/setText/setBlob) ──────────────────────
    async set(path, obj) {
      return legacyWrite(path, { kind: 'json', value: obj })
    },
    async setText(path, text) {
      return legacyWrite(path, { kind: 'text', value: text })
    },
    async setBlob(path, blob) {
      // Blobs skip the lie modeling (no test forces a blob dead-letter); keep the
      // simple durable-result behavior.
      if (online) { server.set(path, { kind: 'blob', value: blob }); overlay.delete(path) }
      else { overlay.set(path, { kind: 'blob', value: blob }); queued++ }
      return online ? { synced: true } : { queued: true }
    },
    async remove(path) {
      const f = forced.get(path)
      if (f) {
        forced.delete(path)
        throw new DurableWriteError(`remove ${path} rejected (${f.status})`, {
          code: f.status === 412 ? 'conflict' : 'dead_letter',
          status: f.status,
          path,
        })
      }
      if (online) { server.delete(path); overlay.delete(path) }
      else { overlay.set(path, TOMBSTONE); queued++ }
      notify(path)
      return online ? { synced: true } : { queued: true }
    },
    // ── listing (over the effective view: server ∪ overlay, minus tombstones)
    async list(prefix) {
      const norm = (prefix || '').replace(/^\/+|\/+$/g, '')
      const base = norm ? norm + '/' : ''
      const paths = new Set([...server.keys(), ...overlay.keys()])
      const byName = new Map()
      for (const path of paths) {
        if (overlay.get(path) === TOMBSTONE) continue // deleted locally
        if (!path.startsWith(base)) continue
        const rest = path.slice(base.length)
        const slash = rest.indexOf('/')
        if (slash === -1) {
          byName.set(rest, { name: rest, path, type: 'file' })
        } else {
          const d = rest.slice(0, slash)
          if (!byName.has(d)) byName.set(d, { name: d, path: base + d, type: 'directory' })
        }
      }
      return [...byName.values()].sort((a, b) => (a.name < b.name ? -1 : 1))
    },
    subscribe(path, cb) {
      let set = subs.get(path)
      if (!set) { set = new Set(); subs.set(path, set) }
      set.add(cb)
      Promise.resolve().then(() => { const rec = effective(path); cb(rec ? rec.value : null) })
      return () => { const s = subs.get(path); if (s) s.delete(cb) }
    },
    onDeadLetter(cb) { deadLetterCbs.add(cb); return () => deadLetterCbs.delete(cb) },
    async pendingCount() { return queued },
    DurableWriteError,
  }

  return {
    storage,
    setOnline(v) { online = !!v },
    // Force the NEXT write to `path` (set or durableWrite) to a fatal 4xx.
    forceDeadLetter(path, status = 413) { forced.set(path, { status }) },
    // Seed the SERVER canonical store directly (a pre-existing, server-confirmed
    // value). Tests that want a local-only overlay seed via seedOverlay/offline.
    seed(path, value, kind = 'json') { server.set(path, { kind, value }) },
    // Seed a LOCAL overlay (a queued offline write not on the server).
    seedOverlay(path, value, kind = 'json') { overlay.set(path, { kind, value }) },
    // Drain the offline outbox: promote each queued overlay to the server, EXCEPT
    // a path forced to dead-letter — that overlay is dropped and onDeadLetter
    // fires (the queued-then-refused-on-drain case).
    async drain() {
      online = true
      for (const [path, rec] of [...overlay.entries()]) {
        const f = forced.get(path)
        if (f) {
          forced.delete(path)
          overlay.delete(path)
          const rejected = { path, status: f.status, refusedValue: rec === TOMBSTONE ? undefined : rec.value }
          for (const cb of deadLetterCbs) { try { cb(rejected) } catch {} }
          continue
        }
        if (rec === TOMBSTONE) server.delete(path)
        else server.set(path, rec)
        overlay.delete(path)
        notify(path)
      }
      queued = 0
    },
    // Accessors: `server` is the canonical store; `raw` aliases it so existing
    // "durably on the server" assertions keep working. `overlay` exposes the
    // local read-your-writes layer for tests that need to tell them apart.
    get server() { return server },
    get overlay() { return overlay },
    raw: server,
    TOMBSTONE,
  }
}

// Install a window.mobius with this storage (+ a no-op signal) for app/store
// tests that read window.mobius.storage / window.mobius.online.
export function installMobius(opts = {}) {
  const harness = makeMockStorage()
  if (typeof globalThis.window === 'undefined') globalThis.window = {}
  globalThis.window.mobius = {
    storage: harness.storage,
    online: opts.online !== false,
    signal() {},
    DurableWriteError,
  }
  return harness
}
