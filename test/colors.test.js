import {test} from 'node:test'
import assert from 'node:assert'
import {NOTE_COLORS, colorHex, normalizeColorName} from '../src/ui/colors.js'

test('palette is the muted tone set: default + 5 tones', () => {
  assert.deepEqual(NOTE_COLORS.map((c) => c.name), [null, 'slate', 'moss', 'sand', 'clay', 'plum'])
  for (const c of NOTE_COLORS.slice(1)) assert.match(c.hex, /^#[0-9a-f]{6}$/i)
})

test('colorHex resolves current tone names', () => {
  assert.equal(colorHex('slate'), '#7d96b4')
  assert.equal(colorHex(null), null)
})

test('legacy stored names map to the nearest muted tone on read', () => {
  assert.equal(normalizeColorName('violet'), 'plum')
  assert.equal(normalizeColorName('pink'), 'plum')
  assert.equal(normalizeColorName('green'), 'moss')
  assert.equal(normalizeColorName('amber'), 'sand')
  assert.equal(normalizeColorName('coral'), 'clay')
  assert.equal(normalizeColorName('sky'), 'slate')
  // …and colorHex follows the mapping, so a legacy note renders a current tone.
  assert.equal(colorHex('sky'), colorHex('slate'))
})

test('current tone names pass through normalization unchanged', () => {
  for (const c of NOTE_COLORS.slice(1)) assert.equal(normalizeColorName(c.name), c.name)
})

test('unknown or absent color names resolve to default, never crash', () => {
  assert.equal(normalizeColorName('chartreuse'), null)
  assert.equal(normalizeColorName(null), null)
  assert.equal(normalizeColorName(undefined), null)
  assert.equal(colorHex('chartreuse'), null)
})
