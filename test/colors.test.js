import {test} from 'node:test'
import assert from 'node:assert'
import {colorHex, colorTint} from '../src/ui/colors.js'

test('colorHex returns palette colors by stored name', () => {
  assert.equal(colorHex('sky'), '#60a5fa')
  assert.equal(colorHex(null), null)
  assert.equal(colorHex('missing'), null)
})

test('colorTint derives a stable rgba tint for full-card color treatment', () => {
  assert.equal(colorTint('sky'), 'rgba(96, 165, 250, 0.16)')
  assert.equal(colorTint('coral', 0.32), 'rgba(248, 113, 113, 0.32)')
  assert.equal(colorTint(null), null)
})
