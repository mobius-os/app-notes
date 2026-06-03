import { test } from 'node:test'
import assert from 'node:assert'
import { merge3, mergeMeta } from '../src/lib/merge.js'

// ---------------------------------------------------------------------------
// merge3 — 3-way body merge
// ---------------------------------------------------------------------------

test('merge3: canonical non-overlapping single-line edits merge clean', () => {
  // base 'a\nb\nc'; mine 'a\nB\nc'; theirs 'a\nb\nC' -> clean 'a\nB\nC'
  const r = merge3('a\nb\nc', 'a\nB\nc', 'a\nb\nC')
  assert.equal(r.conflict, false)
  assert.equal(r.clean, true)
  assert.equal(r.text, 'a\nB\nC')
})

test('merge3: non-overlapping block edits merge clean (both edits present)', () => {
  const base = 'one\ntwo\nthree\nfour'
  const mine = 'ONE\ntwo\nthree\nfour'
  const theirs = 'one\ntwo\nthree\nFOUR'
  const r = merge3(base, mine, theirs)
  assert.equal(r.clean, true)
  assert.equal(r.conflict, false)
  assert.equal(r.text, 'ONE\ntwo\nthree\nFOUR')
})

test('merge3: an inserted line on one side, an edit on the other, disjoint -> clean', () => {
  const base = 'a\nb\nc'
  const mine = 'a\nb\nc\nd' // append d
  const theirs = 'A\nb\nc' // change first line
  const r = merge3(base, mine, theirs)
  assert.equal(r.clean, true)
  assert.equal(r.text, 'A\nb\nc\nd')
})

test('merge3: identical edits on both sides merge clean', () => {
  const r = merge3('a\nb\nc', 'a\nZ\nc', 'a\nZ\nc')
  assert.equal(r.clean, true)
  assert.equal(r.conflict, false)
  assert.equal(r.text, 'a\nZ\nc')
})

test('merge3: edit on only one side merges clean to that side', () => {
  const r = merge3('a\nb\nc', 'a\nB\nc', 'a\nb\nc')
  assert.equal(r.clean, true)
  assert.equal(r.text, 'a\nB\nc')
})

test('merge3: both sides unchanged -> clean, equals base', () => {
  const r = merge3('a\nb\nc', 'a\nb\nc', 'a\nb\nc')
  assert.equal(r.clean, true)
  assert.equal(r.text, 'a\nb\nc')
})

test('merge3: overlapping same-line edits -> conflict, retains base/mine/theirs', () => {
  const r = merge3('a\nb\nc', 'a\nX\nc', 'a\nY\nc')
  assert.equal(r.conflict, true)
  assert.equal(r.clean, false)
  assert.ok(Array.isArray(r.hunks))
  // The conflict hunk retains all three sides for the agent resolver.
  const conflictHunk = r.hunks.find((h) => h.conflict)
  assert.ok(conflictHunk, 'expected a conflict hunk')
  assert.deepEqual(conflictHunk.base, ['b'])
  assert.deepEqual(conflictHunk.mine, ['X'])
  assert.deepEqual(conflictHunk.theirs, ['Y'])
})

test('merge3: multi-line overlapping conflict retains all three regions', () => {
  const base = 'head\nb1\nb2\ntail'
  const mine = 'head\nm1\nm2\ntail'
  const theirs = 'head\nt1\nt2\ntail'
  const r = merge3(base, mine, theirs)
  assert.equal(r.conflict, true)
  const c = r.hunks.find((h) => h.conflict)
  assert.deepEqual(c.base, ['b1', 'b2'])
  assert.deepEqual(c.mine, ['m1', 'm2'])
  assert.deepEqual(c.theirs, ['t1', 't2'])
})

test('merge3: preserves trailing newline shape (no spurious blank lines)', () => {
  const r = merge3('a\nb', 'a\nB', 'a\nb')
  assert.equal(r.text, 'a\nB')
})

// ---------------------------------------------------------------------------
// mergeMeta — frontmatter field merge
// ---------------------------------------------------------------------------

test('mergeMeta: unions tags from both sides', () => {
  const base = { id: 'n1', created: 'C', tags: ['a'], mobius_rev: 5 }
  const mine = { id: 'n1', created: 'C', tags: ['a', 'b'], mobius_rev: 5, updated: '2026-06-03T10:00:00Z' }
  const theirs = { id: 'n1', created: 'C', tags: ['a', 'c'], mobius_rev: 6, updated: '2026-06-03T09:00:00Z' }
  const m = mergeMeta(base, mine, theirs)
  assert.deepEqual([...m.tags].sort(), ['a', 'b', 'c'])
})

test('mergeMeta: later-updated side wins title/color/pinned', () => {
  const base = { id: 'n1', created: 'C', mobius_rev: 1 }
  const mine = {
    id: 'n1', created: 'C', mobius_rev: 2, updated: '2026-06-03T12:00:00Z',
    title: 'Mine', color: 'violet', pinned: true,
  }
  const theirs = {
    id: 'n1', created: 'C', mobius_rev: 3, updated: '2026-06-03T08:00:00Z',
    title: 'Theirs', color: 'green', pinned: false,
  }
  const m = mergeMeta(base, mine, theirs)
  // mine.updated is later -> mine's title/color/pinned win
  assert.equal(m.title, 'Mine')
  assert.equal(m.color, 'violet')
  assert.equal(m.pinned, true)
})

test('mergeMeta: theirs later wins title/color/pinned', () => {
  const base = { id: 'n1', created: 'C', mobius_rev: 1 }
  const mine = {
    id: 'n1', created: 'C', mobius_rev: 2, updated: '2026-06-03T08:00:00Z',
    title: 'Mine', color: 'violet', pinned: true,
  }
  const theirs = {
    id: 'n1', created: 'C', mobius_rev: 3, updated: '2026-06-03T12:00:00Z',
    title: 'Theirs', color: 'green', pinned: false,
  }
  const m = mergeMeta(base, mine, theirs)
  assert.equal(m.title, 'Theirs')
  assert.equal(m.color, 'green')
  assert.equal(m.pinned, false)
})

test('mergeMeta: mobius_rev = max(mine,theirs)+1; parent_revs=[mine,theirs]', () => {
  const base = { id: 'n1', created: 'C', mobius_rev: 4 }
  const mine = { id: 'n1', created: 'C', mobius_rev: 6, updated: 'x' }
  const theirs = { id: 'n1', created: 'C', mobius_rev: 9, updated: 'y' }
  const m = mergeMeta(base, mine, theirs)
  assert.equal(m.mobius_rev, 10)
  assert.deepEqual(m.parent_revs, [6, 9])
})

test('mergeMeta: keeps id and created from base', () => {
  const base = { id: 'base-id', created: '2020-01-01T00:00:00Z', mobius_rev: 1 }
  const mine = { id: 'changed', created: '2099-01-01T00:00:00Z', mobius_rev: 2, updated: 'x' }
  const theirs = { id: 'other', created: '2098-01-01T00:00:00Z', mobius_rev: 3, updated: 'y' }
  const m = mergeMeta(base, mine, theirs)
  assert.equal(m.id, 'base-id')
  assert.equal(m.created, '2020-01-01T00:00:00Z')
})

test('mergeMeta: handles missing tags gracefully (empty union)', () => {
  const base = { id: 'n1', created: 'C', mobius_rev: 1 }
  const mine = { id: 'n1', created: 'C', mobius_rev: 1, updated: 'x' }
  const theirs = { id: 'n1', created: 'C', mobius_rev: 1, updated: 'y' }
  const m = mergeMeta(base, mine, theirs)
  assert.deepEqual(m.tags, [])
})
