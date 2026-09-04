import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: vi.fn() }),
  usePathname: () => "/student/lessons/lesson_1",
  useSearchParams: () => new URLSearchParams(),
}));

vi.mock("@/lms/components/student/CurriculumSidebar", () => ({
  CurriculumSidebar: () => null,
}));
vi.mock("@/lms/components/student/LessonStage", () => ({
  LessonStage: () => null,
}));
vi.mock("@/lms/components/student/LessonCompletionToggle", () => ({
  LessonCompletionToggle: () => null,
}));

import { LessonTheaterViewer } from "./LessonTheaterViewer";

const baseLesson = { id: "lesson_1", title: "Intro", description: "", content: "", order: 1 };

describe("LessonTheaterViewer — practice link", () => {
  it("renders a safe, prominent new-tab practice link button when one is set on the lesson", () => {
    render(
      <LessonTheaterViewer
        studentId="student_1"
        studentEmail="student1@example.com"
        lesson={baseLesson}
        media={[]}
        pdfs={[]}
        practiceLink={{ url: "https://miro.com/board/1", label: "Open the board" }}
        curriculum={[]}
        initialCompleted={false}
        initialPosition={0}
      />
    );

    const link = screen.getByRole("link", { name: /Open the board/i });
    expect(link).toHaveAttribute("href", "https://miro.com/board/1");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("falls back to a default label when none is configured", () => {
    render(
      <LessonTheaterViewer
        studentId="student_1"
        studentEmail="student1@example.com"
        lesson={baseLesson}
        media={[]}
        pdfs={[]}
        practiceLink={{ url: "https://miro.com/board/1", label: null }}
        curriculum={[]}
        initialCompleted={false}
        initialPosition={0}
      />
    );

    expect(screen.getByRole("link", { name: /Открыть практику/i })).toBeInTheDocument();
  });

  it("renders no practice link button when the lesson has none", () => {
    render(
      <LessonTheaterViewer
        studentId="student_1"
        studentEmail="student1@example.com"
        lesson={baseLesson}
        media={[]}
        pdfs={[]}
        practiceLink={null}
        curriculum={[]}
        initialCompleted={false}
        initialPosition={0}
      />
    );

    expect(screen.queryByRole("link", { name: /Открыть практику/i })).not.toBeInTheDocument();
  });
});
