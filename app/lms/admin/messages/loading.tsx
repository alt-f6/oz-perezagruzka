import { SkeletonPageHeader, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function AdminMessagesLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonCardGrid count={3} />
    </div>
  );
}
