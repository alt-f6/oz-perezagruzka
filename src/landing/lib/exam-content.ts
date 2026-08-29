import type { ExamType } from "@/landing/lib/exam-context";

// Central copy table for everything that changes shape between the OGE and
// EGE toggle states. Kept as plain data (not JSX) so it can be unit-tested
// and imported by any section without pulling in component code.

export const HERO_TITLE: Record<ExamType, string> = {
  oge: "ОГЭ С ГАРАНТИЕЙ:",
  ege: "ЕГЭ С ГАРАНТИЕЙ:",
};

export const HERO_GUARANTEE_BULLETS = [
  "Целевой балл прописываем в договоре.",
  "Не выводим — возвращаем стоимость.",
  "Берём только после разбора.",
];

export const HERO_SUBLIST_HEADER =
  "На разборе получите документ с конкретикой под вашего ребёнка:";

export const HERO_SUBLIST_ITEMS: Record<ExamType, string[]> = {
  oge: [
    "✅ 2 предмета к заявлению на ОГЭ и почему именно они",
    "✅ 5 колледжей/вузов со специальностями и баллами прошлого года и почему именно они",
  ],
  ege: [
    "✅ 2 предмета к заявлению на ЕГЭ и почему именно они",
    "✅ 5 вузов со специальностями и баллами прошлого года и почему именно они",
  ],
};

export const PAIN_POINTS_TITLE: Record<ExamType, string> = {
  oge: "У него есть голова. Просто в мае не хватило нескольких баллов — и теперь вы платите за то, что могло быть бесплатным",
  ege: "Если не хватит баллов для направления, о котором мечтает ребёнок, второй попытки в этом году уже не будет",
};

export type QuizGrade = "7" | "8" | "9" | "10" | "11";

export const QUIZ_GRADE_OPTIONS: Record<ExamType, { value: QuizGrade; label: string }[]> = {
  oge: [
    { value: "7", label: "7 класс" },
    { value: "8", label: "8 класс" },
    { value: "9", label: "9 класс" },
  ],
  ege: [
    { value: "10", label: "10 класс" },
    { value: "11", label: "11 класс" },
  ],
};

export const QUIZ_DEFAULT_GRADE: Record<ExamType, QuizGrade> = {
  oge: "8",
  ege: "10",
};

export const QUIZ_GRADE_STEP_HELPER: Record<ExamType, string> = {
  oge: "Это определяет структуру ОГЭ",
  ege: "Это определяет структуру ЕГЭ",
};

export const QUIZ_DEADLINE_STEP_TITLE: Record<ExamType, string> = {
  oge: "Сколько времени осталось до ОГЭ?",
  ege: "Сколько времени осталось до ЕГЭ?",
};

export const QUIZ_STUDY_STYLE_PANIC_DESC: Record<ExamType, string> = {
  oge: "Тяжело дается программа, боимся завалить ОГЭ",
  ege: "Тяжело дается программа, боимся завалить ЕГЭ",
};

export const RESULT_ATTENTION_ZONES_TITLE: Record<ExamType, string> = {
  oge: "Зоны внимания к ОГЭ",
  ege: "Зоны внимания к ЕГЭ",
};

export const RESULT_COPY_HEADER: Record<ExamType, string> = {
  oge: "📋 КАРТА ГОТОВНОСТИ К ОГЭ",
  ege: "📋 КАРТА ГОТОВНОСТИ К ЕГЭ",
};

export const LOADING_TRUST_MESSAGES: Record<ExamType, string[]> = {
  oge: [
    "ИИ-навигатор «Перезагрузки» изучает профиль ученика...",
    "Сопоставляем сильные стороны с программой ОГЭ...",
    "Формируем персональные рекомендации...",
  ],
  ege: [
    "ИИ-навигатор «Перезагрузки» изучает профиль ученика...",
    "Сопоставляем сильные стороны с программой ЕГЭ...",
    "Формируем персональные рекомендации...",
  ],
};

export const PREPARATION_AI_SKILL: Record<ExamType, string> = {
  oge: "Навык работы с ИИ остаётся после ОГЭ",
  ege: "Навык работы с ИИ остаётся после ЕГЭ",
};

export interface PricingTierContent {
  subjects: 1 | 2 | 3;
  label: string;
  price: string;
  pricePerSubject: string;
  isBestValue?: boolean;
}

export const PRICING_TIERS: Record<ExamType, PricingTierContent[]> = {
  oge: [
    { subjects: 1, label: "1 предмет", price: "8 000 ₽", pricePerSubject: "8 000 ₽ за предмет", isBestValue: true },
    { subjects: 2, label: "2 предмета", price: "13 000 ₽", pricePerSubject: "6 500 ₽ за предмет", isBestValue: true },
    { subjects: 3, label: "3 предмета", price: "15 000 ₽", pricePerSubject: "5 000 ₽ — самая низкая цена за предмет", isBestValue: true },
  ],
  ege: [
    { subjects: 1, label: "1 предмет", price: "13 000 ₽", pricePerSubject: "13 000 ₽ за предмет", isBestValue: true },
    { subjects: 2, label: "2 предмета", price: "18 000 ₽", pricePerSubject: "9 000 ₽ за предмет", isBestValue: true },
    { subjects: 3, label: "3 предмета", price: "20 000 ₽", pricePerSubject: "6 667 ₽ — самая низкая цена за предмет", isBestValue: true },
  ],
};
