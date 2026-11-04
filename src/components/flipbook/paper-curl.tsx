import { useLayoutEffect, useRef } from "react";

export type PaperPull = { edgeY: number; offsetY: number };

type Vertex = { x: number; y: number; z: number; u: number; v: number; shade: number; edgeX: number; edgeY: number };
type Triangle = { a: Vertex; b: Vertex; c: Vertex; depth: number; facing: number };
type Artwork = { image: HTMLImageElement; surface: HTMLCanvasElement; width: number; height: number; pixelRatio: number };

const COLUMNS = 24;
const ROWS = 14;
const PAPER = "#fbf8f1";
export const PAPER_THICKNESS = 2.2;
export const PAPER_EDGE = "#d5c8ad";
export const STITCH_POSITIONS = [0.24, 0.76];
export const STITCH_THREAD = "M4.5 3C1.7 14 2.4 29 4.5 41";
export const STITCH_HIGHLIGHT = "M4 5C2.5 15 2.8 28 4 39";

function drawStitches(context: CanvasRenderingContext2D, spine: number, top: number, height: number, opacity: number) {
  const scale = Math.min(1, height * 0.09 / 44);
  const thread = new Path2D(STITCH_THREAD);
  const highlight = new Path2D(STITCH_HIGHLIGHT);
  for (const position of STITCH_POSITIONS) {
    context.save();
    context.translate(spine - 4 * scale, top + height * position - 22 * scale);
    context.scale(scale, scale);
    context.fillStyle = "#624b31";
    context.globalAlpha = opacity * 0.48;
    for (const y of [3, 41]) {
      context.beginPath();
      context.ellipse(4.5, y, 1.5, 1.2, 0, 0, Math.PI * 2);
      context.fill();
    }
    context.lineCap = "round";
    context.strokeStyle = "#70583b";
    context.lineWidth = 1.8;
    context.globalAlpha = opacity * 0.65;
    context.stroke(thread);
    context.strokeStyle = "#e1cbaa";
    context.lineWidth = 0.8;
    context.globalAlpha = opacity;
    context.stroke(highlight);
    context.restore();
  }
}

// Distance from the crease that produces the requested pull along its normal.
function foldDistance(travel: number, radius: number) {
  const halfTurn = Math.PI * radius;
  if (travel >= halfTurn) return (travel + halfTurn) / 2;
  let low = 0;
  let high = halfTurn;
  for (let i = 0; i < 12; i++) {
    const mid = (low + high) / 2;
    if (mid - radius * Math.sin(mid / radius) < travel) low = mid;
    else high = mid;
  }
  return (low + high) / 2;
}

function prepareArtwork(image: HTMLImageElement | undefined, width: number, height: number, pixelRatio: number, cached?: Artwork): Artwork | undefined {
  if (!image?.complete || !image.naturalWidth || !image.naturalHeight) return;
  if (cached?.image === image && cached.width === width && cached.height === height && cached.pixelRatio === pixelRatio) return cached;

  // Bake the paper and artwork together. Painting them separately through each
  // antialiased triangle clip leaves paper-colored lines along the mesh edges.
  const surface = document.createElement("canvas");
  surface.width = Math.ceil(width * pixelRatio);
  surface.height = Math.ceil(height * pixelRatio);
  const context = surface.getContext("2d", { alpha: false });
  if (!context) return;
  context.scale(surface.width / width, surface.height / height);
  context.fillStyle = PAPER;
  context.fillRect(0, 0, width, height);

  const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
  const w = image.naturalWidth * scale;
  const h = image.naturalHeight * scale;
  context.drawImage(image, (width - w) / 2, (height - h) / 2, w, h);
  return { image, surface, width, height, pixelRatio };
}

function drawPaper(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  direction: 1 | -1,
  progress: number,
  pull: PaperPull,
  stitchOpacity: number,
  front?: HTMLCanvasElement,
  back?: HTMLCanvasElement,
) {
  const spine = width * 1.5;
  const top = height * 0.5;
  const perspective = Math.max(2000, width * 7);
  const radius = width * 0.12 * Math.sin(progress * Math.PI) ** 0.7;
  const angle = ((pull.edgeY - 0.5) * 0.85 - pull.offsetY / height) * Math.min(1, (1 - progress) * 2.5);
  const normalX = Math.cos(angle);
  const normalY = Math.sin(angle);
  const travel = width * (1.24 * progress + 0.76 * progress ** 3);
  const depth = foldDistance(travel / normalX, radius);
  const grip = width * normalX + pull.edgeY * height * normalY;
  // Keep the crease outside the binding, even when the pull is steeply diagonal.
  const crease = Math.max(0, height * normalY, grip - depth);
  const vertices: Vertex[][] = [];

  // The sheet wraps around one diagonal cylinder. Material ahead of the crease
  // stays flat, and distance along the sheet becomes arc length without stretching.
  for (let row = 0; row <= ROWS; row++) {
    const v = row / ROWS * height;
    const strip: Vertex[] = [];
    for (let column = 0; column <= COLUMNS; column++) {
      const u = column / COLUMNS * width;
      const distance = Math.max(0, u * normalX + v * normalY - crease);
      const arc = distance ? Math.min(Math.PI, distance / Math.max(radius, 1e-6)) : 0;
      const tail = Math.max(0, distance - Math.PI * radius);
      const displacement = radius * Math.sin(arc) - tail - distance;
      const x = u + displacement * normalX;
      const y = v + displacement * normalY;
      const z = radius * (1 - Math.cos(arc));
      const scale = perspective / (perspective - z);
      const shade = (1 - Math.abs(Math.cos(arc))) * 0.38;
      const halfThickness = PAPER_THICKNESS / 2;
      const edgeX = -direction * Math.sin(arc) * normalX * scale * halfThickness;
      const edgeY = -Math.sin(arc) * normalY * scale * halfThickness;
      strip.push({ x: spine + direction * x * scale, y: top + height / 2 + (y - height / 2) * scale, z, u, v, shade, edgeX, edgeY });
    }
    vertices.push(strip);
  }

  const triangles: Triangle[] = [];
  function addTriangle(a: Vertex, b: Vertex, c: Vertex) {
    const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    const paperArea = (b.u - a.u) * (c.v - a.v);
    const facing = direction * area / paperArea;
    if (Math.abs(facing) < 0.001) return;
    triangles.push({ a, b, c, facing, depth: (a.z + b.z + c.z) / 3 });
  }
  for (let row = 0; row < ROWS; row++) {
    const upper = vertices[row]!;
    const lower = vertices[row + 1]!;
    for (let column = 0; column < COLUMNS; column++) {
      addTriangle(upper[column]!, upper[column + 1]!, lower[column]!);
      addTriangle(lower[column + 1]!, lower[column]!, upper[column + 1]!);
    }
  }
  triangles.sort((a, b) => a.depth - b.depth);

  // Project the raised part of the sheet onto the paper below it before painting
  // the leaf itself. A single soft shadow avoids dark seams between triangles.
  if (radius > 1) {
    context.save();
    context.filter = "blur(5px)";
    context.fillStyle = "rgb(48 34 19 / 0.18)";
    context.beginPath();
    for (const { a, b, c, depth, facing } of triangles) {
      if (depth < 2) continue;
      const [second, third] = facing * direction > 0 ? [b, c] : [c, b];
      context.moveTo(a.x + a.z * 0.18, a.y + a.z * 0.22);
      context.lineTo(second.x + second.z * 0.18, second.y + second.z * 0.22);
      context.lineTo(third.x + third.z * 0.18, third.y + third.z * 0.22);
      context.closePath();
    }
    context.fill();
    context.restore();
  }

  let stitchesPainted = stitchOpacity <= 0;
  for (const { a, b, c, facing, depth } of triangles) {
    // Paint the fixed binding over the flat paper, underneath the raised fold.
    if (!stitchesPainted && depth > 2) {
      drawStitches(context, spine, top, height, stitchOpacity);
      stitchesPainted = true;
    }
    const frontFacing = facing > 0;
    const artwork = frontFacing ? front : back;
    const flipTexture = frontFacing !== (direction === 1);
    const ax = flipTexture ? width - a.u : a.u;
    const bx = flipTexture ? width - b.u : b.u;
    const xx = (b.x - a.x) / (bx - ax);
    const xy = (b.y - a.y) / (bx - ax);
    const yx = (c.x - a.x) / (c.v - a.v);
    const yy = (c.y - a.y) / (c.v - a.v);

    context.save();
    context.beginPath();
    const oppositeA = Math.hypot(b.x - c.x, b.y - c.y);
    const oppositeB = Math.hypot(a.x - c.x, a.y - c.y);
    const oppositeC = Math.hypot(a.x - b.x, a.y - b.y);
    const perimeter = oppositeA + oppositeB + oppositeC;
    const centerX = (a.x * oppositeA + b.x * oppositeB + c.x * oppositeC) / perimeter;
    const centerY = (a.y * oppositeA + b.y * oppositeB + c.y * oppositeC) / perimeter;
    // Expand equally across each edge, including on the skinny triangles at the fold.
    const inradius = Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / perimeter;
    const overlap = Math.min(0.5, 1.15 / inradius);
    for (const point of [a, b, c]) {
      context.lineTo(point.x + (point.x - centerX) * overlap, point.y + (point.y - centerY) * overlap);
    }
    context.closePath();
    context.clip();
    context.transform(xx, xy, yx, yy, a.x - xx * ax - yx * a.v, a.y - xy * ax - yy * a.v);
    if (artwork) {
      context.drawImage(artwork, 0, 0, width, height);
    } else {
      context.fillStyle = PAPER;
      context.fillRect(0, 0, width, height);
    }
    // Interpolate lighting from the corners of each triangle. Shared vertices
    // have the same shade, so the curl reads as one sheet under the light.
    const shadeX = (b.shade - a.shade) / (bx - ax);
    const shadeY = (c.shade - a.shade) / (c.v - a.v);
    const gradientLength = shadeX ** 2 + shadeY ** 2;
    if (gradientLength > 1e-10) {
      const lightest = Math.min(a.shade, b.shade, c.shade);
      const darkest = Math.max(a.shade, b.shade, c.shade);
      const min = (lightest - a.shade) / gradientLength;
      const max = (darkest - a.shade) / gradientLength;
      const gradient = context.createLinearGradient(ax + shadeX * min, a.v + shadeY * min, ax + shadeX * max, a.v + shadeY * max);
      gradient.addColorStop(0, `rgb(40 28 16 / ${lightest})`);
      gradient.addColorStop(1, `rgb(40 28 16 / ${darkest})`);
      context.fillStyle = gradient;
    } else {
      context.fillStyle = `rgb(40 28 16 / ${a.shade})`;
    }
    context.fillRect(0, 0, width, height);
    context.restore();

    // Draw the exposed cross-section in the same depth order as its face.
    for (const [start, end] of [[a, b], [b, c], [c, a]] as const) {
      if (!(start.u === width && end.u === width) && !(start.v === end.v && (start.v === 0 || start.v === height))) continue;
      context.fillStyle = PAPER_EDGE;
      context.beginPath();
      context.moveTo(start.x + start.edgeX, start.y + start.edgeY);
      context.lineTo(end.x + end.edgeX, end.y + end.edgeY);
      context.lineTo(end.x - end.edgeX, end.y - end.edgeY);
      context.lineTo(start.x - start.edgeX, start.y - start.edgeY);
      context.closePath();
      context.fill();
    }
  }
  if (!stitchesPainted) drawStitches(context, spine, top, height, stitchOpacity);
}

export function PaperCurl({ width, height, direction, progress, pull, stitchOpacity, front, back }: {
  width: number;
  height: number;
  direction: 1 | -1;
  progress: number;
  pull: PaperPull;
  stitchOpacity: number;
  front?: HTMLImageElement;
  back?: HTMLImageElement;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const artwork = useRef<{ front?: Artwork; back?: Artwork }>({});

  useLayoutEffect(() => {
    const element = canvas.current;
    const context = element?.getContext("2d");
    if (!element || !context) return;
    const scale = Math.min(window.devicePixelRatio, 2);
    const pixelWidth = Math.ceil(width * 3 * scale);
    const pixelHeight = Math.ceil(height * 2 * scale);
    if (element.width !== pixelWidth) element.width = pixelWidth;
    if (element.height !== pixelHeight) element.height = pixelHeight;

    function paint() {
      if (!context) return;
      const cache = artwork.current;
      cache.front = prepareArtwork(front, width, height, scale, cache.front);
      cache.back = prepareArtwork(back, width, height, scale, cache.back);
      context.setTransform(scale, 0, 0, scale, 0, 0);
      context.clearRect(0, 0, width * 3, height * 2);
      drawPaper(context, width, height, direction, progress, pull, stitchOpacity, cache.front?.surface, cache.back?.surface);
    }
    paint();
    front?.addEventListener("load", paint);
    back?.addEventListener("load", paint);
    return () => {
      front?.removeEventListener("load", paint);
      back?.removeEventListener("load", paint);
    };
  }, [width, height, direction, progress, pull, stitchOpacity, front, back]);

  return <canvas ref={canvas} aria-hidden="true" className="pointer-events-none absolute" style={{ left: -width / 2, top: -height / 2, width: width * 3, height: height * 2 }} />;
}
