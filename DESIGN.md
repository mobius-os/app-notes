# Notes for Möbius — design spec

Status: draft for review · 2026-06-03 · target repo `mobius-os/app-notes`

## 1. Goal

A boxy, card-based notes app for Möbius. Notes are **markdown that renders
live as you type** (Obsidian "Live Preview" style), with **inline images and
file attachments**, **LaTeX math**, **handy formatting shortcuts**,
**pinning**, per-note color, and instant search. It is
**beautiful, consistent with Möbius (charcoal + violet, Inter / JetBrains
Mono), and follows good UI/UX practice.** It **works offline**, keeps a **git
history**, and when offline edits collide on reconnect it **auto-merges**, or
**invokes an agent** when auto-merge fails. Notes live on disk as plain
markdown so the **dreaming agent** can read them cleanly.

Ships as an **app-store app** (`mobius-os/app-notes`): one `index.jsx`, one
`mobius.json`, a generated `icon.png`, and bundled cron jobs — **plus a small,
well-precedented platform change** that vendors the editor foundation
(CodeMirror 6 + KaTeX) under `/vendor`, exactly as three.js and React are
vendored today (see §4, §13). Sizing justifies it: CM6 is smaller than the
already-vendored three.js (§4). The only other optional platform touch is one
line in the dreaming skill (see §9).

We do not reference or imitate the Google Keep brand. The name is **Notes**
(slug `notes`); easy to rename before ship.

### Non-goals (YAGNI)
- Real-time collaborative cursors / CRDT. Single-owner; per-note 3-way merge is
  enough. (The runtime explicitly scopes CRDTs out.)
- Multi-device *branch* sync. We do per-note reconcile, not per-device git
  branches.
- A server endpoint for atomic conditional writes. We work entirely within the
  existing storage API + cron + agent primitives.
- Sharing notes between apps or users.

## 2. Platform facts this design is built on

(Confirmed by reading the codebase, not assumed.)

- A mini-app is **one JSX file** esbuild-compiles server-side. React 19.2 comes
  from the importmap (`/vendor/react`). Apps may use esm.sh libs at runtime;
  for **offline**, esm.sh modules are **runtime-cached** by the service worker
  (`url.hostname === 'esm.sh'` → CacheFirst) — a *warm-cache* model: a dep
  works offline only after one online load. `mobius.json`'s `esm_deps` is
  metadata only (no backend wiring).
- `window.mobius.storage` — `get/getText/getBlob`, `set/setText/setBlob`,
  `remove`, `list`, `subscribe*`, `pendingCount`. Reads are **SWR**; writes go
  through an IndexedDB **outbox that is last-write-wins per path**, coalesced,
  drained under a cross-context Web Lock. **There is no conditional/atomic
  write.** Blob cap 25 MiB. Per-path in-tab serialization; cross-runtime reads
  can momentarily diverge and self-heal.
- Sandbox: `allow-scripts allow-same-origin allow-forms allow-popups
  allow-top-navigation-by-user-activation`. **No `allow-modals`** → no
  `alert/confirm/prompt`; build in-app modals. Same-origin → `fetch('/api/…')`
  works with the owner JWT. CSP `connect-src 'self' https://esm.sh`.
- User-rendered HTML must pass **DOMPurify**.
- Cron: apps ship `job.sh` / `fetch.sh`; `init-cron-scaffold.sh <slug> "<sched>"
  <job> [app-id]` installs a restart-surviving entry. Cron jobs run `claude -p`
  with tools + the service token at `/data/service-token.txt`.
- App→agent with tools: an **app token cannot** call `/api/ai` with tools.
  Tool-capable agents come from (a) a **cron CLI** job, or (b) the owner shell
  via `window.parent.postMessage({type:'moebius:new-chat', draft})`.
- The **dreaming** agent runs nightly with full Bash/Read over `/data`; it
  discovers app data by inspecting `/data/apps/<id>/…` (no advertised contract
  today). Writes the knowledge graph to `/data/shared/memory/`.
- App data dir is keyed by the **numeric app id** at runtime
  (`/data/apps/<numericId>/…`), addressed from the app as
  `storage.<op>('<path>')` (the runtime prefixes the app root). On-disk source
  is `/data/apps/<slug>/index.jsx`.

## 3. UX

Möbius dark theme via CSS vars (never hardcode): `--bg #0d0d0d`, `--surface`,
`--surface2`, `--border`, `--text`, `--muted`, `--accent` (violet `#a78bfa`),
`--green`, `--danger`, `--font` Inter, `--mono` JetBrains Mono. Read them with a
`cssVar(name, fallback)` helper so theme switches reflow live.

**Grid (home).** Responsive masonry of note **cards** (CSS columns; 1 col phone
→ 2–4 desktop). A **Pinned** section sits above **Others**. Each card shows:
title, a **read-only markdown preview** (truncated, with checkboxes + a first
inline image thumbnail), color accent, a pin toggle, and an attachment/`⋯`
affordance. Tap a card → editor. A top bar holds **search** (instant,
client-side over title+body) and a floating **+** button creates a note —
there is no inline capture row and no view toggle. Empty state is a friendly
prompt, not a blank screen.

**Card actions** (no native dialogs): pin/unpin, color picker (muted ink-tone
palette: slate / moss / sand / clay / plum + default, mixed from theme
tokens), delete (in-app **ConfirmModal**). There is no archive and there are
no tags (legacy notes carrying either still open fine; the fields are
ignored).

**Editor (note open).** Full-card surface with the **live-inline markdown**
editor (§4). Header: editable title, pin, color, attach (📎 image / file),
created/updated. Auto-saves (debounced) — no save button; opening (or a
no-op flush) never bumps `updated`, only a real edit does, and the grid
sorts by last edit. Back returns to grid. On mobile the editor is
full-screen; the keyboard-resize quirk is handled by sizing to the stable
viewport.

**Status.** Silent when healthy: saving/pending is plumbing and never
rendered. Only `Offline` and an actionable `Resolving…` conflict state
surface. A conflicted note shows a small banner:
"Edited in two places — merging…" and, when the agent finishes, updates live
via `subscribe`.

**Accessibility / polish.** Real buttons with `aria-label`; focus rings; 44px
touch targets; reduced-motion respected; no layout shift on image load
(reserve aspect ratio). Hidden scrollbars (frame already does this).

## 4. Editor — live-inline markdown (CodeMirror 6)

CM6 is the engine behind Obsidian Live Preview: markdown tokens hide + style in
place on inactive lines, raw syntax shows only on the cursor's line, and
image/checkbox/embed syntax is replaced by **widget decorations**. That is
exactly "renders as markdown as you type."

- **Delivery: vendor the editor foundation under `/vendor` as a general
  platform dependency** (revised after sizing). Measured minimal CM6 set =
  **556 KB raw / 188 KB gzip**; KaTeX JS = **259 KB / 74 KB gzip** — *smaller
  than the already-vendored three.js (~1.2 MB / ~340 KB gzip) and ~React-sized.*
  So CM6 + KaTeX are vendored exactly like three/React: an image-build
  `npm install` + a small bundle script copies them to
  `/app/static/vendor/codemirror@6/` and `/vendor/katex@…/` (KaTeX **CSS +
  fonts** copied too, for offline math), and `app-frame.html`'s importmap gains
  `codemirror` + `katex` specifiers.
- **Pull only the pieces we use** (owner's steer): the vendored CM6 bundle
  includes only `@codemirror/state`, `@codemirror/view`, `@codemirror/commands`,
  `@codemirror/language`, `@codemirror/lang-markdown` (+ our extension) — **no**
  `basicSetup`, autocomplete, lint, or search — so it stays ~React-sized.
- **Build CM6 as ONE bundled module** exposed under importmap specifier
  `codemirror`. A single bundle makes `@codemirror/state` a **guaranteed
  singleton** (the instanceof gotcha disappears), is **precached → bulletproof
  offline** (no esm.sh warm-cache fragility), and is **reusable by future apps**
  (a code editor, the latex app, a wiki). `marked` + `DOMPurify` stay on esm.sh
  (tiny, already proven offline in mind/news).
- **Live-preview extension:** a small custom decoration set: heading sizing,
  bold/italic/strike/code styling, hide markers off the active line, task-list
  checkboxes as interactive widgets (toggle writes back to the doc), `![]()`
  image syntax → `<img>` widget resolved from an attachment blob, and
  `[[file]]`/attachment refs → a file chip widget.
- **LaTeX math:** inline `$…$` and block `$$…$$` rendered live with **KaTeX**
  (esm.sh; the shell already ships KaTeX) through the same widget-decoration
  mechanism as images/checkboxes — math renders **in place**, and the raw `$…$`
  source reappears on the cursor's line for editing. Card previews render math
  read-only too.
- **Shortcuts (the "edit directly, nicely" ask):** a small custom keymap —
  Cmd/Ctrl-B / -I for bold/italic, heading cycle, link, inline code, toggle
  checkbox — plus markdown **input rules** (Enter continues a list / quote /
  task; `>`/`-`/`1.`/`- [ ]` auto-format) and an optional `/` **slash menu**
  (h1, todo, image, table, math). All cheap via CM6's keymap/transaction API; no
  heavy autocomplete extension needed.
- **Inline images / files:** 📎 or paste/drop → read File → `setBlob` to
  `attachments/<sha256>.<ext>` (content-addressed, dedup, immutable) → insert
  `![alt](attachments/<sha>.<ext>)` (image) or an attachment chip token (file).
  Widgets load blobs via `getBlob` → object URL (revoked on unmount). Enforce
  the 25 MiB cap with an in-app message; large media → guidance to attach a
  link instead.
- **Read-only card preview** uses lightweight `marked` + **DOMPurify** (both
  already proven offline in mind/news), not CM6 — cheap to render many cards.

## 5. Data model & storage layout

```
notes/<noteId>.md                  canonical note (frontmatter + markdown)
attachments/<sha256>.<ext>         content-addressed blobs (images + files)
drafts/<deviceId>/<noteId>/<opId>.md   offline edits land HERE, never canonical
conflicts/<noteId>/<conflictId>.json   immutable, versioned conflict descriptors
leases/<noteId>.json               resolver lease (resolverId, leaseUntil, descriptorHash)
index.json                         DERIVED cache (rebuildable); never authoritative
notes-meta.json                    self-describing data contract for dreaming
.git/                              server-side history (cron snapshot)
```

**Note file** = YAML frontmatter + markdown body:

```markdown
---
id: 9f3c…                # stable uuid
title: Weekend list
pinned: true
color: violet
tags: [home, shopping]
created: 2026-06-03T09:00:00Z
updated: 2026-06-03T10:12:00Z
mobius_rev: 7            # monotonically bumped on each canonical write
parent_rev: 6           # rev this write was based on
content_hash: sha256…   # hash of the body (+ normalized frontmatter)
attachments: [sha256…, sha256…]
---
# Weekend list
- [x] bread
- [ ] eggs
![receipt](attachments/ab12….jpg)
```

- **`content_hash` + `mobius_rev`/`parent_rev` in frontmatter are the
  authoritative base identity** (Codex's key correction — IndexedDB is a
  per-device UX cache only, never the source of truth).
- **`index.json` is strictly derived** (title/snippet/pinned/color/updated for
  fast grid load). If stale or conflicting, discard and rebuild from
  `notes/*.md`. Never merge it.
- **Attachments are content-addressed and immutable** → no in-place mutation,
  no attachment merge conflicts; a note edit just changes which `sha` it
  references.

## 6. Offline + sync + 3-way merge (the hardened protocol)

The platform is last-write-wins with **no atomic write**, so we must not let the
outbox replay a stale full-file write over a completed merge. Design rules:

1. **Never write offline edits to the canonical path.** Offline (and, simplest,
   *all* in-progress) edits write to **per-device draft paths**
   `drafts/<deviceId>/<noteId>/<opId>.md`. These are unique per device+op, so
   the outbox LWW can never clobber another device's work. `deviceId` is a
   stable uuid in app-local IndexedDB; `opId` per save.
2. **Reconcile on reconnect** (and on app open when online). For each note with
   a pending draft, fetch canonical `notes/<id>.md`:
   - canonical `content_hash == draft.baseHash` → **fast-forward**: write
     `mine` to canonical with `parent_rev = baseRev`, `mobius_rev = baseRev+1`;
     clear the draft.
   - else **diff3(base, mine, server)**:
     - **clean** → write merged to canonical (new rev, `parent_revs:[mine,
       server]`); clear the draft.
     - **conflict** → write an **immutable** descriptor (below); leave canonical
       untouched; surface "merging…"; the agent resolves (§8).
3. **Re-check before every canonical write.** Immediately before writing a
   merge/fast-forward result, re-read canonical and verify its `content_hash`
   still equals what the merge was computed against. If it changed (another
   device landed a write in the gap), abort and create/append a conflict
   instead of writing. This is best-effort CAS on top of LWW — it closes most
   of the race the platform can't close atomically; the residual window is
   documented and caught by the next reconcile.
4. **diff3 scope:** merge the **markdown body** line-wise (a small vendored
   diff3, esm.sh, warm-cached). Frontmatter is **not** diff3'd — it's merged
   field-wise (union tags, last-writer title/color/pin by `updated`, recompute
   rev/hash). Body conflict markers, if any survive, are what the agent
   resolves.

**Conflict descriptor** (immutable; unique path keeps two distinct conflicts
from overwriting each other):

```
conflicts/<noteId>/<baseHash>.<mineHash>.<serverHash>.json
{ noteId, baseRev, baseHash, base, mineHash, mine, serverHash, server,
  observedServerHash, attachmentsMine, attachmentsServer,
  createdByDeviceId, opId, status: "open", createdAt }
```

## 7. Git history

A cron **snapshot** job (`snapshot.sh`, e.g. every 10 min + on a `claude`-less
shell) runs over `notes/` only:

- `.git` initialized on first run; `git add notes/ && git commit` when dirty.
- **Ignores** `drafts/`, `conflicts/`, `leases/`, `index.json`, and any
  temp/rename-in-progress files → never snapshots a transitional state.
- Canonical writes use **atomic rename** (write `…/<id>.md.tmp`, fsync, rename)
  so the snapshot never sees a half-written file.
- Gives history/audit, time-travel, and dreaming a clean log. (App-source git —
  feature 084 — is separate and untouched; this is *note-content* git.)

## 8. Agent conflict resolver

When a descriptor exists, a tool-capable agent resolves it. Two triggers, one
safe protocol:

- **Autonomous:** a cron **CLI** job (`resolve.sh`, `claude -p` with
  `Read,Write,Edit,Bash` + service token) scans `conflicts/*/**.json` with
  `status:"open"`.
- **On demand:** a **"Resolve now"** button posts
  `moebius:new-chat` with a draft pointing the owner agent at the descriptor.

**Safe resolution (lease + verify, idempotent):**
1. **Lease**: atomically claim `leases/<noteId>.json`
   (`{resolverId, leaseUntil, descriptorHash}`); if a live lease exists, skip
   (prevents cron + "Resolve now" double-resolving).
2. **Re-verify**: read canonical; require `content_hash ==
   descriptor.serverHash`. If it changed, **abandon** (write a superseding
   conflict), don't clobber.
3. **Merge**: 3-way merge `base/mine/server` (the agent reasons about semantics,
   not just lines — its real advantage over diff3), preserving attachment refs.
4. **Write** canonical with `parent_revs:[mineRev, serverRev]`, new rev/hash via
   atomic rename.
5. **Finalize**: only if the written note's hash matches what it wrote, set
   descriptor `status:"resolved"`, release the lease. The app's `subscribe` on
   `notes/<id>.md` updates the card live.

This is the "code empowers the agent" path Möbius is built around: no
server-side merge engine, a smart agent handles what a sanitizer can't.

## 9. Dreaming integration

- Notes are plain `notes/<id>.md` (frontmatter + markdown) → dreaming reads them
  by globbing, no new API. `notes-meta.json` advertises the contract:
  `{ "app":"notes", "data_type":"notes", "format":"markdown+frontmatter",
     "dir":"notes/", "index":"index.json", "attachments":"attachments/" }`.
- **Optional, additive (the only possible platform touch):** one line in
  `backend/scripts/seed-skills/dreaming.md` telling the nightly agent: "if a
  notes app is installed, read `notes-meta.json` → fold note titles/snippets
  into the knowledge graph." Shipped as a separate tiny PR; the app is fully
  functional without it.

## 10. Logo (codex imagegen)

Per the owner's steer: don't prescribe a metaphor. Write a one-paragraph app
description, attach the existing app icons (gym/news/mind/atlas `icon.png`)
as **style references**, and dispatch **codex with an explicit imagegen call**
("use your image-generation tool to produce a 512×512 PNG at /tmp/…, in the
style of these reference icons — glossy 3D, Möbius infinity-motif family,
charcoal + violet, no dark/horror imagery"). Generate a few to distinct temp
paths, pick the best, save as `icon.png`. (Asking Codex to "design an icon"
yields SVG code; the imagegen tool must be named explicitly — documented
gotcha.)

## 11. Manifest (`mobius.json`)

Mirrors gym/news conventions:

```json
{
  "id": "notes",
  "name": "Notes",
  "version": "1.0.0",
  "description": "Markdown notes that render as you type — pin, color, search, inline images & files. Works offline; git-tracked; conflicts auto-merge or get an agent.",
  "author": "mobius-os",
  "license": "MIT",
  "homepage": "https://github.com/mobius-os/app-notes",
  "entry": "index.jsx",
  "icon": "icon.png",
  "offline_capable": true,
  "permissions": { "cross_app_access": "none", "share_with_apps": "none" },
  "runtime": { "imports": ["react", "react-dom", "codemirror", "katex"], "esm_deps": ["marked", "dompurify"] },
  "storage_seeds": { "notes-meta.json": { "app": "notes", "data_type": "notes", "format": "markdown+frontmatter", "dir": "notes/", "index": "index.json", "attachments": "attachments/" } },
  "schedule": { "default": "*/10 * * * *", "user_configurable": false, "job": "tick.sh" }
}
```

`tick.sh` runs both the git snapshot and the conflict-resolver scan (one cron
entry; cheap no-op when nothing's dirty/open).

## 12. Security & sandbox compliance

- All rendered note HTML (card previews + any editor HTML widgets) → **DOMPurify**.
- **No** `window.confirm/alert/prompt`; in-app `ConfirmModal`.
- Respect the 25 MiB blob cap; reject oversize before write.
- `connect-src 'self' https://esm.sh` — all deps from esm.sh or same-origin;
  no other CDNs.
- Same-origin `fetch('/api/storage/…')` uses the owner JWT (already wired by the
  runtime via `window.mobius.storage`).

## 13. Delivery

- **Build all, ship once** (chosen): implement every layer before review/install.
- **Platform change (small, separate mobius PR), done first:** vendor CM6 +
  KaTeX under `/vendor` — Dockerfile `npm install` + a `build-codemirror-vendor.mjs`
  (modeled on the existing `build-react-vendor.mjs`) that emits one CM6 bundle,
  copy KaTeX CSS/fonts, add `codemirror` + `katex` importmap entries to
  `app-frame.html`. Deploy the shell to `mobius-test`, verify the specifiers
  resolve same-origin and work offline, *then* build the app against them.
- New repo `mobius-os/app-notes` (local: `/home/hmzmrzx/projects/mobius-os/app-notes/`),
  matching the other app-* repos: `index.jsx`, `mobius.json`, `icon.png`,
  `README.md`, `LICENSE`, `tick.sh` (+ `snapshot`/`resolve` helpers).
- **Verify in `mobius-test` (port 8001)** end-to-end (never prod): install,
  drive with agent-browser, exercise offline + a forced conflict + the agent
  resolver, screenshot.
- **Register in the app store**, then **ship to prod on the owner's explicit
  gate** (prod is the shared container; sibling sessions may be active).
- Optional dreaming-skill line as a separate small PR.

## 14. Internal build order (not phased delivery — just sequence)

1. **Vendor the editor foundation** (mobius worktree): build the single CM6
   bundle + KaTeX vendor step + `app-frame.html` importmap entries; deploy to
   `mobius-test`; confirm `import {EditorView,…} from 'codemirror'` + `katex`
   resolve same-origin and work offline.
2. Repo scaffold + manifest + storage seeds; logo via codex imagegen.
3. Storage layer module (note CRUD, frontmatter, content-hash, derived index,
   content-addressed attachments) with unit tests.
4. Grid + card + pin + color + search + ConfirmModal.
5. Live-inline editor (CM6 + decorations + inline image/file widgets).
6. Offline drafts + reconcile + diff3 + immutable conflict descriptors.
7. `tick.sh`: git snapshot + leased, verify-before-write resolver; "Resolve now".
8. `notes-meta.json` + dreaming layout; optional dreaming-skill line.
9. Test-container e2e (incl. forced-conflict + resolver); screenshots.
10. App-store registration; gated prod ship.

## 15. Testing & verification

- **Unit (node --test or in-app harness):** frontmatter parse/serialize,
  content-hash stability, diff3 fast-forward/clean/conflict cases, derived-index
  rebuild, attachment content-addressing/dedup.
- **Compile-smoke:** esbuild-compile `index.jsx` (the mini-app build path).
- **e2e in mobius-test:** create/edit/pin/color/search; inline image + file;
  live-preview render; offline edit → reconnect → fast-forward; **forced
  conflict** (edit same note on two simulated devices) → descriptor written →
  resolver merges → card updates live; sync-status chip transitions.
- **Dreaming:** confirm a dreaming run can read `notes-meta.json` + `notes/*.md`.

## 16. Open risks / to resolve in planning

- **Editor-foundation vendoring** — building a correct single CM6 bundle (right
  exports, singleton `state`) + KaTeX (CSS + fonts copied for offline math) and
  wiring the `app-frame.html` importmap + Dockerfile vendor step. Well-precedented
  (three/React) but the bundle script needs care. Lower-risk than the esm.sh
  warm-cache path it replaces, and reusable by future apps.
- **Reconcile-before-write CAS residual window** — inherent to LWW storage;
  bounded + caught by next reconcile; documented, acceptable for single-owner.
- **`deviceId` longevity** — IndexedDB can be evicted; if lost, a device gets a
  new id (a new draft namespace) — safe (no clobber), at worst an extra
  conflict. Acceptable.
- **App-store registration mechanics** — confirm how an app enters the store
  catalog (curated registry vs manifest URL) during delivery.
- **Cron cadence vs snapshot noise** — 10-min tick is a starting point; tune.

## 17. Out of scope

CRDT/realtime; per-device git branches; a new server merge endpoint; cross-app
note sharing; encryption-at-rest beyond what Möbius already provides.

## 18. Future shared platform libraries (noted; NOT a dependency of this app)

Vendoring CM6 + KaTeX as general deps points at a small set of *powerful,
reusable* libraries worth growing as a shared foundation (sizes measured,
min+gzip):

| Capability | Library | gzip |
|---|---|---|
| Editor (this app) | CodeMirror 6 (minimal set) | 188 KB |
| Math (this app) | KaTeX (JS) | 74 KB |
| **In-browser git + filesystem** | isomorphic-git + lightning-fs | **83 KB** |
| Alt. filesystem | @zenfs/core | 91 KB |
| File-tree UI | react-arborist | 32 KB |
| 3-way merge / diff | node-diff3 / diff-match-patch | 2 KB / 6 KB |

`isomorphic-git + lightning-fs` is the "file management" analogue to CM6 — a
complete client-side git + POSIX-ish filesystem in ~83 KB gz — and the natural
foundation for the **LaTeX app** (multi-file projects + versioning) and future
file/code/wiki apps. **This Notes app deliberately does NOT use it:** its
per-file drafts + diff3 + cron-git design is simpler and correct for
cross-device quick-capture, and isomorphic-git would not ease the
sync-through-a-blob-store problem (you would still build a storage-backed
remote). Recommendation: vendor these **on first real use** (e.g. a
latex/file-management track), not speculatively.
