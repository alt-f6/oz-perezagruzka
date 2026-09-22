import type { Metadata } from "next";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import RegionalHero from "@/landing/components/sections/RegionalHero";
import RegionalBenchmarks from "@/landing/components/sections/RegionalBenchmarks";
import { REGIONS } from "@/landing/data/regions";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";

const region = REGIONS["khanty-mansiysk"];

export const metadata: Metadata = {
  title: region.title,
  description: region.description,
  alternates: {
    canonical: "https://perezagruzka-edu.ru/khanty-mansiysk",
  },
  openGraph: {
    title: region.title,
    description: region.description,
    url: "https://perezagruzka-edu.ru/khanty-mansiysk",
  },
  twitter: {
    title: region.title,
    description: region.description,
  },
};

export default function KhantyMansiyskPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toSafeJsonLd(buildFaqJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLd(buildEducationalOrganizationJsonLd({ kind: "address" })),
        }}
      />
      <ExamLandingContent
        hero={<RegionalHero region={region} />}
        beforeSections={<RegionalBenchmarks region={region} />}
      />
    </>
  );
}
