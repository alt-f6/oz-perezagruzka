import { SkeletonPageHeader, SkeletonTable } from "@/crm/components/boundaries/Skeleton";

export default function SalaryLoading() {
  return (
    <div className="space-y-6">
      <SkeletonPageHeader />
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}
