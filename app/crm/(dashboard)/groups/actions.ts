"use server";

import { revalidatePath } from "next/cache";
import { createGroupSchema, type GroupValues } from "@/crm/lib/schemas";
import { requireSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import type { ActionResult } from "@/crm/lib/types";

export async function getTeachers() {
  await requireSessionUser(["ADMIN", "MANAGER", "TEACHER"]);

  try {
    const data = await db.user.findMany({
      where: { role: "TEACHER", isArchived: false },
      select: { id: true, fullName: true, role: true },
    });
    return data;
  } catch (error) {
    console.error("❌ Ошибка при получении учителей:", error);
    return [];
  }
}

export async function createGroup(
  values: GroupValues & { teacherId?: string; price?: number },
): Promise<ActionResult> {
  const sessionUser = await requireSessionUser(["ADMIN", "MANAGER"]);

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
  await requireSessionUser(["ADMIN"]);

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
