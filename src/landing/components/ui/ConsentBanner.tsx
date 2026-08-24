"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { getCookieConsent, setCookieConsent } from "@/landing/lib/cookie-consent";

// Rendered via `next/dynamic(..., { ssr: false })` — this component only ever
// mounts client-side, so reading the persisted consent in the initializer is
// safe and needs no effect (no server-rendered HTML to hydration-mismatch
// against).
export function ConsentBanner() {
  const [visible, setVisible] = useState(() => getCookieConsent() === null);
  const prefersReducedMotion = useReducedMotion();

  const handleChoice = (value: "granted" | "denied") => {
    setCookieConsent(value);
    setVisible(false);
  };

  const handleAccept = () => handleChoice("granted");
  const handleDecline = () => handleChoice("denied");

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ y: prefersReducedMotion ? 0 : 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: prefersReducedMotion ? 0 : 80, opacity: 0 }}
          transition={{ duration: prefersReducedMotion ? 0.15 : 0.35, ease: [0.16, 1, 0.3, 1] }}
          role="region"
          aria-label="Уведомление об использовании cookie"
          className="fixed inset-x-0 bottom-0 z-50 px-3 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:p-6"
        >
          <div className="mx-auto flex max-w-3xl flex-col items-start gap-4 rounded-2xl border border-ink-100 bg-white/95 p-4 shadow-2xl shadow-ink-900/10 backdrop-blur-xl sm:flex-row sm:items-center sm:p-6">
            <p className="text-xs leading-relaxed text-ink-600 sm:text-sm">
              Мы используем файлы cookie и обрабатываем персональные данные
              для улучшения работы сайта. Оставаясь на сайте, вы соглашаетесь
              с{" "}
              <Link
                href="/privacy"
                className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
              >
                Политикой конфиденциальности
              </Link>
              .
            </p>
            <div className="flex w-full shrink-0 gap-2 sm:w-auto">
              <motion.button
                type="button"
                onClick={handleDecline}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="flex-1 rounded-xl border border-ink-200 bg-white px-5 py-2.5 text-sm font-bold text-ink-600 transition-colors duration-200 hover:bg-ink-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ink-300 focus-visible:ring-offset-2 sm:flex-none sm:py-3"
              >
                Отклонить
              </motion.button>
              <motion.button
                type="button"
                onClick={handleAccept}
                whileHover={prefersReducedMotion ? undefined : { y: -2 }}
                whileTap={{ scale: 0.97 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="flex-1 rounded-xl bg-accent-500 px-6 py-2.5 text-sm font-extrabold text-ink-900 shadow-md shadow-accent-500/25 transition-shadow duration-300 hover:shadow-lg hover:shadow-accent-500/35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-300 focus-visible:ring-offset-2 sm:flex-none sm:py-3"
              >
                Согласен
              </motion.button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
