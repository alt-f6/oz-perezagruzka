// Per-region copy for the three KhMAO geo-landing pages. Kept as plain data
// (mirrors the pattern in exam-content.ts) so RegionalHero/RegionalBenchmarks
// stay dumb presentational components and the copy can be unit-tested.

export type RegionSlug = "surgut" | "nizhnevartovsk" | "khanty-mansiysk";

export interface RegionBenchmark {
  name: string;
  detail: string;
}

export interface RegionContent {
  slug: RegionSlug;
  cityNominative: string;
  cityPrepositional: string;
  title: string;
  description: string;
  heroHeadline: string;
  heroSubcopy: string;
  benchmarks: RegionBenchmark[];
  scheduleNote: string;
  curatorNote: string;
  hasOffice: boolean;
  officeAddress?: string;
}

export const REGIONS: Record<RegionSlug, RegionContent> = {
  surgut: {
    slug: "surgut",
    cityNominative: "Сургут",
    cityPrepositional: "Сургуте",
    title: "Подготовка к ОГЭ и ЕГЭ в Сургуте | Онлайн-школа «Перезагрузка»",
    description:
      "Курсы подготовки к ОГЭ и ЕГЭ для школьников Сургута. Поступление в СурГУ, СурГПУ и ведущие вузы страны. Занятия в мини-группах с гарантией.",
    heroHeadline: "ОГЭ И ЕГЭ ДЛЯ ШКОЛЬНИКОВ СУРГУТА — С ГАРАНТИЕЙ РЕЗУЛЬТАТА",
    heroSubcopy:
      "Мини-группы, живой учитель и ИИ-репетитор на связи 24/7 — расписание встроено в учебный день сургутских школ, включая обе смены.",
    benchmarks: [
      {
        name: "СурГУ",
        detail:
          "Готовим к профильным экзаменам под конкретные направления Сургутского государственного университета — от медицины до IT.",
      },
      {
        name: "СурГПУ",
        detail:
          "Разбираем требования вступительных испытаний Сургутского государственного педагогического университета вместе с куратором.",
      },
    ],
    scheduleNote:
      "Занятия ставим с учётом обеих смен сургутских школ — ребёнок не выбирает между учёбой и подготовкой.",
    curatorNote:
      "Куратор на связи в мессенджере и следит за сроками приёмной кампании вузов ХМАО.",
    hasOffice: false,
  },
  nizhnevartovsk: {
    slug: "nizhnevartovsk",
    cityNominative: "Нижневартовск",
    cityPrepositional: "Нижневартовске",
    title: "Подготовка к ОГЭ и ЕГЭ в Нижневартовске | Онлайн-школа «Перезагрузка»",
    description:
      "Эффективная подготовка к ОГЭ и ЕГЭ в Нижневартовске. Поступление в НВГУ и вузы РФ. Мини-группы с сильными преподавателями.",
    heroHeadline: "ОГЭ И ЕГЭ В НИЖНЕВАРТОВСКЕ — ЦЕЛЕВОЙ БАЛЛ В ДОГОВОРЕ",
    heroSubcopy:
      "Бесплатный разбор с аудитом текущих баллов ребёнка, мини-группы с живым учителем и ИИ-репетитор на связи 24/7.",
    benchmarks: [
      {
        name: "НВГУ",
        detail:
          "Знаем проходные баллы и профильные предметы Нижневартовского государственного университета за последние годы.",
      },
      {
        name: "Аудит текущего балла",
        detail:
          "На бесплатном разборе показываем реальный разрыв до целевого балла — с конкретными цифрами, а не «в целом неплохо».",
      },
    ],
    scheduleNote:
      "Группы набираем по расписанию, удобному школьникам Нижневартовска — без привязки к конкретной школе или смене.",
    curatorNote:
      "Региональный куратор ведёт учеников Нижневартовска и отвечает на вопросы по приёмной кампании вузов ХМАО.",
    hasOffice: false,
  },
  "khanty-mansiysk": {
    slug: "khanty-mansiysk",
    cityNominative: "Ханты-Мансийск",
    cityPrepositional: "Ханты-Мансийске",
    title: "Подготовка к ОГЭ и ЕГЭ в Ханты-Мансийске | Ул. Калинина, 26",
    description:
      "Центр подготовки к экзаменам ОГЭ и ЕГЭ в Ханты-Мансийске. Ул. Калинина, 26. Мини-группы, сильные педагоги, гарантия целевого балла.",
    heroHeadline: "ЦЕНТР ПОДГОТОВКИ К ОГЭ И ЕГЭ В ХАНТЫ-МАНСИЙСКЕ",
    heroSubcopy:
      "Ул. Калинина, 26. Мини-группы, живой учитель и ИИ-репетитор на связи 24/7 — очно и онлайн.",
    benchmarks: [
      {
        name: "ЮГУ",
        detail: "Разбираем вступительные требования Югорского государственного университета по профильным направлениям.",
      },
      {
        name: "5.0 на Яндекс.Картах",
        detail: "Организация верифицирована на Яндекс.Картах — приходите, посмотрите отзывы и адрес перед записью.",
      },
    ],
    scheduleNote:
      "Занятия можно посещать очно в центре на ул. Калинина, 26, или онлайн — расписание единое.",
    curatorNote: "Куратор центра встречает лично и помогает выбрать формат подготовки на бесплатном разборе.",
    hasOffice: true,
    officeAddress: "ул. Калинина, 26, Ханты-Мансийск, ХМАО–Югра",
  },
};
