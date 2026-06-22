// Per-device local sync state (IndexedDB, NOT synced across devices). For each
// note we keep a `base` (the last version we know is synced — the 3-way-merge
// ancestor) and a `working` (the latest local edit). A note is UNSYNCED when
// working.hash !== base.hash. This durable working copy is what lets an offline
// edit survive a reload AND lets reconcile recover it if another device's write
// clobbered the canonical path in the meantime (DESIGN §6).
import { idbGet, idbSet, idbDel, idbEntries } from './idb.js'

const KEY = (id) => `note:${id}`
const DEVICE_KEY = 'deviceId'

// Per-note serialized write queue. Each idbGet/idbSet opens its OWN IndexedDB
// transaction (idb.js), so a mutator's read-modify-write (read prev, then write
// {base, working}) spans two transactions with an event-loop yield between them.
// Two un-serialized mutators on the same id — e.g. recordWorking racing a
// reconcile promote — can interleave their read and write and lose one writer's
// advance (a stale base re-emerges -> phantom merge conflict). withLock chains
// every mutation of note:<id> through a per-id promise so each read-modify-write
// runs to completion before the next begins: the RMW is atomic and writes apply
// in submission order. INVARIANT: no two mutations on the same id ever observe
// each other's partial state. Reads stay lock-free (they tolerate a concurrent
// settled write). The chain link is stored already-settled so one failed
// mutation can never reject the next, and the map entry is dropped once its tail
// drains so it does not grow unbounded.
const _locks = new Map()
function withLock(id, fn) {
  const prev = _locks.get(id) || Promise.resolve()
  const result = prev.then(fn, fn)
  const tail = result.then(() => {}, () => {})
  _locks.set(id, tail)
  tail.then(() => { if (_locks.get(id) === tail) _locks.delete(id) })
  return result
}

export async function getDeviceId() {
  let id = await idbGet(DEVICE_KEY)
  if (!id) {
    id = (typeof crypto !== 'undefined' && crypto.randomUUID) ? crypto.randomUUID() : `dev-${Date.now()}-${Math.random().toString(36).slice(2)}`
    await idbSet(DEVICE_KEY, id)
  }
  return id
}

// Per-note monotonic edit sequence. base/working alone cannot order two writes:
// `promote` is a blind setter, so if a stale-payload promote is submitted AFTER
// a fresh one (e.g. two overlapping draft commits whose canonical writes resolve
// out of order), the stale one wins last and pins base===working to old content
// — and unsyncedLocals then EXCLUDES the note, so reconcile never repairs it.
// `seq` makes writes orderable: every state-advancing write stamps seq = prev+1;
// promote only applies when its payload is at least as fresh as what is stored
// (seq >= stored seq). A stale-but-later promote is a no-op. The reconciler
// passes the seq of the working it synced, so an edit that landed mid-reconcile
// (a higher seq) is never clobbered by the reconcile's promote.
function nextSeq(prev) {
  return ((prev && typeof prev.seq === 'number') ? prev.seq : 0) + 1
}

// Seed the base on first sight of a note (loaded from canonical, no local record
// yet) — base === working === the canonical state, i.e. "fully synced".
export async function ensureBase(id, rec) {
  return withLock(id, async () => {
    if (!(await idbGet(KEY(id)))) await idbSet(KEY(id), { base: rec, working: rec, seq: 1 })
  })
}

// Record a local edit: working advances, base stays (the merge ancestor).
//
// `baseHint` is the authoritative PRE-EDIT note ({meta, body, hash}) the caller
// already holds. It is the seed for the merge ancestor on the FIRST edit of a
// note this device hasn't tracked yet (the background ensureBase loop may not
// have run). Defaulting base to `working` would set base === working, so
// unsyncedLocals would EXCLUDE the note (hashes equal) — the edit never reaches
// canonical (silent lost update) and a later edit would 3-way-merge against the
// poisoned base. Seeding from the real pre-edit content makes the note enter the
// reconcile queue and merge against its true ancestor. An existing base always
// wins (it's the last-known-synced version); we only fall back to `working` when
// the caller passed no hint AND none was tracked. The read-modify-write runs
// under the per-note lock so a concurrent reconcile promote cannot interleave
// between the read and the write and re-stamp a stale base (the phantom-conflict
// race). It returns the seq it stamped so the caller can promote that exact edit.
export async function recordWorking(id, working, baseHint = null) {
  return withLock(id, async () => {
    const prev = (await idbGet(KEY(id))) || {}
    // An existing record's base is authoritative — INCLUDING an explicit null
    // (a pending create that has not been synced yet). Only seed from the hint
    // (or, as a last resort, the working itself) when this device has no record
    // at all. Overwriting a pending create's null base with a hint would make
    // reconcile see base!==null with an absent server and mis-classify the
    // create as a conflict.
    const hasRecord = ('base' in prev) || ('working' in prev)
    const base = hasRecord ? prev.base : (baseHint || working)
    const seq = nextSeq(prev)
    await idbSet(KEY(id), { base, working, seq })
    return seq
  })
}

// Record a brand-new note that has never been synced (no server ancestor). It is
// stored with an EXPLICIT null base so reconcile treats it as a clean create
// (rev 1), not a conflict, and unsyncedLocals includes it (a null base with a
// non-null working is a pending create). This is the durability path when a
// draft's direct canonical write was non-durable: the edit survives a reload
// (initial-load merge reads it) and the reconcile driver re-attempts the create.
// An existing record is never downgraded to a create — if a base already exists
// the note has a server ancestor and goes through recordWorking.
export async function recordCreate(id, working) {
  return withLock(id, async () => {
    const prev = (await idbGet(KEY(id))) || {}
    if (prev.base) {
      const seq = nextSeq(prev)
      await idbSet(KEY(id), { base: prev.base, working, seq })
      return seq
    }
    const seq = nextSeq(prev)
    await idbSet(KEY(id), { base: null, working, seq })
    return seq
  })
}

// Record a local delete: base stays as the merge ancestor, working becomes a
// tombstone. If this device has not seen a base yet, callers may pass a
// baseHint derived from the note currently on screen.
export async function recordDeletion(id, baseHint = null) {
  return withLock(id, async () => {
    const prev = (await idbGet(KEY(id))) || {}
    const base = prev.base || baseHint
    if (!base) return false
    await idbSet(KEY(id), { base, working: null, seq: nextSeq(prev) })
    return true
  })
}

// Mark a note fully synced at `synced` (after a confirmed canonical write or a
// completed reconcile): base === working === synced.
//
// `seq` is the edit sequence the caller is settling. The write applies only when
// it is at least as fresh as what is stored — a stale promote (an earlier edit
// whose canonical write resolved last) carries a lower seq and is a no-op, so it
// can never overwrite a newer edit's state and strand the note out of the
// reconcile queue. When the caller has no seq (legacy / first-commit path) we
// settle to the stored seq so the note stays correctly ordered for the next
// write. Returns true if the settle was applied, false if it was a stale no-op.
export async function promote(id, synced, seq = null) {
  return withLock(id, async () => {
    const prev = (await idbGet(KEY(id))) || {}
    const prevSeq = (typeof prev.seq === 'number') ? prev.seq : 0
    if (seq != null && seq < prevSeq) return false // stale: a newer edit already won
    await idbSet(KEY(id), { base: synced, working: synced, seq: seq != null ? seq : prevSeq })
    return true
  })
}

export async function getLocal(id) { return (await idbGet(KEY(id))) || null }
export async function clearLocal(id) { return withLock(id, () => idbDel(KEY(id))) }

// Every note with unsynced local changes — the reconcile work-list. Each item's
// record carries its `seq` so the reconciler can promote against the exact edit
// it synced (a fresher edit that landed mid-pass has a higher seq and is left
// for the next pass).
export async function unsyncedLocals() {
  const entries = await idbEntries()
  const out = []
  for (const [k, v] of entries) {
    if (!k.startsWith('note:') || !v || !('working' in v)) continue
    if (v.base == null) {
      // A pending create (never-synced note, no server ancestor). A null base
      // with a null working is a no-op record; only a non-null working is work.
      if (v.working != null) out.push([k.slice(5), v])
    } else if (v.working === null) {
      out.push([k.slice(5), v]) // tombstone (pending delete)
    } else if (v.working.hash !== v.base.hash) {
      out.push([k.slice(5), v])
    }
  }
  return out
}
