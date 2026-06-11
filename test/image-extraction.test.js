// Regression tests for image-src extraction from the CodeMirror syntax tree.
//
// Root cause fixed: the live-preview plugin previously used
//   /!\[([^\]]*)\]\(([^)\s]+)/
// to pull the URL out of an Image node's raw text. [^\]]* stops at the FIRST
// `]`, so filenames that contain a `]` (e.g. "photo[1].jpg") produced a failed
// match and the image was left as raw markdown text instead of being replaced
// with an <img> widget.
//
// The fix reads the URL directly from the syntax tree's `URL` child node and
// computes the alt text via doc offsets, so no regex can misfire on the alt.
//
// These tests exercise the exact extraction path (EditorState + syntaxTree +
// node.node.getChild) that livePreview.js uses at runtime, without needing a
// full browser/EditorView environment.

import { test } from 'node:test'
import assert from 'node:assert'
import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const { EditorState } = require('@codemirror/state')
const { syntaxTree } = require('@codemirror/language')
const { markdown, markdownLanguage } = require('@codemirror/lang-markdown')

// Helper: extract src+alt pairs for every Image node using the tree-based
// approach (the fixed code path from livePreview.js).
function extractImages(docText) {
  const state = EditorState.create({
    doc: docText,
    extensions: [markdown({ base: markdownLanguage })],
  })
  const tree = syntaxTree(state)
  const images = []
  tree.iterate({
    enter(node) {
      if (node.name !== 'Image') return
      const urlChild = node.node.getChild('URL')
      if (!urlChild) return
      const src = state.doc.sliceString(urlChild.from, urlChild.to)
      const alt = state.doc.sliceString(node.from + 2, urlChild.from - 2)
      images.push({ src, alt })
    },
  })
  return images
}

test('plain filename: src and alt extracted correctly', () => {
  const imgs = extractImages('![photo.jpg](attachments/abc123.jpeg)')
  assert.equal(imgs.length, 1)
  assert.equal(imgs[0].src, 'attachments/abc123.jpeg')
  assert.equal(imgs[0].alt, 'photo.jpg')
})

test('filename with ] bracket: url extracted without regex mismatch (regression)', () => {
  // Before the fix, /!\[([^\]]*)\]\(/ stopped at the ] inside "[1]" and
  // returned mm=null, so no widget was created and the raw markdown persisted.
  const imgs = extractImages('![photo[1].jpg](attachments/abc123.jpeg)')
  assert.equal(imgs.length, 1, 'image node must produce exactly one decoration')
  assert.equal(imgs[0].src, 'attachments/abc123.jpeg')
  assert.equal(imgs[0].alt, 'photo[1].jpg')
})

test('empty alt text: url still extracted', () => {
  const imgs = extractImages('![](attachments/abc123.png)')
  assert.equal(imgs.length, 1)
  assert.equal(imgs[0].src, 'attachments/abc123.png')
  assert.equal(imgs[0].alt, '')
})

test('alt text with spaces: url still extracted', () => {
  const imgs = extractImages('![My Holiday Photo.jpg](attachments/abc123.jpeg)')
  assert.equal(imgs.length, 1)
  assert.equal(imgs[0].src, 'attachments/abc123.jpeg')
  assert.equal(imgs[0].alt, 'My Holiday Photo.jpg')
})

test('multiple images in document: both extracted', () => {
  const doc = '![a.png](attachments/aaa.png)\n![b[2].jpg](attachments/bbb.jpeg)'
  const imgs = extractImages(doc)
  assert.equal(imgs.length, 2)
  assert.equal(imgs[0].src, 'attachments/aaa.png')
  assert.equal(imgs[0].alt, 'a.png')
  assert.equal(imgs[1].src, 'attachments/bbb.jpeg')
  assert.equal(imgs[1].alt, 'b[2].jpg')
})

test('src startsWith attachments/ check: local image paths pass', () => {
  const imgs = extractImages('![img](attachments/sha256abc.webp)')
  assert.equal(imgs.length, 1)
  assert.ok(imgs[0].src.startsWith('attachments/'), 'src must start with attachments/')
})
