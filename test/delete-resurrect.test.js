import { test } from 'node:test'
import assert from 'node:assert'
import { makeMockStorage } from './mobius-storage-mock.mjs'
import { migrateLegacyNotes } from '../src/lib/migrate.js'
import { makeNoteCollection } from '../src/lib/collection.js'
import { notePath } from '../src/lib/note-doc.js'
import { serializeNote } from '../src/lib/frontmatter.js'

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = { mobius: { storage: harness.storage, online: true, signal() {} } }
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev })
}

// Regression: deleting a note must not resurrect it from a leftover legacy .md.
// A note that carries BOTH a migrated .json AND a dormant legacy .md (the
// "already" migration path deliberately keeps the .md) used to reappear on the
// next load: remove() dropped only the .json, and migrateLegacyNotes re-created
// it from the .md — "images deleted but the note keeps showing up".
test('deleted note does NOT resurrect from a leftover legacy .md on reload', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/x.md', serializeNote({ id: 'x', title: 'T' }, 'body'), 'text')
    h.seed(notePath('x'), { meta: { id: 'x', title: 'T' }, body: 'body' }, 'json')
    assert.deepEqual(await migrateLegacyNotes(), [['x', 'already']])
    assert.equal(h.server.has('notes/x.md'), true) // dormant .md kept by "already"

    const coll = makeNoteCollection()
    await coll.remove('x')
    assert.equal(h.server.has(notePath('x')), false) // .json removed

    await migrateLegacyNotes() // reload's startup migration

    assert.equal(h.server.has(notePath('x')), false, 'deleted note resurrected from legacy .md')
    const listed = await makeNoteCollection().list()
    assert.equal(listed.find((n) => n.meta.id === 'x'), undefined, 'deleted note reappeared in the list')
  })
})
