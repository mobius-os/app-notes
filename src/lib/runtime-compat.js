// App modules embed the platform runtime present at compile time. App and
// platform updates can therefore arrive in either order on a self-hosted copy.
// Use explicit additive feature markers when available and retain the previous
// safe path on older runtimes instead of sending a new value they may stringify.
export const LEGACY_IDLE_DOCUMENT_PATH = '__notes_no_open__.json'

export function idleDocumentPath(runtimeFeatures) {
  return runtimeFeatures?.idleDocument === true
    ? null
    : LEGACY_IDLE_DOCUMENT_PATH
}
