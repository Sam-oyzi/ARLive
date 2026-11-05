"""Looks through a 360° story world the way the app does, for checking one by eye.

    python3 scripts/panorama_views.py world.jpg out.jpg

Writes a sheet of perspective views (ahead, right, behind, left, up, down) using the viewer's mapping:
the middle of the panorama is straight ahead, its right half is to the right, the top row is overhead.
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw


def view(pano: np.ndarray, bearing: float, pitch: float, fov: float = 90, size: int = 512) -> np.ndarray:
    """A square perspective view; bearing 0 = ahead, 90 = right; pitch + is up (degrees)."""
    H, W, _ = pano.shape
    half = math.tan(math.radians(fov) / 2)
    j, i = np.mgrid[0:size, 0:size].astype(np.float64)
    x = (2 * (i + 0.5) / size - 1) * half
    y = (1 - 2 * (j + 0.5) / size) * half
    # Camera looking along -Z, then pitched (about X) and turned (about Y, clockwise from above).
    p, b = math.radians(pitch), math.radians(bearing)
    dy = y * math.cos(p) + math.sin(p)
    dz = -math.cos(p) + y * math.sin(p)
    dx = x
    # Turn right by the bearing: ahead (-Z) goes to +X.
    rx = dx * math.cos(b) - dz * math.sin(b)
    rz = dx * math.sin(b) + dz * math.cos(b)
    norm = np.sqrt(rx * rx + dy * dy + rz * rz)
    theta = np.arccos(np.clip(dy / norm, -1, 1))
    lon = np.mod(np.arctan2(-rx, rz) / (2 * math.pi), 1)
    u = lon * W - 0.5
    v = np.clip(theta / math.pi * H - 0.5, 0, H - 1)
    x0 = np.floor(u).astype(int)
    y0 = np.floor(v).astype(int)
    fx = (u - x0)[..., None]
    fy = (v - y0)[..., None]
    xa, xb = x0 % W, (x0 + 1) % W
    ya, yb = y0, np.minimum(y0 + 1, H - 1)
    top = pano[ya, xa] * (1 - fx) + pano[ya, xb] * fx
    bottom = pano[yb, xa] * (1 - fx) + pano[yb, xb] * fx
    return top * (1 - fy) + bottom * fy


def sheet(path: str, out: str, size: int = 400):
    pano = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    shots = [("ahead", 0, 0), ("right", 90, 0), ("behind", 180, 0), ("left", 270, 0), ("up", 0, 89), ("down", 0, -89)]
    canvas = Image.new("RGB", (size * 3 + 20, size * 2 + 40), "white")
    draw = ImageDraw.Draw(canvas)
    for k, (name, bearing, pitch) in enumerate(shots):
        img = Image.fromarray(np.clip(view(pano, bearing, pitch, 90, size), 0, 255).astype(np.uint8))
        x, y = (k % 3) * (size + 10), (k // 3) * (size + 20)
        canvas.paste(img, (x, y + 16))
        draw.text((x + 4, y + 2), name, fill="black")
    canvas.save(out, quality=88)


if __name__ == "__main__":
    sheet(sys.argv[1], sys.argv[2])
