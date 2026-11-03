import type { MetadataRoute } from "next";

// Lets families "Add to Home Screen" so Sketchling opens full-screen like an app.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Sketchling",
    short_name: "Sketchling",
    description: "Free illustrated stories for kids. Read on any screen, print at home and scan the pages to see them in 3D.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fbf7ef",
    theme_color: "#f26a1a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
