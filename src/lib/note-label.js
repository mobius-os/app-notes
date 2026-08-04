const MAX_SUMMARY = 72

function cleanMarkdownLine(line) {
  return String(line || '')
    .trim()
    .replace(/^#{1,6}\s+/, '')
    .replace(/^>\s?/, '')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
    .replace(/^[-*+]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function firstMeaningfulLine(body, maxLength = MAX_SUMMARY) {
  const lines = String(body || '').split(/\r?\n/)
  for (const line of lines) {
    const cleaned = cleanMarkdownLine(line)
    if (!cleaned) continue
    return cleaned.length > maxLength
      ? `${cleaned.slice(0, Math.max(1, maxLength - 1)).trimEnd()}…`
      : cleaned
  }
  return ''
}

export function noteDisplayName(meta = {}, body = '') {
  const title = String(meta.title || '').trim()
  if (title) return title
  return firstMeaningfulLine(body) || (meta.type === 'checklist' ? 'Untitled checklist' : 'Untitled note')
}

export function noteOpenLabel(meta = {}, body = '', date = '') {
  const title = String(meta.title || '').trim()
  if (title) return `Open note: ${title}`
  const summary = firstMeaningfulLine(body) || (meta.type === 'checklist' ? 'Empty checklist' : 'Empty note')
  return `Open untitled note: ${summary}${date ? `, ${date}` : ''}`
}
