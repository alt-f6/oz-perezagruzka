import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: { classSession: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

import { listLessons } from "./lesson-list.service";

beforeEach(() => {
  findManyMock.mockReset();
  findManyMock.mockResolvedValue([]);
});

describe("listLessons", () => {
  it("scopes to the teacher's own sessions for TEACHER", async () => {
    await listLessons({ sessionUser: { id: "t1", role: "TEACHER" } });
    expect(findManyMock.mock.calls[0][0].where).toEqual({ teacherId: "t1" });
  });

  it("applies no teacher filter for ADMIN/MANAGER", async () => {
    await listLessons({ sessionUser: { id: "a1", role: "ADMIN" } });
    expect(findManyMock.mock.calls[0][0].where).toBeUndefined();
  });

  it("requests limit+1 rows ordered by scheduledAt/id desc and returns nextCursor from the extra row", async () => {
    findManyMock.mockResolvedValue([
      { id: "l2", scheduledAt: new Date("2026-01-02") },
      { id: "l1", scheduledAt: new Date("2026-01-01") },
    ]);

    const result = await listLessons({ sessionUser: { id: "a1", role: "ADMIN" }, limit: 1 });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
        take: 2,
      }),
    );
    expect(result.lessons).toHaveLength(1);
    expect(result.nextCursor).toBe("l2");
  });

  it("passes cursor/skip through when a cursor is given", async () => {
    await listLessons({ sessionUser: { id: "a1", role: "ADMIN" }, cursor: "l5" });
    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "l5" }, skip: 1 }),
    );
  });
});
