import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  experimental: {
    // Import only the icons that are used instead of the whole icon set.
    optimizePackageImports: ["lucide-react"],
  },
  async headers() {
    return [
      // The service worker must be re-checked on every visit so a new version rolls out promptly.
      { source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, max-age=0" }] },
      // App icons rarely change: let phones keep them instead of revalidating on every launch.
      { source: "/icons/:path*", headers: [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }] },
    ];
  },
};

export default nextConfig;
