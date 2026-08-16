"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/shared/lib/db";
import { getSessionUser } from "@/shared/lib/auth";
import type { ActionResult } from "@/crm/lib/types";

async function requireStaff() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) {
    return { error: "Требуется авторизация" } as const;
  }

  if (!["ADMIN"].includes(sessionUser.role)) {
    return { error: "У вас нет прав для изменения этих данных" } as const;
  }

  return { user: sessionUser } as const;
}

export async function updateParentTelegramChatId(
  studentId: string,
  parentId: string,
  telegramChatId: string,
): Promise<ActionResult> {
  const auth = await requireStaff();
  if ("error" in auth) return auth;

  try {
    await db.parent.update({
      where: { id: parentId },
      data: { telegramChatId: telegramChatId.trim() || null },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Ошибка обновления данных",
    };
  }

  revalidatePath(`/students/${studentId}`);
  return {};
}
