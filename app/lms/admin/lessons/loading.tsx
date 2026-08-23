import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminLessonsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonTable rows={6} columns={4} />
    </main>
  );
}
