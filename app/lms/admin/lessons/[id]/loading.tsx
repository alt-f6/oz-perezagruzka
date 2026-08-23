import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function AdminLessonEditLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonCardGrid count={2} />
    </main>
  );
}
