"use client";

import dynamic from "next/dynamic";

// ssr:false requires a client-boundary module, kept separate from
// layout.tsx (a Server Component) so Next.js allows the flag here.
const ConsentBanner = dynamic(
  () => import("./ConsentBanner").then((mod) => mod.ConsentBanner),
  { ssr: false },
);

export default ConsentBanner;
