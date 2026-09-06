#!/usr/bin/env python3
"""Convert YouTube json3 auto-captions in audio/<slug>/.subs/ into audio/<slug>/lyrics.json ({id: [[start, end, text], ...]})."""
import json, re, sys
from pathlib import Path

d = Path(sys.argv[1])
out = {}
for f in sorted((d / ".subs").glob("*.json3")) if (d / ".subs").exists() else []:
    vid = f.name.split(".")[0]
    data = json.loads(f.read_text())
    cues = []
    for ev in data.get("events", []):
        segs = ev.get("segs") or []
        text = "".join(s.get("utf8", "") for s in segs).replace("\n", " ")
        text = re.sub(r"\s+", " ", text).strip()
        if not text or re.fullmatch(r"\[.*?\]", text):  # skip [Music], [Applause]
            continue
        start = ev.get("tStartMs", 0) / 1000
        end = start + ev.get("dDurationMs", 4000) / 1000
        cues.append([round(start, 2), round(end, 2), text])
    words = sum(len(c[2].split()) for c in cues)
    if len(cues) >= 4 and words >= 20:  # only keep tracks with real lyrics
        out[vid] = cues
(d / "lyrics.json").write_text(json.dumps(out, ensure_ascii=False) + "\n")
print(f"lyrics for {len(out)} tracks:", ", ".join(out))
