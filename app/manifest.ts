import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/", name: "Outlast 51 Fantasy League", short_name: "Outlast 51",
    description: "Your family-and-friends Survivor fantasy league.",
    start_url: "/play", scope: "/", display: "standalone",
    background_color: "#f6f0df", theme_color: "#102a1c",
    icons: [
      { src: "/icons/outlast-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/outlast-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/outlast-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
