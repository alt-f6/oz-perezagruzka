import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminLessonsLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={6} columns={4} />
    </div>
  );
}
