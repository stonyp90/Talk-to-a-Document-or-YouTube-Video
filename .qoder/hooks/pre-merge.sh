#!/usr/bin/env bash
# pre-merge.sh — Gate merge on proofs, test results, and main freshness
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"
QUALITY_DIR="$REPO_ROOT/.qoder/quality"

ERRORS=()

# 1. Check we're on a feature branch (never merge from main to main)
if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "detached" ]; then
  ERRORS+=("Cannot merge from branch '$BRANCH'")
fi

# 2. Check for fresh proofs
PROOF_COUNT=$(find "$ARTIFACT_DIR" -name "*.proof" ! -name "*.stale" 2>/dev/null | wc -l | tr -d ' ')
if [ "$PROOF_COUNT" -eq 0 ]; then
  ERRORS+=("No valid proofs found in $ARTIFACT_DIR")
fi

# 3. Check main hasn't moved ahead (stale integration)
git fetch origin main --quiet 2>/dev/null || true
LOCAL_MAIN=$(git rev-parse main 2>/dev/null || echo '')
REMOTE_MAIN=$(git rev-parse origin/main 2>/dev/null || echo '')
if [ -n "$LOCAL_MAIN" ] && [ -n "$REMOTE_MAIN" ] && [ "$LOCAL_MAIN" != "$REMOTE_MAIN" ]; then
  ERRORS+=("main is behind origin/main — rebase or merge main first")
fi

# 4. Check for stale proofs
STALE_COUNT=$(find "$ARTIFACT_DIR" -name "*.stale" 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE_COUNT" -gt 0 ]; then
  ERRORS+=("$STALE_COUNT stale proof(s) — re-run tests on current branch")
fi

# Report
if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "BLOCKED: ${ERRORS[*]}"
  exit 1
else
  echo "PASS branch=$BRANCH proofs=$PROOF_COUNT main_fresh=true"
  exit 0
fi
