import { spawn } from "node:child_process";
import { cloudflareCredentials } from "./cloudflare-api.mjs";
const [tool, ...args] = process.argv.slice(2);
const binaries = { cf: "node_modules/cf/bin/cf", deploy: "node_modules/@vinext/cloudflare/dist/cli.js", wrangler: "node_modules/wrangler/bin/wrangler.js" };
if (!binaries[tool]) throw new Error("Choose cf, deploy or wrangler.");
const child = spawn(process.execPath, [binaries[tool], ...args], {
  stdio: "inherit", env: { ...process.env, ...cloudflareCredentials },
});
child.on("exit", (code) => { process.exitCode = code ?? 1; });
