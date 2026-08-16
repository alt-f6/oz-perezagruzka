export function LessonViewerSkeleton() {
  return (
    <div className="mx-auto flex max-w-6xl animate-pulse gap-6 px-6 py-8">
      <aside className="hidden w-64 shrink-0 lg:block">
        <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card/60 p-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-md bg-white/[0.06]" />
          ))}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div className="h-9 w-24 rounded-md bg-white/[0.06] lg:hidden" />
          <div className="ml-auto h-9 w-40 rounded-md bg-white/[0.06]" />
        </div>

        <div className="mb-6 flex flex-col gap-2">
          <div className="h-5 w-20 rounded-full bg-white/[0.06]" />
          <div className="h-8 w-2/3 rounded-md bg-white/[0.06]" />
          <div className="h-4 w-1/2 rounded-md bg-white/[0.06]" />
        </div>

        <div className="aspect-video w-full rounded-2xl bg-white/[0.06]" />

        <div className="mt-6 h-24 w-full rounded-2xl bg-white/[0.06]" />
      </div>
    </div>
  );
}
