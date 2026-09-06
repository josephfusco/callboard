"""Shared drawing bits for cover.py and share.py: warm, personal, rounded type, the 🫶, a few rainbow 22 ♥."""
import colorsys
from PIL import ImageFont, Image, ImageDraw

BG, INK, MUTED = (241, 238, 231), (30, 28, 26), (120, 116, 108)
import os
LABEL = os.environ.get("CALLBOARD_LABEL", "Rehearsal tracks")
ROUNDED = "/System/Library/Fonts/SFNSRounded.ttf"
EMOJI = "/System/Library/Fonts/Apple Color Emoji.ttc"

def font(size, weight="Bold"):
    f = ImageFont.truetype(ROUNDED, size)
    try: f.set_variation_by_name(weight)
    except Exception: pass
    return f

def emoji(dr, xy, ch, size):
    """Apple Color Emoji is a bitmap font with fixed strikes; render at 160 and scale."""
    f = ImageFont.truetype(EMOJI, 160)
    im = Image.new("RGBA", (200, 200), (0, 0, 0, 0))
    ImageDraw.Draw(im).text((20, 20), ch, font=f, embedded_color=True)
    im = im.crop(im.getbbox())
    w, h = im.size
    im = im.resize((size, round(size * h / w)), Image.LANCZOS)  # scale by width, keep the glyph's own proportions
    dr._image.paste(im, (int(xy[0]), int(xy[1])), im)

def wrap(dr, text, max_width, start=150, max_lines=3, step=8, weight="Bold"):
    size = start
    while True:
        f = font(size, weight); lines, cur = [], ""
        for w in text.split():
            t = (cur + " " + w).strip()
            if dr.textlength(t, font=f) <= max_width: cur = t
            else: lines.append(cur); cur = w
        lines.append(cur)
        if len(lines) <= max_lines and all(dr.textlength(l, font=f) <= max_width for l in lines):
            return f, lines, size
        size -= step

def rainbow(k, n, sat=0.72, light=0.58):
    r, g, b = colorsys.hls_to_rgb((k / n) * 0.92, light, sat)
    return int(r * 255), int(g * 255), int(b * 255)

def sprinkle(dr, spots, size=34):
    """A handful of 22 / ♥ in rainbow order at given (x, y, tilt) spots."""
    f = font(size, "Heavy")
    for k, (x, y, tilt) in enumerate(spots):
        glyph = "♥" if k % 2 else "22"
        im = Image.new("RGBA", (size * 3, size * 2), (0, 0, 0, 0))
        ImageDraw.Draw(im).text((size // 2, size // 4), glyph, font=f, fill=rainbow(k, len(spots)) + (235,))
        im = im.rotate(tilt, resample=Image.BICUBIC, expand=True)
        dr._image.paste(im, (int(x), int(y)), im)
