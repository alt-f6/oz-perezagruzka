import { beforeEach, describe, expect, it, vi } from "vitest";
import { formatMoscowTime, moscowDateKey } from "@/shared/lib/timezone";
import {
  EMPTY_WEEK_SLOTS,
  weekKeyToDate,
  withSlot,
} from "@/crm/lib/availability";
import { BillingService } from "@/crm/lib/services/billing.service";

const dbMock = vi.hoisted(() => ({
  group: { findUnique: vi.fn() },
  student: { findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
  classSession: {
    createMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  attendance: { update: vi.fn(), upsert: vi.fn() },
  submission: { findUnique: vi.fn(), update: vi.fn(), upsert: vi.fn() },
  teacherAvailability: { findMany: vi.fn() },
  teacherPayout: { findFirst: vi.fn() },
  $transaction: vi.fn(),
}));

const rbacMock = vi.hoisted(() => ({
  requireRole: vi.fn(),
}));

const r2Mock = vi.hoisted(() => ({
  signGetObject: vi.fn(),
  signPutObject: vi.fn(),
}));

vi.mock("@/shared/lib/db", () => ({ db: dbMock }));
vi.mock("@/shared/lib/rbac", () => rbacMock);
vi.mock("@/lms/server/r2/signed", () => r2Mock);
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/crm/lib/prisma", () => ({
  prisma: { $transaction: vi.fn((cb) => cb({
    $queryRaw: vi.fn(),
    classSession: { findUniqueOrThrow: vi.fn().mockResolvedValue({ id: "lesson_1", scheduledAt: new Date(), group: null, pricePerLesson: 0 }) },
    freeze: { findFirst: vi.fn().mockResolvedValue(null) },
    attendance: { upsert: vi.fn().mockResolvedValue({ id: "att_1" }) },
    transaction: { deleteMany: vi.fn(), create: vi.fn() },
  })) },
}));
vi.mock("@/crm/lib/services/notification.service", () => ({
  getNotificationProvider: vi.fn(() => ({ sendDebtReminder: vi.fn() })),
}));

const {
  createLesson,
  deleteLesson,
  bulkCancelSessions,
  setAttendance,
  gradeSubmission,
  getSubmissionFileUrl,
  getHomeworkUploadUrl,
  attachHomeworkFile,
} = await import("./actions");

const ADMIN = { id: "user_1", email: "a@a.com", role: "ADMIN" };

beforeEach(() => {
  vi.clearAllMocks();
  rbacMock.requireRole.mockResolvedValue(ADMIN);
  // Default: the teacher has no existing sessions, so the conflict scan is empty.
  dbMock.classSession.findMany.mockResolvedValue([]);
  // Default: no published availability grid → availability guard is a no-op
  // (opt-in), preserving pre-availability createLesson behavior.
  dbMock.teacherAvailability.findMany.mockResolvedValue([]);
  // Default: no closed payout period for any teacher/month, so the
  // closed-payout guard is a no-op unless a test explicitly opts in.
  dbMock.teacherPayout.findFirst.mockResolvedValue(null);
});

describe("createLesson", () => {
  it("passes durationMinutes through to createMany", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 90,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ durationMinutes: 90 })],
    });
  });

  it("persists the exact local calendar day (no UTC 31st→30th shift)", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-08-31",
      time: "09:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    const { scheduledAt } = dbMock.classSession.createMany.mock.calls[0][0].data[0];
    // Persisted as the UTC instant for 09:00 Moscow on 2026-08-31 (06:00Z);
    // the Moscow calendar day must stay the 31st (no UTC 31st→30th shift) and
    // the wall-clock must round-trip to exactly 09:00.
    expect(scheduledAt.toISOString()).toBe("2026-08-31T06:00:00.000Z");
    expect(moscowDateKey(scheduledAt)).toBe("2026-08-31");
    expect(formatMoscowTime(scheduledAt)).toBe("09:00");
  });

  it("applies independent per-day time and duration overrides across a series", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 2 });

    // 2026-09-07 is a Monday. Custom series on Mon (1) and Sat (6),
    // Mon at 15:00·60min but Sat at 10:00·90min. One week window.
    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-07",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 6],
      recurrenceEndDate: "2026-09-13",
      daySlots: [
        { day: 1, time: "15:00", durationMinutes: 60 },
        { day: 6, time: "10:00", durationMinutes: 90 },
      ],
    });

    const rows = dbMock.classSession.createMany.mock.calls[0][0].data as {
      scheduledAt: Date;
      durationMinutes: number;
    }[];
    const byDay = rows.map((r) => ({
      weekday: r.scheduledAt.getUTCDay(),
      time: formatMoscowTime(r.scheduledAt),
      durationMinutes: r.durationMinutes,
    }));

    // Mon 15:00·60min, Sat 10:00·90min — Moscow wall-clock, weekday unchanged.
    expect(byDay).toContainEqual({ weekday: 1, time: "15:00", durationMinutes: 60 });
    expect(byDay).toContainEqual({ weekday: 6, time: "10:00", durationMinutes: 90 });
  });

  it("falls back to the default time/duration for days without an override", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 2 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-07", // Monday
      time: "18:00",
      durationMinutes: 45,
      recurrence: "CUSTOM",
      recurrenceDays: [1, 3], // Mon + Wed
      recurrenceEndDate: "2026-09-13",
      daySlots: [{ day: 3, time: "12:00", durationMinutes: 120 }], // only Wed overridden
    });

    const rows = dbMock.classSession.createMany.mock.calls[0][0].data as {
      scheduledAt: Date;
      durationMinutes: number;
    }[];
    const mon = rows.find((r) => r.scheduledAt.getUTCDay() === 1)!;
    const wed = rows.find((r) => r.scheduledAt.getUTCDay() === 3)!;

    expect(formatMoscowTime(mon.scheduledAt)).toBe("18:00");
    expect(mon.durationMinutes).toBe(45);
    expect(formatMoscowTime(wed.scheduledAt)).toBe("12:00");
    expect(wed.durationMinutes).toBe(120);
  });

  it("rejects scheduling for a group with no assigned teacher", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: null });

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 90,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("blocks a lesson that overlaps an existing scheduled lesson for the teacher (TIME-03)", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    // Existing 60-min lesson at 15:00 Moscow (12:00Z) on 2026-09-01.
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: new Date("2026-09-01T12:00:00.000Z"), durationMinutes: 60 },
    ]);

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:30", // overlaps 15:00–16:00
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("resolves an individual lesson's price from the student's last individual session", async () => {
    dbMock.student.findFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Иванов Иван",
    });
    dbMock.user.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    dbMock.classSession.findFirst.mockResolvedValue({ pricePerLesson: 1500 });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    const result = await createLesson({
      type: "INDIVIDUAL",
      studentId: "22222222-2222-4222-8222-222222222222",
      teacherId: "33333333-3333-4333-8333-333333333333",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeUndefined();
    expect(dbMock.group.findUnique).not.toHaveBeenCalled();
    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          type: "INDIVIDUAL",
          groupId: null,
          studentId: "22222222-2222-4222-8222-222222222222",
          teacherId: "33333333-3333-4333-8333-333333333333",
          pricePerLesson: 1500,
          durationMinutes: 60,
        }),
      ],
    });
  });

  it("returns a missingPriceWarning and does not create when the student has no individual lesson price history", async () => {
    dbMock.student.findFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Иванов Иван",
    });
    dbMock.user.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    dbMock.classSession.findFirst.mockResolvedValue(null);

    const result = await createLesson({
      type: "INDIVIDUAL",
      studentId: "22222222-2222-4222-8222-222222222222",
      teacherId: "33333333-3333-4333-8333-333333333333",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect("missingPriceWarning" in result && result.missingPriceWarning).toEqual({
      studentId: "22222222-2222-4222-8222-222222222222",
      studentName: "Иванов Иван",
    });
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("creates at 0 ₽ once acknowledgeMissingPrice is set", async () => {
    dbMock.student.findFirst.mockResolvedValue({
      id: "22222222-2222-4222-8222-222222222222",
      fullName: "Иванов Иван",
    });
    dbMock.user.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });
    dbMock.classSession.findFirst.mockResolvedValue(null);
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    const result = await createLesson({
      type: "INDIVIDUAL",
      studentId: "22222222-2222-4222-8222-222222222222",
      teacherId: "33333333-3333-4333-8333-333333333333",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
      acknowledgeMissingPrice: true,
    });

    expect(result?.error).toBeUndefined();
    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ pricePerLesson: 0 })],
    });
  });

  it("persists isTrial through to createMany when set", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
      isTrial: true,
    });

    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ isTrial: true })],
    });
  });

  it("defaults isTrial to false when not provided", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(dbMock.classSession.createMany).toHaveBeenCalledWith({
      data: [expect.objectContaining({ isTrial: false })],
    });
  });

  it("warns (does not create) when the chosen time is outside a published availability grid", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    // Teacher published an all-empty grid for the lesson's week (2026-09-01 is a
    // Tuesday → week Monday 2026-08-31), so 15:00 is not marked working.
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate("2026-08-31"), slots: EMPTY_WEEK_SLOTS },
    ]);

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect("availabilityWarning" in result && result.availabilityWarning).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("creates over an availability warning once acknowledgeUnavailable is set", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate("2026-08-31"), slots: EMPTY_WEEK_SLOTS },
    ]);

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
      acknowledgeUnavailable: true,
    });

    expect(result?.error).toBeUndefined();
    expect(dbMock.classSession.createMany).toHaveBeenCalledOnce();
  });

  it("does not warn when the published grid marks the chosen time as working", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });
    // Mark Tuesday (day index 1) 15:00 as working for the 2026-08-31 week.
    const grid = withSlot(EMPTY_WEEK_SLOTS, 1, 15, true);
    dbMock.teacherAvailability.findMany.mockResolvedValue([
      { weekStart: weekKeyToDate("2026-08-31"), slots: grid },
    ]);

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeUndefined();
    expect("availabilityWarning" in result && result.availabilityWarning).toBeFalsy();
    expect(dbMock.classSession.createMany).toHaveBeenCalledOnce();
  });

  it("rejects an individual lesson whose student does not exist", async () => {
    dbMock.student.findFirst.mockResolvedValue(null);
    dbMock.user.findFirst.mockResolvedValue({ id: "33333333-3333-4333-8333-333333333333" });

    const result = await createLesson({
      type: "INDIVIDUAL",
      studentId: "22222222-2222-4222-8222-222222222222",
      teacherId: "33333333-3333-4333-8333-333333333333",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("allows a back-to-back lesson that only touches the boundary", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });
    // Existing 15:00–16:00 Moscow lesson; new one starts exactly at 16:00.
    dbMock.classSession.findMany.mockResolvedValue([
      { scheduledAt: new Date("2026-09-01T12:00:00.000Z"), durationMinutes: 60 },
    ]);

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "16:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(result?.error).toBeUndefined();
    expect(dbMock.classSession.createMany).toHaveBeenCalled();
  });

  it("stamps reminderSentAt for a past-dated occurrence, guarding against cron spam", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01", // in the past relative to the test clock
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    const row = dbMock.classSession.createMany.mock.calls[0][0].data[0];
    expect(row.reminderSentAt).toBeInstanceOf(Date);
  });

  it("leaves reminderSentAt null for a future occurrence", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2099-01-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    const row = dbMock.classSession.createMany.mock.calls[0][0].data[0];
    expect(row.reminderSentAt).toBeNull();
  });

  it("returns a closedPayoutWarning (does not create) when a past occurrence's month already has a payout for the resolved teacher", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.teacherPayout.findFirst.mockResolvedValue({ id: "payout_1" });

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect("closedPayoutWarning" in result && result.closedPayoutWarning).toBeTruthy();
    expect(dbMock.classSession.createMany).not.toHaveBeenCalled();
  });

  it("creates over a closed-payout warning once acknowledgeClosedPayout is set", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });
    dbMock.teacherPayout.findFirst.mockResolvedValue({ id: "payout_1" });

    const result = await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2026-09-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
      acknowledgeClosedPayout: true,
    });

    expect(result?.error).toBeUndefined();
    expect(dbMock.classSession.createMany).toHaveBeenCalledOnce();
  });

  it("does not consult teacherPayout at all when every occurrence is in the future", async () => {
    dbMock.group.findUnique.mockResolvedValue({ teacherId: "teacher_1" });
    dbMock.classSession.createMany.mockResolvedValue({ count: 1 });

    await createLesson({
      groupId: "11111111-1111-4111-8111-111111111111",
      date: "2099-01-01",
      time: "15:00",
      durationMinutes: 60,
      recurrence: "NONE",
      recurrenceDays: [],
      recurrenceEndDate: "",
    });

    expect(dbMock.teacherPayout.findFirst).not.toHaveBeenCalled();
  });
});

describe("deleteLesson", () => {
  it("soft-cancels a future scheduled session instead of deleting it", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "scheduled",
      _count: { attendance: 0 },
    });
    dbMock.classSession.update.mockResolvedValue({});

    const result = await deleteLesson("session_1");

    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { status: "cancelled" },
    });
    expect(result.error).toBeUndefined();
  });

  it("also cancels a session already in the past, as long as no attendance was recorded yet", async () => {
    // A lesson entered by mistake (duplicate, wrong group/date) is often only
    // noticed after it's passed -- an operator must still be able to pull it
    // out of the schedule as long as it never got billed.
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "scheduled",
      _count: { attendance: 0 },
    });
    dbMock.classSession.update.mockResolvedValue({});

    const result = await deleteLesson("session_1");

    expect(dbMock.classSession.update).toHaveBeenCalledWith({
      where: { id: "session_1" },
      data: { status: "cancelled" },
    });
    expect(result.error).toBeUndefined();
  });

  it("refuses to cancel a session that already has attendance recorded, to protect billing/salary history", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "scheduled",
      _count: { attendance: 2 },
    });

    const result = await deleteLesson("session_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.update).not.toHaveBeenCalled();
  });

  it("refuses to cancel a session that is already cancelled", async () => {
    dbMock.classSession.findUnique.mockResolvedValue({
      status: "cancelled",
      _count: { attendance: 0 },
    });

    const result = await deleteLesson("session_1");

    expect(result.error).toBeTruthy();
    expect(dbMock.classSession.update).not.toHaveBeenCalled();
  });
});

describe("bulkCancelSessions", () => {
  function runWithTx(targets: { id: string; status: string; scheduledAt: Date }[]) {
    dbMock.classSession.findMany.mockResolvedValue(targets);
    dbMock.classSession.updateMany.mockResolvedValue({ count: targets.length });
    dbMock.$transaction.mockImplementation(async (cb: (tx: typeof dbMock) => unknown) => cb(dbMock));
  }

  it("cancels only future+scheduled sessions among an arbitrary id selection", async () => {
    runWithTx([
      { id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) },
      { id: "b", status: "scheduled", scheduledAt: new Date(Date.now() - 86_400_000) }, // past
      { id: "c", status: "cancelled", scheduledAt: new Date(Date.now() + 86_400_000) }, // already cancelled
    ]);

    const result = await bulkCancelSessions({ sessionIds: ["a", "b", "c"] });

    expect(dbMock.classSession.updateMany).toHaveBeenCalledWith({
      where: { id: { in: ["a"] } },
      data: { status: "cancelled" },
    });
    expect(result).toMatchObject({ cancelledCount: 1, skippedCount: 2 });
  });

  it("resolves targets by recurrenceGroupId", async () => {
    runWithTx([{ id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    await bulkCancelSessions({ recurrenceGroupId: "series_1" });

    expect(dbMock.classSession.findMany).toHaveBeenCalledWith({
      where: { recurrenceGroupId: "series_1" },
      select: { id: true, status: true, scheduledAt: true },
    });
  });

  it("resolves targets by groupId", async () => {
    runWithTx([{ id: "a", status: "scheduled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    await bulkCancelSessions({ groupId: "group_1" });

    expect(dbMock.classSession.findMany).toHaveBeenCalledWith({
      where: { groupId: "group_1" },
      select: { id: true, status: true, scheduledAt: true },
    });
  });

  it("skips the updateMany call entirely when nothing is eligible", async () => {
    runWithTx([{ id: "a", status: "cancelled", scheduledAt: new Date(Date.now() + 86_400_000) }]);

    const result = await bulkCancelSessions({ sessionIds: ["a"] });

    expect(dbMock.classSession.updateMany).not.toHaveBeenCalled();
    expect(result).toMatchObject({ cancelledCount: 0, skippedCount: 1 });
  });

  it("rejects a non-ADMIN/MANAGER caller", async () => {
    rbacMock.requireRole.mockRejectedValue(new Error("forbidden"));

    await expect(bulkCancelSessions({ sessionIds: ["a"] })).rejects.toThrow("forbidden");
    expect(dbMock.$transaction).not.toHaveBeenCalled();
  });
});

const TEACHER = { id: "teacher_1", email: "t@a.com", role: "TEACHER" };

describe("setAttendance", () => {
  beforeEach(() => {
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "teacher_1",
      group: { teacherId: "teacher_1" },
    });
    dbMock.attendance.update.mockResolvedValue({ id: "att_1" });
  });

  it("returns a handled error (not a throw) when a TEACHER doesn't own the lesson", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "someone_else",
      group: null,
    });

    const result = await setAttendance("lesson_1", "student_1", { grade: 5 });

    expect(result.error).toBeTruthy();
    expect(dbMock.attendance.update).not.toHaveBeenCalled();
  });

  it("allows a TEACHER who owns the lesson directly (session.teacherId) to save a grade", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);

    const result = await setAttendance("lesson_1", "student_1", { grade: 4 });

    expect(result.error).toBeUndefined();
  });

  it("allows a TEACHER who owns the lesson only via the group's current teacher", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "previous_teacher",
      group: { teacherId: "teacher_1" },
    });

    const result = await setAttendance("lesson_1", "student_1", { homeworkCompleted: true });

    expect(result.error).toBeUndefined();
  });

  it("materializes the Attendance row via BillingService (status=PRESENT) before grading, when no status is set and no row exists yet", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    const markSpy = vi
      .spyOn(BillingService, "markAttendanceAndCharge")
      .mockResolvedValue({ id: "att_1" } as never);

    const result = await setAttendance("lesson_1", "student_1", { grade: 5 });

    expect(result.error).toBeUndefined();
    expect(markSpy).toHaveBeenCalledWith("lesson_1", "student_1", "PRESENT");
    expect(dbMock.attendance.update).toHaveBeenCalledWith({
      where: { classSessionId_studentId: { classSessionId: "lesson_1", studentId: "student_1" } },
      data: { grade: 5 },
    });
    markSpy.mockRestore();
  });

  it("does NOT re-materialize the row when this same call also sets status (billing already created/updated it)", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    const markSpy = vi
      .spyOn(BillingService, "markAttendanceAndCharge")
      .mockResolvedValue({ id: "att_1" } as never);

    await setAttendance("lesson_1", "student_1", { status: "ABSENT", grade: 2 });

    expect(markSpy).toHaveBeenCalledTimes(1);
    expect(markSpy).toHaveBeenCalledWith("lesson_1", "student_1", "ABSENT");
    markSpy.mockRestore();
  });

  it("rejects an out-of-range grade before touching the database", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);

    const result = await setAttendance("lesson_1", "student_1", { grade: 7 });

    expect(result.error).toMatch(/от 1 до 5/);
    expect(dbMock.attendance.update).not.toHaveBeenCalled();
  });

  it("returns a handled error instead of throwing when the lesson does not exist", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.classSession.findUnique.mockResolvedValue(null);

    const result = await setAttendance("missing_lesson", "student_1", { grade: 5 });

    expect(result.error).toBeTruthy();
  });

  it("saves a comment on its own, independent of grade/homeworkCompleted", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    const markSpy = vi
      .spyOn(BillingService, "markAttendanceAndCharge")
      .mockResolvedValue({ id: "att_1" } as never);

    const result = await setAttendance("lesson_1", "student_1", {
      comment: "Отлично поработал",
    });

    expect(result.error).toBeUndefined();
    expect(markSpy).toHaveBeenCalledWith("lesson_1", "student_1", "PRESENT");
    expect(dbMock.attendance.update).toHaveBeenCalledWith({
      where: { classSessionId_studentId: { classSessionId: "lesson_1", studentId: "student_1" } },
      data: { comment: "Отлично поработал" },
    });
    markSpy.mockRestore();
  });

  it("does not block the journal save when billing throws -- records a plain attendance row and returns a soft warning", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    const markSpy = vi
      .spyOn(BillingService, "markAttendanceAndCharge")
      .mockRejectedValue(new Error("insufficient balance"));
    dbMock.attendance.upsert.mockResolvedValue({ id: "att_1" });

    const result = await setAttendance("lesson_1", "student_1", {
      status: "PRESENT",
      grade: 5,
    });

    expect(result.error).toBeUndefined();
    expect("warning" in result && result.warning).toBeTruthy();
    expect(dbMock.attendance.upsert).toHaveBeenCalledWith({
      where: { classSessionId_studentId: { classSessionId: "lesson_1", studentId: "student_1" } },
      update: { status: "PRESENT" },
      create: {
        classSessionId: "lesson_1",
        studentId: "student_1",
        status: "PRESENT",
        priceAtTime: 0,
      },
    });
    expect(dbMock.attendance.update).toHaveBeenCalledWith({
      where: { classSessionId_studentId: { classSessionId: "lesson_1", studentId: "student_1" } },
      data: { grade: 5 },
    });
    markSpy.mockRestore();
  });

  it("returns a handled error when both billing and the attendance fallback fail", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    const markSpy = vi
      .spyOn(BillingService, "markAttendanceAndCharge")
      .mockRejectedValue(new Error("insufficient balance"));
    dbMock.attendance.upsert.mockRejectedValue(new Error("db unavailable"));

    const result = await setAttendance("lesson_1", "student_1", { status: "PRESENT" });

    expect(result.error).toBeTruthy();
    markSpy.mockRestore();
  });
});

describe("gradeSubmission", () => {
  beforeEach(() => {
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: "homework-submissions/lesson_1/student_1/abc-file.pdf",
      lesson: { teacherId: "teacher_1", group: null },
    });
    dbMock.submission.update.mockResolvedValue({ id: "11111111-1111-4111-8111-111111111111" });
  });

  it("grades a submission and stamps gradedById from the session user", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await gradeSubmission({
      submissionId: "11111111-1111-4111-8111-111111111111",
      status: "GRADED",
      score: 5,
      teacherComment: "Отличная работа",
    });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.update).toHaveBeenCalledWith({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      data: {
        status: "GRADED",
        gradedById: "user_1",
        score: 5,
        teacherComment: "Отличная работа",
      },
    });
  });

  it("rejects GRADED status without a score before touching the database", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await gradeSubmission({ submissionId: "11111111-1111-4111-8111-111111111111", status: "GRADED" });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.update).not.toHaveBeenCalled();
  });

  it("allows NEEDS_REVISION without a score", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await gradeSubmission({
      submissionId: "11111111-1111-4111-8111-111111111111",
      status: "NEEDS_REVISION",
      teacherComment: "Переделай задание 3",
    });

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.update).toHaveBeenCalledWith({
      where: { id: "11111111-1111-4111-8111-111111111111" },
      data: {
        status: "NEEDS_REVISION",
        gradedById: "user_1",
        teacherComment: "Переделай задание 3",
      },
    });
  });

  it("returns a handled error (not a throw) when a TEACHER doesn't own the lesson", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: null,
      lesson: { teacherId: "someone_else", group: null },
    });

    const result = await gradeSubmission({ submissionId: "11111111-1111-4111-8111-111111111111", status: "GRADED", score: 5 });

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.update).not.toHaveBeenCalled();
  });

  it("allows a TEACHER who owns the lesson only via the group's current teacher", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: null,
      lesson: { teacherId: "previous_teacher", group: { teacherId: "teacher_1" } },
    });

    const result = await gradeSubmission({ submissionId: "11111111-1111-4111-8111-111111111111", status: "GRADED", score: 4 });

    expect(result.error).toBeUndefined();
  });

  it("returns a handled error instead of throwing when the submission does not exist", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);
    dbMock.submission.findUnique.mockResolvedValue(null);

    const result = await gradeSubmission({ submissionId: "missing", status: "GRADED", score: 5 });

    expect(result.error).toBeTruthy();
  });

  it("rejects an out-of-range score before touching the database", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await gradeSubmission({ submissionId: "11111111-1111-4111-8111-111111111111", status: "GRADED", score: 9 });

    expect(result.error).toMatch(/от 1 до 5/);
    expect(dbMock.submission.update).not.toHaveBeenCalled();
  });
});

describe("getSubmissionFileUrl", () => {
  beforeEach(() => {
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: "homework-submissions/lesson_1/student_1/abc-file.pdf",
      lesson: { teacherId: "teacher_1", group: null },
    });
  });

  it("mints a signed URL for a submission's fileKey", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);
    r2Mock.signGetObject.mockResolvedValue("https://r2.example.com/signed");

    const result = await getSubmissionFileUrl("11111111-1111-4111-8111-111111111111");

    expect(r2Mock.signGetObject).toHaveBeenCalledWith(
      "homework-submissions/lesson_1/student_1/abc-file.pdf",
    );
    expect(result).toEqual({ url: "https://r2.example.com/signed" });
  });

  it("returns a handled error when the submission has no attached file", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: null,
      lesson: { teacherId: "teacher_1", group: null },
    });

    const result = await getSubmissionFileUrl("11111111-1111-4111-8111-111111111111");

    expect(result.error).toBeTruthy();
    expect(r2Mock.signGetObject).not.toHaveBeenCalled();
  });

  it("blocks a TEACHER who doesn't own the lesson from minting a URL", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.submission.findUnique.mockResolvedValue({
      id: "11111111-1111-4111-8111-111111111111",
      lessonId: "lesson_1",
      fileKey: "homework-submissions/lesson_1/student_1/abc-file.pdf",
      lesson: { teacherId: "someone_else", group: null },
    });

    const result = await getSubmissionFileUrl("11111111-1111-4111-8111-111111111111");

    expect(result.error).toBeTruthy();
    expect(r2Mock.signGetObject).not.toHaveBeenCalled();
  });
});

describe("getHomeworkUploadUrl", () => {
  beforeEach(() => {
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "teacher_1",
      group: null,
    });
  });

  it("mints a presigned upload URL scoped to the lesson and student", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);
    r2Mock.signPutObject.mockResolvedValue("https://r2.example.com/put");

    const result = await getHomeworkUploadUrl("lesson_1", "student_1", {
      name: "hw.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeUndefined();
    expect("uploadUrl" in result && result.uploadUrl).toBe("https://r2.example.com/put");
    expect("fileKey" in result && result.fileKey).toMatch(
      /^homework-submissions\/lesson_1\/student_1\/.+-hw\.pdf$/,
    );
  });

  it("rejects a file over the 25 MB limit", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await getHomeworkUploadUrl("lesson_1", "student_1", {
      name: "big.zip",
      mimeType: "application/zip",
      sizeBytes: 26 * 1024 * 1024,
    });

    expect(result.error).toBeTruthy();
    expect(r2Mock.signPutObject).not.toHaveBeenCalled();
  });

  it("blocks a TEACHER who doesn't own the lesson", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "someone_else",
      group: null,
    });

    const result = await getHomeworkUploadUrl("lesson_1", "student_1", {
      name: "hw.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeTruthy();
    expect(r2Mock.signPutObject).not.toHaveBeenCalled();
  });

  it("returns a handled error when the lesson does not exist", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);
    dbMock.classSession.findUnique.mockResolvedValue(null);

    const result = await getHomeworkUploadUrl("missing_lesson", "student_1", {
      name: "hw.pdf",
      mimeType: "application/pdf",
      sizeBytes: 1024,
    });

    expect(result.error).toBeTruthy();
  });
});

describe("attachHomeworkFile", () => {
  beforeEach(() => {
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "teacher_1",
      group: null,
    });
    dbMock.submission.upsert.mockResolvedValue({ id: "sub_1" });
  });

  it("upserts the submission's fileKey", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await attachHomeworkFile(
      "lesson_1",
      "student_1",
      "homework-submissions/lesson_1/student_1/abc-hw.pdf",
    );

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalledWith({
      where: { lessonId_studentId: { lessonId: "lesson_1", studentId: "student_1" } },
      update: { fileKey: "homework-submissions/lesson_1/student_1/abc-hw.pdf" },
      create: {
        lessonId: "lesson_1",
        studentId: "student_1",
        fileKey: "homework-submissions/lesson_1/student_1/abc-hw.pdf",
        status: "SUBMITTED",
      },
    });
  });

  it("allows clearing the file with null", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await attachHomeworkFile("lesson_1", "student_1", null);

    expect(result.error).toBeUndefined();
    expect(dbMock.submission.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { fileKey: null } }),
    );
  });

  it("rejects a fileKey that doesn't match the lesson/student prefix (IDOR guard)", async () => {
    rbacMock.requireRole.mockResolvedValue(ADMIN);

    const result = await attachHomeworkFile(
      "lesson_1",
      "student_1",
      "homework-submissions/other_lesson/other_student/abc-hw.pdf",
    );

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });

  it("blocks a TEACHER who doesn't own the lesson", async () => {
    rbacMock.requireRole.mockResolvedValue(TEACHER);
    dbMock.classSession.findUnique.mockResolvedValue({
      teacherId: "someone_else",
      group: null,
    });

    const result = await attachHomeworkFile(
      "lesson_1",
      "student_1",
      "homework-submissions/lesson_1/student_1/abc-hw.pdf",
    );

    expect(result.error).toBeTruthy();
    expect(dbMock.submission.upsert).not.toHaveBeenCalled();
  });
});
