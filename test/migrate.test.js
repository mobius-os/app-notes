import { test } from 'node:test'
import assert from 'node:assert'
import { makeMockStorage } from './mobius-storage-mock.mjs'
import { migrateLegacyNotes, migrateNote } from '../src/lib/migrate.js'
import { notePath } from '../src/lib/note-doc.js'
import { serializeNote } from '../src/lib/frontmatter.js'

// The one-time legacy migration: notes/<id>.md (frontmatter-markdown) ->
// notes/<id>.json ({ meta, body }). Conservative: the JSON write must be durable
// before the .md is deleted, so a crash mid-migration never loses a note.

function withWindow(harness, fn) {
  const prev = globalThis.window
  globalThis.window = { mobius: { storage: harness.storage, online: true, signal() {} } }
  return Promise.resolve(fn()).finally(() => { globalThis.window = prev })
}

const md = (id, body, extra = {}) => serializeNote({ id, title: 'T', ...extra }, body)

test('migrates a legacy .md note to .json and removes the .md', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/a.md', md('a', '# hello\n\nbody'), 'text')
    const results = await migrateLegacyNotes()
    assert.deepEqual(results, [['a', 'migrated']])
    const json = h.raw.get(notePath('a'))
    assert.equal(json.kind, 'json')
    assert.equal(json.value.meta.id, 'a')
    assert.equal(json.value.body, '# hello\n\nbody')
    assert.equal(h.raw.has('notes/a.md'), false) // legacy file removed
  })
})

test('is idempotent: re-running migrates nothing new (and cleans a stray .md)', async () => {
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
    // The JSON kept its newer content; the stale .md was cleaned up.
    assert.equal(h.raw.get(notePath('c')).value.body, 'newer body')
    assert.equal(h.raw.has('notes/c.md'), false)
  })
})

test('offline migration: JSON queued (durable) keeps the .md as a fallback until synced', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/q.md', md('q', 'body'), 'text')
    h.setOnline(false)
    const res = await migrateNote('q')
    assert.equal(res, 'queued')
    // The JSON IS durably written (read-your-writes shows it) ...
    assert.equal(h.raw.get(notePath('q')).value.body, 'body')
    // ... but the legacy .md is KEPT until the JSON syncs to the server.
    assert.equal(h.raw.has('notes/q.md'), true)
    // After reconnect, the next run takes the 'already' branch and cleans the .md.
    h.setOnline(true)
    const second = await migrateNote('q')
    assert.equal(second, 'already')
    assert.equal(h.raw.has('notes/q.md'), false)
  })
})

test('a non-durable JSON write defers — the .md is KEPT for the next run', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/d.md', md('d', 'body'), 'text')
    // Force the set() to look non-durable by going offline AND making the mock
    // report neither synced nor queued. The mock's set() always returns durable;
    // to model a non-durable resolve we intercept set once.
    const realSet = h.storage.set
    h.storage.set = async () => ({ ok: false })
    const res = await migrateNote('d')
    h.storage.set = realSet
    assert.equal(res, 'deferred')
    // The legacy file is untouched, so the note is never stranded.
    assert.equal(h.raw.has('notes/d.md'), true)
    assert.equal(h.raw.has(notePath('d')), false)
  })
})

test('skips malformed legacy files (no frontmatter id)', async () => {
  const h = makeMockStorage()
  await withWindow(h, async () => {
    h.seed('notes/junk.md', 'no frontmatter here', 'text')
    const results = await migrateLegacyNotes()
    assert.deepEqual(results, [['junk', 'skipped']])
    assert.equal(h.raw.has('notes/junk.json'), false)
  })
})
