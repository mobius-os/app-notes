// Note model helpers: content identity (contentHash) and lifecycle (newNote,
// bumpRev). These are pure functions over plain `{meta, body}` records — no IO.
// The storage-IO layer (Phase E `store.js`) is what reads/writes the actual
// files; this module just defines what a note *is* and how its identity is
// computed (DESIGN §5, plan Phase C / Tasks C2–C3).

import {sha256Hex} from './hash.js'

// The fields that define a note's *content identity*. Everything else in
// frontmatter is volatile bookkeeping (updated, content_hash, mobius_rev,
// parent_rev, created, id) and must NOT feed the hash — otherwise two devices
// that made the same semantic edit would compute different hashes and a clean
// fast-forward would look like a conflict. Stable identity is exactly what the
// reconcile/merge layer compares (DESIGN §6).
//
// We normalize to a canonical shape with a fixed key order and defaulted values
// so the hash is invariant under meta key reordering and missing-vs-default
// fields. `JSON.stringify` of this fixed-shape object is the digest input.
//
// `tags` and `archived` belong to REMOVED features (v1.2) but stay in the hash
// input with their defaults: stored base hashes were computed over them, and
// dropping them from the digest would make every legacy note look remotely
// edited (a phantom conflict) on the first reconcile after the update. New
// notes never set them, so normalize()'s defaults keep their hashes identical
// to an explicit `tags: [], archived: false`.
//
// Attachments are content too: a stranded image/file can live only in
// meta.attachments, so an attachment-only update must not look like a no-op.
function normalize(meta, body) {
  return {
    title: meta.title ?? '',
    body: String(body ?? ''),
    pinned: meta.pinned ?? false,
    locked: meta.locked ?? false,
    color: meta.color ?? null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
    attachments: Array.isArray(meta.attachments) ? meta.attachments : [],
    type: meta.type ?? 'note',
    archived: meta.archived ?? false,
  }
}

export async function contentHash(meta, body) {
  const canonical = normalize(meta, body)
  // Fixed key order: build the JSON from an explicit field list, not from
  // Object.keys, so reordering the input meta can never change the digest.
  const json = JSON.stringify([
    canonical.title,
    canonical.body,
    canonical.pinned,
    canonical.locked,
    canonical.color,
    canonical.tags,
    canonical.attachments,
    canonical.type,
    canonical.archived,
  ])
  return sha256Hex(json)
}

function nowIso() {
  return new Date().toISOString()
}

// A brand-new note: a fresh uuid, rev 1 based on the implicit empty rev 0, and
// the design's default frontmatter (DESIGN §5). created === updated at birth.
// `type` defaults to 'note'; pass 'checklist' to start in checklist mode.
// No `tags`/`archived` — those features are gone; normalize() defaults keep
// the content hash identical to the explicit-default form legacy notes carry.
export function newNote({title, type} = {}) {
  const ts = nowIso()
  return {
    id: globalThis.crypto.randomUUID(),
    title: title ?? '',
    pinned: false,
    locked: false,
    color: null,
    type: type ?? 'note',
    created: ts,
    updated: ts,
    mobius_rev: 1,
    parent_rev: 0,
    attachments: [],
  }
}

export function isBlankNote(meta = {}, body = '') {
  const hasTitle = Boolean((meta.title || '').trim())
  const hasBody = Boolean(String(body || '').trim())
  const hasAttachments = Array.isArray(meta.attachments) && meta.attachments.length > 0
  return !hasTitle && !hasBody && !hasAttachments
}

// Advance a note one canonical revision: the new rev's parent is the rev we
// based this write on, and `updated` is refreshed. Returns a NEW object — the
// caller's input is never mutated, so a failed write can't leave a half-bumped
// meta behind.
export function bumpRev(meta) {
  const oldRev = meta.mobius_rev ?? 0
  return {
    ...meta,
    mobius_rev: oldRev + 1,
    parent_rev: oldRev,
    updated: nowIso(),
  }
}
