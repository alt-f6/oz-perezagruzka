"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";

const TRUST_MESSAGES = [
  "ИИ-навигатор «Перезагрузки» изучает профиль ученика...",
  "Сопоставляем сильные стороны с программой ОГЭ...",
  "Формируем персональные рекомендации...",
];

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % TRUST_MESSAGES.length), 2200);
    return () => clearInterval(id);
  }, [message]);

  return (
    <section className="relative flex min-h-[320px] items-center justify-center overflow-hidden py-24">
      <Atmosphere variant="mixed" />

      <div className="relative flex flex-col items-center gap-6 px-6 text-center">
        <div className="relative h-16 w-16">
          <motion.span
            className="absolute inset-0 rounded-full border-4 border-ink-200 border-t-brand-500"
            animate={prefersReducedMotion ? undefined : { rotate: 360 }}
            transition={
              prefersReducedMotion ? undefined : { repeat: Infinity, duration: 1.1, ease: "linear" }
            }
          />
        </div>
        <p className="max-w-xs text-base font-medium text-ink-600" role="status" aria-live="polite">
          {message ?? TRUST_MESSAGES[index]}
        </p>
        <p className="text-sm text-ink-500">Обычно это занимает не больше 15 секунд</p>
      </div>
    </section>
  );
}
