import { test } from 'node:test'
import assert from 'node:assert'
import { noteAttachmentRefs, referencedAttachments, strandedImageRefs } from '../src/lib/attachments.js'
import { reconcile } from '../src/lib/sync.js'

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

// Integration: a note holding a STRANDED image (in meta.attachments, no body
// embed) survives a clean 3-way reconcile and the subsequent GC sweep. This is
// the high-severity data-loss path: 'merged' drops meta.attachments → the merged
// canonical note no longer references the blob → the next gc sweep frees it
// permanently. The merged note's attachments must keep the blob in the
// referenced set so gcAttachments leaves it alone.
test('a stranded-image note survives a clean merge + GC sweep (blob stays referenced)', () => {
  const STRANDED = 'attachments/stranded.png'
  const NOTE_ID = 'note-strand'
  const side = (meta, body, hash) => ({ meta, body, hash })

  // Both devices edited the body (disjoint lines → clean merge); the image lives
  // only in meta.attachments (stranded — surfaced by the editor strip, not embedded).
  const base = side(
    { id: NOTE_ID, created: 'C', mobius_rev: 4, attachments: [STRANDED] },
    'a\nb\nc',
    'H_BASE',
  )
  const mine = side(
    { id: NOTE_ID, created: 'C', mobius_rev: 5, updated: '2026-06-03T10:00:00Z', attachments: [STRANDED] },
    'a\nB\nc',
    'H_MINE',
  )
  const server = side(
    { id: NOTE_ID, created: 'C', mobius_rev: 6, updated: '2026-06-03T09:00:00Z', attachments: [STRANDED] },
    'a\nb\nC',
    'H_SERVER',
  )

  const decision = reconcile({ base, mine, server })
  assert.equal(decision.action, 'merged')

  // The merged note is what the reconciler writes canonical and promotes (out of
  // unsyncedLocals). gcAttachments then builds the referenced set from this
  // canonical note alone — so its meta.attachments must still carry the blob.
  const mergedNote = { meta: decision.note.meta, body: decision.note.body }
  assert.deepEqual(strandedImageRefs(mergedNote.meta, mergedNote.body), [STRANDED],
    'the image is still stranded (in meta, not body) after the merge')

  const referenced = referencedAttachments([mergedNote])
  assert.ok(referenced.has(STRANDED),
    'GC must see the stranded image as referenced by the merged canonical note')
})
