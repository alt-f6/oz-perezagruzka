import type { Metadata } from "next";
import { ExamProvider } from "@/landing/lib/exam-context";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";

export const metadata: Metadata = {
  title: "Подготовка к ЕГЭ в онлайн-школе «Перезагрузка» | Поступление на бюджет",
  description:
    "Подготовка к ЕГЭ на целевые 80+ баллов для поступления на бюджет. Мини-группы, сильные педагоги, гарантия результата в договоре.",
  alternates: {
    canonical: "https://perezagruzka-edu.ru/ege",
  },
  openGraph: {
    title: "Подготовка к ЕГЭ в онлайн-школе «Перезагрузка»",
    description:
      "Подготовка к ЕГЭ на целевые 80+ баллов для поступления на бюджет. Мини-группы, сильные педагоги, гарантия результата в договоре.",
    url: "https://perezagruzka-edu.ru/ege",
  },
  twitter: {
    title: "Подготовка к ЕГЭ в онлайн-школе «Перезагрузка»",
    description:
      "Подготовка к ЕГЭ на целевые 80+ баллов для поступления на бюджет. Мини-группы, сильные педагоги, гарантия результата в договоре.",
  },
};

export default function EgePage() {
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
      <ExamProvider initialExam="ege">
        <ExamLandingContent showExamToggle={false} />
      </ExamProvider>
    </>
  );
}
