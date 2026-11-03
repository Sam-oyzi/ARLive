import type { NextConfig } from "next";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // The scanner needs the camera; nothing here needs the microphone or location.
  { key: "Permissions-Policy", value: "camera=(self), microphone=(), geolocation=(), payment=(), usb=()" },
  // No script-src yet: MindAR's TensorFlow.js bundle has to be audited before scripts can be locked down.
  { key: "Content-Security-Policy", value: "base-uri 'self'; form-action 'self'; frame-ancestors 'none'; object-src 'none'" },
  ...(process.env.NODE_ENV === "production" ? [{ key: "Strict-Transport-Security", value: "max-age=31536000" }] : []),
];

const nextConfig: NextConfig = {
  // Phones on the same Wi-Fi reach the dev server by LAN IP or through a tunnel.
  allowedDevOrigins: ["192.168.*.*", "10.*.*.*", "172.*.*.*", "*.ngrok-free.app", "*.trycloudflare.com"],
  poweredByHeader: false,
  images: {
    // Only uploads can be resized, and SVG stays blocked (Next's default) because logos can be SVG.
    localPatterns: [{ pathname: "/files/**", search: "" }],
    qualities: [75],
  },
  async headers() {
    // /files sets its own stricter policy (src/app/files/[...path]/route.ts).
    return [{ source: "/((?!files/).*)", headers: securityHeaders }];
  },
};

export default nextConfig;
