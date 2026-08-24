CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  source_section RECORD;
  destination_section RECORD;
  expected_source_snapshot JSONB;
  expected_destination_snapshot JSONB;
BEGIN
  SELECT enrollment."id", enrollment."studentId", enrollment."sectionId",
         enrollment."academicYearId", enrollment."status", enrollment."deletedAt",
         enrollment."entryAcademicTermId", enrollment."shsTrack", enrollment."semester",
         enrollment."createdById", academic_year."status" AS "academicYearStatus"
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
    'enrollmentId', enrollment_record."id",
    'studentId', enrollment_record."studentId",
    'academicYearId', enrollment_record."academicYearId",
    'enrollmentStatus', enrollment_record."status",
    'entryAcademicTermId', enrollment_record."entryAcademicTermId",
    'shsTrack', enrollment_record."shsTrack",
    'semester', enrollment_record."semester",
    'createdById', enrollment_record."createdById",
    'sectionId', source_section."id",
    'gradeLevel', source_section."gradeLevel",
    'trackStrand', source_section."trackStrand",
    'sectionName', source_section."sectionName"
  );
  expected_destination_snapshot := expected_source_snapshot || jsonb_build_object(
    'sectionId', destination_section."id",
    'gradeLevel', destination_section."gradeLevel",
    'trackStrand', destination_section."trackStrand",
    'sectionName', destination_section."sectionName"
  );

  IF NEW."sourcePlacementSnapshot" IS DISTINCT FROM expected_source_snapshot OR
     NEW."destinationPlacementSnapshot" IS DISTINCT FROM expected_destination_snapshot THEN
    RAISE EXCEPTION 'Student Enrollment Correction placement snapshots do not match the Enrollment and Sections';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_complete"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  student_record RECORD;
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN
    correction_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'Student' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE enrollment."studentId" = NEW."id"
      AND enrollment."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Enrollment' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    WHERE correction."enrollmentId" = NEW."id"
      AND NEW."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'AcademicYear' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE enrollment."academicYearId" = NEW."id"
      AND enrollment."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Section' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE NEW."id" IN (correction."sourceSectionId", correction."destinationSectionId")
      AND enrollment."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."id", correction."enrollmentId", correction."destinationSectionId",
         correction."sourcePlacementSnapshot", enrollment."studentId",
         enrollment."academicYearId", enrollment."sectionId", enrollment."status",
         enrollment."deletedAt", enrollment."entryAcademicTermId", enrollment."shsTrack",
         enrollment."semester", enrollment."createdById",
         academic_year."status" AS "academicYearStatus",
         source_section."gradeLevel" AS "sourceGradeLevel",
         destination_section."gradeLevel" AS "destinationGradeLevel",
         destination_section."deletedAt" AS "destinationDeletedAt"
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  JOIN "Section" source_section ON source_section."id" = correction."sourceSectionId"
  JOIN "Section" destination_section ON destination_section."id" = correction."destinationSectionId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR correction_record."sectionId" <> correction_record."destinationSectionId" OR
     correction_record."status" <> 'ACTIVE' OR correction_record."deletedAt" IS NOT NULL OR
     correction_record."academicYearStatus" <> 'ACTIVE' OR
     correction_record."destinationDeletedAt" IS NOT NULL OR
     correction_record."sourceGradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel" OR
     correction_record."sourcePlacementSnapshot"->>'enrollmentId' IS DISTINCT FROM correction_record."enrollmentId" OR
     correction_record."sourcePlacementSnapshot"->>'studentId' IS DISTINCT FROM correction_record."studentId" OR
     correction_record."sourcePlacementSnapshot"->>'academicYearId' IS DISTINCT FROM correction_record."academicYearId" OR
     correction_record."sourcePlacementSnapshot"->>'enrollmentStatus' IS DISTINCT FROM correction_record."status"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'entryAcademicTermId' IS DISTINCT FROM correction_record."entryAcademicTermId" OR
     correction_record."sourcePlacementSnapshot"->>'shsTrack' IS DISTINCT FROM correction_record."shsTrack"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'semester' IS DISTINCT FROM correction_record."semester"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'createdById' IS DISTINCT FROM correction_record."createdById" THEN
    RAISE EXCEPTION 'Student Enrollment Correction changed protected Enrollment identity, lifecycle, or entry facts';
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

DROP TRIGGER "StudentEnrollmentCorrection_enrollment_revalidation_trigger" ON "Enrollment";
CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_enrollment_revalidation_trigger"
AFTER UPDATE OF "sectionId", "studentId", "academicYearId", "status", "deletedAt",
  "entryAcademicTermId", "shsTrack", "semester", "createdById" ON "Enrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();
