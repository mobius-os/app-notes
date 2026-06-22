#!/bin/bash
# Notes cron tick (installed by init-cron-scaffold; runs every 10 min). $1 is
# the numeric app id, i.e. the storage dir /data/apps/<id>. Two jobs:
#   1. git-snapshot the canonical notes for history/audit + dreaming time-travel
#   2. resolve any merge-conflict descriptors via an agent — leased so the cron
#      and the in-app "Resolve now" can't double-resolve, and verify-before-write
#      so a newer edit that landed since the conflict is never clobbered.
# Cheap no-op when nothing is dirty / no conflicts are open.
set -uo pipefail

ID="${1:?usage: tick.sh <app-id>}"
DATA="/data/apps/$ID"
LOG=/data/cron-logs/notes.log
mkdir -p "$(dirname "$LOG")"
[ -d "$DATA" ] || { echo "$(date -u +%FT%TZ) tick: no data dir $DATA" >> "$LOG"; exit 0; }

# ---- 1. git snapshot (canonical notes only) ----
cd "$DATA" || exit 0
if [ ! -d .git ]; then
  git init -q
  git config user.email "notes@mobius"
  git config user.name "Notes"
fi
# Never snapshot transitional state: drafts, open conflicts, leases, the derived
# index, or half-written *.tmp files (canonical writes rename .tmp -> final).
# Ignore transient sync state, the derived index, half-written tmp files, and
# the (content-addressed, immutable) attachment blobs — git tracks note CONTENT.
printf 'drafts/\nconflicts/\nleases/\nattachments/\nindex.json\n*.tmp\n' > .gitignore
git add -A 2>/dev/null || true
if ! git diff --cached --quiet 2>/dev/null; then
  git commit -q -m "snapshot $(date -u +%FT%TZ)" 2>>"$LOG" || true
fi

# ---- 2. resolve conflict descriptors via agent (leased + verify) ----
CONF="$DATA/conflicts"
LEASES="$DATA/leases"
[ -d "$CONF" ] || exit 0
mkdir -p "$LEASES"
now=$(date +%s)
RID="cron-$$-$now"
TTL=900

read -r -d '' RESOLVE_PROMPT <<'PROMPT' || true
You resolve a single merge conflict in the Möbius "Notes" app.

You are given a CONFLICT DESCRIPTOR file path. It is JSON with:
  { noteId, baseHash, base:{meta,body}, mineHash, mine:{meta,body},
    serverHash, server:{meta,body}, attachmentsMine, attachmentsServer, status }

Notes are stored as JSON documents at <DATA>/notes/<noteId>.json — each file is
{ "meta": {...frontmatter fields...}, "body": "<markdown string>" }. The note's
text content is the `body` string (markdown). (Older installs may still hold a
legacy <noteId>.md frontmatter-markdown file; if only the .md exists, treat its
parsed { meta, body } as the canonical note and write the resolved result as the
.json document, then delete the .md.)

Procedure (follow exactly):
1. Read the descriptor JSON.
2. Re-read the CURRENT canonical note at <DATA>/notes/<noteId>.json and take its
   `body`. If that body no longer matches the descriptor's `server.body` (a newer
   edit landed since the conflict), ABANDON — do NOT write the note, leave the
   descriptor as-is, and stop. A later tick retries against the new state.
3. Otherwise do a careful THREE-WAY merge of base/mine/server BODIES: keep both
   sides' intent, reason about meaning (not just lines), and PRESERVE every
   attachment reference exactly — ![alt](attachments/<sha>.<ext>) and
   [name](attachments/<sha>.<ext>). Merge frontmatter: union `attachments`; keep
   `id` and `created`; set `parent_revs` to [mine.mobius_rev, server.mobius_rev];
   bump `mobius_rev`; refresh `updated`; recompute `content_hash`.
4. Write the merged note to <DATA>/notes/<noteId>.json as a JSON object
   { "meta": {...}, "body": "<merged markdown>" } by writing a sibling
   <noteId>.json.tmp first and then renaming it over the final path (atomic).
5. Only if the written file matches what you intended, set the descriptor's
   "status" field to "resolved".
Keep the markdown body clean. Never invent content. Touch only this note +
descriptor.
PROMPT

shopt -s nullglob
for desc in "$CONF"/*/*.json; do
  [ -f "$desc" ] || continue
  note=$(basename "$(dirname "$desc")")
  status=$(grep -oE '"status"[: ]*"[a-z]+"' "$desc" | grep -oE '[a-z]+"$' | tr -d '"' || echo open)
  [ "$status" = "resolved" ] && continue
  lease="$LEASES/$note.json"
  if [ -f "$lease" ]; then
    until=$(grep -oE '"leaseUntil"[: ]*[0-9]+' "$lease" | grep -oE '[0-9]+' | tail -1 || echo 0)
    [ "${until:-0}" -gt "$now" ] && continue   # a live lease — someone else is on it
  fi
  printf '{"resolverId":"%s","leaseUntil":%s,"descriptor":"%s"}\n' "$RID" "$((now + TTL))" "$desc" > "$lease"
  echo "$(date -u +%FT%TZ) resolving $desc" >> "$LOG"
  claude -p "Resolve the Notes merge conflict in descriptor: $desc . The app data dir <DATA> is $DATA (notes live in $DATA/notes/)." \
    --append-system-prompt "${RESOLVE_PROMPT//<DATA>/$DATA}" \
    --allowedTools "Read,Write,Edit,Bash" \
    --dangerously-skip-permissions >> "$LOG" 2>&1 || echo "$(date -u +%FT%TZ) resolver error: $note" >> "$LOG"
  rm -f "$lease"
done
