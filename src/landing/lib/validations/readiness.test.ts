import { describe, it, expect } from "vitest";
import { readinessInputSchema, HOBBY_VALUES } from "@/landing/lib/validations/readiness";

const BASE_INPUT = {
  name: "Аня",
  grade: "8" as const,
  subjects: "Математика",
  studyStyle: "Учится самостоятельно, высокая успеваемость" as const,
  deadline: "3-6m" as const,
};

describe("readinessInputSchema hobbies field", () => {
  it("accepts exactly 4 selected hobbies", () => {
    const hobbies = HOBBY_VALUES.slice(0, 4).join("|");
    const result = readinessInputSchema.safeParse({ ...BASE_INPUT, hobbies });
    expect(result.success).toBe(true);
  });

  it("rejects 5 selected hobbies with the max-count message", () => {
    const hobbies = HOBBY_VALUES.slice(0, 5).join("|");
    const result = readinessInputSchema.safeParse({ ...BASE_INPUT, hobbies });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message === "Можно выбрать не более 4 увлечений")).toBe(
        true,
      );
    }
  });

  it("still rejects zero selected hobbies", () => {
    const result = readinessInputSchema.safeParse({ ...BASE_INPUT, hobbies: "" });
    expect(result.success).toBe(false);
  });
});
