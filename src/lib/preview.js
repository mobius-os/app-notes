// Read-only markdown render for note CARDS (the editor itself uses CodeMirror).
// Lazy-loads marked + DOMPurify from esm.sh — both small and already proven
// offline in the mind/news apps (the SW runtime-caches esm.sh). All rendered
// HTML is sanitized before it reaches the DOM.

let _libs
async function libs() {
  if (!_libs) {
    const [m, d] = await Promise.all([
      import('https://esm.sh/marked@14.1.4'),
      import('https://esm.sh/dompurify@3.1.7'),
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

export function firstLocalImageRef(meta = {}, body = '') {
  const fromBody = [...String(body || '').matchAll(/!\[[^\]]*\]\((attachments\/[^)\s]+)\)/g)]
    .map((m) => m[1])
    .find((path) => isLocalImagePath(path))
  if (fromBody) return fromBody

  const fromMeta = Array.isArray(meta.attachments)
    ? meta.attachments.find((path) => isLocalImagePath(path))
    : null
  return fromMeta || null
}

function isLocalImagePath(path) {
  return /^attachments\/[^/]+\.(png|jpe?g|gif|webp|avif)$/i.test(String(path || ''))
}

export async function renderPreviewHTML(md) {
  const { marked, purify } = await libs()
  const html = marked(neutralizePreviewMarkdown(md), { breaks: true, gfm: true })
  return purify.sanitize(html, PREVIEW_SANITIZE_OPTIONS)
}
