// Makes uploaded GLB models phone-friendly. AI generators (Hunyuan3D, Meshy, Tripo…) export
// million-triangle meshes with 4K PNG textures — 50–100 MB that a phone can't download or hold in
// memory. This keeps the look and cuts the weight:
//   1. dedup / instance / join / prune   remove duplicate and unused data
//   2. weld + simplify                   reduce to about MAX_TRIANGLES (meshoptimizer)
//   3. textureCompress                   textures down to MAX_TEXTURE px, re-encoded as WebP
//   4. meshopt                           quantize and compress the geometry
// The viewer decodes meshopt and WebP natively (src/ar/content-objects.ts).
import { NodeIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, instance, join, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";
import sharp from "sharp";

const MAX_TRIANGLES = 80_000;
const MAX_TEXTURE = 1024;

export type GlbStats = { bytes: number; triangles: number; textures: number; maxTextureSize: number };
export type GlbOptimizeResult = { glb: Uint8Array; before: GlbStats; after: GlbStats };

let io: Promise<NodeIO> | null = null;
function getIO() {
  io ??= Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]).then(() =>
    new NodeIO()
      .registerExtensions(ALL_EXTENSIONS)
      .registerDependencies({ "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder }),
  );
  return io;
}

function triangles(doc: Document) {
  let count = 0;
  for (const mesh of doc.getRoot().listMeshes()) {
    for (const prim of mesh.listPrimitives()) {
      if (prim.getMode() !== 4) continue; // TRIANGLES only
      const indices = prim.getIndices();
      count += (indices ? indices.getCount() : (prim.getAttribute("POSITION")?.getCount() ?? 0)) / 3;
    }
  }
  return Math.round(count);
}

function stats(doc: Document, bytes: number): GlbStats {
  const textures = doc.getRoot().listTextures();
  const maxTextureSize = Math.max(0, ...textures.map((t) => Math.max(...(t.getSize() ?? [0, 0]))));
  return { bytes, triangles: triangles(doc), textures: textures.length, maxTextureSize };
}

export async function optimizeGlb(input: Uint8Array): Promise<GlbOptimizeResult> {
  const nodeIO = await getIO();
  const doc = await nodeIO.readBinary(input);
  const before = stats(doc, input.byteLength);

  const ratio = Math.min(1, MAX_TRIANGLES / Math.max(1, before.triangles));
  await doc.transform(
    dedup(),
    instance(),
    join(),
    weld(),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 })] : []),
    textureCompress({ encoder: sharp, targetFormat: "webp", resize: [MAX_TEXTURE, MAX_TEXTURE], quality: 82 }),
    prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );

  const glb = await nodeIO.writeBinary(doc);
  return { glb, before, after: stats(doc, glb.byteLength) };
}

export function describeOptimization({ before, after }: Pick<GlbOptimizeResult, "before" | "after">) {
  const mb = (b: number) => `${(b / 1024 / 1024).toFixed(1)} MB`;
  const k = (n: number) => (n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`);
  const parts = [`${mb(before.bytes)} → ${mb(after.bytes)}`];
  if (after.triangles < before.triangles) parts.push(`${k(before.triangles)} → ${k(after.triangles)} triangles`);
  if (after.maxTextureSize < before.maxTextureSize) parts.push(`textures ${before.maxTextureSize} → ${after.maxTextureSize}px`);
  return parts.join(" · ");
}
