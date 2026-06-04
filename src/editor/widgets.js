// CodeMirror widget types for the live-preview editor: interactive task
// checkboxes, inline images (resolved from content-addressed attachment blobs),
// file chips, and KaTeX-rendered math. Each replaces its markdown source range
// when the cursor isn't on that line (see livePreview.js).
import { WidgetType } from '@codemirror/view'
import katex from 'katex'

export class CheckboxWidget extends WidgetType {
  constructor(checked, pos) { super(); this.checked = checked; this.pos = pos }
  eq(o) { return o.checked === this.checked && o.pos === this.pos }
  toDOM(view) {
    const box = document.createElement('input')
    box.type = 'checkbox'
    box.checked = this.checked
    box.style.cssText = 'margin:0 6px 0 0; cursor:pointer; vertical-align:middle; accent-color:var(--accent)'
    box.addEventListener('mousedown', (e) => {
      e.preventDefault()
      const insert = this.checked ? '[ ]' : '[x]'
      view.dispatch({ changes: { from: this.pos, to: this.pos + 3, insert } })
    })
    return box
  }
  ignoreEvent() { return false }
}

export class ImageWidget extends WidgetType {
  constructor(src, alt, resolve) { super(); this.src = src; this.alt = alt || ''; this.resolve = resolve; this.url = null }
  eq(o) { return o.src === this.src && o.alt === this.alt }
  toDOM() {
    const wrap = document.createElement('div')
    wrap.style.cssText = 'margin:8px 0; max-width:100%;'
    const img = document.createElement('img')
    img.alt = this.alt
    img.style.cssText = 'max-width:100%; max-height:360px; border-radius:10px; display:block; border:1px solid var(--border);'
    wrap.appendChild(img)
    if (this.resolve && this.src.startsWith('attachments/')) {
      this.resolve(this.src).then((u) => { if (u) { this.url = u; img.src = u } }).catch(() => {})
    } else {
      img.src = this.src
    }
    return wrap
  }
  destroy() { if (this.url) URL.revokeObjectURL(this.url) }
  get estimatedHeight() { return 220 }
  ignoreEvent() { return true }
}

export class FileChipWidget extends WidgetType {
  constructor(name, src, resolve) { super(); this.name = name; this.src = src; this.resolve = resolve }
  eq(o) { return o.src === this.src && o.name === this.name }
  toDOM() {
    const a = document.createElement('span')
    a.textContent = `📎 ${this.name}`
    a.title = this.name
    a.style.cssText = 'display:inline-flex; align-items:center; gap:4px; padding:2px 8px; margin:0 2px; border-radius:8px; border:1px solid var(--border); background:var(--surface2); color:var(--text); font-size:13px; cursor:pointer;'
    a.addEventListener('mousedown', async (e) => {
      e.preventDefault()
      if (this.resolve && this.src.startsWith('attachments/')) {
        const u = await this.resolve(this.src).catch(() => null)
        if (u) {
          const link = document.createElement('a')
          link.href = u
          link.download = this.name
          link.click()
          setTimeout(() => URL.revokeObjectURL(u), 0)
        }
      }
    })
    return a
  }
  ignoreEvent() { return false }
}

export class MathWidget extends WidgetType {
  constructor(src, block) { super(); this.src = src; this.block = !!block }
  eq(o) { return o.src === this.src && o.block === this.block }
  toDOM() {
    const el = document.createElement(this.block ? 'div' : 'span')
    try {
      // KaTeX renders trusted HTML from math source (it does not pass user HTML
      // through), so its output is safe to inject directly.
      el.innerHTML = katex.renderToString(this.src, { throwOnError: false, displayMode: this.block })
    } catch {
      el.textContent = this.block ? `$$${this.src}$$` : `$${this.src}$`
    }
    if (this.block) el.style.cssText = 'text-align:center; margin:8px 0; overflow-x:auto;'
    return el
  }
  ignoreEvent() { return true }
}
