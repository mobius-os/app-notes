// Pure selection logic for the home grid: which notes show for a search query,
// and in what order. Kept out of app.jsx so the ordering contract — pinned
// first, then most-recently-EDITED first — is unit-testable.
//
// `updated` is stamped only by real content changes (persist compares content
// hashes before stamping; see app.jsx), so this sort moves a note to the top
// when it is edited, never when it is merely opened. Legacy fields from
// removed features (meta.archived, meta.tags) are deliberately ignored: an
// archived note from v1.1 simply appears in the main list.
export function visibleNotes(notes, query) {
  const q = (query || '').trim().toLowerCase()
  let list = notes
  if (q) {
    list = list.filter((n) =>
      (n.meta.title || '').toLowerCase().includes(q) ||
      (n.body || '').toLowerCase().includes(q))
  }
  return [...list].sort((a, b) => {
    if (!!a.meta.pinned !== !!b.meta.pinned) return a.meta.pinned ? -1 : 1
    return (b.meta.updated || '').localeCompare(a.meta.updated || '')
  })
}
