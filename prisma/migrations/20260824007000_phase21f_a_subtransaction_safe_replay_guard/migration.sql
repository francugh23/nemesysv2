CREATE OR REPLACE FUNCTION "Enrollment_require_newest_student_correction_event"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  newest_sequence BIGINT;
BEGIN
  IF NEW."sectionId" IS NOT DISTINCT FROM OLD."sectionId" THEN
    RETURN NEW;
  END IF;

  correction_id := NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '');
  SELECT correction."id", correction."enrollmentId", correction."sequence"
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."id" = correction_id;

  SELECT MAX(correction."sequence") INTO newest_sequence
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."enrollmentId" = OLD."id";

  IF correction_record."enrollmentId" <> OLD."id" OR
     correction_record."sequence" IS DISTINCT FROM newest_sequence THEN
    RAISE EXCEPTION 'Enrollment placement changes require the newest Student Enrollment Correction event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
