import type { ReactNode } from "react";
import Header from "@/landing/components/sections/Header";
import ExamToggle from "@/landing/components/ui/ExamToggle";
import Hero from "@/landing/components/sections/Hero";
import BudgetVsPaidEGE from "@/landing/components/sections/BudgetVsPaidEGE";
import Solution from "@/landing/components/sections/Solution";
import WhyOgeMatters from "@/landing/components/sections/WhyOgeMatters";
import TeachersCarousel from "@/landing/components/sections/TeachersCarousel";
import StudentCarousel from "@/landing/components/sections/StudentCarousel";
import YandexReviews from "@/landing/components/sections/YandexReviews";
import Pricing from "@/landing/components/sections/Pricing";
import FAQ from "@/landing/components/sections/FAQ";
import FinalCTA from "@/landing/components/sections/FinalCTA";
import Footer from "@/landing/components/sections/Footer";
import ReadinessMapSection from "@/landing/components/sections/ReadinessMap/ReadinessMapSection";

interface ExamLandingContentProps {
  // Dedicated single-exam routes (/oge, /ege) hide the toggle -- there's
  // nothing to toggle between on a page that's supposed to be about one
  // exam only. Regional pages keep it since they cover both exams.
  showExamToggle?: boolean;
  // Regional pages pass a RegionalHero here instead of the generic
  // exam-toggle-driven Hero, so every route still has exactly one <h1>.
  hero?: ReactNode;
  // Rendered immediately after the hero -- regional pages use this slot for
  // RegionalBenchmarks (Task 7).
  beforeSections?: ReactNode;
}

export default function ExamLandingContent({
  showExamToggle = true,
  hero = <Hero />,
  beforeSections = null,
}: ExamLandingContentProps) {
  return (
    <>
      <Header />
      {showExamToggle && <ExamToggle />}
      <main
        id="top"
        className="relative min-h-screen overflow-hidden bg-[#F4F9FD] text-foreground selection:bg-brand-200"
      >
        <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden" aria-hidden="true">
          <div className="absolute -top-24 left-1/2 h-[600px] w-[900px] -translate-x-1/2 rounded-full bg-gradient-to-br from-[#BEE0F5]/70 via-[#0055FF]/10 to-transparent blur-[120px]" />
          <div className="absolute top-[30%] -left-32 h-[550px] w-[550px] rounded-full bg-[#FF6EB4]/10 blur-[140px]" />
          <div className="absolute top-[48%] -right-32 h-[600px] w-[600px] rounded-full bg-[#AAEE00]/15 blur-[150px]" />
          <div className="absolute top-[70%] left-1/4 h-[650px] w-[700px] rounded-full bg-[#0055FF]/10 blur-[160px]" />
          <div className="absolute bottom-20 right-1/4 h-[500px] w-[500px] rounded-full bg-[#BEE0F5]/80 blur-[130px]" />
          <div
            className="absolute inset-0 opacity-55"
            style={{
              backgroundImage: `
                linear-gradient(to right, rgba(0, 85, 255, 0.07) 1px, transparent 1px),
                linear-gradient(to bottom, rgba(0, 85, 255, 0.07) 1px, transparent 1px)
              `,
              backgroundSize: "32px 32px",
            }}
          />
        </div>

        <div className="relative z-10">
          {hero}
          {beforeSections}
          <BudgetVsPaidEGE />
          <Solution />
          <TeachersCarousel />
          <WhyOgeMatters />
          <StudentCarousel />
          <YandexReviews />
          <Pricing />
          <FAQ />
          <FinalCTA />
          <ReadinessMapSection />
        </div>

        <Footer />
      </main>
    </>
  );
}
