// Pure helpers for content-addressed attachments. NO IO lives here — the
// actual blob read/write (`putAttachment`, `getAttachmentURL`) happens in the
// storage-IO layer (Phase F/G). This module only computes the canonical path
// for a given content hash and renders the markdown that references it.
//
// Attachments are content-addressed: a blob's path is derived from the sha-256
// of its bytes, so identical content maps to one path and storing it twice is a
// no-op dedupe (DESIGN §4–5). The note body just holds a markdown ref; changing
// the referenced bytes means a new sha, never an in-place mutation.

// The on-disk path under the app data root for a blob with content hash `sha`.
export function attachmentPath(sha, ext) {
  return `attachments/${sha}.${ext}`
}

// Map a MIME type to a file extension. Covers the image/doc/text types the
// editor's attach UI produces. Returns null for an unrecognized type so the
// caller can fall back to the FILENAME's extension before defaulting to `bin`
// (returning 'bin' here short-circuited that fallback, so a .zip/.csv upload
// landed as .bin). Case-insensitive and parameter-tolerant
// (`text/plain; charset=utf-8` → `txt`).
const TYPE_TO_EXT = {
  'image/png': 'png',
  'image/jpeg': 'jpeg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
  'text/plain': 'txt',
}

export function extFromType(type) {
  if (!type) return null
  const base = String(type).split(';')[0].trim().toLowerCase()
  return TYPE_TO_EXT[base] ?? null
}

// Inline image embed: `![alt](attachments/<sha>.<ext>)`. The live-preview editor
// replaces this with an <img> widget; card previews render it via marked.
export function imageRefMarkdown(alt, sha, ext) {
  return `![${alt ?? ''}](${attachmentPath(sha, ext)})`
}

// Non-image file reference rendered as a download chip: a plain markdown link
// (not an embed) so it shows as a clickable filename, not an inline image.
export function fileChipMarkdown(name, sha, ext) {
  return `[${name}](${attachmentPath(sha, ext)})`
}

// Every attachment path one note references: `meta.attachments` plus any
// `](attachments/…)` link/embed target in its body. Used by the GC sweep to
// decide which content-addressed blobs are still reachable.
const BODY_ATTACHMENT_REF = /\]\((attachments\/[^)\s]+)\)/g
export function noteAttachmentRefs(meta = {}, body = '') {
  const refs = new Set()
  if (Array.isArray(meta.attachments)) {
    for (const p of meta.attachments) if (typeof p === 'string' && p.startsWith('attachments/')) refs.add(p)
  }
  let m
  BODY_ATTACHMENT_REF.lastIndex = 0
  while ((m = BODY_ATTACHMENT_REF.exec(String(body || '')))) refs.add(m[1])
  return refs
}

// The set of attachment paths reachable from ANY live note. Blobs are
// content-addressed and dedup'd, so a path may be shared across notes — the GC
// sweep must keep a blob alive while even one note still references it.
export function referencedAttachments(notes = []) {
  const refs = new Set()
  for (const n of notes) {
    if (!n) continue
    for (const p of noteAttachmentRefs(n.meta || {}, n.body || '')) refs.add(p)
  }
  return refs
}
