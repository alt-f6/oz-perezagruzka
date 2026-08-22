"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { AppSwitcher } from "@/shared/components/AppSwitcher";
import type { Role } from "@/shared/lib/auth";
import { cn } from "@/shared/lib/utils";
import { LogoutButton } from "@/lms/components/LogoutButton";

type Item = { href: string; label: string };

function NavLink({ href, label }: Item) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "rounded-md px-3 py-1.5 text-sm font-semibold transition-colors duration-200",
        "focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
        active
          ? "bg-accent text-foreground"
          : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
      )}
    >
      {label}
    </Link>
  );
}

export function TopNav({ title, items, role }: { title: string; items: Item[]; role: Role }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-card/40 px-5 py-3 backdrop-blur-sm">
      <div className="flex flex-wrap items-center gap-4">
        <AppSwitcher role={role} className="text-muted-foreground" />
        <span className="text-sm font-black uppercase tracking-wide text-muted-foreground">{title}</span>
        <nav className="flex flex-wrap gap-1">
          {items.map((x) => (
            <NavLink key={x.href} href={x.href} label={x.label} />
          ))}
        </nav>
      </div>

      <LogoutButton redirectTo="/login" />
    </header>
  );
}
