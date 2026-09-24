import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminStudentsLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SkeletonTable rows={3} columns={2} />
        <SkeletonTable rows={4} columns={2} />
      </div>
    </div>
  );
}
