import {test} from 'node:test'
import assert from 'node:assert'
import {parseFrontmatter, serializeNote} from '../src/lib/frontmatter.js'

test('round-trips frontmatter + body', () => {
  const md = '---\nid: abc\ntitle: Hi\npinned: true\ntags: [a, b]\n---\n# Body\ntext'
  const {meta, body} = parseFrontmatter(md)
  assert.equal(meta.id, 'abc')
  assert.equal(meta.title, 'Hi')
  assert.equal(meta.pinned, true)
  assert.deepEqual(meta.tags, ['a', 'b'])
  assert.equal(body, '# Body\ntext')
  const out = serializeNote(meta, body)
  assert.deepEqual(parseFrontmatter(out).meta, meta)
})

test('no frontmatter → empty meta, body intact', () => {
  const {meta, body} = parseFrontmatter('just text')
  assert.deepEqual(meta, {})
  assert.equal(body, 'just text')
})

test('parses booleans, null, numbers, and ISO date strings', () => {
  const md = [
    '---',
    'pinned: false',
    'color: null',
    'mobius_rev: 7',
    'parent_rev: 0',
    'created: 2026-06-03T09:00:00Z',
    '---',
    'body',
  ].join('\n')
  const {meta} = parseFrontmatter(md)
  assert.equal(meta.pinned, false)
  assert.equal(meta.color, null)
  assert.equal(meta.mobius_rev, 7)
  assert.equal(meta.parent_rev, 0)
  // ISO date strings stay strings (not Date objects)
  assert.equal(meta.created, '2026-06-03T09:00:00Z')
})

test('empty flow array parses to []', () => {
  const {meta} = parseFrontmatter('---\ntags: []\n---\nbody')
  assert.deepEqual(meta.tags, [])
})

test('serialize emits keys in a stable order regardless of insertion order', () => {
  const a = serializeNote({id: 'x', title: 'T', pinned: true, tags: ['z']}, 'body')
  const b = serializeNote({tags: ['z'], pinned: true, title: 'T', id: 'x'}, 'body')
  assert.equal(a, b)
})

test('serialize → parse preserves value types', () => {
  const meta = {
    id: 'abc',
    title: 'Quoted: value, with commas',
    pinned: false,
    color: null,
    tags: ['home', 'shopping'],
    mobius_rev: 3,
    created: '2026-06-03T09:00:00Z',
  }
  const out = serializeNote(meta, 'line1\nline2')
  const round = parseFrontmatter(out)
  assert.deepEqual(round.meta, meta)
  assert.equal(round.body, 'line1\nline2')
})

test('body with a leading --- is not mistaken for frontmatter close', () => {
  const md = '---\nid: a\n---\nintro\n\n---\n\noutro'
  const {meta, body} = parseFrontmatter(md)
  assert.equal(meta.id, 'a')
  assert.equal(body, 'intro\n\n---\n\noutro')
})
