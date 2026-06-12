// v1.2 behavior: edit-time grid ordering, lenient reads for removed features
// (tags, archive), cold-load placeholder marking, and stranded-attachment
// surfacing. Pure helpers only — no IO, no React.
import {test} from 'node:test'
import assert from 'node:assert'
import {parseFrontmatter} from '../src/lib/frontmatter.js'
import {visibleNotes} from '../src/lib/visible.js'
import {notesFromIndex, buildIndex} from '../src/lib/index-cache.js'
import {strandedImageRefs} from '../src/lib/attachments.js'
import {contentHash} from '../src/lib/note.js'

function mk(id, {updated, pinned = false, title = '', body = '', ...extra} = {}) {
  return {meta: {id, updated, pinned, title, ...extra}, body}
}

// ── Grid order: last-EDIT time descending, pinned first ─────────────────────

test('visibleNotes sorts by updated descending (most recently edited first)', () => {
  const notes = [
    mk('old', {updated: '2026-06-01T00:00:00Z'}),
    mk('new', {updated: '2026-06-10T00:00:00Z'}),
    mk('mid', {updated: '2026-06-05T00:00:00Z'}),
  ]
  assert.deepEqual(visibleNotes(notes, '').map((n) => n.meta.id), ['new', 'mid', 'old'])
})

test('visibleNotes keeps pinned notes ahead of more recently edited ones', () => {
  const notes = [
    mk('recent', {updated: '2026-06-10T00:00:00Z'}),
    mk('pinned-old', {updated: '2026-06-01T00:00:00Z', pinned: true}),
  ]
  assert.deepEqual(visibleNotes(notes, '').map((n) => n.meta.id), ['pinned-old', 'recent'])
})

test('an edit (newer updated stamp) moves a note to the top; an open does not', async () => {
  const a = mk('a', {updated: '2026-06-01T00:00:00Z', title: 'A', body: 'alpha'})
  const b = mk('b', {updated: '2026-06-02T00:00:00Z', title: 'B', body: 'beta'})
  assert.deepEqual(visibleNotes([a, b], '').map((n) => n.meta.id), ['b', 'a'])

  // "Open" = no content change. persist() compares content hashes before
  // stamping `updated`; identical content means identical hashes → no stamp →
  // order unchanged. This is the guard's exact decision input.
  const reSaved = {meta: {...a.meta}, body: a.body}
  assert.equal(await contentHash(reSaved.meta, reSaved.body), await contentHash(a.meta, a.body))
  assert.deepEqual(visibleNotes([reSaved, b], '').map((n) => n.meta.id), ['b', 'a'])

  // "Edit" = content changed → hash differs → persist stamps a fresh updated.
  const edited = {meta: {...a.meta, updated: '2026-06-03T00:00:00Z'}, body: 'alpha edited'}
  assert.notEqual(await contentHash(edited.meta, edited.body), await contentHash(a.meta, a.body))
  assert.deepEqual(visibleNotes([edited, b], '').map((n) => n.meta.id), ['a', 'b'])
})

test('visibleNotes filters on title and body, case-insensitive', () => {
  const notes = [
    mk('a', {updated: '2026-06-01T00:00:00Z', title: 'Groceries', body: 'milk'}),
    mk('b', {updated: '2026-06-02T00:00:00Z', title: 'Work', body: 'Quarterly PLAN'}),
  ]
  assert.deepEqual(visibleNotes(notes, 'plan').map((n) => n.meta.id), ['b'])
  assert.deepEqual(visibleNotes(notes, 'MILK').map((n) => n.meta.id), ['a'])
})

// ── Lenient reads: removed features must not hide or crash on legacy data ───

test('legacy archived notes appear in the main list (archive removed, data kept)', () => {
  const notes = [
    mk('live', {updated: '2026-06-02T00:00:00Z'}),
    mk('was-archived', {updated: '2026-06-05T00:00:00Z', archived: true}),
  ]
  const ids = visibleNotes(notes, '').map((n) => n.meta.id)
  assert.deepEqual(ids, ['was-archived', 'live'])
})

test('legacy tagged notes parse and list without crashing (tags ignored)', () => {
  const md = '---\nid: x\ntitle: Tagged\ntags: [work, ideas]\narchived: true\nupdated: 2026-06-05T00:00:00Z\n---\nbody'
  const {meta, body} = parseFrontmatter(md)
  assert.deepEqual(meta.tags, ['work', 'ideas']) // field survives the parse…
  const shown = visibleNotes([{meta, body}], '')
  assert.equal(shown.length, 1) // …and the note is simply shown
})

// ── Cold-load placeholders are display-only ─────────────────────────────────

test('notesFromIndex marks every reconstituted record as a placeholder', () => {
  const index = buildIndex([
    mk('a', {updated: '2026-06-01T00:00:00Z', title: 'A', body: 'has ![pic](attachments/ab.png) embed'}),
  ])
  const records = notesFromIndex(index)
  assert.equal(records.length, 1)
  assert.equal(records[0].placeholder, true)
  // The snippet body is LOSSY — the image embed is reduced to alt text. This is
  // why a placeholder must never reach the editor / be persisted.
  assert.ok(!records[0].body.includes('attachments/'))
})

test('notesFromIndex tolerates legacy index entries with tags/archived fields', () => {
  const index = {notes: [{id: 'a', title: 'T', tags: ['x'], archived: true, snippet: 's', updated: '2026-06-01T00:00:00Z'}]}
  const records = notesFromIndex(index)
  assert.equal(records.length, 1)
  assert.equal(records[0].meta.id, 'a')
  assert.equal('tags' in records[0].meta, false)
})

// ── Stranded attachments: meta-only image refs surface in the editor strip ──

test('strandedImageRefs finds image attachments missing from the body', () => {
  const meta = {attachments: ['attachments/ab12.jpeg', 'attachments/cd34.pdf']}
  assert.deepEqual(strandedImageRefs(meta, 'plain body, no embeds'), ['attachments/ab12.jpeg'])
})

test('strandedImageRefs is empty when the body still embeds the image', () => {
  const meta = {attachments: ['attachments/ab12.jpeg']}
  assert.deepEqual(strandedImageRefs(meta, 'see ![photo](attachments/ab12.jpeg)'), [])
})

test('strandedImageRefs tolerates missing/legacy meta shapes', () => {
  assert.deepEqual(strandedImageRefs({}, 'body'), [])
  assert.deepEqual(strandedImageRefs({attachments: null}, 'body'), [])
  assert.deepEqual(strandedImageRefs({attachments: [42, 'not-attachments/x.png']}, 'body'), [])
})
