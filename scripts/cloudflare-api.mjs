// Local deployment tooling only. The OAuth token is never bundled or printed.
import { readFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const configRoot = process.env.APPDATA ? path.join(process.env.APPDATA, "xdg.config") : process.env.XDG_CONFIG_HOME ?? path.join(os.homedir(), ".config");
const configPath = path.join(configRoot, ".wrangler/config/default.toml");
let config = process.env.CLOUDFLARE_API_TOKEN ? "" : await readFile(configPath, "utf8");
const expiry = config.match(/^expiration_time\s*=\s*"([^"]+)"/m)?.[1];
if (expiry && Date.parse(expiry) <= Date.now() + 60_000) {
  // Wrangler owns its refresh token. A read-only command renews OAuth without exposing credentials.
  const refresh = spawnSync(process.execPath, [
    fileURLToPath(new URL("../node_modules/wrangler/bin/wrangler.js", import.meta.url)),
    "deployments", "list", "--name", "pagewakes", "--config",
    fileURLToPath(new URL("../cloudflare/wrangler.jsonc", import.meta.url)),
  ], { stdio: "ignore", env: { ...process.env, CI: "true" } });
  if (refresh.status !== 0) throw new Error("Cloudflare login could not be refreshed. Run npx wrangler login.");
  config = await readFile(configPath, "utf8");
}
const token = process.env.CLOUDFLARE_API_TOKEN ?? config.match(/^oauth_token\s*=\s*"([^"]+)"/m)?.[1];
if (!token) throw new Error("Run npx wrangler login before continuing.");
export const accountId = "47069793742c567508681d91efc8d738";
export const cloudflareCredentials = { CLOUDFLARE_API_TOKEN: token, CLOUDFLARE_ACCOUNT_ID: accountId };
export async function cloudflareApi(resource, options = {}) {
  const headers = new Headers(options.headers);
  headers.set("Authorization", `Bearer ${token}`);
  const response = await fetch(`https://api.cloudflare.com/client/v4${resource}`, { ...options, headers });
  if (!response.ok && response.status !== 404) {
    throw new Error(`Cloudflare API returned ${response.status} for ${options.method ?? "GET"} ${resource.split("?")[0]}`);
  }
  return response;
}
