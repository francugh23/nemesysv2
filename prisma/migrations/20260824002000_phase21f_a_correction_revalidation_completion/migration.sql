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
    ORDER BY correction."correctedAt" DESC, correction."id" DESC
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Enrollment' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    WHERE correction."enrollmentId" = NEW."id"
      AND NEW."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'AcademicYear' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE enrollment."academicYearId" = NEW."id"
      AND enrollment."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC
    LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Section' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE NEW."id" IN (correction."sourceSectionId", correction."destinationSectionId")
      AND enrollment."sectionId" = correction."destinationSectionId"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC
    LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."id", correction."enrollmentId", correction."destinationSectionId",
         enrollment."studentId", enrollment."sectionId", enrollment."status",
         enrollment."deletedAt", academic_year."status" AS "academicYearStatus",
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
     correction_record."sourceGradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel" THEN
    RAISE EXCEPTION 'Student Enrollment Correction did not complete the exact active same-grade placement update';
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

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_enrollment_revalidation_trigger"
AFTER UPDATE OF "sectionId", "studentId", "academicYearId", "status", "deletedAt" ON "Enrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_academic_year_revalidation_trigger"
AFTER UPDATE OF "status" ON "AcademicYear"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_section_revalidation_trigger"
AFTER UPDATE OF "gradeLevel", "deletedAt" ON "Section"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_complete"();
