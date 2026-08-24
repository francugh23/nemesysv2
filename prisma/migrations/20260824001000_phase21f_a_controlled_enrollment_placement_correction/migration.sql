CREATE TABLE "StudentEnrollmentCorrection" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "sourceSectionId" TEXT NOT NULL,
    "destinationSectionId" TEXT NOT NULL,
    "sourcePlacementSnapshot" JSONB NOT NULL,
    "destinationPlacementSnapshot" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceReference" TEXT NOT NULL,
    "correctedById" TEXT NOT NULL,
    "correctedAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StudentEnrollmentCorrection_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "StudentEnrollmentCorrection_distinct_sections_check"
      CHECK ("sourceSectionId" <> "destinationSectionId"),
    CONSTRAINT "StudentEnrollmentCorrection_reason_check"
      CHECK (
        NULLIF(BTRIM("reason", E' \t\n\r\f\v'), '') IS NOT NULL
        AND "reason" = BTRIM("reason", E' \t\n\r\f\v')
        AND CHAR_LENGTH("reason") <= 500
      ),
    CONSTRAINT "StudentEnrollmentCorrection_evidence_check"
      CHECK (
        NULLIF(BTRIM("evidenceReference", E' \t\n\r\f\v'), '') IS NOT NULL
        AND "evidenceReference" = BTRIM("evidenceReference", E' \t\n\r\f\v')
        AND CHAR_LENGTH("evidenceReference") <= 500
      )
);

CREATE INDEX "StudentEnrollmentCorrection_enrollmentId_correctedAt_idx"
  ON "StudentEnrollmentCorrection"("enrollmentId", "correctedAt");
CREATE INDEX "StudentEnrollmentCorrection_sourceSectionId_idx"
  ON "StudentEnrollmentCorrection"("sourceSectionId");
CREATE INDEX "StudentEnrollmentCorrection_destinationSectionId_idx"
  ON "StudentEnrollmentCorrection"("destinationSectionId");
CREATE INDEX "StudentEnrollmentCorrection_correctedById_idx"
  ON "StudentEnrollmentCorrection"("correctedById");

ALTER TABLE "StudentEnrollmentCorrection"
  ADD CONSTRAINT "StudentEnrollmentCorrection_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentCorrection"
  ADD CONSTRAINT "StudentEnrollmentCorrection_sourceSectionId_fkey"
  FOREIGN KEY ("sourceSectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentCorrection"
  ADD CONSTRAINT "StudentEnrollmentCorrection_destinationSectionId_fkey"
  FOREIGN KEY ("destinationSectionId") REFERENCES "Section"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentCorrection"
  ADD CONSTRAINT "StudentEnrollmentCorrection_correctedById_fkey"
  FOREIGN KEY ("correctedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Student Enrollment Correction records are immutable and cannot be deleted';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_assert_immutable_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_immutable"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  source_section RECORD;
  destination_section RECORD;
  expected_source_snapshot JSONB;
  expected_destination_snapshot JSONB;
BEGIN
  SELECT enrollment."id", enrollment."sectionId", enrollment."status",
         enrollment."deletedAt", enrollment."academicYearId", enrollment."studentId",
         academic_year."status" AS "academicYearStatus"
  INTO enrollment_record
  FROM "Enrollment" enrollment
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  WHERE enrollment."id" = NEW."enrollmentId"
  FOR UPDATE OF enrollment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment for Student Enrollment Correction does not exist';
  END IF;
  IF enrollment_record."deletedAt" IS NOT NULL OR enrollment_record."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Student Enrollment Correction requires an active Enrollment';
  END IF;
  IF enrollment_record."academicYearStatus" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Student Enrollment Correction requires an active Academic Year';
  END IF;
  IF enrollment_record."sectionId" <> NEW."sourceSectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Correction source does not match current placement';
  END IF;

  PERFORM "id" FROM "Section"
  WHERE "id" IN (NEW."sourceSectionId", NEW."destinationSectionId")
  ORDER BY "id" FOR SHARE;

  SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
  INTO source_section FROM "Section" WHERE "id" = NEW."sourceSectionId";
  SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
  INTO destination_section FROM "Section" WHERE "id" = NEW."destinationSectionId";

  IF source_section."id" IS NULL OR destination_section."id" IS NULL THEN
    RAISE EXCEPTION 'Student Enrollment Correction Sections must exist';
  END IF;
  IF destination_section."deletedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Correction destination Section must be active';
  END IF;
  IF source_section."gradeLevel" IS DISTINCT FROM destination_section."gradeLevel" THEN
    RAISE EXCEPTION 'Student Enrollment Correction Sections must have the same grade level';
  END IF;

  expected_source_snapshot := jsonb_build_object(
    'sectionId', source_section."id",
    'gradeLevel', source_section."gradeLevel",
    'trackStrand', source_section."trackStrand",
    'sectionName', source_section."sectionName"
  );
  expected_destination_snapshot := jsonb_build_object(
    'sectionId', destination_section."id",
    'gradeLevel', destination_section."gradeLevel",
    'trackStrand', destination_section."trackStrand",
    'sectionName', destination_section."sectionName"
  );

  IF NEW."sourcePlacementSnapshot" IS DISTINCT FROM expected_source_snapshot OR
     NEW."destinationPlacementSnapshot" IS DISTINCT FROM expected_destination_snapshot THEN
    RAISE EXCEPTION 'Student Enrollment Correction placement snapshots do not match their Sections';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_assert_intent_trigger"
BEFORE INSERT ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_intent"();

CREATE OR REPLACE FUNCTION "Enrollment_require_student_correction_context"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
BEGIN
  IF NEW."sectionId" IS NOT DISTINCT FROM OLD."sectionId" THEN
    RETURN NEW;
  END IF;

  correction_id := NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '');
  IF correction_id IS NULL THEN
    RAISE EXCEPTION 'Enrollment placement changes require an exact Student Enrollment Correction context';
  END IF;

  SELECT "id", "enrollmentId", "sourceSectionId", "destinationSectionId"
  INTO correction_record
  FROM "StudentEnrollmentCorrection"
  WHERE "id" = correction_id;

  IF NOT FOUND OR correction_record."enrollmentId" <> OLD."id" OR
     correction_record."sourceSectionId" <> OLD."sectionId" OR
     correction_record."destinationSectionId" <> NEW."sectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Correction context does not match the placement update';
  END IF;

  IF OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE' OR
     OLD."deletedAt" IS NOT NULL OR NEW."deletedAt" IS NOT NULL OR
     NEW."studentId" IS DISTINCT FROM OLD."studentId" OR
     NEW."academicYearId" IS DISTINCT FROM OLD."academicYearId" OR
     NEW."entryAcademicTermId" IS DISTINCT FROM OLD."entryAcademicTermId" OR
     NEW."shsTrack" IS DISTINCT FROM OLD."shsTrack" OR
     NEW."semester" IS DISTINCT FROM OLD."semester" OR
     NEW."createdById" IS DISTINCT FROM OLD."createdById" OR
     NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Student Enrollment Correction may change only the active Enrollment placement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Enrollment_00_require_student_correction_context_trigger"
BEFORE UPDATE OF "sectionId" ON "Enrollment"
FOR EACH ROW EXECUTE FUNCTION "Enrollment_require_student_correction_context"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_complete"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  enrollment_record RECORD;
  student_record RECORD;
BEGIN
  correction_id := CASE
    WHEN TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN NEW."id"
    ELSE NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '')
  END;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."id", correction."enrollmentId", correction."destinationSectionId",
         enrollment."studentId", enrollment."sectionId", enrollment."status",
         enrollment."deletedAt", academic_year."status" AS "academicYearStatus"
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR correction_record."sectionId" <> correction_record."destinationSectionId" OR
     correction_record."status" <> 'ACTIVE' OR correction_record."deletedAt" IS NOT NULL OR
     correction_record."academicYearStatus" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Student Enrollment Correction did not complete the exact active placement update';
  END IF;

  SELECT "status", "currentSectionId" INTO student_record
  FROM "Student" WHERE "id" = correction_record."studentId";
  IF NOT FOUND OR student_record."status" <> 'ENROLLED' OR
     student_record."currentSectionId" <> correction_record."destinationSectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Correction did not synchronize the Student placement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_completion_trigger"
AFTER INSERT ON "StudentEnrollmentCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_student_revalidation_trigger"
AFTER UPDATE OF "status", "currentSectionId" ON "Student"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();
