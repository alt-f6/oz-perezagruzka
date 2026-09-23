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
      {
        // The retired Vercel preview mirror must never be crawled or linked
        // to as a live surface -- send both bots and stray visitors to the
        // canonical production domain. Same host pattern as the noindex
        // header below, so any *.vercel.app preview host is covered, not
        // just the one known mirror hostname.
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
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
              "frame-src 'self' https://www.youtube.com https://player.vimeo.com https://vk.com https://*.vk.com https://vkvideo.ru https://*.vkvideo.ru https://rutube.ru https://*.rutube.ru https://kinescope.io https://*.kinescope.io https://docs.google.com https://drive.google.com https://*.google.com https://miro.com",
            ].join("; "),
          },
        ],
      },
      {
        // Preview/staging deployments on Vercel's default *.vercel.app
        // hostname must never be indexed -- only the production custom
        // domain should show up in search results.
        source: "/:path*",
        has: [{ type: "host", value: ".*\\.vercel\\.app" }],
        headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow, noarchive" }],
      },
    ];
  },
};

export default nextConfig;
