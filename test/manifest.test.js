import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'mobius.json'), 'utf8'))

test('manifest does not schedule background work', () => {
  assert.equal(manifest.schedule, undefined)
})

test('manifest ships maintainable source directly instead of a generated bundle', () => {
  assert.equal(manifest.entry, 'index.jsx')
  assert.ok(manifest.source_files.includes('src/app.jsx'))
  assert.ok(manifest.source_files.includes('src/ui/EditorPanel.jsx'))
})
