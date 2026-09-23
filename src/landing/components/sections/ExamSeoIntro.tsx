import Section from "@/landing/components/ui/Section";

interface ExamSeoIntroProps {
  title: string;
  description: string;
}

// Dedicated single-exam routes (/oge, /ege) need extra on-page search-intent
// phrasing beyond the branded Hero <h1> (e.g. "ОГЭ С ГАРАНТИЕЙ:"), which is
// shared with the toggle-driven home page and shouldn't be rewritten for
// SEO. This slot is passed into ExamLandingContent's beforeSections, the
// same pattern regional pages use for RegionalBenchmarks.
export default function ExamSeoIntro({ title, description }: ExamSeoIntroProps) {
  return (
    <Section>
      <div className="mx-auto max-w-3xl px-6 text-center">
        <h2 className="font-bold tracking-tight text-ink-900 text-balance">{title}</h2>
        <p className="mt-4 leading-relaxed text-ink-600">{description}</p>
      </div>
    </Section>
  );
}
