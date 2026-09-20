#!/usr/bin/env bash
# proof-manager.sh — Create, validate, and invalidate proof artifacts
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
ARTIFACT_DIR="$REPO_ROOT/.qoder/artifacts"
mkdir -p "$ARTIFACT_DIR"

usage() {
  echo "Usage: proof-manager.sh <command> [args]"
  echo ""
  echo "Commands:"
  echo "  create <branch> <type> <content>   Create a proof artifact"
  echo "  validate <branch>                   Validate all proofs for a branch"
  echo "  invalidate <branch>                 Mark all proofs for a branch as stale"
  echo "  list [branch]                       List proofs (optionally filtered by branch)"
  echo "  status                              Summary of proof state"
  exit 1
}

[ $# -lt 1 ] && usage
COMMAND="$1"
shift

case "$COMMAND" in
  create)
    [ $# -lt 3 ] && { echo "Usage: proof-manager.sh create <branch> <type> <content>"; exit 1; }
    BRANCH="$1"; TYPE="$2"; CONTENT="$3"
    TIMESTAMP=$(date +%Y%m%dT%H%M%S)
    SAFE_BRANCH=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9_-]/_/g')
    PROOF_FILE="$ARTIFACT_DIR/${TYPE}_${SAFE_BRANCH}_${TIMESTAMP}.proof"
    {
      echo "type: $TYPE"
      echo "branch: $BRANCH"
      echo "timestamp: $TIMESTAMP"
      echo "commit: $(git rev-parse HEAD 2>/dev/null || echo 'unknown')"
      echo "content: $CONTENT"
      echo "diff_base: $(git merge-base main "$BRANCH" 2>/dev/null || echo 'none')"
    } > "$PROOF_FILE"
    echo "PROOF_CREATED: $PROOF_FILE"
    ;;

  validate)
    [ $# -lt 1 ] && { echo "Usage: proof-manager.sh validate <branch>"; exit 1; }
    BRANCH="$1"
    SAFE_BRANCH=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9_-]/_/g')
    PROOFS=$(find "$ARTIFACT_DIR" -name "*_${SAFE_BRANCH}_*.proof" ! -name "*.stale" 2>/dev/null)
    if [ -z "$PROOFS" ]; then
      echo "NO_PROOFS for branch=$BRANCH"
      exit 1
    fi
    VALID=0; INVALID=0
    while IFS= read -r pf; do
      # Check if the commit recorded in the proof still exists on the branch
      PROOF_COMMIT=$(grep "^commit:" "$pf" | sed 's/commit: //')
      if [ -n "$PROOF_COMMIT" ] && [ "$PROOF_COMMIT" != "unknown" ]; then
        if git merge-base --is-ancestor "$PROOF_COMMIT" "$BRANCH" 2>/dev/null; then
          VALID=$((VALID + 1))
        else
          mv "$pf" "${pf}.stale"
          INVALID=$((INVALID + 1))
        fi
      else
        VALID=$((VALID + 1))
      fi
    done <<< "$PROOFS"
    echo "VALIDATE branch=$BRANCH valid=$VALID invalid=$INVALID"
    [ "$INVALID" -gt 0 ] && exit 1
    ;;

  invalidate)
    [ $# -lt 1 ] && { echo "Usage: proof-manager.sh invalidate <branch>"; exit 1; }
    BRANCH="$1"
    SAFE_BRANCH=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9_-]/_/g')
    COUNT=0
    for pf in "$ARTIFACT_DIR"/**/*_${SAFE_BRANCH}_*.proof; do
      [ -f "$pf" ] && mv "$pf" "${pf}.stale" && COUNT=$((COUNT + 1))
    done 2>/dev/null
    echo "INVALIDATED branch=$BRANCH count=$COUNT"
    ;;

  list)
    BRANCH="${1:-}"
    if [ -n "$BRANCH" ]; then
      SAFE_BRANCH=$(echo "$BRANCH" | sed 's/[^a-zA-Z0-9_-]/_/g')
      find "$ARTIFACT_DIR" -name "*_${SAFE_BRANCH}_*.proof" ! -name "*.stale" 2>/dev/null || echo "No proofs"
    else
      find "$ARTIFACT_DIR" -name "*.proof" ! -name "*.stale" 2>/dev/null || echo "No proofs"
    fi
    ;;

  status)
    TOTAL=$(find "$ARTIFACT_DIR" -name "*.proof" ! -name "*.stale" 2>/dev/null | wc -l | tr -d ' ')
    STALE=$(find "$ARTIFACT_DIR" -name "*.stale" 2>/dev/null | wc -l | tr -d ' ')
    BRANCH=$(git branch --show-current 2>/dev/null || echo 'detached')
    echo "STATUS branch=$BRANCH valid_proofs=$TOTAL stale_proofs=$STALE"
    ;;

  *)
    usage
    ;;
esac
