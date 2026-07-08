// Regression: CodeMirror must remain the source of truth while typing. A parent
// re-render can briefly pass an older `value` prop than the live editor doc; the
// Editor wrapper must not dispatch that stale prop back into CodeMirror unless an
// explicit sync key says the app switched notes.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { build } from 'esbuild'
import { resolve, dirname } from 'node:path'
import { writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const SHIM = resolve(HERE, 'editor-render-shim.mjs')
const BUNDLE = resolve(ROOT, '.tmp-editor-input-source-bundle.mjs')

let Editor, shim

before(async () => {
  const plugin = {
    name: 'editor-input-source-shim',
    setup(b) {
      b.onResolve({ filter: /^react(\/jsx-runtime)?$/ }, () => ({ path: SHIM, external: true }))
      b.onResolve({ filter: /extensions\.js$/ }, () => ({ path: 'extensions', namespace: 'stub' }))
      b.onResolve({ filter: /^@codemirror\/state$/ }, () => ({ path: 'state', namespace: 'stub' }))
      b.onResolve({ filter: /^@codemirror\/view$/ }, () => ({ path: 'view', namespace: 'stub' }))
      b.onLoad({ filter: /^extensions$/, namespace: 'stub' }, () => ({
        contents: 'export function buildExtensions(){ return [] }',
        loader: 'js',
      }))
      b.onLoad({ filter: /^state$/, namespace: 'stub' }, () => ({
        contents: `
          class Doc { constructor(text){ this.text = text || '' } toString(){ return this.text } }
          export const EditorState = { create(opts){ return { doc: new Doc(opts.doc || '') } } }
        `,
        loader: 'js',
      }))
      b.onLoad({ filter: /^view$/, namespace: 'stub' }, () => ({
        contents: `
          class Doc { constructor(text){ this.text = text || '' } toString(){ return this.text } }
          globalThis.__editorDispatches = []
          export class EditorView {
            constructor(opts){ this.state = opts.state; globalThis.__lastEditorView = this }
            dispatch(spec){
              globalThis.__editorDispatches.push(spec)
              if (spec && spec.changes) this.state.doc = new Doc(spec.changes.insert || '')
            }
            destroy(){}
          }
        `,
        loader: 'js',
      }))
    },
  }
  const r = await build({
    entryPoints: [resolve(ROOT, 'src/editor/Editor.jsx')],
    bundle: true, write: false, format: 'esm', jsx: 'automatic',
    platform: 'neutral', plugins: [plugin], logLevel: 'silent',
  })
  writeFileSync(BUNDLE, r.outputFiles[0].text)
  shim = await import(pathToFileURL(SHIM).href)
  Editor = await import(pathToFileURL(BUNDLE).href)
})

after(() => { try { shim.unmount() } catch {} ; try { rmSync(BUNDLE) } catch {} })

const tick = () => new Promise((r) => setTimeout(r, 0))

test('stale value prop is ignored until syncKey changes', async () => {
  let setValue
  let setSyncKey
  const viewRef = { current: null }
  shim.mount(() => {
    const [value, setV] = shim.useState('abcdef')
    const [syncKey, setK] = shim.useState('n1')
    setValue = setV
    setSyncKey = setK
    return Editor.default({ value, syncKey, onChange() {}, resolveAttachment: async () => null, viewRef })
  })
  await tick()
  assert.equal(viewRef.current.state.doc.toString(), 'abcdef')
  assert.equal(globalThis.__editorDispatches.length, 0)

  // Parent re-render with an older body from a save echo/autosave race.
  setValue('abc')
  await tick()
  assert.equal(viewRef.current.state.doc.toString(), 'abcdef', 'same-note stale prop did not overwrite the live editor')
  assert.equal(globalThis.__editorDispatches.length, 0, 'no CodeMirror dispatch happened for the stale same-note value')

  // A real note switch changes the sync key; then replacing the document is valid.
  setValue('new note body')
  setSyncKey('n2')
  await tick()
  assert.equal(viewRef.current.state.doc.toString(), 'new note body')
  assert.equal(globalThis.__editorDispatches.length, 1, 'note-switch sync replaces the document once')
})
