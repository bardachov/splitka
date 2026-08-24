import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Splitka — ділимо витрати разом",
    short_name: "Splitka",
    description:
      "Спрощений Splitwise: створіть групу, поділіться лінком з друзями і ведіть спільні витрати без реєстрації.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f6f5",
    theme_color: "#14a085",
    lang: "uk",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
