// Durability predicate for a Möbius storage write result.
//
// The platform's storage write (window.mobius.storage setText/set, wrapped by
// store.saveNote) resolves to {synced}|{queued}: `synced === true` means the
// bytes landed canonically; `queued === true` means they were durably enqueued
// in the offline outbox and will sync later. Either is DURABLE — the write will
// not be lost. A RESOLVED result that is neither — {synced:false} with no queue,
// {ok:false}, {error:true}, or a missing/empty value — is NON-durable: the write
// did not take. A non-durable resolve is just as much a failure as a rejected
// promise, and callers must treat it as one: keep the in-memory copy and surface
// a retry rather than clearing the draft / promoting as synced / emitting a saved
// signal. This is the single source of truth for that rule, mirrored from the
// reconcile driver (which promotes/clears only on res.synced).
export function isDurableWrite(res) {
  return !!res && (res.synced === true || res.queued === true)
}
