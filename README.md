# Notes

A clean, boxy notes app for [Möbius](https://github.com/mobius-os). Markdown that
renders **live as you type** (CodeMirror 6, Obsidian-style), with inline images
and file attachments, LaTeX math (KaTeX), pinning, per-note color, and instant
search. Notes work offline, are git-tracked, and merge-conflicts that can't
auto-merge are handed to an agent. Notes live on disk as plain markdown so the
Möbius dreaming agent can read them.

## How it's built

Möbius mini-apps are a single JSX file, but this app keeps a maintainable,
unit-tested multi-file source under `src/` and **builds** it into the deployable
`index.jsx`:

```
npm install      # esbuild + node-diff3 (dev only)
npm run build    # bundle src/app.jsx -> index.jsx (single file, react/codemirror/
                 # katex/esm.sh kept external for the app frame's import map)
npm test         # node --test over the pure logic in src/lib/*
```

`index.jsx` is a generated build artifact — edit `src/app.jsx` and the
`src/{lib,ui,editor}` modules, then `npm run build`.

### Source map
- `src/lib/` — pure, unit-tested logic + the storage glue:
  `frontmatter` (YAML subset), `hash`, `note` (model + content hash),
  `note-doc` (the per-note JSON document model + `merge3`/`mergeMeta`-based 3-way
  merge and the conflict descriptor), `merge` (the pure 3-way body/frontmatter
  merge over node-diff3), `collection` (the per-note `window.mobius.storage`
  document store — the sole note-document writer, offline-null-aware `list()`),
  `store` (the non-document storage glue: attachments, the derived index cache,
  conflict descriptors), `attachments` + `attachment-leases` (content-addressing,
  in-flight GC pins), `sdr-image` (Ultra-HDR → SDR flatten), `index-cache`
  (derived grid index + cold-load placeholders), `migrate` (one-time legacy
  `notes/<id>.md` → JSON migration), `math-scan`, `visible` (search + sort),
  `preview` (card markdown via marked + DOMPurify).
  (The old `sync`/`idb`/`local`/`reconciler` modules are GONE — durability moved
  to the platform runtime's serialized per-path writer + offline outbox.)
- `src/ui/` — `Grid`, `Card`, `EditorPanel`, `ColorPicker`, `ConfirmModal`,
  `icons`, `colors`, and `css` (the one module-level stylesheet).
- `src/editor/` — the CodeMirror live-preview editor: `extensions` (markdown +
  highlight + shortcuts), `livePreview` (decorations: hide markers off the cursor
  line, checkboxes, images, files, math), `widgets`, `Editor` (the React wrapper).

## Data layout (`/data/apps/<id>/`)

```
notes/<noteId>.json          canonical note: { meta, body } — body is markdown
attachments/<sha256>.<ext>   content-addressed image/file blobs (dedup'd)
conflicts/, leases/          conflict descriptors + resolver leases (git-ignored)
index.json                   derived grid cache (rebuildable; never authoritative)
notes-meta.json              self-describing contract for the dreaming agent
signals.jsonl                app analytics for Reflection (see "Signals" below)
.git/                        history snapshot (tick.sh cron)
```

Each note is a JSON document whose `body` field is plain markdown — still grep-,
git-, and dreaming-friendly. (As of v1.2.9 the persistence layer rides the
platform `useDocument` primitive, which is JSON-only; a one-time startup pass
migrates pre-existing `notes/<id>.md` files. The runtime owns durability now —
the old shadow outbox + reconcile driver were removed.)

## Offline + conflicts

Durability rides the platform runtime: a note write goes through
`storage.durableWrite`, which resolves `synced` (on the server) or `queued`
(durably outboxed offline, drains on reconnect) or REJECTS on a fatal refusal —
so a failed save is a visible error, never a false "saved". Concurrent same-note
edits 3-way-merge via `merge3`; a genuine overlapping-body conflict lands MINE's
body on the note file and emits an immutable descriptor under `conflicts/`, the
only surviving copy of the losing side's body. The agent resolves it —
autonomously via `tick.sh` (leased + verify-before-write against `mine.body`, the
body the app persisted) or on demand via the in-app "Resolve now" button. When
an external writer (the resolver or another device) rewrites an OPEN note, the
editor 3-way-merges the incoming body into the live buffer and repaints, so a
resolution is never clobbered by a stale autosave. `tick.sh` also git-snapshots
the notes each tick.

Reads stay offline-first: `storage.get()` overlays queued writes (read-your-
writes), and a cold offline load paints the `index.json` cache. `storage.list()`
has NO offline mirror, so the grid keeps its cached placeholders when enumeration
is unavailable (rather than wiping to empty) and re-lists on reconnect.

## Signals

The app emits `window.mobius.signal(name, payload)` analytics for Reflection's
nightly digest (buffered, flushed to `signals.jsonl`; flat-primitive payloads,
no note text or filenames): `app_ready {item_count, offline}`,
`item_created`/`item_updated`/`item_opened`/`item_deleted {type}`,
`attachment_added {kind, bytes, flattened}`, `search_no_results {query_len}`,
`conflict_raised`/`conflict_resolved`, `error {message, source}`, and a
`cron_summary {status, conflicts_open, conflicts_resolved}` appended once per run
by `tick.sh`.

## Maintenance

`tick.sh` runs on a fixed **every-10-minutes** cron (`mobius.json` → `schedule`,
not user-editable): it git-snapshots the notes and resolves any open merge
conflicts. To change the cadence, ask the Möbius agent to reschedule it.

See `DESIGN.md` for the full design and `docs/superpowers/plans/` for the build
plan.

## License

MIT
