import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function AdminMessagesLoading() {
  return (
    <main className="mx-auto max-w-4xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonCardGrid count={3} />
    </main>
  );
}
