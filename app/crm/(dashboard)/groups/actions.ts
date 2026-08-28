"use server";

import { revalidatePath } from "next/cache";
import {
  createGroupSchema,
  updateGroupSchema,
  type GroupValues,
  type UpdateGroupValues,
} from "@/crm/lib/schemas";
import { requireRole } from "@/shared/lib/rbac";
import { db } from "@/shared/lib/db";
import type { ActionResult } from "@/crm/lib/types";
import { bulkCancelSessions, type BulkCancelResult } from "../lessons/actions";
import { createLogger } from "@/shared/lib/logger";

const logger = createLogger("crm.groups.actions");

/**
 * A client can only ever supply a teacherId string; whether it actually
 * names an active teacher must be re-checked server-side on every write.
 */
async function assertValidTeacherId(teacherId: string | null): Promise<string | null> {
  if (teacherId === null) return null;

  const teacher = await db.user.findUnique({
    where: { id: teacherId },
    select: { role: true, isArchived: true },
  });

  if (!teacher || teacher.role !== "TEACHER" || teacher.isArchived) {
    throw new Error("Выбранный преподаватель недоступен");
  }

  return teacherId;
}

export async function getTeachers() {
  await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  try {
    const data = await db.user.findMany({
      where: { role: "TEACHER", isArchived: false },
      select: { id: true, fullName: true, role: true },
    });
    return data;
  } catch (error) {
    logger.error("Ошибка при получении учителей", error);
    return [];
  }
}

export async function createGroup(
  values: GroupValues & { teacherId?: string; price?: number },
): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER"]);

  const parsed = createGroupSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные группы" };
  }

  const finalTeacherId = parsed.data.teacherId || sessionUser.id;

  try {
    await db.group.create({
      data: {
        name: parsed.data.name,
        teacherId: finalTeacherId,
        pricePerLesson: parsed.data.price ?? 0,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: message };
  }

  revalidatePath("/groups");
  return {};
}

export async function deleteGroup(groupId: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  try {
    await db.group.update({
      where: { id: groupId },
      data: { deletedAt: new Date() },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: message };
  }

  revalidatePath("/groups");
  revalidatePath("/students");
  revalidatePath("/lessons");
  return {};
}

export async function assignTeacherToGroup(
  groupId: string,
  teacherId: string | null,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  try {
    const validTeacherId = await assertValidTeacherId(teacherId);
    await db.group.update({
      where: { id: groupId },
      data: { teacherId: validTeacherId },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: message };
  }

  revalidatePath("/groups");
  return {};
}

export async function updateGroup(
  groupId: string,
  values: UpdateGroupValues,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = updateGroupSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные группы" };
  }

  try {
    const validTeacherId = await assertValidTeacherId(parsed.data.teacherId);
    await db.group.update({
      where: { id: groupId },
      data: {
        name: parsed.data.name,
        teacherId: validTeacherId,
        pricePerLesson: parsed.data.price,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: message };
  }

  revalidatePath("/groups");
  return {};
}

/**
 * "Clear upcoming schedule": cancels every future, still-scheduled session
 * in this group regardless of recurrence series. Delegates its RBAC and
 * transaction/scoping guarantees to bulkCancelSessions.
 */
export async function cancelGroupUpcomingSessions(
  groupId: string,
): Promise<BulkCancelResult> {
  return bulkCancelSessions({ groupId });
}
