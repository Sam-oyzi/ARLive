// Compiles target images into a MindAR .mind file in the admin's browser (like MindAR Studio).
import { loadMindAR } from "./ar-session";

/** Larger images compile slowly without tracking better; MindAR works on ~640px camera frames. */
const MAX_SIDE = 1000;

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Couldn't load ${url}`));
    img.src = url;
  });
}

function downscale(img: HTMLImageElement): HTMLCanvasElement {
  const scale = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(img.naturalWidth * scale);
  canvas.height = Math.round(img.naturalHeight * scale);
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  return canvas;
}

export async function compileTargets(imageUrls: string[], onProgress: (percent: number) => void): Promise<Uint8Array> {
  const [{ Compiler }, images] = await Promise.all([loadMindAR(), Promise.all(imageUrls.map(loadImage))]);
  const compiler = new Compiler();
  await compiler.compileImageTargets(images.map(downscale), (p) => onProgress(Math.min(99, p)));
  const data = compiler.exportData();
  onProgress(100);
  return data;
}
