import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const requireRoleMock = vi.fn();
const findUniqueMock = vi.fn();
const updateMock = vi.fn();

vi.mock("@/shared/lib/rbac", () => ({
  requireRole: (...args: unknown[]) => requireRoleMock(...args),
}));
vi.mock("@/shared/lib/db", () => ({
  db: {
    lesson: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      update: (...args: unknown[]) => updateMock(...args),
    },
  },
}));

function makeCtx(id: string) {
  return { params: Promise.resolve({ id }) };
}

function patchRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/admin/lessons/lesson_1", {
    method: "PATCH",
    body: JSON.stringify(body),
  });
}

const lessonRow = (overrides: Partial<Record<string, unknown>> = {}) => ({
  id: "lesson_1",
  title: "Lesson 1",
  description: "",
  content: "",
  order: 1,
  isPublished: true,
  practiceLinkUrl: null,
  practiceLinkLabel: null,
  ...overrides,
});

beforeEach(() => {
  requireRoleMock.mockReset();
  findUniqueMock.mockReset();
  updateMock.mockReset();
  requireRoleMock.mockResolvedValue({ id: "admin_1", role: "ADMIN" });
});

describe("GET /api/admin/lessons/[id]", () => {
  it("hydrates the practice link fields back into the editor", async () => {
    findUniqueMock.mockResolvedValue(
      lessonRow({ practiceLinkUrl: "https://miro.com/board/1", practiceLinkLabel: "Open board" })
    );
    const { GET } = await import("./route");

    const res = await GET(new NextRequest("http://localhost/api/admin/lessons/lesson_1"), makeCtx("lesson_1"));
    const json = await res.json();

    expect(json.lesson.practice_link_url).toBe("https://miro.com/board/1");
    expect(json.lesson.practice_link_label).toBe("Open board");
  });
});

describe("PATCH /api/admin/lessons/[id]", () => {
  it("saves a trimmed practice link url and label", async () => {
    updateMock.mockResolvedValue(
      lessonRow({ practiceLinkUrl: "https://miro.com/board/1", practiceLinkLabel: "Open board" })
    );
    const { PATCH } = await import("./route");

    const res = await PATCH(
      patchRequest({
        title: "Lesson 1",
        practice_link_url: "  https://miro.com/board/1  ",
        practice_link_label: "  Open board  ",
      }),
      makeCtx("lesson_1")
    );
    const json = await res.json();

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "lesson_1" },
      data: expect.objectContaining({
        practiceLinkUrl: "https://miro.com/board/1",
        practiceLinkLabel: "Open board",
      }),
    });
    expect(json.ok).toBe(true);
  });

  it("clears both the url and label when the practice link is removed", async () => {
    updateMock.mockResolvedValue(lessonRow());
    const { PATCH } = await import("./route");

    await PATCH(
      patchRequest({ title: "Lesson 1", practice_link_url: "", practice_link_label: "stale label" }),
      makeCtx("lesson_1")
    );

    expect(updateMock).toHaveBeenCalledWith({
      where: { id: "lesson_1" },
      data: expect.objectContaining({ practiceLinkUrl: null, practiceLinkLabel: null }),
    });
  });

  it("rejects a non-http(s) practice link url", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(
      patchRequest({ title: "Lesson 1", practice_link_url: "javascript:alert(1)" }),
      makeCtx("lesson_1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_practice_link_url");
    expect(updateMock).not.toHaveBeenCalled();
  });

  it("rejects a malformed practice link url", async () => {
    const { PATCH } = await import("./route");

    const res = await PATCH(
      patchRequest({ title: "Lesson 1", practice_link_url: "not a url" }),
      makeCtx("lesson_1")
    );
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe("invalid_practice_link_url");
  });
});
