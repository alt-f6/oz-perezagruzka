import { Prisma } from "@prisma/client";

export interface PricedSession {
  isFree: boolean;
  pricePerLesson: Prisma.Decimal | number | null;
  group?: { pricePerLesson: Prisma.Decimal | number } | null;
}

/**
 * Single source of truth for what a session actually bills: an explicitly
 * free session always resolves to 0, regardless of any price on record.
 * Otherwise GROUP sessions bill the group's price; INDIVIDUAL sessions bill
 * their own (0 when unset). Shared by BillingService (the real charge) and
 * the student ledger's pending-charge preview, so the two can never disagree.
 */
export function resolveSessionPrice(session: PricedSession): Prisma.Decimal | number {
  if (session.isFree) return 0;
  return session.group?.pricePerLesson ?? session.pricePerLesson ?? new Prisma.Decimal(0);
}
