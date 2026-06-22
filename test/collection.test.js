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
    await c.load('c1') // seeds the merge ancestor (base)
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
    // A subsequent retry (server now accepts) lands the edit and merges cleanly
    // against the UNCHANGED ancestor — no lost edit, no false-saved state stuck.
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
  // the identical write — base never advanced on the refused write, so the retry
  // merges against the last-confirmed ancestor and lands. (The app's `forceSave`
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
