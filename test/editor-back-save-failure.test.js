// Risk-2 regression lock: the editor must NOT close as if saved when the Back
// button's flush is dead-lettered (a server-refused save). EditorPanel's Back
// handler does `try { await flushSave() } catch { return }` — on a rejected save
// it returns WITHOUT calling onBack, so the editor STAYS OPEN and the user sees
// the 'Save failed' status instead of a silent close-as-saved (data-loss UX).
//
// We render EditorPanel in ISOLATION (not the full App — that needs useId/
// useLayoutEffect/window.mobius/document) by esbuild-transpiling its JSX with
// `react`/`react/jsx-runtime` aliased to the shared hook+jsx shim in
// editor-render-shim.mjs (kept EXTERNAL so the bundle and this test share one
// module instance), and the heavy children (Editor=CodeMirror, ColorPicker=
// react-dom portal) stubbed to inert components. The shim records the element
// tree; we locate the Back button by aria-label and fire its onClick.
//
// The save outcome is driven through the onSave prop: a rejected promise models
// a DurableWriteError dead-letter; a resolved promise models a queued/synced
// durable success. We assert the handler's branch, not the storage internals —
// the dead-letter mechanics themselves are pinned in runtime-integration.test.js
// and mobius-storage-mock.mjs.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from 'esbuild'
import { resolve } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-editor-back-bundle.mjs')

let EditorPanel, shim

before(async () => {
  const plugin = {
    name: 'editor-render-shim',
    setup(b) {
      // react + jsx-runtime -> the shared shim, EXTERNAL so the bundle keeps an
      // import to the same module instance this test imports (shared hook slots).
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      // heavy children stubbed to inert components (avoid bundling CodeMirror /
      // react-dom; the jsx shim never invokes them anyway — it only records type).
      b.onResolve({ filter: /(Editor|ColorPicker)\.jsx$/ }, () => ({ path: 'stub', namespace: 'stub' }))
      // any other bare lib specifier -> noop module
      b.onResolve({ filter: /.*/ }, (a) => {
        if (a.kind === 'entry-point') return null
        if (!a.path.startsWith('.') && !a.path.startsWith('/')) return { path: 'noop', namespace: 'stub' }
        return null
      })
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents: 'export default function Stub(){return null}; export const createPortal=()=>null;',
        loader: 'js',
      }))
    },
  }
  const r = await build({
    entryPoints: [resolve(ROOT, 'src/ui/EditorPanel.jsx')],
    bundle: true, write: false, format: 'esm', jsx: 'automatic',
    platform: 'neutral', plugins: [plugin], logLevel: 'silent',
  })
  writeFileSync(BUNDLE, r.outputFiles[0].text)

  // Minimal globals EditorPanel's effects/handlers touch (no DOM, no react-dom).
  if (!globalThis.document) globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { origin: 'http://localhost' } }

  shim = await import(pathToFileURL(SHIM).href)
  EditorPanel = (await import(pathToFileURL(BUNDLE).href)).default
})

after(() => { try { rmSync(BUNDLE) } catch {} })

// Props built ONCE per render-session and reused across re-renders, so memo/effect
// deps (note.meta, body) keep stable identity (a fresh note object each render
// would re-fire the strandedUrls effect and loop). forceSave=true bypasses the
// content-hash no-op guard so flushSave actually issues the (failing) save even
// though the buffer equals the note prop after an optimistic update.
function props(onSave, onBack) {
  return {
    appId: '1',
    note: { meta: { id: 'n1', title: 'T', type: 'note', color: null, pinned: false }, body: 'hello' },
    onSave, onBack,
    onPin() {}, onColor() {}, onDelete() {},
    resolveAttachment: async () => null, putAttachment: null,
    conflict: null, status: '', forceSave: true,
  }
}

function clickBack() {
  const btn = shim.find((n) => n.props && n.props['aria-label'] === 'Back')
  assert.ok(btn && typeof btn.props.onClick === 'function', 'Back button with onClick is rendered')
  return btn.props.onClick()
}

test('Back keeps the editor open when the save is dead-lettered (no silent close-as-saved)', async () => {
  let backCalls = 0
  const onSave = () => Promise.reject(Object.assign(new Error('refused'), { name: 'DurableWriteError', code: 'dead_letter' }))
  // Build props ONCE so note/meta/body keep stable identity across re-renders
  // (a fresh note object each render re-fires the buffer-sync effect → loop).
  const p = props(onSave, () => { backCalls++ })
  shim.mount(() => EditorPanel(p))
  await clickBack()
  assert.equal(backCalls, 0, 'onBack must NOT be called when flushSave rejects — the editor stays open so the failure is visible')
  shim.unmount()
})

test('Back closes the editor when the save resolves (queued offline write is durable success)', async () => {
  let backCalls = 0
  const onSave = () => Promise.resolve({ durability: 'queued' })
  const p = props(onSave, () => { backCalls++ })
  shim.mount(() => EditorPanel(p))
  await clickBack()
  assert.equal(backCalls, 1, 'onBack IS called when flushSave resolves — a queued/synced save closes normally')
  shim.unmount()
})
