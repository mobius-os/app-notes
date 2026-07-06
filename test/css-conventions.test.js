// Locks the mechanical P1 + medium CSS fixes so a future edit can't silently
// regress them: --accent-fg on accent/danger fills (no hardcoded white), the 44px
// touch floor on the small icon/alert/modal buttons, the 16px focusable-field font
// (iOS zoom), the editor header's top safe-area inset, and the grid Offline pill.

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSS } from '../src/ui/css.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXT = readFileSync(resolve(HERE, '..', 'src', 'editor', 'extensions.js'), 'utf8')

// Match the declarations WITHIN one rule block (up to the next `}`), so an assertion
// about `.nt-fab` can't be satisfied by an unrelated rule elsewhere.
const inBlock = (selector) => new RegExp(`\\${selector}\\s*\\{[^}]*`)

test('accent/danger fills use var(--accent-fg) with no hardcoded white', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-fab').source + 'color:\\s*var\\(--accent-fg\\)'), '.nt-fab foreground is --accent-fg')
  assert.match(CSS, new RegExp(inBlock('.nt-modal-confirm').source + 'color:\\s*var\\(--accent-fg\\)'), '.nt-modal-confirm foreground is --accent-fg')
  assert.doesNotMatch(CSS, /color:\s*#f/i, 'no `color: #fff/#ffffff` hardcoded fill foreground remains')
})

test('small icon/alert/modal buttons meet the 44px touch floor', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-card-pin').source + 'width:\\s*44px'), '.nt-card-pin is a 44px hit target')
  assert.match(CSS, new RegExp(inBlock('.nt-modal-btn').source + 'min-height:\\s*44px'), '.nt-modal-btn is >= 44px')
  assert.match(CSS, new RegExp(inBlock('.nt-conflict-btn').source + 'min-height:\\s*44px'), '.nt-conflict-btn is >= 44px')
  assert.match(CSS, new RegExp(inBlock('.nt-save-err-btn').source + 'min-height:\\s*44px'), '.nt-save-err-btn is >= 44px')
})

test('focusable text fields are 16px (no iOS zoom-on-focus)', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-search').source + 'font-size:\\s*16px'), '.nt-search is 16px')
  assert.match(EXT, /'\.cm-scroller':\s*\{[^}]*fontSize:\s*'16px'/, 'CodeMirror .cm-scroller is 16px')
})

test('the editor header insets for the top safe area', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-editor-hdr').source + 'env\\(safe-area-inset-top\\)'), '.nt-editor-hdr pads for the notch')
})

test('the grid Offline pill exists (SyncPill shape)', () => {
  assert.match(CSS, /\.nt-sync-pill\s*\{/, '.nt-sync-pill is defined')
})
