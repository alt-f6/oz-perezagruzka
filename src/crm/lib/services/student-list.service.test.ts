import { describe, it, expect, vi, beforeEach } from "vitest";

const findManyMock = vi.fn();

vi.mock("@/shared/lib/db", () => ({
  db: { student: { findMany: (...args: unknown[]) => findManyMock(...args) } },
}));

import { listStudents } from "./student-list.service";

beforeEach(() => {
  findManyMock.mockReset();
});

describe("listStudents", () => {
  it("scopes to the teacher's own groups and omits phone/transactions for a TEACHER", async () => {
    findManyMock.mockResolvedValue([
      { id: "s1", fullName: "Ann", groups: [{ group: { id: "g1", name: "G1", teacherId: "t1" } }] },
    ]);

    const result = await listStudents({ sessionUser: { id: "t1", role: "TEACHER" } });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.groups).toEqual({ some: { group: { teacherId: "t1" } } });
    expect(call.select.phone).toBeUndefined();
    expect(call.select.transactions).toBeUndefined();
    expect(result.students[0]).toEqual({
      id: "s1",
      fullName: "Ann",
      phone: null,
      groups: [{ id: "g1", name: "G1", teacherId: "t1" }],
      transactions: [],
    });
  });

  it("includes phone/transactions and no group filter for ADMIN/MANAGER", async () => {
    findManyMock.mockResolvedValue([
      {
        id: "s1",
        fullName: "Ann",
        phone: "+79990000000",
        groups: [],
        transactions: [{ amount: "500.00" }],
      },
    ]);

    const result = await listStudents({ sessionUser: { id: "a1", role: "ADMIN" } });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.groups).toBeUndefined();
    expect(result.students[0].phone).toBe("+79990000000");
    expect(result.students[0].transactions).toEqual([{ amount: 500 }]);
  });

  it("filters by fullName or phone contains (case-insensitive) when search is given", async () => {
    findManyMock.mockResolvedValue([]);

    await listStudents({ sessionUser: { id: "a1", role: "ADMIN" }, search: "  Ann  " });

    const call = findManyMock.mock.calls[0][0];
    expect(call.where.OR).toEqual([
      { fullName: { contains: "Ann", mode: "insensitive" } },
      { phone: { contains: "Ann" } },
    ]);
  });

  it("omits the OR filter entirely when search is empty/whitespace", async () => {
    findManyMock.mockResolvedValue([]);

    await listStudents({ sessionUser: { id: "a1", role: "ADMIN" }, search: "   " });

    expect(findManyMock.mock.calls[0][0].where.OR).toBeUndefined();
  });

  it("requests limit+1 rows, orders by id desc, and returns nextCursor from the extra row", async () => {
    findManyMock.mockResolvedValue([
      { id: "s2", fullName: "B", groups: [] },
      { id: "s1", fullName: "A", groups: [] },
    ]);

    const result = await listStudents({ sessionUser: { id: "a1", role: "ADMIN" }, limit: 1 });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { id: "desc" }, take: 2 }),
    );
    expect(result.students).toHaveLength(1);
    expect(result.nextCursor).toBe("s2");
  });

  it("passes cursor/skip through when a cursor is given", async () => {
    findManyMock.mockResolvedValue([]);

    await listStudents({ sessionUser: { id: "a1", role: "ADMIN" }, cursor: "s5" });

    expect(findManyMock).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: "s5" }, skip: 1 }),
    );
  });

  it("always filters out soft-deleted students", async () => {
    findManyMock.mockResolvedValue([]);

    await listStudents({ sessionUser: { id: "a1", role: "ADMIN" } });

    expect(findManyMock.mock.calls[0][0].where.deletedAt).toBeNull();
  });
});
