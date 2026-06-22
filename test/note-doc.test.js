import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto
import { mergeNoteDocs, conflictDescriptorFor, buildConflictDescriptor, notePath, docId } from '../src/lib/note-doc.js'
import { contentHash } from '../src/lib/note.js'

// mergeNoteDocs is the pure 3-way merge useDocument calls in 'lww' mode. It wraps
// merge3/mergeMeta (preserved verbatim in merge.js) and ALWAYS returns a merged
// value; a real overlapping-body conflict sets { conflict:true } and keeps MINE.

const note = (id, body, extra = {}) => ({ meta: { id, title: '', ...extra }, body })

test('notePath / docId derive the per-note JSON path and id', () => {
  assert.equal(notePath('abc'), 'notes/abc.json')
  assert.equal(docId(note('abc', 'x')), 'abc')
  assert.equal(docId(null), undefined)
})

test('mergeNoteDocs: first write (server absent) returns mine unchanged', () => {
  const mine = note('a', 'hello')
  assert.deepEqual(mergeNoteDocs(null, mine, null), { value: mine, conflict: false })
})

test('mergeNoteDocs: non-overlapping concurrent body edits merge clean (no conflict)', () => {
  const base = note('a', 'one\ntwo\nthree')
  const mine = note('a', 'ONE\ntwo\nthree')   // edited line 1
  const theirs = note('a', 'one\ntwo\nTHREE') // edited line 3
  const { value, conflict } = mergeNoteDocs(base, mine, theirs)
  assert.equal(value.body, 'ONE\ntwo\nTHREE')
  assert.equal(conflict, false)
})

test('mergeNoteDocs: overlapping same-line edits -> keeps MINE (no lost edit), flags conflict', async () => {
  const base = note('a', 'a\nb\nc')
  const mine = note('a', 'a\nX\nc')
  const theirs = note('a', 'a\nY\nc')
  const { value, conflict } = mergeNoteDocs(base, mine, theirs)
  // LWW: the local edit is NEVER lost — mine's body lands canonically.
  assert.equal(value.body, 'a\nX\nc')
  assert.equal(conflict, true)
  // The caller (collection) builds the descriptor from the same sides.
  const d = await conflictDescriptorFor(base, mine, theirs, contentHash)
  assert.equal(d.noteId, 'a')
  assert.equal(d.status, 'open')
  assert.deepEqual(d.mine.body, 'a\nX\nc')
  assert.deepEqual(d.server.body, 'a\nY\nc')
  assert.ok(d.path.startsWith('conflicts/a/'))
  assert.ok(d.path.endsWith('.json'))
})

test('mergeNoteDocs: fast-forward (server == base in content) lands MINE verbatim, preserving stamped meta', () => {
  // The common save path: no concurrent edit, server still at our ancestor. The
  // caller's meta (content_hash, parent_rev, mobius_rev) must survive untouched —
  // mergeMeta must NOT rewrite the rev bookkeeping or drop content_hash.
  const base = note('a', 'one\ntwo', { mobius_rev: 4, created: 't0' })
  const theirs = note('a', 'one\ntwo', { mobius_rev: 4, created: 't0' }) // server unchanged
  const mine = note('a', 'one\nTWO', { mobius_rev: 5, parent_rev: 4, content_hash: 'abc', created: 't0' })
  const { value, conflict } = mergeNoteDocs(base, mine, theirs)
  assert.equal(conflict, false)
  assert.strictEqual(value, mine) // verbatim
  assert.equal(value.meta.content_hash, 'abc')
  assert.equal(value.meta.mobius_rev, 5)
  assert.equal(value.meta.parent_rev, 4)
})

test('mergeNoteDocs: server META changed (body same) does NOT fast-forward — meta 3-way merges', () => {
  // Another device pinned the note (body unchanged). Fast-forwarding mine verbatim
  // would CLOBBER that server pin; the content-identity check (not just body)
  // routes through mergeMeta instead, so the server's pin is not lost.
  const base = note('a', 'x', { mobius_rev: 4, created: 't0', pinned: false })
  const theirs = note('a', 'x', { mobius_rev: 5, created: 't0', pinned: true, updated: '2026-02-02' }) // server pinned (later)
  const mine = note('a', 'x', { mobius_rev: 5, created: 't0', updated: '2026-02-01' }) // we touched it earlier
  const { value, conflict } = mergeNoteDocs(base, mine, theirs)
  assert.equal(conflict, false)
  // Body identical -> clean merge. mergeMeta takes pinned from the later-updated
  // side (theirs), so the server's pin survives — NOT clobbered by a fast-forward.
  assert.equal(value.meta.pinned, true)
  assert.equal(value.meta.mobius_rev, 6) // mergeMeta bumped: max(5,5)+1
})

test('mergeNoteDocs: meta is 3-way merged (mergeMeta) on a clean body merge', () => {
  const base = note('a', 'x', { created: 't0', mobius_rev: 1, tags: [] })
  const mine = note('a', 'x', { created: 't0', mobius_rev: 2, pinned: true, updated: '2026-02-01' })
  const theirs = note('a', 'x', { created: 't0', mobius_rev: 2, color: 'blue', updated: '2026-01-01' })
  const { value } = mergeNoteDocs(base, mine, theirs)
  // pinned came from the later-updated side (mine); rev = max+1.
  assert.equal(value.meta.pinned, true)
  assert.equal(value.meta.mobius_rev, 3)
  assert.equal(value.meta.id, 'a')
  assert.equal(value.meta.created, 't0')
})

test('buildConflictDescriptor: content-addressed by the three hashes, carries attachments', () => {
  const d = buildConflictDescriptor({
    noteId: 'n1',
    base: note('n1', 'b'),
    mine: note('n1', 'm', { attachments: ['attachments/aa.png'] }),
    server: note('n1', 's', { attachments: ['attachments/bb.png'] }),
    hashes: { baseHash: 'bh', mineHash: 'mh', serverHash: 'sh' },
  })
  assert.equal(d.path, 'conflicts/n1/bh.mh.sh.json')
  assert.deepEqual(d.attachmentsMine, ['attachments/aa.png'])
  assert.deepEqual(d.attachmentsServer, ['attachments/bb.png'])
})
