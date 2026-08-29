import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  output: "standalone",
  allowedDevOrigins: [
    "wrought-bullhorn-debunk.ngrok-free.dev",
  ],
  images: {
    remotePatterns: [],
    deviceSizes: [640, 750, 828, 1080, 1200, 1600, 1920],
  },
  turbopack: {
    resolveAlias: {
      "tw-animate-css": "./node_modules/tw-animate-css/dist/tw-animate.css",
    },
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
