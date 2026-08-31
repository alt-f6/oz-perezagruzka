import { promises as fs } from "node:fs";
import path from "node:path";

import { isValidTopicCode, type TutorManifest } from "@/lms/lib/tutor";

/**
 * Filesystem loader for the local subject pack that backs the AI Tutor.
 *
 * Pack layout (packs/obshestvo-ege-block1/):
 *   core_v0.txt          — base tutor system prompt
 *   toc.md               — table of contents / block overview
 *   manifest.json        — topic list for the client selector
 *   topics/<code>.md     — per-topic study material
 *
 * Files are immutable at runtime, so each is read once and memoized. topicCode
 * is whitelist-validated (TOPIC_CODE_PATTERN) before it is ever interpolated
 * into a path, preventing traversal.
 */
const PACK_DIR = path.join(process.cwd(), "packs", "obshestvo-ege-block1");

let coreCache: string | undefined;
let tocCache: string | undefined;
let manifestCache: TutorManifest | undefined;
const topicCache = new Map<string, string>();

export async function loadCore(): Promise<string> {
  coreCache ??= await fs.readFile(path.join(PACK_DIR, "core_v0.txt"), "utf8");
  return coreCache;
}

export async function loadToc(): Promise<string> {
  tocCache ??= await fs.readFile(path.join(PACK_DIR, "toc.md"), "utf8");
  return tocCache;
}

export async function loadManifest(): Promise<TutorManifest> {
  manifestCache ??= JSON.parse(
    await fs.readFile(path.join(PACK_DIR, "manifest.json"), "utf8"),
  ) as TutorManifest;
  return manifestCache;
}

/**
 * Reads the study material for a single topic. Throws on an invalid /
 * non-whitelisted code so callers can map it to an HTTP 400.
 */
export async function loadTopic(topicCode: string): Promise<string> {
  if (!isValidTopicCode(topicCode)) {
    throw new Error(`invalid topic code: ${topicCode}`);
  }
  const cached = topicCache.get(topicCode);
  if (cached !== undefined) return cached;

  const content = await fs.readFile(
    path.join(PACK_DIR, "topics", `${topicCode}.md`),
    "utf8",
  );
  topicCache.set(topicCode, content);
  return content;
}
