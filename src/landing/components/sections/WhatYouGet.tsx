"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { WHAT_YOU_GET_ITEMS, WHAT_YOU_GET_FOOTER } from "@/landing/lib/exam-content";

export default function WhatYouGet() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const itemVariants = fadeInUp(prefersReducedMotion);
  const items = WHAT_YOU_GET_ITEMS[exam];

  return (
    <Section tone="white" className="border-y border-ink-100">
      <Atmosphere variant="brand" />
      <div className="relative mx-auto max-w-4xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-bold tracking-tight text-ink-900 text-balance">
            Что вы получите на разборе
          </h2>
        </div>

        <motion.ul
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-4 sm:grid-cols-2"
        >
          {items.map((item, i) => (
            <motion.li
              key={item}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex items-start gap-3.5 rounded-2xl border border-ink-100 bg-white/80 p-4 shadow-sm shadow-ink-900/5"
            >
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
                {i + 1}
              </span>
              <span className="text-sm font-medium leading-relaxed text-ink-700">{item}</span>
            </motion.li>
          ))}
        </motion.ul>

        <p className="mt-8 text-center text-sm font-semibold text-ink-500">{WHAT_YOU_GET_FOOTER}</p>
      </div>
    </Section>
  );
}
