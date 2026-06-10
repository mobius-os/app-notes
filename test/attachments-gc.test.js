import { test } from 'node:test'
import assert from 'node:assert'
import { noteAttachmentRefs, referencedAttachments } from '../src/lib/attachments.js'

test('noteAttachmentRefs gathers body image + file links and meta.attachments', () => {
  const meta = { attachments: ['attachments/aaa.pdf'] }
  const body = '![pic](attachments/bbb.png)\n[doc](attachments/ccc.pdf)\n[ext](https://x.test/y)'
  const refs = noteAttachmentRefs(meta, body)
  assert.deepEqual([...refs].sort(), ['attachments/aaa.pdf', 'attachments/bbb.png', 'attachments/ccc.pdf'])
  assert.ok(!refs.has('https://x.test/y'))
})

test('referencedAttachments unions refs across all live notes (shared/dedup blobs survive)', () => {
  const notes = [
    { meta: {}, body: '![a](attachments/shared.png)' },
    { meta: { attachments: ['attachments/shared.png'] }, body: '![b](attachments/only2.png)' },
  ]
  const refs = referencedAttachments(notes)
  assert.deepEqual([...refs].sort(), ['attachments/only2.png', 'attachments/shared.png'])
})

test('an attachment dropped from a body is no longer referenced (becomes GC-eligible)', () => {
  const before = referencedAttachments([{ meta: {}, body: '![x](attachments/x.png)' }])
  assert.ok(before.has('attachments/x.png'))
  const after = referencedAttachments([{ meta: {}, body: 'image removed' }])
  assert.ok(!after.has('attachments/x.png'))
})
