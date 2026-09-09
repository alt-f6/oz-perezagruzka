// Zero-dependency constant (no `db` import) so it's safe to pull into a
// "use client" component (OfferLinkButton) as well as server-only code
// (offer.service.ts) without bundling server-only modules into the client.
export const OFFER_URL = "https://perezagruzka-edu.ru/terms";
