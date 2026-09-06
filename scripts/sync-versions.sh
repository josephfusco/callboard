#!/usr/bin/env bash
#
# Reads the canonical version from .release-please-manifest.json and syncs it
# into every place WordPress reads it verbatim:
#
#   - callboard.php plugin header `* Version:`
#   - callboard.php `CALLBOARD_VERSION` define
#   - readme.txt `Stable tag:`
#   - package.json and package-lock.json `version`
#
# Called from .github/workflows/release-please.yml after release-please opens
# (or updates) its release pull request. Also runnable locally:
#
#   bash scripts/sync-versions.sh
#
# Each target line is grep-checked before the edit and verified afterwards so a
# miss fails loudly instead of shipping a half-bumped plugin.

set -euo pipefail

cd "$(dirname "$0")/.."

command -v jq  >/dev/null 2>&1 || { echo "jq is required to run scripts/sync-versions.sh" >&2; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required to run scripts/sync-versions.sh" >&2; exit 1; }
VERSION=$(jq -r '."."' .release-please-manifest.json)

if [[ -z "$VERSION" || "$VERSION" == "null" ]]; then
	echo "Could not read version from .release-please-manifest.json" >&2
	exit 1
fi

grep -q '^ \* Version: ' callboard.php \
	|| { echo "Plugin header 'Version:' line not found in callboard.php" >&2; exit 1; }
grep -q "^define( 'CALLBOARD_VERSION'" callboard.php \
	|| { echo "CALLBOARD_VERSION define not found in callboard.php" >&2; exit 1; }
grep -q '^Stable tag: ' readme.txt \
	|| { echo "'Stable tag:' line not found in readme.txt" >&2; exit 1; }

# BSD and GNU sed disagree on -i, so write through a temp file.
sed_inplace() {
	local expr=$1 file=$2
	sed -E "$expr" "$file" > "$file.tmp" && mv "$file.tmp" "$file"
}

sed_inplace "s/^( \* Version: ).*/\1${VERSION}/" callboard.php
sed_inplace "s/^(define\( 'CALLBOARD_VERSION', ')[^']*(' \);)/\1${VERSION}\2/" callboard.php
sed_inplace "s/^(Stable tag: ).*/\1${VERSION}/" readme.txt
npm version "$VERSION" --no-git-tag-version --allow-same-version >/dev/null

grep -q "^ \* Version: ${VERSION}\$" callboard.php \
	|| { echo "Failed to update plugin header Version in callboard.php" >&2; exit 1; }
grep -q "^define( 'CALLBOARD_VERSION', '${VERSION}' );" callboard.php \
	|| { echo "Failed to update CALLBOARD_VERSION in callboard.php" >&2; exit 1; }
grep -q "^Stable tag: ${VERSION}\$" readme.txt \
	|| { echo "Failed to update Stable tag in readme.txt" >&2; exit 1; }
[[ "$(jq -r .version package.json)" == "$VERSION" ]] \
	|| { echo "Failed to update version in package.json" >&2; exit 1; }

echo "Synced all version references to ${VERSION}"
