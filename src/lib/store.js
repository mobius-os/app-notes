// Storage IO for Notes — the ONLY module that touches window.mobius.storage.
// Pure logic (parse/serialize/hash/index/merge/reconcile) lives in the other
// src/lib/* modules so it stays unit-testable; this glue is browser-only.
//
// Canonical notes live at notes/<id>.md (frontmatter + body). Attachments are
// content-addressed blobs at attachments/<sha>.<ext> (immutable, dedup'd).
// index.json is a DERIVED cache (titles/snippets) — rebuilt from the notes,
// never authoritative. Offline edits go to per-device draft paths (see
// reconciler.js, Phase G), never straight to the canonical path.

import { parseFrontmatter, serializeNote } from './frontmatter.js'
import { buildIndex } from './index-cache.js'
import { attachmentPath, extFromType } from './attachments.js'

const S = () => window.mobius.storage
const notePath = (id) => `notes/${id}.md`

// Hash raw bytes for content-addressed attachments (crypto.subtle is available
// in the same-origin secure-context iframe). hash.js handles string hashing for
// note content; binary is hashed here to avoid a lossy string round-trip.
async function sha256Bytes(buffer) {
  const digest = await crypto.subtle.digest('SHA-256', buffer)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

function extFromName(name) {
  const m = /\.([A-Za-z0-9]+)$/.exec(name || '')
  return m ? m[1].toLowerCase() : null
}

// Enumerate notes/ and parse each markdown file. Offline-capable (list + getText
// both read through the runtime's cache). Skips anything without a valid id.
export async function listNotes() {
  let entries
  try { entries = await S().list('notes') } catch { entries = [] }
  const out = []
  for (const e of entries || []) {
    if (e.type !== 'file' || !e.name.endsWith('.md')) continue
    const text = await S().getText(e.path)
    if (text == null) continue
    const { meta, body } = parseFrontmatter(text)
    if (meta && meta.id) out.push({ meta, body })
  }
  return out
}

export async function loadNote(id) {
  const text = await S().getText(notePath(id))
  return text == null ? null : parseFrontmatter(text)
}

// Write a note to its canonical path. The caller bumps meta.mobius_rev /
// content_hash first (see note.js). Returns {synced}|{queued}.
export async function saveNote(meta, body) {
  return S().setText(notePath(meta.id), serializeNote(meta, body), {
    contentType: 'text/markdown;charset=utf-8',
  })
}

export async function deleteNote(id) {
  return S().remove(notePath(id))
}

// Rewrite the derived index from the current in-memory notes. A cache for fast
// cold-load + the dreaming agent; discard-and-rebuild if ever stale.
export async function writeIndex(notes) {
  return S().set('index.json', buildIndex(notes))
}

export async function readIndex() {
  try { return await S().get('index.json') } catch { return null }
}

// Persist a conflict descriptor (a JSON object) at its conflicts/<id>/<hashes>.json
// path so tick.sh's resolver and the in-app "Resolve now" agent can find it.
// Mirrors writeIndex: the runtime's set() stores the bare JSON object at a .json
// path. (Was a missing `store.set` — undefined, so the conflict branch threw and
// no descriptor was ever written.)
export async function writeConflict(path, descriptor) {
  return S().set(path, descriptor)
}

// Store a File/Blob as a content-addressed attachment; returns
// {sha, ext, path, name}. Same bytes -> same sha -> same path (dedupe). The
// 25 MiB cap is enforced by setBlob (throws); callers surface an in-app message.
export async function putAttachment(file) {
  const buf = await file.arrayBuffer()
  const sha = await sha256Bytes(buf)
  const ext = extFromType(file.type) || extFromName(file.name) || 'bin'
  const path = attachmentPath(sha, ext)
  await S().setBlob(path, file, { contentType: file.type || 'application/octet-stream' })
  return { sha, ext, path, name: file.name || `${sha}.${ext}` }
}

// Resolve an attachment path to an object URL for <img>/download. The caller
// OWNS the URL lifetime — revoke it on unmount / next render.
export async function attachmentURL(path) {
  let blob
  try { blob = await S().getBlob(path) } catch { return null }
  return blob ? URL.createObjectURL(blob) : null
}

export const pendingCount = () => S().pendingCount()
export const isOnline = () => (window.mobius ? window.mobius.online : true)
