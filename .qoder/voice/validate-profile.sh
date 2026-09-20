#!/usr/bin/env bash
# validate-profile.sh — Validate a voice profile against the schema
set -euo pipefail

PROFILE_DIR="$(dirname "$0")/profiles"

usage() {
  echo "Usage: validate-profile.sh <profile-file>"
  echo "  Validates required fields and structure."
  exit 1
}

[ $# -lt 1 ] && usage
PROFILE="$1"

if [ ! -f "$PROFILE" ]; then
  echo "ERROR: Profile not found: $PROFILE"
  exit 1
fi

ERRORS=()

# Check required fields
for field in "name" "speaker" "locale" "register" "tone"; do
  if ! grep -qi "^#\+ .*${field}\|${field}:" "$PROFILE" 2>/dev/null; then
    # Check in YAML frontmatter or markdown headers
    if ! grep -qi "$field" "$PROFILE" 2>/dev/null; then
      ERRORS+=("Missing required field: $field")
    fi
  fi
done

# Check boundaries section exists
if ! grep -qi "boundar" "$PROFILE" 2>/dev/null; then
  ERRORS+=("Missing boundaries section")
fi

# Check shareability section exists
if ! grep -qi "shar" "$PROFILE" 2>/dev/null; then
  ERRORS+=("Missing shareability section")
fi

# Check locale format (BCP 47 pattern)
LOCALE_LINE=$(grep -i "locale" "$PROFILE" | head -1 || echo "")
if [ -n "$LOCALE_LINE" ]; then
  if ! echo "$LOCALE_LINE" | grep -qE '[a-z]{2}(-[A-Z]{2})?'; then
    ERRORS+=("Invalid locale format (expected BCP 47, e.g., fr-CA)")
  fi
fi

if [ ${#ERRORS[@]} -gt 0 ]; then
  echo "INVALID profile: ${ERRORS[*]}"
  exit 1
else
  echo "VALID profile: $(basename "$PROFILE")"
  exit 0
fi
