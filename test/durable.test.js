// The durability predicate gates whether a resolved storage write may be
// reported as a save. A non-durable RESOLVE (not just a rejection) must read as
// failure so commitDraft keeps the draft + surfaces a retry instead of clearing
// the buffer and emitting note_saved for a write that never landed.
import {test} from 'node:test'
import assert from 'node:assert'
import {isDurableWrite} from '../src/lib/durable.js'

test('synced or queued results are durable', () => {
  assert.equal(isDurableWrite({synced: true}), true)
  assert.equal(isDurableWrite({queued: true}), true)
  // Either flag is sufficient; extra fields don't change the verdict.
  assert.equal(isDurableWrite({synced: true, queued: false}), true)
  assert.equal(isDurableWrite({queued: true, synced: false}), true)
})

test('a resolved non-durable result is NOT durable (the bug this fix closes)', () => {
  // The exact shapes commitDraft used to treat as success: a resolve that
  // carries no proof the bytes landed.
  assert.equal(isDurableWrite({synced: false}), false)
  assert.equal(isDurableWrite({queued: false}), false)
  assert.equal(isDurableWrite({ok: false}), false)
  assert.equal(isDurableWrite({error: true}), false)
  assert.equal(isDurableWrite({}), false)
})

test('missing / malformed results are NOT durable', () => {
  assert.equal(isDurableWrite(null), false)
  assert.equal(isDurableWrite(undefined), false)
  assert.equal(isDurableWrite(false), false)
  // Truthy-but-non-flag values (e.g. an unexpected string/number) are not proof.
  assert.equal(isDurableWrite('ok'), false)
  assert.equal(isDurableWrite(1), false)
  // Truthiness alone must not pass — only the explicit boolean flags do.
  assert.equal(isDurableWrite({synced: 'yes'}), false)
  assert.equal(isDurableWrite({queued: 1}), false)
})
