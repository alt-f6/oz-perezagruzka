import { describe, expect, it } from "vitest";
import { TOPIC_CODE_PATTERN } from "@/lms/lib/tutor";
import { loadCore, loadManifest, loadTopic } from "./tutor-pack";

describe("tutor-pack loader", () => {
  it("loads a manifest whose 15 topic codes are all whitelisted", async () => {
    const manifest = await loadManifest();
    expect(manifest.topics).toHaveLength(15);
    for (const topic of manifest.topics) {
      expect(TOPIC_CODE_PATTERN.test(topic.code), topic.code).toBe(true);
      expect(topic.title.length).toBeGreaterThan(0);
    }
    // Covers the full range 1.1 … 1.15.
    const codes = manifest.topics.map((t) => t.code);
    expect(codes).toContain("1.1");
    expect(codes).toContain("1.10");
    expect(codes).toContain("1.15");
  });

  it("reads the core prompt and every whitelisted topic file", async () => {
    expect((await loadCore()).length).toBeGreaterThan(0);
    for (let i = 1; i <= 15; i++) {
      const content = await loadTopic(`1.${i}`);
      expect(content.length, `1.${i}`).toBeGreaterThan(0);
    }
  });

  it("refuses a non-whitelisted / traversal topic code before touching the fs", async () => {
    await expect(loadTopic("1.16")).rejects.toThrow();
    await expect(loadTopic("../../etc/passwd")).rejects.toThrow();
    await expect(loadTopic("1.5/../1.6")).rejects.toThrow();
  });
});
