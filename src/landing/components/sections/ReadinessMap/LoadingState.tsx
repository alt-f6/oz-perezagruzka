"use client";

import { useEffect, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { useExam } from "@/landing/lib/exam-context";
import { LOADING_TRUST_MESSAGES } from "@/landing/lib/exam-content";

interface LoadingStateProps {
  message?: string;
}

export function LoadingState({ message }: LoadingStateProps) {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const trustMessages = LOADING_TRUST_MESSAGES[exam];
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (message) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % trustMessages.length), 2200);
    return () => clearInterval(id);
  }, [message, trustMessages.length]);

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
          {message ?? trustMessages[index]}
        </p>
        <p className="text-sm text-ink-500">Обычно это занимает не больше 15 секунд</p>
      </div>
    </section>
  );
}
