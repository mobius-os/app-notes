// Per-device local sync state (IndexedDB, NOT synced across devices). For each
// note we keep a `base` (the last version we know is synced — the 3-way-merge
// ancestor) and a `working` (the latest local edit). A note is UNSYNCED when
// working.hash !== base.hash. This durable working copy is what lets an offline
// edit survive a reload AND lets reconcile recover it if another device's write
// clobbered the canonical path in the meantime (DESIGN §6).
import { idbGet, idbSet, idbDel, idbEntries } from './idb.js'

const KEY = (id) => `note:${id}`
const DEVICE_KEY = 'deviceId'

export async function getDeviceId() {
  let id = await idbGet(DEVICE_KEY)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await idbSet(DEVICE_KEY, id)
  }
  return id
}

// Seed the base on first sight of a note (loaded from canonical, no local record
// yet) — base === working === the canonical state, i.e. "fully synced".
export async function ensureBase(id, rec) {
  if (!(await idbGet(KEY(id)))) await idbSet(KEY(id), { base: rec, working: rec })
}

// Record a local edit: working advances, base stays (the merge ancestor).
export async function recordWorking(id, working) {
  const prev = (await idbGet(KEY(id))) || {}
  const base = prev.base || working
  await idbSet(KEY(id), { base, working })
}

// Record a local delete: base stays as the merge ancestor, working becomes a
// tombstone. If this device has not seen a base yet, callers may pass a
// baseHint derived from the note currently on screen.
export async function recordDeletion(id, baseHint = null) {
  const prev = (await idbGet(KEY(id))) || {}
  const base = prev.base || baseHint
  if (!base) return false
  await idbSet(KEY(id), { base, working: null })
  return true
}

// Mark a note fully synced at `synced` (after a confirmed canonical write or a
// completed reconcile): base === working === synced.
export async function promote(id, synced) {
  await idbSet(KEY(id), { base: synced, working: synced })
}

export async function getLocal(id) { return (await idbGet(KEY(id))) || null }
export async function clearLocal(id) { await idbDel(KEY(id)) }

// Every note with unsynced local changes — the reconcile work-list.
export async function unsyncedLocals() {
  const entries = await idbEntries()
  const out = []
  for (const [k, v] of entries) {
    if (!k.startsWith('note:') || !v || !v.base || !('working' in v)) continue
    if (v.working === null) {
      out.push([k.slice(5), v])
    } else if (v.working.hash !== v.base.hash) {
      out.push([k.slice(5), v])
    }
  }
  return out
}
