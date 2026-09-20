#!/usr/bin/env bash
# coordinator.sh — Single integration point for finished features
# Only this script merges completed features. Sub-agents deliver proofs here.
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"
LOCK_FILE="$REPO_ROOT/.qoder/artifacts/.integration.lock"

usage() {
  echo "Usage: coordinator.sh <feature-branch> [--verify-only]"
  echo ""
  echo "Integrates a finished feature branch into main."
  echo "  --verify-only  Run checks without merging"
  exit 1
}

[ $# -lt 1 ] && usage
FEATURE_BRANCH="$1"
VERIFY_ONLY="${2:-}"

# Serialization: only one integration at a time
if [ -f "$LOCK_FILE" ]; then
  LOCK_PID=$(cat "$LOCK_FILE")
  if kill -0 "$LOCK_PID" 2>/dev/null; then
    echo "BLOCKED: another integration in progress (PID $LOCK_PID)"
    exit 1
  else
    rm -f "$LOCK_FILE"
  fi
fi

cleanup() {
  rm -f "$LOCK_FILE"
}
trap cleanup EXIT

echo "$$" > "$LOCK_FILE"

# 1. Verify feature branch exists and is not main
if [ "$FEATURE_BRANCH" = "main" ]; then
  echo "BLOCKED: cannot integrate main into itself"
  exit 1
fi

if ! git rev-parse --verify "$FEATURE_BRANCH" >/dev/null 2>&1; then
  echo "BLOCKED: branch '$FEATURE_BRANCH' does not exist"
  exit 1
fi

# 2. Check proofs exist
PROOF_COUNT=$(find "$ARTIFACT_DIR" -name "*.proof" ! -name "*.stale" -name "*_${FEATURE_BRANCH}_*" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PROOF_COUNT" -eq 0 ]; then
  echo "BLOCKED: no valid proofs for branch '$FEATURE_BRANCH'"
  exit 1
fi

# 3. Update main if needed
git fetch origin main --quiet 2>/dev/null || true
LOCAL_MAIN=$(git rev-parse main 2>/dev/null || echo '')
REMOTE_MAIN=$(git rev-parse origin/main 2>/dev/null || echo '')
if [ -n "$LOCAL_MAIN" ] && [ -n "$REMOTE_MAIN" ] && [ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]; then
  echo "BLOCKED: local main behind origin/main — sync main first"
  exit 1
fi

if [ "$VERIFY_ONLY" = "--verify-only" ]; then
  echo "VERIFY_OK branch=$FEATURE_BRANCH proofs=$PROOF_COUNT"
  exit 0
fi

# 4. Merge feature into main
CURRENT_BRANCH=$(git branch --show-current)
git checkout main --quiet
MERGE_COMMIT=$(git merge "$FEATURE_BRANCH" --no-ff -m "integrate: $FEATURE_BRANCH" 2>&1) || {
  echo "BLOCKED: merge failed — $MERGE_COMMIT"
  git merge --abort 2>/dev/null || true
  git checkout "$CURRENT_BRANCH" --quiet
  exit 1
}

# 5. Post-merge: run full test suite on resulting main
echo "Running post-merge verification on main..."
POST_MERGE_RESULT=0
npm test -- --run 2>&1 || POST_MERGE_RESULT=$?

if [ "$POST_MERGE_RESULT" -ne 0 ]; then
  echo "BLOCKED: post-merge tests failed on main"
  echo "Merge commit: $(git rev-parse HEAD)"
  echo "Reverting..."
  git reset --hard HEAD~1
  git checkout "$CURRENT_BRANCH" --quiet
  exit 1
fi

# 6. Record integration proof
TIMESTAMP=$(date +%Y%m%dT%H%M%S)
PROOF_FILE="$ARTIFACT_DIR/integration_${FEATURE_BRANCH}_${TIMESTAMP}.proof"
{
  echo "integration: $FEATURE_BRANCH -> main"
  echo "merge_commit: $(git rev-parse HEAD)"
  echo "timestamp: $TIMESTAMP"
  echo "post_merge_tests: PASS"
  echo "proofs_carried: $PROOF_COUNT"
} > "$PROOF_FILE"

echo "INTEGRATED branch=$FEATURE_BRANCH merge=$(git rev-parse --short HEAD) post_merge=PASS"
git checkout "$CURRENT_BRANCH" --quiet 2>/dev/null || true
