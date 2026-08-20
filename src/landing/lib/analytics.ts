// Thin wrapper around the Yandex.Metrika global so call sites never need to
// null-check window.ym or the env var themselves. A no-op until
// NEXT_PUBLIC_YM_COUNTER_ID is configured and the Metrika snippet has loaded.
type YmFunction = (counterId: number, method: "reachGoal", target: string) => void;

export function reachGoal(target: string): void {
  const counterId = process.env.NEXT_PUBLIC_YM_COUNTER_ID;
  if (!counterId) return;

  const ym = (window as unknown as { ym?: YmFunction }).ym;
  if (typeof ym !== "function") return;

  ym(Number(counterId), "reachGoal", target);
}
