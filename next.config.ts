import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Phones on the same Wi-Fi reach the dev server by LAN IP or through a tunnel.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "*.ngrok-free.app", "*.trycloudflare.com"],
  images: { unoptimized: true },
};

export default nextConfig;
