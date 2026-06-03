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

// In a card preview an attachment image's src is a STORAGE PATH, not a URL, so
// it can't render — show a compact chip instead of a broken image. Block math
// is left as text (cards stay lightweight); the editor renders real KaTeX.
function neutralize(md) {
  return (md || '')
    .replace(/!\[[^\]]*\]\(attachments\/[^)]+\)/g, ' 🖼 ')
    .replace(/\[([^\]]+)\]\(attachments\/[^)]+\)/g, ' 📎 $1 ')
}

export async function renderPreviewHTML(md) {
  const { marked, purify } = await libs()
  const html = marked(neutralize(md), { breaks: true, gfm: true })
  return purify.sanitize(html, { USE_PROFILES: { html: true } })
}
