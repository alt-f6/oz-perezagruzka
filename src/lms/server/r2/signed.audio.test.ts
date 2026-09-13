// src/lms/server/r2/signed.audio.test.ts
import { describe, it, expect, vi } from "vitest";

const getSignedUrlMock = vi.fn().mockResolvedValue("https://signed.example/audio.mp3");

vi.mock("@aws-sdk/s3-request-presigner", () => ({ getSignedUrl: (...args: unknown[]) => getSignedUrlMock(...args) }));
vi.mock("@/lms/server/r2/client", () => ({ r2: {}, R2_BUCKET: "test-bucket" }));

describe("signLessonAssetGetUrl", () => {
  it("passes the asset's real mimeType as responseContentType so iOS Safari gets a correct Content-Type header", async () => {
    const { signLessonAssetGetUrl } = await import("./signed");

    await signLessonAssetGetUrl({
      storageKey: "lessons/l1/assets/a1-podcast.mp3",
      mimeType: "audio/mpeg",
      originalName: "podcast.mp3",
    });

    const [, cmd] = getSignedUrlMock.mock.calls[0];
    expect(cmd.input.ResponseContentType).toBe("audio/mpeg");
    expect(cmd.input.Key).toBe("lessons/l1/assets/a1-podcast.mp3");
  });
});
