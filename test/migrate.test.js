import { test } from 'node:test'
import assert from 'node:assert'
import { makeMockStorage } from './mobius-storage-mock.mjs'
import { migrateLegacyNotes, migrateNote } from '../src/lib/migrate.js'
import { notePath } from '../src/lib/note-doc.js'
import { serializeNote } from '../src/lib/frontmatter.js'

// The one-time legacy migration: notes/<id>.md (frontmatter-markdown) ->
// notes/<id>.json ({ meta, body }). The load-bearing invariant: a note's legacy
// .md fallback is removed ONLY ONCE its .json is provably ON THE SERVER
// (durableWrite resolved 'synced'). Never on a local get() that overlays an
// un-synced pending write, never on a 'queued' (offline) write, never by
// re-confirming a pre-existing .json (a clobber-risking re-put). A crash or a
// refused write mid-migration therefore never loses a note.

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = { mobius: { storage: harness.storage, online: true, signal() {} } }
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev })
}

const md = (id, body, extra = {}) => serializeNote({ id, title: 'T', ...extra }, body)

test('migrates a legacy .md note to .json and removes the .md (server-confirmed)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/a.md', md('a', '# hello\n\nbody'), 'text')
    const results = await migrateLegacyNotes()
    assert.deepEqual(results, [['a', 'migrated']])
    const json = h.server.get(notePath('a'))
    assert.equal(json.kind, 'json')
    assert.equal(json.value.meta.id, 'a')
    assert.equal(json.value.body, '# hello\n\nbody')
    assert.equal(h.server.has('notes/a.md'), false) // legacy file removed
  })
})

test('is idempotent: re-running migrates nothing new', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/b.md', md('b', 'body'), 'text')
    await migrateLegacyNotes()
    // Second run: only .json present now -> nothing to migrate.
    const second = await migrateLegacyNotes()
    assert.deepEqual(second, [])
  })
})

test('does not overwrite an already-migrated .json that may hold newer edits', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    // Both exist: .json is newer (a prior run migrated, then the user edited).
    h.seed(notePath('c'), { meta: { id: 'c', title: 'NEW' }, body: 'newer body' })
    h.seed('notes/c.md', md('c', 'STALE body'), 'text')
    const res = await migrateNote('c')
    assert.equal(res, 'already')
    // The JSON kept its newer content — never clobbered by a confirming re-put.
    assert.equal(h.server.get(notePath('c')).value.body, 'newer body')
    // The stale .md is LEFT in place: we can't prove the .json is on the server
    // without a clobber-risking re-write, so we keep the (harmless) fallback
    // rather than risk overwriting the newer edit. It is never authoritative —
    // collection.list() ignores non-.json — so it never resurrects stale content.
    assert.equal(h.server.has('notes/c.md'), true)
  })
})

test('offline migration: JSON queued (durable, NOT server-confirmed) keeps the .md', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/q.md', md('q', 'body'), 'text')
    h.setOnline(false)
    const res = await migrateNote('q')
    assert.equal(res, 'queued')
    // The JSON is durably outboxed (read-your-writes shows it via get) ...
    assert.equal((await h.storage.get(notePath('q'))).body, 'body')
    // ... but it is NOT on the server yet (queued != synced) ...
    assert.equal(h.server.has(notePath('q')), false)
    // ... so the legacy .md is KEPT as the fallback. 'queued' never deletes it.
    assert.equal(h.server.has('notes/q.md'), true)
  })
})

test('a dead-lettered JSON write defers — the .md is KEPT, .json never on server', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/d.md', md('d', 'body'), 'text')
    // The server refuses the .json write with a fatal 4xx (dead-letter).
    h.forceDeadLetter(notePath('d'), 413)
    const res = await migrateNote('d')
    assert.equal(res, 'deferred')
    // The legacy file is untouched, and the .json is on neither server nor overlay.
    assert.equal(h.server.has('notes/d.md'), true)
    assert.equal(h.server.has(notePath('d')), false)
    assert.equal(h.overlay.has(notePath('d')), false)
  })
})

test('skips malformed legacy files (no frontmatter id)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/junk.md', 'no frontmatter here', 'text')
    const results = await migrateLegacyNotes()
    assert.deepEqual(results, [['junk', 'skipped']])
    assert.equal(h.server.has('notes/junk.json'), false)
  })
})

// ── Dead-letter guarantees the previous mock (always-durable) could not catch ──
// These pin the EXACT data-loss findings the adversarial review surfaced: a
// migration write that the server fatally refuses (or that drains-then-refuses)
// must never delete the note's legacy .md fallback.

test('(dead-letter a) a dead-lettered migration does NOT delete the .md', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/x.md', md('x', 'precious'), 'text')
    h.forceDeadLetter(notePath('x'), 422) // a different fatal status, same outcome
    const res = await migrateNote('x')
    assert.equal(res, 'deferred')
    // The .json never landed (server refused, no overlay) — so the .md is the
    // ONLY copy and it must survive. (With the buggy set()-based migration the
    // lie {synced:true} would have deleted it here, losing the note.)
    assert.equal(h.server.has(notePath('x')), false)
    assert.equal(h.server.has('notes/x.md'), true)
    // The legacy content is intact and re-parsable on the next startup.
    assert.match(await h.storage.getText('notes/x.md'), /precious/)
    // Next startup (server now accepts) migrates cleanly and only THEN drops .md.
    const second = await migrateNote('x')
    assert.equal(second, 'migrated')
    assert.equal(h.server.get(notePath('x')).value.body, 'precious')
    assert.equal(h.server.has('notes/x.md'), false)
  })
})

test('(dead-letter b) a queued migration keeps the .md until the .json is server-confirmed', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/y.md', md('y', 'draft'), 'text')
    h.setOnline(false)
    const res = await migrateNote('y')
    assert.equal(res, 'queued')
    // Durable locally, NOT on the server -> .md kept.
    assert.equal(h.server.has(notePath('y')), false)
    assert.equal(h.server.has('notes/y.md'), true)
    // Drain the outbox (reconnect): the queued .json now lands on the server.
    await h.drain()
    assert.equal(h.server.get(notePath('y')).value.body, 'draft')
    // The NEXT startup sees the .json on the server and the .md still present.
    // It returns 'already' and (per the no-clobber rule) leaves the harmless .md.
    const second = await migrateNote('y')
    assert.equal(second, 'already')
    assert.equal(h.server.get(notePath('y')).value.body, 'draft') // never clobbered
  })
})

test('(dead-letter b2) a queued migration that DRAINS-then-dead-letters never deletes the .md', async () => {
  const h = makeMockStorage()
  const deadLettered = []
  await withWindow(h, async () => {
    h.storage.onDeadLetter((info) => deadLettered.push(info))
    h.seed('notes/z.md', md('z', 'kept'), 'text')
    h.setOnline(false)
    assert.equal(await migrateNote('z'), 'queued')
    assert.equal(h.server.has('notes/z.md'), true)
    // The queued .json is later REFUSED on drain (a fatal 4xx surfaces only when
    // the outbox tries to flush it). onDeadLetter fires; the .json never reaches
    // the server.
    h.forceDeadLetter(notePath('z'), 413)
    await h.drain()
    assert.equal(deadLettered.length, 1)
    assert.equal(deadLettered[0].path, notePath('z'))
    assert.equal(h.server.has(notePath('z')), false)
    // The .md was never deleted (it is only ever removed on a 'synced' migration),
    // so the note is fully recoverable on the next startup.
    assert.equal(h.server.has('notes/z.md'), true)
    assert.equal(await migrateNote('z'), 'migrated') // server now accepts
    assert.equal(h.server.has('notes/z.md'), false)
  })
})

// Sanity: the mock's legacy set() LIE is modeled — a forced set() returns
// {synced:true} but leaves the server untouched. This is the exact runtime
// behavior the migration must NOT trust (and no longer does — it uses
// durableWrite). Pinning it here guards against the mock silently reverting to
// "set() always persists", which is what hid the original bug.
test('(mock fidelity) a forced set() LIES: returns synced but does not persist server-side', async () => {
  const h = makeMockStorage()
  h.seed('notes/keep.json', { meta: { id: 'keep' }, body: 'old' })
  h.forceDeadLetter('notes/keep.json', 413)
  const r = await h.storage.set('notes/keep.json', { meta: { id: 'keep' }, body: 'new' })
  assert.deepEqual(r, { synced: true }) // the LIE
  // Server is unchanged; the optimistic value is not effective.
  assert.equal((await h.storage.get('notes/keep.json')).body, 'old')
})
