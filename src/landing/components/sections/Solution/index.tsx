"use client";

import dynamic from "next/dynamic";
import Section from "@/landing/components/ui/Section";

const AITutor = dynamic(() => import("./AITutor"), {
  loading: () => (
    <div className="py-12 md:py-20">
      <div className="mx-auto max-w-3xl rounded-3xl border border-brand-100/50 bg-white/80 p-6 text-center text-ink-500 shadow-xl shadow-brand-950/5 backdrop-blur-md md:p-8">
        Загрузка демо...
      </div>
    </div>
  ),
});

// Fair pros/cons in the "marketing from abundance" voice: each option gets
// its real strength named before its limitation, no put-downs.
const APPROACHES = [
  {
    title: "Массовые онлайн-платформы",
    plus: "Доступная цена и много готовых материалов.",
    minus:
      "Программа рассчитана на тысячи учеников, и под особенности конкретного ребёнка её никто не подстраивает.",
  },
  {
    title: "Частный репетитор",
    plus: "Искренне вовлечён и занимается с ребёнком один на один.",
    minus:
      "Стоит ощутимых денег, а качество подготовки со стороны никто не проверяет — пробелы родители нередко видят уже по результатам экзамена.",
  },
];

// Human support comes first so the AI tutor reads as an addition to live
// teaching. Every line restates a fact already published elsewhere on the
// landing (pricing features, FAQ, regional curator notes).
const HUMAN_SUPPORT = [
  {
    title: "Живой педагог",
    body: "Ведёт занятия в мини-группе, знает каждого ученика и проверяет задания в чате поддержки.",
  },
  {
    title: "Методист",
    body: "Проверяет работу каждого педагога и сверяет прогресс ребёнка с программой, чтобы пробелы были видны задолго до экзамена.",
  },
  {
    title: "Отчёт каждые 2 недели",
    body: "Результаты пробников, темы, которым нужно внимание, и заметки учителя о вовлечённости — вам на руки.",
  },
  {
    title: "Куратор",
    body: "На связи в мессенджере, отвечает на организационные вопросы и следит за сроками приёмной кампании.",
  },
];

const TRACK_RECORD = [
  { value: "9 лет", label: "готовим к экзаменам" },
  { value: "5000+", label: "выпускников" },
];

export default function Solution() {
  return (
    <Section id="solution" className="bg-transparent scroll-mt-20" paddingOverride="py-12 md:py-20">
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mt-2 mb-12 overflow-hidden rounded-[32px] border border-brand-200/80 bg-white/90 p-6 shadow-xl shadow-brand-900/5 backdrop-blur-md sm:p-8 md:p-12">
          <div className="mb-8 max-w-3xl">
            <h3 className="font-bold leading-tight tracking-tight text-ink-900 text-balance">
              Почему у ребёнка не получается сдать на проходной балл, даже когда он готовится?
            </h3>
            <p className="mt-4 text-base leading-relaxed text-ink-700 md:text-lg">
              Чаще всего причина в устройстве подготовки. Ребёнок старается, но выбранный формат
              не видит его конкретных пробелов, и силы уходят мимо цели. Вот как это выглядит у
              двух самых популярных вариантов.
            </p>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            {APPROACHES.map((approach) => (
              <div key={approach.title} className="rounded-3xl border border-ink-100 bg-ink-50/70 p-6 md:p-8">
                <h4 className="text-lg font-bold text-ink-900">{approach.title}</h4>
                <p className="mt-4 flex gap-3 text-sm font-medium leading-relaxed text-ink-700 md:text-base">
                  <span className="shrink-0 font-black text-brand-600" aria-label="Плюс">+</span>
                  <span>{approach.plus}</span>
                </p>
                <p className="mt-3 flex gap-3 text-sm leading-relaxed text-ink-600 md:text-base">
                  <span className="shrink-0 font-black text-ink-400" aria-label="Минус">−</span>
                  <span>{approach.minus}</span>
                </p>
              </div>
            ))}
          </div>

          <div className="relative mt-6 rounded-3xl border-2 border-brand-300 bg-brand-50/80 p-6 pt-8 shadow-xl shadow-brand-900/5 md:p-8 md:pt-10">
            <div className="absolute -top-3 left-6 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-900 shadow-sm">
              Наш формат
            </div>
            <h4 className="text-lg font-bold text-brand-700">
              Мы собрали сильные стороны обоих вариантов
            </h4>
            <p className="mt-3 text-sm font-medium leading-relaxed text-ink-800 md:text-base">
              Мини-группа, в которой педагог знает каждого ученика и видит его ошибки, — как у
              хорошего репетитора. И методический контроль над каждым педагогом, благодаря которому
              пробелы становятся заметны задолго до экзамена.
            </p>
          </div>
        </div>

        <div className="mb-12">
          <h3 className="text-center font-bold leading-tight tracking-tight text-ink-900 text-balance">
            Ребёнок не остаётся один на один с вопросами
          </h3>
          <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {HUMAN_SUPPORT.map((item) => (
              <div
                key={item.title}
                className="rounded-3xl border border-brand-100 bg-white/90 p-6 shadow-sm shadow-brand-900/5"
              >
                <p className="font-bold text-ink-900">{item.title}</p>
                <p className="mt-2 text-sm leading-relaxed text-ink-600">{item.body}</p>
              </div>
            ))}
          </div>

          <div className="mt-8 flex flex-wrap items-stretch justify-center gap-4">
            {TRACK_RECORD.map((stat) => (
              <div
                key={stat.label}
                className="min-w-[160px] rounded-3xl bg-electric px-8 py-6 text-center text-white shadow-lg shadow-brand-900/20"
              >
                <p className="text-4xl font-black md:text-5xl">{stat.value}</p>
                <p className="mt-1 text-sm font-semibold text-white/85">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mx-auto max-w-3xl text-center">
          <h3 className="font-bold leading-tight tracking-tight text-ink-900 text-balance">
            А между занятиями — ИИ-репетитор
          </h3>
          <p className="mt-4 text-base leading-relaxed text-ink-700 md:text-lg">
            Он дополняет живые занятия и построен на методике наших преподавателей и их многолетнем
            опыте подготовки к ОГЭ и ЕГЭ. Если домашка встала в десять вечера, ребёнку не нужно ждать
            следующего урока: ИИ-репетитор объяснит тему простыми словами, а то, что останется
            непонятным, педагог разберёт на занятии.
          </p>
        </div>
      </div>

      <AITutor />
    </Section>
  );
}
