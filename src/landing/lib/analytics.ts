// Thin wrapper around the Yandex.Metrika global so call sites never need to
// null-check window.ym or the env var themselves. A no-op until
// NEXT_PUBLIC_YM_COUNTER_ID is configured and the Metrika snippet has loaded.
type YmFunction = {
  (counterId: number, method: "reachGoal", target: string): void;
  (counterId: number, method: "hit", url: string): void;
};

function getYm(): YmFunction | undefined {
  const counterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  if (!counterId) return undefined;

  const ym = (window as unknown as { ym?: YmFunction }).ym;
  if (typeof ym !== "function") return undefined;

  return ym;
}

export function reachGoal(target: string): void {
  const counterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  if (!counterId) return;

  const ym = getYm();
  if (!ym) return;

  ym(Number(counterId), "reachGoal", target);
}

// Fires a manual pageview "hit" for a client-side (SPA) route change. Not
// used for the initial page load -- the injected Metrika snippet's own
// `ym(id, "init", ...)` call already sends that first hit automatically, so
// firing here too on mount would double-count it (see
// MetrikaPageviewTracker, which skips its first render for this reason).
export function trackPageview(url: string): void {
  const counterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  if (!counterId) return;

  const ym = getYm();
  if (!ym) return;

  ym(Number(counterId), "hit", url);
}
