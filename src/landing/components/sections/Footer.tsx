import { ENTITY_FULL_NAME, INN, OGRN, LEGAL_ADDRESS, CONTACT_EMAIL, CONTACT_PHONE } from "@/landing/lib/legal";
import { NAV_LINKS } from "@/landing/lib/navigation";

const LEGAL_LINKS = [
  { label: "Политика конфиденциальности", href: "/privacy" },
  { label: "Условия использования и оферта", href: "/terms" },
  { label: "Правила ПЭП", href: "/pep" },
];

// Telegram/WhatsApp are external links, so they're surfaced via the fixed
// floating buttons (FloatingTelegram.tsx / FloatingWhatsApp.tsx) instead of
// the footer, which only links to perezagruzka-edu.ru itself.

export default function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-ink-900 text-ink-100">
      <div className="mx-auto max-w-6xl px-6 py-16">
        <div className="grid grid-cols-1 gap-8 md:grid-cols-[1.2fr_1fr] md:gap-6">
          <div>
            <p className="text-xl font-bold text-white">Перезагрузка</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink-400">
              Онлайн-школа для подростков: живой учитель в мини-группах + ИИ-репетитор на связи
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
