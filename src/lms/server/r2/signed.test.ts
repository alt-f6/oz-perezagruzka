import { describe, it, expect, vi, beforeEach } from "vitest";

const getSignedUrlMock = vi.fn();

vi.mock("@aws-sdk/s3-request-presigner", () => ({
  getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args),
}));
vi.mock("@/lms/server/r2/client", () => ({
  r2: {},
  R2_BUCKET: "test-bucket",
}));

beforeEach(() => {
  vi.resetModules();
  getSignedUrlMock.mockReset();
  getSignedUrlMock.mockResolvedValue("https://signed.example/url");
  delete process.env.R2_UPLOAD_TTL_SECONDS;
  delete process.env.R2_VIEW_TTL_SECONDS;
});

describe("r2 signed URL TTLs", () => {
  it("signs PUT (upload) URLs with R2_UPLOAD_TTL_SECONDS", async () => {
    process.env.R2_UPLOAD_TTL_SECONDS = "120";
    const { signPutObject } = await import("./signed");

    await signPutObject("key.mp4", "video/mp4");

    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 120 },
    );
  });

  it("signs GET (view) URLs with R2_VIEW_TTL_SECONDS", async () => {
    process.env.R2_VIEW_TTL_SECONDS = "7200";
    const { signGetObject } = await import("./signed");

    await signGetObject("key.mp4");

    expect(getSignedUrlMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { expiresIn: 7200 },
    );
  });

  it("falls back to 900s upload / 7200s view defaults when the env vars are unset", async () => {
    const { signPutObject, signGetObject } = await import("./signed");

    await signPutObject("key.mp4", "video/mp4");
    await signGetObject("key.mp4");

    expect(getSignedUrlMock).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), {
      expiresIn: 900,
    });
    expect(getSignedUrlMock).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), {
      expiresIn: 7200,
    });
  });

  // Regression guard (P0: "PDF attachment shows progress then disappears").
  // The default upload TTL must let the LARGEST allowed asset finish uploading
  // on a realistically slow link; otherwise the presigned PUT expires mid-upload
  // and the client tears the asset back down. A prior TTL-split set this to 120s
  // (~1.75 Mbps required for a 25 MB file), which large PDFs could not meet.
  it("default upload TTL covers the max asset size on a slow (256 kbps) uplink", async () => {
    const { signPutObject } = await import("./signed");
    const { LESSON_ASSET_MAX_SIZE_BYTES } = await import("@/lms/lib/lesson-assets");

    await signPutObject("big.pdf", "application/pdf");
    const usedTtl = getSignedUrlMock.mock.calls[0][2].expiresIn as number;

    const slowLinkBytesPerSec = (256 * 1000) / 8; // 256 kbps
    const secondsToUploadMax = LESSON_ASSET_MAX_SIZE_BYTES / slowLinkBytesPerSec;

    expect(usedTtl).toBeGreaterThanOrEqual(secondsToUploadMax);
  });

  it("uses distinct TTLs for upload vs. view when both env vars are set to different values", async () => {
    process.env.R2_UPLOAD_TTL_SECONDS = "60";
    process.env.R2_VIEW_TTL_SECONDS = "3600";
    const { signPutObject, signGetObject } = await import("./signed");

    await signPutObject("key.mp4", "video/mp4");
    await signGetObject("key.mp4");

    expect(getSignedUrlMock).toHaveBeenNthCalledWith(1, expect.anything(), expect.anything(), {
      expiresIn: 60,
    });
    expect(getSignedUrlMock).toHaveBeenNthCalledWith(2, expect.anything(), expect.anything(), {
      expiresIn: 3600,
    });
  });
});
