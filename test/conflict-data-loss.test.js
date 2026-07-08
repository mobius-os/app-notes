// P1 silent-data-loss regression guard: a two-device same-line merge conflict
// drops THEIRS's body from the note file (mergeNoteDocs keeps only MINE's body)
// — the losing side survives ONLY in the conflict descriptor at
// conflicts/<id>/<hashes>.json, which is the sole input to the "Resolve now" /
// manual resolver. So the descriptor write must be durable-or-loud:
//
//   1. store.writeConflict uses durableWrite (REJECTS on a fatal dead-letter),
//      NOT the legacy set() that LIES ({synced:true} while persisting nothing).
//   2. The unified onConflict contract is { base, mine, theirs } at BOTH writers
//      (the open-editor liveDoc via makeMergeNote, and the collection's update
//      for closed notes), so a single handler builds + durably persists the one
//      descriptor — the handler never receives an already-built descriptor it
//      would mis-handle (the old closed-note bug that silently dropped it).
//   3. On a dead-lettered descriptor write the note STAYS flagged conflicted and
//      a visible error surfaces — never a swallowed false success.
//
// This drives the REAL store.writeConflict, conflictDescriptorFor, and
// collection.update sides-forwarding against the storage mock that faithfully
// models the runtime's set()-lies / durableWrite()-rejects contract. The handler
// here mirrors app.jsx's onConflict EXACTLY (build descriptor -> writeConflict ->
// on reject: keep flagged + surface error) so the integration the component runs
// is exercised end-to-end without mounting the heavy editor bundle.

import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = webcrypto
import { makeMockStorage, DurableWriteError } from './mobius-storage-mock.mjs'
import { makeNoteCollection } from '../src/lib/collection.js'
import { writeConflict } from '../src/lib/store.js'
import { conflictDescriptorFor, notePath } from '../src/lib/note-doc.js'
import { contentHash } from '../src/lib/note.js'

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = { mobius: { storage: harness.storage, online: true, signal() {} } }
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev })
}

const note = (id, body, extra = {}) => ({ meta: { id, title: '', ...extra }, body })

// The app.jsx onConflict handler, replicated in shape: flag the note, build the
// ONE descriptor from { base, mine, theirs }, durably persist it, and on a fatal
// failure KEEP the note flagged + record a visible error. `flagged` and
// `saveError` stand in for the component's `conflicts` set + `saveError` state so
// the test can assert the user-visible outcome.
function makeConflictHandler(state) {
  return async (sides) => {
    const id = sides?.mine?.meta?.id ?? sides?.theirs?.meta?.id ?? sides?.base?.meta?.id
    if (id != null) state.flagged.add(id)
    try {
      const d = await conflictDescriptorFor(sides.base, sides.mine, sides.theirs, contentHash)
      if (d) await writeConflict(d.path, d)
    } catch (err) {
      if (id != null) {
        state.flagged.add(id) // STAYS flagged — never cleared on a failed persist
        state.saveError = { id, message: 'Merge conflict could not be saved for recovery — your local copy is kept.' }
      }
      state.error = err
    }
  }
}

// Force the same-line two-device conflict and run it through collection.update.
async function runConflict(h, id, { onConflict }) {
  const c = makeNoteCollection({ onConflict })
  h.seed(notePath(id), note(id, 'a\nb\nc'))
  await c.load(id) // ancestor = base
  h.seed(notePath(id), note(id, 'a\nSERVER\nc')) // their concurrent same-line edit landed
  const { value } = await c.update(id, (prev) => ({ ...prev, body: 'a\nMINE\nc' }))
  return value
}

test('(a) a conflict-descriptor write that DEAD-LETTERS surfaces an error and the note STAYS flagged (not a silent success)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const state = { flagged: new Set(), saveError: null, error: null }
    // Force the descriptor PUT to fatally dead-letter by forcing the exact
    // content-addressed path the handler will compute.
    const d = await conflictDescriptorFor(
      note('x1', 'a\nb\nc'), note('x1', 'a\nMINE\nc'), note('x1', 'a\nSERVER\nc'), contentHash,
    )
    h.forceDeadLetter(d.path, 413)

    const value = await runConflict(h, 'x1', { onConflict: makeConflictHandler(state) })

    // The note keeps MINE's body (LWW lands the local edit canonically).
    assert.equal(value.body, 'a\nMINE\nc')
    // The descriptor write was REFUSED — surfaced as an error, not a false save.
    assert.ok(state.error instanceof DurableWriteError, 'a DurableWriteError surfaced')
    assert.equal(state.error.code, 'dead_letter')
    // The note STAYS flagged conflicted so the user/agent can retry.
    assert.equal(state.flagged.has('x1'), true)
    // A visible, actionable error is set for the user.
    assert.ok(state.saveError && state.saveError.id === 'x1')
    // The descriptor never landed (the server side is NOT silently lost — the
    // failure is loud, the local copy is kept, retry is possible).
    assert.equal(h.server.has(d.path), false)
  })
})

test('(b) a QUEUED (offline) conflict-descriptor write is durable success — no error, note flagged, descriptor durably held', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const state = { flagged: new Set(), saveError: null, error: null }
    const c = makeNoteCollection({ onConflict: makeConflictHandler(state) })
    h.seed(notePath('x2'), note('x2', 'a\nb\nc'))
    await c.load('x2')
    h.seed(notePath('x2'), note('x2', 'a\nSERVER\nc'))
    // Go offline AFTER seeding/loading so the conflicting note read is fresh but
    // the descriptor write is queued.
    h.setOnline(false)
    await c.update('x2', (prev) => ({ ...prev, body: 'a\nMINE\nc' }))

    // Offline queued = durable SUCCESS: no error, no false-failure banner.
    assert.equal(state.error, null)
    assert.equal(state.saveError, null)
    assert.equal(state.flagged.has('x2'), true)
    // The descriptor is durably held in the offline overlay (drains on reconnect),
    // NOT lost — and it carries the losing SERVER body intact.
    const d = await conflictDescriptorFor(
      note('x2', 'a\nb\nc'), note('x2', 'a\nMINE\nc'), note('x2', 'a\nSERVER\nc'), contentHash,
    )
    assert.equal(h.overlay.has(d.path), true)
    assert.equal(h.overlay.get(d.path).value.server.body, 'a\nSERVER\nc')
  })
})

test('(c) unified onConflict contract: the collection forwards { base, mine, theirs } sides and the persisted descriptor keeps the losing SERVER body', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const sidesSeen = []
    const state = { flagged: new Set(), saveError: null, error: null }
    const handler = makeConflictHandler(state)
    const onConflict = async (sides) => { sidesSeen.push(sides); return handler(sides) }

    const value = await runConflict(h, 'x3', { onConflict })

    // The collection forwards raw sides (NOT a pre-built descriptor) — one shape,
    // the same one makeMergeNote passes, so a single handler builds the descriptor.
    assert.equal(sidesSeen.length, 1)
    const s = sidesSeen[0]
    assert.ok(s && s.base && s.mine && s.theirs, 'sides has { base, mine, theirs }')
    assert.equal(s.mine.body, 'a\nMINE\nc')
    assert.equal(s.theirs.body, 'a\nSERVER\nc')
    // The note file keeps only MINE — the server body would be LOST without the
    // descriptor.
    assert.equal(value.body, 'a\nMINE\nc')
    // The descriptor landed durably and PRESERVES the losing server body (the sole
    // surviving copy), so the resolver can recover it.
    const d = await conflictDescriptorFor(s.base, s.mine, s.theirs, contentHash)
    assert.equal(h.server.has(d.path), true)
    assert.equal(h.server.get(d.path).value.server.body, 'a\nSERVER\nc')
    assert.equal(h.server.get(d.path).value.mine.body, 'a\nMINE\nc')
    assert.equal(state.error, null)
  })
})

test('(d) store.writeConflict REJECTS on a dead-letter (the legacy set() lie is gone)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    const path = 'conflicts/z1/aa.bb.cc.json'
    h.forceDeadLetter(path, 413)
    await assert.rejects(
      () => writeConflict(path, { noteId: 'z1', status: 'open' }),
      (e) => e instanceof DurableWriteError && e.code === 'dead_letter',
    )
    // Nothing persisted — the refusal is loud, never a silent false-save.
    assert.equal(h.server.has(path), false)
  })
})
