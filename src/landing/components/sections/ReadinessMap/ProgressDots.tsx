interface ProgressDotsProps {
  total: number;
  current: number;
}

export function ProgressDots({ total, current }: ProgressDotsProps) {
  return (
    <div
      className="flex items-center justify-center gap-2"
      role="progressbar"
      aria-valuenow={current + 1}
      aria-valuemin={1}
      aria-valuemax={total}
      aria-label={`Шаг ${current + 1} из ${total}`}
    >
      {Array.from({ length: total }).map((_, index) => {
        const isActive = index === current;
        const isCompleted = index < current;

        return (
          <span
            key={index}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              isActive
                ? "w-8 bg-brand-600"
                : isCompleted
                  ? "w-1.5 bg-brand-300"
                  : "w-1.5 bg-ink-200"
            }`}
          />
        );
      })}
    </div>
  );
}
