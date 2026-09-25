"use client";

import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import type { RegionContent } from "@/landing/data/regions";
import { reachGoal } from "@/landing/lib/analytics";
import { TRIAL_LESSON_CTA } from "@/landing/lib/exam-content";

export default function RegionalBenchmarks({ region }: { region: RegionContent }) {
  return (
    <Section tone="brand-wash">
      <div className="relative mx-auto max-w-5xl px-6">
        <h2 className="mb-8 text-center font-bold tracking-tight text-ink-900 text-balance">
          Почему подготовку в {region.cityPrepositional} стоит доверить нам
        </h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {region.benchmarks.map((benchmark) => (
            <Card key={benchmark.name} tint="premium" rounded="3xl" className="h-full">
              <p className="font-bold text-ink-900">{benchmark.name}</p>
              <p className="mt-2 text-sm leading-relaxed text-ink-600">{benchmark.detail}</p>
            </Card>
          ))}
          <Card tint="premium" rounded="3xl" className="h-full">
            <p className="font-bold text-ink-900">Расписание</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{region.scheduleNote}</p>
          </Card>
          <Card tint="premium" rounded="3xl" className="h-full">
            <p className="font-bold text-ink-900">Куратор</p>
            <p className="mt-2 text-sm leading-relaxed text-ink-600">{region.curatorNote}</p>
          </Card>
        </div>

        <div className="mx-auto mt-12 max-w-2xl text-center">
          <p className="text-lg font-semibold leading-relaxed text-ink-900 md:text-xl">
            Иногда одного-двух баллов достаточно, чтобы жизнь ребёнка пошла по благоприятному
            сценарию. Первый шаг — определить, к каким предметам готовиться.
          </p>
          <a
            href="#readiness-map"
            onClick={() => reachGoal("cta_analysis_click")}
            className="mt-6 inline-flex min-h-[60px] items-center justify-center rounded-2xl bg-brand-600 px-8 text-center text-lg font-bold text-white shadow-md shadow-brand-900/20 transition-all duration-300 hover:-translate-y-1 hover:bg-brand-700 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-98"
          >
            {TRIAL_LESSON_CTA}
          </a>
          <p className="mt-3 text-sm text-ink-600">
            На пробном уроке помогаем выбрать предметы, где у ребёнка больше потенциала.
          </p>
        </div>
      </div>
    </Section>
  );
}
