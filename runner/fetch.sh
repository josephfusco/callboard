#!/usr/bin/env bash
# Fetch a YouTube playlist (or single video) as audio-only MP3s into <out>/<slug>/ and build its manifest,
# cover and share card. Needs yt-dlp, ffmpeg and python3 with Pillow.
# Usage: ./fetch.sh <slug> <youtube-url> ["Display Name"]
# Env:   CALLBOARD_OUT (default ./audio), CALLBOARD_SITE, CALLBOARD_LABEL (text on the art)
# Re-running is safe: already-downloaded tracks are skipped, the manifest is rebuilt.
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
SLUG="${1:?slug}"
SRC="${2:?youtube url}"
NAME="${3:-}"
[[ "$SLUG" =~ ^[a-z0-9-]+$ ]] || { echo "slug must be lowercase letters, digits, dashes"; exit 1; }
OUT="${CALLBOARD_OUT:-./audio}"
DIR="$OUT/$SLUG"
mkdir -p "$DIR"

echo "→ reading playlist"
yt-dlp --flat-playlist -J "$SRC" > "$DIR/.source.json"

echo "→ downloading audio only (mp3)"
yt-dlp -x --audio-format mp3 --audio-quality 0 \
  --download-archive "$DIR/.archive" \
  -o "$DIR/%(playlist_index)02d - %(title)s [%(id)s].%(ext)s" "$SRC"

echo "→ manifest"
if [ -n "$NAME" ]; then python3 "$HERE/manifest.py" "$DIR" --name "$NAME"; else python3 "$HERE/manifest.py" "$DIR"; fi
echo "→ artwork"
PY="${CALLBOARD_PYTHON:-python3}"
"$PY" "$HERE/cover.py" "$DIR"
"$PY" "$HERE/share.py" "$DIR"
[ -n "${CALLBOARD_HOME_CARD:-}" ] && "$PY" "$HERE/share.py" --home "$CALLBOARD_HOME_CARD" || true
"$PY" "$HERE/lyrics.py" "$DIR" || true
