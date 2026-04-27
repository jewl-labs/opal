#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_ROOT"

echo "[test-local] Building Anchor program..."
anchor build

echo "[test-local] Ensuring no orphaned surfpool..."
pkill -f "surfpool start" 2>/dev/null || true
sleep 1

echo "[test-local] Starting surfpool in background..."
NO_DNA=1 surfpool start --ci --legacy-anchor-compatibility &
SURFPOOL_PID=$!

cleanup() {
  echo "[test-local] Cleaning up surfpool (pid $SURFPOOL_PID)..."
  kill $SURFPOOL_PID 2>/dev/null || true
  wait $SURFPOOL_PID 2>/dev/null || true
}
trap cleanup EXIT

echo "[test-local] Waiting for RPC health..."
for i in {1..30}; do
  if curl -sf -X POST http://127.0.0.1:8899 \
    -H "Content-Type: application/json" \
    -d '{"jsonrpc":"2.0","id":1,"method":"getHealth"}' >/dev/null 2>&1; then
    echo "[test-local] RPC is ready."
    break
  fi
  sleep 1
done

echo "[test-local] Running tests..."
bun test tests/opal.test.ts
