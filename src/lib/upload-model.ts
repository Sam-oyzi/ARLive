import fsp from "node:fs/promises";
import { describeOptimization, optimizeGlb } from "./glb-optimize";

/** Shrink a just-uploaded GLB in place. Keeps the original if optimising fails or doesn't help. */
export async function optimizeModel(file: string) {
  const optimized = `${file}.optimized`;
  try {
    const result = await optimizeGlb(await fsp.readFile(file));
    if (result.after.bytes >= result.before.bytes) return { optimized: null };
    await fsp.writeFile(optimized, result.glb);
    await fsp.rename(optimized, file);
    return { optimized: { before: result.before, after: result.after, summary: describeOptimization(result) } };
  } catch (error) {
    console.error("GLB optimisation failed, keeping the original:", error);
    return { optimized: null, optimizeError: "This model couldn't be optimised, so the original file is used." };
  } finally {
    await fsp.rm(optimized, { force: true });
  }
}
