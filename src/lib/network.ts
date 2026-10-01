import os from "node:os";

/** Private IPv4 addresses of this machine, best guess for "the Wi-Fi address" first. */
export function lanAddresses(): string[] {
  const found: string[] = [];
  for (const [name, addresses] of Object.entries(os.networkInterfaces())) {
    // Skip virtual adapters (WSL, Docker, VirtualBox, VPNs) that phones can't reach.
    if (/vethernet|wsl|docker|vbox|virtualbox|vmware|hyper-v|loopback|tailscale|zerotier/i.test(name)) continue;
    for (const address of addresses ?? []) {
      if (address.family === "IPv4" && !address.internal) found.push(address.address);
    }
  }
  const rank = (ip: string) => (ip.startsWith("192.168.") ? 0 : ip.startsWith("10.") ? 1 : /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ? 2 : 3);
  return found.sort((a, b) => rank(a) - rank(b));
}
