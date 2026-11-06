import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  accountId: "47069793742c567508681d91efc8d738",
  worker: defineWorker({
    name: "pagewakes",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-06",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["pagewakes.com", "www.pagewakes.com"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DB: bindings.d1({ name: "pagewakes-db", id: "a7199e97-e0f4-4c1b-894d-074bb7650290" }),
      MEDIA: bindings.r2({ name: "pagewakes-media" }),
      SESSION_SECRET: bindings.secret(),
      SITE_URL: { type: "text", value: "https://pagewakes.com" },
      R2_BUCKET: { type: "text", value: "pagewakes-media" },
      DATABASE_URL: { type: "text", value: "file:unused-worker.db" },
    },
  }),
});
