#!/usr/bin/env bash
# Fails if any commit message in a range carries an AI attribution trailer.
#
#   scripts/check-commit-clean.sh                 # commits not yet on any remote
#   scripts/check-commit-clean.sh origin/main..HEAD
#   scripts/check-commit-clean.sh --message-file .git/COMMIT_EDITMSG
#
# Patterns (case-insensitive, one extended regex per line) live in
# scripts/commit-hygiene-patterns.txt, shared with the commit-msg hook and CI.
# Genuine human Co-authored-by trailers are not matched.
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
patterns="$here/commit-hygiene-patterns.txt"

if [[ "${1:-}" == "--message-file" ]]; then
  if grep -inE -f "$patterns" "$2"; then
    echo "commit-hygiene: forbidden attribution line(s) in $2" >&2
    exit 1
  fi
  echo "CLEAN"
  exit 0
fi

if [[ $# -gt 0 ]]; then
  commits="$(git rev-list "$@")"
else
  commits="$(git rev-list HEAD --not --remotes)"
fi

status=0
for sha in $commits; do
  if hits="$(git log -1 --format=%B "$sha" | grep -inE -f "$patterns")"; then
    echo "commit-hygiene: $(git log -1 --format='%h %s' "$sha")" >&2
    echo "$hits" | sed 's/^/    /' >&2
    status=1
  fi
done

if [[ $status -eq 0 ]]; then
  echo "CLEAN ($(echo "$commits" | grep -c . || true) commit(s) checked)"
fi
exit $status
