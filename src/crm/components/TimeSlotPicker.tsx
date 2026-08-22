"use client";

import { forwardRef } from "react";

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
 * 15/30-minute slot list instead.
 */
export const TimeSlotPicker = forwardRef<
  HTMLSelectElement,
  React.SelectHTMLAttributes<HTMLSelectElement> & { stepMinutes?: 15 | 30 }
>(function TimeSlotPicker({ stepMinutes = 15, className, ...props }, ref) {
  const slots = buildSlots(stepMinutes);

  return (
    <select ref={ref} className={className ?? "input"} {...props}>
      <option value="">Выберите время...</option>
      {slots.map((slot) => (
        <option key={slot} value={slot}>
          {slot}
        </option>
      ))}
    </select>
  );
});
