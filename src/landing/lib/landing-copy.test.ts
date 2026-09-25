import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { HERO_GUARANTEE_BULLETS, HERO_SUBLIST_HEADER, TRIAL_LESSON_CTA } from "./exam-content";

const ROOTS = ["src/landing", "app/landing"];
const LEGAL_PAGES = /app[\/]landing[\/](terms|privacy|pep|docs)[\/]/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name) ? [path] : [];
  });
}

const files = ROOTS.flatMap(sourceFiles).filter((path) => !LEGAL_PAGES.test(path));

describe("landing copy (25.09 mentor review)", () => {
  it("uses the trial-lesson CTA wording", () => {
    expect(TRIAL_LESSON_CTA).toBe("Записаться на пробный урок");
    expect(HERO_GUARANTEE_BULLETS).toContain("Берём только после пробного урока.");
    expect(HERO_SUBLIST_HEADER).toMatch(/^На пробном уроке вы получаете/);
  });

  it.each([
    ["the retired free-analysis CTA", /бесплатн\S* разбор/i],
    ["the «Дело не в X» antithesis", /Дело не в /],
    ["the «Это не X» antithesis", /Это не [^.]{1,60}(, а |\. Это )/],
  ])("has no %s left in landing source", (_label, pattern) => {
    const offenders = files.filter((path) => pattern.test(readFileSync(path, "utf8")));
    expect(offenders.map((path) => relative(process.cwd(), path))).toEqual([]);
  });
});
