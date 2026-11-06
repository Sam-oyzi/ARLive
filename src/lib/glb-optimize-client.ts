import { WebIO, type Document } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, instance, join, meshopt, prune, simplify, textureCompress, weld } from "@gltf-transform/functions";
import { MeshoptDecoder, MeshoptEncoder, MeshoptSimplifier } from "meshoptimizer";

function stats(doc: Document, bytes: number) {
  let triangles = 0;
  for (const mesh of doc.getRoot().listMeshes()) for (const primitive of mesh.listPrimitives()) {
    if (primitive.getMode() === 4) triangles += (primitive.getIndices()?.getCount() ?? primitive.getAttribute("POSITION")?.getCount() ?? 0) / 3;
  }
  return { bytes, triangles: Math.round(triangles) };
}

/** Uses browser image codecs and WebAssembly; no native server libraries are required. */
export async function optimizeModelForUpload(file: Blob): Promise<{ file: Blob; summary: string } | null> {
  await Promise.all([MeshoptDecoder.ready, MeshoptEncoder.ready, MeshoptSimplifier.ready]);
  const io = new WebIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    "meshopt.decoder": MeshoptDecoder, "meshopt.encoder": MeshoptEncoder,
  });
  const doc = await io.readBinary(new Uint8Array(await file.arrayBuffer()));
  const before = stats(doc, file.size);
  const ratio = Math.min(1, 80_000 / Math.max(1, before.triangles));
  await doc.transform(dedup(), instance(), join(), weld(),
    ...(ratio < 1 ? [simplify({ simplifier: MeshoptSimplifier, ratio, error: 0.01 })] : []),
    textureCompress({ targetFormat: "webp", resize: [1024, 1024] }), prune(),
    meshopt({ encoder: MeshoptEncoder, level: "medium" }),
  );
  const glb = await io.writeBinary(doc);
  if (glb.byteLength >= before.bytes) return null;
  const after = stats(doc, glb.byteLength);
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(1)} MB`;
  return { file: new Blob([new Uint8Array(glb)], { type: "model/gltf-binary" }),
    summary: `${mb(before.bytes)} → ${mb(after.bytes)} · ${before.triangles.toLocaleString()} → ${after.triangles.toLocaleString()} triangles` };
}
