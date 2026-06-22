import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto
import { makeMockStorage, DurableWriteError } from './mobius-storage-mock.mjs'
import { makeNoteCollection } from '../src/lib/collection.js'
import { notePath } from '../src/lib/note-doc.js'

// The collection is the storage glue that replaced the shadow outbox + seq-CAS
// promote + reconcile driver. It gives each note the useDocument 'lww'
// read-merge-write over the real runtime contract (modeled by the mock). These
// tests pin the migration's required guarantees (a–e).

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = { mobius: { storage: harness.storage, online: true, signal() {} } }
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

test('(c) an OFFLINE write is durable success (queued), not a failure', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const c = makeNoteCollection({})
    h.setOnline(false)
    const { result } = await c.update('n3', () => note('n3', 'offline edit'))
    assert.equal(result.durability, 'queued')
    // Read-your-writes: the value is durably held locally.
    const stored = h.raw.get(notePath('n3'))
    assert.equal(stored.value.body, 'offline edit')
    assert.equal(await h.storage.pendingCount(), 1)
  })
})

test('(d) concurrent same-note edits 3-way-merge via merge3 (no lost edit)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    let conflicts = 0
    const c = makeNoteCollection({ onConflict: () => { conflicts++ } })
    // Seed a base and load it so the collection tracks the ancestor.
    h.seed(notePath('n4'), note('n4', 'one\ntwo\nthree'))
    await c.load('n4')

    // Simulate the server having a DIFFERENT concurrent edit on line 3 already
    // landed when our edit (line 1) reaches the writer.
    h.seed(notePath('n4'), note('n4', 'one\ntwo\nTHREE'))
    const { value } = await c.update('n4', (prev) => ({ ...prev, body: 'ONE\ntwo\nthree' }))

    // Both edits survive (disjoint lines) — neither is lost.
    assert.equal(value.body, 'ONE\ntwo\nTHREE')
    assert.equal(conflicts, 0)
    assert.equal(h.raw.get(notePath('n4')).value.body, 'ONE\ntwo\nTHREE')
  })
})

test('(d2) overlapping same-line concurrent edits keep MINE and flag a conflict', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const descriptors = []
    const c = makeNoteCollection({ onConflict: (d) => descriptors.push(d) })
    h.seed(notePath('n5'), note('n5', 'a\nb\nc'))
    await c.load('n5')
    h.seed(notePath('n5'), note('n5', 'a\nY\nc')) // server edited line 2
    const { value } = await c.update('n5', (prev) => ({ ...prev, body: 'a\nX\nc' })) // we edited line 2
    // LWW: our edit lands canonically, never silently dropped.
    assert.equal(value.body, 'a\nX\nc')
    // The descriptor is recorded inside update() (awaited), so it's ready now.
    assert.equal(descriptors.length, 1)
    assert.equal(descriptors[0].noteId, 'n5')
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
