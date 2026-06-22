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
const { recordWorking, recordCreate, ensureBase, unsyncedLocals, getLocal, promote, clearLocal } = await import('../src/lib/local.js')

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

test('stale promote (lower seq) is a no-op — newer edit wins regardless of resolve order', async () => {
  // Finding 1: two overlapping draft commits whose canonical writes resolve out
  // of order. The seq guard keeps the newer payload even when the stale promote
  // is submitted LAST.
  const id = 'seq-1'
  await clearLocal(id)
  const applied2 = await promote(id, { meta: { id }, body: 'Hello World', hash: 'H_HW' }, 2)
  const applied1 = await promote(id, { meta: { id }, body: 'Hello', hash: 'H_HELLO' }, 1)
  assert.equal(applied2, true, 'the newer (seq 2) settle applies')
  assert.equal(applied1, false, 'the stale (seq 1) settle is a no-op')
  const rec = await getLocal(id)
  assert.equal(rec.working.body, 'Hello World', 'newer edit survives')
})

test('an equal-seq promote still applies (the legitimate reconcile settle)', async () => {
  const id = 'seq-2'
  await clearLocal(id)
  const seq = await recordWorking(id, { meta: { id }, body: 'e', hash: 'H_E' }, { meta: { id }, body: 'p', hash: 'H_P' })
  const ok = await promote(id, { meta: { id }, body: 'e', hash: 'H_E' }, seq)
  assert.equal(ok, true)
  assert.ok(!(await unsyncedLocals()).some(([k]) => k === id), 'settled at its own seq')
})

test('recordCreate stores a null-base pending create that unsyncedLocals includes', async () => {
  // Finding 3: a brand-new draft whose canonical write was non-durable is durably
  // recoverable and enters the reconcile queue.
  const id = 'create-1'
  await clearLocal(id)
  await recordCreate(id, { meta: { id }, body: 'hello world', hash: 'H_HW' })
  const rec = await getLocal(id)
  assert.equal(rec.base, null, 'create has an explicit null base (clean create, not a conflict)')
  assert.equal(rec.working.body, 'hello world')
  const work = await unsyncedLocals()
  assert.ok(work.some(([k]) => k === id), 'a pending create is in the reconcile queue')
})

test('recordWorking preserves an existing null base (does not turn a create into a conflict)', async () => {
  const id = 'create-2'
  await clearLocal(id)
  await recordCreate(id, { meta: { id }, body: 'v1', hash: 'H_V1' })
  // A later edit on the still-unsynced create must keep base null.
  await recordWorking(id, { meta: { id }, body: 'v2', hash: 'H_V2' }, { meta: { id }, body: 'v1', hash: 'H_V1' })
  const rec = await getLocal(id)
  assert.equal(rec.base, null, 'the create marker survives a later edit')
  assert.equal(rec.working.body, 'v2')
})

test('recordWorking returns a monotonically advancing seq', async () => {
  const id = 'seq-3'
  await clearLocal(id)
  const s1 = await recordWorking(id, { meta: { id }, body: 'a', hash: 'H_A' }, { meta: { id }, body: '0', hash: 'H_0' })
  const s2 = await recordWorking(id, { meta: { id }, body: 'b', hash: 'H_B' })
  assert.ok(s2 > s1, 'seq advances on each edit')
})

test('concurrent recordWorking + promote serialize (no torn read-modify-write)', async () => {
  // Finding 2: the per-note lock makes the read-modify-write atomic, so a
  // reconcile promote that advances base is not reverted by a concurrent edit.
  const id = 'rmw-1'
  await clearLocal(id)
  await ensureBase(id, { meta: { id }, body: 'B', hash: 'H_B' })
  const before = await getLocal(id)
  const p1 = promote(id, { meta: { id }, body: 'S', hash: 'H_S' }, before.seq)
  const p2 = recordWorking(id, { meta: { id }, body: 'W', hash: 'H_W' }, { meta: { id }, body: 'B', hash: 'H_B' })
  await Promise.all([p1, p2])
  const rec = await getLocal(id)
  // The advance to S (base) is preserved; the edit sits on top as working.
  assert.equal(rec.base.body, 'S', 'reconcile base-advance not reverted by the concurrent edit')
  assert.equal(rec.working.body, 'W')
})
