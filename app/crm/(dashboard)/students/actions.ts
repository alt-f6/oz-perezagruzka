"use server";

import { revalidatePath } from "next/cache";
import { randomUUID } from "crypto";
import {
  studentSchema,
  studentUpdateSchema,
  balanceAdjustmentSchema,
  type StudentValues,
  type StudentUpdateValues,
} from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { claimFirstPaymentOffer, sendFirstPaymentOffer } from "@/crm/lib/services/offer.service";
import { createLogger } from "@/shared/lib/logger";
import type { ActionResult } from "@/crm/lib/types";

const logger = createLogger("crm.students.actions");

// Maps an optional form string to a persisted value: "" / undefined → null.
function orNull(v: string | undefined | null): string | null {
  return v ? v : null;
}

// Prisma transaction client shape (the callback arg of db.$transaction).
type Tx = Parameters<Parameters<typeof db.$transaction>[0]>[0];

/**
 * Gracefully validates that `email` isn't already claimed — by another
 * (non-deleted) student, or by a User account that isn't this student's own.
 * Returns a friendly message to surface, or null when the email is free.
 * Deliberately a pre-check (not a DB unique constraint) so a collision never
 * escapes as a raw P2002. `email` is assumed already normalized (lowercased).
 */
async function emailCollisionError(
  tx: Tx,
  email: string,
  opts: { studentId?: string; ownUserId?: string | null },
): Promise<string | null> {
  const otherStudent = await tx.student.findFirst({
    where: {
      email,
      deletedAt: null,
      ...(opts.studentId ? { NOT: { id: opts.studentId } } : {}),
    },
    select: { id: true },
  });
  if (otherStudent) return "Этот email уже используется другим учеником.";

  const userWithEmail = await tx.user.findUnique({
    where: { email },
    select: { id: true },
  });
  if (userWithEmail && userWithEmail.id !== opts.ownUserId) {
    return "Этот email уже занят другим аккаунтом.";
  }

  return null;
}

export async function createStudent(
  values: StudentValues,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = studentSchema.safeParse(values);
  if (!parsed.success) {
    return { error: "Некорректные данные студента" };
  }

  try {
    const duplicatePhoneError = await db.$transaction(async (tx) => {
      if (parsed.data.phone) {
        const existingStudent = await tx.student.findUnique({
          where: { phone: parsed.data.phone },
          select: { id: true },
        });

        if (existingStudent) {
          return "Студент с таким номером телефона уже существует.";
        }
      }

      if (parsed.data.email) {
        const emailError = await emailCollisionError(tx, parsed.data.email, {});
        if (emailError) return emailError;
      }

      const student = await tx.student.create({
        data: {
          fullName: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email ?? null,
          parentName: orNull(parsed.data.parentName),
          parentPhone: parsed.data.parentPhone || null,
          comment: orNull(parsed.data.comment),
          grade: parsed.data.grade ?? null,
          examType: parsed.data.examType ?? null,
          subject: orNull(parsed.data.subject),
          school: orNull(parsed.data.school),
        },
        select: { id: true },
      });

      if (parsed.data.groupId) {
        await tx.groupStudent.create({
          data: { groupId: parsed.data.groupId, studentId: student.id },
        });
      }

      return null;
    });

    if (duplicatePhoneError) {
      return { error: duplicatePhoneError };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания студента",
    };
  }

  revalidatePath("/students");
  revalidatePath("/groups");
  return {};
}

/**
 * Persists edits to a student's profile card: name, phone, parent contact,
 * educational domain fields, and comment (DATA-01/DATA-03). Parent name/phone
 * are stored directly on the Student row so a save round-trips reliably and
 * reloads populated. Phone uniqueness is re-checked to surface a clear error
 * instead of a raw constraint violation.
 */
export async function updateStudent(
  studentId: string,
  values: StudentUpdateValues,
): Promise<ActionResult> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = studentUpdateSchema.safeParse(values);
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Некорректные данные студента",
    };
  }

  try {
    const duplicatePhoneError = await db.$transaction(async (tx) => {
      if (parsed.data.phone) {
        const existing = await tx.student.findUnique({
          where: { phone: parsed.data.phone },
          select: { id: true },
        });
        if (existing && existing.id !== studentId) {
          return "Студент с таким номером телефона уже существует.";
        }
      }

      if (parsed.data.email) {
        const current = await tx.student.findUnique({
          where: { id: studentId },
          select: { userId: true },
        });
        const emailError = await emailCollisionError(tx, parsed.data.email, {
          studentId,
          ownUserId: current?.userId ?? null,
        });
        if (emailError) return emailError;
      }

      await tx.student.update({
        where: { id: studentId },
        data: {
          fullName: parsed.data.name,
          phone: parsed.data.phone || null,
          email: parsed.data.email ?? null,
          parentName: orNull(parsed.data.parentName),
          parentPhone: parsed.data.parentPhone || null,
          comment: orNull(parsed.data.comment),
          grade: parsed.data.grade ?? null,
          examType: parsed.data.examType ?? null,
          subject: orNull(parsed.data.subject),
          school: orNull(parsed.data.school),
        },
      });

      return null;
    });

    if (duplicatePhoneError) {
      return { error: duplicatePhoneError };
    }
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка сохранения студента",
    };
  }

  revalidatePath("/students");
  revalidatePath(`/students/${studentId}`);
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

  const isCredit = parsed.data.amount > 0;
  let offerClaimed = false;

  try {
    await db.$transaction(async (tx) => {
      await tx.transaction.create({
        data: {
          studentId: studentId,
          amount: parsed.data.amount,
          type: isCredit ? "PAYMENT" : "ADJUSTMENT",
          description: parsed.data.description || "Ручное изменение баланса администратором",
          // Manual admin adjustment has no natural external dedup key; a fresh
          // UUID satisfies the required unique constraint without colliding.
          idempotencyKey: randomUUID(),
        },
      });

      // A manual credit (MANUAL_CREDIT) is a real first-payment moment too --
      // eligible for the same idempotent offer trigger as a YooKassa payment.
      if (isCredit) {
        offerClaimed = await claimFirstPaymentOffer(tx, studentId);
      }
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка создания транзакции",
    };
  }

  if (offerClaimed) {
    try {
      await sendFirstPaymentOffer(studentId);
    } catch (err) {
      logger.error("Не удалось отправить оферту после ручного пополнения", err, {
        studentId,
      });
    }
  }

  revalidatePath("/students");
  return {};
}
