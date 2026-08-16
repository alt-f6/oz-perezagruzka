import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function DashboardSegmentLoading() {
  return (
    <div className="space-y-8">
      <SkeletonPageHeader />
      <SkeletonCardList count={4} />
    </div>
  );
}
