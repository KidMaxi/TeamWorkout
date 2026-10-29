import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "TeamWorkout",
    short_name: "TeamWorkout",
    description: "Trainingsload en beschikbaarheid van je team",
    start_url: "/",
    display: "standalone",
    background_color: "#0a1020",
    theme_color: "#0a1020",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
