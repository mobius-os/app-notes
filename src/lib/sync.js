// Pure reconcile decision for one note's offline draft vs the server canonical.
//
// PURE + SELF-CONTAINED: the only IO-shaped dependency is merge.js (which itself
// only pulls node-diff3). Hashes are PRECOMPUTED by the caller and injected on
// each side as `.hash`, so this module never imports hash.js / note.js — it can
// be unit-tested in full isolation while a sibling builds the storage layer.

import { merge3, mergeMeta } from './merge.js'

// A "side" is {meta, body, hash} or null (the note doesn't exist on that side —
// a fresh device with no base, or a deleted note). These accessors collapse the
// null case to safe defaults so the decision logic below stays branch-light.
const hashOf = (side) => (side ? side.hash : null)
const attachmentsOf = (side) => (side?.meta?.attachments ?? [])

// The conflict descriptor is immutable and content-addressed by the three
// hashes, so two distinct conflicts on the same note never collide and the same
// conflict is idempotent to re-emit. It carries full base/mine/server for the
// agent resolver, which reasons about semantics rather than diff hunks.
function buildConflict({ base, mine, server }) {
  const noteId = base?.meta?.id ?? mine?.meta?.id ?? server?.meta?.id
  const baseHash = hashOf(base)
  const mineHash = hashOf(mine)
  const serverHash = hashOf(server)
  return {
    action: 'conflict',
    descriptor: {
      noteId,
      baseHash,
      mineHash,
      serverHash,
      base,
      mine,
      server,
      attachmentsMine: attachmentsOf(mine),
      attachmentsServer: attachmentsOf(server),
      status: 'open',
      path: `conflicts/${noteId}/${baseHash}.${mineHash}.${serverHash}.json`,
    },
  }
}

// reconcile({base, mine, server}) -> a decision object. See the module header
// for the side shape. Decision order:
//   1. noop        — nothing to push (mine === server, or both gone)
//   2. fast-forward — server untouched since base; mine lands as the next rev
//   3. merged       — both moved but body merges clean and meta merges
//   4. conflict     — anything else (overlapping bodies, or a deletion divergence)
export function reconcile({ base, mine, server }) {
  // Both sides deleted (or mine deleted and server already matches) -> nothing
  // to do. Also covers mine === server by hash.
  if (mine === null && server === null) return { action: 'noop' }
  if (hashOf(mine) === hashOf(server)) return { action: 'noop' }

  // A deletion on either side is a divergence diff3 can't reason about (there is
  // no body to merge); hand it to the agent resolver.
  if (mine === null || server === null) {
    return buildConflict({ base, mine, server })
  }

  // Server hasn't moved since the draft's base -> fast-forward: push mine as-is,
  // re-parenting onto the base rev. (We rely on the caller's base; if base is
  // absent we cannot fast-forward and fall through to merge/conflict.)
  if (base && hashOf(server) === hashOf(base)) {
    const baseRev = base.meta?.mobius_rev ?? 0
    return {
      action: 'fast-forward',
      note: {
        meta: { ...mine.meta, parent_rev: baseRev, mobius_rev: baseRev + 1 },
        body: mine.body,
      },
    }
  }

  // Both moved: attempt a clean 3-way merge of body + frontmatter.
  const baseBody = base?.body ?? ''
  const bodyMerge = merge3(baseBody, mine.body, server.body)
  if (bodyMerge.clean) {
    return {
      action: 'merged',
      note: {
        meta: mergeMeta(base?.meta ?? {}, mine.meta, server.meta),
        body: bodyMerge.text,
      },
    }
  }

  // True body conflict -> immutable descriptor for the agent.
  return buildConflict({ base, mine, server })
}
