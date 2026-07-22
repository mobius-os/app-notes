import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('Notes has one LWW persistence model and no custom conflict machinery', () => {
  const app = read('src/app.jsx')
  const editor = read('src/ui/EditorPanel.jsx')
  const collection = read('src/lib/collection.js')
  const store = read('src/lib/store.js')

  assert.match(app, /mode:\s*'lww'/)
  assert.doesNotMatch(app, /onConflict|conflictDescriptor|makeMergeNote|conflict_raised|conflict_resolved/)
  assert.doesNotMatch(editor, /onExternalConflict|externalConflict|Resolve now|Edited in two places/)
  assert.doesNotMatch(collection, /mergeNoteDocs|onConflict|conflicts\//)
  assert.doesNotMatch(store, /writeConflict|conflicts\//)
  assert.equal(existsSync(resolve(root, 'src/lib/merge.js')), false)
})

test('snapshot job is deterministic, scoped, and agent-free', () => {
  const job = read('job.sh')
  assert.doesNotMatch(job, /\bclaude\b|RESOLVE_PROMPT|resolver_summary/)
  assert.match(job, /git add -A --/)
  assert.match(job, /git rm -r -q --cached --ignore-unmatch/)
  assert.match(job, /notes-meta\.json/)
  assert.match(job, /signals\.jsonl/)
  assert.match(job, /git diff --cached --quiet --exit-code/)
})
