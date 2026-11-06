import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { fileURLToPath } from "node:url";

// Disable the shared image optimizer for media guarded by per-book access checks.
process.env.R2_BUCKET = "pagewakes-media";

export default defineConfig({
  resolve: {
    alias: [
      { find: "@/lib/database-runtime", replacement: fileURLToPath(new URL("./cloudflare/database-runtime.ts", import.meta.url)) },
      { find: "@/lib/storage", replacement: fileURLToPath(new URL("./cloudflare/storage.ts", import.meta.url)) },
      { find: "@/lib/upload-model", replacement: fileURLToPath(new URL("./cloudflare/upload-model.ts", import.meta.url)) },
      { find: "@/lib/upload-multipart", replacement: fileURLToPath(new URL("./cloudflare/upload-multipart.ts", import.meta.url)) },
    ],
  },
  plugins: [
    vinext(),
    cloudflare({
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
