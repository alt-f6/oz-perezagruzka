"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { requireSessionUser } from "@/shared/lib/auth";
import type { ActionResult } from "@/crm/lib/types";

const FreezePeriodSchema = z
  .object({
    startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
    endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Дата в формате YYYY-MM-DD"),
  })
  .refine((v) => v.startDate <= v.endDate, {
    message: "Дата окончания раньше даты начала",
  });

export async function createFreeze(
  studentId: string,
  values: unknown,
): Promise<ActionResult> {
  try {
    await requireSessionUser(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав" };
  }

  const parsed = FreezePeriodSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректный период" };
  }

  try {
    const student = await db.student.findUnique({
      where: { id: studentId },
      select: { id: true },
    });
    if (!student) {
      return { error: "Ученик не найден" };
    }

    await db.freeze.create({
      data: {
        studentId,
        startDate: new Date(`${parsed.data.startDate}T00:00:00.000Z`),
        endDate: new Date(`${parsed.data.endDate}T00:00:00.000Z`),
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания заморозки",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}

export async function deleteFreeze(freezeId: string): Promise<ActionResult> {
  try {
    await requireSessionUser(["ADMIN", "MANAGER"]);
  } catch {
    return { error: "Недостаточно прав" };
  }

  let studentId: string;
  try {
    const freeze = await db.freeze.findUnique({
      where: { id: freezeId },
      select: { studentId: true },
    });
    if (!freeze) {
      return { error: "Заморозка не найдена" };
    }
    studentId = freeze.studentId;

    await db.freeze.delete({ where: { id: freezeId } });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка удаления заморозки",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}
