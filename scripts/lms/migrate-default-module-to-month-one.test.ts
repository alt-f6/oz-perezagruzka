import { describe, it, expect, vi, beforeEach } from "vitest";

const findFirstCourseMock = vi.fn();
const updateModuleMock = vi.fn();
const findManyOrphanLessonsMock = vi.fn();
const updateManyLessonMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: {
    course: { findFirst: (...args: unknown[]) => findFirstCourseMock(...args) },
    module: { update: (...args: unknown[]) => updateModuleMock(...args) },
    lesson: {
      findMany: (...args: unknown[]) => findManyOrphanLessonsMock(...args),
      updateMany: (...args: unknown[]) => updateManyLessonMock(...args),
    },
  },
}));

describe("migrateDefaultModuleToMonthOne", () => {
  beforeEach(() => {
    findFirstCourseMock.mockReset();
    updateModuleMock.mockReset();
    findManyOrphanLessonsMock.mockReset();
    updateManyLessonMock.mockReset();
  });

  it("renames the default module to 'Месяц 1: Вводный' and relinks orphan lessons", async () => {
    findFirstCourseMock.mockResolvedValue({
      id: "course-default",
      modules: [{ id: "mod-default", title: "Уроки" }],
    });
    findManyOrphanLessonsMock.mockResolvedValue([{ id: "lesson-orphan-1" }, { id: "lesson-orphan-2" }]);
    updateManyLessonMock.mockResolvedValue({ count: 2 });

    const { migrateDefaultModuleToMonthOne } = await import("./migrate-default-module-to-month-one");
    const result = await migrateDefaultModuleToMonthOne();

    expect(updateModuleMock).toHaveBeenCalledWith({
      where: { id: "mod-default" },
      data: { title: "Месяц 1: Вводный" },
    });
    expect(result).toEqual({ courseId: "course-default", moduleId: "mod-default", relinkedLessonCount: 2 });
  });

  it("is a no-op returning null moduleId when no default course exists yet", async () => {
    findFirstCourseMock.mockResolvedValue(null);

    const { migrateDefaultModuleToMonthOne } = await import("./migrate-default-module-to-month-one");
    const result = await migrateDefaultModuleToMonthOne();

    expect(result).toBeNull();
    expect(updateModuleMock).not.toHaveBeenCalled();
  });

  it("is idempotent: running it twice does not re-append to an already-renamed module title", async () => {
    findFirstCourseMock.mockResolvedValue({
      id: "course-default",
      modules: [{ id: "mod-default", title: "Месяц 1: Вводный" }],
    });
    findManyOrphanLessonsMock.mockResolvedValue([]);
    updateManyLessonMock.mockResolvedValue({ count: 0 });

    const { migrateDefaultModuleToMonthOne } = await import("./migrate-default-module-to-month-one");
    await migrateDefaultModuleToMonthOne();

    expect(updateModuleMock).not.toHaveBeenCalled();
  });
});
