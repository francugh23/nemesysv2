BEGIN;

CREATE TYPE "StudentSubjectEnrollmentStatus" AS ENUM ('ACTIVE', 'REPLACED');

CREATE TABLE "StudentSubjectEnrollment" (
  "id" TEXT NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "subjectOfferingId" TEXT NOT NULL,
  "subjectCode" TEXT NOT NULL,
  "subjectDescription" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "status" "StudentSubjectEnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
  "replacedAt" TIMESTAMP(3),
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "StudentSubjectEnrollment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentSubjectEnrollment_replacement_status_check"
    CHECK (("status" = 'ACTIVE' AND "replacedAt" IS NULL) OR ("status" = 'REPLACED' AND "replacedAt" IS NOT NULL))
);

CREATE TABLE "StudentSubjectEnrollmentTerm" (
  "studentSubjectEnrollmentId" TEXT NOT NULL,
  "academicTermId" TEXT NOT NULL,
  CONSTRAINT "StudentSubjectEnrollmentTerm_pkey" PRIMARY KEY ("studentSubjectEnrollmentId", "academicTermId")
);

CREATE INDEX "StudentSubjectEnrollment_enrollmentId_status_idx"
  ON "StudentSubjectEnrollment"("enrollmentId", "status");
CREATE INDEX "StudentSubjectEnrollment_subjectOfferingId_idx"
  ON "StudentSubjectEnrollment"("subjectOfferingId");
CREATE INDEX "StudentSubjectEnrollment_createdById_idx"
  ON "StudentSubjectEnrollment"("createdById");
CREATE INDEX "StudentSubjectEnrollmentTerm_academicTermId_idx"
  ON "StudentSubjectEnrollmentTerm"("academicTermId");
CREATE UNIQUE INDEX "StudentSubjectEnrollment_active_enrollment_offering_key"
  ON "StudentSubjectEnrollment"("enrollmentId", "subjectOfferingId")
  WHERE "status" = 'ACTIVE';

ALTER TABLE "StudentSubjectEnrollment"
  ADD CONSTRAINT "StudentSubjectEnrollment_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentSubjectEnrollment"
  ADD CONSTRAINT "StudentSubjectEnrollment_subjectOfferingId_fkey"
  FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentSubjectEnrollment"
  ADD CONSTRAINT "StudentSubjectEnrollment_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentSubjectEnrollmentTerm"
  ADD CONSTRAINT "StudentSubjectEnrollmentTerm_studentSubjectEnrollmentId_fkey"
  FOREIGN KEY ("studentSubjectEnrollmentId") REFERENCES "StudentSubjectEnrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentSubjectEnrollmentTerm"
  ADD CONSTRAINT "StudentSubjectEnrollmentTerm_academicTermId_fkey"
  FOREIGN KEY ("academicTermId") REFERENCES "AcademicTerm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "StudentSubjectEnrollment_assert_source_year"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "Enrollment" enrollment
    JOIN "SubjectOffering" offering ON offering."id" = NEW."subjectOfferingId"
    WHERE enrollment."id" = NEW."enrollmentId"
      AND enrollment."academicYearId" = offering."academicYearId"
  ) THEN
    RAISE EXCEPTION 'Student Subject Enrollment Offering must belong to the Enrollment Academic Year';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId"
    OR NEW."subjectOfferingId" IS DISTINCT FROM OLD."subjectOfferingId"
    OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
    OR NEW."subjectDescription" IS DISTINCT FROM OLD."subjectDescription"
    OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
    OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
  ) THEN
    RAISE EXCEPTION 'Student Subject Enrollment source and snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollment_assert_source_year_trigger"
  BEFORE INSERT OR UPDATE ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_assert_source_year"();

CREATE FUNCTION "StudentSubjectEnrollmentTerm_assert_offering_term"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" student_subject_enrollment
    JOIN "Enrollment" enrollment ON enrollment."id" = student_subject_enrollment."enrollmentId"
    JOIN "SubjectOfferingTerm" offering_term
      ON offering_term."subjectOfferingId" = student_subject_enrollment."subjectOfferingId"
      AND offering_term."academicTermId" = NEW."academicTermId"
    JOIN "AcademicTerm" academic_term ON academic_term."id" = NEW."academicTermId"
    WHERE student_subject_enrollment."id" = NEW."studentSubjectEnrollmentId"
      AND academic_term."academicYearId" = enrollment."academicYearId"
  ) THEN
    RAISE EXCEPTION 'Student Subject Enrollment Term must belong to the source Offering and Enrollment Academic Year';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollmentTerm_assert_offering_term_trigger"
  BEFORE INSERT OR UPDATE ON "StudentSubjectEnrollmentTerm"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollmentTerm_assert_offering_term"();

CREATE FUNCTION "StudentSubjectEnrollment_prevent_hard_delete"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Student Subject Enrollment history cannot be hard-deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollment_prevent_hard_delete_trigger"
  BEFORE DELETE ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_prevent_hard_delete"();
CREATE TRIGGER "StudentSubjectEnrollmentTerm_prevent_hard_delete_trigger"
  BEFORE DELETE ON "StudentSubjectEnrollmentTerm"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_prevent_hard_delete"();

COMMIT;
