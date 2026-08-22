// Same env-gated pattern as FloatingWhatsApp.tsx — renders nothing until
// NEXT_PUBLIC_TELEGRAM_URL is configured. Stacked directly above the
// WhatsApp button (which sits at bottom-56/bottom-6): +56px button height
// + 16px gap = +72px, so bottom-[18.5rem] (296px) / sm:bottom-24 (96px).
export default function FloatingTelegram() {
  const href = process.env.NEXT_PUBLIC_TELEGRAM_URL;
  if (!href) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Написать в Telegram"
      className="fixed bottom-[18.5rem] right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#26A5E4] text-white shadow-xl shadow-ink-900/20 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#26A5E4] sm:bottom-24"
    >
      <TelegramIcon className="h-7 w-7" />
    </a>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.5 3.5 2.6 10.9c-1 .4-1 1.8.1 2.1l4.4 1.4 1.7 5.3c.3.9 1.4 1.1 2 .4l2.5-2.8 4.5 3.3c.8.6 2 .2 2.2-.8l3.1-14.7c.2-1.1-.8-1.9-1.8-1.6ZM8.6 14.9l-.1 3.4-1.4-4.4 9.7-6.9-8.2 7.9Z" />
    </svg>
  );
}
