export type OrgSchemaVariant = { kind: "address" } | { kind: "areaServed"; city: string };

interface PostalAddressSchema {
  "@type": "PostalAddress";
  streetAddress: string;
  addressLocality: string;
  addressRegion: string;
  addressCountry: string;
}

interface AreaServedSchema {
  "@type": "City";
  name: string;
}

export interface EducationalOrganizationJsonLd {
  "@context": "https://schema.org";
  "@type": "EducationalOrganization";
  name: string;
  alternateName: string;
  url: string;
  logo: string;
  telephone: string;
  sameAs: string[];
  aggregateRating: { "@type": "AggregateRating"; ratingValue: string; reviewCount: string };
  address?: PostalAddressSchema;
  areaServed?: AreaServedSchema;
}

const SITE_URL = "https://perezagruzka-edu.ru";

// The Khanty-Mansiysk office at ул. Калинина, 26 is a real, currently
// operating address distinct from the entity's registered legal/mailing
// address in src/landing/lib/legal.ts (used only for the footer's legal
// disclosure) -- the two intentionally differ and must not be conflated.
const OFFICE_ADDRESS: PostalAddressSchema = {
  "@type": "PostalAddress",
  streetAddress: "ул. Калинина, 26",
  addressLocality: "Ханты-Мансийск",
  addressRegion: "ХМАО–Югра",
  addressCountry: "RU",
};

export function buildEducationalOrganizationJsonLd(
  variant: OrgSchemaVariant,
): EducationalOrganizationJsonLd {
  const base = {
    "@context": "https://schema.org" as const,
    "@type": "EducationalOrganization" as const,
    name: "Перезагрузка",
    alternateName: "Онлайн-школа Перезагрузка",
    url: SITE_URL,
    // No public/logo.png exists in the repo; the real, existing brand mark
    // is /icon.svg -- do not point this at a path that 404s.
    logo: `${SITE_URL}/icon.svg`,
    telephone: "+7-952-702-50-50",
    sameAs: ["https://vk.ru/perezagruzkahm"],
    // reviewCount matches the real, linked Yandex Maps data shown in
    // YandexReviews.tsx ("70+ отзывов") -- never inflate this number.
    aggregateRating: {
      "@type": "AggregateRating" as const,
      ratingValue: "5.0",
      reviewCount: "70",
    },
  };

  if (variant.kind === "areaServed") {
    return { ...base, areaServed: { "@type": "City", name: variant.city } };
  }

  return { ...base, address: OFFICE_ADDRESS };
}
