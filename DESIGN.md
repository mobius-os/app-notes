# Notes for Möbius — current design

## 1. Goal

Notes is a fast, local-feeling writing surface for one Möbius owner. It supports
live Markdown, checklists, math, attachments, pinning, color, locking, and search
without inventing a persistence system beside the platform's own.

The durable design is intentionally small:

1. one JSON document per note;
2. platform last-write-wins synchronization;
3. explicit, visible handling of rejected writes;
4. derived caches that can always be rebuilt;
5. automatic local git history for recovery.

### Non-goals

- collaborative cursors or multi-user editing;
- a CRDT or application-level three-way merge engine;
- conflict descriptors, leases, or an agent resolver;
- a second offline queue;
- arbitrary external network content in previews.

## 2. Platform contract

The app runs in a sandboxed Möbius frame and persists only through
`window.mobius.storage` and `window.mobius.createUseDocument(React)`.

- The open note always owns one stable `useDocument` hook position.
- Grid actions and draft creation use the imperative collection because the note
  set is dynamic and unbounded.
- Both paths use the platform's serialized writer and offline outbox.
- A result with durability `synced` or `queued` is durable success.
- A fatal write refusal rejects and must never be rendered as saved.
- `storage.get()` provides the queued-write overlay. Enumeration may be
  unavailable offline, so a failed list is distinct from a confirmed empty list.

## 3. Document model

Canonical notes live at `notes/<id>.json`:

```json
{
  "meta": {
    "id": "uuid",
    "title": "Weekend list",
    "created": "ISO timestamp",
    "updated": "ISO timestamp",
    "pinned": false,
    "locked": false,
    "color": null,
    "type": "note",
    "attachments": [],
    "mobius_rev": 1,
    "parent_rev": 0,
    "content_hash": "sha256"
  },
  "body": "# Markdown body"
}
```

`content_hash` covers semantic content and suppresses no-op writes. Revision
fields remain for format compatibility and ordinary local history; they do not
encode merge ancestry.

The JSON envelope is required by the document primitive. The body remains plain
Markdown so it is readable by people, git, search, and authorized Möbius agents.

## 4. Last-write-wins behavior

The open note calls `useDocument(path, { initial, identity, mode: 'lww' })` with
no app-supplied merge callback. The collection writes closed notes verbatim after
serializing updates per path.

When two devices write the same note, the platform's later value wins. The app
does not attempt to combine bodies or metadata. This tradeoff is explicit: a
simple convergence rule avoids the former class of permanent save locks, while
automatic git snapshots provide a recovery trail.

The editor mirrors a newer platform value into CodeMirror immediately. Local
optimistic writes are marked only long enough to recognize their echo. If the
owner continues typing before an older echo arrives, that echo cannot rewind the
buffer or cursor. Any genuinely external value is adopted verbatim and does not
trigger a stale autosave back over itself.

## 5. Save and close invariants

- The CodeMirror document is the source of truth for the live body.
- Autosave is debounced, but Back, shell Back, visibility changes, attachment
  actions, and note switches flush through the same save path.
- Closing waits for every in-flight save.
- A rejected save keeps the editor open, retains the optimistic buffer, shows
  **Save failed**, and marks the note for an exact-content retry.
- A queued offline write is durable success, not an error.
- Success clears both the visible error and the forced-retry marker.
- Drafts become real notes only after their first durable nonblank save.

## 6. Attachments and garbage collection

Attachments live at `attachments/<sha256>.<ext>` and deduplicate by content.
Every note save unions existing metadata with attachment references found in the
live Markdown body.

A blob receives an in-flight lease before it is written. The lease is released
after the note durably references it or after attachment failure cleanup. GC
also pins every reference in the open editor body. It removes only blobs absent
from all authoritative notes, all open-body pins, and all in-flight leases. If
note enumeration fails, GC does nothing.

Ultra-HDR images are flattened to SDR before storage when needed. Object URLs
are revoked when previews change or unmount.

## 7. Derived index and offline loading

`index.json` contains lightweight card projections and is never authoritative.
Startup may paint its records as placeholders while canonical notes are listed.
A placeholder cannot be edited or deleted until its full note document is loaded.

If listing is unavailable offline, the cache remains visible. On reconnection the
app re-lists canonical notes and replaces placeholders. A confirmed empty list is
the only state that renders “No notes yet.”

## 8. Legacy migration and path compatibility

Startup migrates legacy `notes/<id>.md` records to JSON. The Markdown file is
removed only after the JSON write is server-confirmed; queued or refused writes
leave it intact for retry.

The collection remembers actual storage paths and tolerates historical records
whose filename and `meta.id` disagree. Deletion removes the remembered JSON path,
the canonical path, and dormant legacy Markdown variants so deleted notes cannot
resurrect on the next migration.

## 9. Git history

The manifest schedules `job.sh` every ten minutes. The job:

- initializes git in the numeric app data directory if necessary;
- stages only `.gitignore`, `notes/`, and `notes-meta.json`;
- commits only when that canonical set changed;
- never invokes an agent and never rewrites note content;
- logs staging or commit failures;
- ignores attachments, the derived index, signals, temporary files, drafts, and
  legacy conflict/lease directories.

The schedule is fixed. It is restored by the platform from the manifest during
install/update and after restart.

## 10. Rendering and security

- Markdown card previews are sanitized and cannot load arbitrary remote media.
- Attachment resolution stays inside app-scoped storage.
- KaTeX styling comes from the platform's versioned local asset.
- No native dialogs are used; confirmations are in-app and accessible.
- Touch targets meet the 44px floor and text inputs avoid iOS zoom.
- The editor is a focus-managed modal surface with safe-area padding and a
  save-aware shell Back handler.
- Signals contain only primitive operational metadata, never note text, search
  terms, or filenames.

## 11. Verification

The test suite covers:

- last-write-wins collection updates and serialized write order;
- queued offline writes, fatal refusals, exact retries, and save-aware closing;
- external editor repaint and stale local-echo protection;
- legacy migration and delete-without-resurrection;
- attachment reference preservation, leases, and conservative GC;
- offline placeholder loading and reconnect replacement;
- index, hashing, search, preview sanitizing, checklist, and layout contracts;
- the real platform document primitive when a platform checkout is supplied;
- generated bundle parity via `npm run verify:mobius`.

A release is complete only when the source tests pass, `index.jsx` is rebuilt,
the live app can save/reload online and offline, migration fixtures survive, an
attachment round-trip succeeds, and the scheduled snapshot produces a clean,
recoverable git commit.
