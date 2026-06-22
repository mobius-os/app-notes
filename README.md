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
- `src/lib/` — pure, unit-tested logic: `frontmatter` (YAML subset),
  `hash`, `note` (model + content hash), `attachments` (content-addressing),
  `index-cache` (derived grid index), `merge` + `sync` (3-way merge + reconcile
  decision), `store` (the only `window.mobius.storage` glue), `idb` + `local`
  (per-device offline working copy), `reconciler` (the sole canonical writer),
  `preview` (card markdown via marked + DOMPurify).
- `src/ui/` — `Grid`, `Card`, `EditorPanel`, `ColorPicker`, `ConfirmModal`, theme.
- `src/editor/` — the CodeMirror live-preview editor: `extensions` (markdown +
  highlight + shortcuts), `livePreview` (decorations: hide markers off the cursor
  line, checkboxes, images, files, math), `widgets`.

## Data layout (`/data/apps/<id>/`)

```
notes/<noteId>.json          canonical note: { meta, body } — body is markdown
attachments/<sha256>.<ext>   content-addressed image/file blobs (dedup'd)
conflicts/, leases/          sync working state (git-ignored)
index.json                   derived grid cache (rebuildable; never authoritative)
notes-meta.json              self-describing contract for the dreaming agent
.git/                        history snapshot (tick.sh cron)
```

Each note is a JSON document whose `body` field is plain markdown — still grep-,
git-, and dreaming-friendly. (As of v1.2.9 the persistence layer rides the
platform `useDocument` primitive, which is JSON-only; a one-time startup pass
migrates pre-existing `notes/<id>.md` files. The runtime owns durability now —
the old shadow outbox + reconcile driver were removed.)

## Offline + conflicts

Edits are written to a per-device working copy; the reconcile driver is the sole
writer of the canonical note (so the platform's last-write-wins outbox can't
clobber a merge). On reconnect it fast-forwards or runs a 3-way merge; a true
conflict becomes an immutable descriptor that the agent resolves — autonomously
via `tick.sh` (leased + verify-before-write) or on demand via the in-app
"Resolve now" button. `tick.sh` also git-snapshots the notes each tick.

See `DESIGN.md` for the full design and `docs/superpowers/plans/` for the build
plan.

## License

MIT
