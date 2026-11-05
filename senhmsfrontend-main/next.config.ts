import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",

  async headers() {
    return [
      {
        // All dashboard pages and API routes — prevent browser caching
        source: "/(dashboard|api)/:path*",
        headers: [
          { key: "Cache-Control",  value: "no-store, no-cache, must-revalidate, proxy-revalidate" },
          { key: "Pragma",         value: "no-cache" },
          { key: "Expires",        value: "0" },
          // Basic security headers
          { key: "X-Frame-Options",           value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options",    value: "nosniff" },
          { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
