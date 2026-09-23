import { describe, expect, it } from "vitest";
import { buildCourseGraphJsonLd } from "./course-schema";

describe("buildCourseGraphJsonLd", () => {
  it("binds the Course provider to the organization node by @id", () => {
    const schema = buildCourseGraphJsonLd("oge");
    const [organization, course] = schema["@graph"];

    expect(organization["@type"]).toBe("EducationalOrganization");
    expect(organization["@id"]).toBe("https://perezagruzka-edu.ru/#organization");
    expect(course["@type"]).toBe("Course");
    expect(course.provider).toEqual({ "@id": organization["@id"] });
  });

  it("scopes the Course @id and mode to the OGE course", () => {
    const schema = buildCourseGraphJsonLd("oge");
    const [, course] = schema["@graph"];

    expect(course["@id"]).toBe("https://perezagruzka-edu.ru/oge#course");
    expect(course.name).toContain("ОГЭ");
    expect(course.hasCourseInstance).toEqual({
      "@type": "CourseInstance",
      courseMode: "online",
      inLanguage: "ru",
    });
  });

  it("scopes the Course @id and name to the EGE course", () => {
    const schema = buildCourseGraphJsonLd("ege");
    const [, course] = schema["@graph"];

    expect(course["@id"]).toBe("https://perezagruzka-edu.ru/ege#course");
    expect(course.name).toContain("ЕГЭ");
  });
});
