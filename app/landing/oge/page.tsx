import type { Metadata } from "next";
import { ExamProvider } from "@/landing/lib/exam-context";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import ExamSeoIntro from "@/landing/components/sections/ExamSeoIntro";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";
import { buildCourseGraphJsonLd } from "@/landing/lib/course-schema";

export const metadata: Metadata = {
  title: "Подготовка к ОГЭ в онлайн-школе «Перезагрузка» | Ханты-Мансийск, Сургут, Нижневартовск",
  description:
    "Курсы подготовки к ОГЭ в мини-группах с гарантией результата в договоре. Личный наставник и ИИ-репетитор. Сдайте экзамен на максимум.",
  alternates: {
    canonical: "https://perezagruzka-edu.ru/oge",
  },
  openGraph: {
    title: "Подготовка к ОГЭ в онлайн-школе «Перезагрузка»",
    description:
      "Курсы подготовки к ОГЭ в мини-группах с гарантией результата в договоре. Личный наставник и ИИ-репетитор. Сдайте экзамен на максимум.",
    url: "https://perezagruzka-edu.ru/oge",
  },
  twitter: {
    title: "Подготовка к ОГЭ в онлайн-школе «Перезагрузка»",
    description:
      "Курсы подготовки к ОГЭ в мини-группах с гарантией результата в договоре. Личный наставник и ИИ-репетитор. Сдайте экзамен на максимум.",
  },
};

export default function OgePage() {
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
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: toSafeJsonLd(buildCourseGraphJsonLd("oge")) }}
      />
      <ExamProvider initialExam="oge">
        <ExamLandingContent
          showExamToggle={false}
          beforeSections={
            <ExamSeoIntro
              title="Репетитор ОГЭ онлайн: онлайн-школа для 8–9 классов"
              description="Мини-группы, живой учитель и личный ИИ-репетитор 24/7 — тот же формат подготовки, что и офлайн, но без привязки к городу."
            />
          }
        />
      </ExamProvider>
    </>
  );
}
