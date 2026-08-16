"use server";

import { revalidatePath } from "next/cache";
import { studentSchema, type StudentValues } from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireSessionUser } from "@/shared/lib/auth";
import type { ActionResult } from "@/crm/lib/types";

export async function createStudent(
  values: StudentValues,
): Promise<ActionResult> {
  await requireSessionUser(["ADMIN", "MANAGER"]);

  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные студента" };
  }

  let student;
  try {
    student = await db.student.create({
      data: { fullName: parsed.data.name, phone: parsed.data.phone || null },
      select: { id: true },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания студента",
    };
  }

  if (parsed.data.groupId) {
    try {
      await db.groupStudent.create({
        data: { groupId: parsed.data.groupId, studentId: student.id },
      });
    } catch (err) {
      return {
        error: err instanceof Error ? err.message : "Ошибка привязки к группе",
      };
    }
  }

  revalidatePath("/students");
  revalidatePath("/groups");
  return {};
}

export async function deleteStudent(studentId: string): Promise<ActionResult> {
  await requireSessionUser(["ADMIN"]);

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
  await requireSessionUser(["ADMIN", "MANAGER"]);

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
  await requireSessionUser(["ADMIN", "MANAGER"]);

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
  await requireSessionUser(["ADMIN"]);

  try {
    await db.transaction.create({
      data: {
        studentId: studentId,
        amount: amount,
        type: amount >= 0 ? "PAYMENT" : "ADJUSTMENT",
        description: description || "Ручное изменение баланса администратором",
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
