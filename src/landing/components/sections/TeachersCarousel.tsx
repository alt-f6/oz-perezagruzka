"use client";

import { useCallback, useLayoutEffect, useRef, useState } from "react";
import Image from "next/image";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

// Scores and quotes come from the teachers' own answers ("Педагоги баллы и
// фразы.xlsx", 13.09.2026), lightly copy-edited. Scores are phrased as the
// teacher's personal results, never as school-wide statistics.
// TODO: Сергей Фофанов's score and quote are still placeholder text --
// replace once his real data arrives.
//
// All source photos are portrait headshots with the face/hair near the top
// of the frame, so object-cover's default center-crop chops off foreheads
// once the tall source is cropped down to the card's aspect-[4/3] box.
// A flat object-top isn't right for every photo either: Alice's and
// Elizaveta's source photos are tight headshots where the face fills nearly
// the whole frame, so object-top's crop window lands mid-face (eyes/nose)
// instead of running to the chin. Each photoPosition below is picked from
// that photo's actual pixel dimensions and head position so the crop starts
// just above the hairline and runs down through the chin/collar.
const TEACHERS = [
  {
    name: "Алиса Егорова",
    photo: "/landing/photos/teachers/alice_rus_lang.jpg",
    photoPosition: "object-[center_45%]",
    subject: "ОБЩЕСТВОЗНАНИЕ И ИСТОРИЯ · ЕГЭ",
    score: "89",
    scoreLabel: "средний балл её учеников по обществознанию, лучший результат — 100",
    quote: "Мне нравится помогать ученикам на пути к высоким баллам и направлять их в развитии.",
  },
  {
    name: "Елизавета Балдина",
    photo: "/landing/photos/teachers/elizaveta_balding.jpg",
    photoPosition: "object-[center_15%]",
    subject: "МАТЕМАТИКА · ОГЭ И ЕГЭ",
    score: "4",
    scoreLabel: "оценка, на которую её ученики сдают экзамен",
    quote:
      "Я стала педагогом, потому что хочу, чтобы дети видели в математике простой и понятный язык — и начинали её любить.",
  },
  {
    name: "Ирина Соколова",
    photo: "/landing/photos/teachers/irina_geography.jpg",
    photoPosition: "object-top",
    subject: "ГЕОГРАФИЯ · ОГЭ И ЕГЭ",
    score: "31 из 31",
    scoreLabel: "лучший результат ученика на ОГЭ, на ЕГЭ — 95 из 100",
    quote: "Хороший учитель показывает, великий — вдохновляет.",
  },
  {
    name: "Наталья Ефремкина",
    photo: "/landing/photos/teachers/natalia_chemistry.jpg",
    photoPosition: "object-top",
    subject: "ХИМИЯ И БИОЛОГИЯ · ОГЭ И ЕГЭ",
    score: "97",
    scoreLabel: "лучший балл ученика на ЕГЭ по биологии в этом году, по химии — 94",
    quote: "Учитель продолжается в своём ученике.",
  },
  {
    name: "Оксана Кузнецова",
    photo: "/landing/photos/teachers/oksana.jpg",
    photoPosition: "object-top",
    subject: "ЛИТЕРАТУРА · ОГЭ И ЕГЭ",
    score: "100",
    scoreLabel: "лучший балл её ученика",
    quote: "Мне нравится рассказывать о сложном простым и интересным языком и мотивировать учеников.",
  },
  {
    name: "Сергей Фофанов",
    photo: "/landing/photos/teachers/sergey_fofanov.jpg",
    photoPosition: "object-top",
    subject: "ФИЗИКА · ЕГЭ",
    score: "86",
    scoreLabel: "средний балл на ЕГЭ в 2025 г.",
    quote:
      "Больше всего люблю момент, когда сложная задача вдруг «щёлкает» — и ученик сам находит решение.",
  },
] as const;

const EDGE_THRESHOLD_PX = 5;

export default function TeachersCarousel() {
  const prefersReducedMotion = useReducedMotion();
  const sectionVariants = fadeInUp(prefersReducedMotion);
  const cardVariants = fadeInUp(prefersReducedMotion);

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
      new Set(TEACHERS.map((_, i) => Math.round(Math.min(i * step, maxScrollLeft)))),
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
    <Section paddingOverride="py-16 md:py-24">
      <div className="relative mx-auto max-w-6xl px-6">
        <h2 className="mb-10 text-center text-3xl font-black tracking-tight text-ink-900 text-balance sm:text-4xl md:text-5xl">
          Наши педагоги
        </h2>
        <p className="mx-auto -mt-6 mb-10 max-w-2xl text-center text-base leading-relaxed text-ink-600 md:text-lg">
          Работу каждого педагога сопровождает методист — так мы держим высокую планку на каждом
          занятии.
        </p>

        <motion.div
          variants={sectionVariants}
          initial={prefersReducedMotion ? undefined : "hidden"}
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="relative"
        >
          <motion.div
            ref={trackRef}
            role="region"
            aria-label="Педагоги «Перезагрузки»"
            variants={staggerContainer(0.1)}
            initial={prefersReducedMotion ? undefined : "hidden"}
            whileInView="show"
            viewport={{ once: true, margin: "-80px" }}
            className="flex snap-x snap-mandatory gap-6 overflow-x-auto scrollbar-none px-4 pb-6 pt-2 sm:px-6"
          >
            {TEACHERS.map((teacher) => (
              <motion.div
                key={teacher.name}
                variants={cardVariants}
                transition={{ type: "spring", stiffness: 90, damping: 18 }}
                className="w-[82vw] shrink-0 snap-center overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-sm transition-shadow hover:shadow-md sm:w-[360px]"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-[20px]">
                  <Image
                    src={teacher.photo}
                    alt={`${teacher.name} — преподаватель «Перезагрузки»`}
                    fill
                    sizes="(max-width: 768px) 82vw, 360px"
                    className={`object-cover ${teacher.photoPosition}`}
                  />
                </div>

                <div className="flex flex-col gap-3 p-5">
                  <div>
                    <p className="text-lg font-bold text-ink-900 md:text-xl">{teacher.name}</p>
                    <p className="mt-1 font-mono text-xs font-semibold tracking-wider text-electric uppercase">
                      {teacher.subject}
                    </p>
                  </div>

                  <div>
                    <p className="text-3xl font-black text-[#0055FF] md:text-4xl">{teacher.score}</p>
                    <p className="text-xs font-medium text-slate-500">{teacher.scoreLabel}</p>
                  </div>

                  <p className="mt-2 border-l-2 border-electric/40 pl-3 font-serif text-sm italic leading-relaxed text-slate-700">
                    {teacher.quote}
                  </p>
                </div>
              </motion.div>
            ))}
          </motion.div>

          <button
            type="button"
            onClick={() => goToIndex(carouselIndex - 1)}
            disabled={isAtStart}
            aria-label="Предыдущий педагог"
            className="absolute left-2 top-1/3 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2.5 text-ink shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-0 md:flex"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={() => goToIndex(carouselIndex + 1)}
            disabled={isAtEnd}
            aria-label="Следующий педагог"
            className="absolute right-2 top-1/3 z-10 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/80 p-2.5 text-ink shadow-md backdrop-blur-md transition hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 disabled:cursor-not-allowed disabled:opacity-0 md:flex"
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
              aria-label={`Перейти к педагогу ${i + 1}`}
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
