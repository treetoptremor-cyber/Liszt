import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Liszt — shared lists",
    short_name: "Liszt",
    description:
      "Shared grocery lists, to-dos and notes for families and couples.",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F5F1",
    theme_color: "#F7F5F1",
    icons: [
      { src: "/icon-192", sizes: "192x192", type: "image/png" },
      { src: "/icon-512", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
