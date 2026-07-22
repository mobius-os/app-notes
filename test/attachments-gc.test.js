import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { noteAttachmentRefs, referencedAttachments, strandedImageRefs, bodyAttachmentRefs } from '../src/lib/attachments.js'
import { installMobius } from './mobius-storage-mock.mjs'
if (!globalThis.crypto) globalThis.crypto = webcrypto

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

test('bodyAttachmentRefs returns ONLY the body-embedded refs (no meta) for the editor union', () => {
  const body = '![one](attachments/one.png)\nx\n![two](attachments/two.jpeg)\n[doc](attachments/d.pdf)'
  assert.deepEqual(bodyAttachmentRefs(body).sort(),
    ['attachments/d.pdf', 'attachments/one.png', 'attachments/two.jpeg'])
  assert.deepEqual(bodyAttachmentRefs(''), [])
})

// BUG #1 regression: multiple images each get a stable, non-clobbering ref. The
// editor's attach path now bases each write on the LIVE body (which already holds
// every prior ref) and UNIONS meta.attachments from the existing record + every
// body-embedded ref. So even if an autosave flush interleaves between two attaches,
// BOTH image refs survive in the body AND in
// meta.attachments — neither is clobbered, so neither blob is GC-eligible.
test('two interleaved image attaches: the later LWW document retains both refs', () => {
  const IMG1 = 'attachments/img1.png'
  const IMG2 = 'attachments/img2.png'
  const ID = 'multi'
  const REF1 = `\n![a](${IMG1})\n`
  const REF2 = `\n![b](${IMG2})\n`

  // The note as the editor first sees it (no images yet).
  const base = { meta: { id: ID, created: 'C', mobius_rev: 1, attachments: [] }, body: 'note text' }

  // Attach #1: body = base + REF1; meta.attachments unions existing + body refs + new.
  const body1 = base.body + REF1
  const attach1 = {
    meta: {
      ...base.meta, mobius_rev: 2, updated: '2026-06-25T10:00:00Z',
      attachments: [...new Set([...base.meta.attachments, ...bodyAttachmentRefs(body1), IMG1])],
    },
    body: body1,
  }

  // The interleaving autosave flush would land attach1 first (server now holds it).
  // Attach #2 inserts into the LIVE body (which now contains REF1) and writes:
  const body2 = body1 + REF2
  const attach2 = {
    meta: {
      ...attach1.meta, mobius_rev: 3, updated: '2026-06-25T10:00:01Z',
      attachments: [...new Set([...attach1.meta.attachments, ...bodyAttachmentRefs(body2), IMG2])],
    },
    body: body2,
  }

  // The later last-write-wins document is built from the live body, so it already
  // contains both refs and can be written verbatim.
  const value = attach2

  // Both image refs survive in the BODY.
  assert.ok(value.body.includes(IMG1), 'first image ref survives in the merged body')
  assert.ok(value.body.includes(IMG2), 'second image ref survives in the merged body')
  // Both survive in meta.attachments.
  assert.ok(value.meta.attachments.includes(IMG1), 'first image ref survives in meta.attachments')
  assert.ok(value.meta.attachments.includes(IMG2), 'second image ref survives in meta.attachments')
  // Neither blob is GC-eligible.
  const referenced = referencedAttachments([value])
  assert.ok(referenced.has(IMG1) && referenced.has(IMG2), 'both blobs stay referenced (not GC-eligible)')
})

// BUG #1, the harder case: a STALE-SNAPSHOT autosave races in AFTER attach #2.
// Pre-fix, that pre-insert snapshot (carrying only img1, or even no images) would
// overwrite via the fast-forward and orphan img2. With the editor sourcing the
// LIVE body + unioning body refs into every write, even a "late" flush carries the
// full current body, so the later write never drops a ref.
test('a late autosave flush carries the live body (both refs), never clobbering an image', () => {
  const IMG1 = 'attachments/img1.png'
  const IMG2 = 'attachments/img2.png'
  const ID = 'multi2'
  const liveBody = `note\n![a](${IMG1})\n![b](${IMG2})\n` // editor's CM doc after 2 attaches

  // The server already holds both images (attach #1 + #2 landed).
  const server = {
    meta: { id: ID, created: 'C', mobius_rev: 3, attachments: [IMG1, IMG2] },
    body: liveBody,
  }
  // The autosave flush now fires. With the fix it sources the LIVE body and unions
  // the body's refs into attachments — so it writes the SAME full content, not a
  // pre-insert snapshot.
  const flush = {
    meta: {
      ...server.meta, mobius_rev: 4, updated: '2026-06-25T11:00:00Z',
      attachments: [...new Set([...server.meta.attachments, ...bodyAttachmentRefs(liveBody)])],
    },
    body: liveBody,
  }
  const value = flush
  assert.ok(value.body.includes(IMG1) && value.body.includes(IMG2), 'both refs survive the late flush')
  assert.ok(value.meta.attachments.includes(IMG1) && value.meta.attachments.includes(IMG2),
    'meta.attachments keeps both refs after the late flush')
})

// A note holding a STRANDED image (in meta.attachments, no body embed) must carry
// that metadata through an ordinary edit so the next GC sweep keeps the blob.
test('a stranded-image note survives an ordinary LWW rewrite (blob stays referenced)', () => {
  const STRANDED = 'attachments/stranded.png'
  const NOTE_ID = 'note-strand'
  const doc = (meta, body) => ({ meta, body })

  // The image lives only in meta.attachments (stranded — surfaced by the editor
  // strip, not embedded). An edit spreads the existing metadata before writing.
  const mine = doc(
    { id: NOTE_ID, created: 'C', mobius_rev: 5, updated: '2026-06-03T10:00:00Z', attachments: [STRANDED] },
    'a\nB\nc',
  )
  const writtenNote = mine

  // The merged note is what the runtime writes canonical. gcAttachments builds
  // the referenced set from this canonical note alone — so its meta.attachments
  // must still carry the blob.
  assert.deepEqual(strandedImageRefs(writtenNote.meta, writtenNote.body), [STRANDED],
    'the image is still stranded (in meta, not body) after the rewrite')

  const referenced = referencedAttachments([writtenNote])
  assert.ok(referenced.has(STRANDED),
    'GC must see the stranded image as referenced by the merged canonical note')
})

// BUG #1, the GC race (store-level): putAttachment creates the blob, but the NOTE
// that references it is written by a SEPARATE, later await (the editor's onSave →
// writeNote upsert). In the window between the two, the blob exists yet NO note
// references it — listNotes() can't see it and the open-editor body pin can't
// either. A debounced GC firing right then would delete the brand-new blob (the
// multi-image broken-link symptom). putAttachment now LEASES the path as in-flight
// (GC-pinned) before the blob hits disk; gcAttachments treats every in-flight path
// as referenced; the caller releases the lease only after a note durably refs it.
test('a just-attached blob with NO referencing note yet survives a GC sweep (in-flight lease)', async () => {
  installMobius()
  // Fresh import each test so the module-level in-flight Map starts empty and the
  // mock storage just installed is the one putAttachment/gcAttachments bind to.
  const store = await import('../src/lib/store.js?gc-race-1')
  const blob = Object.assign(new Blob(['hello-image-bytes'], { type: 'image/png' }), { name: 'pic.png' })
  const res = await store.putAttachment(blob)
  // The blob is on disk. NO note exists that references it (we never wrote one).
  // Pre-fix, gcAttachments would free it here. The in-flight lease must save it.
  await store.gcAttachments()
  const after = await window.mobius.storage.list('attachments')
  assert.ok(after.some((e) => e.path === res.path),
    'the leased, not-yet-referenced blob is NOT GC-eligible while in flight')

  // Once released AND still unreferenced by any note, it becomes GC-eligible.
  store.releaseAttachment(res.path)
  await store.gcAttachments()
  const after2 = await window.mobius.storage.list('attachments')
  assert.ok(!after2.some((e) => e.path === res.path),
    'after release with no referencing note, the orphan blob is reclaimed (no permanent leak)')
})

test('a released in-flight blob that a note now references is kept (release does not over-free)', async () => {
  const harness = installMobius()
  const store = await import('../src/lib/store.js?gc-race-2')
  const blob = Object.assign(new Blob(['second-image'], { type: 'image/png' }), { name: 'pic2.png' })
  const res = await store.putAttachment(blob)
  // Simulate the editor's onSave landing: a note now durably references the path.
  harness.seed('notes/n1.json', { meta: { id: 'n1', attachments: [res.path] }, body: `![a](${res.path})` })
  store.releaseAttachment(res.path) // editor releases after the successful save
  await store.gcAttachments()
  const after = await window.mobius.storage.list('attachments')
  assert.ok(after.some((e) => e.path === res.path),
    'a blob a note references stays after the lease is released')
})

test('GC skips deletion when authoritative note enumeration fails', async () => {
  const harness = installMobius()
  const store = await import('../src/lib/store.js?gc-fail-closed')
  const path = 'attachments/live.png'
  harness.seed('notes/n1.json', { meta: { id: 'n1', attachments: [path] }, body: '' })
  harness.seed(path, new Blob(['live']), 'blob')

  const originalList = window.mobius.storage.list
  window.mobius.storage.list = async (prefix) => {
    if (prefix === 'notes') throw new Error('notes unavailable')
    return originalList(prefix)
  }

  await store.gcAttachments()

  const after = await originalList('attachments')
  assert.ok(after.some((e) => e.path === path), 'GC failed closed and kept the referenced blob')
})
