import type { MetadataRoute } from "next";

// Web app manifest, so the till installs as a full-screen home-screen app rather
// than a browser tab. Note iOS/iPadOS only honours part of this: `display` and the
// icons are respected, but `start_url` is NOT — Safari uses whatever page was open
// when "Add to Home Screen" was tapped. Install from /pos to land on the till.
// Requires a secure context (HTTPS) — see docs/RUN_LOCAL_DEMO.md.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "ServRail POS",
    short_name: "ServRail",
    description: "Touch-first point of sale for ServRail businesses",
    start_url: "/pos",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
