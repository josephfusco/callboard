#!/usr/bin/env python3
"""1200x630 link-preview cards. Usage: share.py audio/<slug>   or   share.py --home"""
import json, os, sys
from pathlib import Path
from PIL import Image, ImageDraw
from art import BG, INK, MUTED, LABEL, font, wrap, emoji, sprinkle

W, H, pad = 1200, 630, 80

def card(title, meta, out):
    im = Image.new("RGB", (W, H), BG); dr = ImageDraw.Draw(im)
    emoji(dr, (W - pad - 220, 200), "🫶", 220)
    f, lines, size = wrap(dr, title, 700, start=124, max_lines=2)
    lh = int(size * 1.02); y = H - pad - 74 - lh * len(lines)
    for l in lines: dr.text((pad - 4, y), l, font=f, fill=INK); y += lh
    dr.text((pad, H - pad - 40), meta, font=font(30, "Semibold"), fill=MUTED)
    sprinkle(dr, [(pad + 10, 70, -8), (pad + 150, 120, 6), (W - 160, 480, -10), (W - 380, 60, 9), (W - 250, 420, -5), (pad + 60, 175, 4)], 30)
    im.save(out, optimize=True); print("wrote", out)

if sys.argv[1] == "--home":
    out = Path(sys.argv[2])
    n = len(list((Path(os.environ.get("CALLBOARD_OUT", "audio"))).glob("*/manifest.json")))
    card(os.environ.get("CALLBOARD_SITE", "Rehearsal Tracks"), f"{LABEL} · {n} {'set' if n == 1 else 'sets'}", out)
else:
    d = Path(sys.argv[1]); m = json.loads((d / "manifest.json").read_text())
    mins = round(sum(t.get("duration") or 0 for t in m["tracks"]) / 60)
    card(m["name"], f"{LABEL} · {len(m["tracks"])} tracks · {mins} min", d / "share.png")
