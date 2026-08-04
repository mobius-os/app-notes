// Regression: CodeMirror must remain the source of truth while typing. A parent
// re-render can briefly pass an older `value` prop than the live editor doc; the
// Editor wrapper must not dispatch that stale prop back into CodeMirror unless an
// explicit sync key says the app switched notes.

import { test, before, after } from 'node:test'
import assert from 'node:assert'
import { resolve, dirname } from 'node:path'
import { rmSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { bundleForRender, RENDER_SHIM as SHIM } from './render-bundle.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const BUNDLE = resolve(ROOT, '.tmp-editor-input-source-bundle.mjs')

const EXTENSIONS_STUB = 'export function buildExtensions(){ return [] }'

const STATE_STUB = `
  class Doc { constructor(text){ this.text = text || '' } toString(){ return this.text } }
  export class Compartment { of(v){ return v } reconfigure(v){ return { reconfigure: v } } }
  export const EditorState = { create(opts){ return { doc: new Doc(opts.doc || '') } } }
`

const VIEW_STUB = `
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
`

let Editor, shim

before(async () => {
  await bundleForRender({
    entry: resolve(ROOT, 'src/editor/Editor.jsx'),
    outfile: BUNDLE,
    stubs: [
      { match: /extensions\.js$/, code: EXTENSIONS_STUB },
      { match: /^@codemirror\/state$/, code: STATE_STUB },
      { match: /^@codemirror\/view$/, code: VIEW_STUB },
    ],
  })
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
