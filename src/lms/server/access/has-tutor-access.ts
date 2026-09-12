import { db } from "@/shared/lib/db";

/**
 * A student has AI tutor access if they have at least one Assignment row at
 * all (any lesson) -- Assignment isn't tutor-specific, it's the existing
 * lesson-grant table, reused as the tutor entitlement signal per product
 * decision so admins keep using the existing Assignments UI to grant it.
 */
export async function hasTutorAccess(studentUserId: string): Promise<boolean> {
  const count = await db.assignment.count({ where: { studentId: studentUserId } });
  return count > 0;
}
