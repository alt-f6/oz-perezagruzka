"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import Section from "@/landing/components/ui/Section";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

type ChatEvidence = {
  type: "chat";
  title: string;
  messages: { role: "student" | "tutor"; text: string }[];
};

type ReportEvidence = {
  type: "report";
  title: string;
  metrics: { label: string; before: number; after: number; max: number }[];
};

type CaseStudyEvidence = ChatEvidence | ReportEvidence;

interface CaseStudy {
  id: string;
  studentInitials: string;
  grade: string;
  subject: string;
  problem: string;
  solution: string;
  result: string;
  scoreBefore: number;
  scoreAfter: number;
  evidence: CaseStudyEvidence;
}

const CASE_STUDIES: CaseStudy[] = [
  {
    id: "milana-math",
    studentInitials: "МК",
    grade: "9 класс",
    subject: "Математика",
    problem: "Боялась текстовых задач, ступор на пробниках, тройка по четверти.",
    solution: "6 недель разборов по шаблонам ОГЭ + ИИ-репетитор для тренировки перед сном.",
    result: "Сдала пробник на 4, ушёл страх перед задачей №21.",
    scoreBefore: 3.1,
    scoreAfter: 4.3,
    evidence: {
      type: "report",
      title: "Отчёт по пробнику — Математика",
      metrics: [
        { label: "Алгебра", before: 12, after: 21, max: 25 },
        { label: "Геометрия", before: 4, after: 9, max: 12 },
        { label: "Практика", before: 6, after: 10, max: 12 },
      ],
    },
  },
  {
    id: "artem-russian",
    studentInitials: "АС",
    grade: "8 класс",
    subject: "Русский язык",
    problem: "Не мог сформулировать сочинение, писал «из-под палки», конфликт с мамой на этой почве.",
    solution: "Живой учитель разобрал структуру сочинения, ИИ-репетитор тренировал черновики каждый день.",
    result: "Первое сочинение, которым сам гордился — мама перестала стоять над душой.",
    scoreBefore: 3.4,
    scoreAfter: 4.5,
    evidence: {
      type: "chat",
      title: "Переписка с ИИ-репетитором",
      messages: [
        { role: "student", text: "Не понимаю, с чего начать сочинение 9.3" },
        { role: "tutor", text: "Начни с тезиса в одном предложении. Какая тема тебе ближе?" },
        { role: "student", text: "Про дружбу, наверное" },
        { role: "tutor", text: "Отлично. Запиши: «Дружба — это...» и закончи мысль. Дальше разберём аргументы." },
      ],
    },
  },
  {
    id: "sofia-oge",
    studentInitials: "СП",
    grade: "9 класс",
    subject: "Информатика",
    problem: "Готовилась в одиночку по видео с YouTube, не с кем было проверить решения.",
    solution: "Мини-группа + разбор реальных заданий ОГЭ прошлых лет с учителем.",
    result: "Уверенно решает задачи на программирование, идёт на 5 по итогам четверти.",
    scoreBefore: 3.6,
    scoreAfter: 4.8,
    evidence: {
      type: "report",
      title: "Отчёт по пробнику — Информатика",
      metrics: [
        { label: "Теория", before: 7, after: 11, max: 12 },
        { label: "Практика", before: 5, after: 9, max: 10 },
      ],
    },
  },
];

// Color-code the subject tag per category so cards read as distinct at a
// glance instead of one flat style for every tag.
const SUBJECT_TAG_STYLES: Record<string, string> = {
  "Математика": "bg-brand-50 text-brand-700",
  "Русский язык": "bg-accent-50 text-accent-700",
  "Информатика": "bg-brand-50 text-brand-700",
};
const DEFAULT_TAG_STYLE = "bg-brand-50 text-brand-700";

export default function SocialProof() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const prefersReducedMotion = useReducedMotion();

  const cardVariants = fadeInUp(prefersReducedMotion);

  const activeCase = CASE_STUDIES.find((c) => c.id === activeId) ?? null;

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
      new Set(CASE_STUDIES.map((_, i) => Math.round(Math.min(i * step, maxScrollLeft)))),
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

  return (
    <Section id="social-proof" className="scroll-mt-20" paddingOverride="py-16 md:py-24">
      <Atmosphere variant="mixed" intensity="premium" />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mb-12 text-center">
          <span className="inline-block rounded-full border border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-bold text-brand-700">
            80% родителей — по рекомендации
          </span>
          <h2 className="mt-5 font-bold tracking-tight text-ink-900">
            Как выглядит прогресс ученика
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-ink-600">
            Типичный путь ученика «Перезагрузки» — с примерами отчётов и переписки с ИИ-репетитором,
            а не абстрактными цифрами.
          </p>
          <p className="mx-auto mt-2 max-w-xl text-xs font-medium text-ink-500">
            Истории ниже — обобщённые (композитные) примеры на основе реальных занятий центра, а не
            цитаты конкретных учеников.
          </p>
        </div>

        <motion.div
          ref={trackRef}
          role="region"
          aria-label="Истории учеников"
          variants={staggerContainer(0.12)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex gap-5 overflow-x-auto pb-4 pr-6 snap-x snap-mandatory [&::-webkit-scrollbar]:hidden md:grid md:grid-cols-3 md:overflow-visible md:pb-0 md:pr-0 md:[scrollbar-width:auto]"
        >
          {CASE_STUDIES.map((study) => (
            <motion.div
              key={study.id}
              variants={cardVariants}
              transition={{ duration: 0.4, ease: "easeOut" }}
              className="w-[85%] shrink-0 snap-center md:w-auto md:shrink"
            >
              <CaseStudyCard study={study} onViewEvidence={() => setActiveId(study.id)} />
            </motion.div>
          ))}
        </motion.div>

        <div className="mt-4 flex justify-center gap-1.5 md:hidden">
          {scrollTargets.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goToIndex(i)}
              aria-label={`Перейти к истории ${i + 1}`}
              aria-current={i === carouselIndex}
              className={`h-1.5 rounded-full transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 ${
                i === carouselIndex ? "w-5 bg-brand-500" : "w-1.5 bg-ink-200 hover:bg-ink-300"
              }`}
            />
          ))}
        </div>
      </div>

      <EvidenceModal study={activeCase} onClose={() => setActiveId(null)} />
    </Section>
  );
}

function CaseStudyCard({
  study,
  onViewEvidence,
}: {
  study: CaseStudy;
  onViewEvidence: () => void;
}) {
  const tagStyle = SUBJECT_TAG_STYLES[study.subject] ?? DEFAULT_TAG_STYLE;
  const prefersReducedMotion = useReducedMotion();

  return (
    <motion.article
      whileHover={prefersReducedMotion ? undefined : { scale: 1.02, y: -5 }}
      transition={{ type: "spring", stiffness: 90, damping: 18 }}
      className="rounded-2xl border border-white/40 bg-white/70 shadow-card backdrop-blur-xl p-6 flex h-full flex-col transition-shadow duration-300 hover:border-brand-300 hover:shadow-card-hover"
    >
      <div className="mb-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-brand-500 text-sm font-bold text-white">
          {study.studentInitials}
        </div>
        <div>
          <p className="text-sm font-semibold text-ink-900">{study.grade}</p>
          <p className="text-xs text-ink-500">{study.subject} · обобщённый пример</p>
        </div>
        <span className={`ml-auto whitespace-nowrap rounded-full px-3 py-1 text-xs font-semibold ${tagStyle}`}>
          {study.scoreBefore.toFixed(1)} → {study.scoreAfter.toFixed(1)}
        </span>
      </div>

      <dl className="flex-1 space-y-3 text-sm">
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-ink-500">Проблема</dt>
          <dd className="mt-1 leading-relaxed text-ink-600">{study.problem}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-brand-600">Решение</dt>
          <dd className="mt-1 leading-relaxed text-ink-600">{study.solution}</dd>
        </div>
        <div>
          <dt className="text-xs font-semibold uppercase tracking-wide text-accent-600">Результат</dt>
          <dd className="mt-1 leading-relaxed text-ink-900">{study.result}</dd>
        </div>
      </dl>

      <button
        type="button"
        onClick={onViewEvidence}
        className="mt-auto w-full rounded-xl border border-brand-300 py-2.5 text-sm font-semibold text-brand-700 transition-all duration-100 ease-out hover:bg-brand-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
      >
        Смотреть доказательство
      </button>
    </motion.article>
  );
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])';

function EvidenceModal({ study, onClose }: { study: CaseStudy | null; onClose: () => void }) {
  const prefersReducedMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  // Focus management: remember the trigger, move focus into the dialog on
  // open, restore it on close. Tab/Shift+Tab cycle inside the dialog only.
  useEffect(() => {
    if (!study) return;
    previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
    closeButtonRef.current?.focus();
    return () => {
      previouslyFocusedRef.current?.focus?.();
    };
  }, [study]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;

      if (e.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose],
  );

  return (
    <AnimatePresence>
      {study && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/50 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          onKeyDown={onKeyDown}
        >
          <motion.div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-label={study.evidence.title}
            initial={prefersReducedMotion ? undefined : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="max-h-[85vh] w-full max-w-md overflow-y-auto overscroll-contain rounded-3xl border border-ink-100 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold tracking-tight text-ink-900">
                {study.evidence.title}
              </h3>
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                aria-label="Закрыть"
                className="rounded-full p-1 text-ink-400 transition-all duration-100 ease-out hover:bg-ink-100 hover:text-ink-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
              >
                ✕
              </button>
            </div>

            {study.evidence.type === "chat" ? (
              <ChatEvidenceView evidence={study.evidence} />
            ) : (
              <ReportEvidenceView evidence={study.evidence} />
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChatEvidenceView({ evidence }: { evidence: ChatEvidence }) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-ink-50 p-4">
      {evidence.messages.map((message, i) => (
        <div
          key={i}
          className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
            message.role === "student"
              ? "ml-auto bg-brand-500 text-white"
              : "mr-auto bg-white text-ink-900 border border-ink-100"
          }`}
        >
          {message.text}
        </div>
      ))}
    </div>
  );
}

function ReportEvidenceView({ evidence }: { evidence: ReportEvidence }) {
  return (
    <div className="space-y-4">
      {evidence.metrics.map((metric) => {
        const beforePct = Math.round((metric.before / metric.max) * 100);
        const afterPct = Math.round((metric.after / metric.max) * 100);
        return (
          <div key={metric.label}>
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="font-medium text-ink-900">{metric.label}</span>
              <span className="text-ink-500">
                {metric.before} → {metric.after} из {metric.max}
              </span>
            </div>
            <div className="relative h-2.5 overflow-hidden rounded-full bg-ink-100">
              <div className="absolute inset-y-0 left-0 rounded-full bg-ink-200" style={{ width: `${beforePct}%` }} />
              <div className="absolute inset-y-0 left-0 rounded-full bg-brand-500" style={{ width: `${afterPct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}
