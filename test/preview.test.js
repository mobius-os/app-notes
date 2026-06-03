import {test} from 'node:test'
import assert from 'node:assert'
import {neutralizePreviewMarkdown, PREVIEW_SANITIZE_OPTIONS} from '../src/lib/preview.js'

test('neutralizePreviewMarkdown preserves labels but removes URLs', () => {
  const md = [
    '![remote pixel](https://example.test/track.png)',
    '![receipt](attachments/abc123.png)',
    '[external](https://example.test/page)',
    '[file](attachments/abc123.pdf)',
  ].join('\n')

  const out = neutralizePreviewMarkdown(md)

  assert.ok(out.includes('remote pixel'))
  assert.ok(out.includes('receipt'))
  assert.ok(out.includes('external'))
  assert.ok(out.includes('file'))
  assert.ok(!out.includes('https://'))
  assert.ok(!out.includes('attachments/'))
})

test('preview sanitizer forbids network-bearing tags and attributes', () => {
  assert.ok(PREVIEW_SANITIZE_OPTIONS.FORBID_TAGS.includes('img'))
  assert.ok(PREVIEW_SANITIZE_OPTIONS.FORBID_TAGS.includes('iframe'))
  assert.ok(PREVIEW_SANITIZE_OPTIONS.FORBID_ATTR.includes('href'))
  assert.ok(PREVIEW_SANITIZE_OPTIONS.FORBID_ATTR.includes('src'))
  assert.ok(PREVIEW_SANITIZE_OPTIONS.FORBID_ATTR.includes('srcset'))
})
