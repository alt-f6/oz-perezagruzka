import { describe, it, expect, vi, beforeEach } from "vitest";

const requireAuthMock = vi.fn();
const canViewLessonMock = vi.fn();
const updateManyMock = vi.fn();
const upsertMock = vi.fn();
const revalidatePathMock = vi.fn();

vi.mock("next/cache", () => ({
  revalidatePath: (...args: unknown[]) => revalidatePathMock(...args),
}));
vi.mock("@/lms/server/auth/require-auth", () => ({
  requireAuth: (...args: unknown[]) => requireAuthMock(...args),
}));
vi.mock("@/lms/server/access/can-view-lesson", () => ({
  canViewLesson: (...args: unknown[]) => canViewLessonMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonProgress: {
      updateMany: (...args: unknown[]) => updateManyMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
    },
  },
}));

beforeEach(() => {
  requireAuthMock.mockReset();
  canViewLessonMock.mockReset();
  updateManyMock.mockReset();
  upsertMock.mockReset();
  requireAuthMock.mockResolvedValue({ id: "student_1", role: "STUDENT" });
  canViewLessonMock.mockResolvedValue(true);
});

describe("syncPlaybackPosition", () => {
  it("writes forward progress with a WHERE lastPositionSeconds < incoming guard", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const { syncPlaybackPosition } = await import("./actions");

    const result = await syncPlaybackPosition("lesson_1", 120);

    expect(updateManyMock).toHaveBeenCalledWith({
      where: { studentId: "student_1", lessonId: "lesson_1", lastPositionSeconds: { lt: 120 } },
      data: { lastPositionSeconds: 120 },
    });
    expect(upsertMock).not.toHaveBeenCalled();
    expect(result).toEqual({ ok: true });
  });

  it("creates the row via upsert when no LessonProgress row exists yet", async () => {
    updateManyMock.mockResolvedValue({ count: 0 });
    upsertMock.mockResolvedValue({});
    const { syncPlaybackPosition } = await import("./actions");

    await syncPlaybackPosition("lesson_1", 30);

    expect(upsertMock).toHaveBeenCalledWith({
      where: { studentId_lessonId: { studentId: "student_1", lessonId: "lesson_1" } },
      create: { studentId: "student_1", lessonId: "lesson_1", lastPositionSeconds: 30 },
      update: {},
    });
  });

  it("does not lower an existing higher stored position for an out-of-order write", async () => {
    // count: 0 here means the row exists but its lastPositionSeconds was NOT < incoming,
    // so the WHERE guard matched nothing -- the upsert fallback must not overwrite it.
    updateManyMock.mockResolvedValue({ count: 0 });
    upsertMock.mockResolvedValue({});
    const { syncPlaybackPosition } = await import("./actions");

    await syncPlaybackPosition("lesson_1", 50);

    expect(upsertMock).toHaveBeenCalledWith(
      expect.objectContaining({ update: {} }),
    );
  });

  it("clamps a negative/fractional position to a non-negative integer before writing", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });
    const { syncPlaybackPosition } = await import("./actions");

    await syncPlaybackPosition("lesson_1", -4.7);

    expect(updateManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ lastPositionSeconds: { lt: 0 } }),
        data: { lastPositionSeconds: 0 },
      }),
    );
  });

  it("returns forbidden without writing when the caller lacks lesson access", async () => {
    canViewLessonMock.mockResolvedValue(false);
    const { syncPlaybackPosition } = await import("./actions");

    const result = await syncPlaybackPosition("lesson_1", 90);

    expect(result).toEqual({ ok: false, error: "forbidden" });
    expect(updateManyMock).not.toHaveBeenCalled();
    expect(upsertMock).not.toHaveBeenCalled();
  });
});
