import { SkeletonPageHeader, SkeletonTable } from "@/crm/components/boundaries/Skeleton";

export default function StudentsLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} columns={5} />
    </div>
  );
}
