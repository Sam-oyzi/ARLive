import type { MetadataRoute } from "next";

// Lets families add PageWakes to their home screen.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "PageWakes",
    short_name: "PageWakes",
    description: "Free illustrated stories for kids. Read on any screen, print at home and scan the pages to see them in 3D.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7ef",
    theme_color: "#123b37",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/brand/pagewakes-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/pagewakes-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
