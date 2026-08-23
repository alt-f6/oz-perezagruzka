"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import { studentSchema, balanceAdjustmentSchema, type StudentValues } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import type { ActionResult } from "@/crm/lib/types";

export async function createStudent(
  values: StudentValues,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные студента" };
  }

  try {
    await db.$transaction(async (tx) => {
      const student = await tx.student.create({
        data: { fullName: parsed.data.name, phone: parsed.data.phone || null },
        select: { id: true },
      });

      if (parsed.data.groupId) {
        await tx.groupStudent.create({
          data: { groupId: parsed.data.groupId, studentId: student.id },
        });
      }
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания студента",
    };
  }

  revalidatePath("/students");
  revalidatePath("/groups");
  return {};
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  try {
    await db.student.update({
      where: { id: studentId },
      data: { deletedAt: new Date() },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка удаления студента",
    };
  }

  revalidatePath("/students");
  return {};
}

export async function assignStudentToGroup(
  studentId: string,
  groupId: string,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  try {
    await db.groupStudent.upsert({
      where: { groupId_studentId: { groupId, studentId } },
      create: { groupId, studentId },
      update: {},
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка назначения группы",
    };
  }

  revalidatePath("/students");
  revalidatePath("/groups");
  return {};
}

export async function removeStudentFromGroup(
  studentId: string,
  groupId: string,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  try {
    await db.groupStudent.delete({
      where: { groupId_studentId: { groupId, studentId } },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка удаления из группы",
    };
  }

  revalidatePath("/students");
  revalidatePath("/groups");
  return {};
}

export async function updateStudentBalance(
  studentId: string,
  amount: number,
  description: string,
): Promise<ActionResult> {
  await requireRole(["ADMIN"]);

  const parsed = balanceAdjustmentSchema.safeParse({ amount, description });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректная сумма" };
  }

  try {
    await db.transaction.create({
      data: {
        studentId: studentId,
        amount: parsed.data.amount,
        type: parsed.data.amount >= 0 ? "PAYMENT" : "ADJUSTMENT",
        description: parsed.data.description || "Ручное изменение баланса администратором",
        // Manual admin adjustment has no natural external dedup key; a fresh
        // UUID satisfies the required unique constraint without colliding.
        idempotencyKey: randomUUID(),
      },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания транзакции",
    };
  }

  revalidatePath("/students");
  return {};
}
