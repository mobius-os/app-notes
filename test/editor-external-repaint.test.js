// An EXTERNAL last-write-wins rewrite of the OPEN note must repaint
// the editor buffer AND must never let the ~600ms autosave write the stale buffer
// back over the external body. Before the fix, EditorPanel only reset its buffer on
// a note-IDENTITY change, so a same-id `note.body` change never reached CodeMirror
// or the React `body` state — the editor showed the old text and then autosaved it,
// silently clobbering the merge (data loss).
//
// This exercises the REAL EditorPanel (only the CodeMirror Editor + ColorPicker are
// stubbed), driven through a wrapper whose own
// useState feeds a CHANGING `note` prop while EditorPanel's hooks are preserved
// across re-renders — the way the app re-passes the note after mirroring an external
// write into the grid. With the Editor stubbed, viewRef.current stays null, so the
// reconcile takes its no-CodeMirror path (setBody), which the stub's recorded
// `value` prop reflects.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-editor-external-repaint-bundle.mjs')

let EditorPanel, shim

before(async () => {
  const plugin = {
    name: 'editor-render-shim',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      b.onResolve({ filter: /(Editor|ColorPicker)\.jsx$/ }, () => ({ path: 'stub', namespace: 'stub' }))
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
  if (!globalThis.document) globalThis.document = { addEventListener() {}, removeEventListener() {}, visibilityState: 'visible' }
  if (!globalThis.window) globalThis.window = { addEventListener() {}, removeEventListener() {}, location: { origin: 'http://localhost' } }
  shim = await import(pathToFileURL(SHIM).href)
  EditorPanel = (await import(pathToFileURL(BUNDLE).href)).default
})

after(() => { try { rmSync(BUNDLE) } catch {} })

// Iterative, cycle-safe DFS for the first element matching `pred`.
function findEl(pred) {
  const seen = new Set()
  const stack = [shim.tree()]
  while (stack.length) {
    const node = stack.pop()
    if (node == null || typeof node !== 'object') continue
    if (seen.has(node)) continue
    seen.add(node)
    if (Array.isArray(node)) { for (const c of node) stack.push(c); continue }
    if (pred(node)) return node
    if (node.children != null) stack.push(node.children)
  }
  return null
}

// The stubbed body Editor is the only element carrying value + onChange +
// resolveAttachment; its `value` prop is EditorPanel's live `body` buffer.
const editorEl = () => findEl((n) => n.props && 'value' in n.props && typeof n.props.onChange === 'function' && 'resolveAttachment' in n.props)
const backBtn = () => findEl((n) => n.type === 'button' && n.props && n.props['aria-label'] === 'Back')
const colorBtn = () => findEl((n) => n.type === 'button' && n.props && n.props['aria-label'] === 'Color')
const colorPicker = () => findEl((n) => n.props && typeof n.props.onPick === 'function')

// Mount EditorPanel behind a wrapper whose useState owns the `note` prop, so a test
// can re-pass a new note (same id, new body) without resetting EditorPanel's hooks.
// Every non-`note` prop is a STABLE ref (built once) — a fresh function per render
// would churn the stranded-images effect (deps include resolveAttachment) into an
// infinite setState loop.
let setNote
function mountWithNote(note0, onSave, extra = {}) {
  const stable = {
    onSave,
    onBack() {}, onPin() {}, onColor() {}, onDelete() {},
    resolveAttachment: async () => null, putAttachment: async () => ({}),
    status: '', forceSave: false,
    ...extra,
  }
  shim.mount(() => {
    const [n, setN] = shim.useState(note0)
    setNote = setN
    return EditorPanel({ ...stable, note: n })
  })
}

const tick = () => new Promise((r) => setTimeout(r, 0))
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

test('external body rewrite of the open note repaints the buffer and fires no stale save', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push(body); return Promise.resolve() }
  const note0 = { meta: { id: 'n1', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'original body' }
  mountWithNote(note0, onSave)
  assert.equal(editorEl().props.value, 'original body', 'sanity: editor shows the original body')

  // Another writer rewrites notes/n1.json; the app re-passes the note (same id).
  setNote({ ...note0, body: 'external merged body' })
  await tick()

  assert.equal(editorEl().props.value, 'external merged body', 'the editor buffer adopts the external body (repaint)')
  assert.ok(!saves.includes('original body'), 'no stale autosave wrote the old body over the external one')
  shim.unmount()
})

test('an external LWW rewrite replaces local unsaved text and is not overwritten by autosave', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push(body); return Promise.resolve() }
  const note0 = { meta: { id: 'n2', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'a\nb\nc' }
  mountWithNote(note0, onSave)

  // User edits line 2 locally (unsaved).
  editorEl().props.onChange('a\nB local\nc')
  await tick()
  assert.equal(editorEl().props.value, 'a\nB local\nc', 'sanity: local edit is in the buffer')

  // The platform publishes a newer external value. LWW means that value wins;
  // there is no app-side merge or save gate.
  setNote({ ...note0, body: 'a\nb\nC external' })
  await tick()
  assert.equal(editorEl().props.value, 'a\nb\nC external', 'the editor adopts the platform value verbatim')
  await wait(700)
  assert.deepEqual(saves, [], 'the replaced local buffer is never autosaved back over the external value')
  shim.unmount()
})

test('open-editor color changes persist the live CodeMirror body', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push({ meta, body }); return Promise.resolve() }
  const note0 = { meta: { id: 'n3', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'old body' }
  mountWithNote(note0, onSave)

  // Simulate CodeMirror having newer text than React's last body snapshot.
  editorEl().props.viewRef.current = {
    state: { doc: { toString: () => 'live unsaved body' } },
  }
  colorBtn().props.onClick()
  await tick()
  colorPicker().props.onPick('moss')
  await tick()

  assert.ok(saves.length >= 1, 'color action saved')
  assert.equal(saves[saves.length - 1].meta.color, 'moss')
  assert.equal(saves[saves.length - 1].body, 'live unsaved body')
  shim.unmount()
})

test('an older local save echo never clobbers typing that continued afterward', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push(body); return Promise.resolve() }
  const note0 = { meta: { id: 'n4', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'a\nb\nc' }
  mountWithNote(note0, onSave)

  editorEl().props.onChange('first local snapshot')
  await tick()
  await backBtn().props.onClick()
  await tick()
  assert.equal(saves.at(-1), 'first local snapshot', 'sanity: the local snapshot was submitted')

  editorEl().props.onChange('first local snapshot plus more typing')
  await tick()
  setNote({ ...note0, body: 'first local snapshot' })
  await tick()

  assert.equal(editorEl().props.value, 'first local snapshot plus more typing', 'the stale echo does not jump the buffer backward')
  shim.unmount()
})
