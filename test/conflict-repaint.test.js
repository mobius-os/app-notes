// Render-harness verification for the 1.2.15 merge-conflict repaint fix.
//
// The app shows a "Resolving…/merging…" indicator on a note whose save hit a
// genuine 3-way conflict. When the AGENT RESOLVER (an EXTERNAL writer) lands a
// merged note at notes/<id>.json, the open editor must repaint and the indicator
// must clear. The bug Codex rejected (round 1) cleared the indicator on EVERY
// local write (the runtime fires notify() on every local set), which falsely
// dismissed it on a routine save while the conflict was still unresolved
// server-side.
//
// The round-2 fix gated the clear on a CONTENT hash (body + display meta). Codex
// rejected it too: on a SELF-RAISED body conflict, mergeNoteDocs lands
// {body: mine.body, meta: mergeMeta(base, mine, theirs)} and mergeMeta takes the
// display fields (title/color/pinned/type/archived/tags) from the LATER side. If
// THEIRS is the later write and changed the title/color, the landed content hash
// differs from MINE's — so MINE's own conflicting save is misclassified as an
// external resolution and the indicator clears EARLY, while the body conflict is
// still unresolved.
//
// The round-3 (convergent) fix gates the clear on the BODY changing off MINE's
// last-written body — NOT the full content hash. A self-raised conflict keeps
// body === mine.body (only display meta merged), so the indicator stays up. A
// local save keeps body === mine and does nothing. Only an external writer that
// rewrites the body off mine clears it.
//
// We mount the WHOLE App through the shared render shim (react aliased to the
// shim; heavy children — Editor/ColorPicker/EditorPanel/Grid/ConfirmModal —
// stubbed to inert recorders so CodeMirror is never bundled), with a mocked
// window.mobius whose storage can fire a LOCAL vs an EXTERNAL notify, and verify:
//
//   (a) externalBodyResolveClears        — an external write that rewrites the
//                                           BODY clears the indicator + repaints.
//   (b) localSaveDoesNotClear            — a routine local save does NOT clear it.
//   (c) selfConflictWithTheirsMetaStaysUp — the EXACT case Codex found: a
//                                           self-raised body conflict where THEIRS
//                                           is the later write AND changed the
//                                           TITLE + color keeps the indicator up
//                                           (a content hash would clear it early).
//   (d) conflictStillSurfaces            — a conflict the user creates via their
//                                           own save still shows "Resolving…".

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { build } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { notePath } from '../src/lib/note-doc.js'

if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = webcrypto

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-conflict-repaint-bundle.mjs')

let App, shim

before(async () => {
  const plugin = {
    name: 'app-render-shim',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      b.onResolve({ filter: /(Editor|ColorPicker|EditorPanel|Grid|ConfirmModal|icons)\.jsx$/ },
        () => ({ path: 'stub', namespace: 'stub' }))
      // Stub only the heavy browser-only libs the app pulls in for rendering;
      // node-diff3 (the real 3-way merge) and the app's own src/lib/* must
      // resolve normally so mergeNote runs for real.
      b.onResolve({ filter: /^(marked|dompurify|katex|codemirror|@codemirror\/|@lezer\/)/ },
        () => ({ path: 'noop', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents:
          'export default function Stub(){return null};' +
          'export const Icon=()=>null; export const createPortal=()=>null;',
        loader: 'js',
      }))
    },
  }
  const r = await build({
    entryPoints: [resolve(ROOT, 'src/app.jsx')],
    bundle: true, write: false, format: 'esm', jsx: 'automatic',
    platform: 'neutral', plugins: [plugin], logLevel: 'silent',
  })
  writeFileSync(BUNDLE, r.outputFiles[0].text)

  shim = await import(pathToFileURL(SHIM).href)
  App = (await import(pathToFileURL(BUNDLE).href)).default
})

after(() => { try { shim.unmount() } catch {} ; try { rmSync(BUNDLE) } catch {} })

// Each scenario remounts the shared shim; tear the prior mount's effects down
// (the app starts a setInterval poll that would otherwise keep the event loop
// alive and hang the test process after the assertions pass).
function teardown() { try { shim.unmount() } catch {} }

// Flush microtasks + macrotasks: subscribe replay -> contentHash() (async, used
// by writeNote/onConflict) -> setConflicts() -> the shim's drive() re-render.
async function flush(n = 12) {
  for (let i = 0; i < n; i++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }
}

// Iterative tree search with a visited set + bound. The shim records a tree whose
// element/props objects are SHARED across branches (memoized children), so a
// naive recursive find() revisits them and overflows the stack; this is
// cycle-safe.
function safeFind(pred, root) {
  const stack = [root]; const seen = new Set(); let guard = 0
  while (stack.length) {
    const n = stack.pop()
    if (++guard > 200000) return null
    if (n == null || typeof n !== 'object') continue
    if (seen.has(n)) continue; seen.add(n)
    if (Array.isArray(n)) { for (const c of n) stack.push(c); continue }
    if (pred(n)) return n
    if (n.children !== undefined) stack.push(n.children)
  }
  return null
}

// Minimal window.mobius: storage with a controllable subscribe/notify plus a
// createUseDocument so HAS_RUNTIME_DOC is true and the open note routes through a
// live document whose update() runs the app's real mergeNote (so a genuine
// conflict surfaces via onConflict exactly like prod).
function installMobius() {
  const notes = new Map()        // path -> doc
  const pathSubs = new Map()     // storage.subscribe listeners
  const docSubs = new Map()      // createUseDocument listeners

  function notifyPath(path) {
    const v = notes.has(path) ? notes.get(path) : null
    for (const cb of pathSubs.get(path) || []) { try { cb(v) } catch {} }
    for (const cb of docSubs.get(path) || []) { try { cb(v) } catch {} }
  }

  const storage = {
    async get(path) { return notes.has(path) ? JSON.parse(JSON.stringify(notes.get(path))) : null },
    async set(path, obj) { notes.set(path, obj); notifyPath(path); return { synced: true } },
    async setText(path, t) { notes.set(path, t); return { synced: true } },
    async getText(path) { return notes.has(path) ? notes.get(path) : null },
    async setBlob(path, b) { notes.set(path, b); return { synced: true } },
    async getBlob(path) { return notes.get(path) || null },
    async remove(path) { notes.delete(path); notifyPath(path); return { synced: true } },
    async durableWrite(path, value) { notes.set(path, value); notifyPath(path); return { durability: 'synced', path } },
    async list(prefix) {
      const base = (prefix || '').replace(/^\/+|\/+$/g, '')
      const out = []
      for (const p of notes.keys()) {
        if (base && !p.startsWith(base + '/')) continue
        if (!base && p.includes('/')) continue
        out.push({ name: p.split('/').pop(), path: p, type: 'file' })
      }
      return out
    },
    subscribe(path, cb) {
      let s = pathSubs.get(path); if (!s) { s = new Set(); pathSubs.set(path, s) }
      s.add(cb)
      Promise.resolve().then(() => cb(notes.has(path) ? notes.get(path) : null))
      return () => pathSubs.get(path)?.delete(cb)
    },
    async pendingCount() { return 0 },
    isOnline() { return true },
  }

  function createUseDocument(React) {
    return function useDocument(path, opts) {
      const [value, setValue] = React.useState(opts?.initial ?? null)
      const baseRef = React.useRef(null)
      React.useEffect(() => {
        if (!path || path.startsWith('__notes_no_open__')) return
        let s = docSubs.get(path); if (!s) { s = new Set(); docSubs.set(path, s) }
        const cb = (v) => { baseRef.current = v; setValue(v) }
        s.add(cb)
        const cur = notes.has(path) ? notes.get(path) : null
        baseRef.current = cur; setValue(cur)
        return () => docSubs.get(path)?.delete(cb)
      }, [path])
      const update = async (fn) => {
        const mine = fn(value)
        const theirs = notes.has(path) ? notes.get(path) : null
        const merged = opts?.merge ? opts.merge(baseRef.current, mine, theirs) : mine
        notes.set(path, merged)
        baseRef.current = merged
        setValue(merged)
        notifyPath(path)
        return { durability: 'synced', path }
      }
      return { value, status: 'idle', lastError: null, update, set: update, refresh: async () => {} }
    }
  }

  globalThis.window = globalThis.window || {}
  globalThis.window.location = { origin: 'http://localhost', search: '' }
  globalThis.window.addEventListener = () => {}
  globalThis.window.removeEventListener = () => {}
  globalThis.window.matchMedia = () => ({ matches: false, addEventListener() {}, removeEventListener() {} })
  globalThis.window.mobius = { storage, online: true, signal() {}, createUseDocument }
  // Keep unexpected network access deterministic in the render harness.
  globalThis.fetch = async () => { throw new Error('no network in harness') }
  globalThis.document = {
    addEventListener() {}, removeEventListener() {}, visibilityState: 'visible',
    querySelector() { return null },
    createElement() { return { setAttribute() {}, set textContent(_) {}, get textContent() { return '' } } },
    head: { appendChild() {} },
  }

  return {
    notes,
    seed(path, doc) { notes.set(path, doc) },
    external(path, doc) { notes.set(path, doc); notifyPath(path) },
  }
}

// Locate the stubbed EditorPanel node (the only element with a `conflict` prop).
function editorProps() {
  const node = safeFind((n) => n && n.props && Object.prototype.hasOwnProperty.call(n.props, 'conflict'), shim.tree())
  return node ? node.props : null
}

// Mount App, open the note, optionally provoke a genuine merge conflict (a
// concurrent server edit + a local save), and return handles to assert + drive.
//
// `createConflict` provokes the conflict. `serverMeta` overrides display fields
// on the divergent SERVER doc (theirs), and `serverLater` (default true) sets the
// server's `updated` to a timestamp AFTER mine's save so mergeMeta's laterSide
// picks THEIRS — the precise condition under which a content hash over the merged
// meta would diverge from mine's. The body conflict still lands mine.body.
async function driveScenario(env, id, { createConflict, serverMeta = {}, serverLater = true } = {}) {
  const Comp = App
  teardown()
  shim.mount(() => Comp({}))
  await flush()

  const fireOpen = () => {
    const grid = safeFind((n) => n && n.props && typeof n.props.onOpen === 'function', shim.tree())
    if (!grid) return false
    grid.props.onOpen(id)
    return true
  }
  let opened = false
  for (let i = 0; i < 40 && !opened; i++) { opened = fireOpen(); await flush(8) }
  assert.ok(opened, 'opened the note in the editor')
  await flush()

  const props0 = editorProps()
  assert.ok(props0, 'editor mounted')
  const onSave = props0.onSave
  // Mine's save stamps `updated: new Date().toISOString()` inside persist; we pin
  // it to a fixed past instant so the server's future `updated` is deterministically
  // later regardless of wall-clock skew during the test.
  const minePast = '2000-01-01T00:00:00.000Z'
  const meta = { id, created: 'C', mobius_rev: 1, attachments: [], title: 'T', tags: [], updated: minePast }

  let conflictAfterConflict = false
  let statusAfterConflict = null
  if (createConflict) {
    const path = notePath(id)
    const server = JSON.parse(JSON.stringify(env.notes.get(path)))
    // Server diverged: a different rev, a different body (forces a body conflict),
    // and — when serverLater — a later `updated` plus any display-field overrides
    // so mergeMeta picks THEIRS for title/color/etc.
    server.meta = {
      ...server.meta,
      mobius_rev: 2,
      updated: serverLater ? '2099-01-01T00:00:00.000Z' : minePast,
      ...serverMeta,
    }
    server.body = 'SERVER divergent body'
    env.notes.set(path, server)
    await onSave({ ...meta, mobius_rev: 1 }, 'MINE divergent body').catch(() => {})
    await flush()
    const p = editorProps()
    conflictAfterConflict = !!(p && p.conflict)
    statusAfterConflict = p ? p.status : null
  }

  return {
    conflictAfterConflict,
    statusAfterConflict,
    // A routine local save of the open note. Body must stay equal to MINE's last
    // write for the localSave-no-clear case, so default to the same conflicting body.
    localSave: async (body = 'MINE divergent body') => {
      await onSave({ ...meta, mobius_rev: 3, updated: minePast }, body).catch(() => {})
    },
  }
}

function seedNote(env, id) {
  const path = notePath(id)
  env.seed(path, { meta: { id, created: 'C', mobius_rev: 1, attachments: [], title: 'T', tags: [], updated: '1999-01-01T00:00:00.000Z' }, body: 'mine body' })
  env.seed('index.json', { notes: [{ id, title: 'T', snippet: 'mine body', updated: 'U', pinned: false }] })
  return path
}

test('externalBodyResolveClears: an external write that rewrites the BODY clears the conflict + repaints', async () => {
  const env = installMobius()
  const id = 'n1'
  const path = seedNote(env, id)

  const h = await driveScenario(env, id, { createConflict: true })
  assert.equal(h.conflictAfterConflict, true, 'sanity: conflict shows after a genuine merge conflict')

  // The agent resolver lands a merged note whose BODY differs from MINE's body.
  const resolved = { meta: { id, created: 'C', mobius_rev: 5, attachments: [], title: 'T', tags: [] }, body: 'MINE divergent body + SERVER merged' }
  env.external(path, resolved)
  await flush(40)
  const props = editorProps()
  assert.ok(props, 'editor still open')
  assert.equal(props.conflict, false, 'external body resolution cleared the indicator')
  assert.match(JSON.stringify(env.notes.get(path)), /SERVER merged/, 'store holds the resolved body')
})

test('localSaveDoesNotClear: a routine local save of the open note does NOT clear the indicator', async () => {
  const env = installMobius()
  const id = 'n2'
  seedNote(env, id)

  const h = await driveScenario(env, id, { createConflict: true })
  assert.equal(h.conflictAfterConflict, true, 'sanity: conflict shows')

  // Local save whose body is still MINE's body — must NOT clear the flag.
  await h.localSave('MINE divergent body')
  await flush(16)
  const props = editorProps()
  assert.ok(props, 'editor still open')
  assert.equal(props.conflict, true, 'a local save must NOT clear the conflict indicator')
})

test('selfConflictWithTheirsMetaStaysUp: a self-raised body conflict where THEIRS is the later write AND changed the TITLE + color keeps the indicator up', async () => {
  const env = installMobius()
  const id = 'n4'
  const path = seedNote(env, id)

  // THEIRS is the later write and changed the title (and color). mergeNoteDocs
  // lands {body: mine.body, meta: mergeMeta(...)} — the body stays MINE but the
  // merged meta takes THEIRS' title + color. A content-hash gate (round 2) would
  // see a hash different from mine's and clear the indicator EARLY. The body-only
  // gate (round 3) keeps it up because the body is still MINE's.
  const h = await driveScenario(env, id, {
    createConflict: true,
    serverLater: true,
    serverMeta: { title: 'THEIRS title', color: '#ff0000' },
  })
  assert.equal(h.conflictAfterConflict, true, 'sanity: the self-raised conflict shows')

  // Confirm the trap really is armed: the merged doc on disk must carry THEIRS'
  // display fields with MINE's body — otherwise this scenario would not exercise
  // the content-hash divergence Codex found.
  const landed = env.notes.get(path)
  assert.equal(landed.body, 'MINE divergent body', 'merged doc kept MINE body (the conflicting side)')
  assert.equal(landed.meta.title, 'THEIRS title', 'merged doc took THEIRS title (later side) — content hash != mine')
  assert.equal(landed.meta.color, '#ff0000', 'merged doc took THEIRS color (later side)')

  // Let the subscribe fire on the just-landed merged doc and settle.
  await flush(40)
  const props = editorProps()
  assert.ok(props, 'editor still open')
  assert.equal(props.conflict, true, 'self-raised conflict with THEIRS meta winning must keep the indicator UP')
  assert.equal(props.status, 'Resolving…', 'status text stays Resolving…')
})

test('conflictStillSurfaces: a conflict the user creates via their own save still shows Resolving…', async () => {
  const env = installMobius()
  const id = 'n3'
  seedNote(env, id)

  const h = await driveScenario(env, id, { createConflict: true })
  await flush(16)
  const props = editorProps()
  assert.ok(props, 'editor still open')
  assert.equal(props.conflict, true, 'the user-created conflict surfaces as Resolving…')
  assert.equal(h.statusAfterConflict, 'Resolving…', 'status text is Resolving…')
})
