#!/usr/bin/env bash
# Usage: coord-send.sh FROM TO TYPE TASK_ID "subject" [REPLY_TO_ID] < body-and-requested-action.md
# TYPE: TASK_PROPOSAL | QUESTION | ANSWER | BLOCKER | READY_FOR_REVIEW | REVIEW | INFO     TO may be a role or ALL
# Publishes ONE new message file in coordination/outbox/<FROM>/ on branch coord/<FROM>: written to a temp file, renamed, then committed and pushed.
. "$(dirname "$0")/coord-lib.sh"
FROM="${1:-}"; TO="${2:-}"; TYPE="${3:-}"; TASK="${4:--}"; SUBJECT="${5:-}"; REPLY="${6:--}"
need_role "$FROM"; { [ "$TO" = ALL ] || valid_role "$TO"; } || { ERRORS_TO_STDERR "bad recipient '$TO'"; exit 2; }
case "$TYPE" in TASK_PROPOSAL|QUESTION|ANSWER|BLOCKER|READY_FOR_REVIEW|REVIEW|INFO) ;; *) ERRORS_TO_STDERR "bad type '$TYPE'"; exit 2;; esac
[ -n "$SUBJECT" ] || { ERRORS_TO_STDERR "subject required"; exit 2; }
WT=$(ensure_worktree "$FROM")
ID="$(date -u +%Y%m%dT%H%M%SZ)-$FROM-$(head -c4 /dev/urandom | od -An -tx1 | tr -d ' \n')"
DIR="$WT/coordination/outbox/$FROM"; mkdir -p "$DIR"
TMP="$DIR/.$ID.tmp"
{
  echo "ID: $ID"; echo "Van: $FROM"; echo "Aan: $TO"; echo "Type: $TYPE"; echo "Taak-ID: $TASK"
  echo "Betreft: $SUBJECT"; echo "Antwoord op: $REPLY"; echo; cat
} > "$TMP"
mv "$TMP" "$DIR/$ID.md"
git -C "$WT" add "coordination/outbox/$FROM/$ID.md"
git -C "$WT" -c user.name="Courtload $FROM" -c user.email="noreply@courtload.invalid" commit -q -m "msg $ID ($TYPE $FROM->$TO)"
push_branch "$WT" "$FROM"
echo "$ID"
