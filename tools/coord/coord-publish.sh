#!/usr/bin/env bash
# Usage: coord-publish.sh ROLE "commit message"
# Commits and pushes your own coordination files (sessions/<ROLE>.md and, for LEAD, PROJECT/TASKS/CONTRACTS/DECISIONS).
# Edit them in $HOME/coord-work-<ROLE>/coordination/ first (the directory is created by this script or coord-send.sh).
. "$(dirname "$0")/coord-lib.sh"
ROLE="${1:-}"; MSG="${2:-update}"; need_role "$ROLE"
WT=$(ensure_worktree "$ROLE")
cd "$WT"
if [ "$ROLE" = LEAD ]; then PATHS="coordination/PROJECT.md coordination/TASKS.md coordination/CONTRACTS.md coordination/DECISIONS.md coordination/sessions/LEAD.md coordination/startprompts"; else PATHS="coordination/sessions/$ROLE.md"; fi
for p in $PATHS; do [ -e "$p" ] && git add "$p"; done
if git diff --cached --quiet; then echo "nothing to publish"; exit 0; fi
git -c user.name="Courtload $ROLE" -c user.email="noreply@courtload.invalid" commit -q -m "$ROLE: $MSG"
push_branch "$WT" "$ROLE"; echo "published"
