import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findManyMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lessonAsset: { findMany: (...args: unknown[]) => findManyMock(...args) },
  },
}));

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

const assetRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "asset_1",
  kind: "pdf",
  title: "Homework",
  originalName: "homework.pdf",
  mimeType: "application/pdf",
  sizeBytes: 1024n,
  order: 1,
  isPublic: true,
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findManyMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("GET /api/admin/lessons/[id]/assets", () => {
  it("returns previously uploaded assets scoped to the lesson, unfiltered by visibility", async () => {
    findManyMock.mockResolvedValue([assetRow()]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/lessons/lesson_1/assets"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(findManyMock).toHaveBeenCalledWith({
      where: { lessonId: "lesson_1" },
      orderBy: [{ order: "asc" }, { id: "asc" }],
    });
    expect(json.ok).toBe(true);
    expect(json.items).toEqual([
      {
        id: "asset_1",
        kind: "pdf",
        title: "Homework",
        original_name: "homework.pdf",
        mime_type: "application/pdf",
        size_bytes: 1024,
        order: 1,
        is_public: true,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("still surfaces an asset stuck mid-upload (isPublic: false) so the admin editor never shows an empty list for it", async () => {
    findManyMock.mockResolvedValue([assetRow({ id: "asset_2", isPublic: false, sizeBytes: 0n })]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/lessons/lesson_1/assets"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(json.items).toHaveLength(1);
    expect(json.items[0].is_public).toBe(false);
  });

  it("returns an empty list only when the lesson truly has no assets", async () => {
    findManyMock.mockResolvedValue([]);
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/lessons/lesson_1/assets"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(json.items).toEqual([]);
  });
});
