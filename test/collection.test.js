import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
if (!globalThis.crypto) globalThis.crypto = webcrypto
import { makeMockStorage, DurableWriteError } from './mobius-storage-mock.mjs'
import { makeNoteCollection } from '../src/lib/collection.js'
import { notePath } from '../src/lib/note-doc.js'

// The collection is the storage glue that replaced the shadow outbox + seq-CAS
// promote + reconcile driver. It gives closed notes a serialized last-write-wins
// path over the real runtime contract (modeled by the mock).

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = {
    mobius: {
      storage: harness.storage,
      online: true,
      runtimeFeatures: { authoritativeVersionedReads: true },
      signal() {},
    },
  }
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev })
}

const note = (id, body, extra = {}) => ({ meta: { id, title: '', ...extra }, body })

test('(a) an edit persists as a JSON document at notes/<id>.json', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    const { result } = await c.update('n1', () => note('n1', 'hello world'))
    assert.equal(result.durability, 'synced')
    const stored = h.raw.get(notePath('n1'))
    assert.equal(stored.kind, 'json')
    assert.deepEqual(stored.value.meta.id, 'n1')
    assert.equal(stored.value.body, 'hello world')
  })
})

test('(a2) an edit persists on runtimes that expose set() but not durableWrite()', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const original = h.storage.durableWrite
    delete h.storage.durableWrite
    const c = makeNoteCollection({})
    const { result } = await c.update('legacy-runtime', () => note('legacy-runtime', 'hello old runtime'))
    assert.equal(result.durability, 'synced')
    assert.equal(result.legacy, true)
    assert.equal(h.raw.get(notePath('legacy-runtime')).value.body, 'hello old runtime')
    h.storage.durableWrite = original
  })
})

test('(b) a dead-lettered durable write REJECTS (error, not a false save)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.forceDeadLetter(notePath('n2'), 413)
    await assert.rejects(
      () => c.update('n2', () => note('n2', 'doomed')),
      (e) => e instanceof DurableWriteError && e.code === 'dead_letter' && e.status === 413,
    )
    // Nothing was stored — no false "saved".
    assert.equal(h.raw.has(notePath('n2')), false)
  })
})

test('(b2) a closed-note save dead-letter rejects AND does not lose the existing note', async () => {
  // The closed-note write path (app.writeNote -> collection.update for a note that
  // is not the open editor). A dead-letter MUST reject so the caller surfaces a
  // visible error (the grid-level 'Save failed' banner / the editor staying open)
  // and MUST NOT destroy the note that is already on disk.
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    // An existing, server-confirmed note.
    h.seed(notePath('c1'), note('c1', 'original', { title: 'Keep me' }))
    await c.load('c1') // remembers the last readable value
    // A closed-note edit (e.g. a grid pin/color, or an autosave flush) is refused.
    h.forceDeadLetter(notePath('c1'), 413)
    await assert.rejects(
      () => c.update('c1', (prev) => ({ ...prev, body: 'edited' })),
      (e) => e instanceof DurableWriteError && e.code === 'dead_letter',
    )
    // The note is NOT lost: the prior server value is intact (the refused write
    // clobbered nothing), so the user's data survives and a retry is possible.
    assert.equal(h.server.get(notePath('c1')).value.body, 'original')
    assert.equal(h.server.get(notePath('c1')).value.meta.title, 'Keep me')
    // A subsequent retry (server now accepts) lands the edit.
    const { result, value } = await c.update('c1', (prev) => ({ ...prev, body: 'edited' }))
    assert.equal(result.durability, 'synced')
    assert.equal(value.body, 'edited')
    assert.equal(h.server.get(notePath('c1')).value.body, 'edited')
  })
})

test('(b3) a retry of the SAME content after a dead-letter still reaches the server', async () => {
  // Guards the optimistic-baseline regression: after a refused save the app keeps
  // the optimistic note (so buffer == note), and a naive 'nothing changed' skip
  // would suppress the retry forever. The collection layer must (and does) re-issue
  // the identical write. (The app's `forceSave`
  // gate is what makes flushSave/persist actually CALL this retry; this test pins
  // that the underlying write is not idempotently swallowed server-side.)
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.seed(notePath('r1'), note('r1', 'base'))
    await c.load('r1')
    h.forceDeadLetter(notePath('r1'), 413)
    await assert.rejects(() => c.update('r1', () => note('r1', 'retry me')))
    assert.equal(h.server.get(notePath('r1')).value.body, 'base') // unchanged
    // Retry the EXACT same content; it must now land (server accepts).
    const { result } = await c.update('r1', () => note('r1', 'retry me'))
    assert.equal(result.durability, 'synced')
    assert.equal(h.server.get(notePath('r1')).value.body, 'retry me')
  })
})

test('(c) an OFFLINE write is durable success (queued), not a failure', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.setOnline(false)
    const { result } = await c.update('n3', () => note('n3', 'offline edit'))
    assert.equal(result.durability, 'queued')
    // Read-your-writes: the value is durably held in the local overlay and visible
    // to get(), but it is NOT on the server yet (queued != server-confirmed).
    const seen = await h.storage.get(notePath('n3'))
    assert.equal(seen.body, 'offline edit')
    assert.equal(h.overlay.has(notePath('n3')), true)
    assert.equal(h.server.has(notePath('n3')), false)
    assert.equal(await h.storage.pendingCount(), 1)
  })
})

test('a delayed same-note conflict preserves the refused document as a recovery note', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let conflictHandler = null
    h.storage.onConflict = (cb) => { conflictHandler = cb; return () => { conflictHandler = null } }
    const c = makeNoteCollection()
    const refused = note('shared', 'my offline body', { title: 'Trip plan' })

    conflictHandler({
      path: notePath('shared'),
      status: 412,
      writeId: 'offline-write',
      refusedValue: refused,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    const recovered = [...h.server.entries()]
      .filter(([path]) => /^notes\/[^/]+\.json$/.test(path) && path !== notePath('shared'))
      .map(([, record]) => record.value)
    assert.equal(recovered.length, 1)
    assert.equal(recovered[0].body, 'my offline body')
    assert.equal(recovered[0].meta.recoveredFromConflict, 'shared')
    assert.match(recovered[0].meta.title, /recovered offline edit/)
    c.destroy()
  })
})

test('a queued recovery keeps the original conflict pending until the server confirms it', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let conflictHandler = null
    h.storage.onConflict = (cb) => { conflictHandler = cb; return () => { conflictHandler = null } }
    const c = makeNoteCollection()
    const conflict = {
      path: notePath('shared'),
      status: 412,
      writeId: 'queued-recovery',
      refusedValue: note('shared', 'my offline body'),
    }

    h.setOnline(false)
    assert.equal(await conflictHandler(conflict), false, 'a queued recovery cannot acknowledge the original conflict')
    const recoveryPath = [...h.overlay.keys()].find((path) => path !== notePath('shared'))
    assert.ok(recoveryPath, 'the recovery copy is held in the local outbox')

    await h.drain()
    assert.equal(await conflictHandler(conflict), true, 'the replay acknowledges only after the recovery reaches the server')
    c.destroy()
  })
})

test('replayed note recovery cannot confirm its own queued overlay', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let conflictHandler = null
    let authoritative = null
    let queuedOverlay = null
    let writes = 0
    h.storage.onConflict = (cb) => { conflictHandler = cb; return () => { conflictHandler = null } }
    h.storage.getWithVersion = async () => ({
      value: authoritative,
      version: authoritative ? 'server-v2' : null,
      offline: false,
    })
    h.storage.durableWrite = async (_path, value) => {
      writes += 1
      queuedOverlay = value
      return { durability: 'queued' }
    }
    const c = makeNoteCollection()
    const conflict = {
      path: notePath('shared'),
      status: 412,
      writeId: 'queued-replay',
      refusedValue: note('shared', 'my offline body'),
    }

    assert.equal(await conflictHandler(conflict), false)
    assert.ok(queuedOverlay, 'the local overlay exists but is not authoritative')
    assert.equal(await conflictHandler(conflict), false)
    assert.equal(writes, 2, 'replay remains pending while the server has no recovery copy')

    authoritative = queuedOverlay
    assert.equal(await conflictHandler(conflict), true)
    assert.equal(writes, 2, 'server confirmation is acknowledged without another write')
    c.destroy()
  })
})

test('conflict recovery is idempotent for one write and remains enabled for recovered-note edits', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let conflictHandler = null
    h.storage.onConflict = (cb) => { conflictHandler = cb; return () => { conflictHandler = null } }
    const writes = []
    const original = h.storage.durableWrite
    h.storage.durableWrite = async (path, value, options) => {
      writes.push({ path, value, options })
      return original(path, value, options)
    }
    const c = makeNoteCollection()
    const conflict = {
      path: notePath('shared'),
      status: 412,
      writeId: 'same-offline-write',
      refusedValue: note('shared', 'mine'),
    }
    await Promise.all([conflictHandler(conflict), conflictHandler(conflict)])
    assert.equal(writes.length, 1)

    const recovered = writes[0].value
    await conflictHandler({
      path: writes[0].path,
      status: 412,
      writeId: 'edit-of-recovered-note',
      refusedValue: { ...recovered, body: 'edited again' },
    })
    assert.equal(writes.length, 2)
    assert.equal(writes[1].value.body, 'edited again')
    assert.notEqual(writes[1].path, writes[0].path)
    c.destroy()
  })
})

test('closed-note writes use CAS only when delayed-conflict recovery is available', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.storage.getWithVersion = async () => ({
      value: note('shared', 'server body'),
      version: 'etag-server',
    })
    h.storage.onConflict = () => () => {}
    const calls = []
    const original = h.storage.durableWrite
    h.storage.durableWrite = async (path, value, options) => {
      calls.push(options)
      return original(path, value, options)
    }
    const c = makeNoteCollection()
    await c.update('shared', (current) => ({ ...current, body: 'mine' }))
    assert.equal(calls[0].ifMatch, 'etag-server')
    c.destroy()
  })
})

test('older runtimes keep Notes on the non-CAS compatibility path', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    delete window.mobius.runtimeFeatures
    let installed = false
    h.storage.onConflict = () => { installed = true; return () => {} }
    h.storage.getWithVersion = async () => ({
      value: note('legacy-shared', 'server body'),
      version: 'etag-server',
    })
    const calls = []
    const original = h.storage.durableWrite
    h.storage.durableWrite = async (path, value, options) => {
      calls.push(options)
      return original(path, value, options)
    }
    const c = makeNoteCollection()
    await c.update('legacy-shared', (current) => ({ ...current, body: 'mine' }))
    assert.equal(installed, false)
    assert.equal(calls[0].ifMatch, undefined)
    assert.equal(calls[0].ifNoneMatch, undefined)
    c.destroy()
  })
})

test('a rolling older runtime keeps LWW instead of queuing unrecoverable CAS', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.storage.getWithVersion = async () => ({
      value: note('shared', 'server body'),
      version: 'etag-server',
    })
    const calls = []
    const original = h.storage.durableWrite
    h.storage.durableWrite = async (path, value, options) => {
      calls.push(options)
      return original(path, value, options)
    }
    const c = makeNoteCollection()
    await c.update('shared', (current) => ({ ...current, body: 'mine' }))
    assert.equal(calls[0].ifMatch, undefined)
  })
})

test('(d) an updater sees the latest readable value and its result wins', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection()
    h.seed(notePath('n4'), note('n4', 'one\ntwo\nthree'))
    await c.load('n4')

    // Another writer lands first. The collection reads that current value before
    // applying this local updater, then writes the updater's result verbatim.
    h.seed(notePath('n4'), note('n4', 'one\ntwo\nTHREE'))
    const { value } = await c.update('n4', (prev) => ({ ...prev, body: 'ONE\ntwo\nthree' }))

    assert.equal(value.body, 'ONE\ntwo\nthree')
    assert.equal(h.raw.get(notePath('n4')).value.body, 'ONE\ntwo\nthree')
  })
})

test('(d2) overlapping writes are plain LWW with no descriptor side path', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection()
    h.seed(notePath('n5'), note('n5', 'a\nb\nc'))
    await c.load('n5')
    h.seed(notePath('n5'), note('n5', 'a\nY\nc')) // server edited line 2
    const { value } = await c.update('n5', (prev) => ({ ...prev, body: 'a\nX\nc' })) // we edited line 2
    assert.equal(value.body, 'a\nX\nc')
    assert.equal(h.raw.get(notePath('n5')).value.body, 'a\nX\nc')
    assert.equal([...h.raw.keys()].some((path) => path.startsWith('conflicts/')), false)
  })
})

test('(e) existing notes load from notes/<id>.json', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.seed(notePath('e1'), note('e1', 'first', { title: 'First', pinned: true }))
    h.seed(notePath('e2'), note('e2', 'second', { title: 'Second' }))
    h.seed('notes/not-a-note.txt', 'ignore me', 'text') // non-.json ignored
    const loaded = await c.list()
    const ids = loaded.map((n) => n.meta.id).sort()
    assert.deepEqual(ids, ['e1', 'e2'])
    const e1 = loaded.find((n) => n.meta.id === 'e1')
    assert.equal(e1.body, 'first')
    assert.equal(e1.meta.pinned, true)
  })
})

test('serialized writes: two overlapping updates to one note run in order, last wins', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    const order = []
    const p1 = c.update('s1', () => { order.push('first'); return note('s1', 'A') })
    const p2 = c.update('s1', () => { order.push('second'); return note('s1', 'B') })
    await Promise.all([p1, p2])
    assert.deepEqual(order, ['first', 'second'])
    assert.equal(h.raw.get(notePath('s1')).value.body, 'B')
  })
})

test('remove deletes the canonical document', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.seed(notePath('d1'), note('d1', 'bye'))
    await c.load('d1')
    await c.remove('d1')
    assert.equal(h.raw.has(notePath('d1')), false)
  })
})

test('remove of a known canonical note is O(1), with no directory scan or per-note reads', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let listCalls = 0
    let getCalls = 0
    const originalList = h.storage.list
    const originalGet = h.storage.get
    h.storage.list = async (...args) => { listCalls++; return originalList.apply(h.storage, args) }
    h.storage.get = async (...args) => { getCalls++; return originalGet.apply(h.storage, args) }

    const c = makeNoteCollection({})
    h.seed(notePath('fast'), note('fast', 'delete me'))
    for (let i = 0; i < 50; i++) h.seed(notePath(`other-${i}`), note(`other-${i}`, 'keep'))
    await c.load('fast') // remembers the exact storage path
    listCalls = 0
    getCalls = 0

    await c.remove('fast')

    assert.equal(h.raw.has(notePath('fast')), false)
    assert.equal(listCalls, 0, 'delete did not list notes/')
    assert.equal(getCalls, 0, 'delete did not read every note document')
  })
})

test('remove deletes a note whose document filename and meta.id diverged', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.seed(notePath('file-id'), note('meta-id', 'broken image refs', {
      attachments: ['attachments/missing-a.jpeg', 'attachments/missing-b.jpeg'],
    }))

    const listed = await c.list()
    assert.equal(listed[0].meta.id, 'meta-id')
    assert.equal(listed[0].storagePath, notePath('file-id'))

    await c.remove('meta-id')

    assert.equal(h.raw.has(notePath('file-id')), false, 'actual mismatched document path was removed')
    assert.equal(h.raw.has(notePath('meta-id')), false, 'canonical meta-id path is absent too')
    assert.deepEqual(await c.list(), [], 'the note does not reappear on the next list')
  })
})

test('remove rejects on durable delete failure so the UI can keep the note visible', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.seed(notePath('keep'), note('keep', 'do not hide me'))
    await c.load('keep')
    h.forceDeadLetter(notePath('keep'), 500)

    await assert.rejects(
      () => c.remove('keep'),
      (e) => e instanceof DurableWriteError && e.path === notePath('keep'),
    )
    assert.equal(h.raw.has(notePath('keep')), true, 'failed delete left the note on disk for retry')
  })
})

test('a complete membership listing with a missing body is still incomplete', async () => {
  const previousWindow = globalThis.window
  const good = {
    meta: { id: 'good', title: 'Good', updated: '2026-09-24T00:00:00Z' },
    body: 'available',
  }
  globalThis.window = {
    mobius: {
      online: false,
      storage: {
        async listWithStatus() {
          return {
            complete: true,
            source: 'cache',
            entries: [
              { type: 'file', name: 'good.json', path: 'notes/good.json' },
              { type: 'file', name: 'missing.json', path: 'notes/missing.json' },
            ],
          }
        },
        async get(path) { return path === 'notes/good.json' ? good : null },
      },
    },
  }
  try {
    assert.equal(await makeNoteCollection().list(), null)
  } finally {
    globalThis.window = previousWindow
  }
})

function stampedListingWindow({ entries, bodies, gets }) {
  return {
    mobius: {
      online: true,
      storage: {
        async listWithStatus(_prefix, options) {
          return { complete: true, source: 'server', entries: entries(options) }
        },
        async get(path) { gets.push(path); return bodies.get(path) ?? null },
        async getWithVersion(path) { return { value: bodies.get(path) ?? null, version: 'v' } },
        async durableWrite(path, value) { bodies.set(path, value); return { durability: 'synced' } },
      },
    },
  }
}

test('a metadata-only re-list reads runtime bodies even when listing stamps are unchanged', async () => {
  const previousWindow = globalThis.window
  const bodies = new Map([
    ['notes/a.json', note('a', 'first')],
    ['notes/b.json', note('b', 'second')],
  ])
  const stamps = new Map([['notes/a.json', 't1'], ['notes/b.json', 't1']])
  const gets = []
  globalThis.window = stampedListingWindow({
    bodies, gets,
    entries: () => [...bodies.keys()].map((path) => ({
      type: 'file', name: path.slice(6), path, modified_at: stamps.get(path), size: 10,
    })),
  })
  try {
    const c = makeNoteCollection()
    assert.equal((await c.list()).length, 2)
    assert.deepEqual(gets.sort(), ['notes/a.json', 'notes/b.json'])

    gets.length = 0
    bodies.set('notes/b.json', note('b', 'changed elsewhere'))
    // A completed runtime revalidation can change the body without changing
    // the listing metadata that was already returned with the stale body.
    const relisted = await c.list()
    assert.deepEqual(gets.sort(), ['notes/a.json', 'notes/b.json'])
    assert.equal(relisted.find((n) => n.meta.id === 'b').body, 'changed elsewhere')
    assert.equal(relisted.find((n) => n.meta.id === 'a').body, 'first')

    gets.length = 0
    await c.update('a', () => note('a', 'edited here'))
    const afterWrite = await c.list()
    assert.deepEqual(gets.sort(), ['notes/a.json', 'notes/b.json'])
    assert.equal(afterWrite.find((n) => n.meta.id === 'a').body, 'edited here')
  } finally {
    globalThis.window = previousWindow
  }
})

test('list reads through the runtime instead of trusting possibly stale inline bodies', async () => {
  const previousWindow = globalThis.window
  const bodies = new Map([['notes/a.json', note('a', 'current runtime body')], ['notes/big.json', note('big', 'large')]])
  const gets = []
  globalThis.window = stampedListingWindow({
    bodies, gets,
    entries: (options) => {
      assert.equal(options?.includeContent, undefined, 'do not request unverified inline bodies')
      return [
        { type: 'file', name: 'a.json', path: 'notes/a.json', content: note('a', 'stale inline body') },
        // Bodies over the server's inline cap arrive without `content`.
        { type: 'file', name: 'big.json', path: 'notes/big.json' },
      ]
    },
  })
  try {
    const listed = await makeNoteCollection().list()
    assert.deepEqual(listed.map((n) => n.body).sort(), ['current runtime body', 'large'])
    assert.deepEqual(gets, ['notes/a.json', 'notes/big.json'])
  } finally {
    globalThis.window = previousWindow
  }
})

test('a list that overlaps a local write shows the edited body on the next list', async () => {
  const previousWindow = globalThis.window
  const bodies = new Map([['notes/a.json', note('a', 'first')]])
  const gets = []
  globalThis.window = stampedListingWindow({
    bodies, gets,
    // The server stamp stays the same, as it does while the write is queued.
    entries: () => [{ type: 'file', name: 'a.json', path: 'notes/a.json', modified_at: 't1', size: 10 }],
  })
  const storage = globalThis.window.mobius.storage
  const read = storage.get
  let duringRead = null
  storage.get = async (path) => {
    const value = await read(path)
    const hook = duringRead
    duringRead = null
    if (hook) await hook()
    return value
  }
  try {
    const c = makeNoteCollection()
    duringRead = () => c.update('a', () => note('a', 'edited during list'))
    await c.list()
    gets.length = 0
    const relisted = await c.list()
    assert.deepEqual(gets, ['notes/a.json'], 'the overlapping list did not cache the pre-write body')
    assert.equal(relisted.find((n) => n.meta.id === 'a').body, 'edited during list')
  } finally {
    globalThis.window = previousWindow
  }
})

test('a list during a pending save shows the saved note on the next list', async () => {
  const previousWindow = globalThis.window
  const bodies = new Map([['notes/a.json', note('a', 'first')]])
  const gets = []
  globalThis.window = stampedListingWindow({
    bodies, gets,
    // The server stamp stays the same, as it does while the write is queued.
    entries: () => [{ type: 'file', name: 'a.json', path: 'notes/a.json', modified_at: 't1', size: 10 }],
  })
  const storage = globalThis.window.mobius.storage
  let releaseWrite
  const writeHeld = new Promise((resolve) => { releaseWrite = resolve })
  let writeStarted
  const started = new Promise((resolve) => { writeStarted = resolve })
  storage.durableWrite = async (path, value) => {
    writeStarted()
    await writeHeld
    bodies.set(path, value)
    return { durability: 'queued' }
  }
  try {
    const c = makeNoteCollection()
    const save = c.update('a', () => note('a', 'saved while listing'))
    await started
    // A reconnect re-list while the save is still in flight.
    assert.equal((await c.list()).find((n) => n.meta.id === 'a').body, 'first')
    releaseWrite()
    await save

    gets.length = 0
    const relisted = await c.list()
    assert.deepEqual(gets, ['notes/a.json'], 'the body read during the save is not reused')
    assert.equal(relisted.find((n) => n.meta.id === 'a').body, 'saved while listing')
    gets.length = 0
    assert.equal((await c.list())[0].body, 'saved while listing')
    assert.deepEqual(gets, ['notes/a.json'], 'later lists still consult the runtime')
  } finally {
    globalThis.window = previousWindow
  }
})

test('a list during conflict recovery does not keep the refused body', async () => {
  const previousWindow = globalThis.window
  const bodies = new Map([['notes/a.json', note('a', 'my refused edit')]])
  const gets = []
  globalThis.window = stampedListingWindow({
    bodies, gets,
    entries: () => [{ type: 'file', name: 'a.json', path: 'notes/a.json', modified_at: 't1', size: 10 }],
  })
  globalThis.window.mobius.runtimeFeatures = { authoritativeVersionedReads: true }
  const storage = globalThis.window.mobius.storage
  let conflictListener = null
  storage.onConflict = (listener) => { conflictListener = listener; return () => {} }
  let releaseWrite
  const writeHeld = new Promise((resolve) => { releaseWrite = resolve })
  let writeStarted
  const started = new Promise((resolve) => { writeStarted = resolve })
  storage.getWithVersion = async () => ({ value: null, version: null })
  storage.durableWrite = async (path, value) => {
    writeStarted()
    await writeHeld
    bodies.set(path, value)
    return { durability: 'synced' }
  }
  try {
    const c = makeNoteCollection()
    const recovery = conflictListener({
      path: 'notes/a.json', writeId: 'w1', refusedValue: note('a', 'my refused edit'),
    })
    await started
    await c.list() // reads the refused overlay before the runtime restores the remote body
    bodies.set('notes/a.json', note('a', 'remote winner'))
    releaseWrite()
    await recovery

    gets.length = 0
    const relisted = await c.list()
    assert.ok(gets.includes('notes/a.json'), 'the body read during recovery is not reused')
    assert.equal(relisted.find((n) => n.meta.id === 'a').body, 'remote winner')
  } finally {
    globalThis.window = previousWindow
  }
})

// Like runtime-integration.test.js, this optional integration uses an explicit
// platform checkout, never a contributor-specific path or a live storage API.
const FRONTEND = process.env.MOBIUS_FRONTEND || (
  process.env.MOBIUS_FRONTEND_NODE_MODULES ? dirname(process.env.MOBIUS_FRONTEND_NODE_MODULES) : null
)
const RUNTIME = FRONTEND ? resolve(FRONTEND, 'public/mobius-runtime.js') : null
const HARNESS = FRONTEND ? resolve(FRONTEND, 'src/lib/__tests__/mobiusRuntimeHarness.mjs') : null
const HAVE_RUNTIME = !!(RUNTIME && HARNESS && existsSync(RUNTIME) && existsSync(HARNESS))

test('runtime revalidation recovers a large stale listed body and preserves queued offline edits', {
  skip: !HAVE_RUNTIME ? 'platform runtime not present' : false,
}, async (t) => {
  const globals = ['window', 'document', 'navigator', 'fetch', 'indexedDB']
    .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
  let storage
  t.after(() => {
    storage?._destroy()
    for (const [key, descriptor] of globals) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else delete globalThis[key]
    }
  })
  const { freshEnv, waitFor } = await import(HARNESS)
  const { makeStorage } = await import(RUNTIME)
  const { server } = freshEnv()
  const path = notePath('large')
  const stale = note('large', 'old:' + 'x'.repeat(70 * 1024))
  const fresh = note('large', 'new:' + 'x'.repeat(70 * 1024))
  let modifiedAt = '2026-01-01T00:00:00Z'
  // The platform harness inlines all JSON and omits stamps. Model the real
  // backend's metadata and 64 KiB per-file cap at the HTTP boundary only;
  // keep the real runtime's IndexedDB mirror, SWR and queued overlays intact.
  globalThis.fetch = async (url, init) => {
    const response = await server.fetch(url, init)
    if (!url.includes('/apps-list/') || !response.ok) return response
    const body = await response.json()
    for (const entry of body.entries) {
      const value = server.serverValue(entry.path)
      entry.size = Buffer.byteLength(JSON.stringify(value))
      entry.modified_at = modifiedAt
      if (entry.size > 64 * 1024) delete entry.content
    }
    return { ...response, json: async () => body }
  }
  const payload = Buffer.from(JSON.stringify({ scope: 'app', app_id: '1', rev: '1' })).toString('base64url')
  storage = makeStorage({ appId: '1', getToken: async () => `header.${payload}.signature` })
  window.mobius = { storage, online: true }
  const c = makeNoteCollection()
  t.after(() => c.destroy())

  server.seed(path, stale)
  assert.equal((await storage.get(path)).body === stale.body, true, 'prime the old runtime mirror')
  server.seed(path, fresh)
  modifiedAt = '2026-01-02T00:00:00Z'
  const listing = await storage.listWithStatus('notes', { includeContent: true })
  assert.equal(listing.entries[0].modified_at, modifiedAt)
  assert.ok(listing.entries[0].size > 64 * 1024)
  assert.equal(Object.hasOwn(listing.entries[0], 'content'), false)
  assert.equal((await c.list())[0].body === stale.body, true, 'the first GET is stale-while-revalidate')
  await waitFor(async () => (await storage.get(path)).body === fresh.body)
  assert.equal((await c.list())[0].body === fresh.body, true, 'unchanged listing metadata must not pin the stale body')

  server.setOnline(false)
  window.mobius.online = false
  const { result } = await c.update('large', () => note('large', 'queued locally'))
  assert.equal(result.durability, 'queued')
  assert.equal(server.serverValue(path).body === fresh.body, true, 'queued is not server-confirmed')
  assert.equal((await c.list())[0].body, 'queued locally', 'offline listing overlays the queued write')
  await c.remove('large')
  assert.deepEqual(await c.list(), [], 'offline listing hides the queued delete')
  assert.equal(server.serverHas(path), true)
})

test('metadata-only fallback reads stay bounded and retain every note', async () => {
  const h = makeMockStorage()
  for (let i = 0; i < 19; i++) h.seed(notePath(`batch-${i}`), note(`batch-${i}`, `body-${i}`))
  let active = 0
  let peak = 0
  const read = h.storage.get
  h.storage.get = async (path) => {
    active++
    peak = Math.max(peak, active)
    try {
      await new Promise((resolve) => setImmediate(resolve))
      return await read(path)
    } finally { active-- }
  }
  await withWindow(h, async () => {
    const listed = await makeNoteCollection().list()
    assert.equal(listed.length, 19)
    assert.equal(new Set(listed.map((n) => n.meta.id)).size, 19)
    assert.ok(peak > 1, 'independent reads do not form a serial waterfall')
    assert.ok(peak <= 8, 'fallback concurrency is bounded')
  })
})

test('a failed fallback body read preserves the prior view rather than returning a subset', async () => {
  const h = makeMockStorage()
  h.seed(notePath('good'), note('good', 'available'))
  h.seed(notePath('unreadable'), note('unreadable', 'temporarily unavailable'))
  h.storage.listWithStatus = async () => ({
    complete: true,
    entries: [
      { type: 'file', name: 'good.json', path: notePath('good'), content: note('good', 'available') },
      { type: 'file', name: 'unreadable.json', path: notePath('unreadable'), content: null },
    ],
  })
  h.storage.get = async (path) => {
    if (path === notePath('good')) return note('good', 'available')
    throw new Error('read failed')
  }
  await withWindow(h, async () => {
    assert.equal(await makeNoteCollection().list(), null)
  })
})

for (const writer of ['collection', 'editor runtime']) {
  for (const action of ['pin', 'color']) {
    test(`a held listing cannot undo a completed ${writer} write on the next ${action}`, {
      skip: !HAVE_RUNTIME ? 'platform runtime not present' : false,
    }, async (t) => {
      const globals = ['window', 'document', 'navigator', 'fetch', 'indexedDB']
        .map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)])
      let storage, collection, releaseListing
      t.after(() => {
        releaseListing?.()
        collection?.destroy()
        storage?._destroy()
        for (const [key, descriptor] of globals) {
          if (descriptor) Object.defineProperty(globalThis, key, descriptor)
          else delete globalThis[key]
        }
      })
      const { freshEnv } = await import(HARNESS)
      const { makeStorage } = await import(RUNTIME)
      const { server } = freshEnv()
      const payload = Buffer.from(JSON.stringify({ scope: 'app', app_id: '1', rev: '1' })).toString('base64url')
      storage = makeStorage({ appId: '1', getToken: async () => `header.${payload}.signature` })
      window.mobius = { storage, online: true, runtimeFeatures: { authoritativeVersionedReads: true } }
      collection = makeNoteCollection()
      const path = notePath('race')
      server.seed(path, note('race', 'old body'))
      await storage.get(path)

      let listingStarted
      const started = new Promise((resolve) => { listingStarted = resolve })
      const held = new Promise((resolve) => { releaseListing = resolve })
      globalThis.fetch = async (url, init) => {
        const response = await server.fetch(url, init)
        if (!url.includes('/apps-list/') || !response.ok) return response
        // Capture the server's old response before allowing the writer to run.
        // Only the HTTP response is held; runtime locks/outbox/mirror are real.
        const snapshot = structuredClone(await response.json())
        listingStarted()
        await held
        return { ...response, json: async () => snapshot }
      }
      const pendingList = collection.list()
      await started
      let saved
      if (writer === 'collection') {
        saved = (await collection.update('race', () => note('race', 'completed edit'))).result
      } else {
        // The editor writes through the runtime, not this collection instance.
        const { version } = await storage.getWithVersion(path)
        saved = await storage.durableWrite(path, note('race', 'completed edit'), { kind: 'json', ifMatch: version })
      }
      assert.equal(saved.durability, 'synced')
      assert.equal(await storage.pendingCount(), 0, 'the completed write has left the outbox')
      assert.equal(server.serverValue(path).body, 'completed edit')
      releaseListing()
      const [listed] = await pendingList
      assert.equal((await storage.get(path)).body, 'completed edit', 'the late response did not replace the runtime mirror')

      // Pin/color persist the grid record's full body, as App.persist does.
      // A fresh CAS version alone cannot protect an already-stale grid body.
      const meta = { ...listed.meta, ...(action === 'pin' ? { pinned: true } : { color: 'blue' }) }
      const { result } = await collection.update('race', () => ({ meta, body: listed.body }))
      assert.equal(result.durability, 'synced')
      assert.equal(server.serverValue(path).body, 'completed edit', 'a metadata action must not overwrite the completed body edit')
      assert.equal(listed.body, 'completed edit', 'the delayed list must read the current runtime body')
      assert.equal(server.serverValue(path).meta[action === 'pin' ? 'pinned' : 'color'], action === 'pin' ? true : 'blue')
    })
  }
}
