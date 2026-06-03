import {test} from 'node:test'
import assert from 'node:assert'
import {sha256Hex} from '../src/lib/hash.js'
import {contentHash, newNote, bumpRev} from '../src/lib/note.js'

// ---------------------------------------------------------------------------
// hash.js — sha256Hex
// ---------------------------------------------------------------------------

test('sha256Hex returns the known SHA-256 hex digest', async () => {
  // Reference vector: sha256("abc")
  const h = await sha256Hex('abc')
  assert.equal(h, 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
})

test('sha256Hex of empty string is the canonical empty digest', async () => {
  const h = await sha256Hex('')
  assert.equal(h, 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
})

// ---------------------------------------------------------------------------
// note.js — contentHash (stable / volatility)
// ---------------------------------------------------------------------------

test('contentHash is stable across meta key reordering', async () => {
  const a = await contentHash({title: 'Hi', pinned: true, color: 'violet', tags: ['x', 'y']}, 'body')
  const b = await contentHash({tags: ['x', 'y'], color: 'violet', pinned: true, title: 'Hi'}, 'body')
  assert.equal(a, b)
})

test('contentHash ignores volatile fields (updated, content_hash, mobius_rev)', async () => {
  const base = {title: 'T', pinned: false, color: null, tags: []}
  const withVolatile = {
    ...base,
    updated: '2026-06-03T10:00:00Z',
    content_hash: 'deadbeef',
    mobius_rev: 99,
    parent_rev: 98,
    created: '2026-06-03T09:00:00Z',
    id: 'some-uuid',
  }
  const a = await contentHash(base, 'body')
  const b = await contentHash(withVolatile, 'body')
  assert.equal(a, b)
})

test('contentHash changes when body changes', async () => {
  const meta = {title: 'T', pinned: false, color: null, tags: []}
  const a = await contentHash(meta, 'body one')
  const b = await contentHash(meta, 'body two')
  assert.notEqual(a, b)
})

test('contentHash changes when title changes', async () => {
  const a = await contentHash({title: 'A', pinned: false, color: null, tags: []}, 'body')
  const b = await contentHash({title: 'B', pinned: false, color: null, tags: []}, 'body')
  assert.notEqual(a, b)
})

test('contentHash changes when pinned/color/tags change', async () => {
  const m = {title: 'T', pinned: false, color: null, tags: []}
  const pin = await contentHash({...m, pinned: true}, 'b')
  const col = await contentHash({...m, color: 'violet'}, 'b')
  const tag = await contentHash({...m, tags: ['x']}, 'b')
  const base = await contentHash(m, 'b')
  assert.notEqual(base, pin)
  assert.notEqual(base, col)
  assert.notEqual(base, tag)
})

test('contentHash is order-insensitive within tags only by value, not reordering meaning', async () => {
  // tags are a set semantically but the hash includes them as given;
  // here we assert identical tag arrays hash identically.
  const a = await contentHash({title: 'T', pinned: false, color: null, tags: ['a', 'b']}, 'x')
  const b = await contentHash({title: 'T', pinned: false, color: null, tags: ['a', 'b']}, 'x')
  assert.equal(a, b)
})

test('contentHash returns a 64-char hex string', async () => {
  const h = await contentHash({title: 'T', tags: []}, 'body')
  assert.match(h, /^[0-9a-f]{64}$/)
})

// ---------------------------------------------------------------------------
// note.js — newNote
// ---------------------------------------------------------------------------

test('newNote returns a fresh meta with sane defaults', () => {
  const m = newNote({title: 'Weekend list'})
  assert.equal(m.title, 'Weekend list')
  assert.match(m.id, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/)
  assert.equal(m.mobius_rev, 1)
  assert.equal(m.parent_rev, 0)
  assert.equal(m.pinned, false)
  assert.equal(m.color, null)
  assert.deepEqual(m.tags, [])
  assert.deepEqual(m.attachments, [])
  // created/updated are ISO strings and start equal
  assert.match(m.created, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  assert.match(m.updated, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  assert.equal(m.created, m.updated)
})

test('newNote gives each note a distinct id', () => {
  const a = newNote({title: 'a'})
  const b = newNote({title: 'b'})
  assert.notEqual(a.id, b.id)
})

test('newNote defaults title to empty string when omitted', () => {
  const m = newNote({})
  assert.equal(m.title, '')
  const m2 = newNote()
  assert.equal(m2.title, '')
})

test('newNote does not share array references between notes', () => {
  const a = newNote({title: 'a'})
  const b = newNote({title: 'b'})
  a.tags.push('x')
  a.attachments.push('y')
  assert.deepEqual(b.tags, [])
  assert.deepEqual(b.attachments, [])
})

// ---------------------------------------------------------------------------
// note.js — bumpRev
// ---------------------------------------------------------------------------

test('bumpRev increments mobius_rev and sets parent_rev to the old rev', () => {
  const m = newNote({title: 't'}) // rev 1, parent 0
  const next = bumpRev(m)
  assert.equal(next.mobius_rev, 2)
  assert.equal(next.parent_rev, 1)
})

test('bumpRev refreshes updated (>= original) and preserves created', async () => {
  const m = newNote({title: 't'})
  m.updated = '2000-01-01T00:00:00.000Z'
  const next = bumpRev(m)
  assert.notEqual(next.updated, '2000-01-01T00:00:00.000Z')
  assert.match(next.updated, /^\d{4}-\d{2}-\d{2}T/)
  assert.equal(next.created, m.created)
})

test('bumpRev does not mutate the input meta', () => {
  const m = newNote({title: 't'})
  const before = {...m}
  bumpRev(m)
  assert.equal(m.mobius_rev, before.mobius_rev)
  assert.equal(m.parent_rev, before.parent_rev)
})

test('bumpRev chains correctly across multiple bumps', () => {
  let m = newNote({title: 't'}) // rev 1, parent 0
  m = bumpRev(m) // rev 2, parent 1
  m = bumpRev(m) // rev 3, parent 2
  assert.equal(m.mobius_rev, 3)
  assert.equal(m.parent_rev, 2)
})
