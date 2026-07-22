import { test } from 'node:test'
import assert from 'node:assert'
import { notePath, legacyPath } from '../src/lib/note-doc.js'

test('note paths keep the canonical JSON and legacy Markdown locations stable', () => {
  assert.equal(notePath('abc'), 'notes/abc.json')
  assert.equal(legacyPath('abc'), 'notes/abc.md')
})
