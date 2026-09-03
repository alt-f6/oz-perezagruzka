"use server";

import { revalidatePath } from "next/cache";
import {
  copyAvailabilitySchema,
  lessonSchema,
  saveAvailabilitySchema,
  type CopyAvailabilityValues,
  type LessonValues,
  type SaveAvailabilityValues,
} from "@/crm/lib/schemas";
import { db } from "@/shared/lib/db";
import { requireRole } from "@/shared/lib/rbac";
import type { SessionUser } from "@/shared/lib/auth";
import {
  EMPTY_WEEK_SLOTS,
  isValidSlots,
  moscowWeekStartKey,
  weekKeyToDate,
  weekStartKeyForDateKey,
} from "@/crm/lib/availability";
import {
  findBookedConflictsForWeek,
  getAvailabilityMap,
  collectUnavailableOccurrences,
} from "@/crm/lib/services/availability.service";
import { expandOccurrences } from "@/crm/lib/lessonOccurrences";
import { formatMoscowDate, formatMoscowTime } from "@/shared/lib/timezone";

export interface AvailabilityWeek {
  weekStart: string;
  slots: string;
}

export type GetAvailabilityResult =
  | { error: string }
  | { error?: undefined; weeks: AvailabilityWeek[] };

export interface BookedConflictInfo {
  scheduledAt: string;
  label: string;
}

export type SaveAvailabilityResult =
  | { error: string }
  | { error?: undefined; ok: true; weekStart: string; slots: string }
  | { error?: undefined; needsConfirmation: true; conflicts: BookedConflictInfo[] };

// ─────────────────────────────────────────────────────────────
// Shared guards
// ─────────────────────────────────────────────────────────────

/**
 * A teacher may only touch their own availability; ADMIN/MANAGER may touch any
 * teacher's. Returns an error string when the actor is not permitted, else null.
 */
async function assertCanManageTeacher(
  user: SessionUser,
  teacherId: string,
): Promise<string | null> {
  if (user.role === "TEACHER") {
    if (user.id !== teacherId) {
      return "Преподаватель может изменять только свою доступность";
    }
    return null;
  }
  // ADMIN / MANAGER: confirm the target is a real teacher.
  const teacher = await db.user.findFirst({
    where: { id: teacherId, role: "TEACHER" },
    select: { id: true },
  });
  return teacher ? null : "Преподаватель не найден";
}

function labelForInstant(instant: Date): string {
  return `${formatMoscowDate(instant)} в ${formatMoscowTime(instant)}`;
}

/**
 * Core persistence for a single week's slots, shared by save and copy. Enforces
 * the Monday-key/past-week/collision rules and upserts. Assumes RBAC has
 * already been checked by the caller.
 */
async function persistWeek(
  teacherId: string,
  weekStart: string,
  slots: string,
  acknowledgeBookedConflicts: boolean | undefined,
): Promise<SaveAvailabilityResult> {
  if (!isValidSlots(slots)) {
    return { error: "Некорректная сетка доступности" };
  }
  if (weekStartKeyForDateKey(weekStart) !== weekStart) {
    return { error: "Неделя должна начинаться с понедельника" };
  }

  const currentWeek = moscowWeekStartKey(new Date());
  if (weekStart < currentWeek) {
    return { error: "Прошедшие недели доступны только для чтения" };
  }

  // Collision guard: warn (once) before removing availability under a lesson
  // that is already booked in this week.
  const conflicts = await findBookedConflictsForWeek(teacherId, weekStart, slots);
  if (conflicts.length > 0 && !acknowledgeBookedConflicts) {
    return {
      needsConfirmation: true,
      conflicts: conflicts.map((c) => ({
        scheduledAt: c.scheduledAt.toISOString(),
        label: labelForInstant(c.scheduledAt),
      })),
    };
  }

  try {
    await db.teacherAvailability.upsert({
      where: { teacherId_weekStart: { teacherId, weekStart: weekKeyToDate(weekStart) } },
      create: { teacherId, weekStart: weekKeyToDate(weekStart), slots },
      update: { slots },
    });
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Не удалось сохранить доступность",
    };
  }

  revalidatePath("/schedule");
  return { ok: true, weekStart, slots };
}

// ─────────────────────────────────────────────────────────────
// Actions
// ─────────────────────────────────────────────────────────────

/**
 * Reads a teacher's saved availability for a set of week keys. Teachers may
 * only read their own; ADMIN/MANAGER may read any. Weeks with no saved row come
 * back as the all-empty bitmask so the grid always has a value to render.
 */
export async function getTeacherAvailability(
  teacherId: string,
  weekStarts: string[],
): Promise<GetAvailabilityResult> {
  const user = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const denied = await assertCanManageTeacher(user, teacherId);
  if (denied) return { error: denied };

  // Normalize to Monday keys, keep caller order, dedupe.
  const keys: string[] = [];
  for (const w of weekStarts) {
    const key = weekStartKeyForDateKey(w);
    if (!keys.includes(key)) keys.push(key);
  }

  const map = await getAvailabilityMap(teacherId, keys);
  return {
    weeks: keys.map((weekStart) => ({
      weekStart,
      slots: map.get(weekStart) ?? EMPTY_WEEK_SLOTS,
    })),
  };
}

/**
 * Saves one week's availability grid. Strict RBAC (teachers self-only),
 * past-week read-only guard, and the booked-lesson collision guard all apply.
 */
export async function saveTeacherAvailability(
  input: SaveAvailabilityValues,
): Promise<SaveAvailabilityResult> {
  const user = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = saveAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Некорректные данные доступности" };
  }

  const denied = await assertCanManageTeacher(user, parsed.data.teacherId);
  if (denied) return { error: denied };

  return persistWeek(
    parsed.data.teacherId,
    parsed.data.weekStart,
    parsed.data.slots,
    parsed.data.acknowledgeBookedConflicts,
  );
}

/**
 * Copies one week's grid onto another week (the "copy to next week" / propagate
 * template action). The source week may be in the past; the target is subject
 * to the same past-week and collision guards as a direct save.
 */
export async function copyTeacherAvailabilityWeek(
  input: CopyAvailabilityValues,
): Promise<SaveAvailabilityResult> {
  const user = await requireRole(["ADMIN", "MANAGER", "TEACHER"]);

  const parsed = copyAvailabilitySchema.safeParse(input);
  if (!parsed.success) {
    return { error: "Некорректные данные доступности" };
  }

  const denied = await assertCanManageTeacher(user, parsed.data.teacherId);
  if (denied) return { error: denied };

  const fromKey = weekStartKeyForDateKey(parsed.data.fromWeekStart);
  const toKey = weekStartKeyForDateKey(parsed.data.toWeekStart);
  if (fromKey === toKey) {
    return { error: "Выберите другую неделю для копирования" };
  }

  const map = await getAvailabilityMap(parsed.data.teacherId, [fromKey]);
  const slots = map.get(fromKey) ?? EMPTY_WEEK_SLOTS;

  return persistWeek(
    parsed.data.teacherId,
    toKey,
    slots,
    parsed.data.acknowledgeBookedConflicts,
  );
}

export interface LessonAvailabilityPreview {
  unavailable: { scheduledAt: string; label: string }[];
}

/**
 * Client-facing check the Lesson Wizard calls when a teacher + date/time are
 * chosen: expands the request into occurrences and returns those that fall
 * outside the teacher's declared working hours, so the UI can warn before
 * submit. Read-only; ADMIN/MANAGER only (the roles that create lessons).
 */
export async function previewLessonAvailability(
  values: LessonValues,
): Promise<{ error: string } | LessonAvailabilityPreview> {
  await requireRole(["ADMIN", "MANAGER"]);

  const parsed = lessonSchema.safeParse(values);
  if (!parsed.success) {
    // Incomplete form — nothing to warn about yet.
    return { unavailable: [] };
  }

  let teacherId: string | null = null;
  if (parsed.data.type === "INDIVIDUAL") {
    teacherId = (parsed.data.teacherId as string) || null;
  } else if (parsed.data.groupId) {
    const group = await db.group.findUnique({
      where: { id: parsed.data.groupId as string },
      select: { teacherId: true },
    });
    teacherId = group?.teacherId ?? null;
  }
  if (!teacherId) return { unavailable: [] };

  const occurrences = expandOccurrences(parsed.data);
  const unavailable = await collectUnavailableOccurrences(teacherId, occurrences);

  return {
    unavailable: unavailable.map((o) => ({
      scheduledAt: o.scheduledAt.toISOString(),
      label: labelForInstant(o.scheduledAt),
    })),
  };
}
