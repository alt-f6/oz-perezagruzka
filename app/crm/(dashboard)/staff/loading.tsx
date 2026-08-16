import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function StaffLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <SkeletonCardList count={6} />
      </div>
    </div>
  );
}
