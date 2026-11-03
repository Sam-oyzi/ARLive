// Dev server for testing on a phone, with one command:
//   http://localhost:3000        laptop browser and Claude's preview panel (no certificate warning)
//   https://<wifi-ip>:3443       phones on the same Wi-Fi (camera needs HTTPS; accept the warning once)
// Next.js runs on plain HTTP; a small HTTPS proxy in this process forwards the phone's requests to
// it, adding X-Forwarded-Proto/Host so redirects and cookies use the phone's https:// address.
import { spawn } from "node:child_process";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import path from "node:path";
import { ensureDevCert } from "./dev-cert";

const NEXT_PORT = 3000;
const PHONE_PORT = 3443;

function forwardedHeaders(req: http.IncomingMessage) {
  return {
    ...req.headers,
    "x-forwarded-proto": "https",
    "x-forwarded-host": req.headers.host ?? "",
    "x-forwarded-for": req.socket.remoteAddress ?? "",
  };
}

async function main() {
  const { key, cert, ips } = await ensureDevCert();
  const phoneOrigin = ips[0] ? `https://${ips[0]}:${PHONE_PORT}` : null;

  const nextBin = path.join(process.cwd(), "node_modules", "next", "dist", "bin", "next");
  const next = spawn(process.execPath, [nextBin, "dev", "-H", "0.0.0.0", "-p", String(NEXT_PORT)], {
    stdio: "inherit",
    // Lets the "Continue on your phone" QR code point at the HTTPS address.
    env: { ...process.env, ARLIVE_PHONE_ORIGIN: phoneOrigin ?? "" },
  });
  next.on("exit", (code) => process.exit(code ?? 0));
  for (const signal of ["SIGINT", "SIGTERM"] as const) process.on(signal, () => next.kill(signal));

  const proxy = https.createServer({ key, cert }, (req, res) => {
    const upstream = http.request(
      { host: "127.0.0.1", port: NEXT_PORT, method: req.method, path: req.url, headers: forwardedHeaders(req) },
      (response) => {
        res.writeHead(response.statusCode ?? 502, response.headers);
        response.pipe(res);
      },
    );
    upstream.on("error", () => {
      if (!res.headersSent) res.writeHead(502, { "content-type": "text/plain" });
      res.end("ARLive is still starting. Reload in a few seconds.");
    });
    req.pipe(upstream);
  });

  // WebSockets (hot reload) pass through as a raw byte stream after the forwarded request line.
  proxy.on("upgrade", (req, socket, head) => {
    const upstream = net.connect(NEXT_PORT, "127.0.0.1", () => {
      let request = `${req.method} ${req.url} HTTP/1.1\r\n`;
      for (const [name, value] of Object.entries(forwardedHeaders(req))) {
        for (const v of [value].flat()) if (v !== undefined) request += `${name}: ${v}\r\n`;
      }
      upstream.write(`${request}\r\n`);
      if (head.length) upstream.write(head);
      upstream.pipe(socket);
      socket.pipe(upstream);
    });
    upstream.on("error", () => socket.destroy());
    socket.on("error", () => upstream.destroy());
  });

  proxy.listen(PHONE_PORT, "0.0.0.0", () => {
    console.log("\n  ARLive dev");
    console.log(`  Laptop / Claude panel:  http://localhost:${NEXT_PORT}`);
    if (phoneOrigin) console.log(`  Phone (same Wi-Fi):     ${phoneOrigin}   — accept the certificate warning once`);
    else console.log("  No Wi-Fi address found — connect to a network to test on a phone.");
    console.log("");
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
