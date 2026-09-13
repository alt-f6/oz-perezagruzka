import { SkeletonPageHeader, SkeletonCardList } from "@/crm/components/boundaries/Skeleton";

export default function GroupsLoading() {
  return (
    <div className="min-w-0 w-full space-y-6">
      <SkeletonPageHeader />
      <div className="grid gap-4 md:grid-cols-2">
        <SkeletonCardList count={4} />
      </div>
    </div>
  );
}
