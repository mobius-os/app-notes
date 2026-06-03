// Reconcile driver. The Möbius storage outbox is last-write-wins with no atomic
// write, so we do NOT write note edits straight to the canonical path (a queued
// stale write would clobber a merge). Instead edits live in the per-device
// working copy (local.js); THIS is the sole writer of canonical notes/<id>.md.
//
// On reconnect / focus / open, for each unsynced note we load the current
// canonical, run the (unit-tested) reconcile() decision over
// {base, mine=working, server=canonical}, and:
//   noop          -> mark synced
//   fast-forward  -> our edit lands (server unchanged since base)
//   merged        -> clean 3-way merge lands
//   conflict      -> write an immutable descriptor; the agent resolves it (H)
//
// KNOWN BOUNDS (verified fully only in the container e2e): loadNote is
// stale-while-revalidate, so the first pass after reconnect may read a slightly
// stale canonical and converge on the next pass; navigator.onLine can read
// stale-true on some mobile PWAs. Neither loses data — the working copy is
// durable and a later reconcile re-runs.
import { reconcile } from './sync.js'
import { contentHash } from './note.js'
import { unsyncedLocals, promote } from './local.js'
import * as store from './store.js'

let _running = false

export async function reconcileAll({ onApplied, onConflict } = {}) {
  if (_running || !store.isOnline()) return { ran: false }
  _running = true
  const results = []
  try {
    const work = await unsyncedLocals()
    for (const [id, rec] of work) {
      try {
        const loaded = await store.loadNote(id)
        const server = loaded
          ? { meta: loaded.meta, body: loaded.body, hash: await contentHash(loaded.meta, loaded.body) }
          : null
        const decision = reconcile({ base: rec.base, mine: rec.working, server })

        if (decision.action === 'noop') {
          await promote(id, rec.working)
        } else if (decision.action === 'fast-forward' || decision.action === 'merged') {
          const note = decision.note
          note.meta.content_hash = await contentHash(note.meta, note.body)
          note.meta.updated = note.meta.updated || new Date().toISOString()
          const res = await store.saveNote(note.meta, note.body)
          if (res && res.synced) {
            await promote(id, { meta: note.meta, body: note.body, hash: note.meta.content_hash })
            if (onApplied) onApplied(id, note)
          }
        } else if (decision.action === 'conflict') {
          const d = decision.descriptor
          await store.writeConflict(d.path, d)
          if (onConflict) onConflict(id, d)
        }
        results.push([id, decision.action])
      } catch (e) {
        results.push([id, 'error'])
      }
    }
  } finally {
    _running = false
  }
  return { ran: true, results }
}
