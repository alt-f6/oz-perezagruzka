-- DropForeignKey
ALTER TABLE "Group" DROP CONSTRAINT "Group_teacherId_fkey";

-- AlterTable
ALTER TABLE "Group" ALTER COLUMN "teacherId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "school" TEXT;

-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "offerSentAt" TIMESTAMP(3),
ADD COLUMN     "school" TEXT;

-- AddForeignKey
ALTER TABLE "Group" ADD CONSTRAINT "Group_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
