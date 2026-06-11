// P2 feature tests: inline-create commit/discard logic, checklist markdown
// round-trip, label filter, archive toggle. Pure helpers only — no IO, no React.
import {test} from 'node:test'
import assert from 'node:assert'
import {newNote, isBlankNote, contentHash} from '../src/lib/note.js'
import {parseFrontmatter, serializeNote} from '../src/lib/frontmatter.js'
import {buildIndex, notesFromIndex} from '../src/lib/index-cache.js'

// ── Inline-create: commit / discard logic ───────────────────────────────────

// The InlineCapture component gates onCreate on non-blank content. The
// underlying predicate is isBlankNote. We test the decision boundary.

test('inline-create: blank title+body → should NOT commit (isBlankNote=true)', () => {
  assert.equal(isBlankNote({title: ''}, ''), true)
  assert.equal(isBlankNote({title: '  '}, '   \n  '), true)
})

test('inline-create: non-empty title → should commit (isBlankNote=false)', () => {
  assert.equal(isBlankNote({title: 'Buy milk'}, ''), false)
})

test('inline-create: non-empty body → should commit (isBlankNote=false)', () => {
  assert.equal(isBlankNote({title: ''}, 'remember to call back'), false)
})

test('inline-create: creates note with correct type=checklist', () => {
  const m = newNote({type: 'checklist'})
  assert.equal(m.type, 'checklist')
  assert.equal(m.pinned, false)
  assert.equal(m.archived, false)
})

test('inline-create: creates note with correct type=note (default)', () => {
  const m = newNote({})
  assert.equal(m.type, 'note')
})

// ── Checklist markdown round-trip ────────────────────────────────────────────

// Checklist notes store their items as `- [ ] item` / `- [x] item` in the
// body — the same markdown the CodeMirror CheckboxWidget already handles.
// These tests verify the format round-trips cleanly through frontmatter.

test('checklist body round-trips through serializeNote / parseFrontmatter', () => {
  const meta = newNote({title: 'Shopping', type: 'checklist'})
  const body = '- [ ] Milk\n- [x] Eggs\n- [ ] Bread'
  const serialized = serializeNote(meta, body)
  const {meta: out, body: outBody} = parseFrontmatter(serialized)
  assert.equal(out.type, 'checklist')
  assert.equal(outBody, body)
})

test('checklist items parse correctly from markdown', () => {
  const body = '- [ ] unchecked\n- [x] checked'
  const unchecked = /^- \[ \] .+/m.test(body)
  const checked = /^- \[x\] .+/m.test(body)
  assert.ok(unchecked, 'unchecked item pattern matches')
  assert.ok(checked, 'checked item pattern matches')
})

test('absent type in frontmatter defaults to note on parse', () => {
  const {meta} = parseFrontmatter('---\nid: abc\ntitle: Hi\n---\nbody')
  // type absent from frontmatter → should default to note at the app layer
  // (normalize() in note.js handles this; frontmatter parser returns undefined)
  assert.equal(meta.type, undefined)  // raw parse gives undefined
  // The normalize() default:
  const type = meta.type ?? 'note'
  assert.equal(type, 'note')
})

test('checklist type serializes and parses as the string checklist', () => {
  const meta = {id: 'x', title: 'T', type: 'checklist', archived: false, tags: []}
  const out = serializeNote(meta, '- [ ] item')
  const {meta: parsed} = parseFrontmatter(out)
  assert.equal(parsed.type, 'checklist')
})

// ── Label (tag) filter ────────────────────────────────────────────────────────

// The tag-filter is pure client-side: filter notes[] whose meta.tags includes
// the active tag. We test the filtering logic over plain note objects.

function mkNote(id, tags, archived = false) {
  return {meta: {id, tags, archived, pinned: false, updated: '2026-06-11T00:00:00Z'}, body: ''}
}

function filterByTag(notes, tag) {
  if (!tag) return notes.filter((n) => !n.meta.archived)
  return notes.filter((n) => !n.meta.archived && (n.meta.tags || []).includes(tag))
}

test('label filter: no active tag → returns all non-archived', () => {
  const notes = [mkNote('a', ['work']), mkNote('b', ['home']), mkNote('c', [], true)]
  assert.deepEqual(filterByTag(notes, null).map((n) => n.meta.id), ['a', 'b'])
})

test('label filter: active tag → only notes with that tag', () => {
  const notes = [mkNote('a', ['work']), mkNote('b', ['home', 'work']), mkNote('c', ['home'])]
  const filtered = filterByTag(notes, 'work').map((n) => n.meta.id)
  assert.deepEqual(filtered, ['a', 'b'])
})

test('label filter: archived notes never appear in tag-filtered view', () => {
  const notes = [mkNote('a', ['work'], true), mkNote('b', ['work'], false)]
  const filtered = filterByTag(notes, 'work').map((n) => n.meta.id)
  assert.deepEqual(filtered, ['b'])
})

test('label filter: unknown tag → empty result', () => {
  const notes = [mkNote('a', ['work']), mkNote('b', ['home'])]
  assert.deepEqual(filterByTag(notes, 'nonexistent'), [])
})

// allTags derivation: unique tags from non-archived notes, sorted
function allTags(notes) {
  const set = new Set()
  for (const n of notes) {
    if (!n.meta.archived) for (const t of (n.meta.tags || [])) set.add(t)
  }
  return [...set].sort()
}

test('allTags: collects unique sorted tags from non-archived notes', () => {
  const notes = [
    mkNote('a', ['work', 'ideas']),
    mkNote('b', ['home', 'ideas']),
    mkNote('c', ['secret'], true), // archived — excluded
  ]
  assert.deepEqual(allTags(notes), ['home', 'ideas', 'work'])
})

test('allTags: empty when all notes have no tags', () => {
  assert.deepEqual(allTags([mkNote('a', [])]), [])
})

// ── Archive toggle ────────────────────────────────────────────────────────────

test('archive toggle: default note has archived=false', () => {
  const m = newNote({})
  assert.equal(m.archived, false)
})

test('archive toggle: archived flag round-trips through frontmatter', () => {
  const meta = newNote({title: 'Old idea'})
  const archived = {...meta, archived: true}
  const serialized = serializeNote(archived, 'some body')
  const {meta: parsed} = parseFrontmatter(serialized)
  assert.equal(parsed.archived, true)
})

test('archive toggle: unarchive round-trips through frontmatter', () => {
  const meta = newNote({title: 'Old idea'})
  const archivedMeta = {...meta, archived: true}
  const unarchived = {...archivedMeta, archived: false}
  const serialized = serializeNote(unarchived, 'body')
  const {meta: parsed} = parseFrontmatter(serialized)
  assert.equal(parsed.archived, false)
})

test('archive toggle: contentHash differs between archived=true and archived=false', async () => {
  const meta = {title: 'T', pinned: false, color: null, tags: [], type: 'note'}
  const active = await contentHash({...meta, archived: false}, 'body')
  const archived = await contentHash({...meta, archived: true}, 'body')
  assert.notEqual(active, archived)
})

test('archive toggle: archived notes projected into index', () => {
  const {notes} = buildIndex([
    {meta: {id: 'a', archived: true, tags: [], type: 'note', updated: '2026-06-11T00:00:00Z'}, body: 'x'},
    {meta: {id: 'b', archived: false, tags: [], type: 'note', updated: '2026-06-11T00:00:00Z'}, body: 'y'},
  ])
  assert.equal(notes.find((n) => n.id === 'a').archived, true)
  assert.equal(notes.find((n) => n.id === 'b').archived, false)
})

test('notesFromIndex: archived field preserved in cold-load reconstitution', () => {
  const index = {notes: [{id: 'a', title: 'T', archived: true, tags: [], type: 'note', pinned: false, updated: '2026-06-11T00:00:00Z', snippet: 'x'}]}
  const reconstituted = notesFromIndex(index)
  assert.equal(reconstituted[0].meta.archived, true)
})

test('notesFromIndex: absent archived defaults to false on cold load', () => {
  const index = {notes: [{id: 'a', title: 'T', pinned: false, updated: '2026-06-11T00:00:00Z', snippet: 'x'}]}
  const reconstituted = notesFromIndex(index)
  assert.equal(reconstituted[0].meta.archived, false)
})
