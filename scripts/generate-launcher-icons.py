#!/usr/bin/env python3
"""
Shams al-Asrār — Launcher icon generator (Phase 5, final)
============================================================================
Generates all Android launcher icon assets — the five legacy density
buckets plus the API 26+ adaptive-icon foreground/background pair — from
the signed-off seal artwork at assets/images/app-icon-seal.png (a gold coin
bearing "SHAMS AL ASRAR" in Latin and Arabic, ringed by the manāzil-style
segments used elsewhere in the app's astrolabe art).

Supersedes scripts/generate-launcher-icons.ps1, which produced Phase 1
placeholder glyphs (a plain Arabic sheen on a flat teal disc) before this
artwork was signed off. That script is left in place for reference only.

Requires: Pillow (`pip install Pillow`).

Usage:
    python3 scripts/generate-launcher-icons.py

Output geometry (Android spec):
    Legacy PNGs   : ic_launcher.png / ic_launcher_round.png, flat-composited
                    (background + foreground baked into one image) since
                    pre-API26 launchers apply no OS-level masking.
                    Sizes: mdpi 48 | hdpi 72 | xhdpi 96 | xxhdpi 144 | xxxhdpi 192
    Adaptive pair : ic_launcher_background.png (opaque, full bleed) and
                    ic_launcher_foreground.png (transparent, coin kept
                    inside the 66/108 safe zone) per mipmap-anydpi-v26/
                    ic_launcher.xml. Sizes: mdpi 108 | hdpi 162 | xhdpi 216 |
                    xxhdpi 324 | xxxhdpi 432

The background color is not hand-picked — it's sampled from the coin's own
mid-tone gold and deepened toward a dark bronze, so the ring around the
coin (visible once the OS applies its circle/squircle/rounded-square mask)
reads as part of the same medallion rather than a mismatched swatch.
"""

import os
from PIL import Image, ImageDraw

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(REPO_ROOT, "assets", "images", "app-icon-seal.png")
RES = os.path.join(REPO_ROOT, "android", "app", "src", "main", "res")

# Density buckets: (mipmap dir, legacy icon size, adaptive canvas size).
BUCKETS = [
    ("mipmap-mdpi", 48, 108),
    ("mipmap-hdpi", 72, 162),
    ("mipmap-xhdpi", 96, 216),
    ("mipmap-xxhdpi", 144, 324),
    ("mipmap-xxxhdpi", 192, 432),
]

# Fraction of the adaptive canvas the coin's longer edge should fill.
# Android's safe zone is the inner 66/108 (~61%) of the canvas; 60% keeps
# the coin fully inside it across every launcher mask shape.
ADAPTIVE_FILL = 0.60
# Legacy icons aren't cropped by an OS mask, so the coin can fill more of
# the frame — matches how the source seal art itself is composed.
LEGACY_FILL = 0.86


def blend(color, target, t):
    return tuple(int(color[i] * (1 - t) + target[i] * t) for i in range(3))


def sample_background_color(coin: Image.Image) -> tuple[int, int, int]:
    """Average color of the coin's opaque pixels, deepened toward dark
    bronze so it reads as a backdrop rather than a highlight."""
    cw, ch = coin.size
    pixels = coin.load()
    r_sum = g_sum = b_sum = n = 0
    for y in range(0, ch, 4):
        for x in range(0, cw, 4):
            r, g, b, a = pixels[x, y]
            if a > 200:
                r_sum += r
                g_sum += g
                b_sum += b
                n += 1
    avg = (r_sum // n, g_sum // n, b_sum // n)
    return blend(avg, (74, 42, 4), 0.45)


def centered(coin: Image.Image, canvas_size: int, fill_fraction: float) -> Image.Image:
    """Transparent canvas_size x canvas_size image with the coin centered,
    scaled so its longer edge equals fill_fraction * canvas_size."""
    cw, ch = coin.size
    scale = (fill_fraction * canvas_size) / max(cw, ch)
    new_w, new_h = max(1, round(cw * scale)), max(1, round(ch * scale))
    resized = coin.resize((new_w, new_h), Image.LANCZOS)
    canvas = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    canvas.paste(resized, ((canvas_size - new_w) // 2, (canvas_size - new_h) // 2), resized)
    return canvas


def solid(canvas_size: int, color: tuple[int, int, int]) -> Image.Image:
    return Image.new("RGBA", (canvas_size, canvas_size), color + (255,))


def flatten(bg: Image.Image, fg: Image.Image) -> Image.Image:
    out = bg.copy()
    out.alpha_composite(fg)
    return out


def circle_mask(im: Image.Image) -> Image.Image:
    size = im.size[0]
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).ellipse((0, 0, size - 1, size - 1), fill=255)
    out = im.copy()
    out.putalpha(mask)
    return out


def main() -> None:
    src = Image.open(SRC).convert("RGBA")
    coin = src.crop(src.getbbox())
    bg_color = sample_background_color(coin)
    print("background color:", "#%02X%02X%02X" % bg_color)

    for name, legacy_size, adaptive_size in BUCKETS:
        out_dir = os.path.join(RES, name)
        os.makedirs(out_dir, exist_ok=True)

        fg = centered(coin, adaptive_size, ADAPTIVE_FILL)
        bg = solid(adaptive_size, bg_color)
        fg.save(os.path.join(out_dir, "ic_launcher_foreground.png"))
        bg.save(os.path.join(out_dir, "ic_launcher_background.png"))

        legacy_fg = centered(coin, legacy_size, LEGACY_FILL)
        legacy_bg = solid(legacy_size, bg_color)
        flat = flatten(legacy_bg, legacy_fg)
        flat.save(os.path.join(out_dir, "ic_launcher.png"))
        circle_mask(flat).save(os.path.join(out_dir, "ic_launcher_round.png"))

        print(f"{name}: legacy={legacy_size} adaptive={adaptive_size} done")


if __name__ == "__main__":
    main()
