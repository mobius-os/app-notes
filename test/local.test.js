import { test } from 'node:test'
import assert from 'node:assert'

// local.js is the per-device sync-state IO layer; it talks to IndexedDB via
// idb.js. Node has no IndexedDB, so we install a minimal in-memory shim that
// covers exactly the surface idb.js uses (open + a single 'kv' store with
// get/put/delete + an openCursor enumerator). This lets us exercise the REAL
// recordWorking/unsyncedLocals code path — the reconcile-base race lives in that
// glue, not in a pure helper. The shim is installed before importing local.js so
// the module's idb.js sees it.
//
// idb.js's run() registers request.onsuccess handlers synchronously inside the
// transaction callback, then resolves the op on tx.oncomplete. The shim tracks
// a per-transaction pending counter so tx.oncomplete fires only AFTER every
// request (including a multi-hop cursor walk) has delivered its onsuccess —
// otherwise idbEntries' box.value is read half-filled (real IndexedDB completes
// a tx only when all its requests have settled).
function installFakeIndexedDB() {
  const dbs = new Map()
  globalThis.indexedDB = {
    open(name) {
      const store = dbs.get(name) || new Map()
      dbs.set(name, store)
      const makeObjectStore = (tx) => ({
        get(key) {
          tx.pending++
          const r = { onsuccess: null, result: store.get(key) }
          queueMicrotask(() => { r.onsuccess && r.onsuccess(); tx.done() })
          return r
        },
        put(value, key) {
          store.set(key, value)
          tx.pending++
          const r = { onsuccess: null }
          queueMicrotask(() => { r.onsuccess && r.onsuccess(); tx.done() })
          return r
        },
        delete(key) {
          store.delete(key)
          tx.pending++
          const r = { onsuccess: null }
          queueMicrotask(() => { r.onsuccess && r.onsuccess(); tx.done() })
          return r
        },
        openCursor() {
          const entries = [...store.entries()]
          let i = 0
          tx.pending++
          const r = { onsuccess: null }
          queueMicrotask(() => {
            const step = () => {
              if (i >= entries.length) {
                r.onsuccess && r.onsuccess({ target: { result: null } })
                tx.done()
                return
              }
              const [key, value] = entries[i++]
              const cursor = { key, value, continue: () => queueMicrotask(step) }
              r.onsuccess && r.onsuccess({ target: { result: cursor } })
            }
            step()
          })
          return r
        },
      })
      const db = {
        objectStoreNames: { contains: () => true },
        createObjectStore: () => makeObjectStore({ pending: 0, done() {} }),
        transaction() {
          const tx = { oncomplete: null, onerror: null, onabort: null, pending: 0, started: false }
          tx.settle = () => {
            if (tx.started && tx.pending === 0) tx.oncomplete && tx.oncomplete()
          }
          tx.done = () => { tx.pending--; tx.settle() }
          tx.objectStore = () => makeObjectStore(tx)
          // The tx callback runs synchronously after transaction() returns and
          // registers its requests; mark started + check on the next microtask
          // so an empty/all-settled tx still completes.
          queueMicrotask(() => { tx.started = true; tx.settle() })
          return tx
        },
        close() {},
      }
      const r = { onsuccess: null, onupgradeneeded: null, onerror: null, result: db }
      queueMicrotask(() => r.onsuccess && r.onsuccess())
      return r
    },
  }
}

installFakeIndexedDB()
const { recordWorking, ensureBase, unsyncedLocals, getLocal, promote, clearLocal } = await import('../src/lib/local.js')

test('first edit with an unseeded base still enqueues (reconcile-base race)', async () => {
  const id = 'race-1'
  await clearLocal(id)
  // No ensureBase has run yet (background loop raced). The authoritative pre-edit
  // note is the synced content; the edit must NOT poison the base with itself.
  const preEdit = { meta: { id, title: 'orig' }, body: 'original', hash: 'H_PRE' }
  const edited = { meta: { id, title: 'orig' }, body: 'edited', hash: 'H_EDIT' }

  await recordWorking(id, edited, preEdit)

  const rec = await getLocal(id)
  assert.equal(rec.base.hash, 'H_PRE', 'base must be the real pre-edit ancestor, not the edit')
  assert.equal(rec.working.hash, 'H_EDIT')

  const work = await unsyncedLocals()
  assert.ok(work.some(([k]) => k === id), 'the first edit must enter the reconcile queue')
})

test('without a base hint, recordWorking still falls back to working (legacy path, no crash)', async () => {
  const id = 'race-2'
  await clearLocal(id)
  const edited = { meta: { id }, body: 'edited', hash: 'H_EDIT' }
  await recordWorking(id, edited) // no hint
  const rec = await getLocal(id)
  // Fallback: base === working. This is the OLD (lossy) behavior, retained only
  // as a last resort when no hint is available; the queue then excludes it.
  assert.equal(rec.base.hash, 'H_EDIT')
  const work = await unsyncedLocals()
  assert.ok(!work.some(([k]) => k === id), 'base===working means not unsynced (fallback)')
})

test('an already-seeded base is never overwritten by a later edit', async () => {
  const id = 'race-3'
  await clearLocal(id)
  const synced = { meta: { id }, body: 'synced', hash: 'H_SYNCED' }
  await ensureBase(id, synced) // base seeded = working = synced
  const edited = { meta: { id }, body: 'edited', hash: 'H_EDIT' }
  // Pass a (wrong) hint to prove the existing base wins.
  await recordWorking(id, edited, { meta: { id }, body: 'wrong', hash: 'H_WRONG' })
  const rec = await getLocal(id)
  assert.equal(rec.base.hash, 'H_SYNCED', 'existing base (last-known-synced) wins over the hint')
  assert.equal(rec.working.hash, 'H_EDIT')
  const work = await unsyncedLocals()
  assert.ok(work.some(([k]) => k === id), 'working !== base → enqueued')
})

test('promote clears the unsynced state (base === working === synced)', async () => {
  const id = 'race-4'
  await clearLocal(id)
  await recordWorking(id, { meta: { id }, body: 'edit', hash: 'H_E' }, { meta: { id }, body: 'pre', hash: 'H_P' })
  assert.ok((await unsyncedLocals()).some(([k]) => k === id))
  await promote(id, { meta: { id }, body: 'edit', hash: 'H_E' })
  assert.ok(!(await unsyncedLocals()).some(([k]) => k === id), 'promote settles the note')
})
