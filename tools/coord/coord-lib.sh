#!/usr/bin/env bash
# Shared helpers for the coordination scripts. Source this file; do not run it.
# Coordination state lives on Git branches coord/<ROLE>. Each role only ever pushes its OWN branch,
# so ownership is enforced by Git and there are no merge conflicts. Readers merge the branches into a read-only view.
set -euo pipefail
ROLES="LEAD FRONTEND BACKEND QA"
REPO="${COORD_REPO:-$(git rev-parse --show-toplevel)}"
VIEW="${COORD_VIEW:-$HOME/coord-view}"
ERRORS_TO_STDERR() { echo "coord: $*" >&2; }
valid_role() { for r in $ROLES; do [ "$r" = "$1" ] && return 0; done; return 1; }
need_role() { valid_role "${1:-}" || { ERRORS_TO_STDERR "unknown role '${1:-}' (use: $ROLES)"; exit 2; }; }
fetch_coord() { git -C "$REPO" fetch -q origin '+refs/heads/coord/*:refs/remotes/origin/coord/*' 2>/dev/null || true; }
# Make sure $HOME/coord-work-<ROLE> is a worktree on branch coord/<ROLE> (created as an orphan branch the first time).
ensure_worktree() {
  local role="$1" wt="$HOME/coord-work-$1"
  if [ -d "$wt/.git" ] || [ -f "$wt/.git" ]; then echo "$wt"; return; fi
  fetch_coord
  if git -C "$REPO" rev-parse --verify -q "refs/remotes/origin/coord/$role" >/dev/null; then
    git -C "$REPO" worktree add -q -B "coord/$role" "$wt" "origin/coord/$role"
  else
    git -C "$REPO" worktree add -q --detach "$wt" HEAD
    ( cd "$wt" && git checkout -q --orphan "coord/$role" && git rm -rfq . >/dev/null 2>&1 || true )
  fi
  mkdir -p "$wt/coordination/sessions" "$wt/coordination/outbox/$role" "$wt/coordination/inbox/$role"
  echo "$wt"
}
push_branch() {
  local wt="$1" role="$2" n=0
  until git -C "$wt" push -q origin "coord/$role" 2>/dev/null; do
    n=$((n+1)); [ $n -ge 4 ] && { ERRORS_TO_STDERR "push failed after 4 tries"; return 1; }
    sleep $((2**n))
  done
}
