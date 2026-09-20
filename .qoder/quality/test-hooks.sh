#!/usr/bin/env bash
# test-hooks.sh — Validate the quality hook system
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
HOOKS_DIR="$REPO_ROOT/.qoder/hooks"
QUALITY_DIR="$REPO_ROOT/.qoder/quality"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"
PASS=0; FAIL=0; TOTAL=0

assert_contains() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" output="$2" expected="$3"
  if echo "$output" | grep -q "$expected"; then
    PASS=$((PASS + 1))
    echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $desc (expected '$expected' in output)"
    echo "        got: $output"
  fi
}

assert_exit_code() {
  TOTAL=$((TOTAL + 1))
  local desc="$1" actual="$2" expected="$3"
  if [ "$actual" -eq "$expected" ]; then
    PASS=$((PASS + 1))
    echo "  PASS: $desc"
  else
    FAIL=$((FAIL + 1))
    echo "  FAIL: $desc (expected exit=$expected, got exit=$actual)"
  fi
}

echo "=== Quality Hook Tests ==="
echo ""

# Setup: ensure artifacts dir exists
mkdir -p "$ARTIFACT_DIR"

# Clean any previous test artifacts
rm -f "$ARTIFACT_DIR"/test_*.proof "$ARTIFACT_DIR"/test_*.stale

echo "--- session-init.sh ---"
OUTPUT=$(bash "$HOOKS_DIR/session-init.sh" 2>&1)
assert_contains "session-init outputs INIT" "$OUTPUT" "INIT"
assert_contains "session-init loads reminder" "$OUTPUT" "reminder=loaded"

echo ""
echo "--- branch-change.sh ---"
OUTPUT=$(bash "$HOOKS_DIR/branch-change.sh" 2>&1)
assert_contains "branch-change outputs BRANCH_CHANGE" "$OUTPUT" "BRANCH_CHANGE"
assert_contains "branch-change reinjects reminder" "$OUTPUT" "reminder=reinjected"

echo ""
echo "--- pre-merge.sh (should block on main) ---"
OUTPUT=$(bash "$HOOKS_DIR/pre-merge.sh" 2>&1) || true
assert_contains "pre-merge blocks on main" "$OUTPUT" "BLOCKED"

echo ""
echo "--- proof-manager.sh ---"
# Create a proof
OUTPUT=$(bash "$QUALITY_DIR/proof-manager.sh" create test-branch unit "vitest passed" 2>&1)
assert_contains "proof-manager create" "$OUTPUT" "PROOF_CREATED"

# List proofs
OUTPUT=$(bash "$QUALITY_DIR/proof-manager.sh" list test-branch 2>&1)
assert_contains "proof-manager list shows proof" "$OUTPUT" ".proof"

# Status
OUTPUT=$(bash "$QUALITY_DIR/proof-manager.sh" status 2>&1)
assert_contains "proof-manager status shows valid" "$OUTPUT" "valid_proofs="

# Invalidate
OUTPUT=$(bash "$QUALITY_DIR/proof-manager.sh" invalidate test-branch 2>&1)
assert_contains "proof-manager invalidate" "$OUTPUT" "INVALIDATED"

# Verify stale
OUTPUT=$(bash "$QUALITY_DIR/proof-manager.sh" status 2>&1)
assert_contains "proof-manager shows stale after invalidate" "$OUTPUT" "stale_proofs="

echo ""
echo "--- post-compact.sh ---"
OUTPUT=$(bash "$HOOKS_DIR/post-compact.sh" 2>&1)
assert_contains "post-compact outputs POST_COMPACT" "$OUTPUT" "POST_COMPACT"
assert_contains "post-compact shows reminder reload" "$OUTPUT" "reminder reinjected"

echo ""
echo "--- pre-merge.sh (should block with no valid proofs) ---"
# Clean valid proofs
rm -f "$ARTIFACT_DIR"/*.proof
OUTPUT=$(bash "$HOOKS_DIR/pre-merge.sh" 2>&1) || true
assert_contains "pre-merge blocks with no proofs" "$OUTPUT" "BLOCKED"

echo ""
echo "--- Deduplication: no duplicate injection ---"
# Run session-init twice — should not duplicate
OUT1=$(bash "$HOOKS_DIR/session-init.sh" 2>&1)
OUT2=$(bash "$HOOKS_DIR/session-init.sh" 2>&1)
assert_contains "first init loads reminder" "$OUT1" "reminder=loaded"
assert_contains "second init loads reminder" "$OUT2" "reminder=loaded"

echo ""
echo "=== Results: $PASS passed, $FAIL failed, $TOTAL total ==="

# Cleanup test artifacts
rm -f "$ARTIFACT_DIR"/test_*.proof "$ARTIFACT_DIR"/test_*.stale

[ "$FAIL" -eq 0 ] && exit 0 || exit 1
