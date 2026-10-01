import type { MetadataRoute } from "next";

// Lets students "Add to Home Screen" so ARLive opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ARLive",
    short_name: "ARLive",
    description: "Scan your textbook and explore it in 3D.",
    start_url: "/learn",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0b14",
    theme_color: "#5b5bf6",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
