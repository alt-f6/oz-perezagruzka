import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminCoursesLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonTable rows={5} columns={7} />
    </div>
  );
}
