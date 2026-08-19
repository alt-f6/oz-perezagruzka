import "@testing-library/jest-dom/vitest";

// Vitest's `test.globals` is intentionally left off, so
// @testing-library/react's automatic afterEach(cleanup) never registers.
// Wire it up explicitly here instead -- the cleanup call itself is scoped to
// the jsdom (*.test.tsx) suite via the `typeof document` guard below, so the
// node *.test.ts suite is unaffected (the jest-dom matcher import above is
// harmless there too -- it just registers unused matchers).
if (typeof document !== "undefined") {
  const { afterEach } = await import("vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(cleanup);

  // jsdom doesn't implement scrollTo; components that scroll-into-view on
  // mount (e.g. ResultSuccess) would otherwise log a noisy but harmless
  // "Not implemented" error to stderr on every render.
  window.scrollTo = () => {};
}
