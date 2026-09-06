#!/usr/bin/env python3
"""Now Playing artwork for a set: audio/<slug>/cover.png (1024) and cover-512.png."""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
from art import BG, INK, MUTED, LABEL, font, wrap, emoji, sprinkle

d = Path(sys.argv[1]); name = json.loads((d / "manifest.json").read_text()).get("name", d.name)
S, pad = 1024, 90
im = Image.new("RGB", (S, S), BG); dr = ImageDraw.Draw(im)
emoji(dr, (S // 2 - 130, 250), "🫶", 260)
f, lines, size = wrap(dr, name, S - 2 * pad, start=140)
lh = int(size * 1.02); y = S - pad - 66 - lh * len(lines)
for l in lines: dr.text((pad - 4, y), l, font=f, fill=INK); y += lh
dr.text((pad, S - pad - 36), LABEL, font=font(32, "Semibold"), fill=MUTED)
sprinkle(dr, [(pad, 90, -8), (S - 190, 120, 7), (S - 150, 430, -6), (pad + 30, 460, 5), (S - 300, 40, -4), (pad + 190, 40, 9)], 34)
im.save(d / "cover.png", optimize=True)
im.resize((512, 512), Image.LANCZOS).save(d / "cover-512.png", optimize=True)
print(f"cover for {name!r}: {lines}")
