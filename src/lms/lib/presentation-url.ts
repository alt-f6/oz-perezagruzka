// Matches a Google Slides share link in edit/pub/view form and captures the
// presentation ID, e.g. https://docs.google.com/presentation/d/<id>/edit#slide=1
const GOOGLE_SLIDES_PATTERN =
  /^https?:\/\/docs\.google\.com\/presentation\/d\/([^/]+)\/(?:edit|pub|view)(?:[/?#].*)?$/i;

/**
 * Converts a pasted Google Slides share link (edit/pub/view) to its
 * iframe-embeddable form. Any other URL (already-canonical /embed links,
 * Miro boards, etc.) passes through unchanged.
 */
export function normalizePresentationUrl(rawUrl: string): string {
  const trimmed = (rawUrl ?? "").trim();
  if (!trimmed) return trimmed;

  const match = trimmed.match(GOOGLE_SLIDES_PATTERN);
  if (match) {
    return `https://docs.google.com/presentation/d/${match[1]}/embed`;
  }

  return trimmed;
}
