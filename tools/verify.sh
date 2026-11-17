#!/usr/bin/env bash
# Usage: tools/verify.sh [fast|full]
#   fast (default): typecheck, lint, unit tests.   full: fast + production build + offline e2e (7 scenarios).
# Prints a PASS/FAIL line per check and exits non-zero on the first failure. Run it in the worktree you are verifying.
set -uo pipefail
MODE="${1:-fast}"
export NEXT_PUBLIC_SUPABASE_URL="${NEXT_PUBLIC_SUPABASE_URL:-https://xkbbgwndtcfnkifhmles.supabase.co}"
export NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:-sb_publishable_KslkbyZRTqKbDr02eKjvMw_QTBrzn5K}"
step() { local name="$1"; shift; if "$@" >/tmp/verify-$$.log 2>&1; then echo "PASS  $name"; else echo "FAIL  $name"; tail -25 /tmp/verify-$$.log; exit 1; fi; }
step "tsc --noEmit" npx tsc --noEmit
step "eslint src e2e" npx eslint src e2e
step "unit tests" npm test
if [ "$MODE" = full ]; then
  step "next build" npm run build
  PORT=3199
  ( E2E_HARNESS=1 NEXT_PUBLIC_SUPABASE_URL=http://localhost:1 NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=x NODE_NO_WARNINGS=1 npx next start -p $PORT >/tmp/verify-server-$$.log 2>&1 & echo $! >/tmp/verify-pid-$$ )
  sleep 7
  if BASE_URL="http://localhost:$PORT" node e2e/offline-runner.mjs >/tmp/verify-e2e-$$.log 2>&1; then echo "PASS  offline e2e (7 scenarios)"; RC=0; else echo "FAIL  offline e2e"; tail -20 /tmp/verify-e2e-$$.log; RC=1; fi
  kill "$(cat /tmp/verify-pid-$$)" 2>/dev/null || true
  # next start spawns a child: stop whatever still listens on the port
  for p in /proc/[0-9]*; do c=$(tr '\0' ' ' <"$p/cmdline" 2>/dev/null); case "$c" in *next-server*) kill "${p#/proc/}" 2>/dev/null;; esac; done
  exit $RC
fi
echo "verify ($MODE): all checks passed. Not covered: real-browser behaviour against Supabase, mobile layout, RLS (see supabase/tests)."
