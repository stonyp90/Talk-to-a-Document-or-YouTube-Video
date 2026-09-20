#!/usr/bin/env bash
# branch-change.sh — Re-inject reminder on branch change, detect external branches
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
QUALITY_DIR="$REPO_ROOT/.qoder/quality"
REMINDER="$QUALITY_DIR/reminder.md"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"

if [ ! -f "$REMINDER" ]; then
  echo "BLOCKED: quality reminder missing after branch change"
  exit 1
fi

# Invalidate proofs from other branches
if [ -d "$ARTIFACT_DIR" ]; then
  CURRENT_TASK="$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9_-]/_/g')"
  # Mark proofs from other branches as stale
  find "$ARTIFACT_DIR" -name "*.proof" ! -name "*_${CURRENT_TASK}_*" -exec sh -c 'mv "$1" "${1}.stale"' _ {} \; 2>/dev/null || true
fi

# Check if branch has commits not from this agent (externally created)
MAIN_MERGE_BASE="$(git merge-base main "$BRANCH" 2>/dev/null || echo '')"
if [ -n "$MAIN_MERGE_BASE" ]; then
  EXTERNAL_COMMITS=$(git log --oneline "$MAIN_MERGE_BASE".."$BRANCH" --no-merges 2>/dev/null | wc -l | tr -d ' ')
  if [ "$EXTERNAL_COMMITS" -gt 0 ]; then
    echo "BRANCH_CHANGE branch=$BRANCH existing_commits=$EXTERNAL_COMMITS — review before overwriting"
  else
    echo "BRANCH_CHANGE branch=$BRANCH reminder=reinjected"
  fi
else
  echo "BRANCH_CHANGE branch=$BRANCH reminder=reinjected"
fi
