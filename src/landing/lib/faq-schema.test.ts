import { describe, expect, it } from "vitest";
import { buildFaqJsonLd } from "./faq-schema";
import { FAQ_ITEMS } from "@/landing/data/faq";

describe("buildFaqJsonLd", () => {
  it("maps every FAQ item to a schema.org Question/Answer pair", () => {
    const schema = buildFaqJsonLd();

    expect(schema["@type"]).toBe("FAQPage");
    expect(schema.mainEntity).toHaveLength(FAQ_ITEMS.length);
    expect(schema.mainEntity[0]).toEqual({
      "@type": "Question",
      name: FAQ_ITEMS[0].question,
      acceptedAnswer: {
        "@type": "Answer",
        text: Array.isArray(FAQ_ITEMS[0].answer) ? FAQ_ITEMS[0].answer.join(" ") : FAQ_ITEMS[0].answer,
      },
    });
  });
});
