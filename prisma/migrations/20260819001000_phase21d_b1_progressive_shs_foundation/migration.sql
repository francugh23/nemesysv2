BEGIN;

ALTER TABLE "StudentSubjectEnrollment"
  ADD COLUMN "selectionAcademicTermId" TEXT,
  ADD COLUMN "droppedAt" TIMESTAMP(3),
  ADD COLUMN "dropReason" TEXT;

ALTER TABLE "StudentSubjectEnrollment"
  ADD CONSTRAINT "StudentSubjectEnrollment_selectionAcademicTermId_fkey"
  FOREIGN KEY ("selectionAcademicTermId") REFERENCES "AcademicTerm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "StudentSubjectEnrollment_selectionAcademicTermId_idx"
  ON "StudentSubjectEnrollment"("selectionAcademicTermId");

ALTER TABLE "StudentSubjectEnrollment"
  DROP CONSTRAINT "StudentSubjectEnrollment_replacement_status_check";

ALTER TABLE "StudentSubjectEnrollment"
  ADD CONSTRAINT "StudentSubjectEnrollment_lifecycle_status_check"
  CHECK (
    ("status" = 'ACTIVE' AND "replacedAt" IS NULL AND "droppedAt" IS NULL AND "dropReason" IS NULL)
    OR
    ("status" = 'REPLACED' AND "replacedAt" IS NOT NULL AND "droppedAt" IS NULL AND "dropReason" IS NULL)
    OR
    ("status" = 'DROPPED' AND "replacedAt" IS NULL AND "droppedAt" IS NOT NULL
      AND NULLIF(BTRIM("dropReason"), '') IS NOT NULL
      AND "dropReason" = BTRIM("dropReason")
      AND CHAR_LENGTH("dropReason") <= 500)
  );

CREATE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"() RETURNS TRIGGER AS $$
BEGIN
  IF OLD."status" <> 'ACTIVE' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."replacedAt" IS DISTINCT FROM OLD."replacedAt"
      OR NEW."droppedAt" IS DISTINCT FROM OLD."droppedAt"
      OR NEW."dropReason" IS DISTINCT FROM OLD."dropReason" THEN
      RAISE EXCEPTION 'Terminal Student Subject Enrollment lifecycle is immutable';
    END IF;
  ELSIF NEW."status" NOT IN ('ACTIVE', 'REPLACED', 'DROPPED') THEN
    RAISE EXCEPTION 'Invalid Student Subject Enrollment lifecycle transition';
  END IF;

  IF NEW."selectionAcademicTermId" IS DISTINCT FROM OLD."selectionAcademicTermId" THEN
    RAISE EXCEPTION 'Student Subject Enrollment selection Academic Term is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollment_assert_lifecycle_transition_trigger"
  BEFORE UPDATE OF "status", "replacedAt", "droppedAt", "dropReason", "selectionAcademicTermId"
  ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"();

CREATE OR REPLACE FUNCTION "StudentSubjectEnrollmentTerm_assert_offering_term"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (
    NEW."studentSubjectEnrollmentId" IS DISTINCT FROM OLD."studentSubjectEnrollmentId"
    OR NEW."academicTermId" IS DISTINCT FROM OLD."academicTermId"
  ) THEN
    RAISE EXCEPTION 'Student Subject Enrollment Term memberships are immutable';
  END IF;

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

CREATE FUNCTION "StudentSubjectEnrollment_assert_selection_term"() RETURNS TRIGGER AS $$
DECLARE
  selected_term_id TEXT;
  selected_term_count INTEGER;
BEGIN
  PERFORM 1 FROM "Enrollment"
    WHERE "id" = NEW."enrollmentId"
    FOR UPDATE;

  IF NEW."shsClassification" = 'CORE' AND NEW."selectionAcademicTermId" IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Core participation cannot have a selection Academic Term';
  END IF;

  IF NEW."shsClassification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
    AND NEW."selectionAcademicTermId" IS NOT NULL THEN
    SELECT COUNT(*), MIN("academicTermId")
      INTO selected_term_count, selected_term_id
      FROM "StudentSubjectEnrollmentTerm"
      WHERE "studentSubjectEnrollmentId" = NEW."id";

    IF selected_term_count <> 1 OR selected_term_id IS DISTINCT FROM NEW."selectionAcademicTermId" THEN
      RAISE EXCEPTION 'Progressive SHS elective participation requires exactly its selection Academic Term';
    END IF;
  END IF;

  IF NEW."status" = 'ACTIVE' AND EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" other
    JOIN "StudentSubjectEnrollmentTerm" own_term
      ON own_term."studentSubjectEnrollmentId" = NEW."id"
    JOIN "StudentSubjectEnrollmentTerm" other_term
      ON other_term."studentSubjectEnrollmentId" = other."id"
      AND other_term."academicTermId" = own_term."academicTermId"
    WHERE other."id" <> NEW."id"
      AND other."status" = 'ACTIVE'
      AND other."enrollmentId" = NEW."enrollmentId"
      AND other."subjectOfferingId" = NEW."subjectOfferingId"
  ) THEN
    RAISE EXCEPTION 'Active Student Subject Enrollment Offering Term coverage must be unique';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentSubjectEnrollment_assert_selection_term_trigger"
  AFTER INSERT OR UPDATE
  ON "StudentSubjectEnrollment"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_assert_selection_term"();

CREATE FUNCTION "StudentSubjectEnrollmentTerm_assert_selection_term"() RETURNS TRIGGER AS $$
DECLARE
  participation "StudentSubjectEnrollment"%ROWTYPE;
  selected_term_id TEXT;
  selected_term_count INTEGER;
BEGIN
  SELECT * INTO participation
    FROM "StudentSubjectEnrollment"
    WHERE "id" = NEW."studentSubjectEnrollmentId";

  IF participation."shsClassification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
    AND participation."selectionAcademicTermId" IS NOT NULL THEN
    SELECT COUNT(*), MIN("academicTermId")
      INTO selected_term_count, selected_term_id
      FROM "StudentSubjectEnrollmentTerm"
      WHERE "studentSubjectEnrollmentId" = NEW."studentSubjectEnrollmentId";

    IF selected_term_count <> 1 OR selected_term_id IS DISTINCT FROM participation."selectionAcademicTermId" THEN
      RAISE EXCEPTION 'Progressive SHS elective participation requires exactly its selection Academic Term';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentSubjectEnrollmentTerm_assert_selection_term_trigger"
  AFTER INSERT OR UPDATE ON "StudentSubjectEnrollmentTerm"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollmentTerm_assert_selection_term"();

DROP INDEX "StudentSubjectEnrollment_active_enrollment_offering_key";

CREATE UNIQUE INDEX "StudentSubjectEnrollment_active_legacy_enrollment_offering_key"
  ON "StudentSubjectEnrollment"("enrollmentId", "subjectOfferingId")
  WHERE "status" = 'ACTIVE' AND "selectionAcademicTermId" IS NULL;

CREATE UNIQUE INDEX "StudentSubjectEnrollment_active_enrollment_offering_selection_term_key"
  ON "StudentSubjectEnrollment"("enrollmentId", "subjectOfferingId", "selectionAcademicTermId")
  WHERE "status" = 'ACTIVE' AND "selectionAcademicTermId" IS NOT NULL;

CREATE TABLE "ShsElectiveEnrollmentPolicy" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "academicTermId" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "minimumElectives" INTEGER NOT NULL,
  "maximumElectives" INTEGER NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShsElectiveEnrollmentPolicy_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShsElectiveEnrollmentPolicy_grade_level_check" CHECK ("gradeLevel" IN ('11', '12')),
  CONSTRAINT "ShsElectiveEnrollmentPolicy_counts_check" CHECK (
    "minimumElectives" BETWEEN 1 AND 3
    AND "maximumElectives" BETWEEN 1 AND 3
    AND "minimumElectives" <= "maximumElectives"
  )
);

CREATE UNIQUE INDEX "ShsElectivePolicy_scope_key"
  ON "ShsElectiveEnrollmentPolicy"("academicYearId", "academicTermId", "gradeLevel");
CREATE INDEX "ShsElectivePolicy_scope_idx"
  ON "ShsElectiveEnrollmentPolicy"("academicYearId", "academicTermId", "gradeLevel");
CREATE INDEX "ShsElectiveEnrollmentPolicy_createdById_idx"
  ON "ShsElectiveEnrollmentPolicy"("createdById");

ALTER TABLE "ShsElectiveEnrollmentPolicy"
  ADD CONSTRAINT "ShsElectiveEnrollmentPolicy_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsElectiveEnrollmentPolicy"
  ADD CONSTRAINT "ShsElectiveEnrollmentPolicy_academicTermId_academicYearId_fkey"
  FOREIGN KEY ("academicTermId", "academicYearId") REFERENCES "AcademicTerm"("id", "academicYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsElectiveEnrollmentPolicy"
  ADD CONSTRAINT "ShsElectiveEnrollmentPolicy_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
