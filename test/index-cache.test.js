import {test} from 'node:test'
import assert from 'node:assert'
import {buildIndex, rebuildFromFiles} from '../src/lib/index-cache.js'

const note = (meta, body) => ({meta, body})

test('buildIndex returns one entry per note with the projected fields', () => {
  const {notes} = buildIndex([
    note({id: 'a', title: 'Alpha', pinned: false, color: 'violet', updated: '2026-06-03T10:00:00Z'}, 'hello'),
  ])
  assert.equal(notes.length, 1)
  assert.deepEqual(Object.keys(notes[0]).sort(), ['color', 'id', 'pinned', 'snippet', 'title', 'updated'])
  assert.equal(notes[0].id, 'a')
  assert.equal(notes[0].title, 'Alpha')
  assert.equal(notes[0].color, 'violet')
  assert.equal(notes[0].pinned, false)
  assert.equal(notes[0].updated, '2026-06-03T10:00:00Z')
  assert.equal(notes[0].snippet, 'hello')
})

test('buildIndex sorts pinned-first, then updated descending', () => {
  const {notes} = buildIndex([
    note({id: 'old-unpinned', title: 'OU', pinned: false, updated: '2026-06-01T00:00:00Z'}, ''),
    note({id: 'new-unpinned', title: 'NU', pinned: false, updated: '2026-06-03T00:00:00Z'}, ''),
    note({id: 'old-pinned', title: 'OP', pinned: true, updated: '2026-06-01T00:00:00Z'}, ''),
    note({id: 'new-pinned', title: 'NP', pinned: true, updated: '2026-06-03T00:00:00Z'}, ''),
  ])
  assert.deepEqual(
    notes.map((n) => n.id),
    ['new-pinned', 'old-pinned', 'new-unpinned', 'old-unpinned'],
  )
})

test('buildIndex does not mutate the input order', () => {
  const input = [
    note({id: 'a', pinned: false, updated: '2026-06-01T00:00:00Z'}, ''),
    note({id: 'b', pinned: true, updated: '2026-06-02T00:00:00Z'}, ''),
  ]
  const snapshot = input.map((n) => n.meta.id)
  buildIndex(input)
  assert.deepEqual(input.map((n) => n.meta.id), snapshot)
})

test('snippet takes the first ~140 chars of body', () => {
  const long = 'x'.repeat(400)
  const {notes} = buildIndex([note({id: 'a', updated: '2026-06-03T00:00:00Z'}, long)])
  assert.ok(notes[0].snippet.length <= 141, `snippet too long: ${notes[0].snippet.length}`)
  assert.ok(notes[0].snippet.startsWith('x'))
})

test('snippet strips common markdown markers', () => {
  const body = '# Heading\n**bold** _italic_ `code` ~~strike~~\n- list item\n> quote\n[link](http://x)'
  const {notes} = buildIndex([note({id: 'a', updated: '2026-06-03T00:00:00Z'}, body)])
  const s = notes[0].snippet
  assert.ok(!s.includes('#'), `has #: ${s}`)
  assert.ok(!s.includes('**'), `has **: ${s}`)
  assert.ok(!s.includes('`'), `has backtick: ${s}`)
  assert.ok(!s.includes('~~'), `has ~~: ${s}`)
  assert.ok(!s.includes('>'), `has >: ${s}`)
  assert.ok(!s.includes('[') && !s.includes(']'), `has link brackets: ${s}`)
  assert.ok(s.includes('Heading'))
  assert.ok(s.includes('bold'))
  assert.ok(s.includes('italic'))
  assert.ok(s.includes('link'))
})

test('snippet collapses whitespace/newlines to single spaces', () => {
  const {notes} = buildIndex([note({id: 'a', updated: '2026-06-03T00:00:00Z'}, 'line one\n\nline two')])
  assert.equal(notes[0].snippet, 'line one line two')
})

test('missing optional meta fields default sensibly', () => {
  const {notes} = buildIndex([note({id: 'a'}, 'body')])
  assert.equal(notes[0].title, '')
  assert.equal(notes[0].pinned, false)
  assert.equal(notes[0].color, null)
  // updated may be undefined; entry should still build.
  assert.equal(notes[0].id, 'a')
})

test('image-only body yields the alt text, not the url', () => {
  const {notes} = buildIndex([note({id: 'a', updated: '2026-06-03T00:00:00Z'}, '![receipt](attachments/ab.jpg)')])
  assert.ok(!notes[0].snippet.includes('attachments/'))
  assert.ok(notes[0].snippet.includes('receipt'))
})

test('rebuildFromFiles is pure and produces the same shape as buildIndex', () => {
  const files = [
    note({id: 'a', title: 'A', pinned: true, updated: '2026-06-03T00:00:00Z'}, 'aaa'),
    note({id: 'b', title: 'B', pinned: false, updated: '2026-06-02T00:00:00Z'}, 'bbb'),
  ]
  const a = rebuildFromFiles(files)
  const b = buildIndex(files)
  assert.deepEqual(a, b)
  // Pure: calling again gives a deep-equal result.
  assert.deepEqual(rebuildFromFiles(files), a)
})

test('empty input produces an empty index', () => {
  assert.deepEqual(buildIndex([]), {notes: []})
  assert.deepEqual(rebuildFromFiles([]), {notes: []})
})
