import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Hero from "./Hero";

describe("Hero", () => {
  it("references ОГЭ, not ЕГЭ, in the pass-count stat, matching the site's OGE positioning", () => {
    render(<Hero />);

    expect(screen.getByText("2000 учеников сдали ОГЭ")).toBeInTheDocument();
    expect(screen.queryByText(/сдали ЕГЭ/)).not.toBeInTheDocument();
  });
});
