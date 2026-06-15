// Read-only markdown render for note CARDS (the editor itself uses CodeMirror).
// Lazy-loads marked + DOMPurify via the app frame's import map, which resolves
// the bare specifiers to the self-hosted /vendor bundles (no longer esm.sh).
// The SW precaches both, so previews render offline-deterministically. All
// rendered HTML is sanitized before it reaches the DOM.

let _libs
async function libs() {
  if (!_libs) {
    const [m, d] = await Promise.all([
      import('marked'),
      import('dompurify'),
    ])
    _libs = { marked: m.marked, purify: d.default || d }
  }
  return _libs
}

export const PREVIEW_SANITIZE_OPTIONS = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ['img', 'picture', 'source', 'video', 'audio', 'iframe'],
  FORBID_ATTR: ['href', 'src', 'srcset', 'xlink:href', 'formaction'],
}

// Card previews are read-only summaries, not a browser surface. Attachment
// paths cannot render without a blob resolver, and external URLs would create
// tracking/network surprises in a masonry grid. Keep the human-visible label
// and remove the URL before marked sees it; DOMPurify below also strips any
// URL-bearing attrs that arrive through raw HTML or autolinks.
export function neutralizePreviewMarkdown(md) {
  return (md || '')
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, url) => (
      String(url).startsWith('attachments/') ? ` 🖼 ${alt || ''} ` : ` ${alt || 'image'} `
    ))
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
}

export function localImageRefs(meta = {}, body = '', limit = 4) {
  const seen = new Set()
  const out = []
  const add = (path) => {
    if (out.length >= limit || seen.has(path) || !isLocalImagePath(path)) return
    seen.add(path)
    out.push(path)
  }

  ;[...String(body || '').matchAll(/!\[[^\]]*\]\((attachments\/[^)\s]+)\)/g)]
    .map((m) => m[1])
    .forEach(add)

  if (Array.isArray(meta.attachments)) meta.attachments.forEach(add)
  return out
}

export function firstLocalImageRef(meta = {}, body = '') {
  return localImageRefs(meta, body, 1)[0] || null
}

function isLocalImagePath(path) {
  return /^attachments\/[^/]+\.(png|jpe?g|gif|webp|avif)$/i.test(String(path || ''))
}

export async function renderPreviewHTML(md) {
  const { marked, purify } = await libs()
  const html = marked(neutralizePreviewMarkdown(md), { breaks: true, gfm: true })
  return purify.sanitize(html, PREVIEW_SANITIZE_OPTIONS)
}
