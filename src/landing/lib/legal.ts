// Single source of truth for the organization's legal requisites and the
// current legal-document version, so /pep, /terms, /privacy, and the footer
// disclaimer can never drift out of sync with each other.
export const ENTITY_NAME = "ЧУДО «Перезагрузка ХМ»";
export const ENTITY_FULL_NAME =
  "Частное учреждение дополнительного образования «Перезагрузка ХМ»";

export const INN = "8601058874";
export const KPP = "860101001";
export const OGRN = "1168600051443";

export const LICENSE_NUMBER = "№ 3256 от 4 марта 2019 г.";
export const LICENSE_ISSUER =
  "Служба по контролю и надзору в сфере образования по ХМАО–Югре";

export const LEGAL_ADDRESS = "г. Ханты-Мансийск, ХМАО–Югра, ул. Сирина, д. 78, кв. 174";
export const CONTACT_EMAIL = "perezagruzkahm@mail.ru";
export const CONTACT_PHONE = "+7 (952) 702-50-50";

export const DIRECTOR_NAME = "Пошивайлова Лилия Владимировна";
export const DIRECTOR_NAME_SHORT = "Пошивайлова Л.В.";

export const RKN_REGISTRATION = "72-22-011629 (внесён 20.10.2022, Приказ № 226)";

// Second, independent operator that co-processes personal data alongside
// the ЧУДО (see /privacy §1) — kept here so it's centralized too.
export const IP_NAME = "ИП Пошивайлова Лилия Владимировна";
export const IP_INN = "450142974379";
export const IP_RKN_REGISTRATION = "72-25-045179 (внесён 16.06.2025, Приказ № 122)";

// Bank requisites, used only in the offer's "Реквизиты Исполнителя" section,
// centralized here for the same reason as everything else above.
export const BANK_NAME = "Западно-Сибирское отделение № 8647 ПАО Сбербанк";
export const BANK_BIK = "047102651";
export const BANK_ACCOUNT = "40703 810 2 6746 0000846";
export const BANK_CORR_ACCOUNT = "30101 810 8 0000 0000651";

// Bumped whenever the wording of /pep, /terms, or /privacy materially
// changes — recorded on every ConsentLog row so a signed document's version
// at the time of signing can always be reconstructed.
export const LEGAL_DOCUMENT_VERSION = "2026-08-08";

// Human-readable Russian rendering of LEGAL_DOCUMENT_VERSION, so /privacy,
// /terms, and /pep display one date that can never drift from the version
// actually recorded on ConsentLog rows.
export const LEGAL_DOCUMENT_VERSION_DISPLAY = new Intl.DateTimeFormat("ru-RU", {
  day: "numeric",
  month: "long",
  year: "numeric",
}).format(new Date(`${LEGAL_DOCUMENT_VERSION}T00:00:00Z`));
