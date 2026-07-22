# Notes

A clean notes app for [Möbius](https://github.com/mobius-os). Markdown renders
live as you type, with checklists, images and file attachments, LaTeX math,
pinning, per-note color, locking, and instant search. Notes work offline and
receive automatic local git snapshots.

## Development

Möbius installs a single JSX entry, while the maintainable source lives under
`src/` and builds into `index.jsx`:

```sh
npm install
npm run build        # bundle src/app.jsx -> index.jsx
npm test             # unit and render-harness regressions
npm run verify:mobius
```

`index.jsx` is generated. Edit `src/app.jsx` or `src/{lib,ui,editor}/*`, then
rebuild it.

### Source map

- `src/lib/` — note model and hashing, storage paths, the serialized collection
  for closed notes, content-addressed attachments and GC leases, derived index
  cache, legacy Markdown migration, preview sanitizing, search, and math parsing.
- `src/ui/` — grid, cards, editor panel, colors, confirmation modal, icons, and
  the app's single stylesheet.
- `src/editor/` — CodeMirror extensions, live-preview decorations, widgets, and
  the React wrapper.

## Data layout

Runtime data lives under `/data/apps/<numeric-app-id>/`:

```text
notes/<noteId>.json          canonical { meta, body } document
attachments/<sha256>.<ext>   content-addressed image/file blobs
index.json                   derived grid cache; never authoritative
notes-meta.json              self-describing data contract
signals.jsonl                text-free app activity signals
.git/                        local note snapshot history
```

The `body` field is plain Markdown. A startup migration safely converts legacy
`notes/<id>.md` files and removes each legacy file only after its JSON replacement
is server-confirmed.

## Persistence and offline behavior

The open note uses the platform's `useDocument(..., { mode: 'lww' })` primitive.
Closed-note updates use a small serialized last-write-wins collection over the
same storage contract. Notes deliberately adds no second merge engine, conflict
descriptor state machine, or agent resolver.

A write resolves only when it is either server-synced or durably queued in the
platform's offline outbox. Fatal refusals remain visible as **Save failed**, keep
the editor open, and are retried rather than reported as saved. Queued writes
are available immediately through the runtime's read-your-writes overlay and
drain after reconnection.

Concurrent writes to the same note are last-write-wins. When the platform
publishes a newer value, the open editor adopts it verbatim. A small local-echo
guard prevents an older optimistic save response from moving the cursor backward
when typing has already continued; it is not a merge or conflict subsystem.

A cold offline load paints `index.json` placeholders. Because enumeration may be
unavailable offline, the app keeps those placeholders until reconnection instead
of replacing them with a misleading empty state.

## Attachments

Attachments are immutable and content-addressed. Every save carries both the
existing attachment records and references found in the live editor body.
In-flight leases and the open-body pin prevent garbage collection from deleting
a blob before its note write becomes visible. GC skips entirely if authoritative
note enumeration is unavailable.

## History snapshots

`job.sh` runs every ten minutes. It is deterministic and agent-free: when note
content changed, it commits canonical notes and lightweight metadata to the data
directory's local git history. Derived files, activity signals, attachments,
temporary files, and legacy conflict/lease directories are ignored.

## Signals

Notes emits text-free activity signals for Reflection: `app_ready`, item
created/updated/opened/deleted, `attachment_added`, `search_no_results`, and
`error`. Note text, search terms, and attachment filenames are never included.

See `DESIGN.md` for the current architecture and invariants.

## License

MIT
