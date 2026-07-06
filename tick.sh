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

# Emit ONE cron_summary signal per run to the app's signals.jsonl through the raw
# storage API, so Reflection can see the resolver ran (and whether it failed). The
# line schema mirrors the runtime makeSignal(): {ts, name, ...flat payload}. Strictly
# best-effort — a signal write must NEVER fail or block the tick. (Only verifiable
# against a live container: it needs the service token + a running API.)
API_BASE_URL="${API_BASE_URL:-http://localhost:8000}"
SERVICE_TOKEN_FILE="${SERVICE_TOKEN_FILE:-/data/service-token.txt}"
emit_cron_summary() { # $1 status  $2 conflicts_open  $3 conflicts_resolved  $4 message
  [ -r "$SERVICE_TOKEN_FILE" ] || return 0
  local tok ts line url cur
  tok=$(cat "$SERVICE_TOKEN_FILE" 2>/dev/null) || return 0
  [ -n "$tok" ] || return 0
  ts=$(date -u +"%Y-%m-%dT%H:%M:%S.000Z")
  line=$(printf '{"ts":"%s","name":"cron_summary","status":"%s","conflicts_open":%s,"conflicts_resolved":%s,"message":"%s"}' \
    "$ts" "$1" "$2" "$3" "$4")
  url="$API_BASE_URL/api/storage/apps/$ID/signals.jsonl"
  # The runtime always writes signals.jsonl with a trailing newline (or it's absent →
  # GET 404 → empty), so appending our line + '\n' stays valid JSONL. The tail-cap
  # bounds growth between app opens (the runtime re-seeds tail-400 and overwrites on
  # its next open).
  cur=$(curl -fsS -H "Authorization: Bearer $tok" "$url" 2>/dev/null || true)
  printf '%s%s\n' "$cur" "$line" | tail -n 500 | curl -fsS -X PUT \
    -H "Authorization: Bearer $tok" -H "Content-Type: text/plain" \
    --data-binary @- "$url" >/dev/null 2>&1 || true
}

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
[ -d "$CONF" ] || { emit_cron_summary ok 0 0 "snapshot ok; no conflicts"; exit 0; }
mkdir -p "$LEASES"
now=$(date +%s)
RID="cron-$$-$now"
TTL=900
resolver_err=0

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
   `body`. When the app raises a body conflict it PERSISTS `mine.body` to the note
   file (the descriptor is the only surviving copy of `server.body`), so the current
   canonical body should equal the descriptor's `mine.body`. If it NO LONGER matches
   `mine.body` (a newer edit landed since the conflict was raised), ABANDON — do NOT
   write the note, leave the descriptor as-is, and stop. A later tick retries against
   the new state. (Do NOT compare against `server.body`: by construction the note
   file already holds `mine.body`, not `server.body`, so a `server.body` check would
   wrongly abandon every real conflict.)
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
    --dangerously-skip-permissions >> "$LOG" 2>&1 \
    || { echo "$(date -u +%FT%TZ) resolver error: $note" >> "$LOG"; resolver_err=1; }
  rm -f "$lease"
done

# Recount descriptors after the run so the summary reflects the resolver's outcome.
resolved_count=0
open_count=0
for desc in "$CONF"/*/*.json; do
  [ -f "$desc" ] || continue
  st=$(grep -oE '"status"[: ]*"[a-z]+"' "$desc" | grep -oE '[a-z]+"$' | tr -d '"' || echo open)
  if [ "$st" = "resolved" ]; then resolved_count=$((resolved_count + 1)); else open_count=$((open_count + 1)); fi
done
summary_status=ok
[ "$resolver_err" -eq 1 ] && summary_status=error
emit_cron_summary "$summary_status" "$open_count" "$resolved_count" "resolved=$resolved_count open=$open_count"
