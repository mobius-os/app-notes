// Medium-bug regression: a touch long-press on a card reveals its tools without the
// finger-release click then opening the editor over them. The fix uses pointer
// events + a one-shot suppressNextClick flag (the old touch-timing version called
// e.preventDefault() inside the 300ms timer, after the touch event had already
// dispatched — too late to stop the synthesized click). Mouse pointers are exempt
// (they reveal tools on hover), so a slow desktop click still opens.
//
// Renders the REAL Card with the render-heavy children (preview, ColorPicker, icons)
// stubbed; colors.js resolves for real.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-card-longpress-bundle.mjs')

let Card, shim

before(async () => {
  const plugin = {
    name: 'card-render-shim',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      b.onResolve({ filter: /(ColorPicker|icons)\.jsx$/ }, () => ({ path: 'stub', namespace: 'stub' }))
      b.onResolve({ filter: /preview\.js$/ }, () => ({ path: 'stub', namespace: 'stub' }))
      b.onResolve({ filter: /.*/ }, (a) => {
        if (a.kind === 'entry-point') return null
        if (!a.path.startsWith('.') && !a.path.startsWith('/')) return { path: 'noop', namespace: 'stub' }
        return null
      })
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({
        contents:
          'export default function Stub(){return null};' +
          'export const Icon=()=>null; export const createPortal=()=>null;' +
          'export const localImageRefs=()=>[]; export const renderPreviewHTML=async()=>"";',
        loader: 'js',
      }))
    },
  }
  const r = await build({
    entryPoints: [resolve(ROOT, 'src/ui/Card.jsx')],
    bundle: true, write: false, format: 'esm', jsx: 'automatic',
    platform: 'neutral', plugins: [plugin], logLevel: 'silent',
  })
  writeFileSync(BUNDLE, r.outputFiles[0].text)
  globalThis.document = globalThis.document || { addEventListener() {}, removeEventListener() {} }
  globalThis.window = globalThis.window || { addEventListener() {}, removeEventListener() {}, location: { origin: 'http://localhost' } }
  shim = await import(pathToFileURL(SHIM).href)
  Card = (await import(pathToFileURL(BUNDLE).href)).default
})

after(() => { try { rmSync(BUNDLE) } catch {} })

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

const cardWrap = () => findEl((n) => n.props && typeof n.props.onPointerDown === 'function' && typeof n.props.className === 'string')
const bodyEl = () => findEl((n) => n.props && n.props.role === 'button' && typeof n.props.onClick === 'function')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

function mountCard(onOpen) {
  const props = {
    note: { meta: { id: 'c1', title: 'T', type: 'note', color: null, pinned: false, attachments: [] }, body: 'hi' },
    onOpen, onPin() {}, onColor() {}, onDelete() {}, resolveAttachment: async () => null,
  }
  shim.mount(() => Card(props))
}

test('touch long-press opens the tools; the release click does NOT open the editor', async () => {
  let opened = 0
  mountCard(() => { opened++ })

  cardWrap().props.onPointerDown({ pointerType: 'touch' })
  await wait(340) // let the 300ms long-press timer fire

  assert.match(cardWrap().props.className, /nt-card--tools/, 'the long-press revealed the tools')

  bodyEl().props.onClick() // the synthesized finger-up click
  assert.equal(opened, 0, 'the release click after a long-press is swallowed, not an open')

  bodyEl().props.onClick() // a fresh, deliberate tap
  assert.equal(opened, 1, 'a subsequent tap opens normally (the suppress is one-shot)')
  shim.unmount()
})

test('a mouse pointer never arms the long-press; a click opens immediately', async () => {
  let opened = 0
  mountCard(() => { opened++ })

  cardWrap().props.onPointerDown({ pointerType: 'mouse' })
  await wait(340)

  assert.ok(!/nt-card--tools/.test(cardWrap().props.className), 'a mouse press does not open the touch tools')
  bodyEl().props.onClick()
  assert.equal(opened, 1, 'a normal mouse click opens the editor (desktop not regressed)')
  shim.unmount()
})
