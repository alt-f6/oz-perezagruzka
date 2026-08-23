import { SkeletonStatRow, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function StudentDashboardLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <SkeletonStatRow count={3} />
      <SkeletonCardGrid count={1} />
    </main>
  );
}
