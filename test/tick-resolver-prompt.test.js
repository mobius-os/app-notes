// P0-High regression: the autonomous cron resolver (tick.sh) must verify the
// current canonical note body against the descriptor's `mine.body`, NOT `server.body`.
// When the app raises a genuine body conflict it persists `mine.body` to the note
// file (the descriptor holds the only surviving copy of `server.body`), so a
// verify-before-write gated on `server.body` matching the note would abandon EVERY
// real conflict by construction — leaving conflicts permanently stuck. This locks
// both halves of the invariant: the prompt text (so a future edit can't regress the
// rule) and the note-doc semantics the rule depends on.

import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { mergeNoteDocs, conflictDescriptorFor } from '../src/lib/note-doc.js'
import { contentHash } from '../src/lib/note.js'

if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = webcrypto

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const TICK = readFileSync(resolve(ROOT, 'tick.sh'), 'utf8')

test('tick.sh resolver verifies the current note body against mine.body, not server.body', () => {
  assert.match(TICK, /should equal the descriptor's[\s\S]{0,4}mine\.body/i, 'the verify anchor is mine.body')
  assert.match(TICK, /NO LONGER matches[\s\S]{0,12}mine\.body[\s\S]{0,90}ABANDON/i, 'abandon fires only when the current body diverges from mine.body')
  // The refuted rule must never return: abandoning on a server.body mismatch.
  assert.doesNotMatch(TICK, /no longer matches the descriptor's[\s\S]{0,4}server\.body/i, 'the resolver no longer abandons on a server.body mismatch')
})

test('a genuine body conflict lands mine.body on the note and preserves server.body in the descriptor', async () => {
  const base = { meta: { id: 'n1', title: 'T', mobius_rev: 1, updated: '2020-01-01T00:00:00.000Z' }, body: 'base line' }
  const mine = { meta: { id: 'n1', title: 'T', mobius_rev: 2, updated: '2020-01-02T00:00:00.000Z' }, body: 'MINE line' }
  const theirs = { meta: { id: 'n1', title: 'T', mobius_rev: 2, updated: '2020-01-03T00:00:00.000Z' }, body: 'THEIRS line' }

  const { value, conflict } = mergeNoteDocs(base, mine, theirs)
  assert.equal(conflict, true, 'overlapping single-line edits are a genuine conflict')
  assert.equal(value.body, 'MINE line', 'the note file gets mine.body — the invariant tick.sh verifies against')

  const d = await conflictDescriptorFor(base, mine, theirs, contentHash)
  assert.equal(d.mine.body, 'MINE line', 'the descriptor keeps mine.body')
  assert.equal(d.server.body, 'THEIRS line', 'the descriptor preserves the losing server body (its only surviving copy)')
})
