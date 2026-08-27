import type { Metadata } from "next";
import Link from "next/link";
import {
  ENTITY_NAME,
  ENTITY_FULL_NAME,
  INN,
  KPP,
  OGRN,
  LICENSE_NUMBER,
  LICENSE_ISSUER,
  LEGAL_ADDRESS,
  CONTACT_EMAIL,
  CONTACT_PHONE,
  RKN_REGISTRATION,
  IP_NAME,
  IP_INN,
  IP_RKN_REGISTRATION,
} from "@/landing/lib/legal";

export const metadata: Metadata = {
  title: "Документы",
  description: `Учредительные, лицензионные документы и документы об оказании платных образовательных услуг ${ENTITY_NAME}.`,
};

interface DocumentItem {
  title: string;
  order: string;
  note?: string;
  viewHref: string;
  viewExternal?: boolean;
  downloadHref?: string;
}

const PAID_SERVICES_DOCS: DocumentItem[] = [
  {
    title: "Положение о порядке оказания платных образовательных услуг",
    order: "Приказ от 20.08.2026 № 12-ОД",
    viewHref: "/docs/paid-services-regulation.pdf",
    viewExternal: true,
    downloadHref: "/docs/paid-services-regulation.pdf",
  },
  {
    title: "Образец договора об оказании платных образовательных услуг",
    order: "Приказ от 20.08.2026 № 14-ОД",
    note: "С приложениями № 1–3",
    viewHref: "/docs/contract-sample.pdf",
    viewExternal: true,
    downloadHref: "/docs/contract-sample.pdf",
  },
  {
    title: "Приказ об утверждении стоимости обучения и прейскурант на 2026/2027 учебный год",
    order: "Приказ от 20.08.2026 № 13-ОД",
    viewHref: "/docs/pricing-order-2026-2027.pdf",
    viewExternal: true,
    downloadHref: "/docs/pricing-order-2026-2027.pdf",
  },
  {
    title: "Публичная оферта на оказание платных образовательных услуг",
    order: "Утв. Приказом от 20.08.2026 № 14-ОД",
    note: "С приложениями № 1–4",
    viewHref: "/terms",
    downloadHref: "/docs/public-offer.pdf",
  },
];

const ORG_DOCS: DocumentItem[] = [
  {
    title: "Политика в отношении обработки персональных данных",
    order: "Приказ от 20.08.2026 № 16-ОД",
    viewHref: "/privacy",
    downloadHref: "/docs/privacy-policy.pdf",
  },
  {
    title: "Формы согласий на обработку персональных данных и отзыва согласия",
    order: "Формы № 1, 2, 3, утв. Приказом от 20.08.2026 № 16-ОД",
    viewHref: "/docs/consent-forms.pdf",
    viewExternal: true,
    downloadHref: "/docs/consent-forms.pdf",
  },
  {
    title: "Правила использования простой электронной подписи (ПЭП)",
    order: "Приказ от 20.08.2026 № 14-ОД",
    viewHref: "/pep",
    downloadHref: "/docs/pep-rules.pdf",
  },
];

function DocumentCard({ doc }: { doc: DocumentItem }) {
  return (
    <li className="rounded-2xl border border-ink-100 bg-white p-6 shadow-sm shadow-ink-900/5 sm:p-7">
      <h3 className="text-base font-bold tracking-tight text-ink-900 sm:text-lg">{doc.title}</h3>
      <p className="mt-1.5 text-sm text-ink-500">{doc.order}</p>
      {doc.note && <p className="mt-0.5 text-sm text-ink-500">{doc.note}</p>}
      <div className="mt-4 flex flex-wrap gap-3">
        <Link
          href={doc.viewHref}
          target={doc.viewExternal ? "_blank" : undefined}
          rel={doc.viewExternal ? "noopener noreferrer" : undefined}
          className="inline-flex items-center gap-2 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          Смотреть онлайн
        </Link>
        {doc.downloadHref && (
          <a
            href={doc.downloadHref}
            download
            className="inline-flex items-center gap-2 rounded-xl border border-ink-200 bg-white px-4 py-2.5 text-sm font-semibold text-ink-700 transition hover:border-brand-300 hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
          >
            Скачать PDF
          </a>
        )}
      </div>
    </li>
  );
}

export default function DocsPage() {
  return (
    <main className="min-h-screen bg-white text-ink-900">
      <div className="mx-auto max-w-3xl px-6 py-24">
        <Link
          href="/"
          className="text-sm font-semibold text-brand-600 transition hover:text-brand-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 rounded"
        >
          ← На главную
        </Link>

        <h1 className="mt-6 text-3xl font-black tracking-tight text-ink-900 sm:text-4xl">Документы</h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-500 sm:text-base">
          Учредительные и лицензионные документы, документы об оказании платных образовательных
          услуг и документы по защите персональных данных {ENTITY_NAME}.
        </p>

        <section id="paid-services" className="mt-14 scroll-mt-24">
          <h2 className="text-xl font-bold tracking-tight text-brand-700 sm:text-2xl">
            Платные образовательные услуги
          </h2>
          <ul className="mt-6 space-y-4">
            {PAID_SERVICES_DOCS.map((doc) => (
              <DocumentCard key={doc.title} doc={doc} />
            ))}
          </ul>
        </section>

        <section id="offer" className="mt-16 scroll-mt-24">
          <h2 className="text-xl font-bold tracking-tight text-brand-700 sm:text-2xl">
            Документы организации и безопасность данных
          </h2>
          <ul className="mt-6 space-y-4">
            {ORG_DOCS.map((doc) => (
              <DocumentCard key={doc.title} doc={doc} />
            ))}
          </ul>

          <div className="mt-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm shadow-ink-900/5 sm:p-7">
            <h3 className="text-base font-bold tracking-tight text-ink-900 sm:text-lg">
              Лицензия на осуществление образовательной деятельности
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-600 sm:text-base">
              {LICENSE_NUMBER}, бессрочная. Выдана: {LICENSE_ISSUER}.
            </p>
          </div>

          <div className="mt-4 rounded-2xl border border-ink-100 bg-white p-6 shadow-sm shadow-ink-900/5 sm:p-7">
            <h3 className="text-base font-bold tracking-tight text-ink-900 sm:text-lg">
              Реестр операторов персональных данных Роскомнадзора
            </h3>
            <div className="mt-3 space-y-4 text-sm leading-relaxed text-ink-600 sm:text-base">
              <p>
                <strong className="text-ink-900">{ENTITY_FULL_NAME}</strong> — регистрационный номер{" "}
                {RKN_REGISTRATION}. ИНН {INN}, КПП {KPP}, ОГРН {OGRN}.
              </p>
              <p>
                <strong className="text-ink-900">{IP_NAME}</strong> — регистрационный номер{" "}
                {IP_RKN_REGISTRATION}. ИНН {IP_INN}.
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-ink-100 bg-ink-50/40 p-6 text-sm leading-relaxed text-ink-600 sm:p-7 sm:text-base">
            <p>
              {LEGAL_ADDRESS} · {CONTACT_EMAIL} ·{" "}
              <a
                href={`tel:+${CONTACT_PHONE.replace(/\D/g, "")}`}
                className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
              >
                {CONTACT_PHONE}
              </a>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
