import { SkeletonPageHeader, SkeletonStatRow, SkeletonCardGrid } from "@/lms/components/boundaries/Skeleton";

export default function LmsAdminLoading() {
  return (
    <div>
      <SkeletonPageHeader />
      <SkeletonStatRow count={3} />
      <SkeletonCardGrid count={3} />
    </div>
  );
}
