import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import PainPoints from "./PainPoints";

describe("PainPoints", () => {
  it("labels Гузель as a 9th-grade parent, consistent with her ОГЭ quote", () => {
    render(<PainPoints />);

    const card = screen.getByText("Гузель").closest("div");
    expect(card).not.toBeNull();
    expect(screen.getAllByText("мама ученика 9 класса", { exact: false })).toHaveLength(2);
    expect(screen.queryByText("мама ученика 11 класса")).not.toBeInTheDocument();
  });
});
