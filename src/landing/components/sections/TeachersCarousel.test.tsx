import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import TeachersCarousel from "./TeachersCarousel";

describe("TeachersCarousel", () => {
  it("shows the heading and every teacher's name, subject and quote", () => {
    render(<TeachersCarousel />);

    expect(screen.getByText("Наши педагоги")).toBeInTheDocument();
    expect(screen.getByText("Алиса Егорова")).toBeInTheDocument();
    expect(screen.getByText("РУССКИЙ ЯЗЫК · ОГЭ И ЕГЭ")).toBeInTheDocument();
    expect(screen.getByText("Сергей Фофанов")).toBeInTheDocument();
    expect(screen.getByText("86")).toBeInTheDocument();
  });

  it("renders navigation controls and pagination dots", () => {
    render(<TeachersCarousel />);

    expect(screen.getByRole("button", { name: "Предыдущий педагог" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Следующий педагог" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перейти к педагогу 1" })).toBeInTheDocument();
  });
});
