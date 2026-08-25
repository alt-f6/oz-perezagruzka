"use client";

import dynamic from "next/dynamic";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Section from "@/landing/components/ui/Section";

const AITutor = dynamic(() => import("./AITutor"), {
  loading: () => (
    <div className="py-20 md:py-28">
      <div className="mx-auto max-w-3xl rounded-3xl border border-brand-100/50 bg-white/80 p-6 text-center text-ink-500 shadow-2xl shadow-brand-950/10 backdrop-blur-md md:p-8">
        Загрузка демо...
      </div>
    </div>
  ),
});

export default function Solution() {
  return (
      <Section id="solution" className="scroll-mt-20">
        <Atmosphere variant="brand" intensity="premium" />

        <div className="relative mx-auto max-w-6xl px-6">
          <div className="mt-4 mb-24 overflow-hidden rounded-[32px] border border-brand-100/80 bg-white/80 p-8 md:p-12 shadow-xl shadow-ink-900/5 backdrop-blur-md">
            <div className="max-w-3xl mb-10">
            <span className="inline-block rounded-full bg-brand-50 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-brand-700 mb-3">
              Честное сравнение подходов
            </span>
              <h3 className="font-bold leading-tight text-ink-900 tracking-tight text-balance">
                Разница между «посмотреть лекцию» и «разобраться лично»
              </h3>
            </div>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="rounded-3xl border border-ink-100 bg-ink-50/80 p-6 md:p-8 transition-all hover:border-ink-200">
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-ink-200 text-ink-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-ink-900 text-lg">Крупные платформы-гиганты</h4>
                </div>
                <p className="text-sm leading-relaxed text-ink-600 font-medium">
                  Масштабируются на тысячи учеников — ваш ребёнок там <span className="text-ink-800 font-semibold underline decoration-ink-400 decoration-2">один из безликого потока</span>. Учитель физически работает с усреднённым сценарием и не видит затыков конкретного подростка.
                </p>
                <p className="mt-3 text-xs leading-relaxed text-ink-500">
                  Часто это репетитор-одиночка: он один готовит методичку, ведёт документы и проверяет
                  себя сам — никто не перепроверяет качество занятий.
                </p>
              </div>

              <div className="relative rounded-3xl border-2 border-brand-300 bg-brand-50 p-6 pt-8 md:p-8 md:pt-10 shadow-xl shadow-brand-900/10">
                <div className="absolute -top-3 left-6 rounded-full bg-accent-500 px-3 py-1 text-xs font-bold uppercase tracking-wider text-ink-900 shadow-sm">
                  Наш формат
                </div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-brand-600">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <h4 className="font-bold text-brand-700 text-lg">Обучение в «Перезагрузке»</h4>
                </div>
                <p className="text-sm leading-relaxed text-ink-800 font-medium">
                  У нас строго <span className="bg-brand-100 text-brand-800 px-1.5 py-0.5 rounded font-bold">мини-группа</span>, поэтому учитель правда контролирует прогресс каждого. А персональный <span className="font-bold text-brand-700">ИИ-репетитор дополняет это 24/7</span> — он мгновенно объяснит тему, когда ребёнок сам готов задать вопрос.
                </p>
                <p className="mt-3 text-xs font-medium leading-relaxed text-brand-700">
                  У нас каждого учителя проверяет методист — поэтому учитель может на 100% сосредоточиться
                  на ученике, а не на администрировании и методичках.
                </p>
              </div>
            </div>
          </div>

        </div>

        <AITutor />
      </Section>
  );
}