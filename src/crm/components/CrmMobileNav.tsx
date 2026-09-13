"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Menu } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Sidebar } from "@/crm/components/Sidebar";
import { AppSwitcher } from "@/shared/components/AppSwitcher";
import type { Role } from "@/shared/lib/auth";

export function CrmMobileNav({ email, role }: { email: string; role: Role }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // Derived-state-during-render: closes the drawer on navigation without a
  // pathname-keyed effect (React's "adjusting state when a prop changes"
  // pattern -- see https://react.dev/learn/you-might-not-need-an-effect).
  const [lastPathname, setLastPathname] = useState(pathname);
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    if (open) setOpen(false);
  }

  const triggerRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLDivElement>(null);
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (!open) return undefined;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }

    // Lock background scroll without a layout shift from the vanishing
    // scrollbar: pad the body by exactly the width the scrollbar occupied.
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    const previousOverflow = document.body.style.overflow;
    const previousPaddingRight = document.body.style.paddingRight;
    document.body.style.overflow = "hidden";
    if (scrollbarWidth > 0) document.body.style.paddingRight = `${scrollbarWidth}px`;

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.style.paddingRight = previousPaddingRight;
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      wasOpenRef.current = true;
      drawerRef.current?.focus();
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false;
      triggerRef.current?.focus();
    }
  }, [open]);

  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 shrink-0 items-center gap-2 border-b border-slate-200 bg-white/90 px-3 backdrop-blur-sm md:hidden">
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Открыть меню навигации"
          aria-haspopup="dialog"
          aria-expanded={open}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
        >
          <Menu size={22} />
        </button>

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-[11px] font-semibold text-white">
            OZ
          </div>
          <span className="truncate text-sm font-semibold text-slate-900">Отсек Знаний</span>
        </div>

        <AppSwitcher role={role} />
      </header>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="crm-mobile-nav-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs md:hidden"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
        ) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (
          <motion.div
            key="crm-mobile-nav-drawer"
            ref={drawerRef}
            role="dialog"
            aria-modal="true"
            aria-label="Меню навигации"
            tabIndex={-1}
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", duration: 0.35, bounce: 0.1 }}
            className="fixed inset-y-0 left-0 z-50 flex pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] shadow-xl outline-none md:hidden"
          >
            <Sidebar email={email} role={role} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </>
  );
}
