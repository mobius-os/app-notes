// Note model helpers: content identity (contentHash) and lifecycle (newNote,
// bumpRev). These are pure functions over plain `{meta, body}` records — no IO.
// The storage-IO layer (Phase E `store.js`) is what reads/writes the actual
// files; this module just defines what a note *is* and how its identity is
// computed (DESIGN §5, plan Phase C / Tasks C2–C3).

import {sha256Hex, cryptoProvider} from './hash.js'

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
function normalize(meta, body) {
  return {
    title: meta.title ?? '',
    body: String(body ?? ''),
    pinned: meta.pinned ?? false,
    color: meta.color ?? null,
    tags: Array.isArray(meta.tags) ? meta.tags : [],
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
    canonical.color,
    canonical.tags,
  ])
  return sha256Hex(json)
}

function nowIso() {
  return new Date().toISOString()
}

// A brand-new note: a fresh uuid, rev 1 based on the implicit empty rev 0, and
// the design's default frontmatter (DESIGN §5). created === updated at birth.
export function newNote({title} = {}) {
  const ts = nowIso()
  return {
    id: cryptoProvider.randomUUID(),
    title: title ?? '',
    pinned: false,
    color: null,
    tags: [],
    created: ts,
    updated: ts,
    mobius_rev: 1,
    parent_rev: 0,
    attachments: [],
  }
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
