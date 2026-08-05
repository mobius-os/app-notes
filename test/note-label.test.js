import { test } from 'node:test'
import assert from 'node:assert'
import { firstMeaningfulLine, noteDisplayName, noteOpenLabel } from '../src/lib/note-label.js'

test('first meaningful line strips common markdown without losing its meaning', () => {
  assert.equal(firstMeaningfulLine('\n- [ ] Buy **oat milk**\nLater'), 'Buy oat milk')
  assert.equal(firstMeaningfulLine('![Beach photo](attachments/abc.jpeg)'), 'Beach photo')
  assert.equal(firstMeaningfulLine('## A linked [idea](https://example.com)'), 'A linked idea')
})

test('untitled note labels expose distinguishing content and date', () => {
  assert.equal(
    noteOpenLabel({ type: 'note' }, 'A useful first line\nMore', 'Aug 4'),
    'Open untitled note: A useful first line, Aug 4',
  )
  assert.equal(noteOpenLabel({ type: 'checklist' }, '', 'Aug 4'), 'Open untitled note: Empty checklist, Aug 4')
})

test('display names prefer explicit titles and fall back without mutating note data', () => {
  assert.equal(noteDisplayName({ title: 'Weekend', type: 'note' }, 'ignored'), 'Weekend')
  assert.equal(noteDisplayName({ type: 'checklist' }, ''), 'Untitled checklist')
})
