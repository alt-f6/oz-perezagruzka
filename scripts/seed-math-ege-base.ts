/**
 * Seed script: «Математика ЕГЭ (Базовая)» course with its 13 interactive
 * HTML presentation lessons.
 *
 * Idempotent: Course/Module/Lesson have no slug column, so this follows this
 * repo's existing seed idiom (see scripts/seed-crm-test-data.ts) — findFirst
 * by a natural key, create if missing, update if present. LessonMedia rows
 * use a real upsert() against their @@unique([lessonId, order]) constraint.
 *
 * Run: npx tsx scripts/seed-math-ege-base.ts
 */
import "dotenv/config";
import { db } from "@/shared/lib/db";

const COURSE_TITLE = "Математика ЕГЭ (Базовая)";
const MODULE_TITLE = "Теория и интерактивная практика";
const SYSTEM_TEACHER_EMAIL = "system-math-ege-base@perezagruzka-edu.ru";

const LESSONS: { file: string; title: string }[] = [
  { file: "01_Vychisleniya.html", title: "01. Вычисления" },
  { file: "02_Ocenka-velichin.html", title: "02. Оценка величин" },
  { file: "03_Tablicy-diagrammy.html", title: "03. Таблицы и диаграммы" },
  { file: "04_Veroyatnost.html", title: "04. Вероятность" },
  { file: "05_Funkciya-proizvodnaya.html", title: "05. Функция и производная" },
  { file: "06_Logika-mnozhestva.html", title: "06. Логика и множества" },
  { file: "07_Planimetriya.html", title: "07. Планиметрия" },
  { file: "08_Stereometriya.html", title: "08. Стереометрия" },
  { file: "09_Stepeni-korni-logarifmy.html", title: "09. Степени, корни, логарифмы" },
  { file: "10_Uravneniya.html", title: "10. Уравнения" },
  { file: "11_Neravenstva.html", title: "11. Неравенства" },
  { file: "12_Chisla-po-usloviyu.html", title: "12. Числа по условию" },
  { file: "13_Tekstovye-zadachi-dvizhenie.html", title: "13. Текстовые задачи на движение" },
];

async function resolveTeacherId(): Promise<string> {
  const existing = await db.user.findFirst({ where: { role: "TEACHER" }, select: { id: true } });
  if (existing) return existing.id;

  const placeholder = await db.user.upsert({
    where: { email: SYSTEM_TEACHER_EMAIL },
    update: {},
    create: {
      email: SYSTEM_TEACHER_EMAIL,
      passwordHash: null,
      role: "TEACHER",
      fullName: "Математика ЕГЭ (системный владелец курса)",
    },
  });
  console.log(`✅ No TEACHER found — created placeholder owner ${SYSTEM_TEACHER_EMAIL}`);
  return placeholder.id;
}

async function main() {
  const teacherId = await resolveTeacherId();

  let course = await db.course.findFirst({ where: { title: COURSE_TITLE } });
  if (!course) {
    course = await db.course.create({
      data: { title: COURSE_TITLE, teacherId, isPublished: true },
    });
    console.log(`✅ Course "${COURSE_TITLE}" created`);
  } else {
    course = await db.course.update({
      where: { id: course.id },
      data: { isPublished: true },
    });
    console.log(`✅ Course "${COURSE_TITLE}" already exists — re-published`);
  }

  let module_ = await db.module.findFirst({ where: { courseId: course.id, title: MODULE_TITLE } });
  if (!module_) {
    module_ = await db.module.create({
      data: { courseId: course.id, title: MODULE_TITLE, order: 1 },
    });
    console.log(`✅ Module "${MODULE_TITLE}" created`);
  } else {
    console.log(`✅ Module "${MODULE_TITLE}" already exists`);
  }

  for (let i = 0; i < LESSONS.length; i++) {
    const { file, title } = LESSONS[i];
    const order = i + 1;
    const contentUrl = `/courses/math-ege-base/${file}`;

    let lesson = await db.lesson.findFirst({ where: { moduleId: module_.id, order } });
    if (!lesson) {
      lesson = await db.lesson.create({
        data: { moduleId: module_.id, title, order, isPublished: true },
      });
      console.log(`✅ Lesson "${title}" created`);
    } else {
      lesson = await db.lesson.update({
        where: { id: lesson.id },
        data: { title, isPublished: true },
      });
      console.log(`✅ Lesson "${title}" already exists — updated`);
    }

    await db.lessonMedia.upsert({
      where: { lessonId_order: { lessonId: lesson.id, order: 1 } },
      update: { kind: "presentation", url: contentUrl, embedUrl: contentUrl, provider: "static", isPublic: true },
      create: {
        lessonId: lesson.id,
        kind: "presentation",
        title,
        url: contentUrl,
        embedUrl: contentUrl,
        provider: "static",
        order: 1,
        isPublic: true,
      },
    });
  }

  console.log(`✅ Seeded ${LESSONS.length} lessons under "${COURSE_TITLE}" / "${MODULE_TITLE}"`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await db.$disconnect();
  });
