import type { Metadata } from "next";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import RegionalHero from "@/landing/components/sections/RegionalHero";
import RegionalBenchmarks from "@/landing/components/sections/RegionalBenchmarks";
import { REGIONS } from "@/landing/data/regions";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";

const region = REGIONS.nizhnevartovsk;

export const metadata: Metadata = {
  title: region.title,
  description: region.description,
  alternates: {
    canonical: "https://perezagruzka-edu.ru/nizhnevartovsk",
  },
  openGraph: {
    title: region.title,
    description: region.description,
    url: "https://perezagruzka-edu.ru/nizhnevartovsk",
  },
  twitter: {
    title: region.title,
    description: region.description,
  },
};

export default function NizhnevartovskPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toSafeJsonLd(buildFaqJsonLd()) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: toSafeJsonLd(
            buildEducationalOrganizationJsonLd({ kind: "areaServed", city: region.cityNominative }),
          ),
        }}
      />
      <ExamLandingContent
        hero={<RegionalHero region={region} />}
        beforeSections={<RegionalBenchmarks region={region} />}
      />
    </>
  );
}
