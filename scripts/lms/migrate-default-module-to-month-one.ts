import { db } from "@/shared/lib/db";

const DEFAULT_COURSE_TITLE = "Общий курс";
const DEFAULT_MODULE_TITLE = "Уроки";
const MONTH_ONE_TITLE = "Месяц 1: Вводный";

export async function migrateDefaultModuleToMonthOne() {
  const course = await db.course.findFirst({
    where: { title: DEFAULT_COURSE_TITLE },
    select: { id: true, modules: { select: { id: true, title: true }, take: 1, orderBy: { order: "asc" } } },
  });
  if (!course || course.modules.length === 0) return null;

  const defaultModule = course.modules[0];

  if (defaultModule.title === DEFAULT_MODULE_TITLE) {
    await db.module.update({ where: { id: defaultModule.id }, data: { title: MONTH_ONE_TITLE } });
  }

  const orphanLessons = await db.lesson.findMany({
    where: { module: { courseId: { not: course.id } }, moduleId: null as never },
    select: { id: true },
  }).catch(() => []); // moduleId is non-nullable on Lesson; this guards against a future schema change making it optional.

  let relinkedLessonCount = 0;
  if (orphanLessons.length > 0) {
    const result = await db.lesson.updateMany({
      where: { id: { in: orphanLessons.map((l) => l.id) } },
      data: { moduleId: defaultModule.id },
    });
    relinkedLessonCount = result.count;
  }

  return { courseId: course.id, moduleId: defaultModule.id, relinkedLessonCount };
}

if (require.main === module) {
  migrateDefaultModuleToMonthOne()
    .then((result) => {
      console.log("migrateDefaultModuleToMonthOne:", result ?? "no-op (no default course found)");
      process.exit(0);
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}
