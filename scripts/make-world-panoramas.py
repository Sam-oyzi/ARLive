"""Paints 360° story worlds, and repairs AI-made ones, so they look right in every direction.

    python3 scripts/make-world-panoramas.py render snowy-peaks public/book-art/water-drop/world-snowy-peaks.jpg
    python3 scripts/make-world-panoramas.py fix world-forest.jpg world-forest.jpg
    python3 scripts/panorama_views.py world.jpg views.jpg      # look through one, as the app does

The geometry is computed, not drawn: every pixel is the colour seen in that direction from the
reader's eye, ROOM.eye = 1.5 m above flat ground (src/ar/story-room.ts), in the app's mapping (the
middle of the image straight ahead, its right half to the right, the top row overhead). Far things
(mountains, tree lines, clouds) are drawn in longitude and latitude, which is what they are at that
distance. Near things (the ground, a river, trees, Lou) are traced: the ground through its real
perspective, and each figure as a flat cut-out standing on it and facing the reader. Nothing stretches
or pinches when the reader looks round, up at the sky or down at their feet, and the left and right
edges meet.

AI image generators paint "360°" images as flat wide pictures: their tops and bottoms swirl into a
point and their edges rarely meet. `fix` blends the edges together and lays a calm, untextured-looking
sky and ground over the two poles.

Needs numpy and Pillow (pip install numpy pillow).
"""
import math
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

EYE = 1.5  # metres: src/ar/story-room.ts ROOM.eye
WIDTH = int(__import__("os").environ.get("PANO_WIDTH", 4096))  # the app caps panoramas at 4096 wide
SS = 2  # drawn at twice the size, then reduced, for clean edges

# The Water Drop sketchbook's palette (scripts/make-example-book.ts).
C = {
    "paper": "#f3ead8", "ink": "#2b2320", "sepia": "#8a5a3b", "sienna": "#c98a48", "gold": "#e3a944",
    "indigo": "#34497a", "blue": "#5d8fc2", "sky": "#a9cbe8", "red": "#c8433a", "green": "#6f8f58",
    "grey": "#9aa3ad", "pale": "#dfe7ee",
}


def rgb(color: str) -> np.ndarray:
    return np.array([int(color[i:i + 2], 16) for i in (1, 3, 5)], np.float32) / 255


def rgba(color: str, alpha: float = 1.0) -> tuple:
    r, g, b = (int(color[i:i + 2], 16) for i in (1, 3, 5))
    return (r, g, b, int(round(alpha * 255)))


def smoothstep(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1)
    return t * t * (3 - 2 * t)


def hash3(ix, iy, iz, seed):
    h = np.sin(ix * 127.1 + iy * 311.7 + iz * 74.7 + seed * 19.19) * 43758.5453
    return h - np.floor(h)


def noise3(x, y, z, seed=0):
    """Smooth value noise in 3D, in [0, 1)."""
    ix, iy, iz = np.floor(x), np.floor(y), np.floor(z)
    fx, fy, fz = x - ix, y - iy, z - iz
    fx, fy, fz = fx * fx * (3 - 2 * fx), fy * fy * (3 - 2 * fy), fz * fz * (3 - 2 * fz)
    out = 0.0
    for dx in (0, 1):
        for dy in (0, 1):
            for dz in (0, 1):
                w = (fx if dx else 1 - fx) * (fy if dy else 1 - fy) * (fz if dz else 1 - fz)
                out = out + w * hash3(ix + dx, iy + dy, iz + dz, seed)
    return out


def fbm3(x, y, z, seed=0, octaves=3):
    total, amp, norm = 0.0, 1.0, 0.0
    for o in range(octaves):
        f = 2.0 ** o
        total = total + amp * noise3(x * f, y * f, z * f, seed + o * 7)
        norm += amp
        amp *= 0.5
    return total / norm


class Panorama:
    """An equirectangular canvas with the app's mapping, drawn at SS times the final size."""

    def __init__(self, width: int = WIDTH):
        self.W = width * SS
        self.H = self.W // 2
        self.img = np.zeros((self.H, self.W, 3), np.float32)
        self.ground_mask = None

    # bearing: degrees clockwise from straight ahead; elevation: degrees above the horizon.
    def col(self, bearing):
        return ((np.asarray(bearing) + 180) / 360) % 1 * self.W

    def row(self, elevation):
        return (90 - np.asarray(elevation)) / 180 * self.H

    def directions(self, rows, cols):
        """Unit view directions (x right, y up, z behind) for these pixel rows and columns."""
        phi = (np.asarray(cols, np.float64) + 0.5) / self.W * 2 * math.pi
        theta = (np.asarray(rows, np.float64) + 0.5) / self.H * math.pi
        theta, phi = np.meshgrid(theta, phi, indexing="ij")
        return -np.sin(phi) * np.sin(theta), np.cos(theta), np.cos(phi) * np.sin(theta)

    def paint_background(self, sky, ground, chunk=256):
        """sky(dx, dy, dz) and ground(gx, gz, distance, dx, dy, dz) give colours, row by row."""
        cols = np.arange(self.W)
        horizon = self.H // 2
        for r0 in range(0, self.H, chunk):
            rows = np.arange(r0, min(r0 + chunk, self.H))
            dx, dy, dz = self.directions(rows, cols)
            block = sky(dx, dy, dz)
            below = dy < 0
            if below.any():
                t = np.where(below, EYE / np.maximum(-dy, 1e-6), 0)
                gx, gz = dx * t, dz * t
                g = ground(gx, gz, t * np.sqrt(dx * dx + dz * dz), dx, dy, dz)
                # Far ground melts into the haze at the horizon instead of shimmering.
                haze = smoothstep(120, 900, t * np.sqrt(dx * dx + dz * dz))[..., None]
                horizon_colour = sky(dx * 0 + 0, dy * 0 + 0.0001, dz * 0 - 1)
                g = g * (1 - haze) + horizon_colour * haze
                block = np.where(below[..., None], g, block)
            self.img[rows[0]:rows[-1] + 1] = block
        del horizon

    def far_layer(self):
        """An RGBA layer the size of the canvas, for things at the horizon or in the sky."""
        return Image.new("RGBA", (self.W, self.H), (0, 0, 0, 0))

    def composite(self, layer: Image.Image, blur: float = 0):
        a = np.asarray(layer).astype(np.float32) / 255
        colour, alpha = a[..., :3] * a[..., 3:], a[..., 3:]
        if blur:
            # Blur colour and coverage separately: transparent pixels must not bleed black into edges.
            soft = lambda x: np.asarray(Image.fromarray((x * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(blur * SS))).astype(np.float32) / 255
            colour = np.stack([soft(colour[..., c]) for c in range(3)], -1)
            alpha = soft(alpha[..., 0])[..., None]
        self.img = self.img * (1 - alpha) + colour

    def wrap_polygon(self, draw, points, **kw):
        """A polygon in (bearing, elevation), drawn again a full turn either side so it wraps."""
        xy = [(float(self.col(b)), float(self.row(e))) for b, e in points]
        # Keep the shape continuous: unwrap the bearings first.
        bx = [((b + 180) / 360) * self.W for b, _ in points]
        for shift in (-self.W, 0, self.W):
            draw.polygon([(x + shift, y) for x, (_, y) in zip(bx, xy)], **kw)

    def wrap_line(self, draw, points, **kw):
        bx = [((b + 180) / 360) * self.W for b, _ in points]
        ys = [float(self.row(e)) for _, e in points]
        for shift in (-self.W, 0, self.W):
            draw.line([(x + shift, y) for x, y in zip(bx, ys)], **kw)

    def billboard(self, sprite: Image.Image, bearing: float, distance: float, width: float, height: float, base: float = 0.0):
        """A flat figure standing `distance` metres away, facing the reader, its bottom at `base` m."""
        s_img = np.asarray(sprite).astype(np.float32) / 255
        sh, sw, _ = s_img.shape
        half = math.degrees(math.atan(width / 2 / distance)) + 0.2
        top = math.degrees(math.atan((base + height - EYE) / distance)) + 0.2
        bottom = math.degrees(math.atan((base - EYE) / distance)) - 0.2
        c0, c1 = int(math.floor(self.col(bearing - half))), int(math.ceil(self.col(bearing - half) + (2 * half) / 360 * self.W))
        r0, r1 = max(0, int(self.row(top))), min(self.H, int(math.ceil(self.row(bottom))) + 1)
        cols = np.arange(c0, c1 + 1)
        rows = np.arange(r0, r1)
        if len(rows) == 0:
            return
        phi = (np.mod(cols, self.W) + 0.5) / self.W * 2 * math.pi
        rel = np.mod(phi - (math.pi + math.radians(bearing)) + math.pi, 2 * math.pi) - math.pi
        elev = math.pi / 2 - (rows + 0.5) / self.H * math.pi
        rel, elev = np.meshgrid(rel, elev)
        s = distance * np.tan(rel)
        y = EYE + np.tan(elev) * distance / np.cos(rel)
        u = (s / width + 0.5) * sw - 0.5
        v = (1 - (y - base) / height) * sh - 0.5
        inside = (u > -0.5) & (u < sw - 0.5) & (v > -0.5) & (v < sh - 0.5)
        x0 = np.clip(np.floor(u).astype(int), 0, sw - 1)
        y0 = np.clip(np.floor(v).astype(int), 0, sh - 1)
        x1, y1 = np.minimum(x0 + 1, sw - 1), np.minimum(y0 + 1, sh - 1)
        fx, fy = np.clip(u - x0, 0, 1)[..., None], np.clip(v - y0, 0, 1)[..., None]
        sample = (s_img[y0, x0] * (1 - fx) + s_img[y0, x1] * fx) * (1 - fy) + (s_img[y1, x0] * (1 - fx) + s_img[y1, x1] * fx) * fy
        alpha = sample[..., 3:] * inside[..., None]
        # Premultiply so soft edges don't pick up a dark fringe.
        colour = sample[..., :3]
        idx = np.mod(cols, self.W)
        region = self.img[r0:r1][:, idx]
        self.img[r0:r1, idx] = region * (1 - alpha) + colour * alpha

    def finish(self, grain=0.06, seed=3) -> Image.Image:
        """Reduce to the final size and lay paper grain over everything, the same in every direction."""
        out = Image.fromarray(np.clip(self.img * 255, 0, 255).astype(np.uint8)).resize((self.W // SS, self.H // SS), Image.LANCZOS)
        a = np.asarray(out).astype(np.float32) / 255
        H, W = a.shape[:2]
        for r0 in range(0, H, 256):
            rows = np.arange(r0, min(r0 + 256, H))
            phi = (np.arange(W) + 0.5) / W * 2 * math.pi
            theta = (rows + 0.5) / H * math.pi
            theta, phi = np.meshgrid(theta, phi, indexing="ij")
            dx, dy, dz = -np.sin(phi) * np.sin(theta), np.cos(theta), np.cos(phi) * np.sin(theta)
            fine = fbm3(dx * 220, dy * 220, dz * 220, seed, 2)
            wash = fbm3(dx * 6, dy * 6, dz * 6, seed + 50, 3)
            k = 1 - grain * (fine - 0.5) - 0.05 * (wash - 0.5)
            a[r0:r0 + len(rows)] *= k[..., None]
        return Image.fromarray(np.clip(a * 255, 0, 255).astype(np.uint8))


# ---------- figures, drawn flat like the book's ink-and-wash pages ----------

def ink_width(px_per_m, metres=0.012):
    return max(2, int(round(px_per_m * metres)))


def wash_over(fill: str, alpha: float, paper: str = C["paper"]) -> tuple:
    """A see-through wash of `fill` on paper, as one opaque colour (cut-outs have nothing behind them)."""
    p, f = rgb(paper), rgb(fill)
    mixed = p * (1 - alpha) + f * alpha
    return tuple(int(round(c * 255)) for c in mixed) + (255,)


def pine_sprite(ppm=300, snowy=False):
    """The book's pine: a green two-tier triangle with an ink outline and a trunk, 1.6 m by 3.2 m."""
    w, h = int(1.6 * ppm), int(3.2 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, top, base = w / 2, 0.04 * h, 0.86 * h
    pts = [(cx, top), (cx + 0.29 * w, 0.42 * h), (cx + 0.16 * w, 0.42 * h), (cx + 0.46 * w, base),
           (cx - 0.46 * w, base), (cx - 0.16 * w, 0.42 * h), (cx - 0.29 * w, 0.42 * h)]
    lw = ink_width(ppm, 0.03)
    d.line([(cx, base), (cx, h - 1)], fill=rgba(C["ink"]), width=lw + 1)
    d.polygon(pts, fill=wash_over(C["green"], 0.62), outline=rgba(C["ink"]), width=lw)
    if snowy:
        for y0, x0 in ((top, 0), (0.42 * h, 0.16 * w)):
            cap = [(cx, y0 + 2 * lw), (cx + 0.12 * w + x0 * 0.3, y0 + 0.1 * h), (cx + 0.04 * w, y0 + 0.08 * h),
                   (cx - 0.05 * w, y0 + 0.11 * h), (cx - 0.12 * w - x0 * 0.3, y0 + 0.09 * h)]
            d.polygon(cap, fill=(255, 255, 255, 235))
    return img


def lou_sprite(ppm=900, mood="smile"):
    """Lou the water drop, 0.5 m wide by 0.65 m tall, as in the book."""
    w = int(0.5 * ppm)
    s = w / 100  # the book draws Lou 90 units wide and 125 tall
    h = int(130 * s)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = w / 2, 62 * s
    lw = ink_width(ppm, 0.008)
    tip = (cx, cy - 60 * s)
    body = []
    for t in np.linspace(0, 1, 30):  # the two sides of the point, then the round bottom
        body.append((cx + 45 * s * t ** 0.8, cy - 60 * s + 80 * s * t))
    for a in np.linspace(0, math.pi, 50):
        body.append((cx + 45 * s * math.cos(a), cy + 20 * s + 45 * s * math.sin(a)))
    for t in np.linspace(1, 0, 30):
        body.append((cx - 45 * s * t ** 0.8, cy - 60 * s + 80 * s * t))
    body.insert(0, tip)
    d.polygon(body, fill=wash_over(C["sky"], 0.9, "#ffffff"), outline=rgba(C["ink"]), width=lw)
    d.ellipse([cx - 0 * s, cy + 18 * s, cx + 40 * s, cy + 60 * s], fill=rgba(C["blue"], 0.25))
    d.ellipse([cx - 25 * s, cy - 10 * s, cx - 11 * s, cy + 18 * s], fill=(255, 255, 255, 215))
    if mood == "sleep":
        for ex in (-14, 14):
            d.arc([cx + (ex - 7) * s, cy + 14 * s, cx + (ex + 7) * s, cy + 26 * s], 20, 160, fill=rgba(C["ink"]), width=lw)
    else:
        for ex in (-14, 14):
            d.ellipse([cx + (ex - 4.5) * s, cy + 13.5 * s, cx + (ex + 4.5) * s, cy + 22.5 * s], fill=rgba(C["ink"]))
    d.arc([cx - 12 * s, cy + 26 * s, cx + 12 * s, cy + 42 * s], 20, 160, fill=rgba(C["ink"]), width=lw)
    for ex in (-24, 24):
        d.ellipse([cx + (ex - 5) * s, cy + 27 * s, cx + (ex + 5) * s, cy + 37 * s], fill=rgba(C["red"], 0.35))
    return img


def zz_sprite(ppm=900):
    """The book's sleepy 'z z', 0.36 m wide."""
    w, h = int(0.36 * ppm), int(0.22 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = ink_width(ppm, 0.009)
    for x0, y0, size in ((0.05, 0.45, 0.4), (0.55, 0.1, 0.32)):
        x, y, sz = x0 * w, y0 * h, size * w
        d.line([(x, y), (x + sz, y), (x + 0.1 * sz, y + 0.9 * sz * 0.7), (x + sz * 1.05, y + 0.9 * sz * 0.7)], fill=rgba(C["sepia"]), width=lw, joint="curve")
    return img


def mound_sprite(ppm=500):
    """A snow drift for Lou to sleep on, 1.8 m by 0.7 m."""
    w, h = int(1.8 * ppm), int(0.7 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(x, h - (h * 0.92) * math.sin(math.pi * x / w) ** 0.7) for x in np.linspace(0, w, 60)]
    # A touch bluer than the snow round it, so the drift reads as its own shape.
    d.polygon(pts + [(w, h), (0, h)], fill=wash_over(C["pale"], 0.7, "#ffffff"))
    d.line(pts, fill=rgba(C["ink"]), width=ink_width(ppm, 0.012))
    return img


# ---------- the worlds ----------

def ridge_line(peaks, base=1.2):
    """The skyline of overlapping peaks: at each bearing the highest of them, sharp at every summit."""
    bearings = sorted(set(np.round(np.arange(-180, 180.01, 0.5), 2).tolist() + [((b + 180) % 360) - 180 for b, _, _ in peaks]))
    line = []
    for b in bearings:
        top = base
        for pb, ph, spread in peaks:
            for shift in (-360, 0, 360):
                top = max(top, ph * (1 - abs(b - (pb + shift)) / spread))
        line.append((b, top))
    return line


def mountain_ring(pano: Panorama, layer: Image.Image, peaks, tint=C["sepia"], alpha=0.42, snow_above=None, hatch=True):
    """A ring of the book's mountains at the horizon: sepia wash, ink ridge, hatching, zigzag snow."""
    d = ImageDraw.Draw(layer)
    ridge = ridge_line(peaks)
    pano.wrap_polygon(d, ridge + [(180.0, -1.0), (-180.0, -1.0)], fill=wash_over(tint, alpha))
    lw = 3 * SS
    tops = dict(ridge)
    for bearing, height, spread in peaks:
        b = ((bearing + 180) % 360) - 180
        if tops.get(b, 0) > height + 0.01:
            continue  # hidden behind a taller neighbour
        if hatch:
            for k in range(8):
                e = height * (0.86 - k * 0.075)
                hb = b + spread * (0.14 + k * 0.075)
                pano.wrap_line(d, [(hb, e), (hb + spread * 0.12, e - height * 0.09)], fill=rgba(C["sepia"]), width=int(1.6 * SS))
        if snow_above is not None and height >= snow_above:
            depth = min(height * 0.3, 8)
            half = spread * depth / height
            zig = [(b + half - 2 * half * i / 6, height - depth + (0.22 if i % 2 else -0.18) * depth) for i in range(7)]
            pano.wrap_polygon(d, [(b, height)] + zig, fill=(255, 255, 255, 240))
            pano.wrap_line(d, zig, fill=rgba(C["ink"]), width=2 * SS, joint="curve")
    pano.wrap_line(d, ridge, fill=rgba(C["ink"]), width=lw, joint="curve")


def cloud(pano: Panorama, d: ImageDraw.ImageDraw, bearing, elevation, size, rng):
    """The book's puffy cloud: overlapping white rounds with an ink edge, drawn on the sky."""
    blobs = [(bearing + dx * size, elevation + dy * size * 0.6, r * size) for dx, dy, r in
             ((-1.1, 0, 0.9), (-0.3, 0.45, 1.15), (0.6, 0.25, 1.0), (1.3, -0.05, 0.75), (0.1, -0.15, 0.95))]
    for pass_, (fill, grow) in enumerate(((rgba(C["ink"], 0.9), 0.06 * size), ((255, 255, 255, 245), 0))):
        for b, e, r in blobs:
            for shift in (-pano.W, 0, pano.W):
                x, y = float(pano.col(b)) + shift, float(pano.row(e))
                rx = (r + grow) / 360 * pano.W / math.cos(math.radians(e))
                ry = (r + grow) * 0.62 / 180 * pano.H
                d.ellipse([x - rx, y - ry, x + rx, y + ry], fill=fill)


def birds(pano, d, bearing, elevation, rng, n=4):
    for _ in range(n):
        b, e = bearing + rng.uniform(-6, 6), elevation + rng.uniform(-2, 2)
        w = rng.uniform(0.6, 1.0)
        pano.wrap_line(d, [(b - w, e + 0.35), (b, e - 0.1), (b + w, e + 0.35)], fill=rgba(C["ink"], 0.85), width=int(1.8 * SS), joint="curve")


def paper_sky(top: str, horizon: str):
    t_c, h_c = rgb(top), rgb(horizon)

    def sky(dx, dy, dz):
        k = smoothstep(-0.05, 0.9, dy)[..., None]
        return h_c * (1 - k) + t_c * k

    return sky


def smooth_line(points, steps=24) -> np.ndarray:
    """A Catmull-Rom curve through the points, so rivers bend instead of turning corners."""
    p = np.asarray(points, np.float64)
    p = np.vstack([2 * p[0] - p[1], p, 2 * p[-1] - p[-2]])
    out = []
    for i in range(1, len(p) - 2):
        p0, p1, p2, p3 = p[i - 1], p[i], p[i + 1], p[i + 2]
        for t in np.linspace(0, 1, steps, endpoint=False):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(p[-2])
    return np.array(out)


def distance_to_line(line: np.ndarray, gx, gz):
    best = np.full(np.shape(gx), np.inf)
    for (x0, z0), (x1, z1) in zip(line[:-1], line[1:]):
        vx, vz = x1 - x0, z1 - z0
        t = np.clip(((gx - x0) * vx + (gz - z0) * vz) / (vx * vx + vz * vz + 1e-12), 0, 1)
        best = np.minimum(best, np.hypot(gx - (x0 + t * vx), gz - (z0 + t * vz)))
    return best


def edge_mask(mask: np.ndarray, width: int) -> np.ndarray:
    """The rim of a mask, `width` pixels thick, drawn as ink."""
    inner = mask.copy()
    for _ in range(width):
        inner = inner & np.roll(inner, 1, 0) & np.roll(inner, -1, 0) & np.roll(inner, 1, 1) & np.roll(inner, -1, 1)
    return mask & ~inner


def snowy_peaks() -> Panorama:
    """'Snowy peaks': up in the cold mountains, where Lou sleeps as snow through the winter."""
    rng = np.random.default_rng(7)
    pano = Panorama()
    snow, shade = rgb("#f8f6f1"), rgb("#dfe5ec")

    def ground(gx, gz, dist, dx, dy, dz):
        drift = fbm3(gx * 0.18, gz * 0.18, 0, 11, 3)
        k = smoothstep(0.45, 0.75, drift)[..., None]
        return snow * (1 - k * 0.55) + shade * (k * 0.55)

    pano.paint_background(paper_sky("#dfe9f2", "#f3eee3"), ground)
    far = pano.far_layer()
    # Two rings: pale distant peaks behind, the book's bolder ones in front.
    distant = [(b, rng.uniform(12, 20), rng.uniform(10, 15)) for b in np.arange(-170, 180, 24) + rng.uniform(-6, 6, 15)]
    mountain_ring(pano, far, distant, tint="#9a8f8a", alpha=0.3, snow_above=12, hatch=False)
    pano.composite(far)
    near = pano.far_layer()
    bold = [(-150, 24, 20), (-108, 17, 16), (-66, 30, 22), (-24, 21, 17), (10, 34, 24), (52, 22, 18), (90, 31, 23), (130, 19, 17), (165, 27, 20)]
    mountain_ring(pano, near, bold, snow_above=16)
    sky = ImageDraw.Draw(near)
    for b, e, s in ((-120, 44, 3.2), (-35, 50, 2.6), (35, 42, 3.6), (110, 47, 2.8), (175, 43, 3.0)):
        cloud(pano, sky, b, e, s, rng)
    pano.composite(near)

    scatter(pano, rng, rock_sprite(rng), 14, 4, 30, 0.6, 0.32, keep=lambda x, z: not (abs(x) < 1.5 and -5 < z < 0))
    # Pines further down the slopes, all round, bigger when nearer.
    pine = pine_sprite(snowy=True)
    spots = [(rng.uniform(-180, 180), rng.uniform(14, 70)) for _ in range(46)]
    for bearing, dist in sorted(spots, key=lambda s: -s[1]):
        if abs(bearing) < 14 and dist < 25:
            continue  # keep Lou's view clear
        scale = rng.uniform(0.85, 1.35)
        pano.billboard(pine, bearing, dist, 1.6 * scale, 3.2 * scale)
    # Lou asleep on a drift, just ahead.
    pano.billboard(mound_sprite(), 0, 2.7, 1.8, 0.7)
    pano.billboard(lou_sprite(mood="sleep"), -1.5, 2.66, 0.62, 0.806, base=0.52)
    pano.billboard(zz_sprite(), 7, 2.6, 0.36, 0.22, base=1.25)
    return pano


def the_river() -> Panorama:
    """'The river': Lou joins a stream that rushes down from the mountains towards the sea."""
    rng = np.random.default_rng(12)
    pano = Panorama()
    paper, grass, water, sea = rgb("#efe6d1"), rgb("#dfe3c4"), wash_over(C["blue"], 0.5)[:3], wash_over(C["blue"], 0.62)[:3]
    water, sea = np.array(water, np.float32) / 255, np.array(sea, np.float32) / 255
    # The river's middle line on the ground, from the mountains ahead (-Z) to the sea behind (+Z).
    line = smooth_line([(-40, -600), (-10, -220), (12, -90), (-2, -35), (6, -12), (3.2, 0), (5, 14), (-4, 60), (14, 180), (6, 700)])

    def river_distance(gx, gz):
        return distance_to_line(line, gx, gz)

    def ground(gx, gz, dist, dx, dy, dz):
        tint = fbm3(gx * 0.08, gz * 0.08, 0, 21, 3)[..., None]
        base = paper * (1 - 0.35 * tint) + grass * (0.35 * tint)
        width = 1.3 + np.clip(gz + 120, 0, 900) / 900 * 4  # wider downstream
        river = river_distance(gx, gz) < width
        behind = (gz > 260) & (np.abs(gx) < gz * 1.2)
        out = np.where(river[..., None], water, base)
        return np.where(behind[..., None], sea, out)

    pano.paint_background(paper_sky("#d9e8f3", "#f2ecdf"), ground)
    # Ink along both banks: the river's rim, found in the picture itself so it stays one line thick.
    below = np.arange(pano.H // 2, pano.H)
    river_px = np.all(np.abs(pano.img[below] - water) < 0.02, axis=-1)
    rim = np.zeros(pano.img.shape[:2], bool)
    rim[below] = edge_mask(river_px, 3 * SS)
    pano.img[rim] = rgb(C["ink"])

    far = pano.far_layer()
    peaks = [(-62, 15, 15), (-28, 24, 18), (4, 30, 20), (38, 21, 17), (72, 13, 14)]
    mountain_ring(pano, far, peaks, snow_above=14)
    d = ImageDraw.Draw(far)
    # Low green hills round the sides, the sea's horizon behind.
    hills = [(-180, -0.6)] + [(b, 2.2 + 1.6 * math.sin(b / 9)) for b in range(-178, -78, 4)] + [(-80, -0.6)]
    pano.wrap_polygon(d, hills, fill=wash_over(C["green"], 0.45))
    pano.wrap_line(d, hills[1:-1], fill=rgba(C["ink"]), width=3 * SS)
    hills_r = [(80, -0.6)] + [(b, 2.0 + 1.4 * math.sin(b / 7)) for b in range(82, 140, 4)] + [(140, -0.6)]
    pano.wrap_polygon(d, hills_r, fill=wash_over(C["green"], 0.45))
    pano.wrap_line(d, hills_r[1:-1], fill=rgba(C["ink"]), width=3 * SS)
    for b, e, s in ((-95, 31, 3.0), (-15, 36, 2.4), (55, 30, 3.4), (125, 37, 2.6), (170, 28, 3.2)):
        cloud(pano, d, b, e, s, rng)
    birds(pano, d, 40, 24, rng)
    birds(pano, d, -130, 27, rng, 3)
    pano.composite(far)

    tuft = tuft_sprite(rng)
    scatter(pano, rng, tuft, 70, 1.5, 25, 0.3, 0.2, keep=lambda x, z: river_distance(np.array([x]), np.array([z]))[0] > 2.6)
    pine = pine_sprite()
    spots = []
    while len(spots) < 40:
        bearing, dist = rng.uniform(-180, 180), rng.uniform(7, 80)
        x, z = dist * math.sin(math.radians(bearing)), -dist * math.cos(math.radians(bearing))
        if river_distance(np.array([x]), np.array([z]))[0] > 6 and not (z > 200):
            spots.append((bearing, dist))
    for bearing, dist in sorted(spots, key=lambda s: -s[1]):
        scale = rng.uniform(0.8, 1.3)
        pano.billboard(pine, bearing, dist, 1.6 * scale, 3.2 * scale)
    # Lou bobbing in the stream, a few steps ahead and to the right, half in the water.
    pano.billboard(lou_sprite(), 34, 4.6, 0.5, 0.65, base=-0.12)
    return pano


def brook_listening() -> Panorama:
    """Sarra's 'Listen by the water': a quiet brook among tall grass, a little tortoise across it."""
    rng = np.random.default_rng(31)
    pano = Panorama()
    meadow_a, meadow_b, bank = rgb("#b7b779"), rgb("#8f9e5c"), rgb("#7c8a4c")
    water_a, water_b = rgb("#9fbccb"), rgb("#c9dbe0")
    line = smooth_line([(-260, -120), (-60, -30), (-14, -5.2), (0, -3.0), (9, -3.6), (22, -9), (60, 10), (260, 120)])

    def brook_distance(gx, gz):
        return distance_to_line(line, gx, gz)

    stones = [(-3.4, -4.6, 0.32), (-1.6, -3.4, 0.24), (0.9, -2.8, 0.3), (2.6, -3.3, 0.22), (4.4, -4.3, 0.34), (6.8, -5.9, 0.26)]

    def ground(gx, gz, dist, dx, dy, dz):
        n = fbm3(gx * 0.35, gz * 0.35, 0, 41, 4)[..., None]
        out = meadow_a * (1 - n) + meadow_b * n
        bd = brook_distance(gx, gz)
        width = 0.75 + 0.25 * fbm3(gx * 0.2, gz * 0.2, 1, 43, 2)
        near_bank = smoothstep(width + 0.35, width, bd)[..., None]
        out = out * (1 - near_bank * 0.6) + bank * (near_bank * 0.6)
        ripple = fbm3(gx * 2.2, gz * 0.9, 2, 45, 2)[..., None]
        water = water_a * (1 - ripple) + water_b * ripple
        glint = (fbm3(gx * 9, gz * 4, 3, 47, 1) > 0.93)[..., None]
        water = np.where(glint, rgb("#f4f1e6"), water)
        out = np.where((bd < width)[..., None], water, out)
        for sx, sz, r in stones:
            k = smoothstep(r, r * 0.8, np.hypot((gx - sx) * 1.0, (gz - sz) * 1.5))[..., None]
            out = out * (1 - k) + rgb("#a29d93") * k * (0.9 + 0.2 * n)
        return out

    pano.paint_background(paper_sky("#cfe0e6", "#f6ead0"), ground)

    far = pano.far_layer()
    d = ImageDraw.Draw(far)
    # A soft morning glow ahead and to the left, then two layers of trees all round.
    for k in range(14, 0, -1):
        r = k * 1.6
        x, y = float(pano.col(-38)), float(pano.row(16))
        d.ellipse([x - r / 360 * pano.W, y - r / 180 * pano.H, x + r / 360 * pano.W, y + r / 180 * pano.H], fill=(255, 236, 180, 10))
    pano.composite(far, blur=8)
    for layer_i, (colour, top, base_alpha) in enumerate((("#a7b59a", 9.0, 0.85), ("#7f9358", 13.0, 0.95))):
        trees = pano.far_layer()
        d = ImageDraw.Draw(trees)
        ridge = [(-180, -0.6)]
        for b in np.arange(-180, 180.1, 1.5):
            n = 0.6 * math.sin(math.radians(b) * 7 + layer_i) + 0.4 * math.sin(math.radians(b) * 17 + 2 * layer_i)
            ridge.append((b, top * (0.62 + 0.25 * n) + rng.uniform(-0.6, 0.6)))
        ridge.append((180, -0.6))
        pano.wrap_polygon(d, ridge, fill=rgba(colour, base_alpha))
        for b in np.arange(-180, 180, 6 if layer_i else 9):
            e = top * 0.55 + rng.uniform(-1, 2)
            for _ in range(5):
                bb, ee, r = b + rng.uniform(-2.5, 2.5), e + rng.uniform(-1.5, 2.5), rng.uniform(1.4, 2.6)
                x, y = float(pano.col(bb)), float(pano.row(ee))
                for shift in (-pano.W, 0, pano.W):
                    d.ellipse([x + shift - r / 360 * pano.W, y - r / 180 * pano.H, x + shift + r / 360 * pano.W, y + r / 180 * pano.H], fill=rgba(colour, base_alpha))
        pano.composite(trees, blur=1.2)
    clouds = pano.far_layer()
    d = ImageDraw.Draw(clouds)
    for b, e, s in ((-140, 34, 4), (-60, 40, 3.4), (20, 31, 4.4), (100, 38, 3.6), (165, 33, 3.8)):
        for _ in range(6):
            bb, ee, r = b + rng.uniform(-1.5, 1.5) * s, e + rng.uniform(-0.5, 0.5) * s, rng.uniform(0.5, 1.0) * s
            x, y = float(pano.col(bb)), float(pano.row(ee))
            for shift in (-pano.W, 0, pano.W):
                d.ellipse([x + shift - r / 360 * pano.W / math.cos(math.radians(ee)), y - r * 0.55 / 180 * pano.H, x + shift + r / 360 * pano.W / math.cos(math.radians(ee)), y + r * 0.55 / 180 * pano.H], fill=(255, 252, 244, 120))
    pano.composite(clouds, blur=6)

    for bearing, dist, size in ((-75, 14, 1.2), (-20, 22, 1.0), (55, 16, 1.3), (110, 12, 1.1), (160, 18, 1.2), (-140, 11, 1.25)):
        pano.billboard(oak_sprite(rng), bearing, dist, 5.5 * size, 6.5 * size)
    pano.billboard(tortoise_sprite(), 6, 4.4, 0.8, 0.465)
    # Tall grass and reeds all round, close by: Sarra and Lion are peeking through them.
    clumps = [(b + rng.uniform(-8, 8), rng.uniform(1.4, 2.6)) for b in np.arange(-180, 180, 22) if abs(b) > 40]
    for bearing, dist in sorted(clumps, key=lambda s: -s[1]):
        h = rng.uniform(0.9, 1.5)
        pano.billboard(reeds_sprite(rng, h), bearing, dist, 1.3, h)
    for bearing, dist in [(rng.uniform(-180, 180), rng.uniform(1.6, 4)) for _ in range(22)]:
        x, z = dist * math.sin(math.radians(bearing)), -dist * math.cos(math.radians(bearing))
        if brook_distance(np.array([x]), np.array([z]))[0] > 1.3:
            pano.billboard(daisy_sprite(rng), bearing, dist, 0.22, 0.3)
    return pano


def oak_sprite(rng, ppm=90):
    w, h = int(5.5 * ppm), int(6.5 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    trunk = "#7a5b3e"
    d.polygon([(w * 0.46, h), (w * 0.54, h), (w * 0.53, h * 0.45), (w * 0.47, h * 0.45)], fill=rgba(trunk))
    for _ in range(26):
        cx, cy, r = w * rng.uniform(0.18, 0.82), h * rng.uniform(0.12, 0.5), w * rng.uniform(0.1, 0.17)
        shade = rng.choice(["#6f8a4e", "#87a05c", "#5e7843", "#9bb06a"])
        d.ellipse([cx - r, cy - r * 0.9, cx + r, cy + r * 0.9], fill=rgba(shade, 0.92))
    return img.filter(ImageFilter.GaussianBlur(1.2))


def reeds_sprite(rng, height, ppm=500):
    w, h = int(1.3 * ppm), int(height * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    for _ in range(38):
        x0 = w * rng.uniform(0.1, 0.9)
        lean = rng.uniform(-0.25, 0.25) * w
        top = h * rng.uniform(0.0, 0.45)
        colour = rng.choice(["#8f9e5c", "#a7a865", "#6f8a4e", "#c2ad6a"])
        pts = [(x0 + lean * t * t, h - (h - top) * t) for t in np.linspace(0, 1, 12)]
        for i, (p, q) in enumerate(zip(pts[:-1], pts[1:])):
            d.line([p, q], fill=rgba(colour), width=max(2, int(ppm * 0.014 * (1 - i / 12))))
        if rng.uniform() < 0.25:
            x, y = pts[-1]
            d.ellipse([x - ppm * 0.02, y - ppm * 0.07, x + ppm * 0.02, y + ppm * 0.02], fill=rgba("#9c7a4a"))
    return img


def daisy_sprite(rng, ppm=600):
    w, h = int(0.22 * ppm), int(0.3 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy, r = w / 2, h * 0.3, w * 0.2
    d.line([(cx, h), (cx, cy)], fill=rgba("#6f8a4e"), width=max(2, int(ppm * 0.008)))
    petal = rng.choice(["#fbf6ec", "#b9a3d6", "#f2d36b"])
    for a in np.linspace(0, 2 * math.pi, 9)[:-1]:
        px, py = cx + r * math.cos(a), cy + r * math.sin(a)
        d.ellipse([px - r * 0.55, py - r * 0.55, px + r * 0.55, py + r * 0.55], fill=rgba(petal))
    d.ellipse([cx - r * 0.45, cy - r * 0.45, cx + r * 0.45, cy + r * 0.45], fill=rgba("#e3a944"))
    return img


def tortoise_sprite(ppm=700):
    w, h = int(0.55 * ppm), int(0.32 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    ink = rgba("#5a4632")
    lw = max(2, int(ppm * 0.006))
    for lx in (0.28, 0.62):
        d.rounded_rectangle([w * lx, h * 0.62, w * (lx + 0.1), h * 0.98], radius=lw * 2, fill=rgba("#9c9a6a"), outline=ink, width=lw)
    d.ellipse([w * 0.76, h * 0.38, w * 0.98, h * 0.7], fill=rgba("#a9a777"), outline=ink, width=lw)
    d.ellipse([w * 0.9, h * 0.47, w * 0.93, h * 0.53], fill=ink)
    d.chord([w * 0.12, h * 0.05, w * 0.84, h * 1.25], 180, 360, fill=rgba("#9b7a46"), outline=ink, width=lw)
    for cx in (0.3, 0.48, 0.66):
        d.regular_polygon((w * cx, h * 0.42, w * 0.07), 6, fill=rgba("#b8955a"), outline=ink, width=max(1, lw // 2))
    d.line([(w * 0.12, h * 0.65), (w * 0.84, h * 0.65)], fill=ink, width=lw)
    return img


def tuft_sprite(rng, ppm=500, colour=C["green"]):
    """Three ink strokes of grass, 0.3 m wide."""
    w, h = int(0.3 * ppm), int(0.2 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    lw = max(2, int(ppm * 0.008))
    for k, lean in enumerate((-0.18, 0.0, 0.2)):
        x0 = w * (0.3 + 0.2 * k)
        d.line([(x0, h), (x0 + lean * w, h * rng.uniform(0.05, 0.3))], fill=rgba(colour), width=lw)
    return img


def rock_sprite(rng, ppm=400):
    """A grey stone poking out of the ground, 0.6 m wide."""
    w, h = int(0.6 * ppm), int(0.32 * ppm)
    img = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    pts = [(0, h), (w * 0.12, h * 0.35), (w * 0.4, h * 0.05), (w * 0.7, h * 0.18), (w * 0.92, h * 0.55), (w, h)]
    d.polygon(pts, fill=wash_over(C["grey"], 0.55), outline=rgba(C["ink"]), width=max(2, int(ppm * 0.012)))
    return img


def scatter(pano, rng, sprite, n, near, far, width, height, keep=lambda x, z: True):
    spots = []
    while len(spots) < n:
        bearing, dist = rng.uniform(-180, 180), rng.uniform(near, far)
        x, z = dist * math.sin(math.radians(bearing)), -dist * math.cos(math.radians(bearing))
        if keep(x, z):
            spots.append((bearing, dist))
    for bearing, dist in sorted(spots, key=lambda s: -s[1]):
        pano.billboard(sprite, bearing, dist, width, height)


SCENES = {"snowy-peaks": snowy_peaks, "the-river": the_river, "brook-listening": brook_listening}


# ---------- repairing an AI-made panorama ----------

def fix(src: str, out: str):
    """Seam blended away; calm sky overhead and calm ground underfoot instead of a swirl."""
    a = np.asarray(Image.open(src).convert("RGB")).astype(np.float32)
    H, W, _ = a.shape
    # 1. Edges: share each row's difference across 2% of the width on both sides, smoothed down the
    # image so the correction can't streak.
    k = W // 50
    diff = a[:, 0] - a[:, -1]
    kernel = np.ones(5) / 5
    diff = np.stack([np.convolve(diff[:, c], kernel, mode="same") for c in range(3)], -1)
    ramp = (1 - np.arange(k) / k)[None, :, None]
    a[:, :k] -= diff[:, None] / 2 * ramp
    a[:, W - k:] += (diff[:, None] / 2 * ramp)[:, ::-1]
    # 2. Poles: an even colour taken from the image, with soft noise that is the same in every
    # direction. Overhead it's the band's sky (its brightest part: leaves round the edge would make
    # it muddy); underfoot, the band's ground. The ground patch starts just below the edge of a
    # straight-ahead view, so it hides the swirl without blurring what the reader sees ahead.
    rows = (np.arange(H) + 0.5) / H * 180
    elev = 90 - rows
    phi = (np.arange(W) + 0.5) / W * 2 * math.pi
    theta = np.radians(rows)
    caps = (((60, 72), (68, 82), 1, 0.6), ((-50, -40), (-47, -66), -1, 0.0))
    for (lo, hi), (fade0, fade1), sign, brightest in caps:
        band = a[(elev >= min(lo, hi)) & (elev <= max(lo, hi))].reshape(-1, 3)
        if brightest:
            light = band.sum(1)
            band = band[light >= np.quantile(light, brightest)]
        mean, spread = np.median(band, 0), band.std(0)
        w = smoothstep(fade0, fade1, elev) if sign > 0 else smoothstep(-fade0, -fade1, -elev)
        rows_ = np.nonzero(w > 0)[0]
        t_, p_ = np.meshgrid(theta[rows_], phi, indexing="ij")
        dx, dy, dz = -np.sin(p_) * np.sin(t_), np.cos(t_), np.cos(p_) * np.sin(t_)
        n = fbm3(dx * 9, dy * 9, dz * 9, 5 if sign > 0 else 9, 4) - 0.5
        fine = fbm3(dx * 70, dy * 70, dz * 70, 7, 3) - 0.5
        cap = mean + (n[..., None] * 0.9 + fine[..., None] * (0.4 if sign > 0 else 1.2)) * spread
        ww = w[rows_][:, None, None]
        a[rows_] = a[rows_] * (1 - ww) + cap * ww
    Image.fromarray(np.clip(a, 0, 255).astype(np.uint8)).save(out, quality=90)


if __name__ == "__main__":
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "render" and len(sys.argv) == 4 and sys.argv[2] in SCENES:
        SCENES[sys.argv[2]]().finish().save(sys.argv[3], quality=88)
    elif command == "fix" and len(sys.argv) == 4:
        fix(sys.argv[2], sys.argv[3])
    else:
        sys.exit(f"usage: render {{{','.join(SCENES)}}} out.jpg | fix in.jpg out.jpg")
