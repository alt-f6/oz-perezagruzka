"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { getSessionUser, requireSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import { buildAbsoluteUrl } from "@/shared/lib/url";
import type { ActionResult } from "@/crm/lib/types";

const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

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

  let invite;
  try {
    invite = await db.invite.create({
      data: {
        email: email.trim().toLowerCase(),
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
  } catch {
    return [];
  }

  try {
    return await db.invite.findMany({
      where: { acceptedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
  } catch {
    return [];
  }
}
