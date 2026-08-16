"use client";

import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const POINTS = [
  {
    title: "Берём только после диагностики",
    desc: "Сначала оцениваем реальный уровень — и только потом решаем, готовы ли мы взяться.",
  },
];

export default function Guarantee() {
  const prefersReducedMotion = useReducedMotion();

  const cardVariants = fadeInUp(prefersReducedMotion, 40);

  return (
    <Section tone="brand-wash">
      <Atmosphere variant="accent" intensity="premium" />
      <div className="relative mx-auto max-w-4xl px-6">
        <div className="mb-12 text-center">
          <h2 className="font-bold tracking-tight text-ink-900 text-balance">
            Мы рискуем репутацией, а не вашим бюджетом
          </h2>
        </div>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-md gap-5"
        >
          {POINTS.map((point) => (
            <motion.div
              key={point.title}
              variants={cardVariants}
              transition={{ type: "spring", stiffness: 90, damping: 18 }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
              className="rounded-3xl border border-white/40 bg-white/70 p-6 shadow-card backdrop-blur-xl transition-shadow duration-300 hover:shadow-card-hover"
            >
              <h3 className="font-bold text-ink-900">{point.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{point.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}
