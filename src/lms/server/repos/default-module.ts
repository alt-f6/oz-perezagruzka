import { db } from "@/shared/lib/db";

// Lesson admin UX is flat (no course/module picker anywhere), but the unified
// schema requires every Lesson to belong to a Module -> Course. This houses
// all lessons under one implicit course/module so the flat UX is unchanged.
const DEFAULT_COURSE_TITLE = "Общий курс";
const DEFAULT_MODULE_TITLE = "Уроки";

export async function getDefaultModuleId(ownerUserId: string): Promise<string> {
  const existing = await db.module.findFirst({
    where: { course: { title: DEFAULT_COURSE_TITLE } },
    select: { id: true },
  });
  if (existing) return existing.id;

  const course = await db.course.create({
    data: {
      title: DEFAULT_COURSE_TITLE,
      teacherId: ownerUserId,
      modules: { create: { title: DEFAULT_MODULE_TITLE, order: 0 } },
    },
    include: { modules: true },
  });

  return course.modules[0].id;
}
