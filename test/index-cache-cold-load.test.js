import { test } from 'node:test'
import assert from 'node:assert'
import { buildIndex, notesFromIndex } from '../src/lib/index-cache.js'

test('notesFromIndex reconstitutes placeholder notes for a cold-load paint (notes-4)', () => {
  const index = buildIndex([
    { meta: { id: 'a', title: 'Alpha', pinned: true, color: 'sky', updated: '2026-01-02' }, body: 'hello world' },
    { meta: { id: 'b', title: 'Beta', updated: '2026-01-01' }, body: '' },
  ])
  const notes = notesFromIndex(index)
  assert.equal(notes.length, 2)
  const a = notes.find((n) => n.meta.id === 'a')
  assert.equal(a.meta.title, 'Alpha')
  assert.equal(a.meta.pinned, true)
  assert.equal(a.meta.color, 'sky')
  assert.equal(a.body, 'hello world') // snippet stands in as preview body
})

test('notesFromIndex tolerates a missing or malformed index', () => {
  assert.deepEqual(notesFromIndex(null), [])
  assert.deepEqual(notesFromIndex({}), [])
  assert.deepEqual(notesFromIndex({ notes: 'nope' }), [])
  assert.deepEqual(notesFromIndex({ notes: [{ title: 'no id' }] }), [])
})
