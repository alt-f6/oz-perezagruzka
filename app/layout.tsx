import type { Metadata } from "next";

// This is the only place <html>/<body> may appear. Nested layouts in
// (landing), (crm), (lms) are pure structural wrappers (fragment or div);
// putting <html>/<body> in more than one layout causes React hydration errors.
//
// Each route group imports its own globals.css from its own layout
// (app/crm/layout.tsx, app/lms/layout.tsx, app/landing/layout.tsx), so
// Next.js only ships that app's CSS to its own routes. This used to be a
// single shared import here, which caused a real bug: an unlayered rule in
// one app's globals.css (e.g. lms's plain `.card{max-width:420px}`) silently
// beat another app's `@layer components` rules of the same class name on
// every route, regardless of which app was actually rendering. Token values
// can still collide in meaning across apps, which is a separate, still-open
// question; this fix only addresses the cross-app CSS leakage.

export const metadata: Metadata = {
  title: "Перезагрузка",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/icon.svg", type: "image/svg+xml" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" suppressHydrationWarning>
      <body>{children}</body>
    </html>
  );
}
