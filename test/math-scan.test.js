import { test } from 'node:test'
import assert from 'node:assert'
import { findMathSpans, isInlineMathDelims } from '../src/lib/math-scan.js'

test('inline math renders for a real expression', () => {
  const spans = findMathSpans('the value $x+1$ here')
  assert.equal(spans.length, 1)
  assert.equal(spans[0].block, false)
  assert.equal(spans[0].src, 'x+1')
})

test('two dollar amounts on one line are NOT treated as math (notes-2)', () => {
  // "$5 and $10" must not be glued into one bogus inline-math span.
  const spans = findMathSpans('It costs $5 and $10 total')
  assert.equal(spans.length, 0)
})

test('a single dollar amount mid-prose is not math', () => {
  assert.equal(findMathSpans('about $20 dollars').length, 0)
})

test('multi-line $$ display math renders (notes-3)', () => {
  const text = 'before\n$$\n\\int_0^1 x\\,dx\n$$\nafter'
  const spans = findMathSpans(text)
  const block = spans.find((s) => s.block)
  assert.ok(block, 'expected a block-math span')
  assert.equal(block.src, '\\int_0^1 x\\,dx')
  // The span covers from the first $$ to the closing $$ (crosses newlines).
  assert.equal(text.slice(block.from, block.to).startsWith('$$'), true)
  assert.equal(text.slice(block.from, block.to).endsWith('$$'), true)
  assert.ok(block.to - block.from > '$$$$'.length)
})

test('single-line $$ display math still renders', () => {
  const spans = findMathSpans('$$a^2+b^2$$')
  assert.equal(spans.length, 1)
  assert.equal(spans[0].block, true)
  assert.equal(spans[0].src, 'a^2+b^2')
})

test('inline math inside a block region is not double-counted', () => {
  const spans = findMathSpans('$$ x $ y $$')
  // Only the block span; the inner stray $ is inside the block range.
  assert.equal(spans.filter((s) => !s.block).length, 0)
})

test('isInlineMathDelims rejects currency-like delimiters', () => {
  assert.equal(isInlineMathDelims('5 and '), false) // opens with a digit
  assert.equal(isInlineMathDelims(' x '), false) // opens/closes with space
  assert.equal(isInlineMathDelims('x+1'), true)
  assert.equal(isInlineMathDelims(''), false)
})
