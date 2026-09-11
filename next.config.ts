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
          {
            key: "Content-Security-Policy",
            value: [
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "font-src 'self' https://fonts.gstatic.com data:",
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://vk.com https://*.vk.com https://vkvideo.ru https://*.vkvideo.ru https://rutube.ru https://*.rutube.ru https://kinescope.io https://*.kinescope.io",
            ].join("; "),
          },
        ],
      },
    ];
  },
};

export default nextConfig;
