import type { ExamType } from "@/landing/lib/exam-context";

const SITE_URL = "https://perezagruzka-edu.ru";
// Stable @id so the Course node below can reference this organization by
// pointer instead of duplicating its fields inline, per JSON-LD @graph
// convention.
const ORGANIZATION_ID = `${SITE_URL}/#organization`;

interface CourseGraphOrganization {
  "@type": "EducationalOrganization";
  "@id": string;
  name: string;
  url: string;
  telephone: string;
  address: {
    "@type": "PostalAddress";
    streetAddress: string;
    addressLocality: string;
    addressRegion: string;
    addressCountry: string;
  };
}

interface CourseGraphCourse {
  "@type": "Course";
  "@id": string;
  name: string;
  description: string;
  provider: { "@id": string };
  hasCourseInstance: {
    "@type": "CourseInstance";
    courseMode: "online";
    inLanguage: "ru";
  };
}

export interface CourseGraphJsonLd {
  "@context": "https://schema.org";
  "@graph": [CourseGraphOrganization, CourseGraphCourse];
}

const COURSE_CONTENT: Record<ExamType, { path: string; name: string; description: string }> = {
  oge: {
    path: "oge",
    name: "Онлайн-подготовка к ОГЭ в мини-группах",
    description: "Дистанционный курс подготовки к ОГЭ с живыми преподавателями и ИИ-репетитором 24/7.",
  },
  ege: {
    path: "ege",
    name: "Онлайн-подготовка к ЕГЭ в мини-группах",
    description: "Дистанционный курс подготовки к ЕГЭ с живыми преподавателями и ИИ-репетитором 24/7.",
  },
};

export function buildCourseGraphJsonLd(examType: ExamType): CourseGraphJsonLd {
  const course = COURSE_CONTENT[examType];

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "EducationalOrganization",
        "@id": ORGANIZATION_ID,
        name: "Перезагрузка",
        url: SITE_URL,
        telephone: "+7-952-702-50-50",
        // Matches the office address in organization-schema.ts -- keep the
        // two in sync since both can render on the same page.
        address: {
          "@type": "PostalAddress",
          streetAddress: "ул. Калинина, 26",
          addressLocality: "Ханты-Мансийск",
          addressRegion: "ХМАО–Югра",
          addressCountry: "RU",
        },
      },
      {
        "@type": "Course",
        "@id": `${SITE_URL}/${course.path}#course`,
        name: course.name,
        description: course.description,
        provider: { "@id": ORGANIZATION_ID },
        hasCourseInstance: {
          "@type": "CourseInstance",
          courseMode: "online",
          inLanguage: "ru",
        },
      },
    ],
  };
}
