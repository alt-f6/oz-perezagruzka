// Shared XSS-safety wrapper for every <script type="application/ld+json">
// on the site -- escaping "<" prevents a "</script>" substring inside JSON
// string data from prematurely closing the script tag.
export function toSafeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
