import { db } from "@/shared/lib/db";

/**
 * 1-based position of a module within its course, using the same
 * [order asc, id asc] ordering every curriculum reader uses. This is what
 * Enrollment.accessThroughModule counts against.
 */
export async function getModulePosition(module: { id: string; courseId: string; order: number }): Promise<number> {
  const before = await db.module.count({
    where: {
      courseId: module.courseId,
      OR: [{ order: { lt: module.order } }, { order: module.order, id: { lt: module.id } }],
    },
  });
  return before + 1;
}
