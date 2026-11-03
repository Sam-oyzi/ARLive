// Extruded 3D text built from the app's own font (Plus Jakarta Sans ExtraBold).
// Glyphs are placed one by one (advance + kerning) instead of using opentype.js's text shaping,
// which fails on this font's ligature tables; Latin text, accents included, renders fine.
import * as THREE from "three";
import type { Font } from "opentype.js";

const FONT_URL = "/vendor/fonts/plus-jakarta-sans-800.woff";
/** Font size in content units: at scale 1, capitals are ~8% of the page width. */
const SIZE = 0.12;
const LINE_HEIGHT = 1.2;

let fontPromise: Promise<Font> | null = null;

export function loadFont(): Promise<Font> {
  fontPromise ??= Promise.all([import("opentype.js"), fetch(FONT_URL).then((r) => r.arrayBuffer())]).then(([mod, buffer]) =>
    (mod.default ?? mod).parse(buffer),
  );
  fontPromise.catch(() => (fontPromise = null)); // allow a retry after a network error
  return fontPromise;
}

function lineShapes(font: Font, line: string, baseline: number): THREE.Shape[] {
  const scale = SIZE / font.unitsPerEm;
  const glyphs = Array.from(line, (ch) => font.charToGlyph(ch));
  // Measure first so each line can be centred.
  let width = 0;
  glyphs.forEach((glyph, i) => {
    if (i > 0) width += font.getKerningValue(glyphs[i - 1]!, glyph) * scale;
    width += (glyph.advanceWidth ?? 0) * scale;
  });

  const shapes: THREE.Shape[] = [];
  let x = -width / 2;
  glyphs.forEach((glyph, i) => {
    if (i > 0) x += font.getKerningValue(glyphs[i - 1]!, glyph) * scale;
    // opentype paths are y-down; flip to three's y-up. toShapes() finds the holes (the inside of
    // "o", "A"…) with the nonzero fill rule, so contour direction doesn't matter.
    const path = new THREE.ShapePath();
    for (const c of glyph.getPath(x, baseline, SIZE).commands) {
      if (c.type === "M") path.moveTo(c.x, -c.y);
      else if (c.type === "L") path.lineTo(c.x, -c.y);
      else if (c.type === "Q") path.quadraticCurveTo(c.x1, -c.y1, c.x, -c.y);
      else if (c.type === "C") path.bezierCurveTo(c.x1, -c.y1, c.x2, -c.y2, c.x, -c.y);
    }
    shapes.push(...path.toShapes());
    x += (glyph.advanceWidth ?? 0) * scale;
  });
  return shapes;
}

/** Geometry centred on X/Z and standing on y = 0. Group 0 = faces, group 1 = sides. */
export async function createTextGeometry(text: string): Promise<THREE.BufferGeometry> {
  const font = await loadFont();
  const lines = (text.trim() || " ").split("\n");
  const shapes = lines.flatMap((line, row) => lineShapes(font, line, row * SIZE * LINE_HEIGHT));
  const geometry = new THREE.ExtrudeGeometry(shapes, {
    depth: SIZE * 0.28,
    curveSegments: 8,
    bevelEnabled: true,
    bevelThickness: SIZE * 0.04,
    bevelSize: SIZE * 0.025,
    bevelSegments: 3,
  });
  geometry.computeBoundingBox();
  const box = geometry.boundingBox!;
  geometry.translate(-(box.min.x + box.max.x) / 2, -box.min.y, -(box.min.z + box.max.z) / 2);
  geometry.computeBoundingBox();
  return geometry;
}
