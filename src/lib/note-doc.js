// Canonical and legacy storage paths for the per-note JSON document model.
// Each note is one JSON document at notes/<id>.json holding { meta, body }.

export const notePath = (id) => `notes/${id}.json`
// The pre-JSON legacy path. remove() must delete this too, else the startup
// migration resurrects a just-deleted note from it on the next load.
export const legacyPath = (id) => `notes/${id}.md`
