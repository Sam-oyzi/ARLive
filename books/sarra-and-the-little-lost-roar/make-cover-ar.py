"""The Arabic cover: the English title lifted off the cream paper at the top, the Arabic title lettered in
the same ink in its place.

    python3 books/sarra-and-the-little-lost-roar/make-cover-ar.py

Writes ar-page-01.jpg next to page-01.jpg (assets/ and public/book-art/). Arabic needs real shaping
(joined letters, right to left), which Pillow lacks here, so the title is drawn by resvg, the SVG
renderer the project already uses, with macOS's DecoType Naskh.
"""
import json
import os
import subprocess
import tempfile

import numpy as np
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(os.path.dirname(HERE))
PUBLIC = os.path.join(ROOT, "public", "book-art", "sarra-and-the-little-lost-roar")
LINES = ["سارة والزئير", "الصغير الضائع"]
# Where the English title sits on the 1200 × 1600 cover, clear of the trunk and the leaves either side,
# with room below for the Arabic letters that drop under the line.
BOX = (88, 12, 1125, 425)
# Left of x and below y on the cover: the owl.
OWL = (300, 360)

RENDER = r"""
// node -e: argv is [node, ...arguments]
const [, root, out, width, height, colour, lines] = process.argv;
const { Resvg } = require(root + "/node_modules/@resvg/resvg-js");
const rows = JSON.parse(lines);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${rows.map((text, i) =>
  `<text x="${width / 2}" y="${170 + i * 180}" font-family="DecoType Naskh" font-size="${i ? 185 : 200}" text-anchor="middle" direction="rtl"
     fill="${colour}" stroke="${colour}" stroke-width="5" stroke-linejoin="round">${text}</text>`).join("")}</svg>`;
require("fs").writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
"""


def blur(a: np.ndarray, radius: float) -> np.ndarray:
    """About a Gaussian of this radius: three box blurs, along each axis, edges held."""
    r = max(1, int(round(radius)))
    out = a.astype(np.float32)
    for axis in (0, 1):
        for _ in range(3):
            pad = [(0, 0)] * out.ndim
            pad[axis] = (r + 1, r)
            c = np.cumsum(np.pad(out, pad, mode="edge"), axis=axis)
            out = (np.take(c, range(2 * r + 1, c.shape[axis]), axis=axis) - np.take(c, range(0, c.shape[axis] - 2 * r - 1), axis=axis)) / (2 * r + 1)
    return out


def main():
    cover = np.asarray(Image.open(os.path.join(PUBLIC, "page-01.jpg")).convert("RGB")).astype(np.float32)
    x0, y0, x1, y1 = BOX
    region = cover[y0:y1, x0:x1]

    # The ink: dark and nearly colourless, unlike the leaves and the paper.
    lum = region @ np.array([0.299, 0.587, 0.114], np.float32)
    chroma = region.max(-1) - region.min(-1)
    ink = (lum < 135) & (chroma < 55)
    # The owl's head rises into the bottom-left of the box: its outline is ink too, and stays.
    ink[OWL[1] - y0:, : OWL[0] - x0] = False
    colour = np.median(region[ink & (lum < 80)], 0) if (ink & (lum < 80)).any() else np.array([43, 33, 28])
    mask = Image.fromarray((ink * 255).astype(np.uint8)).filter(ImageFilter.MaxFilter(9))
    soft = np.asarray(mask.filter(ImageFilter.GaussianBlur(2)), np.float32)[..., None] / 255

    # Paper where the ink was: the paper around it, spread inwards, with its own grain laid back on.
    keep = 1 - np.asarray(mask, np.float32)[..., None] / 255
    paper = blur((region * keep).astype(np.float32), 22) / np.maximum(blur(keep.astype(np.float32), 22), 1e-3)
    grain_src = region - blur(region.astype(np.float32), 3)
    grain = grain_src[keep[..., 0] > 0.5].std(0)
    rng = np.random.default_rng(7)
    noise = rng.normal(0, 1, region.shape[:2])[..., None] * grain * 0.9
    noise = blur(noise.astype(np.float32), 0.8)
    cleaned = region * (1 - soft) + np.clip(paper + noise, 0, 255) * soft

    # The Arabic title, in the English title's ink.
    hex_colour = "#%02x%02x%02x" % tuple(int(c) for c in colour)
    with tempfile.TemporaryDirectory() as tmp:
        out = os.path.join(tmp, "title.png")
        subprocess.run(["node", "-e", RENDER, ROOT, out, str(x1 - x0), str(y1 - y0), hex_colour, json.dumps(LINES)], check=True)
        title = np.asarray(Image.open(out).convert("RGBA"), np.float32) / 255
    alpha = title[..., 3:]
    lettered = cleaned * (1 - alpha) + colour * alpha

    result = cover.copy()
    result[y0:y1, x0:x1] = lettered
    image = Image.fromarray(np.clip(result, 0, 255).astype(np.uint8))
    for folder in (PUBLIC, os.path.join(HERE, "assets")):
        image.save(os.path.join(folder, "ar-page-01.jpg"), quality=92)
    print("ar-page-01.jpg, ink", hex_colour)


if __name__ == "__main__":
    main()
