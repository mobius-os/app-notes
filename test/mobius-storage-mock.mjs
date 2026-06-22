// An in-memory window.mobius.storage that faithfully models the platform
// runtime contract the Notes app depends on (frontend/public/mobius-runtime.js):
//
//   - get(path)/getText(path) -> the stored value (JSON object / string) or null
//   - set(path,obj)/setText(path,str) -> { synced:true } online, { queued:true }
//     offline (both DURABLE)
//   - setBlob(path,blob) -> same durability result; throws over the size cap
//   - durableWrite(path,val,{kind}) -> { durability:'synced'|'queued', path } on
//     a durable write; REJECTS DurableWriteError({code}) when the path is forced
//     to dead-letter (a 4xx the server refuses) or to conflict
//   - remove(path) -> { synced } | { queued }; read-your-writes hides it at once
//   - list(prefix) -> [{ name, path, type }] of the immediate children
//   - subscribe / pendingCount / online flag
//
// Tests drive online/offline + per-path forced outcomes to exercise the queued =
// durable-success and dead-letter = error (no false save) paths the migration
// must honor. This mirrors the runtime's observable behavior without pulling in
// IndexedDB; the real runtime is unit-tested separately in the platform repo.

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

export function makeMockStorage() {
  const files = new Map() // path -> { kind, value }
  let online = true
  const forced = new Map() // path -> { status } forces a dead-letter on write
  const subs = new Map()
  let queued = 0
  const deadLetterCbs = new Set()

  function notify(path) {
    const set = subs.get(path)
    if (!set) return
    const rec = files.get(path)
    const v = rec ? rec.value : null
    for (const cb of set) { try { cb(v) } catch {} }
  }

  function durableResult() {
    if (online) return { durability: 'synced' }
    queued++
    return { durability: 'queued' }
  }
  function legacyResult() {
    if (online) return { synced: true }
    queued++
    return { queued: true }
  }

  const storage = {
    // ── reads ────────────────────────────────────────────────────────────
    async get(path) {
      const rec = files.get(path)
      if (!rec) return null
      return rec.value == null ? null : JSON.parse(JSON.stringify(rec.value))
    },
    async getText(path) {
      const rec = files.get(path)
      if (!rec) return null
      return rec.value == null ? null : String(rec.value)
    },
    async getBlob(path) {
      const rec = files.get(path)
      return rec ? rec.value : null
    },
    // ── durable write (the useDocument path) ──────────────────────────────
    async durableWrite(path, value, opts = {}) {
      const f = forced.get(path)
      if (f) {
        forced.delete(path)
        const rejected = { path, status: f.status, refusedValue: value }
        for (const cb of deadLetterCbs) { try { cb(rejected) } catch {} }
        throw new DurableWriteError(`durableWrite ${path} rejected (${f.status})`, {
          code: f.status === 412 ? 'conflict' : 'dead_letter',
          status: f.status,
          path,
          refusedValue: value,
        })
      }
      files.set(path, { kind: opts.kind || 'json', value })
      const res = durableResult()
      notify(path)
      return { ...res, path }
    },
    // ── legacy writes (store.js set/setText/setBlob) ──────────────────────
    async set(path, obj) {
      files.set(path, { kind: 'json', value: obj })
      const r = legacyResult(); notify(path); return r
    },
    async setText(path, text) {
      files.set(path, { kind: 'text', value: text })
      const r = legacyResult(); notify(path); return r
    },
    async setBlob(path, blob) {
      files.set(path, { kind: 'blob', value: blob })
      return legacyResult()
    },
    async remove(path) {
      files.delete(path)
      const r = legacyResult(); notify(path); return r
    },
    // ── listing ───────────────────────────────────────────────────────────
    async list(prefix) {
      const norm = (prefix || '').replace(/^\/+|\/+$/g, '')
      const base = norm ? norm + '/' : ''
      const byName = new Map()
      for (const path of files.keys()) {
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
      Promise.resolve().then(() => { const rec = files.get(path); cb(rec ? rec.value : null) })
      return () => { const s = subs.get(path); if (s) s.delete(cb) }
    },
    onDeadLetter(cb) { deadLetterCbs.add(cb); return () => deadLetterCbs.delete(cb) },
    async pendingCount() { return queued },
    DurableWriteError,
  }

  return {
    storage,
    setOnline(v) { online = !!v },
    forceDeadLetter(path, status = 413) { forced.set(path, { status }) },
    seed(path, value, kind = 'json') { files.set(path, { kind, value }) },
    raw: files,
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
