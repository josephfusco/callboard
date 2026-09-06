#!/usr/bin/env python3
"""Build audio/<slug>/manifest.json from yt-dlp's playlist JSON (.source.json) plus the mp3s on disk."""
import argparse, json, subprocess
from pathlib import Path

ap = argparse.ArgumentParser()
ap.add_argument("dir")
ap.add_argument("--name", help="display name for this collection (kept from the previous manifest if omitted)")
a = ap.parse_args()

d = Path(a.dir)
slug = d.name
src = json.loads((d / ".source.json").read_text())
entries = src.get("entries") or [src]
old = json.loads((d / "manifest.json").read_text()) if (d / "manifest.json").exists() else {}
overrides = json.loads((d / "titles.json").read_text()) if (d / "titles.json").exists() else {}  # {video_id: "Better Title"}
name = a.name or old.get("name") or slug.replace("-", " ").title()
mp3s = sorted(d.glob("*.mp3"))

def duration(f):
    try:
        out = subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(f)])
        return round(float(out.strip()), 1)
    except Exception:
        return None

tracks = []
for i, e in enumerate(entries):
    vid = e["id"]
    f = next((m for m in mp3s if m.name.endswith(f"[{vid}].mp3")), None)
    tracks.append({
        "index": i + 1,
        "id": vid,
        "title": overrides.get(vid) or e.get("title"),
        "file": f.name if f else None,
        "duration": duration(f) if f else None,
        "url": e.get("url") or f"https://www.youtube.com/watch?v={vid}",
        "uploader": e.get("uploader") or e.get("channel"),
        "uploader_url": e.get("uploader_url") or e.get("channel_url"),
    })

out = {
    "name": name,
    "slug": slug,
    "order": old.get("order", 0),
    "playlist_url": src.get("webpage_url"),
    "curator": src.get("uploader") or src.get("channel"),
    "curator_url": src.get("uploader_url") or src.get("channel_url"),
    "tracks": tracks,
}
(d / "manifest.json").write_text(json.dumps(out, indent=2, ensure_ascii=False) + "\n")
missing = [t["title"] for t in tracks if not t["file"]]
print(f"{slug}: {len(tracks)} tracks, {len(tracks) - len(missing)} files on disk, name={name!r}")
if missing:
    print("  missing:", "; ".join(missing))
