import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../app/lms/student/lessons/[id]/actions", () => ({
  syncPlaybackPosition: vi.fn(),
  setLessonCompletion: vi.fn(),
}));

import { LessonStage } from "./LessonStage";

describe("LessonStage — presentation assets", () => {
  it("renders a presentation as a resilient full-height iframe pointing at its url", () => {
    render(
      <LessonStage
        lessonId="lesson_1"
        studentId="student_1"
        studentEmail="student1@example.com"
        media={[]}
        pdfs={[]}
        presentations={[
          { id: "pres_1", title: "Урок 1", url: "/courses/math-ege-base/01_Vychisleniya.html", order: 1 },
        ]}
        initialPosition={0}
      />
    );

    const iframe = screen.getByTitle("Урок 1");
    expect(iframe.tagName).toBe("IFRAME");
    expect(iframe).toHaveAttribute("src", "/courses/math-ege-base/01_Vychisleniya.html");
    expect(iframe.className).toContain("w-full");
    expect(iframe.className).toContain("h-full");
    expect(iframe.className).toContain("min-h-[85vh]");
  });

  it("shows the no-media message when there are no video, pdf, or presentation assets", () => {
    render(
      <LessonStage
        lessonId="lesson_1"
        studentId="student_1"
        studentEmail="student1@example.com"
        media={[]}
        pdfs={[]}
        presentations={[]}
        initialPosition={0}
      />
    );

    expect(screen.getByText(/Для этого урока пока нет видео или PDF/i)).toBeInTheDocument();
  });
});
