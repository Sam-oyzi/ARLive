// Optimise a GLB by hand, with the same pipeline as uploads (src/lib/glb-optimize.ts).
// Usage: npm run optimize:glb -- <input.glb> [output.glb]   (default output: <input>.optimized.glb)
import fs from "node:fs";
import { describeOptimization, optimizeGlb } from "../src/lib/glb-optimize";

async function main() {
  const [input, output = input?.replace(/\.glb$/i, "") + ".optimized.glb"] = process.argv.slice(2);
  if (!input) {
    console.error("Usage: npm run optimize:glb -- <input.glb> [output.glb]");
    process.exit(1);
  }
  const started = Date.now();
  const result = await optimizeGlb(fs.readFileSync(input));
  fs.writeFileSync(output, result.glb);
  console.log(`${describeOptimization(result)}  (${((Date.now() - started) / 1000).toFixed(1)}s)`);
  console.log(`Saved ${output}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
