import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function LeadsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="flex items-start gap-4 overflow-x-auto pb-4">
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="w-64 shrink-0">
            <SkeletonCardList count={2} />
          </div>
        ))}
      </div>
    </div>
  );
}
