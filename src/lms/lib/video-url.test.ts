import { describe, it, expect } from "vitest";
import { parseAndNormalizeVideoUrl } from "./video-url";

describe("parseAndNormalizeVideoUrl", () => {
  describe("VK Video", () => {
    it("parses vk.com/video_ext.php with oid/id/hash", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://vk.com/video_ext.php?oid=-123456&id=456789&hash=abc123def"
      );
      expect(result).toEqual({
        isValid: true,
        provider: "vk",
        embedUrl: "https://vk.com/video_ext.php?oid=-123456&id=456789&hash=abc123def",
        originalUrl: "https://vk.com/video_ext.php?oid=-123456&id=456789&hash=abc123def",
      });
    });

    it("parses vk.com/video-OID_ID", () => {
      const result = parseAndNormalizeVideoUrl("https://vk.com/video-123456_456789");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("vk");
        expect(result.embedUrl).toBe("https://vk.com/video_ext.php?oid=-123456&id=456789");
      }
    });

    it("parses vkvideo.ru/video-OID_ID", () => {
      const result = parseAndNormalizeVideoUrl("https://vkvideo.ru/video-123456_456789");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("vk");
        expect(result.embedUrl).toBe("https://vk.com/video_ext.php?oid=-123456&id=456789");
      }
    });

    it("includes the trailing hash segment when present", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://vkvideo.ru/video-123456_456789_abcDEF123hash"
      );
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.embedUrl).toBe(
          "https://vk.com/video_ext.php?oid=-123456&id=456789&hash=abcDEF123hash"
        );
      }
    });
  });

  describe("RuTube", () => {
    it("parses rutube.ru/video/{id}", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://rutube.ru/video/8a4c1c4b3f6f5e2d1a0b9c8d7e6f5a4b/"
      );
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("rutube");
        expect(result.embedUrl).toBe(
          "https://rutube.ru/play/embed/8a4c1c4b3f6f5e2d1a0b9c8d7e6f5a4b"
        );
      }
    });

    it("parses rutube.ru/play/embed/{id}", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://rutube.ru/play/embed/8a4c1c4b3f6f5e2d1a0b9c8d7e6f5a4b"
      );
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("rutube");
        expect(result.embedUrl).toBe(
          "https://rutube.ru/play/embed/8a4c1c4b3f6f5e2d1a0b9c8d7e6f5a4b"
        );
      }
    });
  });

  describe("Kinescope", () => {
    it("parses kinescope.io/{id}", () => {
      const result = parseAndNormalizeVideoUrl("https://kinescope.io/abcDEF123456");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("kinescope");
        expect(result.embedUrl).toBe("https://kinescope.io/embed/abcDEF123456");
      }
    });

    it("parses kinescope.io/embed/{id}", () => {
      const result = parseAndNormalizeVideoUrl("https://kinescope.io/embed/abcDEF123456");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("kinescope");
        expect(result.embedUrl).toBe("https://kinescope.io/embed/abcDEF123456");
      }
    });
  });

  describe("YouTube", () => {
    it("parses a standard watch URL", () => {
      const result = parseAndNormalizeVideoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("youtube");
        expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
      }
    });

    it("parses a watch URL with extra query params before v=", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://www.youtube.com/watch?list=PL123&v=dQw4w9WgXcQ&t=30s"
      );
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
      }
    });

    it("parses a short youtu.be URL", () => {
      const result = parseAndNormalizeVideoUrl("https://youtu.be/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("youtube");
        expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
      }
    });

    it("parses a Shorts URL", () => {
      const result = parseAndNormalizeVideoUrl("https://www.youtube.com/shorts/dQw4w9WgXcQ");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("youtube");
        expect(result.embedUrl).toBe("https://www.youtube.com/embed/dQw4w9WgXcQ");
      }
    });
  });

  describe("Vimeo", () => {
    it("parses a vimeo.com URL", () => {
      const result = parseAndNormalizeVideoUrl("https://vimeo.com/76979871");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("vimeo");
        expect(result.embedUrl).toBe("https://player.vimeo.com/video/76979871");
      }
    });
  });

  describe("Direct media", () => {
    it("accepts a direct .mp4 URL", () => {
      const result = parseAndNormalizeVideoUrl("https://cdn.example.com/lessons/intro.mp4");
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("direct");
        expect(result.embedUrl).toBe("https://cdn.example.com/lessons/intro.mp4");
      }
    });

    it("accepts a direct .webm URL", () => {
      const result = parseAndNormalizeVideoUrl("https://cdn.example.com/lessons/intro.webm");
      expect(result.isValid).toBe(true);
      if (result.isValid) expect(result.provider).toBe("direct");
    });

    it("accepts a direct .m3u8 URL with a query string", () => {
      const result = parseAndNormalizeVideoUrl(
        "https://cdn.example.com/lessons/intro.m3u8?token=abc"
      );
      expect(result.isValid).toBe(true);
      if (result.isValid) {
        expect(result.provider).toBe("direct");
        expect(result.embedUrl).toBe("https://cdn.example.com/lessons/intro.m3u8?token=abc");
      }
    });

    it("rejects a non-http(s) scheme even with a media extension", () => {
      const result = parseAndNormalizeVideoUrl("ftp://cdn.example.com/lessons/intro.mp4");
      expect(result.isValid).toBe(false);
    });
  });

  describe("Invalid input", () => {
    it("rejects an empty string", () => {
      const result = parseAndNormalizeVideoUrl("");
      expect(result.isValid).toBe(false);
      if (!result.isValid) expect(result.error).toBeTruthy();
    });

    it("rejects an unsupported domain", () => {
      const result = parseAndNormalizeVideoUrl("https://example.com/not-a-video");
      expect(result.isValid).toBe(false);
      if (!result.isValid) expect(result.error).toBeTruthy();
    });

    it("trims whitespace before validating", () => {
      const result = parseAndNormalizeVideoUrl("   https://vimeo.com/76979871   ");
      expect(result.isValid).toBe(true);
      if (result.isValid) expect(result.originalUrl).toBe("https://vimeo.com/76979871");
    });
  });
});

describe("Hostname anchoring (regression)", () => {
  it("rejects a malicious host with a vimeo.com substring in the query string", () => {
    const result = parseAndNormalizeVideoUrl(
      "https://malicious.example.com/?redirect=https://vimeo.com/123456"
    );
    expect(result.isValid).toBe(false);
  });

  it("rejects a malicious host with a vk.com substring in the path", () => {
    const result = parseAndNormalizeVideoUrl(
      "https://evil.example.com/vk.com/video-123456_456789"
    );
    expect(result.isValid).toBe(false);
  });

  it("rejects a malicious host with a rutube.ru substring in the query string", () => {
    const result = parseAndNormalizeVideoUrl(
      "https://malicious.example.com/?u=rutube.ru/video/8a4c1c4b3f6f5e2d1a0b9c8d7e6f5a4b"
    );
    expect(result.isValid).toBe(false);
  });

  it("rejects a malicious host with a kinescope.io substring in the query string", () => {
    const result = parseAndNormalizeVideoUrl(
      "https://malicious.example.com/?u=kinescope.io/abcDEF123456"
    );
    expect(result.isValid).toBe(false);
  });
});
