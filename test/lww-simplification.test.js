import { test } from 'node:test'
import assert from 'node:assert'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const read = (path) => readFileSync(resolve(root, path), 'utf8')

test('Notes uses conditional writes with one bounded app-owned recovery policy', () => {
  const app = read('src/app.jsx')
  const editor = read('src/ui/EditorPanel.jsx')
  const collection = read('src/lib/collection.js')
  const store = read('src/lib/store.js')

  assert.match(app, /supportsConflictRecovery\s*\?\s*'cas'\s*:\s*'lww'/)
  assert.doesNotMatch(app, /conflictDescriptor|makeMergeNote|conflict_raised|conflict_resolved/)
  assert.doesNotMatch(editor, /onExternalConflict|externalConflict|Resolve now|Edited in two places/)
  assert.doesNotMatch(collection, /mergeNoteDocs|conflicts\//)
  assert.match(collection, /onConflict/)
  assert.match(collection, /recovered offline edit/)
  assert.doesNotMatch(store, /writeConflict|conflicts\//)
  assert.equal(existsSync(resolve(root, 'src/lib/merge.js')), false)
})
