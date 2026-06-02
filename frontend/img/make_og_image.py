"""Generate frontend/img/og-image.png for social link previews.

LinkedIn / Twitter / Discord / iMessage all want a 1200x630 PNG at the URL
you list as og:image. This script renders one with Pillow.

Run from the repo root:
    python3 frontend/img/make_og_image.py

Re-run any time you change the tagline so the preview stays in sync.
"""

import os
from PIL import Image, ImageDraw, ImageFont


# canvas size that LinkedIn / Twitter / Discord all agree on
WIDTH = 1200
HEIGHT = 630


def load_font(candidates, size):
    """Pillow only takes a real file path. Try a few system fonts in order."""
    for path in candidates:
        if os.path.exists(path):
            return ImageFont.truetype(path, size)
    # last-resort fallback that's always available, even if it looks plain
    return ImageFont.load_default()


def main():
    # warm forest-green background, gradient top-left to bottom-right
    img = Image.new("RGB", (WIDTH, HEIGHT), (31, 90, 57))
    draw = ImageDraw.Draw(img)

    # simple two-color gradient: fill each row with a blended color
    top = (45, 122, 79)
    bottom = (16, 60, 37)
    for y in range(HEIGHT):
        t = y / HEIGHT
        r = int(top[0] * (1 - t) + bottom[0] * t)
        g = int(top[1] * (1 - t) + bottom[1] * t)
        b = int(top[2] * (1 - t) + bottom[2] * t)
        draw.line([(0, y), (WIDTH, y)], fill=(r, g, b))

    # system fonts that ship on most macs / linux
    title_font = load_font([
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ], 110)
    sub_font = load_font([
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/System/Library/Fonts/SFNS.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ], 36)
    tag_font = load_font([
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    ], 28)

    # symbol top-left
    draw.text((80, 70), "♻", fill=(255, 255, 255), font=title_font)

    # main title
    draw.text((80, 220), "Scraptronic", fill=(255, 255, 255), font=title_font)

    # subtitle
    draw.text(
        (80, 360),
        "Find e-waste recyclers near you,",
        fill=(225, 240, 230),
        font=sub_font,
    )
    draw.text(
        (80, 410),
        "see what your scrap is worth, and track your impact.",
        fill=(225, 240, 230),
        font=sub_font,
    )

    # attribution bottom-left
    draw.text(
        (80, HEIGHT - 80),
        "San Diego · Built by Sriram Gutta",
        fill=(190, 215, 200),
        font=tag_font,
    )

    out_path = os.path.join(os.path.dirname(__file__), "og-image.png")
    img.save(out_path, "PNG", optimize=True)
    print(f"wrote {out_path} ({os.path.getsize(out_path)} bytes)")


if __name__ == "__main__":
    main()
