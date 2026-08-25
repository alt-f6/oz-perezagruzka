"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

// Files live in public/landing/photos/, but proxy.ts rewrites every request
// on the root host to /landing/<path>, so the src here must NOT repeat the
// "landing" segment. `/photos/x.jpg` is what actually resolves.
const GALLERY_CARDS = [
  {
    file: "photo_2026-08-23_11-24-55.jpg",
    alt: "Ученица «Перезагрузки» готовится к экзамену",
    objectPosition: "object-top",
  },
  {
    file: "photo_2026-08-23_11-25-16.jpg",
    alt: "Ученики «Перезагрузки» на занятии у доски",
    objectPosition: "object-center",
  },
];

export default function StudentCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="brand-wash" className="border-y border-ink-100" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-5xl px-6">
        <h2 className="mb-12 text-center font-bold tracking-tight text-brand-600 text-balance">
          Наши ученики — наша гордость
        </h2>

        <motion.div
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="grid gap-6 md:grid-cols-2"
        >
          {GALLERY_CARDS.map((card) => (
            <motion.div
              key={card.file}
              variants={itemVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -4 }}
              className="group relative aspect-[4/3] w-full overflow-hidden rounded-3xl border-[3px] border-accent-500 shadow-lg"
            >
              <Image
                src={`/photos/${card.file}`}
                alt={card.alt}
                fill
                sizes="(min-width: 768px) 45vw, 90vw"
                className={`object-cover ${card.objectPosition} transition-transform duration-500 group-hover:scale-105`}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}
