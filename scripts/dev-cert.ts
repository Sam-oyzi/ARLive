// Creates a self-signed HTTPS certificate for the dev server that is valid for localhost AND this
// laptop's Wi-Fi IP, so a phone on the same network can open the camera (browsers require HTTPS).
// Nothing is installed into the system trust store; the phone shows a one-time warning instead.
import fs from "node:fs";
import path from "node:path";
import selfsigned from "selfsigned";
import { lanAddresses } from "../src/lib/network";

const dir = path.join(process.cwd(), "certificates");
const keyFile = path.join(dir, "dev-key.pem");
const certFile = path.join(dir, "dev-cert.pem");
const metaFile = path.join(dir, "dev-cert.json");

async function main() {
  const ips = lanAddresses();
  const wanted = ["127.0.0.1", ...ips].sort().join(",");
  const existing = fs.existsSync(metaFile) ? (JSON.parse(fs.readFileSync(metaFile, "utf8")) as { ips: string; expires: string }) : null;
  if (existing?.ips === wanted && new Date(existing.expires) > new Date() && fs.existsSync(keyFile) && fs.existsSync(certFile)) {
    printUrls(ips);
    return;
  }

  const expires = new Date(Date.now() + 365 * 86_400_000);
  const pems = await selfsigned.generate([{ name: "commonName", value: "ARLive dev" }], {
    keySize: 2048,
    algorithm: "sha256",
    notAfterDate: expires,
    extensions: [
      { name: "basicConstraints", cA: false },
      { name: "keyUsage", digitalSignature: true, keyEncipherment: true },
      { name: "extKeyUsage", serverAuth: true },
      {
        name: "subjectAltName",
        altNames: [{ type: 2 as const, value: "localhost" }, ...wanted.split(",").map((ip) => ({ type: 7 as const, ip }))],
      },
    ],
  });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(keyFile, pems.private);
  fs.writeFileSync(certFile, pems.cert);
  fs.writeFileSync(metaFile, JSON.stringify({ ips: wanted, expires: expires.toISOString() }));
  printUrls(ips);
}

function printUrls(ips: string[]) {
  console.log("\n  ARLive dev over HTTPS");
  console.log("  Laptop:  https://localhost:3000");
  for (const ip of ips) console.log(`  Phone:   https://${ip}:3000   (same Wi-Fi; accept the certificate warning once)`);
  if (ips.length === 0) console.log("  No Wi-Fi address found — connect to a network to test on a phone.");
  console.log("");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
