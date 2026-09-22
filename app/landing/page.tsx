import type { Metadata } from "next";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";

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

export default function Home() {
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
      <ExamLandingContent />
    </>
  );
}
