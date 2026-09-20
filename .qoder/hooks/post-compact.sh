#!/usr/bin/env bash
# post-compact.sh — Re-inject reminder and short status after context compaction
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"

PROOF_COUNT=$(find "$ARTIFACT_DIR" -name "*.proof" ! -name "*.stale" 2>/dev/null | wc -l | tr -d ' ')
DIRTY=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')

echo "POST_COMPACT branch=$BRANCH proofs=$PROOF_COUNT dirty_files=$DIRTY — reminder reinjected, reload .qoder/quality/reminder.md"
