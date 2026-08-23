import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { hasSignedSessionCookie, signToken, SESSION_COOKIE_NAME } from "./auth";

function requestWithCookie(value?: string): NextRequest {
  const headers = new Headers();
  if (value !== undefined) {
    headers.set("cookie", `${SESSION_COOKIE_NAME}=${value}`);
  }
  return new NextRequest("http://localhost/crm/dashboard", { headers });
}

describe("hasSignedSessionCookie", () => {
  it("returns false when no cookie is present", () => {
    expect(hasSignedSessionCookie(requestWithCookie())).toBe(false);
  });

  it("returns false when the cookie value fails HMAC verification", () => {
    expect(hasSignedSessionCookie(requestWithCookie("tampered.garbage"))).toBe(false);
  });

  it("returns true for a validly signed token, without touching the database", () => {
    const signed = signToken("some-opaque-session-token");
    expect(hasSignedSessionCookie(requestWithCookie(signed))).toBe(true);
  });
});
