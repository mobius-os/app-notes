// Integration test against the REAL platform runtime (mobius-runtime.js):
// drives window.mobius.createUseDocument(React)'s actual useDocument hook with
// THIS app's mergeNote (merge3 + mergeMeta), proving the migration target works
// end-to-end — not just against the in-repo storage mock. The runtime source is
// resolved from the data-layer worktree where it lives; if that path is absent
// (a checkout without the worktree) the suite skips rather than fails, so the
// app's own CI (which has no platform checkout) stays green.
//
// We reuse the platform's headless harness (fake-indexeddb + a controlled
// fetch/online flag) and its hand-rolled React shim — the same way the runtime's
// own useDocument tests render the hook with no DOM.

import { test } from 'node:test'
import assert from 'node:assert'
import { webcrypto } from 'node:crypto'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { makeMergeNote, notePath } from '../src/lib/note-doc.js'

if (!globalThis.crypto || !globalThis.crypto.subtle) globalThis.crypto = webcrypto

// The platform runtime lives in the data-layer worktree of the mobius checkout.
// MOBIUS_FRONTEND can override the frontend dir; otherwise try the known host
// path. Absent (the app's own CI) → the suite skips, so app CI stays green.
const HERE = dirname(fileURLToPath(import.meta.url))
const FRONTEND = process.env.MOBIUS_FRONTEND
  || '/home/hmzmrzx/projects/mobius/.claude/worktrees/data-layer/frontend'
const RUNTIME = resolve(FRONTEND, 'public/mobius-runtime.js')
const HARNESS = resolve(FRONTEND, 'src/lib/__tests__/mobiusRuntimeHarness.mjs')

const HAVE_RUNTIME = existsSync(RUNTIME) && existsSync(HARNESS)

// A minimal React shim that runs a single hook instance and re-renders on
// setState, mirroring the platform's own useDocument test driver. Effects run
// once after the initial render; we expose the latest handle + state.
function makeReact() {
  const stateSlots = []
  const refSlots = []
  const effects = []
  let si = 0, ri = 0, rerender = () => {}
  const React = {
    useState(init) {
      const i = si++
      if (!(i in stateSlots)) stateSlots[i] = typeof init === 'function' ? init() : init
      return [stateSlots[i], (next) => { stateSlots[i] = typeof next === 'function' ? next(stateSlots[i]) : next; rerender() }]
    },
    useRef(init) { const i = ri++; if (!(i in refSlots)) refSlots[i] = { current: init }; return refSlots[i] },
    useCallback(fn) { return fn },
    useEffect(fn) { effects.push(fn) },
    useMemo(fn) { return fn() },
  }
  return { React, reset: () => { si = 0; ri = 0 }, effects, setRerender: (fn) => { rerender = fn } }
}

async function renderDoc(storage, path, opts) {
  const { React, reset, effects, setRerender } = makeReact()
  const mod = await import(RUNTIME)
  const useDocument = mod.createUseDocument(storage, React)
  let handle
  const render = () => { reset(); handle = useDocument(path, opts) }
  setRerender(render)
  render()
  const cleanups = effects.map((fn) => fn()).filter(Boolean)
  return {
    get: () => handle,
    cleanup: () => cleanups.forEach((fn) => fn()),
  }
}

test('runtime useDocument + app mergeNote: an edit on an existing note lands durably (loads base, writes through the real writer)', { skip: !HAVE_RUNTIME ? 'platform runtime not present' : false }, async () => {
  const { freshEnv, waitFor } = await import(HARNESS)
  const { server } = freshEnv()
  const { makeStorage } = await import(RUNTIME)
  const storage = makeStorage({ appId: '1', getToken: async () => 't' })

  // Seed the server canonical note, then open the doc — refresh() loads it as the
  // merge base. (NB: the runtime's get() is stale-while-revalidate, so a
  // post-mount direct server.seed is intentionally NOT observed until a
  // revalidate; the deep concurrent-merge semantics of mergeNote are pinned
  // against a FRESH `theirs` in collection.test.js. Here we prove the real
  // useDocument hook + this app's mergeNote write through the real durable
  // writer without losing the edit.)
  const path = notePath('n1')
  server.seed(path, { meta: { id: 'n1', title: '', created: 'c', mobius_rev: 1 }, body: 'one\ntwo\nthree' })

  const mergeNote = makeMergeNote(() => {})
  const doc = await renderDoc(storage, path, {
    initial: null,
    identity: (d) => (d && d.meta ? d.meta.id : undefined),
    merge: mergeNote,
    mode: 'lww',
  })
  await waitFor(() => doc.get().status === 'ready')
  assert.equal(doc.get().value.body, 'one\ntwo\nthree')

  const res = await doc.get().update((prev) => ({ ...prev, body: 'ONE\ntwo\nthree' }))
  assert.equal(res.durability, 'synced')
  // The edit landed canonically through the real runtime; it is never lost.
  assert.equal(server.serverValue(path).body, 'ONE\ntwo\nthree')
  assert.equal(doc.get().value.body, 'ONE\ntwo\nthree')
  assert.equal(doc.get().lastError, null)
  doc.cleanup()
})

test('runtime useDocument: a queued offline write is durable success, not an error', { skip: !HAVE_RUNTIME ? 'platform runtime not present' : false }, async () => {
  const { freshEnv, waitFor } = await import(HARNESS)
  const { server } = freshEnv()
  const { makeStorage } = await import(RUNTIME)
  const storage = makeStorage({ appId: '1', getToken: async () => 't' })
  const path = notePath('n2')

  const doc = await renderDoc(storage, path, {
    initial: null, identity: (d) => d?.meta?.id, merge: makeMergeNote(() => {}), mode: 'lww',
  })
  await waitFor(() => doc.get().status === 'ready')

  server.setOnline(false)
  const res = await doc.get().update(() => ({ meta: { id: 'n2', title: '', mobius_rev: 1 }, body: 'offline' }))
  // Queued = durable success; status reflects an unflushed-but-durable write.
  assert.equal(res.durability, 'queued')
  assert.equal(doc.get().lastError, null)
  assert.equal(doc.get().value.body, 'offline')
  doc.cleanup()
})

test('runtime useDocument: a dead-lettered write surfaces lastError (no false save)', { skip: !HAVE_RUNTIME ? 'platform runtime not present' : false }, async () => {
  const { freshEnv, waitFor } = await import(HARNESS)
  const { server } = freshEnv()
  const { makeStorage } = await import(RUNTIME)
  const storage = makeStorage({ appId: '1', getToken: async () => 't' })
  const path = notePath('n3')

  const doc = await renderDoc(storage, path, {
    initial: null, identity: (d) => d?.meta?.id, merge: makeMergeNote(() => {}), mode: 'lww',
  })
  await waitFor(() => doc.get().status === 'ready')

  // Force the server to refuse the write with a fatal 4xx (dead-letter).
  server.forceWrite(path, 413)
  await assert.rejects(
    () => doc.get().update(() => ({ meta: { id: 'n3', title: '', mobius_rev: 1 }, body: 'doomed' })),
    (e) => e && e.name === 'DurableWriteError',
  )
  await waitFor(() => doc.get().status === 'error')
  assert.ok(doc.get().lastError, 'lastError is set — the failure is visible, not a false save')
  doc.cleanup()
})
