import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { TimezoneBadge } from "./TimezoneBadge";

describe("TimezoneBadge", () => {
  it("labels the fixed business timezone", () => {
    render(<TimezoneBadge />);
    expect(screen.getByText(/МСК/i)).toBeInTheDocument();
    expect(screen.getByText(/UTC\+3/)).toBeInTheDocument();
  });
});
