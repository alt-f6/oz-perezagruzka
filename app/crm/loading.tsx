import { SkeletonPageHeader, SkeletonStatGrid, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function CrmLoading() {
  return (
    <div className="min-h-screen space-y-8 bg-slate-50 p-8">
      <SkeletonPageHeader />
      <SkeletonStatGrid />
      <SkeletonCardList />
    </div>
  );
}
