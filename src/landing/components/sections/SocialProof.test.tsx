import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import SocialProof from "./SocialProof";

// jsdom has no layout engine; ResizeObserver isn't implemented.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
vi.stubGlobal("ResizeObserver", ResizeObserverStub);

describe("SocialProof", () => {
  it("uses the same '80% родителей — по рекомендации' framing as Hero", () => {
    render(<SocialProof />);

    expect(screen.getByText("80% родителей — по рекомендации")).toBeInTheDocument();
    expect(screen.queryByText(/3 из 3/)).not.toBeInTheDocument();
  });
});
