#!/usr/bin/env bash

# Synchronizes GitHub labels from a YAML file using the GitHub CLI.
#
# Usage: sync-github-labels.sh [--file path] [--repo owner/name]
#
# When --repo is omitted, the repository is inferred from the current gh
# repository context. The GitHub CLI must be installed and authenticated.
set -euo pipefail

LABELS_FILE=".github/labels.yml"
REPOSITORY=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --file)
      LABELS_FILE="$2"
      shift 2
      ;;
    --repo)
      REPOSITORY="$2"
      shift 2
      ;;
    *)
      echo "Unknown argument: $1" >&2
      exit 1
      ;;
  esac
done

command -v gh >/dev/null || {
  echo "GitHub CLI (gh) is required." >&2
  exit 1
}

[[ -f "$LABELS_FILE" ]] || {
  echo "Labels file not found: $LABELS_FILE" >&2
  exit 1
}

if [[ -z "$REPOSITORY" ]]; then
  REPOSITORY="$(gh repo view --json nameWithOwner --jq '.nameWithOwner')"
fi

awk '
  # Extracts the value from a single-quoted YAML field.
  function value(line) {
    sub(/^[^'\'']*'\''/, "", line)
    sub(/'\''.*$/, "", line)
    return line
  }

  /^- name:/ {
    if (name != "") print name "\t" color "\t" description
    name = value($0)
    color = ""
    description = ""
    next
  }

  /^  color:/ {
    color = value($0)
    next
  }

  /^  description:/ {
    description = value($0)
  }

  END {
    if (name != "") print name "\t" color "\t" description
  }
' "$LABELS_FILE" |
while IFS=$'\t' read -r name color description; do
  [[ -n "$name" && -n "$color" && -n "$description" ]] || {
    echo "Invalid label definition in $LABELS_FILE" >&2
    exit 1
  }

  echo "Syncing: $name"
  gh label create "$name" \
    --repo "$REPOSITORY" \
    --color "$color" \
    --description "$description" \
    --force
done
