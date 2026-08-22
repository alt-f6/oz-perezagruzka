"use client";

function buildSlots(stepMinutes: number): string[] {
  const slots: string[] = [];
  for (let minutes = 0; minutes < 24 * 60; minutes += stepMinutes) {
    const hours = Math.floor(minutes / 60)
      .toString()
      .padStart(2, "0");
    const mins = (minutes % 60).toString().padStart(2, "0");
    slots.push(`${hours}:${mins}`);
  }
  return slots;
}

/**
 * Native <input type="time"> doesn't reliably enforce a step in every
 * browser's picker UI, so lesson times are chosen from an explicit
 * 15/30-minute slot chip grid instead of a raw time input.
 */
export function TimeSlotPicker({
  value,
  onChange,
  disabled,
  stepMinutes = 15,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  stepMinutes?: 15 | 30;
}) {
  const slots = buildSlots(stepMinutes);

  return (
    <div className="grid max-h-48 grid-cols-4 gap-1.5 overflow-y-auto sm:grid-cols-6">
      {slots.map((slot) => {
        const active = value === slot;
        return (
          <button
            key={slot}
            type="button"
            disabled={disabled}
            aria-pressed={active}
            onClick={() => onChange(slot)}
            className={`rounded-lg px-2 py-1.5 text-xs font-semibold tabular-nums transition-colors duration-150 ${
              active
                ? "bg-accent text-white"
                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
            }`}
          >
            {slot}
          </button>
        );
      })}
    </div>
  );
}
