import { SkeletonPageHeader } from "@/crm/components/boundaries/Skeleton";

function DayBlock() {
  return (
    <div className="space-y-2 rounded-lg border border-slate-100 p-2">
      <div className="h-3 w-10 animate-pulse rounded bg-slate-200/70" />
      <div className="h-16 w-full animate-pulse rounded bg-slate-200/70" />
      <div className="h-16 w-full animate-pulse rounded bg-slate-200/70" />
    </div>
  );
}

export default function ScheduleLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-7">
        {Array.from({ length: 7 }, (_, i) => (
          <DayBlock key={i} />
        ))}
      </div>
    </div>
  );
}
