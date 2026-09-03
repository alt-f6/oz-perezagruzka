import { beforeEach, describe, expect, it, vi } from "vitest";

const rbacMock = vi.hoisted(() => ({ requireRole: vi.fn() }));
const dbMock = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  group: { findUnique: vi.fn() },
  teacherAvailability: { findMany: vi.fn(), upsert: vi.fn() },
  classSession: { findMany: vi.fn() },
}));

vi.mock("@/shared/lib/rbac", () => rbacMock);
vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const {
  getTeacherAvailability,
  saveTeacherAvailability,
  copyTeacherAvailabilityWeek,
  previewLessonAvailability,
} = await import("./availability-actions");
const { EMPTY_WEEK_SLOTS, withSlot, addWeeks, moscowWeekStartKey, weekKeyToDate } =
  await import("@/crm/lib/availability");

const TEACHER_ID = "11111111-1111-4111-8111-111111111111";
const OTHER_TEACHER_ID = "22222222-2222-4222-8222-222222222222";

// Always-future Monday so the past-week guard never trips regardless of when
// the suite runs.
const FUTURE_WEEK = addWeeks(moscowWeekStartKey(new Date()), 6);
const PAST_WEEK = addWeeks(moscowWeekStartKey(new Date()), -6);

const fullDay = (() => {
  let s = EMPTY_WEEK_SLOTS;
  for (let h = 7; h < 22; h++) s = withSlot(s, 0, h, true);
  return s;
})();

function asAdmin() {
  rbacMock.requireRole.mockResolvedValue({ id: "admin", email: "a@a", role: "ADMIN" });
}
function asTeacher(id: string) {
  rbacMock.requireRole.mockResolvedValue({ id, email: "t@t", role: "TEACHER" });
}

beforeEach(() => {
  vi.clearAllMocks();
  dbMock.user.findFirst.mockResolvedValue({ id: TEACHER_ID });
  dbMock.teacherAvailability.findMany.mockResolvedValue([]);
  dbMock.teacherAvailability.upsert.mockResolvedValue({});
  dbMock.classSession.findMany.mockResolvedValue([]);
});

describe("saveTeacherAvailability — RBAC", () => {
  it("rejects a teacher editing another teacher's availability", async () => {
    asTeacher(OTHER_TEACHER_ID);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: fullDay,
    });

    expect(result).toEqual({
      error: "Преподаватель может изменять только свою доступность",
    });
    expect(dbMock.teacherAvailability.upsert).not.toHaveBeenCalled();
  });

  it("allows a teacher to edit their own availability", async () => {
    asTeacher(TEACHER_ID);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: fullDay,
    });

    expect(result).toMatchObject({ ok: true, weekStart: FUTURE_WEEK, slots: fullDay });
    expect(dbMock.teacherAvailability.upsert).toHaveBeenCalledOnce();
  });

  it("lets an ADMIN edit any teacher's availability", async () => {
    asAdmin();

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: fullDay,
    });

    expect(result).toMatchObject({ ok: true });
  });
});

describe("saveTeacherAvailability — guards", () => {
  it("refuses to write a past week (read-only)", async () => {
    asTeacher(TEACHER_ID);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: PAST_WEEK,
      slots: fullDay,
    });

    expect(result).toEqual({ error: "Прошедшие недели доступны только для чтения" });
    expect(dbMock.teacherAvailability.upsert).not.toHaveBeenCalled();
  });

  it("rejects a non-Monday week key", async () => {
    asTeacher(TEACHER_ID);
    // FUTURE_WEEK is a Monday; +1 day is a Tuesday.
    const tuesday = weekKeyToDate(FUTURE_WEEK);
    tuesday.setUTCDate(tuesday.getUTCDate() + 1);
    const tuesdayKey = tuesday.toISOString().slice(0, 10);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: tuesdayKey,
      slots: fullDay,
    });

    expect(result).toEqual({ error: "Неделя должна начинаться с понедельника" });
  });

  it("returns needsConfirmation when a booked lesson sits outside the new grid", async () => {
    asTeacher(TEACHER_ID);
    // A scheduled lesson at Monday 10:00 in FUTURE_WEEK, but the new grid only
    // marks 07:00–22:00 on... wait fullDay marks the whole Monday, so pick a
    // grid that clears 10:00 by marking only 15:00.
    const only15 = withSlot(EMPTY_WEEK_SLOTS, 0, 15, true);
    const lessonAt = weekKeyToDate(FUTURE_WEEK);
    lessonAt.setUTCHours(7); // 10:00 MSK = 07:00Z
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: lessonAt, durationMinutes: 60 },
    ]);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: only15,
    });

    expect(result).toMatchObject({ needsConfirmation: true });
    if ("needsConfirmation" in result) {
      expect(result.conflicts).toHaveLength(1);
    }
    expect(dbMock.teacherAvailability.upsert).not.toHaveBeenCalled();
  });

  it("persists over a booked conflict once acknowledged", async () => {
    asTeacher(TEACHER_ID);
    const only15 = withSlot(EMPTY_WEEK_SLOTS, 0, 15, true);
    const lessonAt = weekKeyToDate(FUTURE_WEEK);
    lessonAt.setUTCHours(7);
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: lessonAt, durationMinutes: 60 },
    ]);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: only15,
      acknowledgeBookedConflicts: true,
    });

    expect(result).toMatchObject({ ok: true });
    expect(dbMock.teacherAvailability.upsert).toHaveBeenCalledOnce();
  });

  it("rejects a malformed slots string", async () => {
    asTeacher(TEACHER_ID);

    const result = await saveTeacherAvailability({
      teacherId: TEACHER_ID,
      weekStart: FUTURE_WEEK,
      slots: "not-a-bitmask",
    });

    expect(result).toEqual({ error: "Некорректные данные доступности" });
  });
});

describe("getTeacherAvailability", () => {
  it("returns one entry per requested week, defaulting to empty", async () => {
    asAdmin();
    const nextWeek = addWeeks(FUTURE_WEEK, 1);

    const result = await getTeacherAvailability(TEACHER_ID, [FUTURE_WEEK, nextWeek]);

    expect("weeks" in result && result.weeks).toEqual([
      { weekStart: FUTURE_WEEK, slots: EMPTY_WEEK_SLOTS },
      { weekStart: nextWeek, slots: EMPTY_WEEK_SLOTS },
    ]);
  });

  it("forbids a teacher reading another teacher", async () => {
    asTeacher(OTHER_TEACHER_ID);
    const result = await getTeacherAvailability(TEACHER_ID, [FUTURE_WEEK]);
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("copyTeacherAvailabilityWeek", () => {
  it("copies the source week's slots onto the target week", async () => {
    asTeacher(TEACHER_ID);
    const only15 = withSlot(EMPTY_WEEK_SLOTS, 0, 15, true);
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate(FUTURE_WEEK), slots: only15 },
    ]);
    const target = addWeeks(FUTURE_WEEK, 1);

    const result = await copyTeacherAvailabilityWeek({
      teacherId: TEACHER_ID,
      fromWeekStart: FUTURE_WEEK,
      toWeekStart: target,
    });

    expect(result).toMatchObject({ ok: true, weekStart: target, slots: only15 });
  });

  it("rejects copying a week onto itself", async () => {
    asTeacher(TEACHER_ID);
    const result = await copyTeacherAvailabilityWeek({
      teacherId: TEACHER_ID,
      fromWeekStart: FUTURE_WEEK,
      toWeekStart: FUTURE_WEEK,
    });
    expect(result).toMatchObject({ error: expect.any(String) });
  });
});

describe("previewLessonAvailability", () => {
  it("returns the unavailable occurrences for an individual lesson", async () => {
    asAdmin();
    // Teacher published an all-empty grid for the lesson's week, so 10:00 is
    // outside declared working hours (opt-in: a published grid is required to warn).
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate(FUTURE_WEEK), slots: EMPTY_WEEK_SLOTS },
    ]);

    const result = await previewLessonAvailability({
      type: "INDIVIDUAL",
      studentId: "33333333-3333-4333-8333-333333333333",
      teacherId: TEACHER_ID,
      groupId: "",
      date: FUTURE_WEEK, // a Monday
      time: "10:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      daySlots: [],
    });

    expect("unavailable" in result && result.unavailable).toHaveLength(1);
  });
});
