// src/lms/components/student/CurriculumSidebar.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

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
    const lockedLessonRow = screen.getByText("Урок 3").closest("button, div");
    expect(lockedLessonRow?.tagName.toLowerCase()).not.toBe("button");
  });
});
