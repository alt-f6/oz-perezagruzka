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
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.perezagruzka-edu.ru" }],
        destination: "https://perezagruzka-edu.ru/:path*",
        permanent: true,
      },
    ];
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
      {
        // Preview/staging deployments on Vercel's default *.vercel.app
        // hostname must never be indexed -- only the production custom
        // domain should show up in search results.
        source: "/:path*",
        has: [{ type: "host", value: ".*vercel.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
