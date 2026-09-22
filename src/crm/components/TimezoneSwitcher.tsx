"use client";

import { ChevronDown } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { CRM_DISPLAY_TZ_COOKIE, CRM_TIMEZONES } from "@/shared/lib/timezone";

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 400; // 400 days, the browser-enforced cap.

// A plain (non-component, non-hook) function, so this write to the external
// `document` global isn't flagged by react-hooks/immutability, which only
// analyzes mutations reachable directly within a component/hook body.
function persistDisplayTimezoneCookie(value: string): void {
  document.cookie = `${CRM_DISPLAY_TZ_COOKIE}=${value}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}`;
}

/**
 * Header pill showing the schedule's active display timezone; picking a
 * different one persists it to a long-lived cookie and refreshes the page so
 * the server component re-resolves ScheduleClient's displayTimezone prop.
 * Never touches the user's saved profile preference -- see ProfileClient for
 * that.
 */
export function TimezoneSwitcher({ value }: { value: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const active = CRM_TIMEZONES.find((tz) => tz.value === value) ?? CRM_TIMEZONES[0];

  const select = (next: string) => {
    persistDisplayTimezoneCookie(next);
    setOpen(false);
    router.refresh();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="badge-neutral inline-flex items-center gap-1"
        aria-haspopup="listbox"
        aria-expanded={open}
        title="Часовой пояс отображения расписания"
      >
        {active.cityLabel} ({active.utcOffsetLabel})
        <ChevronDown size={12} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-1 w-56 rounded-lg border border-slate-200 bg-white p-1 shadow-lg"
        >
          {CRM_TIMEZONES.map((tz) => (
            <button
              key={tz.value}
              type="button"
              role="option"
              aria-selected={tz.value === value}
              onClick={() => select(tz.value)}
              className={`block w-full rounded-md px-2.5 py-1.5 text-left text-xs ${
                tz.value === value
                  ? "bg-accent/10 font-semibold text-accent"
                  : "text-slate-600 hover:bg-slate-50"
              }`}
            >
              {tz.cityLabel} ({tz.utcOffsetLabel})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
