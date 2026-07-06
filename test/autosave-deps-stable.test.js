// Low-bug regression (L3): useDocument returns a FRESH handle object every render,
// so depending on the whole `liveDoc` inside writeNote rebuilt writeNote → persist
// (the editor's onSave) → the editor's flushSave → its autosave effect on EVERY
// unrelated parent re-render, churning the ~600ms debounce so a pending save could
// keep resetting and never land. The fix reads liveDoc through a ref and drops it
// from writeNote's deps, so persist keeps a STABLE identity across unrelated
// re-renders.
//
// This test forces HAS_RUNTIME_DOC = true (it installs window.mobius.createUseDocument
// BEFORE importing the App bundle, so the module-top binding picks up the real hook
// path). The mock useDocument returns a fresh handle each render — exactly the churn
// source. We mount App, open a note, capture the onSave passed to the (stubbed)
// EditorPanel, cause an UNRELATED re-render (a search-query change), and assert the
// onSave identity is unchanged. Before the fix it changed on every re-render.

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
const BUNDLE = resolve(ROOT, '.tmp-autosave-deps-bundle.mjs')

let App, shim, env

// A window.mobius carrying storage + createUseDocument, so HAS_RUNTIME_DOC is true.
function installMobius() {
  const store = new Map()
  const pathSubs = new Map()
  const docSubs = new Map()
  function notify(path) {
    const v = store.has(path) ? store.get(path) : null
    for (const cb of pathSubs.get(path) || []) { try { cb(v) } catch {} }
    for (const cb of docSubs.get(path) || []) { try { cb(v) } catch {} }
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
      const out = []
      for (const p of store.keys()) {
        if (!p.startsWith(base + '/')) continue
        const rest = p.slice(base.length + 1)
        if (rest.includes('/')) continue
        out.push({ name: rest, path: p, type: 'file' })
      }
      return out
    },
    subscribe(path, cb) {
      let s = pathSubs.get(path); if (!s) { s = new Set(); pathSubs.set(path, s) }
      s.add(cb)
      Promise.resolve().then(() => cb(store.has(path) ? store.get(path) : null))
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
        if (!path || path.startsWith('__notes_no_open__')) return undefined
        let s = docSubs.get(path); if (!s) { s = new Set(); docSubs.set(path, s) }
        const cb = (v) => { baseRef.current = v; setValue(v) }
        s.add(cb)
        const cur = store.has(path) ? store.get(path) : null
        baseRef.current = cur; setValue(cur)
        return () => docSubs.get(path)?.delete(cb)
      }, [path])
      const update = async (fn) => {
        const mine = fn(value)
        const theirs = store.has(path) ? store.get(path) : null
        const merged = opts?.merge ? opts.merge(baseRef.current, mine, theirs) : mine
        store.set(path, merged); baseRef.current = merged; setValue(merged); notify(path)
        return { durability: 'synced', path }
      }
      // A FRESH handle object every render — the churn source L3 fixes.
      return { value, status: 'idle', lastError: null, update, set: update, refresh: async () => {} }
    }
  }
  globalThis.window = {
    location: { origin: 'http://localhost', search: '' },
    addEventListener() {}, removeEventListener() {},
    matchMedia: () => ({ matches: false, addEventListener() {}, removeEventListener() {} }),
    mobius: { storage, online: true, signal() {}, createUseDocument },
  }
  globalThis.fetch = async () => { throw new Error('no network') }
  globalThis.document = {
    addEventListener() {}, removeEventListener() {}, visibilityState: 'visible',
    querySelector() { return null },
    createElement() { return { setAttribute() {}, set textContent(_) {}, get textContent() { return '' } } },
    head: { appendChild() {} },
  }
  return { store, seed(path, val) { store.set(path, val) } }
}

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
  // Install window.mobius (with createUseDocument) BEFORE importing App so its
  // module-top HAS_RUNTIME_DOC check is true and it binds the real useDocument path.
  env = installMobius()
  shim = await import(pathToFileURL(SHIM).href)
  App = (await import(pathToFileURL(BUNDLE).href)).default
})

after(() => { try { shim.unmount() } catch {} ; try { rmSync(BUNDLE) } catch {} })

async function flush(n = 16) {
  for (let i = 0; i < n; i++) { await Promise.resolve(); await new Promise((r) => setTimeout(r, 0)) }
}
function safeFind(pred) {
  const stack = [shim.tree()]; const seen = new Set(); let guard = 0
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
const editorProps = () => { const n = safeFind((x) => x.props && Object.prototype.hasOwnProperty.call(x.props, 'conflict') && typeof x.props.onSave === 'function'); return n ? n.props : null }
// TopBar is a real (unstubbed) function component the shim doesn't render, so reach
// its onQuery prop on the element to drive a search-query state change.
const topBar = () => safeFind((n) => n.props && typeof n.props.onQuery === 'function')

test('onSave (persist) keeps a stable identity across an unrelated re-render (autosave deps do not churn)', async () => {
  env.seed(notePath('n1'), { meta: { id: 'n1', title: 'T', type: 'note', color: null, pinned: false, attachments: [], updated: '2026-01-01T00:00:00.000Z' }, body: 'hello' })
  shim.mount(() => App({ appId: '1', token: 't' }))
  await flush()

  // Open the note so the editor (stubbed) mounts and exposes onSave.
  const grid = safeFind((n) => n.props && typeof n.props.onOpen === 'function')
  assert.ok(grid, 'grid rendered')
  grid.props.onOpen('n1')
  await flush()

  const p1 = editorProps()
  assert.ok(p1, 'editor mounted with an onSave')
  const onSave1 = p1.onSave

  // An UNRELATED state change: change the search query. This re-renders App (and
  // mints a fresh useDocument handle) but must not change persist's identity.
  const tb = topBar()
  assert.ok(tb, 'TopBar present')
  tb.props.onQuery('zzz')
  await flush()

  const p2 = editorProps()
  assert.ok(p2, 'editor still mounted after the re-render')
  assert.equal(p2.onSave, onSave1, 'onSave identity is stable across the unrelated re-render (no autosave-dep churn)')
  shim.unmount()
})
