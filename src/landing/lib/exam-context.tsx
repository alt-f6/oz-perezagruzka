"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type ExamType = "oge" | "ege";

interface ExamContextValue {
  exam: ExamType;
  setExam: (exam: ExamType) => void;
}

const ExamContext = createContext<ExamContextValue | null>(null);

export function useExam(): ExamContextValue {
  const ctx = useContext(ExamContext);
  if (!ctx) throw new Error("useExam must be used within an ExamProvider");
  return ctx;
}

export function ExamProvider({ children }: { children: ReactNode }) {
  const [exam, setExam] = useState<ExamType>("oge");

  // Step 0 of the OGE/EGE toggle spec: a direct link with ?exam=ege should
  // land on the EGE variant. Read once on mount via window.location instead
  // of useSearchParams() so this provider stays a plain client component
  // (no Suspense boundary / route de-opt to worry about).
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("exam") === "ege") {
      setExam("ege");
    }
  }, []);

  return <ExamContext.Provider value={{ exam, setExam }}>{children}</ExamContext.Provider>;
}
