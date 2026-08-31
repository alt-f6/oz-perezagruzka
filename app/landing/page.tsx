import dynamic from "next/dynamic";
import type { Metadata } from "next";
import Header from "@/landing/components/sections/Header";
import ExamToggle from "@/landing/components/ui/ExamToggle";
import Hero from "@/landing/components/sections/Hero";
import Solution from "@/landing/components/sections/Solution";
import StudentCarousel from "@/landing/components/sections/StudentCarousel";
import YandexReviews from "@/landing/components/sections/YandexReviews";
import Pricing from "@/landing/components/sections/Pricing";
import FAQ from "@/landing/components/sections/FAQ";
import { FAQ_ITEMS } from "@/landing/data/faq";
import FinalCTA from "@/landing/components/sections/FinalCTA";
import Footer from "@/landing/components/sections/Footer";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://perezagruzka-edu.ru";

const EXAM_METADATA = {
  oge: {
    title: "Перезагрузка: Подготовка к ОГЭ с живым учителем и ИИ-репетитором",
    description:
      "Онлайн-школа для подростков 7–9 класса: мини-группы, живой учитель и ИИ-репетитор на связи 24/7. Бесплатный разбор перед стартом.",
  },
  ege: {
    title: "Перезагрузка: Подготовка к ЕГЭ с живым учителем и ИИ-репетитором",
    description:
      "Онлайн-школа для старшеклассников 10–11 класса: мини-группы, живой учитель и ИИ-репетитор на связи 24/7. Бесплатный разбор перед стартом.",
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
        className="relative min-h-screen overflow-hidden bg-[#F4F9FD] text-foreground selection:bg-brand-200"
      >
        {/* Живые размытые переливы цветов бренда по всей высоте страницы */}
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          {/* Свечение Hero / верх страницы (Sky + Electric) */}
          <div className="absolute -top-24 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#BEE0F5]/70 via-[#0055FF]/10 to-transparent blur-[120px]" />
          
          {/* Акцентное свечение середины (Pink + Neon) */}
          <div className="absolute top-[30%] -left-32 h-[550px] w-[550px] rounded-full bg-[#FF6EB4]/10 blur-[140px]" />
          <div className="absolute top-[48%] -right-32 h-[600px] w-[600px] rounded-full bg-[#AAEE00]/15 blur-[150px]" />
          
          {/* Свечение тарифов и квиза (Electric + Sky) */}
          <div className="absolute top-[70%] left-1/4 h-[650px] w-[700px] rounded-full bg-[#0055FF]/10 blur-[160px]" />
          <div className="absolute bottom-20 right-1/4 h-[500px] w-[500px] rounded-full bg-[#BEE0F5]/80 blur-[130px]" />

          {/* Единая аккуратная тетрадная клетка */}
          <div 
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 85, 255, 0.07) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 85, 255, 0.07) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        {/* Контентная часть */}
        <div className="relative z-10">
          <Hero />
          <Solution />
          <StudentCarousel />
          <YandexReviews />
          <Pricing />
          <FAQ />
          <FinalCTA />
          <ReadinessMapWizard />
        </div>
        
        <Footer />
      </main>
    </>
  );
}