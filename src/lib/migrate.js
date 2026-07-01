// One-time, idempotent migration of legacy markdown notes to the per-note JSON
// document model. Before this app version every note lived at notes/<id>.md as
// frontmatter-markdown; useDocument is JSON-only, so the canonical envelope moved
// to notes/<id>.json holding { meta, body } (body is still the markdown string).
// Existing installs have .md files on disk that the new code never reads, so
// without this pass the user's notes would vanish from the grid. This runs once
// at startup, BEFORE the first list/load, and is safe to re-run.
//
// Conservative order per note (never lose a note mid-migration):
//   1. If notes/<id>.json already exists, the note is already migrated. Leave it
//      AND any leftover .md alone — we can't prove the .json is on the server
//      without a re-put, and a re-put of our stale local copy could clobber a
//      newer edit from another device. The leftover .md is harmless (never read).
//   2. Otherwise read the legacy notes/<id>.md (getText), parse frontmatter →
//      { meta, body }; skip anything without a valid id.
//   3. durableWrite notes/<id>.json. The .md is deleted ONLY when that write
//      resolves durability === 'synced' (the server confirmed it). A 'queued'
//      (offline) write KEEPS the .md (queued is not proof of server arrival); a
//      dead-lettered write KEEPS the .md and the next startup retries. So the .md
//      is never removed unless its .json is provably on the server.
//
// `list('notes')` returns BOTH .md and .json during the transition; the new
// collection.list() ignores non-.json entries, so a half-migrated dir still
// renders every already-converted note.

import { parseFrontmatter } from './frontmatter.js'
import { notePath, legacyPath } from './note-doc.js'

const S = () => window.mobius.storage

const idFromMd = (name) => (name.endsWith('.md') ? name.slice(0, -3) : null)

// Migrate one legacy note id. Returns:
//   'migrated' — JSON written and the server CONFIRMED it (durability 'synced');
//                only then is the legacy .md removed.
//   'queued'   — JSON durably outboxed offline (durability 'queued', guaranteed
//                retry). The .md is KEPT: 'queued' is NOT proof the .json reached
//                the server (the queued write can still dead-letter on drain). The
//                .md stays a dormant, harmless fallback — collection.list() ignores
//                non-.json entries, so it never double-shows the note.
//   'already'  — a .json already exists for this id. We do NOT touch the .md here.
//                Removing it would require re-writing the existing .json to 'confirm'
//                it is on the server, but durableWrite is last-write-wins with no
//                CAS/fresh-read: a re-put of our stale local copy could clobber a
//                newer edit landed from another device. So we leave any leftover
//                .md in place (still harmless — never authoritative, never listed).
//   'skipped'  — no readable legacy note (already gone / malformed).
//   'deferred' — the JSON write dead-lettered (a fatal 4xx the server refused);
//                the .md is KEPT and the next startup retries.
// Never throws.
//
// The .md is removed in EXACTLY ONE place — the 'synced' branch below, the single
// run where this function parsed that .md, wrote its content as the .json, AND the
// server confirmed the write. It is never removed on a local get() (which overlays
// un-synced pending writes), never on 'queued', and never by re-confirming a
// pre-existing .json. That is the invariant: a note's .md fallback disappears only
// once its .json is provably on the server.
export async function migrateNote(id) {
  let json
  try { json = await S().get(notePath(id)) } catch { json = undefined }
  if (json && json.meta && json.meta.id === id) {
    // A .json already exists for this exact id. Do not re-write it (clobber risk,
    // see above) and do not delete the .md (we cannot prove the .json is on the
    // server without a clobbering re-put). Any leftover .md is a dormant fallback.
    return 'already'
  }

  // No .json yet — this run migrates the note. Parse the legacy .md.
  let text
  try { text = await S().getText(legacyPath(id)) } catch { text = null }
  if (text == null) return 'skipped'
  const { meta, body } = parseFrontmatter(text)
  if (!meta || !meta.id) return 'skipped'

  // durableWrite resolves DURABLE (synced | queued) or REJECTS DurableWriteError on
  // a dead-letter (a fatal 4xx). set() is NOT used: it falsely reports {synced} for
  // a dead-lettered write, which would delete the .md while the .json never landed.
  let res
  try { res = await S().durableWrite(notePath(id), { meta, body }, { kind: 'json' }) }
  catch { return 'deferred' } // dead-lettered — keep the .md, retry next startup
  if (res && res.durability === 'synced') {
    // Server CONFIRMED the .json. Only now is the .md fallback safe to remove.
    try { await S().remove(legacyPath(id)) } catch {}
    return 'migrated'
  }
  return 'queued' // durably outboxed but NOT server-confirmed — keep the .md
}

// Sweep notes/ once: migrate every legacy .md that has no .json yet. Best-effort
// and idempotent — a failed read/list leaves the dir as-is for the next startup.
// Returns the per-id results (handy for tests / a startup signal).
export async function migrateLegacyNotes() {
  let entries
  try { entries = await S().list('notes') } catch { return [] }
  const results = []
  for (const e of entries || []) {
    if (e.type !== 'file') continue
    const id = idFromMd(e.name)
    if (!id) continue
    results.push([id, await migrateNote(id)])
  }
  return results
}
