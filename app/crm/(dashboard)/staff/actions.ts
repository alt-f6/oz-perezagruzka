"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { ALL_ROLES, getSessionUser } from "@/shared/lib/auth";
import { db } from "@/shared/lib/db";
import type { UserRole } from "@/crm/lib/types";

const RoleSchema = z.enum(ALL_ROLES as [UserRole, ...UserRole[]]);

export async function updateUserRole(userId: string, newRole: UserRole) {
  const sessionUser = await getSessionUser();

  if (!sessionUser) {
    return { error: "Не авторизован" };
  }

  if (sessionUser.role !== "ADMIN") {
    return { error: "Недостаточно прав для изменения ролей" };
  }

  const validation = RoleSchema.safeParse(newRole);
  if (!validation.success) {
    return { error: "Недопустимая роль" };
  }

  try {
    await db.user.update({
      where: { id: userId },
      data: { role: validation.data },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return { error: "Пользователь не найден" };
    }
    console.error("Prisma Update Error:", error);
    const message = error instanceof Error ? error.message : "Неизвестная ошибка";
    return { error: `Ошибка БД: ${message}` };
  }

  revalidatePath("/staff");
  return { success: true };
}
