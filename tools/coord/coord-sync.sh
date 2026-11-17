#!/usr/bin/env bash
# Usage: coord-sync.sh [ROLE]
# Fetches every coord/* branch and builds a read-only merged view in $COORD_VIEW (default ~/coord-view).
# With ROLE: lists messages addressed to ROLE (or ALL) whose ID is not yet mentioned in your sessions/<ROLE>.md ("processed" list).
. "$(dirname "$0")/coord-lib.sh"
ROLE="${1:-}"; [ -z "$ROLE" ] || need_role "$ROLE"
fetch_coord
rm -rf "$VIEW"; mkdir -p "$VIEW"
for ref in $(git -C "$REPO" for-each-ref --format='%(refname)' refs/remotes/origin/coord/); do
  git -C "$REPO" archive "$ref" coordination 2>/dev/null | tar -x -C "$VIEW" || true
done
echo "view: $VIEW/coordination  (read-only; never edit here)"
[ -n "$ROLE" ] || exit 0
OWN="$HOME/coord-work-$ROLE/coordination/sessions/$ROLE.md"; [ -f "$OWN" ] || OWN="$VIEW/coordination/sessions/$ROLE.md"
n=0
for f in $(ls "$VIEW"/coordination/outbox/*/*.md 2>/dev/null | sort); do
  grep -qE "^Aan: *(.*[ ,])?($ROLE|ALL)([ ,]|$)" "$f" || continue
  id=$(sed -n 's/^ID: *//p' "$f" | head -1)
  if [ -f "$OWN" ] && grep -qF "$id" "$OWN"; then continue; fi
  echo "NEW  $(basename "$f")  [$(sed -n 's/^Type: *//p' "$f" | head -1)] $(sed -n 's/^Betreft: *//p' "$f" | head -1)"; n=$((n+1))
done
echo "$n unread message(s) for $ROLE"
