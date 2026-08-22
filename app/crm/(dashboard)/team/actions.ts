"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { getSessionUser, requireSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { buildAbsoluteUrl } from "@/shared/lib/url";
import { createLogger } from "@/shared/lib/logger";
import { emailSchema } from "@/shared/validation/email";
import { russianPhoneOptionalSchema } from "@/shared/validation/phone";
import type { ActionResult } from "@/crm/lib/types";

const log = createLogger("crm-team");

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

const updateTeamMemberSchema = z.object({
  id: z.uuid(),
  fullName: z.string().min(2, { message: "Введите ФИО" }),
  email: emailSchema.optional().or(z.literal("")),
  phone: russianPhoneOptionalSchema,
  subjects: z.string().optional().or(z.literal("")),
});

export async function updateTeamMember(
  values: z.infer<typeof updateTeamMemberSchema>,
): Promise<ActionResult> {
  await requireSessionUser(["ADMIN"]);

  const parsed = updateTeamMemberSchema.safeParse(values);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректные данные" };
  }

  try {
    await db.user.update({
      where: { id: parsed.data.id },
      data: {
        fullName: parsed.data.fullName,
        email: parsed.data.email || null,
        phone: parsed.data.phone || null,
        subjects: parsed.data.subjects || null,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Email или телефон уже используются другим пользователем" };
    }
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: `Не удалось обновить сотрудника: ${message}` };
  }

  revalidatePath("/team");
  return {};
}

export async function setTeamMemberArchived(
  id: string,
  isArchived: boolean,
): Promise<ActionResult> {
  const sessionUser = await requireSessionUser(["ADMIN"]);

  if (id === sessionUser.id) {
    return { error: "Нельзя архивировать собственную учетную запись" };
  }

  try {
    await db.user.update({ where: { id }, data: { isArchived } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: `Не удалось изменить статус: ${message}` };
  }

  revalidatePath("/team");
  return {};
}

export async function createInvite(
  email: string,
  role: "ADMIN" | "TEACHER",
): Promise<ActionResult & { inviteLink?: string }> {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" };
  }

  const userRole = sessionUser.role;

  if (userRole !== "ADMIN") {
    return { error: "У вас нет прав для приглашения сотрудников" };
  }

  const parsedEmail = emailSchema.safeParse(email);
  if (!parsedEmail.success) {
    return { error: parsedEmail.error.issues[0]?.message ?? "Некорректный email" };
  }

  let invite;
  try {
    invite = await db.invite.create({
      data: {
        email: parsedEmail.data,
        role,
        invitedBy: sessionUser.id,
        expiresAt: new Date(Date.now() + INVITE_TTL_MS),
      },
      select: { token: true },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { error: "Приглашение для этого email уже создано" };
    }
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: `Ошибка создания инвайта: ${message}` };
  }

  revalidatePath("/team");

  const inviteLink = await buildAbsoluteUrl("crm", `/register?token=${invite.token}`);

  return { inviteLink };
}

export async function getActiveInvites() {
  try {
    await requireSessionUser(["ADMIN"]);
  } catch (err) {
    log.error("Отказано в доступе к списку приглашений", err);
    return [];
  }

  try {
    return await db.invite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  } catch (err) {
    log.error("Не удалось получить список приглашений", err);
    return [];
  }
}
