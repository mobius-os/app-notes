// Regression lock: an attach FAILURE must not strand the user's pre-existing
// unsaved TEXT. handleFile cancels the pending autosave timer BEFORE the slow
// `await toSdrImage/putAttachment` (deliberately — it closes the multi-image
// broken-link race). If putAttachment then REJECTS (e.g. the 25 MB cap), the
// failed image was never inserted into the body, but the cancelled autosave for
// the text the user had already typed is gone. Without re-arming/flushing it,
// that text is only in memory and a crash before the next save trigger loses it.
//
// The fix flushes the existing save in the catch: the failed image was never
// inserted, so flushSave just persists the live body text the user already had.
//
// We render EditorPanel in isolation via the shared editor-render-shim.mjs (same
// harness as editor-back-save-failure.test.js): react/jsx aliased to the shim,
// heavy children (Editor/ColorPicker) stubbed. We model "pre-existing unsaved
// text" the way the user produces it — by firing the (stubbed) Editor's onChange
// (= setBody) so the body buffer genuinely diverges from the note prop — then
// fire the hidden file <input>'s onChange (handleFile) with a synthetic event.
//
// Assertions are on the onSave prop (the editor's one real persistence path):
//   FAILURE  -> the unsaved text must still be persisted (rescue flush), and the
//               failed image must NOT appear in it (it was never inserted).
//   SUCCESS  -> byte-identical to before: exactly one save carrying the inserted
//               image ref on top of the unsaved text.

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
const BUNDLE = resolve(ROOT, '.tmp-editor-attach-bundle.mjs')

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

// Stable props per render-session (see editor-back-save-failure.test.js for why
// note identity must not change across re-renders).
function props({ onSave, putAttachment }) {
  return {
    appId: '1',
    note: { meta: { id: 'n1', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'orig body' },
    onSave,
    onBack() {}, onPin() {}, onColor() {}, onDelete() {},
    resolveAttachment: async () => null,
    putAttachment,
    conflict: null, status: '', forceSave: false,
  }
}

// Iterative, cycle-safe DFS for the first element matching `pred`. The shim's own
// `find` is recursive and overflows on this component's deeper tree; we walk it
// ourselves with an explicit stack + visited set instead.
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

// Simulate the user typing unsaved text: the body <Editor> is stubbed but the
// shim records its element, and its onChange prop IS setBody. Driving it makes
// the body buffer diverge from the note prop — exactly the "pre-existing unsaved
// text" state the data-loss bug is about.
function typeUnsaved(text) {
  const ed = findEl((n) => n.props && typeof n.props.onChange === 'function' && 'value' in n.props && 'resolveAttachment' in n.props)
  assert.ok(ed, 'the body Editor (with onChange=setBody) is rendered')
  ed.props.onChange(text)
}

// Fire a hidden file <input>'s onChange (handleFile) with a synthetic event
// carrying one file. `value` is settable so handleFile's `e.target.value = ''`
// reset doesn't throw.
async function fireAttach(file) {
  const input = findEl((n) => n.type === 'input' && n.props && n.props.type === 'file' && typeof n.props.onChange === 'function')
  assert.ok(input, 'a hidden file <input> with onChange is rendered')
  let value = 'C:/fake'
  const ev = { target: { files: [file], get value() { return value }, set value(v) { value = v } } }
  return input.props.onChange(ev)
}

test('attach failure does not strand pre-existing unsaved text — it is flushed or rescheduled', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push({ meta, body }); return Promise.resolve() }
  // Reject past the 25 MB cap, BEFORE any insert into the body.
  const putAttachment = () => Promise.reject(Object.assign(new Error('attachment exceeds 25 MB limit'), { code: 'limit' }))
  const p = props({ onSave, putAttachment })
  shim.mount(() => EditorPanel(p))

  typeUnsaved('orig body PLUS unsaved edit')
  // A non-image file routes straight to putAttachment (skips toSdrImage); the
  // reject lands in the catch with the image never inserted.
  await fireAttach({ name: 'huge.bin', type: 'application/octet-stream' })
  // settle the rejected promise chain + any microtasks the catch schedules
  await new Promise((r) => setTimeout(r, 0))

  assert.ok(saves.length >= 1, 'attach failure must persist the pre-existing unsaved text (rescue flush) — not leave it memory-only')
  const last = saves[saves.length - 1]
  assert.equal(last.body, 'orig body PLUS unsaved edit', 'the rescue save persists the EXISTING unsaved body; the failed image was never inserted')
  assert.ok(!/attachments\//.test(last.body), 'the failed image must NOT appear in the persisted body')
  shim.unmount()
})

test('attach success persists exactly the inserted image on top of the unsaved text (success path unchanged)', async () => {
  const saves = []
  const onSave = (meta, body) => { saves.push({ meta, body }); return Promise.resolve() }
  const putAttachment = async (f) => ({ name: f.name, path: 'attachments/abc123' })
  const p = props({ onSave, putAttachment })
  shim.mount(() => EditorPanel(p))

  typeUnsaved('orig body PLUS unsaved edit')
  await fireAttach({ name: 'doc.pdf', type: 'application/pdf' })
  await new Promise((r) => setTimeout(r, 0))

  assert.equal(saves.length, 1, 'success path issues exactly one onSave (no extra rescue flush)')
  assert.match(saves[0].body, /attachments\/abc123/, 'success save includes the inserted attachment ref')
  assert.match(saves[0].body, /orig body PLUS unsaved edit/, 'success save preserves the unsaved text the insert sat on top of')
  shim.unmount()
})
