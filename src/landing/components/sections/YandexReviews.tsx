"use client";

import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Star, ShieldCheck } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";
import { useExam } from "@/landing/lib/exam-context";

const YANDEX_REVIEWS_URL =
  "https://yandex.ru/maps/org/reboot/187580247811/reviews/?ll=69.031855%2C61.005101&page=2&z=16";

interface YandexReview {
  name: string;
  badge: string;
  rating: number;
  text: string;
  // Only set on reviews whose grades/badge explicitly name one exam track —
  // shown only while that track is active. Reviews without a tag (generic
  // school-subject feedback) are shown regardless of the toggle.
  examTag?: "oge" | "ege";
}

const REVIEWS: YandexReview[] = [
  {
    name: "Ксения",
    badge: "Школьная успеваемость (5/5)",
    rating: 5,
    text: "Хотим выразить огромную благодарность за занятия! Не давался русский язык дочери, но благодаря занятиям с прекрасным педагогом дочь четвертую четверть закончила на 5 👍 Большое спасибо!",
  },
  {
    name: "Ирина П.",
    badge: "Родитель (3 года с нами)",
    rating: 5,
    text: "Мои дети занимаются уже более 3х лет, мы, как родители, очень довольны. Дети получают реальные знания. Хочется пожелать центру дальнейшего развития!",
  },
  {
    name: "Тимур Синицын",
    badge: "Платформа и трекинг ДЗ",
    rating: 5,
    text: "В электронном формате предоставлена возможность отслеживать финансы, ДЗ и прогресс ученика. Прекрасный коллектив, цель которого каждого ребенка довести до результата.",
  },
  {
    name: "Арина Демчук",
    badge: "Родительский отзыв",
    rating: 5,
    text: "Отличный центр образования! Обращалась много раз и всегда очень довольна, профессиональный преподавательский состав 👍 Рекомендую всем мамочкам и папочкам, Центр №1 в Ханты-Мансийске!",
  },
];

function Stars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Оценка ${rating} из 5`}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${i < rating ? "fill-yandex-yellow text-yandex-yellow" : "fill-ink-100 text-ink-100"}`}
          strokeWidth={0}
        />
      ))}
    </div>
  );
}

export default function YandexReviews() {
  const prefersReducedMotion = useReducedMotion();
  const { exam } = useExam();
  const visibleReviews = useMemo(
    () => REVIEWS.filter((r) => !r.examTag || r.examTag === exam),
    [exam],
  );

  const cardVariants = fadeInUp(prefersReducedMotion);

  const trackRef = useRef<HTMLDivElement>(null);
  const [scrollTargets, setScrollTargets] = useState<number[]>([0]);
  const [carouselIndex, setCarouselIndex] = useState(0);
  const EDGE_THRESHOLD_PX = 5;

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
      new Set(visibleReviews.map((_, i) => Math.round(Math.min(i * step, maxScrollLeft)))),
    );
    setScrollTargets((prev) =>
      prev.length === targets.length && prev.every((value, i) => value === targets[i])
        ? prev
        : targets,
    );
  }, [visibleReviews]);

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

  return (
    <Section id="reviews" className="scroll-mt-20" paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 flex flex-col items-center text-center">
          <a
            href={YANDEX_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-yandex-yellow/60 bg-gradient-to-r from-yandex-red/10 to-yandex-yellow/20 px-4 py-1.5 text-sm font-bold text-ink-900 transition-all duration-100 ease-out hover:bg-yandex-yellow/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
          >
            <span className="text-yandex-red">5.0</span>
            <span className="tracking-tight text-yandex-yellow">★★★★★</span>
            <span className="text-ink-500">на Яндекс.Картах</span>
          </a>

          <h2 className="mt-5 font-bold tracking-tight text-ink-900">
            Отзывы с Яндекса
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Высокая оценка родителей и учеников
          </p>

          <a
            href={YANDEX_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-brand-200 bg-brand-50 px-3.5 py-1 text-xs font-semibold text-brand-700 transition hover:bg-brand-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2.25} />
            Организация на Яндекс.Картах
          </a>
        </div>

        <motion.div
          ref={trackRef}
          role="region"
          aria-label="Отзывы клиентов"
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 pb-2 scrollbar-none md:grid md:grid-cols-2 md:gap-5 md:overflow-visible md:px-0 md:pb-0 lg:grid-cols-4"
        >
          {visibleReviews.map((review) => (
            <motion.article
              key={review.name}
              variants={cardVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="flex h-full w-[85%] shrink-0 snap-center flex-col rounded-2xl border border-white/40 bg-white/70 p-5 shadow-card backdrop-blur-xl transition-shadow duration-300 hover:border-brand-300 hover:shadow-card-hover sm:w-[45%] md:w-auto md:shrink"
            >
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-ink-900">{review.name}</p>
              </div>
              <Stars rating={review.rating} />
              <span className="mt-2 inline-block w-fit rounded-full bg-brand-50 px-2.5 py-1 text-xs font-semibold text-brand-700">
                {review.badge}
              </span>
              <p className="font-quote mt-3 flex-1 text-sm leading-relaxed text-ink-600">
                {review.text}
              </p>
            </motion.article>
          ))}
        </motion.div>

        <div className="mt-4 flex justify-center gap-1.5 md:hidden">
          {scrollTargets.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToIndex(i)}
              aria-label={`Перейти к отзыву ${i + 1}`}
              aria-current={i === carouselIndex}
              className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                i === carouselIndex ? "w-5 bg-brand-500" : "w-1.5 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2">
          <a
            href={YANDEX_REVIEWS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center rounded-xl bg-brand-500 px-6 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-100 ease-out hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
          >
            Читать все отзывы на Яндекс.Картах
          </a>
          <p className="text-xs text-ink-500">
            Отзывы выше — подборка реальных отзывов наших учеников и родителей, размещённых на
            странице организации на Яндекс.Картах
          </p>
        </div>
      </div>
    </Section>
  );
}
