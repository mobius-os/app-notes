import { test } from 'node:test'
import assert from 'node:assert'
import { reconcile } from '../src/lib/sync.js'

// Helpers to build the {meta, body, hash} triples reconcile() consumes. Hashes
// are PRECOMPUTED by the caller in the real app; here we inject explicit values
// so the module stays pure and independent of hash.js / note.js.
function side(meta, body, hash) {
  return { meta, body, hash }
}

const NOTE_ID = '9f3c-note'

// ---------------------------------------------------------------------------
// noop
// ---------------------------------------------------------------------------

test('reconcile: noop when mine.hash === server.hash', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nb', 'H_BASE')
  const mine = side({ id: NOTE_ID, mobius_rev: 6 }, 'a\nB', 'H_SAME')
  const server = side({ id: NOTE_ID, mobius_rev: 6 }, 'a\nB', 'H_SAME')
  assert.deepEqual(reconcile({ base, mine, server }), { action: 'noop' })
})

// ---------------------------------------------------------------------------
// fast-forward
// ---------------------------------------------------------------------------

test('reconcile: fast-forward when server unchanged (server.hash === base.hash)', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nb', 'H_BASE')
  const mine = side(
    { id: NOTE_ID, mobius_rev: 6, title: 'Mine', tags: ['x'] },
    'a\nB',
    'H_MINE',
  )
  const server = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nb', 'H_BASE')
  const r = reconcile({ base, mine, server })
  assert.equal(r.action, 'fast-forward')
  // note is mine, body unchanged, meta rev bumped off base rev.
  assert.equal(r.note.body, 'a\nB')
  assert.equal(r.note.meta.parent_rev, 5)
  assert.equal(r.note.meta.mobius_rev, 6)
  // mine's other fields preserved.
  assert.equal(r.note.meta.title, 'Mine')
  assert.deepEqual(r.note.meta.tags, ['x'])
})

// ---------------------------------------------------------------------------
// merged
// ---------------------------------------------------------------------------

test('reconcile: merged when both bodies changed but merge is clean', () => {
  // Canonical disjoint edit: base a/b/c, mine edits line 2, server edits line 3.
  const base = side(
    { id: NOTE_ID, mobius_rev: 4, created: 'C', tags: ['base'] },
    'a\nb\nc',
    'H_BASE',
  )
  const mine = side(
    { id: NOTE_ID, mobius_rev: 5, created: 'C', tags: ['mine'], updated: '2026-06-03T10:00:00Z' },
    'a\nB\nc',
    'H_MINE',
  )
  const server = side(
    { id: NOTE_ID, mobius_rev: 6, created: 'C', tags: ['srv'], updated: '2026-06-03T09:00:00Z' },
    'a\nb\nC',
    'H_SERVER',
  )
  const r = reconcile({ base, mine, server })
  assert.equal(r.action, 'merged')
  assert.equal(r.note.body, 'a\nB\nC')
  // mergeMeta unions MINE + SERVER tags (not base); rev bumped, id/created from base.
  assert.deepEqual([...r.note.meta.tags].sort(), ['mine', 'srv'])
  assert.equal(r.note.meta.id, NOTE_ID)
  assert.equal(r.note.meta.created, 'C')
  assert.equal(r.note.meta.mobius_rev, 7)
  assert.deepEqual(r.note.meta.parent_revs, [5, 6])
})

// ---------------------------------------------------------------------------
// conflict
// ---------------------------------------------------------------------------

test('reconcile: conflict when bodies overlap on the same line', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb\nc', 'H_BASE')
  const mine = side(
    { id: NOTE_ID, mobius_rev: 5, attachments: ['sha-m'] },
    'a\nX\nc',
    'H_MINE',
  )
  const server = side(
    { id: NOTE_ID, mobius_rev: 6, attachments: ['sha-s'] },
    'a\nY\nc',
    'H_SERVER',
  )
  const r = reconcile({ base, mine, server })
  assert.equal(r.action, 'conflict')
  const d = r.descriptor
  assert.equal(d.noteId, NOTE_ID)
  assert.equal(d.baseHash, 'H_BASE')
  assert.equal(d.mineHash, 'H_MINE')
  assert.equal(d.serverHash, 'H_SERVER')
  assert.equal(d.status, 'open')
  // Full sides retained for the agent resolver.
  assert.deepEqual(d.base, base)
  assert.deepEqual(d.mine, mine)
  assert.deepEqual(d.server, server)
  // Attachment ref sets carried for both sides.
  assert.deepEqual(d.attachmentsMine, ['sha-m'])
  assert.deepEqual(d.attachmentsServer, ['sha-s'])
  // Descriptor path is content-addressed by the three hashes.
  assert.equal(
    d.path,
    `conflicts/${NOTE_ID}/H_BASE.H_MINE.H_SERVER.json`,
  )
})

test('reconcile: missing attachment arrays default to empty', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb\nc', 'H_BASE')
  const mine = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nX\nc', 'H_MINE')
  const server = side({ id: NOTE_ID, mobius_rev: 6 }, 'a\nY\nc', 'H_SERVER')
  const r = reconcile({ base, mine, server })
  assert.equal(r.action, 'conflict')
  assert.deepEqual(r.descriptor.attachmentsMine, [])
  assert.deepEqual(r.descriptor.attachmentsServer, [])
})

// ---------------------------------------------------------------------------
// deletion edge cases
// ---------------------------------------------------------------------------

test('reconcile: server deleted (null) while mine edited -> conflict', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4, attachments: ['sha-m'] }, 'a\nb', 'H_BASE')
  const mine = side({ id: NOTE_ID, mobius_rev: 5, attachments: ['sha-m'] }, 'a\nB', 'H_MINE')
  const r = reconcile({ base, mine, server: null })
  assert.equal(r.action, 'conflict')
  assert.equal(r.descriptor.noteId, NOTE_ID)
  assert.equal(r.descriptor.server, null)
  assert.equal(r.descriptor.serverHash, null)
  assert.equal(r.descriptor.status, 'open')
  assert.deepEqual(r.descriptor.attachmentsServer, [])
  // Path still content-addresses with a null server-hash slot.
  assert.equal(r.descriptor.path, `conflicts/${NOTE_ID}/H_BASE.H_MINE.null.json`)
})

test('reconcile: both deleted (mine null and server null) -> noop', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb', 'H_BASE')
  const r = reconcile({ base, mine: null, server: null })
  assert.deepEqual(r, { action: 'noop' })
})

test('reconcile: mine deleted and server unchanged -> delete', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb', 'H_BASE')
  const server = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb', 'H_BASE')
  const r = reconcile({ base, mine: null, server })
  assert.deepEqual(r, { action: 'delete' })
})

test('reconcile: mine deleted but server moved -> conflict', () => {
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a\nb', 'H_BASE')
  const server = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nB', 'H_SERVER')
  const r = reconcile({ base, mine: null, server })
  assert.equal(r.action, 'conflict')
  assert.equal(r.descriptor.mine, null)
  assert.equal(r.descriptor.mineHash, null)
})

// ---------------------------------------------------------------------------
// brand-new note create (no base ancestor, absent on server)
// ---------------------------------------------------------------------------

test('reconcile: never-synced local note absent on server -> fast-forward CREATE (not conflict)', () => {
  // A draft whose direct canonical write was non-durable is recorded with a null
  // base. With no server ancestor it is a clean create as rev 1 — distinct from a
  // server-DELETED-while-edited divergence, which always carries a real base.
  const mine = side({ id: NOTE_ID, title: 'New' }, 'hello world', 'H_NEW')
  const r = reconcile({ base: null, mine, server: null })
  assert.equal(r.action, 'fast-forward')
  assert.equal(r.note.body, 'hello world')
  assert.equal(r.note.meta.mobius_rev, 1)
  assert.equal(r.note.meta.parent_rev, 0)
  assert.equal(r.note.meta.id, NOTE_ID)
})

test('reconcile: a note WITH a base that is server-null is still a conflict (server delete)', () => {
  // Regression guard: the create branch must gate on base==null only.
  const base = side({ id: NOTE_ID, mobius_rev: 4 }, 'a', 'H_BASE')
  const mine = side({ id: NOTE_ID, mobius_rev: 5 }, 'a\nb', 'H_MINE')
  const r = reconcile({ base, mine, server: null })
  assert.equal(r.action, 'conflict')
})
