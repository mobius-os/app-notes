import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'mobius.json'), 'utf8'))

test('manifest schedules the deterministic snapshot job every ten minutes', () => {
  assert.equal(manifest.schedule?.job, 'job.sh')
  assert.equal(manifest.schedule?.default, '*/10 * * * *')
  assert.equal(manifest.schedule?.user_configurable, false)
})
