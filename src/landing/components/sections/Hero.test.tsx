import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Hero from "./Hero";

describe("Hero", () => {
  it("references ОГЭ, not ЕГЭ, in the pass-count stat, matching the site's OGE positioning", () => {
    render(<Hero />);

    expect(screen.getByText("2000 учеников сдали ОГЭ")).toBeInTheDocument();
    expect(screen.queryByText(/сдали ЕГЭ/)).not.toBeInTheDocument();
  });

  it("frames the recommendation stat as a percentage instead of '4 из 5'", () => {
    render(<Hero />);

    expect(screen.getByText("80% родителей — по рекомендации")).toBeInTheDocument();
    expect(screen.queryByText(/4 из 5/)).not.toBeInTheDocument();
  });
});
