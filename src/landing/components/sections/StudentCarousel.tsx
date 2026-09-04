"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp } from "@/landing/components/ui/motion";

// Files live in public/landing/photos/. proxy.ts bypasses the /landing
// rewrite for any path with a file extension (see isStaticAssetPath), so
// static assets are served from their literal public/ path -- the "landing"
// segment must be included here.
const GALLERY_CARDS = [
  { file: "photo_2026-08-23_11-24-55.jpg", alt: "Ученица «Перезагрузки» готовится к экзамену" },
  { file: "photo_2026-08-23_11-25-16.jpg", alt: "Ученики «Перезагрузки» на занятии у доски" },
  { file: "photo_2023-06-19_11-11-03.jpg", alt: "Ученик «Перезагрузки» на занятии" },
  { file: "photo_2023-06-19_11-11-04.jpg", alt: "Ученица «Перезагрузки» на занятии" },
  { file: "photo_2023-06-19_11-11-07.jpg", alt: "Ученики «Перезагрузки» готовятся к экзамену" },
  { file: "photo_2023-06-19_11-11-11.jpg", alt: "Ученик «Перезагрузки» решает задачи" },
  { file: "photo_2023-06-19_11-11-16.jpg", alt: "Ученица «Перезагрузки» на уроке" },
  { file: "photo_2023-06-19_11-18-54.jpg", alt: "Ученики «Перезагрузки» на занятии в группе" },
  { file: "photo_2023-06-19_11-18-57.jpg", alt: "Ученик «Перезагрузки» с учителем" },
  { file: "photo_2023-06-19_11-19-47.jpg", alt: "Ученица «Перезагрузки» готовится к экзамену" },
  { file: "photo_2023-06-19_11-19-50.jpg", alt: "Ученики «Перезагрузки» на практике" },
  { file: "photo_2023-06-19_11-19-56.jpg", alt: "Ученик «Перезагрузки» отвечает у доски" },
  { file: "photo_2023-06-19_11-20-02.jpg", alt: "Ученица «Перезагрузки» на занятии" },
  { file: "photo_2023-06-19_11-20-25.jpg", alt: "Ученики «Перезагрузки» после занятия" },
];

export default function StudentCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const itemVariants = fadeInUp(prefersReducedMotion);
  const trackRef = useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);

  const scrollToIndex = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const clamped = Math.max(0, Math.min(index, GALLERY_CARDS.length - 1));
    const card = track.children[clamped] as HTMLElement | undefined;
    card?.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", inline: "start", block: "nearest" });
    setActiveIndex(clamped);
  };

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    const cardWidth = track.children[0]?.getBoundingClientRect().width ?? 1;
    const index = Math.round(track.scrollLeft / (cardWidth + 24));
    setActiveIndex(Math.max(0, Math.min(index, GALLERY_CARDS.length - 1)));
  };

  return (
    <Section tone="brand-wash" className="border-y border-ink-100" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-8 text-center text-3xl font-black tracking-tight text-[#0055FF] text-balance sm:text-4xl md:text-5xl">
          Наши ученики — наша гордость
        </h2>

        <div className="relative">
          <button
            type="button"
            aria-label="Предыдущие фото"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            className="absolute left-0 top-1/2 z-10 hidden h-11 w-11 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-700 shadow-lg transition hover:bg-ink-50 disabled:opacity-30 sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronIcon className="h-5 w-5 rotate-180" />
          </button>

          <motion.div
            ref={trackRef}
            onScroll={handleScroll}
            variants={itemVariants}
            initial={prefersReducedMotion ? undefined : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto scroll-smooth pb-4 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {GALLERY_CARDS.map((card) => (
              <div
                key={card.file}
                className="group relative aspect-[4/3] w-[75%] shrink-0 snap-start overflow-hidden rounded-3xl border-[3px] border-[#AAEE00] shadow-lg sm:w-[45%] lg:w-[30%]"
              >
                <Image
                  src={`/landing/photos/${card.file}`}
                  alt={card.alt}
                  fill
                  sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 75vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </div>
            ))}
          </motion.div>

          <button
            type="button"
            aria-label="Следующие фото"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === GALLERY_CARDS.length - 1}
            className="absolute right-0 top-1/2 z-10 hidden h-11 w-11 -translate-y-1/2 translate-x-1/2 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-700 shadow-lg transition hover:bg-ink-50 disabled:opacity-30 sm:flex focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ChevronIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          {GALLERY_CARDS.map((card, index) => (
            <button
              key={card.file}
              type="button"
              aria-label={`Показать фото ${index + 1}`}
              aria-current={index === activeIndex}
              onClick={() => scrollToIndex(index)}
              className={`h-2.5 rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                index === activeIndex ? "w-6 bg-[#0055FF]" : "w-2.5 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}

function ChevronIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 6l6 6-6 6" />
    </svg>
  );
}
