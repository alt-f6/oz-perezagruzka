import type { Prisma } from "@prisma/client";

import { db } from "@/shared/lib/db";

type Client = Prisma.TransactionClient | typeof db;

// Lesson.order is a 1..N position *within its module* (see the
// 20260924120000 migration, which renumbered the old global counter).
export async function nextLessonOrder(moduleId: string, client: Client = db): Promise<number> {
  const max = await client.lesson.aggregate({ where: { moduleId }, _max: { order: true } });
  return (max._max.order ?? 0) + 1;
}
