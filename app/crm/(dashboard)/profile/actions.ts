"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import { isCrmTimezone } from "@/shared/lib/timezone";
import type { ActionResult } from "@/crm/lib/types";

const updateTimezoneSchema = z.object({
  timezone: z.string().refine(isCrmTimezone, { message: "Недопустимый часовой пояс" }),
});

export async function updateTimezone(timezone: string): Promise<ActionResult> {
  const sessionUser = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = updateTimezoneSchema.safeParse({ timezone });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Некорректный часовой пояс" };
  }

  try {
    await db.user.update({
      where: { id: sessionUser.id },
      data: { timezone: parsed.data.timezone },
    });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Не удалось сохранить часовой пояс" };
  }

  revalidatePath("/profile");
  return {};
}
