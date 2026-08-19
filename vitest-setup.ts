import "@testing-library/jest-dom/vitest";

// Vitest's `test.globals` is intentionally left off, so
// @testing-library/react's automatic afterEach(cleanup) never registers.
// Wire it up explicitly here instead -- this file only affects the jsdom
// (*.test.tsx) suite, so the node *.test.ts suite is unaffected either way.
if (typeof document !== "undefined") {
  const { afterEach } = await import("vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);
}
