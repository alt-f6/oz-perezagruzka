import { render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LessonMetadataForm, type Lesson } from "./LessonMetadataForm";

function makeLesson(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "lesson_1",
    title: "Lesson 1",
    description: "",
    content: "",
    is_published: false,
    order: 1,
    practice_link_url: null,
    practice_link_label: null,
    presentation_embed_url: null,
    homework_task: null,
    module_id: "module_1",
    course_id: "course_1",
    ...overrides,
  };
}

function renderForm(lesson: Lesson, onChange = vi.fn()) {
  return render(
    <LessonMetadataForm
      lesson={lesson}
      onChange={onChange}
      onSave={() => {}}
      onRefresh={() => {}}
      saving={false}
      error={null}
    />
  );
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("LessonMetadataForm course/module hydration", () => {
  it("hydrates the course filter from the loaded lesson so the module list loads without user interaction", async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url === "/api/admin/courses") {
        return { ok: true, json: async () => ({ ok: true, courses: [{ id: "course_1", title: "Course 1", isPublished: true }] }) };
      }
      if (url === "/api/admin/courses/course_1/modules") {
        return {
          ok: true,
          json: async () => ({ ok: true, modules: [{ id: "module_1", title: "Module 1", order: 0, unlockMode: "MANUAL" }] }),
        };
      }
      return { ok: true, json: async () => ({ ok: true }) };
    });
    vi.stubGlobal("fetch", fetchMock);

    renderForm(makeLesson());

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/courses/course_1/modules", { method: "GET" });
    });
  });

  it("does not wipe the pre-selected module_id while hydrating", async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, json: async () => ({ ok: true, courses: [], modules: [] }) }));
    vi.stubGlobal("fetch", fetchMock);
    const onChange = vi.fn();

    renderForm(makeLesson({ module_id: "module_1", course_id: "course_1" }), onChange);

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/admin/courses/course_1/modules", { method: "GET" });
    });

    expect(onChange).not.toHaveBeenCalled();
  });
});
