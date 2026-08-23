import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminAssignmentsLoading() {
  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonTable rows={8} columns={4} />
    </main>
  );
}
