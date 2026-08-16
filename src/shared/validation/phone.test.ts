import { describe, it, expect } from "vitest";
import { normalizeRussianPhone, russianPhoneSchema, russianPhoneOptionalSchema } from "./phone";

describe("normalizeRussianPhone", () => {
  it("normalizes a formatted +7 mobile number", () => {
    expect(normalizeRussianPhone("+7 (999) 123-45-67")).toBe("+79991234567");
  });

  it("normalizes an 8-prefixed number to +7", () => {
    expect(normalizeRussianPhone("89991234567")).toBe("+79991234567");
  });

  it("normalizes a 7-prefixed 11-digit number", () => {
    expect(normalizeRussianPhone("79991234567")).toBe("+79991234567");
  });

  it("normalizes a bare 10-digit mobile number starting with 9", () => {
    expect(normalizeRussianPhone("9991234567")).toBe("+79991234567");
  });

  it("treats differently-formatted input for the same number identically", () => {
    const a = normalizeRussianPhone("+7 999 123 45 67");
    const b = normalizeRussianPhone("8 (999) 123-45-67");
    expect(a).toBe(b);
    expect(a).toBe("+79991234567");
  });

  it("returns null for a bare 10-digit number not starting with 9", () => {
    expect(normalizeRussianPhone("8991234567")).toBeNull();
  });

  it("returns null for too few digits", () => {
    expect(normalizeRussianPhone("12345")).toBeNull();
  });

  it("returns null for too many digits", () => {
    expect(normalizeRussianPhone("+7999123456789")).toBeNull();
  });

  it("returns null for non-numeric input", () => {
    expect(normalizeRussianPhone("not a phone")).toBeNull();
  });
});

describe("russianPhoneSchema", () => {
  it("parses and normalizes a valid phone", () => {
    expect(russianPhoneSchema.parse("89991234567")).toBe("+79991234567");
  });

  it("rejects an empty string", () => {
    expect(russianPhoneSchema.safeParse("").success).toBe(false);
  });

  it("rejects an invalid phone with a custom message", () => {
    const result = russianPhoneSchema.safeParse("123");
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe(
        "Введите корректный номер телефона в формате +7XXXXXXXXXX",
      );
    }
  });
});

describe("russianPhoneOptionalSchema", () => {
  it("passes through undefined for an empty string", () => {
    expect(russianPhoneOptionalSchema.parse("")).toBeUndefined();
  });

  it("normalizes a valid phone when provided", () => {
    expect(russianPhoneOptionalSchema.parse("+7 999 123 45 67")).toBe("+79991234567");
  });

  it("rejects an invalid non-empty phone", () => {
    expect(russianPhoneOptionalSchema.safeParse("123").success).toBe(false);
  });
});
