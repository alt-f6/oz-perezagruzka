"use client";

import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { useExam } from "@/landing/lib/exam-context";

export default function AttestatPredictable() {
  const { exam } = useExam();
  if (exam === "ege") return null;

  return (
    <Section tone="brand-wash">
      <div className="relative mx-auto max-w-3xl px-6 text-center">
        <h2 className="mb-8 font-bold tracking-tight text-ink-900 text-balance">
          Почему аттестат предсказуемее
        </h2>
        <Card tint="glass" rounded="3xl" className="mx-auto text-left">
          <p className="text-base leading-relaxed text-ink-700">
            Знали, что оценка по ОГЭ — это среднее годовой и экзаменационной? Годовая «5», экзамен
            «3» — в аттестате «4». Конкурс в колледж идёт по среднему баллу аттестата. Поэтому мы
            можем гарантировать балл уже в 9 классе.
          </p>
        </Card>
      </div>
    </Section>
  );
}
