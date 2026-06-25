// Tests for the SDR-image flatten safety contract (toSdrImage).
//
// The real canvas re-encode (Ultra HDR gain map -> SDR sRGB) only runs in a
// browser; this node env has no <canvas>/createImageBitmap, so these tests pin
// the NON-DESTRUCTIVE fallbacks that must hold everywhere:
//   - a non-image file is returned untouched,
//   - an SVG (vector, no gain map) is returned untouched,
//   - in a non-browser env (or any decode/encode failure) the ORIGINAL file is
//     returned rather than dropped — a degraded-but-stored attachment always
//     beats a lost one.
// The browser-path conversion itself is verified live on mobius-test (a stored
// blob re-inspected with python3 confirming no MPF/hdrgm metadata).

import { test } from 'node:test'
import assert from 'node:assert'
import { toSdrImage } from '../src/lib/sdr-image.js'

// Minimal File-like stand-in (node here has no DOM File). toSdrImage's early
// guards only read `.type`/`.name`, so this is enough to exercise them.
function fakeFile(type, name = 'x') {
  return { type, name, size: 10, arrayBuffer: async () => new ArrayBuffer(10) }
}

test('non-image file is returned unchanged', async () => {
  const f = fakeFile('application/pdf', 'doc.pdf')
  assert.strictEqual(await toSdrImage(f), f)
})

test('SVG image is returned unchanged (vector, no gain map)', async () => {
  const f = fakeFile('image/svg+xml', 'logo.svg')
  assert.strictEqual(await toSdrImage(f), f)
})

test('GIF is returned unchanged (no gain map; a re-encode would drop animation)', async () => {
  const f = fakeFile('image/gif', 'loop.gif')
  assert.strictEqual(await toSdrImage(f), f)
})

test('missing/empty file is passed through (no throw)', async () => {
  assert.strictEqual(await toSdrImage(null), null)
  assert.strictEqual(await toSdrImage(undefined), undefined)
})

test('in a non-browser env, an image file is returned unchanged (never lost)', async () => {
  // No document/HTMLCanvasElement/createImageBitmap here => isBrowserImageEnv()
  // is false => the original file must come back, not null/undefined.
  const f = fakeFile('image/jpeg', 'photo.jpeg')
  assert.strictEqual(await toSdrImage(f), f)
})
