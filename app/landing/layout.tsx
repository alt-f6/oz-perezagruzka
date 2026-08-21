import "./globals.css";
import type { Metadata } from "next";
import { MotionConfig } from "framer-motion";
import Script from "next/script";
import ConsentBanner from "@/landing/components/ui/ConsentBannerClient";
import FloatingWhatsApp from "@/landing/components/ui/FloatingWhatsApp";

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://perezagruzka.ru";
const ymCounterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;

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
    <div className="font-sans bg-gradient-to-b from-white to-brand-50/40 text-foreground min-h-screen">
      {ymCounterId && (
        <Script id="yandex-metrika" strategy="afterInteractive">
          {`
            (function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
            m[i].l=1*new Date();for(var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return}}
            k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})
            (window, document, "script", "https://mc.yandex.ru/metrika/tag.js", "ym");
            ym(${ymCounterId}, "init", { clickmap: true, trackLinks: true, accurateTrackBounce: true });
          `}
        </Script>
      )}
      {/* reducedMotion="user" is a global fallback honoring prefers-reduced-motion for any
          motion.* element that doesn't already check useReducedMotion() itself. */}
      <MotionConfig reducedMotion="user">
        {children}
        <ConsentBanner />
        <FloatingWhatsApp />
      </MotionConfig>
    </div>
  );
}
