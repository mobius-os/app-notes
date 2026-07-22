#!/bin/bash
# Snapshot canonical Notes documents into the app data directory's local git
# history. The job is intentionally deterministic and agent-free: it commits
# only when note content changed, and it never reads or rewrites a note itself.
set -uo pipefail

ID="${1:?usage: job.sh <app-id>}"
DATA="/data/apps/$ID"
LOG="/data/cron-logs/notes.log"
mkdir -p "$(dirname "$LOG")"

if [ ! -d "$DATA" ]; then
  echo "$(date -u +%FT%TZ) snapshot skipped: no data dir $DATA" >> "$LOG"
  exit 0
fi

cd "$DATA" || exit 0
if [ ! -d .git ]; then
  git init -q
fi
git config user.email "notes@mobius"
git config user.name "Notes"

# History contains canonical note text and lightweight metadata only. Derived,
# transient, and content-addressed files stay out; old conflict/lease directories
# remain ignored for compatibility with installations that once created them.
printf 'drafts/\nconflicts/\nleases/\nattachments/\nindex.json\nsignals.jsonl\n*.tmp\n' > .gitignore
# Older releases briefly tracked derived/runtime files. Remove those paths from
# the current snapshot index without touching their working-tree copies.
git rm -r -q --cached --ignore-unmatch -- \
  drafts conflicts leases attachments index.json signals.jsonl '*.tmp' 2>>"$LOG" || true
stage_paths=(.gitignore)
[ -e notes ] && stage_paths+=(notes)
[ -e notes-meta.json ] && stage_paths+=(notes-meta.json)
git add -A -- "${stage_paths[@]}" 2>>"$LOG" || {
  echo "$(date -u +%FT%TZ) snapshot failed: could not stage note data" >> "$LOG"
  exit 1
}

if git diff --cached --quiet --exit-code; then
  exit 0
fi

if git commit -q -m "snapshot $(date -u +%FT%TZ)" 2>>"$LOG"; then
  echo "$(date -u +%FT%TZ) snapshot committed" >> "$LOG"
else
  echo "$(date -u +%FT%TZ) snapshot failed: git commit" >> "$LOG"
  exit 1
fi
