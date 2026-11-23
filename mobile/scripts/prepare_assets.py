#!/usr/bin/env python3
"""Slice the GRAVEYARD sprite sheet into transparent PNGs and convert the
Haunted Adventure audio pack into compressed OGG files for Android res/raw.

Usage (from mobile/):
    python3 scripts/prepare_assets.py
Requires: pillow, numpy, scipy, and ffmpeg on PATH.
"""
from __future__ import annotations

import os
import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parents[1]
SHEET = ROOT.parent / "image.png"
AUDIO_SRC = ROOT.parent / "Haunted_Adventure_Audio_Pack"
IMG_OUT = ROOT / "src" / "assets" / "images"
RAW_OUT = ROOT / "android" / "app" / "src" / "main" / "res" / "raw"
RES = ROOT / "android" / "app" / "src" / "main" / "res"

# name: (x, y, w, h) in sheet pixels, taken from connected-component analysis.
SPRITES: dict[str, tuple[int, int, int, int]] = {
    "logo": (14, 8, 409, 226),
    "ghost": (433, 54, 143, 168),
    "dark_keeper": (540, 26, 195, 201),
    "pumpkin": (741, 64, 145, 159),
    "bat": (860, 74, 200, 120),
    "cat": (1036, 40, 119, 196),
    "badge_easy": (1179, 42, 80, 100),
    "badge_medium": (1264, 41, 82, 101),
    "badge_hard": (1348, 41, 83, 101),
    "badge_boss": (1433, 41, 86, 107),
    "potion": (1179, 160, 70, 89),
    "gem": (1267, 168, 61, 80),
    "coin": (1339, 169, 74, 77),
    "chest_small": (1425, 162, 95, 81),
    "scene_night": (15, 248, 263, 184),
    "scene_haunted": (284, 248, 244, 184),
    "scene_dusk": (535, 248, 241, 184),
    "scene_day": (784, 248, 250, 185),
    "candle_1": (1067, 260, 40, 92),
    "candle_2": (1125, 261, 40, 90),
    "candle_3": (1184, 262, 39, 89),
    "candle_4": (1241, 264, 39, 88),
    "candle_5": (1299, 264, 39, 88),
    "candle_6": (1356, 265, 39, 86),
    "keeper_avatar": (1353, 506, 171, 172),
    "icon_settings": (1274, 692, 63, 62),
    "icon_sound": (1346, 694, 56, 58),
    "icon_music": (1409, 692, 55, 60),
    "icon_help": (1472, 694, 54, 58),
    "ach_star": (994, 770, 86, 85),
    "ach_trophy": (1094, 778, 78, 74),
    "ach_shield": (1189, 773, 67, 80),
    "ach_crown": (1272, 771, 72, 81),
    "ach_gem_shield": (1360, 769, 67, 84),
    "ach_banner": (1439, 770, 81, 88),
    "banner_ghost": (1432, 874, 96, 132),
    "deco_ground": (14, 879, 750, 129),
    "deco_gate": (14, 879, 232, 129),
    "deco_tombs": (246, 879, 386, 129),
    "deco_tree": (632, 879, 132, 129),
    "deco_lamp": (776, 880, 65, 128),
    "deco_sign": (864, 883, 92, 125),
    "deco_pillar": (972, 879, 81, 129),
    "deco_cauldron": (1064, 888, 86, 118),
    "deco_crystals": (1165, 885, 91, 124),
    "chest_big": (1280, 900, 128, 108),
}

# Region card art (top half of each card, above the baked-in label).
CARD_ART: dict[str, tuple[int, int, int, int]] = {
    "region_whispering_woods": (19, 453, 161, 150),  # Haunted Forest art
    "region_haunted_castle": (196, 455, 161, 150),  # Cursed Castle art
    "region_pumpkin_village": (377, 455, 143, 150),  # Lost Village art
    "region_forgotten_cemetery": (539, 454, 155, 150),  # Dark Ruins art
}

# Nav icons sit on a navy bar, so background is keyed from the crop border.
NAV_ICONS: dict[str, tuple[int, int, int, int]] = {
    "nav_home": (62, 771, 58, 50),
    "nav_quests": (200, 771, 56, 50),
    "nav_world": (334, 771, 56, 50),
    "nav_ledger": (466, 771, 56, 50),
    "nav_profile": (594, 771, 50, 50),
}

UPSCALE = {"scene_night", "scene_haunted", "scene_dusk", "scene_day", "logo", "keeper_avatar"}


def key_background(rgb: np.ndarray, tolerance: float) -> np.ndarray:
    """Return alpha channel: pixels similar to the border colour and connected
    to the crop border become transparent; a 2px band is feathered."""
    border = np.concatenate([rgb[0], rgb[-1], rgb[:, 0], rgb[:, -1]])
    ref = np.median(border, axis=0)
    dist = np.sqrt(((rgb - ref) ** 2).sum(axis=2))
    low = dist <= tolerance
    lab, _ = ndimage.label(low)
    edge_labels = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
    bg = np.isin(lab, list(edge_labels))
    alpha = np.where(bg, 0.0, 1.0)
    band = ndimage.binary_dilation(bg, iterations=2) & ~bg
    soft = np.clip((dist - tolerance * 0.5) / (tolerance * 2.0), 0.0, 1.0)
    alpha = np.where(band, np.maximum(soft, 0.35), alpha)
    return (alpha * 255).astype(np.uint8)


def cut(sheet: np.ndarray, box: tuple[int, int, int, int], pad: int = 2, tol: float = 22.0) -> Image.Image:
    x, y, w, h = box
    x0, y0 = max(0, x - pad), max(0, y - pad)
    x1, y1 = min(sheet.shape[1], x + w + pad), min(sheet.shape[0], y + h + pad)
    rgb = sheet[y0:y1, x0:x1].astype(float)
    alpha = key_background(rgb, tol)
    # Drop slivers of neighbouring sprites: keep the main blob and any blob at
    # least 25% of its size (e.g. detached sparkles stay, cut-off wings go).
    lab, count = ndimage.label(alpha > 0)
    if count > 1:
        sizes = ndimage.sum(np.ones_like(lab), lab, index=range(1, count + 1))
        keep = [i + 1 for i, s in enumerate(sizes) if s >= sizes.max() * 0.25]
        alpha = np.where(np.isin(lab, keep), alpha, 0).astype(np.uint8)
    out = np.dstack([rgb.astype(np.uint8), alpha])
    return Image.fromarray(out, "RGBA")


def recolor(img: Image.Image, tint: tuple[int, int, int]) -> Image.Image:
    """Luminance-preserving tint so outlines stay dark and fills take the tint."""
    arr = np.array(img).astype(float)
    lum = (0.299 * arr[..., 0] + 0.587 * arr[..., 1] + 0.114 * arr[..., 2]) / 255.0
    lum = np.clip((lum - 0.15) / 0.75, 0, 1)
    dark = np.array([28, 22, 52], dtype=float)
    t = np.array(tint, dtype=float)
    rgb = dark + (t - dark) * lum[..., None]
    out = np.dstack([rgb, arr[..., 3]]).astype(np.uint8)
    return Image.fromarray(out, "RGBA")


def save(img: Image.Image, name: str) -> None:
    if name in UPSCALE:
        img = img.resize((img.width * 2, img.height * 2), Image.LANCZOS)
    img.save(IMG_OUT / f"{name}.png", optimize=True)


def make_launcher_icons(avatar: Image.Image) -> None:
    sizes = {"mdpi": 48, "hdpi": 72, "xhdpi": 96, "xxhdpi": 144, "xxxhdpi": 192}
    for density, size in sizes.items():
        folder = RES / f"mipmap-{density}"
        folder.mkdir(parents=True, exist_ok=True)
        icon = avatar.resize((size, size), Image.LANCZOS)
        bg = Image.new("RGBA", (size, size), (18, 14, 38, 255))
        square = Image.alpha_composite(bg, icon)
        square.save(folder / "ic_launcher.png", optimize=True)
        icon.save(folder / "ic_launcher_round.png", optimize=True)


def make_effect_textures() -> None:
    """Procedural textures for fog banks and light glows (white, alpha-only)."""
    rng = np.random.default_rng(31)
    w, h = 768, 256
    field = np.zeros((h, w))
    for _ in range(70):
        cx, cy = rng.uniform(0, w), rng.uniform(h * 0.25, h * 0.85)
        rx, ry = rng.uniform(40, 140), rng.uniform(18, 55)
        yy, xx = np.ogrid[:h, :w]
        for dx in (-w, 0, w):  # wrap horizontally so the texture tiles
            field += np.exp(-(((xx - cx - dx) / rx) ** 2 + ((yy - cy) / ry) ** 2)) * rng.uniform(0.3, 1.0)
    field = ndimage.gaussian_filter(field, 6)
    field = field / field.max()
    edge = np.clip(np.minimum(np.arange(h), h - 1 - np.arange(h)) / (h * 0.25), 0, 1)[:, None]
    alpha = (np.clip(field, 0, 1) ** 1.4 * edge * 200).astype(np.uint8)
    fog = np.dstack([np.full((h, w), 235, np.uint8), np.full((h, w), 230, np.uint8),
                     np.full((h, w), 255, np.uint8), alpha])
    Image.fromarray(fog, "RGBA").save(IMG_OUT / "fx_fog.png", optimize=True)

    s = 192
    yy, xx = np.ogrid[:s, :s]
    r = np.sqrt((xx - s / 2) ** 2 + (yy - s / 2) ** 2) / (s / 2)
    glow_alpha = (np.clip(1 - r, 0, 1) ** 2.2 * 255).astype(np.uint8)
    glow = np.dstack([np.full((s, s), 255, np.uint8)] * 3 + [glow_alpha])
    Image.fromarray(glow, "RGBA").save(IMG_OUT / "fx_glow.png", optimize=True)
    print("fx     fx_fog, fx_glow")


def convert_audio() -> None:
    if shutil.which("ffmpeg") is None:
        raise SystemExit("ffmpeg is required to convert audio")
    RAW_OUT.mkdir(parents=True, exist_ok=True)
    for folder in ("Music", "Ambience", "SFX"):
        for wav in sorted((AUDIO_SRC / folder).glob("*.wav")):
            target = RAW_OUT / (wav.stem.lower() + ".ogg")
            quality = "3" if folder != "SFX" else "4"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav), "-ac", "1",
                 "-c:a", "libvorbis", "-q:a", quality, str(target)],
                check=True,
            )
            print(f"audio  {target.name}  {os.path.getsize(target) // 1024} KB")


def main() -> None:
    IMG_OUT.mkdir(parents=True, exist_ok=True)
    sheet = np.array(Image.open(SHEET).convert("RGB"))
    for name, box in SPRITES.items():
        save(cut(sheet, box), name)
        print(f"sprite {name}")
    for name, (x, y, w, h) in CARD_ART.items():
        art = Image.fromarray(sheet[y:y + h, x:x + w]).convert("RGBA")
        art.resize((w * 2, h * 2), Image.LANCZOS).save(IMG_OUT / f"{name}.png", optimize=True)
        print(f"card   {name}")
    for name, box in NAV_ICONS.items():
        icon = cut(sheet, box, pad=0, tol=40.0)
        recolor(icon, (255, 196, 64)).save(IMG_OUT / f"{name}_active.png", optimize=True)
        recolor(icon, (196, 186, 236)).save(IMG_OUT / f"{name}.png", optimize=True)
        print(f"nav    {name}")
    make_launcher_icons(cut(sheet, SPRITES["keeper_avatar"]))
    make_effect_textures()
    convert_audio()


if __name__ == "__main__":
    main()
