import { ENTITY_FULL_NAME, INN, OGRN, LEGAL_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@/landing/lib/legal";
import { NAV_LINKS } from "@/landing/lib/navigation";

const LEGAL_LINKS = [
  { label: "Политика конфиденциальности", href: "/privacy" },
  { label: "Условия использования и оферта", href: "/terms" },
  { label: "Правила ПЭП", href: "/pep" },
];

// Handles come from env so a bare "https://t.me/" / "https://wa.me/" never
// ships as a dead link. The icon simply doesn't render until a real handle
// is configured.
const SOCIAL_LINKS = [
  { label: "Telegram", href: process.env.NEXT_PUBLIC_TELEGRAM_URL, icon: TelegramIcon },
  { label: "WhatsApp", href: process.env.NEXT_PUBLIC_WHATSAPP_URL, icon: WhatsAppIcon },
].filter((link): link is { label: string; href: string; icon: typeof TelegramIcon } => Boolean(link.href));

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr_auto] md:gap-6">
          <div>
            <p className="text-xl font-bold text-white">Перезагрузка</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
              Онлайн-школа для подростков: живой учитель в группах до 10 человек + ИИ-репетитор на связи
              24/7. Готовим к ОГЭ так, чтобы ребёнок садился заниматься сам.
            </p>
          </div>

          <nav aria-label="Навигация по разделам">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Разделы</p>
            <ul className="mt-4 space-y-2.5">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="rounded text-sm text-ink-100 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {SOCIAL_LINKS.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-ink-400">Мы на связи</p>
              <div className="mt-4 flex gap-3">
                {SOCIAL_LINKS.map(({ label, href, icon: Icon }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-ink-100 transition-all duration-100 ease-out hover:bg-brand-500 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 active:scale-95"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="mt-12 border-t border-white/10 pt-6 text-xs leading-relaxed text-ink-400">
          {ENTITY_FULL_NAME}, ИНН {INN}, ОГРН {OGRN}. Адрес: {LEGAL_ADDRESS}. Email: {CONTACT_EMAIL}. Телефон:{" "}
          <a
            href={`tel:+${CONTACT_PHONE.replace(/\D/g, "")}`}
            className="font-semibold text-ink-100 underline decoration-ink-500 underline-offset-2 hover:text-white"
          >
            {CONTACT_PHONE}
          </a>
          .
        </div>

        <div className="mt-4 flex flex-col gap-4 text-xs text-ink-400 sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} «Перезагрузка». Все права защищены.</p>
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            {LEGAL_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="rounded transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}

function TelegramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M21.5 3.5 2.6 10.9c-1 .4-1 1.8.1 2.1l4.4 1.4 1.7 5.3c.3.9 1.4 1.1 2 .4l2.5-2.8 4.5 3.3c.8.6 2 .2 2.2-.8l3.1-14.7c.2-1.1-.8-1.9-1.8-1.6ZM8.6 14.9l-.1 3.4-1.4-4.4 9.7-6.9-8.2 7.9Z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M17.5 14.4c-.3-.1-1.7-.8-2-1-.3-.1-.5-.1-.6.1-.2.3-.7 1-.9 1.2-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.6-2.1-.2-.3 0-.5.1-.6.1-.1.3-.3.4-.5.1-.1.2-.3.2-.4.1-.2 0-.3 0-.5-.1-.1-.6-1.5-.8-2-.2-.5-.4-.4-.6-.4h-.5c-.2 0-.5.1-.7.3-.3.3-1 1-1 2.4s1 2.8 1.2 3c.1.2 2 3 4.8 4.3.7.3 1.2.5 1.6.6.7.2 1.3.2 1.8.1.5-.1 1.7-.7 1.9-1.4.2-.7.2-1.2.2-1.4-.1-.1-.3-.2-.6-.3ZM12 2C6.5 2 2 6.5 2 12c0 1.8.5 3.5 1.3 5L2 22l5.2-1.4c1.4.8 3.1 1.2 4.8 1.2 5.5 0 10-4.5 10-10S17.5 2 12 2Zm0 18.2c-1.6 0-3.1-.4-4.4-1.2l-.3-.2-3.1.8.8-3-.2-.3C4 14.8 3.6 13.4 3.6 12c0-4.6 3.8-8.4 8.4-8.4s8.4 3.8 8.4 8.4-3.8 8.4-8.4 8.4Z" />
    </svg>
  );
}
