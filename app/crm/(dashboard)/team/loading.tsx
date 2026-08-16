import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function TeamLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <SkeletonPageHeader />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <SkeletonCardList count={2} />
        <div className="lg:col-span-2">
          <SkeletonCardList count={5} />
        </div>
      </div>
    </div>
  );
}
