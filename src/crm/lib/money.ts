// src/crm/lib/money.ts

/**
 * Integer kopecks (1/100 ruble). Branded so a raw `number` can't be
 * passed where Kopecks is expected without an explicit conversion —
 * this is what closes the float-rounding gap that existed when
 * amounts were handled as fractional-ruble JS numbers all the way to
 * the YooKassa API payload.
 */
export type Kopecks = number & { __brand: "Kopecks" };

export function rublesToKopecks(rubles: number): Kopecks {
  return Math.round(rubles * 100) as Kopecks;
}

export function kopecksToRubles(kopecks: Kopecks): string {
  return (kopecks / 100).toFixed(2);
}
