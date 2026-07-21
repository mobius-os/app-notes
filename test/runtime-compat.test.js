import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  LEGACY_IDLE_DOCUMENT_PATH,
  idleDocumentPath,
} from '../src/lib/runtime-compat.js'

test('current runtimes use a true idle document path', () => {
  assert.equal(idleDocumentPath({ idleDocument: true }), null)
})

test('older embedded runtimes retain the legacy-safe fallback', () => {
  assert.equal(idleDocumentPath(undefined), LEGACY_IDLE_DOCUMENT_PATH)
  assert.equal(idleDocumentPath({}), LEGACY_IDLE_DOCUMENT_PATH)
  assert.equal(idleDocumentPath({ idleDocument: false }), LEGACY_IDLE_DOCUMENT_PATH)
})
