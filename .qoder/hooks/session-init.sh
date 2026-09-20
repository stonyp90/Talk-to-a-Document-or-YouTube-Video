#!/usr/bin/env bash
# session-init.sh — Detect task context and inject quality reminder
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
BRANCH="$(git branch --show-current 2>/dev/null || echo 'detached')"
WORKTREE="$(git worktree list --porcelain | grep -A1 "worktree " | grep "branch " | sed 's/branch refs\/heads\///' | head -1 || echo "$BRANCH")"
QUALITY_DIR="$REPO_ROOT/.qoder/quality"
REMINDER="$QUALITY_DIR/reminder.md"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"

mkdir -p "$ARTIFACT_DIR"

if [ ! -f "$REMINDER" ]; then
  echo "BLOCKED: quality reminder not found at $REMINDER"
  exit 1
fi

# Detect non-main branch (feature work detected)
if [ "$BRANCH" != "main" ] && [ -n "$BRANCH" ]; then
  echo "INIT branch=$BRANCH worktree=$WORKTREE reminder=loaded"
else
  echo "INIT branch=main reminder=loaded — create a feature branch for task work"
fi

# Check for stale artifacts from previous tasks
STALE_COUNT=$(find "$ARTIFACT_DIR" -name "*.proof" -mtime +1 2>/dev/null | wc -l | tr -d ' ')
if [ "$STALE_COUNT" -gt 0 ]; then
  echo "WARN: $STALE_COUNT stale proof(s) in artifacts — review before relying on them"
fi
