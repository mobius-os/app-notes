import { test } from 'node:test'
import assert from 'node:assert'
import { noteAttachmentRefs, referencedAttachments, strandedImageRefs } from '../src/lib/attachments.js'
import { mergeNoteDocs } from '../src/lib/note-doc.js'

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
// embed) survives a clean 3-way merge and the subsequent GC sweep. This is the
// high-severity data-loss path: a merge that dropped meta.attachments → the
// merged canonical note no longer references the blob → the next gc sweep frees
// it permanently. mergeNoteDocs (→ mergeMeta) set-UNIONS attachments across both
// sides, so the blob stays in the referenced set and gcAttachments leaves it
// alone. (Post-migration: the note documents merge through mergeNoteDocs, the
// same merge3/mergeMeta the retired reconciler used.)
test('a stranded-image note survives a clean merge + GC sweep (blob stays referenced)', () => {
  const STRANDED = 'attachments/stranded.png'
  const NOTE_ID = 'note-strand'
  const doc = (meta, body) => ({ meta, body })

  // Both devices edited the body (disjoint lines → clean merge); the image lives
  // only in meta.attachments (stranded — surfaced by the editor strip, not embedded).
  const base = doc(
    { id: NOTE_ID, created: 'C', mobius_rev: 4, attachments: [STRANDED] },
    'a\nb\nc',
  )
  const mine = doc(
    { id: NOTE_ID, created: 'C', mobius_rev: 5, updated: '2026-06-03T10:00:00Z', attachments: [STRANDED] },
    'a\nB\nc',
  )
  const server = doc(
    { id: NOTE_ID, created: 'C', mobius_rev: 6, updated: '2026-06-03T09:00:00Z', attachments: [STRANDED] },
    'a\nb\nC',
  )

  const { value: mergedNote, conflict } = mergeNoteDocs(base, mine, server)
  assert.equal(conflict, false)

  // The merged note is what the runtime writes canonical. gcAttachments builds
  // the referenced set from this canonical note alone — so its meta.attachments
  // must still carry the blob.
  assert.deepEqual(strandedImageRefs(mergedNote.meta, mergedNote.body), [STRANDED],
    'the image is still stranded (in meta, not body) after the merge')

  const referenced = referencedAttachments([mergedNote])
  assert.ok(referenced.has(STRANDED),
    'GC must see the stranded image as referenced by the merged canonical note')
})
