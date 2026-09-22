import { describe, expect, it } from "vitest";
import { buildEducationalOrganizationJsonLd } from "./organization-schema";

describe("buildEducationalOrganizationJsonLd", () => {
  it("includes a verified PostalAddress for the address variant", () => {
    const schema = buildEducationalOrganizationJsonLd({ kind: "address" });

    expect(schema["@type"]).toBe("EducationalOrganization");
    expect(schema.name).toBe("Перезагрузка");
    expect(schema.logo).toBe("https://perezagruzka-edu.ru/icon.svg");
    expect(schema.telephone).toBe("+7-952-702-50-50");
    expect(schema.sameAs).toEqual(["https://vk.ru/perezagruzkahm"]);
    expect(schema.aggregateRating).toEqual({
      "@type": "AggregateRating",
      ratingValue: "5.0",
      reviewCount: "70",
    });
    expect(schema.address).toEqual({
      "@type": "PostalAddress",
      streetAddress: "ул. Калинина, 26",
      addressLocality: "Ханты-Мансийск",
      addressRegion: "ХМАО–Югра",
      addressCountry: "RU",
    });
    expect(schema.areaServed).toBeUndefined();
  });

  it("outputs areaServed instead of a street address for the areaServed variant", () => {
    const schema = buildEducationalOrganizationJsonLd({ kind: "areaServed", city: "Сургут" });

    expect(schema.areaServed).toEqual({ "@type": "City", name: "Сургут" });
    expect(schema.address).toBeUndefined();
  });
});
