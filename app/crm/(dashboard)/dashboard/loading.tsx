import { SkeletonPageHeader, SkeletonStatGrid, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function DashboardLoading() {
  return (
    <div className="space-y-8">
      <SkeletonPageHeader />
      <SkeletonStatGrid count={4} />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <SkeletonCardList count={1} />
        </div>
        <SkeletonCardList count={1} />
      </div>
    </div>
  );
}
