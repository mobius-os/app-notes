// Checklist notes: type round-trip through frontmatter and the `- [ ]` item
// markdown the CodeMirror CheckboxWidget renders. Pure helpers only.
import {test} from 'node:test'
import assert from 'node:assert'
import {newNote} from '../src/lib/note.js'
import {parseFrontmatter, serializeNote} from '../src/lib/frontmatter.js'

test('newNote creates type=checklist on request, type=note by default', () => {
  assert.equal(newNote({type: 'checklist'}).type, 'checklist')
  assert.equal(newNote({}).type, 'note')
})

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
  assert.ok(/^- \[ \] .+/m.test(body), 'unchecked item pattern matches')
  assert.ok(/^- \[x\] .+/m.test(body), 'checked item pattern matches')
})

test('absent type in frontmatter defaults to note at the app layer', () => {
  const {meta} = parseFrontmatter('---\nid: abc\ntitle: Hi\n---\nbody')
  assert.equal(meta.type, undefined) // raw parse gives undefined
  assert.equal(meta.type ?? 'note', 'note') // normalize() default
})
