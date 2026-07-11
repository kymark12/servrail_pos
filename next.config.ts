import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to this project — a stray lockfile in a parent dir
  // otherwise makes Turbopack infer the wrong root (and watch a huge tree).
  turbopack: {
    root: __dirname,
  },
  // Keep heavy, server-only deps out of the route/server bundles.
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default nextConfig;
