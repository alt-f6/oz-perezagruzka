"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp } from "@/landing/components/ui/motion";

// Files live in public/landing/photos/. proxy.ts bypasses the /landing
// rewrite for any path with a file extension (see isStaticAssetPath), so
// static assets are served from their literal public/ path -- the "landing"
// segment must be included here.
const GALLERY_CARDS = [
  { file: "photo_2023-06-19_11-11-03.jpg", alt: "Ученики «Перезагрузки» на занятии" },
  { file: "photo_2023-06-19_11-11-04.jpg", alt: "Ученики «Перезагрузки» готовятся к экзамену" },
  { file: "photo_2023-06-19_11-11-07.jpg", alt: "Занятие в классе «Перезагрузки»" },
  { file: "photo_2023-06-19_11-11-11.jpg", alt: "Ученики «Перезагрузки» за групповой работой" },
  { file: "photo_2023-06-19_11-11-16.jpg", alt: "Преподаватель «Перезагрузки» объясняет тему у доски" },
  { file: "photo_2023-06-19_11-18-54.jpg", alt: "Ученики «Перезагрузки» на уроке" },
  { file: "photo_2023-06-19_11-18-57.jpg", alt: "Ученица «Перезагрузки» решает задание" },
  { file: "photo_2023-06-19_11-19-47.jpg", alt: "Ученики «Перезагрузки» обсуждают задачу" },
  { file: "photo_2023-06-19_11-19-50.jpg", alt: "Занятие в мини-группе «Перезагрузки»" },
  { file: "photo_2023-06-19_11-19-56.jpg", alt: "Ученики «Перезагрузки» с учебными материалами" },
  { file: "photo_2023-06-19_11-20-02.jpg", alt: "Ученик «Перезагрузки» на индивидуальном занятии" },
  { file: "photo_2023-06-19_11-20-25.jpg", alt: "Ученики «Перезагрузки» после занятия" },
  {
    file: "photo_2026-08-23_11-24-55.jpg",
    alt: "Ученица «Перезагрузки» готовится к экзамену с учебниками",
    objectPosition: "object-[center_35%]",
  },
  {
    file: "photo_2026-08-23_11-25-16.jpg",
    alt: "Ученики «Перезагрузки» на занятии у доски с надписью «Перезагрузка»",
  },
];

const EDGE_THRESHOLD_PX = 5;

export default function StudentCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const sectionVariants = fadeInUp(prefersReducedMotion);

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollTargets, setScrollTargets] = useState<number[]>([0]);
  const [carouselIndex, setCarouselIndex] = useState(0);

  const recomputeTargets = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const card = track.firstElementChild as HTMLElement | null;
    if (!card) return;
    const trackStyle = getComputedStyle(track);
    const gap = parseFloat(trackStyle.columnGap || trackStyle.gap || "0") || 0;
    const step = card.getBoundingClientRect().width + gap;
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const targets = Array.from(
      new Set(GALLERY_CARDS.map((_, i) => Math.round(Math.min(i * step, maxScrollLeft)))),
    );
    setScrollTargets((prev) =>
      prev.length === targets.length && prev.every((value, i) => value === targets[i])
        ? prev
        : targets,
    );
  }, []);

  const onScroll = useCallback(() => {
    const track = trackRef.current;
    if (!track) return;
    const maxScrollLeft = Math.max(0, track.scrollWidth - track.clientWidth);
    const scrollLeft = track.scrollLeft;
    if (scrollLeft >= maxScrollLeft - EDGE_THRESHOLD_PX) {
      setCarouselIndex(scrollTargets.length - 1);
      return;
    }
    if (scrollLeft <= EDGE_THRESHOLD_PX) {
      setCarouselIndex(0);
      return;
    }
    let nearest = 0;
    let nearestDistance = Infinity;
    scrollTargets.forEach((target, i) => {
      const distance = Math.abs(target - scrollLeft);
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearest = i;
      }
    });
    setCarouselIndex(nearest);
  }, [scrollTargets]);

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    recomputeTargets();
    const resizeObserver = new ResizeObserver(recomputeTargets);
    resizeObserver.observe(track);
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      resizeObserver.disconnect();
      track.removeEventListener("scroll", onScroll);
    };
  }, [recomputeTargets, onScroll]);

  const goToIndex = useCallback(
    (index: number) => {
      const track = trackRef.current;
      if (!track) return;
      const clamped = Math.min(Math.max(index, 0), scrollTargets.length - 1);
      track.scrollTo({ left: scrollTargets[clamped], behavior: "smooth" });
    },
    [scrollTargets],
  );

  const isAtStart = carouselIndex === 0;
  const isAtEnd = carouselIndex >= scrollTargets.length - 1;

  return (
    <Section tone="brand-wash" className="border-y border-ink-100" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-8 text-center text-3xl font-black tracking-tight text-electric text-balance sm:text-4xl md:text-5xl">
          Наши ученики — наша гордость
        </h2>

        <motion.div
          variants={sectionVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative"
        >
          <div
            ref={trackRef}
            role="region"
            aria-label="Фотографии учеников «Перезагрузки»"
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto scrollbar-none pb-6 pt-2"
          >
            {GALLERY_CARDS.map((card) => (
              <div
                key={card.file}
                className="relative aspect-[4/3] w-[280px] shrink-0 snap-center overflow-hidden rounded-3xl border-[3px] border-neon shadow-md sm:w-[340px] md:w-[380px]"
              >
                <Image
                  src={`/landing/photos/${card.file}`}
                  alt={card.alt}
                  fill
                  sizes="(max-width: 768px) 280px, 380px"
                  className={`object-cover ${card.objectPosition ?? "object-center"}`}
                />
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => goToIndex(carouselIndex - 1)}
            disabled={isAtStart}
            aria-label="Предыдущее фото"
            className="absolute left-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2.5 text-ink shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-0 md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => goToIndex(carouselIndex + 1)}
            disabled={isAtEnd}
            aria-label="Следующее фото"
            className="absolute right-2 top-1/2 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2.5 text-ink shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-0 md:flex"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </motion.div>

        <div className="mt-1 flex flex-wrap justify-center gap-1.5">
          {scrollTargets.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToIndex(i)}
              aria-label={`Перейти к фото ${i + 1}`}
              aria-current={i === carouselIndex}
              className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                i === carouselIndex ? "w-5 bg-brand-500" : "w-1.5 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
