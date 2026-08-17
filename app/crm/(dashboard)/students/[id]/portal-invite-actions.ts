"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import { buildAbsoluteUrl } from "@/shared/lib/url";
import { russianPhoneSchema } from "@/shared/validation/phone";
import { emailSchema } from "@/shared/validation/email";
import type { ActionResult } from "@/crm/lib/types";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

async function requireStaff() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" } as const;
  }

  if (!["ADMIN"].includes(sessionUser.role)) {
    return { error: "У вас нет прав для приглашения" } as const;
  }

  return { staffId: sessionUser.id } as const;
}

function buildInviteLink(token: string): Promise<string> {
  return buildAbsoluteUrl("crm", `/register?token=${token}`);
}

export async function inviteStudentPortal(
  studentId: string,
  email: string,
): Promise<ActionResult & { inviteLink?: string }> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  const { staffId } = auth;

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Некорректный email" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true, userId: true },
  });

  if (!student) {
    return { error: "Ученик не найден" };
  }
  if (student.userId) {
    return { error: "У ученика уже есть аккаунт" };
  }

  let invite;
  try {
    invite = await db.invite.create({
      data: {
        email: parsedEmail.data,
        role: "STUDENT",
        invitedBy: staffId,
        studentId,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { token: true },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Приглашение для этого email уже создано" };
    }
    return {
      error: `Ошибка создания приглашения: ${err instanceof Error ? err.message : String(err)}`,
    };
  }

  revalidatePath(`/students/${studentId}`);
  return { inviteLink: await buildInviteLink(invite.token) };
}

export async function inviteParentPortal(
  studentId: string,
  parentName: string,
  parentPhone: string,
  email: string,
): Promise<ActionResult & { inviteLink?: string }> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;
  const { staffId } = auth;

  const name = parentName.trim();
  if (!name) {
    return { error: "Укажите имя родителя" };
  }

  const parsedPhone = russianPhoneSchema.safeParse(parentPhone);
  if (!parsedPhone.success) {
    return { error: parsedPhone.error.issues[0]?.message ?? "Некорректный телефон" };
  }
  const phone = parsedPhone.data;

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Некорректный email" };
  }

  const student = await db.student.findUnique({
    where: { id: studentId },
    select: { id: true },
  });
  if (!student) {
    return { error: "Ученик не найден" };
  }

  try {
    const parent = await db.$transaction(async (tx) => {
      const upserted = await tx.parent.upsert({
        where: { phone },
        update: {},
        create: { fullName: name, phone },
        select: { id: true, userId: true },
      });

      await tx.parentStudent.upsert({
        where: { parentId_studentId: { parentId: upserted.id, studentId } },
        update: {},
        create: { parentId: upserted.id, studentId },
      });

      return upserted;
    });

    revalidatePath(`/students/${studentId}`);

    if (parent.userId) {
      return { error: "У этого родителя уже есть аккаунт — ученик привязан к нему" };
    }

    const invite = await db.invite.create({
      data: {
        email: parsedEmail.data,
        role: "PARENT",
        invitedBy: staffId,
        studentId,
        parentId: parent.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { token: true },
    });

    return { inviteLink: await buildInviteLink(invite.token) };
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { error: "Приглашение для этого email уже создано" };
    }
    return {
      error: `Ошибка создания приглашения: ${err instanceof Error ? err.message : String(err)}`,
    };
  }
}
