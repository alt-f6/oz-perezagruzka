import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function LmsAdminLoading() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-8">
      <SkeletonPageHeader />
      <SkeletonCardGrid count={1} />
    </main>
  );
}
