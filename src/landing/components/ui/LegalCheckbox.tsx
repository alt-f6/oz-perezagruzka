"use client";

import Link from "next/link";
import { motion } from "framer-motion";

interface LegalCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  error?: boolean;
  id?: string;
}

// Reusable consent primitive for Russian Federal Law 152-FZ (personal data
// processing). Every lead-capture form must render this and block submission
// client-side (and server-side via zod `z.literal(true)`) until it is
// checked; see readinessActionInputSchema in lib/validations/readiness.ts.
export function LegalCheckbox({ checked, onChange, error, id = "consent" }: LegalCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className="mt-1 flex cursor-pointer items-start gap-2.5 text-left select-none"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        required
        aria-invalid={error}
        className="peer sr-only"
      />
      <span
        aria-hidden
        className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-all duration-150 peer-focus-visible:ring-2 peer-focus-visible:ring-brand-400 peer-focus-visible:ring-offset-2 ${
          checked
            ? "border-brand-500 bg-brand-500"
            : error
              ? "border-rose-400 bg-rose-50"
              : "border-ink-200 bg-white hover:border-brand-300"
        }`}
      >
        {checked && (
          <motion.svg
            initial={{ scale: 0.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 20 }}
            className="h-3 w-3 text-white"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </motion.svg>
        )}
      </span>
      <span className={`text-xs leading-relaxed sm:text-sm ${error ? "text-rose-500 font-medium" : "text-ink-500"}`}>
        Я даю согласие на обработку персональных данных и согласен с{" "}
        <Link
          href="/privacy"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
        >
          Политикой конфиденциальности
        </Link>
        ,{" "}
        <Link
          href="/terms"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
        >
          Офертой
        </Link>{" "}
        и{" "}
        <Link
          href="/pep"
          target="_blank"
          onClick={(e) => e.stopPropagation()}
          className="font-semibold text-brand-600 underline decoration-brand-300 underline-offset-2 hover:text-brand-700"
        >
          Правилами ПЭП
        </Link>
      </span>
    </label>
  );
}
