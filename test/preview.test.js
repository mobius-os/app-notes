import {test} from 'node:test'
import assert from 'node:assert'
import {firstLocalImageRef, localImageRefs, neutralizePreviewMarkdown, PREVIEW_SANITIZE_OPTIONS} from '../src/lib/preview.js'

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

test('firstLocalImageRef picks the first local image in the markdown body', () => {
  const md = [
    '![remote](https://example.test/a.png)',
    '![receipt](attachments/abc123.png)',
    '![later](attachments/later.webp)',
  ].join('\n')

  assert.equal(firstLocalImageRef({}, md), 'attachments/abc123.png')
})

test('localImageRefs returns multiple body images in order, deduped', () => {
  const md = [
    '![one](attachments/one.png)',
    '![remote](https://example.test/a.png)',
    '![two](attachments/two.webp)',
    '![dupe](attachments/one.png)',
    '![three](attachments/three.jpg)',
  ].join('\n')

  assert.deepEqual(localImageRefs({}, md), [
    'attachments/one.png',
    'attachments/two.webp',
    'attachments/three.jpg',
  ])
})

test('firstLocalImageRef falls back to image attachments in frontmatter', () => {
  assert.equal(
    firstLocalImageRef({attachments: ['attachments/file.pdf', 'attachments/abc123.jpeg']}, ''),
    'attachments/abc123.jpeg',
  )
})

test('localImageRefs caps previews to the requested limit', () => {
  const meta = {
    attachments: [
      'attachments/a.png',
      'attachments/b.png',
      'attachments/c.png',
      'attachments/d.png',
      'attachments/e.png',
    ],
  }

  assert.deepEqual(localImageRefs(meta, '', 3), [
    'attachments/a.png',
    'attachments/b.png',
    'attachments/c.png',
  ])
})

test('firstLocalImageRef ignores non-local and non-image paths', () => {
  assert.equal(firstLocalImageRef({attachments: ['attachments/file.pdf']}, '![x](https://example.test/x.png)'), null)
  assert.equal(firstLocalImageRef({attachments: ['../oops.png']}, ''), null)
})
