import type { AttributionPayload } from "@/landing/lib/validations/readiness";

type TouchPayload = NonNullable<AttributionPayload["attr_first"]>;

// Human-readable one-liner for a touch, e.g.
// "vk / cpc, кампания «oge_spring»" or "переход с yandex.ru".
export function describeTouch(touch: TouchPayload | null | undefined): string {
  if (!touch) return "прямой заход";

  if (touch.utm_source) {
    let text = touch.utm_source;
    if (touch.utm_medium) text += ` / ${touch.utm_medium}`;
    if (touch.utm_campaign) text += `, кампания «${touch.utm_campaign}»`;
    if (touch.utm_content) text += `, объявление «${touch.utm_content}»`;
    return text;
  }

  if (touch.referrer) {
    try {
      return `переход с ${new URL(touch.referrer).hostname}`;
    } catch {
      return `переход с ${touch.referrer}`;
    }
  }

  return "прямой заход";
}

// Lines appended to Lead.notes (Lead has no JSON metadata column) so CRM
// managers see where the lead came from. Plain text: safe to reuse verbatim
// in a Telegram message as long as it's HTML-escaped there.
export function formatLeadSourceNotes(attribution: AttributionPayload | undefined): string[] {
  if (!attribution) return [];

  const { attr_first, attr_last, ym_client_id } = attribution;
  const lines: string[] = [];
  const lastTouch = attr_last ?? attr_first;

  if (lastTouch) lines.push(`Источник: ${describeTouch(lastTouch)}`);
  if (attr_first && attr_last) {
    const first = describeTouch(attr_first);
    if (first !== describeTouch(attr_last)) lines.push(`Первое касание: ${first}`);
  }
  if (ym_client_id) lines.push(`YM ClientID: ${ym_client_id}`);

  return lines;
}
