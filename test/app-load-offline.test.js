// P0 + low-bug regressions on the app-load path, exercised through the WHOLE App
// (heavy children stubbed; src/lib resolves for real):
//
//   H2 offline cold load — storage.list() has no offline mirror, so it returns null
//      when enumeration is unavailable. The grid must keep the index.json cache's
//      placeholders (NOT wipe to "No notes yet"), and re-list on reconnect.
//   L4 index write — index.json is (re)written from a committed-notes effect, so a
//      normal load persists it (no side effect inside a setNotes updater).
//   L5 placeholder open — tapping an un-cached placeholder while offline surfaces a
//      "not cached yet" message instead of a silent no-op, and the grid stays put.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { build } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = webcrypto

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-app-load-offline-bundle.mjs')

let App, shim

before(async () => {
  const plugin = {
    name: 'app-render-shim',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      b.onResolve({ filter: /(Editor|ColorPicker|EditorPanel|Grid|ConfirmModal|icons)\.jsx$/ },
        () => ({ path: 'stub', namespace: 'stub' }))
      b.onResolve({ filter: /^(marked|dompurify|katex|codemirror|@codemirror\/|@lezer\/)/ },
        () => ({ path: 'noop', namespace: 'stub' }))
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default function Stub(){return null};'
          + 'export const Icon=()=>null; export const createPortal=()=>null;',
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

function teardown() { try { shim.unmount() } catch {} }
async function flush(n = 16) {
  for (let i = 0; i < n; i++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }
}
function safeFind(pred, root = shim.tree()) {
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
const gridEl = () => safeFind((n) => n.props && Array.isArray(n.props.notes) && typeof n.props.onOpen === 'function')
const emptyEl = () => safeFind((n) => n.props && 'filtered' in n.props && !('notes' in n.props))
const saveErrEl = () => safeFind((n) => n.props && n.props.className === 'nt-save-err')

// A window.mobius whose storage.list() outcome is switchable (auto-derived from the
// store, or forced to null to model offline enumeration). Recreated per test.
function makeEnv({ online = true } = {}) {
  const store = new Map()
  const pathSubs = new Map()
  let listMode = 'auto' // 'auto' | 'null'

  function notify(path) {
    const v = store.has(path) ? store.get(path) : null
    for (const cb of pathSubs.get(path) || []) { try { cb(v) } catch {} }
  }
  function childrenOf(base) {
    const out = []
    for (const p of store.keys()) {
      if (!p.startsWith(base + '/')) continue
      const rest = p.slice(base.length + 1)
      if (rest.includes('/')) continue
      out.push({ name: rest, path: p, type: 'file' })
    }
    return out
  }

  const storage = {
    async get(path) { return store.has(path) ? JSON.parse(JSON.stringify(store.get(path))) : null },
    async set(path, obj) { store.set(path, obj); notify(path); return { synced: true } },
    async setText(path, t) { store.set(path, t); return { synced: true } },
    async getText(path) { return store.has(path) ? store.get(path) : null },
    async setBlob(path, b) { store.set(path, b); return { synced: true } },
    async getBlob(path) { return store.get(path) || null },
    async remove(path) { store.delete(path); notify(path); return { synced: true } },
    async durableWrite(path, v) { store.set(path, v); notify(path); return { durability: 'synced', path } },
    async list(prefix) {
      const base = (prefix || '').replace(/^\/+|\/+$/g, '')
      if (base === 'notes' && listMode === 'null') return null // offline: enumeration unavailable
      return childrenOf(base)
    },
    subscribe(path, cb) {
      let s = pathSubs.get(path); if (!s) { s = new Set(); pathSubs.set(path, s) }
      s.add(cb)
      Promise.resolve().then(() => cb(store.has(path) ? store.get(path) : null))
      return () => pathSubs.get(path)?.delete(cb)
    },
    async pendingCount() { return 0 },
    isOnline() { return online },
  }

  const listeners = new Map()
  globalThis.window = {
    location: { origin: 'http://localhost', search: '' },
    addEventListener(type, cb) { let s = listeners.get(type); if (!s) { s = new Set(); listeners.set(type, s) } s.add(cb) },
    removeEventListener(type, cb) { listeners.get(type)?.delete(cb) },
    dispatchEvent(ev) { for (const cb of [...(listeners.get(ev.type) || [])]) { try { cb(ev) } catch {} } },
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    mobius: { storage, online, signal() {} },
  }
  globalThis.fetch = async () => { throw new Error('no network in harness') }
  globalThis.document = {
    addEventListener() {}, removeEventListener() {}, visibilityState: 'visible',
    querySelector() { return null },
    createElement() { return { setAttribute() {}, set textContent(_) {}, get textContent() { return '' } } },
    head: { appendChild() {} },
  }

  return {
    store,
    seed(path, val) { store.set(path, val) },
    setListNull() { listMode = 'null' },
    setListAuto() { listMode = 'auto' },
    goOnline() { online = true; globalThis.window.mobius.online = true; globalThis.window.dispatchEvent({ type: 'online' }) },
  }
}

const placeholderIndex = (id, title, snippet) => ({ notes: [{ id, title, snippet, pinned: false, color: null, type: 'note', updated: '2026-01-01' }] })
const canonicalNote = (id, title, body) => ({ meta: { id, title, type: 'note', color: null, pinned: false, attachments: [], updated: '2026-01-02T00:00:00.000Z' }, body })

test('offline cold load keeps the cached index placeholders instead of wiping to empty', async () => {
  teardown()
  const env = makeEnv({ online: false })
  env.seed('index.json', placeholderIndex('a', 'Alpha', 'hello world'))
  env.setListNull() // storage.list('notes') → null (enumeration unavailable offline)

  shim.mount(() => App({ appId: '1', token: 't' }))
  await flush()

  const grid = gridEl()
  assert.ok(grid, 'the grid renders from the cached placeholders (not the empty state)')
  assert.equal(emptyEl(), null, 'the "No notes yet" empty state did NOT render over cached notes')
  assert.equal(grid.props.notes.length, 1, 'the cached placeholder note remains')
  assert.equal(grid.props.notes[0].placeholder, true, 'it is the display-only index placeholder')
  assert.ok(safeFind((n) => n.props && n.props.className === 'nt-sync-pill'), 'the grid shows the Offline pill (reactive connectivity)')
  teardown()
})

test('reconnect re-lists and replaces the placeholders with the canonical records', async () => {
  teardown()
  const env = makeEnv({ online: false })
  env.seed('index.json', placeholderIndex('a', 'Alpha', 'hello world'))
  env.setListNull()

  shim.mount(() => App({ appId: '1', token: 't' }))
  await flush()
  assert.equal(gridEl().props.notes[0].placeholder, true, 'starts on the placeholder')

  // The canonical note becomes enumerable; fire the online event.
  env.seed('notes/a.json', canonicalNote('a', 'Alpha', 'the real body'))
  env.setListAuto()
  env.goOnline()
  await flush()

  const grid = gridEl()
  assert.ok(grid, 'grid still rendered after reconnect')
  assert.equal(grid.props.notes.length, 1, 'one note after reconnect')
  assert.ok(!grid.props.notes[0].placeholder, 'the placeholder was replaced by the canonical record')
  assert.equal(grid.props.notes[0].body, 'the real body', 'the canonical body is now shown')
  teardown()
})

test('a normal load persists the derived index.json (index write is an effect, not an in-updater side effect)', async () => {
  teardown()
  const env = makeEnv({ online: true })
  env.seed('notes/a.json', canonicalNote('a', 'Alpha', 'body a'))

  shim.mount(() => App({ appId: '1', token: 't' }))
  await flush()
  // index.json is derived; rapid note changes are intentionally coalesced.
  await new Promise((resolve) => setTimeout(resolve, 280))

  const idx = env.store.get('index.json')
  assert.ok(idx && Array.isArray(idx.notes), 'index.json was written from committed notes')
  assert.equal(idx.notes[0].id, 'a', 'the index reflects the loaded note')
  teardown()
})

test('tapping an un-cached placeholder while offline shows a "not cached yet" message and leaves the grid up', async () => {
  teardown()
  const env = makeEnv({ online: false })
  env.seed('index.json', placeholderIndex('a', 'Alpha', 'hello world'))
  env.setListNull() // offline: note file is not cached, list() unavailable

  shim.mount(() => App({ appId: '1', token: 't' }))
  await flush()
  const grid = gridEl()
  assert.ok(grid, 'grid rendered from the placeholder')

  grid.props.onOpen('a') // tap the placeholder — its notes/a.json isn't cached
  await flush()

  const err = saveErrEl()
  assert.ok(err, 'an inline message is shown (not a silent no-op)')
  const msg = safeFind((n) => n.props && n.props.className === 'nt-save-err-msg')
  assert.match(String(msg && msg.children), /not cached yet/i, 'the message tells the user to reconnect')
  assert.ok(gridEl(), 'the grid stays up (the editor did not open)')
  teardown()
})
