import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AccessDeniedPage from "./page";

describe("CRM /access-denied page", () => {
  it("renders an explanatory message, not a blank or error-looking screen", () => {
    render(<AccessDeniedPage />);
    expect(screen.getByText(/доступ запрещ/i)).toBeInTheDocument();
  });
});
