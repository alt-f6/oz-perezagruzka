import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function AdminLessonEditLoading() {
  return (
    <div className="mx-auto max-w-5xl">
      <SkeletonPageHeader />
      <SkeletonCardGrid count={2} />
    </div>
  );
}
