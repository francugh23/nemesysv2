BEGIN;
CREATE TABLE "SubjectOffering" (
 "id" TEXT NOT NULL, "subjectId" TEXT NOT NULL, "academicYearId" TEXT NOT NULL, "gradeLevel" TEXT NOT NULL,
 "subjectCode" TEXT NOT NULL, "subjectDescription" TEXT NOT NULL, "createdById" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL, "deletedAt" TIMESTAMP(3),
 CONSTRAINT "SubjectOffering_pkey" PRIMARY KEY ("id")
);
CREATE TABLE "SubjectOfferingTerm" (
 "subjectOfferingId" TEXT NOT NULL, "academicTermId" TEXT NOT NULL,
 CONSTRAINT "SubjectOfferingTerm_pkey" PRIMARY KEY ("subjectOfferingId", "academicTermId")
);
CREATE INDEX "SubjectOffering_academicYearId_idx" ON "SubjectOffering"("academicYearId");
CREATE INDEX "SubjectOffering_subjectId_idx" ON "SubjectOffering"("subjectId");
CREATE INDEX "SubjectOfferingTerm_academicTermId_idx" ON "SubjectOfferingTerm"("academicTermId");
CREATE UNIQUE INDEX "SubjectOffering_active_identity_key" ON "SubjectOffering"("subjectId", "academicYearId", "gradeLevel") WHERE "deletedAt" IS NULL;
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_subjectId_fkey" FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_academicYearId_fkey" FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOffering" ADD CONSTRAINT "SubjectOffering_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOfferingTerm" ADD CONSTRAINT "SubjectOfferingTerm_subjectOfferingId_fkey" FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOfferingTerm" ADD CONSTRAINT "SubjectOfferingTerm_academicTermId_fkey" FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
CREATE FUNCTION "SubjectOfferingTerm_assert_same_year"() RETURNS TRIGGER AS $$
BEGIN
 IF NOT EXISTS (SELECT 1 FROM "SubjectOffering" offering JOIN "AcademicTerm" term ON term."id" = NEW."academicTermId" WHERE offering."id" = NEW."subjectOfferingId" AND offering."academicYearId" = term."academicYearId") THEN RAISE EXCEPTION 'Subject Offering Term must belong to the Offering Academic Year'; END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "SubjectOfferingTerm_assert_same_year_trigger" BEFORE INSERT OR UPDATE ON "SubjectOfferingTerm" FOR EACH ROW EXECUTE FUNCTION "SubjectOfferingTerm_assert_same_year"();
COMMIT;
