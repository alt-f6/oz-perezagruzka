import { SkeletonPageHeader, SkeletonTable } from "@/lms/components/boundaries/Skeleton";

export default function AdminStudentsLoading() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-8">
      <SkeletonPageHeader />
      <div className="grid items-start gap-6 lg:grid-cols-2">
        <SkeletonTable rows={3} columns={2} />
        <SkeletonTable rows={4} columns={2} />
      </div>
    </main>
  );
}
