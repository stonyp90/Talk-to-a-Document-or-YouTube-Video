import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ursly — Talk to a Source",
    short_name: "Ursly",
    description: "Explore your documents and videos through conversation.",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    background_color: "#F8F5EF",
    theme_color: "#F8F5EF",
    icons: [192, 512].flatMap((size) =>
      (["any", "maskable"] as const).map((purpose) => ({
        src: `/brand/icon-${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose,
      })),
    ),
  };
}
