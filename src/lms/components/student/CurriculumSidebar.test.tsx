// src/lms/components/student/CurriculumSidebar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// CurriculumSidebar calls useRouter() unconditionally; mock it the same way
// LessonTheaterViewer.test.tsx and app/lms/student/layout.test.tsx do.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

import { CurriculumSidebar, type CurriculumModule } from "./CurriculumSidebar";

const modules: CurriculumModule[] = [
  {
    id: "mod-1",
    title: "Месяц 1: Вводный",
    locked: false,
    lockReason: null,
    unlocksAt: null,
    lessons: [
      { id: "l1", title: "Урок 1", order: 0, assigned: true, completedAt: null, format: "video" },
      { id: "l2", title: "Урок 2", order: 1, assigned: true, completedAt: "2026-01-05T00:00:00Z", format: "audio" },
    ],
  },
  {
    id: "mod-2",
    title: "Месяц 2",
    locked: true,
    lockReason: "drip",
    unlocksAt: "2026-02-01T00:00:00Z",
    lessons: [{ id: "l3", title: "Урок 3", order: 0, assigned: false, completedAt: null, format: "presentation" }],
  },
];

describe("CurriculumSidebar", () => {
  it("renders both module headers with their titles", () => {
    render(<CurriculumSidebar modules={modules} currentLessonId="l1" />);
    expect(screen.getByText("Месяц 1: Вводный")).toBeInTheDocument();
    expect(screen.getByText("Месяц 2")).toBeInTheDocument();
  });

  it("auto-expands the module containing the current lesson and shows its lessons", () => {
    render(<CurriculumSidebar modules={modules} currentLessonId="l1" />);
    expect(screen.getByText("Урок 1")).toBeInTheDocument();
    expect(screen.getByText("Урок 2")).toBeInTheDocument();
  });

  it("shows a lock indicator with the unlock date tooltip text for a locked module", () => {
    render(<CurriculumSidebar modules={modules} currentLessonId="l1" />);
    expect(screen.getByText(/01\.02\.2026|Доступно с/)).toBeInTheDocument();
  });

  it("does not render locked lessons as clickable links", () => {
    render(<CurriculumSidebar modules={modules} currentLessonId="l1" />);
    // mod-2 is not the current lesson's module, so it starts collapsed;
    // expand it by clicking its header before inspecting its lesson row.
    const module2Header = screen.getByText("Месяц 2").closest("button");
    expect(module2Header).not.toBeNull();
    fireEvent.click(module2Header as HTMLButtonElement);

    const lockedLessonRow = screen.getByText("Урок 3").closest("button, div");
    expect(lockedLessonRow?.tagName.toLowerCase()).not.toBe("button");
  });

  it("renders an assigned lesson as clickable even when its module is locked (direct Assignment override)", () => {
    // Regression test for C1: a module with no active enrollment yet
    // (locked: true, lockReason: null) can still contain a lesson the
    // student was directly assigned via an Assignment row. page.tsx already
    // bakes that override into lesson.assigned, so the sidebar must not
    // re-AND with module.locked -- doing so previously locked out every
    // directly-assigned lesson.
    const modulesWithDirectAssignment: CurriculumModule[] = [
      {
        id: "mod-3",
        title: "Месяц 3",
        locked: true,
        lockReason: null,
        unlocksAt: null,
        lessons: [
          { id: "l4", title: "Урок 4", order: 0, assigned: true, completedAt: null, format: "text" },
        ],
      },
    ];

    render(<CurriculumSidebar modules={modulesWithDirectAssignment} currentLessonId="l4" />);

    const assignedLessonRow = screen.getByText("Урок 4").closest("button, div");
    expect(assignedLessonRow?.tagName.toLowerCase()).toBe("button");
  });
});
