-- AlterTable
ALTER TABLE "Student" ADD COLUMN     "currentSectionId" TEXT;

-- CreateIndex
CREATE INDEX "Student_currentSectionId_idx" ON "Student"("currentSectionId");

-- AddForeignKey
ALTER TABLE "Student" ADD CONSTRAINT "Student_currentSectionId_fkey" FOREIGN KEY ("currentSectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;
