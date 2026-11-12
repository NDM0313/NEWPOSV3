#!/usr/bin/env python3
"""Overlay an orange STAGE banner on the iOS App Store icon (1024×1024)."""
from __future__ import annotations

import argparse
import shutil
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--icon",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png",
    )
    ap.add_argument(
        "--backup",
        type=Path,
        default=Path(__file__).resolve().parents[1]
        / "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.prod.png",
    )
    ap.add_argument("--restore-prod", action="store_true", help="Restore production icon from backup")
    args = ap.parse_args()

    icon = args.icon
    backup = args.backup

    if args.restore_prod:
        if not backup.is_file():
            raise SystemExit(f"Missing production backup: {backup}")
        shutil.copy2(backup, icon)
        print(f"Restored production icon → {icon}")
        return

    if not icon.is_file():
        raise SystemExit(f"Missing icon: {icon}")

    if not backup.is_file():
        shutil.copy2(icon, backup)
        print(f"Backed up production icon → {backup}")

    base = Image.open(backup if backup.is_file() else icon).convert("RGBA")
    w, h = base.size
    overlay = Image.new("RGBA", base.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(overlay)

    band_h = max(140, h // 5)
    # Amber/orange diagonal-ish top band
    draw.rectangle((0, 0, w, band_h), fill=(217, 119, 6, 235))  # amber-600
    # Dark strip under band for contrast
    draw.rectangle((0, band_h, w, band_h + 8), fill=(120, 53, 15, 220))

    label = "STAGE"
    font_size = max(96, h // 8)
    font = None
    for candidate in (
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
        "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
        "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf",
    ):
        if Path(candidate).is_file():
            font = ImageFont.truetype(candidate, font_size)
            break
    if font is None:
        font = ImageFont.load_default()

    bbox = draw.textbbox((0, 0), label, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    x = (w - tw) // 2
    y = (band_h - th) // 2 - 4
    draw.text((x + 3, y + 3), label, font=font, fill=(0, 0, 0, 120))
    draw.text((x, y), label, font=font, fill=(255, 255, 255, 255))

    out = Image.alpha_composite(base, overlay).convert("RGB")
    out.save(icon, format="PNG", optimize=True)
    print(f"Wrote STAGE-badged icon → {icon} ({w}x{h})")


if __name__ == "__main__":
    main()
