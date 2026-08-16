import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function StudentSegmentLoading() {
  return (
    <div className="space-y-4">
      <SkeletonPageHeader />
      <SkeletonCardList count={3} />
    </div>
  );
}
