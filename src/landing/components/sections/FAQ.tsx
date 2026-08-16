"use client";

import { useId, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import Atmosphere from "@/landing/components/ui/Atmosphere";
import Section from "@/landing/components/ui/Section";
import Card from "@/landing/components/ui/Card";
import { FAQ_ITEMS, type FaqItem } from "@/landing/data/faq";
import { fadeInUp, staggerContainer } from "@/landing/components/ui/motion";

export default function FAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(0);
  const prefersReducedMotion = useReducedMotion();

  const itemVariants = fadeInUp(prefersReducedMotion, 40);

  return (
    <Section id="faq" className="scroll-mt-20" paddingOverride="py-16 md:py-24">
      <Atmosphere variant="brand" intensity="premium" />
      <div className="relative mx-auto max-w-3xl px-6">
        <div className="mb-14 text-center">
          <h2 className="font-bold tracking-tight text-ink-900">Частые вопросы</h2>
          <p className="mx-auto mt-3.5 max-w-xl text-lg text-ink-600">
            Отвечаем честно — даже там, где проще было бы дать красивое обещание.
          </p>
        </div>

        <motion.div
          variants={staggerContainer(0.08)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-80px" }}
          className="flex flex-col gap-3.5"
        >
          {FAQ_ITEMS.map((item, index) => (
            <motion.div key={item.question} variants={itemVariants} transition={{ type: "spring", stiffness: 90, damping: 18 }}>
              <FaqAccordionItem
                item={item}
                isOpen={openIndex === index}
                onToggle={() => setOpenIndex((current) => (current === index ? null : index))}
              />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </Section>
  );
}

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  const prefersReducedMotion = useReducedMotion();
  const reactId = useId();
  const buttonId = `faq-button-${reactId}`;
  const panelId = `faq-panel-${reactId}`;
  const transitionDuration = prefersReducedMotion ? 0 : 0.25;

  return (
    <motion.div whileHover={prefersReducedMotion ? undefined : { scale: 1.01 }}>
      <Card
        tint={isOpen ? "glass-active" : "glass"}
        rounded="3xl"
        padding="none"
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? "" : "hover:border-brand-200 hover:shadow-card-hover"
        }`}
      >
        <h3>
          <button
            id={buttonId}
            type="button"
            aria-expanded={isOpen}
            aria-controls={panelId}
            onClick={onToggle}
            className="flex w-full items-center justify-between gap-4 rounded-2xl px-6 py-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-400"
          >
            <span
              className={`font-bold text-sm md:text-base transition-colors ${isOpen ? "text-brand-700" : "text-ink-900"}`}
            >
              {item.question}
            </span>
            <motion.span
              aria-hidden
              animate={{ rotate: isOpen ? 180 : 0 }}
              transition={{ duration: transitionDuration, ease: "easeInOut" }}
              className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition-colors ${
                isOpen ? "bg-brand-600 text-white" : "bg-ink-100 text-ink-600"
              }`}
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
              </svg>
            </motion.span>
          </button>
        </h3>

        {/* CSS grid-template-rows 0fr->1fr trick instead of animating
            `height: 0 -> "auto"` — avoids the layout reflow a height
            animation triggers on every toggle. */}
        <div
          id={panelId}
          role="region"
          aria-labelledby={buttonId}
          inert={!isOpen ? true : undefined}
          style={{ transitionDuration: `${transitionDuration}s` }}
          className={`grid overflow-hidden transition-[grid-template-rows,opacity] ease-out motion-reduce:transition-none ${
            isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            {Array.isArray(item.answer) ? (
              <ul className="list-disc space-y-2 px-6 pb-6 pl-10 text-left text-sm md:text-base leading-relaxed text-ink-600">
                {item.answer.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
            ) : (
              <p className="px-6 pb-6 text-sm md:text-base leading-relaxed text-ink-600">{item.answer}</p>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  );
}
