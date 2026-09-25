"use client";

import { reachGoal } from "@/landing/lib/analytics";
import type { RegionContent } from "@/landing/data/regions";
import { TRIAL_LESSON_CTA } from "@/landing/lib/exam-content";

export default function RegionalHero({ region }: { region: RegionContent }) {
  return (
    <section className="relative overflow-hidden bg-transparent px-6 pt-16 pb-20 text-ink-900 md:py-24">
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h1 className="font-extrabold text-ink-900 text-balance tracking-tight">{region.heroHeadline}</h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-relaxed text-ink-700 md:text-xl">
          {region.heroSubcopy}
        </p>
        {region.hasOffice && region.officeAddress && (
          <p className="mx-auto mt-4 max-w-xl rounded-2xl border border-brand-200/80 bg-white/90 px-5 py-3 text-sm font-semibold text-brand-700">
            📍 {region.officeAddress}
          </p>
        )}
        <div className="mt-8 flex justify-center">
          <a
            href="#readiness-map"
            onClick={() => reachGoal("cta_analysis_click")}
            className="inline-flex min-h-[70px] items-center justify-center rounded-xl bg-brand-600 px-8 py-4 text-center text-xl font-bold text-white shadow-lg shadow-brand-600/25 transition-all hover:bg-brand-700 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 md:text-2xl"
          >
            {TRIAL_LESSON_CTA}
          </a>
        </div>
      </div>
    </section>
  );
}
