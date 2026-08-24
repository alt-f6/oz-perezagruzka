"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Card from "@/landing/components/ui/Card";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";
import { HOW_IT_WORKS_STEPS, HOW_IT_WORKS_FOOTER } from "@/landing/lib/exam-content";

export default function HowItWorks() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const itemVariants = fadeInUp(prefersReducedMotion);
  const steps = HOW_IT_WORKS_STEPS[exam];

  return (
    <Section id="how-it-works" tone="brand-wash" className="scroll-mt-20">
      <Atmosphere variant="brand" intensity="premium" />
      <div className="relative mx-auto max-w-5xl px-6">
        <div className="mb-16 text-center">
          <h2 className="font-bold tracking-tight text-ink-900">
            Как проходит разбор
          </h2>
        </div>

        <motion.ol
          variants={staggerContainer(0.1)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4"
        >
          {steps.map((step, i) => (
            <motion.li
              key={step.title}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
            >
              <Card
                tint="glass"
                className="flex h-full flex-col transition-shadow duration-300 hover:shadow-card-hover"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 font-mono font-black text-brand-700 border border-brand-200">
                  {i + 1}
                </span>
                <h3 className="mt-4 font-bold text-ink-900">{step.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{step.desc}</p>
              </Card>
            </motion.li>
          ))}
        </motion.ol>

        <p className="mt-10 text-center text-sm font-semibold text-ink-500">{HOW_IT_WORKS_FOOTER}</p>
      </div>
    </Section>
  );
}
