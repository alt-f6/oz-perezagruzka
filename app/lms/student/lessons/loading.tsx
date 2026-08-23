import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function StudentLessonsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonCardGrid count={6} />
    </main>
  );
}
