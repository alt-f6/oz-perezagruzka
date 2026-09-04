import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Kept SEPARATE from signed.test.ts (which mocks getSignedUrl to assert TTLs):
// these tests exercise the REAL AWS presigner so they can inspect the actual
// response-* query params baked into the URL. The R2 client reads its config
// from env at import time and throws if any is missing, so we seed fake creds
// first. getSignedUrl signs purely locally (HMAC over the request) — no
// network — so the fakes are sufficient.
const R2_ENV = {
  R2_BUCKET: "test-bucket",
  R2_ENDPOINT: "https://example.r2.cloudflarestorage.com",
  R2_ACCESS_KEY_ID: "test-access-key",
  R2_SECRET_ACCESS_KEY: "test-secret-key",
  R2_REGION: "auto",
};

const originalEnv = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...originalEnv, ...R2_ENV };
  delete process.env.R2_VIEW_TTL_SECONDS;
});

afterEach(() => {
  process.env = { ...originalEnv };
  vi.restoreAllMocks();
});

describe("signGetObject — PDF inline delivery headers", () => {
  it("emits a presigned GET URL that forces inline application/pdf rendering", async () => {
    const { signGetObject } = await import("@/lms/server/r2/signed");

    const url = await signGetObject("lessons/l1/assets/a1-material.pdf", {
      responseContentType: "application/pdf",
      responseContentDisposition: "inline",
    });

    const parsed = new URL(url);

    // Browsers only render a PDF inline when the object comes back with the
    // right Content-Type and an inline (not attachment) Content-Disposition;
    // both must be baked into the signed URL as response-* overrides.
    expect(parsed.searchParams.get("response-content-type")).toBe("application/pdf");
    expect(parsed.searchParams.get("response-content-disposition")).toBe("inline");
  });

  it("signs the view URL with the 7200s default TTL", async () => {
    const { signGetObject } = await import("@/lms/server/r2/signed");

    const url = await signGetObject("lessons/l1/assets/a1-material.pdf", {
      responseContentType: "application/pdf",
      responseContentDisposition: "inline",
    });

    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("7200");
  });

  it("respects a R2_VIEW_TTL_SECONDS override", async () => {
    process.env.R2_VIEW_TTL_SECONDS = "3600";
    const { signGetObject } = await import("@/lms/server/r2/signed");

    const url = await signGetObject("lessons/l1/assets/a1-material.pdf");

    expect(new URL(url).searchParams.get("X-Amz-Expires")).toBe("3600");
  });
});
