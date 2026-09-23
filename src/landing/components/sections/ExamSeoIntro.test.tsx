import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import ExamSeoIntro from "./ExamSeoIntro";

describe("ExamSeoIntro", () => {
  it("renders the given title as an h2 and the description as body text", () => {
    render(<ExamSeoIntro title="Репетитор ОГЭ онлайн" description="Мини-группы и ИИ-репетитор 24/7." />);

    expect(screen.getByRole("heading", { level: 2, name: "Репетитор ОГЭ онлайн" })).toBeInTheDocument();
    expect(screen.getByText("Мини-группы и ИИ-репетитор 24/7.")).toBeInTheDocument();
  });
});
