// Fixed bottom-right 1-click contact widget: a phone call button (always
// shown — the number is a fixed business line, not env-gated) stacked above
// a MAX messenger button (env-gated like the old WhatsApp/Telegram buttons
// it replaces). z-40 keeps both below the cookie banner's z-50.
//
// bottom-64 (256px) on mobile clears ConsentBanner.tsx's real worst-case
// footprint — see that file's own sizing comment for the full budget. Buttons
// are 80px (h-20 w-20); the second stacks +96px above the first (80px
// button + 16px gap): bottom-[22rem] (352px) / sm:bottom-[7.5rem] (120px)
// once the banner switches to its shorter flex-row layout at sm: and above.
const PHONE_NUMBER = "+79527025050";
const MAX_URL = process.env.NEXT_PUBLIC_MAX_URL || "https://max.ru";

export default function FloatingContacts() {
  return (
    <>
      <a
        href={`tel:${PHONE_NUMBER}`}
        aria-label="Позвонить"
        title="Позвонить"
        className="group fixed bottom-64 right-4 z-40 flex h-20 w-20 items-center justify-center rounded-full bg-[#0055FF] text-white shadow-xl shadow-ink-900/20 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#0055FF] sm:bottom-6"
      >
        <span className="pointer-events-none absolute inset-0 rounded-full bg-[#0055FF]/50 opacity-0 group-hover:animate-ping group-hover:opacity-100" />
        <PhoneIcon className="relative h-9 w-9" />
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
          Позвонить
        </span>
      </a>

      <a
        href={MAX_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Написать в MAX"
        title="Чат в MAX"
        className="group fixed bottom-[22rem] right-4 z-40 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-[#5B42F3] to-[#0055FF] text-white shadow-xl shadow-ink-900/20 transition-transform duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#5B42F3] sm:bottom-[7.5rem]"
      >
        <span className="flex flex-col items-center leading-none">
          <MaxIcon className="h-6 w-6" />
          <span className="mt-0.5 text-[10px] font-black tracking-wide">MAX</span>
        </span>
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-ink-900 px-3 py-1.5 text-xs font-semibold text-white opacity-0 shadow-md transition-opacity duration-150 group-hover:opacity-100">
          Чат в MAX
        </span>
      </a>
    </>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M6.6 10.8c1.4 2.8 3.8 5.1 6.6 6.6l2.2-2.2c.3-.3.7-.4 1-.2 1.1.4 2.3.6 3.6.6.6 0 1 .4 1 1V20c0 .6-.4 1-1 1C10.4 21 3 13.6 3 4.6c0-.6.4-1 1-1h3.4c.6 0 1 .4 1 1 0 1.3.2 2.5.6 3.6.1.4 0 .8-.2 1L6.6 10.8Z" />
    </svg>
  );
}

function MaxIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2C6.5 2 2 6.1 2 11.2c0 2.7 1.3 5.1 3.3 6.8-.1 1-.4 2.4-1 3.5-.1.3.2.6.5.5 1.4-.5 2.9-1.2 3.8-1.7 1.1.3 2.2.5 3.4.5 5.5 0 10-4.1 10-9.2C22 6.1 17.5 2 12 2Z" />
    </svg>
  );
}
