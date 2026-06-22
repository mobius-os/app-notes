// One-time, idempotent migration of legacy markdown notes to the per-note JSON
// document model. Before this app version every note lived at notes/<id>.md as
// frontmatter-markdown; useDocument is JSON-only, so the canonical envelope moved
// to notes/<id>.json holding { meta, body } (body is still the markdown string).
// Existing installs have .md files on disk that the new code never reads, so
// without this pass the user's notes would vanish from the grid. This runs once
// at startup, BEFORE the first list/load, and is safe to re-run.
//
// Conservative order per note (never lose a note mid-migration):
//   1. Read the legacy notes/<id>.md (getText, offline-capable via the cache).
//   2. Parse frontmatter → { meta, body }; skip anything without a valid id.
//   3. If notes/<id>.json already exists, the note is already migrated — only
//      delete a leftover .md (a prior run wrote the JSON then crashed before the
//      delete). Never overwrite a JSON doc that may hold newer edits.
//   4. Otherwise durably write notes/<id>.json. ONLY after that write is durable
//      (synced or queued) delete the .md. A non-durable/failed JSON write leaves
//      the .md untouched, so the next run retries — the note is never stranded.
//
// `list('notes')` returns BOTH .md and .json during the transition; the new
// collection.list() ignores non-.json entries, so a half-migrated dir still
// renders every already-converted note.

import { parseFrontmatter } from './frontmatter.js'
import { notePath } from './note-doc.js'

const S = () => window.mobius.storage

const legacyPath = (id) => `notes/${id}.md`
const idFromMd = (name) => (name.endsWith('.md') ? name.slice(0, -3) : null)

// Migrate one legacy note id. Returns:
//   'migrated' — JSON written + SYNCED to the server, legacy .md removed.
//   'queued'   — JSON durably written but only QUEUED (offline). Read-your-writes
//                shows the note from the queued JSON; the .md is KEPT as the
//                durable fallback until the JSON syncs (a queued write could in
//                principle dead-letter on drain — keeping the .md until the
//                server confirms eliminates that loss window). Cleaned up on the
//                next startup after reconnect (the 'already' branch).
//   'already'  — a .json already exists; only clean up a stray .md.
//   'skipped'  — no readable legacy note (already gone / malformed).
//   'deferred' — the JSON write was non-durable (storage full) — .md kept, retry.
// Never throws.
export async function migrateNote(id) {
  let json
  try { json = await S().get(notePath(id)) } catch { json = undefined }
  if (json && json.meta && json.meta.id) {
    // Already migrated — clean up any leftover legacy file, then done.
    try { await S().remove(legacyPath(id)) } catch {}
    return 'already'
  }

  let text
  try { text = await S().getText(legacyPath(id)) } catch { text = null }
  if (text == null) return 'skipped'
  const { meta, body } = parseFrontmatter(text)
  if (!meta || !meta.id) return 'skipped'

  let res
  try { res = await S().set(notePath(id), { meta, body }) } catch { return 'deferred' }
  if (res && res.synced === true) {
    try { await S().remove(legacyPath(id)) } catch {}
    return 'migrated'
  }
  if (res && res.queued === true) return 'queued' // durable, .md kept until synced
  return 'deferred' // non-durable resolve — keep the .md, retry next run
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
