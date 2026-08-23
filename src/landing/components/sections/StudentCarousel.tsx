"use client";

import Image from "next/image";
import { useRef, useState, useCallback, useLayoutEffect } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

const BADGES = [
  "До 10 человек в группе",
  "Атмосфера уроков",
  "Результаты ОГЭ/ЕГЭ",
];

// Files live in public/landing/photos/, but proxy.ts rewrites every request
// on the root host to /landing/<path>, so the src here must NOT repeat the
// "landing" segment. `/photos/x.jpg` is what actually resolves.
// The two newest photos get a distinct "featured" treatment (4:3 crop, neon
// border, no drop shadow glow) per the atmosphere-section spec, so they're
// tracked separately from the rest of the rotating gallery below.
const FEATURED_PHOTO_FILES = ["photo_2026-08-23_11-24-55.jpg", "photo_2026-08-23_11-25-16.jpg"];

const PHOTO_FILES = [
  ...FEATURED_PHOTO_FILES,
  "photo_2023-06-19_11-11-03.jpg",
  "photo_2023-06-19_11-11-04.jpg",
  "photo_2023-06-19_11-11-07.jpg",
  "photo_2023-06-19_11-11-11.jpg",
  "photo_2023-06-19_11-11-16.jpg",
  "photo_2023-06-19_11-18-54.jpg",
  "photo_2023-06-19_11-18-57.jpg",
  "photo_2023-06-19_11-19-47.jpg",
  "photo_2023-06-19_11-19-50.jpg",
  "photo_2023-06-19_11-19-56.jpg",
  "photo_2023-06-19_11-20-02.jpg",
  "photo_2023-06-19_11-20-25.jpg",
];

const SLIDES = PHOTO_FILES.map((file, i) => ({
  file,
  badge: BADGES[i % BADGES.length],
}));

// Reaching either scroll edge is inherently a few subpixels off the exact
// max/min due to browser rounding, so treat anything inside this margin as
// "at the edge" so the boundary dot/arrow state doesn't flicker.
const EDGE_THRESHOLD_PX = 5;

export default function StudentCarousel() {
  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollTargets, setScrollTargets] = useState<number[]>([0]);
  const [activeIndex, setActiveIndex] = useState(0);
  const prefersReducedMotion = useReducedMotion();

  const itemVariants = fadeInUp(prefersReducedMotion);

  // Only some of the SLIDES.length starting positions are actually reachable
  // once several cards are visible at once; the tail end clamps to the same
  // max scroll position. Recompute the distinct reachable positions (one per
  // dot) whenever the track's size changes.
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
      new Set(SLIDES.map((_, i) => Math.round(Math.min(i * step, maxScrollLeft)))),
    );
    // Keep the previous array reference when the values haven't actually
    // changed. Otherwise onScroll (which depends on scrollTargets) gets a
    // new identity every recompute, re-triggering the layout effect below in
    // an infinite loop (ResizeObserver -> setState -> effect -> recompute...).
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
      setActiveIndex(scrollTargets.length - 1);
      return;
    }
    if (scrollLeft <= EDGE_THRESHOLD_PX) {
      setActiveIndex(0);
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
    setActiveIndex(nearest);
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

  const isFirst = activeIndex === 0;
  const isLast = activeIndex === scrollTargets.length - 1;

  return (
    <Section tone="brand-wash" className="border-y border-ink-100" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div>
            <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
              Фото с занятий
            </span>
            <h2 className="mt-5 font-bold tracking-tight text-ink-900">
              Живая атмосфера подготовки
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-ink-600 md:mx-0">
              Смотрите, как проходят наши уроки и какие результаты получают ученики
            </p>
          </div>

          <div className="hidden shrink-0 gap-2 md:flex">
            <button
              type="button"
              onClick={() => goToIndex(activeIndex - 1)}
              disabled={isFirst}
              aria-label="Предыдущее фото"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-600 shadow-sm transition-all duration-100 ease-out hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
            </button>
            <button
              type="button"
              onClick={() => goToIndex(activeIndex + 1)}
              disabled={isLast}
              aria-label="Следующее фото"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-ink-100 bg-white text-ink-600 shadow-sm transition-all duration-100 ease-out hover:bg-brand-50 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95 disabled:pointer-events-none disabled:opacity-40"
            >
              <ChevronRight className="h-5 w-5" strokeWidth={2.25} />
            </button>
          </div>
        </div>

        <motion.div
          ref={trackRef}
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex gap-5 overflow-x-auto pb-4 snap-x snap-mandatory scrollbar-none"
        >
          {SLIDES.map((slide, i) => {
            const isFeatured = FEATURED_PHOTO_FILES.includes(slide.file);
            return (
              <motion.div
                key={slide.file + i}
                variants={itemVariants}
                transition={{ duration: 0.4, ease: "easeOut" }}
                whileHover={prefersReducedMotion ? undefined : { scale: 1.03, y: -4 }}
                className={
                  isFeatured
                    ? "group relative aspect-[4/3] w-[75%] shrink-0 snap-center overflow-hidden rounded-2xl border-[3px] border-[#AAEE00] shadow-lg sm:w-[45%] md:w-[30%] lg:w-[23%]"
                    : "group relative aspect-[4/5] w-[75%] shrink-0 snap-center overflow-hidden rounded-3xl border border-white/40 shadow-[var(--shadow-brand-photo)] sm:w-[45%] md:w-[30%] lg:w-[23%]"
                }
              >
                <Image
                  src={`/photos/${slide.file}`}
                  alt="Ученики образовательного центра «Перезагрузка» на занятиях"
                  fill
                  sizes="(min-width: 1024px) 23vw, (min-width: 768px) 30vw, (min-width: 640px) 45vw, 75vw"
                  className={
                    isFeatured
                      ? "object-cover object-top transition-transform duration-500 group-hover:scale-105"
                      : "object-cover transition-transform duration-500 group-hover:scale-105"
                  }
                />
                <div className="absolute inset-x-3 bottom-3">
                  <span className="inline-block rounded-full border border-white/40 bg-white/70 px-3 py-1.5 text-xs font-semibold text-ink-900 shadow-sm backdrop-blur-xl">
                    {slide.badge}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </motion.div>

        <div className="mt-2 flex justify-center gap-1.5">
          {scrollTargets.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToIndex(i)}
              aria-label={`Перейти к слайду ${i + 1}`}
              aria-current={i === activeIndex}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === activeIndex ? "w-5 bg-brand-500" : "w-1.5 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>
      </div>
    </Section>
  );
}
