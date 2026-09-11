"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp } from "@/landing/components/ui/motion";

// Files live in public/landing/photos/. proxy.ts bypasses the /landing
// rewrite for any path with a file extension (see isStaticAssetPath), so
// static assets are served from their literal public/ path -- the "landing"
// segment must be included here.
const GALLERY_CARDS = [
  {
    file: "photo_2026-08-23_11-24-55.jpg",
    alt: "Ученица «Перезагрузки» готовится к экзамену с учебниками",
    objectPosition: "object-[center_35%]",
  },
  {
    file: "photo_2026-08-23_11-25-16.jpg",
    alt: "Ученики «Перезагрузки» на занятии у доски с надписью «Перезагрузка»",
    objectPosition: "object-center",
  },
];

export default function StudentCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);

  return (
    <Section tone="brand-wash" className="border-y border-ink-100" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-8 text-center text-3xl font-black tracking-tight text-electric text-balance sm:text-4xl md:text-5xl">
          Наши ученики — наша гордость
        </h2>

        <motion.div
          variants={itemVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2"
        >
          {GALLERY_CARDS.map((card) => (
            <div
              key={card.file}
              className="group relative aspect-[4/3] overflow-hidden rounded-3xl border-[3px] border-neon shadow-lg"
            >
              <Image
                src={`/landing/photos/${card.file}`}
                alt={card.alt}
                fill
                sizes="(min-width: 768px) 45vw, 90vw"
                className={`object-cover transition-transform duration-500 group-hover:scale-105 ${card.objectPosition}`}
              />
            </div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}
