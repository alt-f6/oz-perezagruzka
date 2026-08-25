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
    "2 предмета к заявлению на ОГЭ и почему именно они",
    "5 колледжей/вузов со специальностями и баллами",
  ],
  ege: [
    "2 предмета к заявлению на ЕГЭ и почему именно они",
    "5 вузов со специальностями и баллами",
  ],
};

export const PAIN_POINTS_TITLE: Record<ExamType, string> = {
  oge: "У него есть голова. Просто в мае не хватило нескольких баллов — и теперь вы платите за то, что могло быть бесплатным",
  ege: "Не хватит баллов для того направления, о котором он мечтает — а второй попытки в этом году уже не будет",
};

export interface ProcessStep {
  title: string;
  desc: string;
}

export const HOW_IT_WORKS_STEPS: Record<ExamType, ProcessStep[]> = {
  oge: [
    { title: "Куда собирается", desc: "Куда собирается после 9 класса." },
    { title: "Смотрим варианты", desc: "Смотрим варианты — колледж или профильный класс." },
    { title: "Считаем целевой балл", desc: "Считаем целевой балл под выбранное направление." },
    { title: "Сверяем с уровнем", desc: "Сверяем целевой балл с текущим уровнем ребёнка." },
    { title: "Показываем разрыв", desc: "Показываем разрыв между целевым и текущим баллом." },
    { title: "Считаем цену", desc: "Считаем цену платного обучения на выбранное направление." },
    {
      title: "Берёмся или нет",
      desc: "Берёмся или нет — если берёмся, балл фиксируем в договоре, не выводим — возвращаем деньги.",
    },
  ],
  ege: [
    { title: "Куда поступает", desc: "Куда собирается поступать." },
    { title: "Подбираем вузы", desc: "Подбираем варианты вузов под цели ребёнка." },
    { title: "Проходные баллы", desc: "Проходные баллы прошлых лет по этим вузам." },
    { title: "Сверяем с уровнем", desc: "Сверяем проходные баллы с текущим уровнем ребёнка." },
    { title: "Показываем разрыв", desc: "Показываем разрыв и проверяем предметы под требования вузов." },
    { title: "Считаем цену", desc: "Считаем цену платного обучения на выбранное направление." },
    {
      title: "Берёмся или нет",
      desc: "Берёмся или нет — если берёмся, балл фиксируем в договоре, не выводим — возвращаем деньги.",
    },
  ],
};

export const HOW_IT_WORKS_FOOTER = "Бесплатно · 20–30 минут · без обязательств · берём только после разбора";

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

export interface PricingPlanContent {
  id: string;
  name: string;
  price: string;
  description: string;
  isBestValue?: boolean;
}

export const PRICING_PLANS: Record<ExamType, PricingPlanContent[]> = {
  oge: [
    { id: "1-subject", name: "1 предмет", price: "8 000 ₽", description: "Для тех, кому нужно подтянуть один предмет к ОГЭ." },
    { id: "2-subjects", name: "2 предмета", price: "13 000 ₽", description: "Подготовка сразу по двум предметам — выгоднее и системнее.", isBestValue: true },
    { id: "3-subjects", name: "3 предмета", price: "15 000 ₽", description: "Полная подготовка сразу по трём предметам к ОГЭ." },
  ],
  ege: [
    { id: "1-subject", name: "1 предмет", price: "13 000 ₽", description: "Для тех, кому нужно подтянуть один предмет к ЕГЭ." },
    { id: "2-subjects", name: "2 предмета", price: "18 000 ₽", description: "Подготовка сразу по двум предметам — выгоднее и системнее.", isBestValue: true },
    { id: "3-subjects", name: "3 предмета", price: "20 000 ₽", description: "Полная подготовка сразу по трём предметам к ЕГЭ." },
  ],
};

export const WHAT_YOU_GET_ITEMS: Record<ExamType, string[]> = {
  oge: [
    "Целевой балл под ваши вузы/колледжи",
    "Текущий балл ребёнка по разбор-работе",
    "Разрыв между ними по заданиям",
    "Темы, где теряется больше всего баллов",
    "Таблица проходных баллов прошлого года",
    "Честный вердикт: реально ли закрыть разрыв",
    "Что делать ближайшие 3 месяца",
  ],
  ege: [
    "Целевой балл под ваши вузы/колледжи",
    "Текущий балл ребёнка по разбор-работе",
    "Разрыв между ними по заданиям",
    "Темы, где теряется больше всего баллов",
    "Сверка предметов с требованиями вузов",
    "Таблица проходных баллов прошлого года",
    "Честный вердикт: реально ли закрыть разрыв",
    "Что делать ближайшие 3 месяца",
  ],
};

export const WHAT_YOU_GET_FOOTER = "Три цифры, таблица и список тем — ваши, даже если вы не придёте учиться";
