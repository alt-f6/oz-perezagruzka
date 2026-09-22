import type { Metadata } from "next";
import { ExamProvider } from "@/landing/lib/exam-context";
import ExamLandingContent from "@/landing/components/ExamLandingContent";
import { toSafeJsonLd } from "@/landing/lib/json-ld";
import { buildFaqJsonLd } from "@/landing/lib/faq-schema";
import { buildEducationalOrganizationJsonLd } from "@/landing/lib/organization-schema";

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
      <ExamProvider initialExam="oge">
        <ExamLandingContent showExamToggle={false} />
      </ExamProvider>
    </>
  );
}
