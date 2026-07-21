// Locks the mechanical P1 + medium CSS fixes so a future edit can't silently
// regress them: --accent-fg on accent/danger fills (no hardcoded white), the 44px
// touch floor on the small icon/alert/modal buttons, the 16px focusable-field font
// (iOS zoom), the editor overlay safe-area inset, and the grid Offline pill.

import { test } from 'node:test'
import assert from 'node:assert'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { CSS } from '../src/ui/css.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const EXT = readFileSync(resolve(HERE, '..', 'src', 'editor', 'extensions.js'), 'utf8')
const APP = readFileSync(resolve(HERE, '..', 'src', 'app.jsx'), 'utf8')
const CARD = readFileSync(resolve(HERE, '..', 'src', 'ui', 'Card.jsx'), 'utf8')
const EDITOR = readFileSync(resolve(HERE, '..', 'src', 'editor', 'Editor.jsx'), 'utf8')
const LIVE_PREVIEW = readFileSync(resolve(HERE, '..', 'src', 'editor', 'livePreview.js'), 'utf8')
const EDITOR_PANEL = readFileSync(resolve(HERE, '..', 'src', 'ui', 'EditorPanel.jsx'), 'utf8')
const COLOR_PICKER = readFileSync(resolve(HERE, '..', 'src', 'ui', 'ColorPicker.jsx'), 'utf8')
const CONFIRM_MODAL = readFileSync(resolve(HERE, '..', 'src', 'ui', 'ConfirmModal.jsx'), 'utf8')

// Match the declarations WITHIN one rule block (up to the next `}`), so an assertion
// about `.nt-fab` can't be satisfied by an unrelated rule elsewhere.
const inBlock = (selector) => new RegExp(`\\${selector}\\s*\\{[^}]*`)

test('accent/danger fills use var(--accent-fg) with no hardcoded white', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-fab').source + 'color:\\s*var\\(--accent-fg\\)'), '.nt-fab foreground is --accent-fg')
  assert.match(CSS, new RegExp(inBlock('.nt-modal-confirm').source + 'color:\\s*var\\(--accent-fg\\)'), '.nt-modal-confirm foreground is --accent-fg')
  assert.doesNotMatch(CSS, /color:\s*#f/i, 'no `color: #fff/#ffffff` hardcoded fill foreground remains')
})

test('small icon/alert/modal buttons meet the 44px touch floor', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-icon-btn').source + 'width:\\s*44px'), '.nt-icon-btn is a 44px hit target')
  assert.match(CSS, new RegExp(inBlock('.nt-modal-btn').source + 'min-height:\\s*44px'), '.nt-modal-btn is >= 44px')
  assert.match(CSS, new RegExp(inBlock('.nt-conflict-btn').source + 'min-height:\\s*44px'), '.nt-conflict-btn is >= 44px')
  assert.match(CSS, new RegExp(inBlock('.nt-save-err-btn').source + 'min-height:\\s*44px'), '.nt-save-err-btn is >= 44px')
})

test('focusable text fields are 16px (no iOS zoom-on-focus)', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-search').source + 'font-size:\\s*16px'), '.nt-search is 16px')
  assert.match(EXT, /'\.cm-scroller':\s*\{[^}]*fontSize:\s*'16px'/, 'CodeMirror .cm-scroller is 16px')
})

test('editor markdown lines wrap on narrow screens', () => {
  assert.match(EXT, /EditorView\.lineWrapping/, 'CodeMirror lineWrapping extension is installed')
  assert.match(CSS, new RegExp(inBlock('.nt-cm-host .cm-scroller').source + 'overflow-x:\\s*hidden'), 'editor scroller does not expose horizontal scroll')
  assert.match(CSS, new RegExp(inBlock('.nt-cm-host .cm-line').source + 'white-space:\\s*pre-wrap'), 'editor lines preserve markdown whitespace while wrapping')
  assert.match(CSS, new RegExp(inBlock('.nt-cm-host .cm-line').source + 'overflow-wrap:\\s*anywhere'), 'long markdown fragments can wrap')
})

test('scrollable Notes surfaces keep scrollbars hidden', () => {
  assert.match(CSS, new RegExp(inBlock('.nt-scroll,\\n.nt-attach-strip').source + 'scrollbar-width:\\s*none'), 'main scroll and attachment strip hide Firefox scrollbars')
  assert.match(CSS, /\.nt-scroll::-webkit-scrollbar,\s*\.nt-attach-strip::-webkit-scrollbar\s*\{[^}]*display:\s*none/, 'main scroll and attachment strip hide WebKit scrollbars')
  assert.match(CSS, new RegExp(inBlock('.nt-editor-actions').source + 'scrollbar-width:\\s*none'), 'editor action rail hides Firefox scrollbar')
  assert.match(CSS, /\.nt-editor-actions::-webkit-scrollbar\s*\{\s*display:\s*none/, 'editor action rail hides WebKit scrollbar')
  assert.match(CSS, new RegExp(inBlock('.nt-cm-host .cm-scroller').source + 'scrollbar-width:\\s*none'), 'CodeMirror scroller hides Firefox scrollbar')
  assert.match(CSS, /\.nt-cm-host \.cm-scroller::-webkit-scrollbar\s*\{\s*display:\s*none/, 'CodeMirror scroller hides WebKit scrollbar')
})

test('the editor overlay insets for safe areas', () => {
  assert.match(CSS, /--nt-safe-top:\s*var\(--mobius-safe-top,\s*env\(safe-area-inset-top,\s*0px\)\)/, 'shell safe-area token falls back to env()')
  assert.match(CSS, new RegExp(inBlock('.nt-editor-root').source + 'var\\(--nt-safe-top\\)'), '.nt-editor-root pads for the notch')
  assert.match(CSS, /\.nt-editor-sheet\s*\{/, '.nt-editor-sheet is the over-grid editor surface')
})

test('editor opens as a click-out overlay with a single toolbar row', () => {
  assert.match(EDITOR_PANEL, /className="nt-editor-root"[\s\S]*onClick=\{\(e\) => \{ if \(!inactive && e\.target === e\.currentTarget\) closeEditor\(\) \}\}/, 'backdrop click closes the active editor')
  assert.match(EDITOR_PANEL, /className="nt-editor-toolbar"[\s\S]*aria-label="Back"[\s\S]*aria-label=\{note\.meta\.pinned \? 'Unpin' : 'Pin'\}/, 'back shares the toolbar row with note actions')
  assert.doesNotMatch(EDITOR_PANEL, /nt-editor-row[12]/, 'two-row editor toolbar stays removed')
  assert.doesNotMatch(CSS, /\.nt-editor-row[12]\b/, 'two-row editor toolbar CSS stays removed')
})

test('shell Back is wired through the editor save-aware close handler', () => {
  assert.match(APP, /closeRequestRef=\{editorCloseRef\}/, 'App gives EditorPanel the shell close ref')
  assert.match(APP, /const closeEditor = editorCloseRef\.current[\s\S]*closeEditor\(true\)/, 'shell Back invokes the editor close path with shell ownership')
  assert.match(EDITOR_PANEL, /closeRequestRef\.current = closeEditor/, 'EditorPanel registers its flush-before-close handler')
})

test('the grid Offline pill exists (SyncPill shape)', () => {
  assert.match(CSS, /\.nt-sync-pill\s*\{/, '.nt-sync-pill is defined')
})

test('the card grid uses the documented fluid auto-fill tracks', () => {
  assert.match(
    CSS,
    /grid-template-columns:\s*repeat\(auto-fill,\s*minmax\(min\(100%,\s*190px\),\s*1fr\)\)/,
    'Notes grid uses auto-fill minmax(190px, 1fr)',
  )
})

test('the loading state is a shaped skeleton, not a bare text screen', () => {
  assert.match(APP, /function LoadingGrid\(\)/, 'LoadingGrid component exists')
  assert.match(CSS, /\.nt-skeleton-grid\s*\{/, 'skeleton grid CSS exists')
  assert.match(CSS, /\.nt-skeleton-card\s*\{/, 'skeleton card CSS exists')
})

test('card titles stay text-only and task previews avoid duplicate bullets', () => {
  assert.doesNotMatch(CARD, /<div className="nt-card-title">\s*\{[^}]*<Icon/, 'card titles do not show checklist/lock icons')
  assert.match(CSS, new RegExp(inBlock('.nt-card-preview').source + 'color:\\s*color-mix\\(in srgb, var\\(--text\\)'), 'card preview text uses sharper text-weighted color')
  assert.match(CSS, /\.note-preview li:has\(> input\[type="checkbox"\]\)\s*\{[^}]*list-style:\s*none/, 'task list preview items hide list markers')
  assert.match(CSS, /\.note-preview li:has\(> input\[type="checkbox"\]\)::marker\s*\{\s*content:\s*""/, 'task list preview markers are suppressed')
  assert.match(LIVE_PREVIEW, /name === 'ListItem'[\s\S]*getChild\('Task'\)\?\.getChild\('TaskMarker'\)[\s\S]*Decoration\.replace\(\{\}\)/, 'editor live preview hides the redundant task list marker')
})

test('static layout has moved out of inline style props', () => {
  const source = [APP, CARD, EDITOR, EDITOR_PANEL].join('\n')
  assert.doesNotMatch(source, /style=\{\{[^}]*\b(?:height|display|position|gridTemplateColumns|aspectRatio|gridColumn)\b/, 'static layout styles stay in css.js')
  assert.match(COLOR_PICKER, /style=\{\{\s*top:\s*pos\.top,\s*left:\s*pos\.left\s*\}\}/, 'measured popover coordinates remain the one intentional inline style')
})

test('popover and dialog advertise implemented ARIA semantics only', () => {
  assert.doesNotMatch(COLOR_PICKER, /role="listbox"|role="option"|aria-selected/, 'color picker avoids listbox semantics without roving keyboard behavior')
  assert.match(COLOR_PICKER, /role="radiogroup"/, 'color picker is a labelled radio group')
  assert.match(COLOR_PICKER, /role="radio"[\s\S]*aria-checked=\{normalizedCurrent === c\.name\}/, 'current color is exposed as checked')
  assert.match(COLOR_PICKER, /e\.key === 'ArrowRight'[\s\S]*buttons\[nextIndex\]\.focus\(\)/, 'color picker implements roving arrow-key focus')
  assert.match(CONFIRM_MODAL, /role="dialog"[\s\S]*aria-modal="true"[\s\S]*aria-describedby/, 'dialog semantics live on the modal panel')
  assert.match(CSS, new RegExp(inBlock('.nt-modal-scrim').source + 'overscroll-behavior:\\s*contain'), 'modal scrim contains overscroll')
})

test('visible text inputs carry stable names and autocomplete policy', () => {
  assert.match(APP, /name="notes-search"[\s\S]*autoComplete="off"/, 'search input has a stable name and autocomplete policy')
  assert.match(EDITOR_PANEL, /name="note-title"[\s\S]*autoComplete="off"/, 'title input has a stable name and autocomplete policy')
})

test('locked notes expose read-only editor and protected delete controls', () => {
  assert.match(CARD, /title=\{locked \? 'Unlock to delete' : 'Delete'\}[\s\S]*disabled=\{locked\}/, 'locked cards disable delete')
  assert.match(EDITOR_PANEL, /readOnly=\{locked \|\| closing\}/, 'locked or closing editor title is read-only')
  assert.match(EDITOR_PANEL, /<Editor[\s\S]*readOnly=\{locked \|\| closing\}/, 'locked or closing editor body is read-only')
  assert.match(EDITOR, /EditorView\.editable\.of\(!readOnly\)/, 'CodeMirror editable facet follows lock state')
})
