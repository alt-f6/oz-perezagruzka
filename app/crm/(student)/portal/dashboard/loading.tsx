import { SkeletonPageHeader, SkeletonStatGrid, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function PortalDashboardLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonStatGrid count={3} />
      <SkeletonCardList count={3} />
    </div>
  );
}
