import type { Metadata } from "next";
import Link from "next/link";
import { CONTACT_PHONE } from "@/landing/lib/legal";

// Stable confirmation URL for ad-platform URL goals and for reloads /
// deep links, so /spasibo never 404s. Conversions themselves are counted by
// the lead_submit JS goal, not by visits here.
export const metadata: Metadata = {
  title: "Заявка принята",
  robots: { index: false, follow: false },
};

export default function SpasiboPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="font-bold tracking-tight text-ink-900">Спасибо, заявка принята!</h1>
      <p className="max-w-md text-ink-600">
        Перезвоним в течение 15 минут (ежедневно с 09:00 до 21:00). Если удобнее связаться сразу — звоните:{" "}
        <a
          href={`tel:+${CONTACT_PHONE.replace(/\D/g, "")}`}
          className="font-semibold text-brand-700 underline underline-offset-2"
        >
          {CONTACT_PHONE}
        </a>
      </p>
      <Link
        href="/"
        className="rounded-xl bg-brand-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
      >
        На главную
      </Link>
    </main>
  );
}
