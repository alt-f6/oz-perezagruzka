// Renders nothing until a real handle is configured, same env-gate pattern
// as Footer.tsx's SOCIAL_LINKS. z-40 keeps it below the cookie banner's
// z-50 so the banner always wins visually when both are shown.
//
// bottom-64 (256px) on mobile clears ConsentBanner.tsx's real worst-case
// footprint: 12px outer pt-3 + up to ~34px safe-area-inset-bottom (notched
// phones) + 32px inner p-4 card padding + up to ~58-78px for the
// cookie-notice paragraph wrapping to 3-4 lines at text-xs leading-relaxed
// on narrow viewports + 16px flex-col gap-4 + ~44px button row ≈ 196-216px
// worst case, so 256px leaves comfortable margin. sm:bottom-6 is unchanged
// because the banner switches to a much shorter flex-row layout at sm: and
// above. ReadinessMapWizard.tsx's own bottom-nav clearance (pb-64) is kept
// in lockstep with this same 256px budget.
export default function FloatingWhatsApp() {
  const href = process.env.NEXT_PUBLIC_WHATSAPP_URL;
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в WhatsApp"
      className="fixed bottom-64 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--color-whatsapp)] text-white shadow-xl shadow-ink-900/20 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--color-whatsapp)] sm:bottom-6"
    >
      <WhatsAppIcon className="h-7 w-7" />
    </a>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3ZM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 14.8 3.6 13.4 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.4-8.4 8.4Z" />
    </svg>
  );
}
