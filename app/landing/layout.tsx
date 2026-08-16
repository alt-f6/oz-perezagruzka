import "./globals.css";
import type { Metadata } from "next";
import { Manrope } from "next/font/google";
import { MotionConfig } from "framer-motion";
import ConsentBanner from "@/landing/components/ui/ConsentBannerClient";

const manrope = Manrope({ subsets: ["latin", "cyrillic-ext"], variable: "--font-manrope" });

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://perezagruzka.ru";

const title = "Перезагрузка — Подготовка к ОГЭ с живым учителем и ИИ-репетитором";
const description =
  "Онлайн-школа для подростков 7–9 класса: мини-группы до 8 человек, живой учитель и ИИ-репетитор на связи 24/7. Бесплатная диагностика перед стартом.";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: title,
    template: "%s — Перезагрузка",
  },
  description,
  keywords: [
    "подготовка к ОГЭ",
    "репетитор ОГЭ онлайн",
    "ИИ-репетитор",
    "онлайн-школа для подростков",
    "ОГЭ 2026",
    "мини-группы подготовка к экзаменам",
  ],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
    },
  },
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: siteUrl,
    siteName: "Перезагрузка",
    title,
    description,
  },
  twitter: {
    card: "summary_large_image",
    title,
    description,
  },
};

// Structural wrapper only. <html>/<body> live in the single root app/layout.tsx.
export default function LandingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${manrope.variable} font-sans bg-gradient-to-b from-white to-brand-50/40 text-foreground min-h-screen`}>
      {/* reducedMotion="user" is a global fallback honoring prefers-reduced-motion for any
          motion.* element that doesn't already check useReducedMotion() itself. */}
      <MotionConfig reducedMotion="user">
        {children}
        <ConsentBanner />
      </MotionConfig>
    </div>
  );
}
