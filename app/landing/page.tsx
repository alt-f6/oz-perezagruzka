import dynamic from "next/dynamic";
import type { Metadata } from "next";
import Header from "@/landing/components/sections/Header";
import ExamToggle from "@/landing/components/ui/ExamToggle";
import Hero from "@/landing/components/sections/Hero";
import PainPoints from "@/landing/components/sections/PainPoints";
import WhatYouGet from "@/landing/components/sections/WhatYouGet";
import AttestatPredictable from "@/landing/components/sections/AttestatPredictable";
import StudyingAlone from "@/landing/components/sections/StudyingAlone";
import Solution from "@/landing/components/sections/Solution";
import PreparationComposition from "@/landing/components/sections/PreparationComposition";
import HowItWorks from "@/landing/components/sections/HowItWorks";
import StudentCarousel from "@/landing/components/sections/StudentCarousel";
import YandexReviews from "@/landing/components/sections/YandexReviews";
import PreQuestions from "@/landing/components/sections/PreQuestions";
import Pricing from "@/landing/components/sections/Pricing";
import Guarantee from "@/landing/components/sections/Guarantee";
import FAQ from "@/landing/components/sections/FAQ";
import { FAQ_ITEMS } from "@/landing/data/faq";
import FinalCTA from "@/landing/components/sections/FinalCTA";
import Footer from "@/landing/components/sections/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://perezagruzka-edu.ru";

const EXAM_METADATA = {
  oge: {
    title: "Перезагрузка — Подготовка к ОГЭ с живым учителем и ИИ-репетитором",
    description:
      "Онлайн-школа для подростков 7–9 класса: мини-группы до 8 человек, живой учитель и ИИ-репетитор на связи 24/7. Бесплатная диагностика перед стартом.",
  },
  ege: {
    title: "Перезагрузка — Подготовка к ЕГЭ с живым учителем и ИИ-репетитором",
    description:
      "Онлайн-школа для старшеклассников 10–11 класса: мини-группы до 8 человек, живой учитель и ИИ-репетитор на связи 24/7. Бесплатная диагностика перед стартом.",
  },
} as const;

type LandingSearchParams = Promise<{ exam?: string | string[] }>;

export async function generateMetadata({
  searchParams,
}: {
  searchParams: LandingSearchParams;
}): Promise<Metadata> {
  const params = await searchParams;
  const examParam = Array.isArray(params.exam) ? params.exam[0] : params.exam;
  const exam = examParam === "ege" ? "ege" : "oge";
  const { title, description } = EXAM_METADATA[exam];
  const canonicalUrl = exam === "ege" ? `${siteUrl}/?exam=ege` : siteUrl;

  return {
    title,
    description,
    alternates: {
      canonical: canonicalUrl,
    },
    openGraph: {
      title,
      description,
      url: canonicalUrl,
    },
    twitter: {
      title,
      description,
    },
  };
}

// Built from the same FAQ_ITEMS the FAQ section renders, so the schema can
// never drift out of sync with what's actually on the page.
function faqJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: Array.isArray(item.answer) ? item.answer.join(" ") : item.answer,
      },
    })),
  };
}

const ReadinessMapWizard = dynamic(
  () => import("@/landing/components/sections/ReadinessMap/ReadinessMapWizard"),
  {
    // id + scroll-mt-20 match the real section (ReadinessMapWizard.tsx) so a
    // direct link to #readiness-map has a scroll target immediately, even
    // before the code-split chunk resolves.
    loading: () => (
      <div id="readiness-map" className="scroll-mt-20 p-8 text-center text-ink-400">
        Загрузка...
      </div>
    ),
  },
);

export default function Home() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(faqJsonLd()).replace(/</g, "\\u003c"),
        }}
      />
      <Header />
      <ExamToggle />
      <main
        id="top"
        className="relative min-h-screen overflow-hidden bg-[#F8F9FB] text-foreground selection:bg-brand-200"
      >
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#0000000d_1px,transparent_1px),linear-gradient(to_bottom,#0000000d_1px,transparent_1px)] bg-[size:32px_32px]" />
        </div>

        <Hero />
        <PainPoints />
        <WhatYouGet />
        <AttestatPredictable />
        <StudyingAlone />
        <Solution />
        <PreparationComposition />
        <HowItWorks />
        <ReadinessMapWizard />
        <StudentCarousel />
        <YandexReviews />
        <PreQuestions />
        <Pricing />
        <Guarantee />
        <FAQ />
        <FinalCTA />
        <Footer />
      </main>
    </>
  );
}