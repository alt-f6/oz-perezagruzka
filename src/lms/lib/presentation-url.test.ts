import { describe, it, expect } from "vitest";
import { normalizePresentationUrl } from "./presentation-url";

describe("normalizePresentationUrl", () => {
  it("converts an /edit Google Slides link to /embed", () => {
    expect(normalizePresentationUrl("https://docs.google.com/presentation/d/abc123XYZ/edit#slide=id.p")).toBe(
      "https://docs.google.com/presentation/d/abc123XYZ/embed"
    );
  });

  it("converts a /pub Google Slides link to /embed", () => {
    expect(normalizePresentationUrl("https://docs.google.com/presentation/d/abc123XYZ/pub?start=false")).toBe(
      "https://docs.google.com/presentation/d/abc123XYZ/embed"
    );
  });

  it("converts a bare /view Google Slides link to /embed", () => {
    expect(normalizePresentationUrl("https://docs.google.com/presentation/d/abc123XYZ/view")).toBe(
      "https://docs.google.com/presentation/d/abc123XYZ/embed"
    );
  });

  it("leaves an already-canonical /embed link unchanged", () => {
    expect(normalizePresentationUrl("https://docs.google.com/presentation/d/abc123XYZ/embed")).toBe(
      "https://docs.google.com/presentation/d/abc123XYZ/embed"
    );
  });

  it("leaves non-Google-Slides links (e.g. Miro) unchanged", () => {
    expect(normalizePresentationUrl("https://miro.com/app/board/o9J_ABC123=/")).toBe(
      "https://miro.com/app/board/o9J_ABC123=/"
    );
  });

  it("trims whitespace and passes an empty string through unchanged", () => {
    expect(normalizePresentationUrl("   ")).toBe("");
    expect(normalizePresentationUrl("")).toBe("");
  });
});
