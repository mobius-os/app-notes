import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const manifest = JSON.parse(readFileSync(resolve(process.cwd(), 'mobius.json'), 'utf8'))

test('manifest ships the resolver job without a recurring Notes cron', () => {
  assert.equal(manifest.schedule?.job, 'job.sh')
  assert.equal(Object.hasOwn(manifest.schedule || {}, 'default'), false)
})
