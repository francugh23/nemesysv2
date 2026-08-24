CREATE OR REPLACE FUNCTION "Enrollment_require_newest_student_correction_event"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  newest_command_id BIGINT;
BEGIN
  IF NEW."sectionId" IS NOT DISTINCT FROM OLD."sectionId" THEN
    RETURN NEW;
  END IF;

  correction_id := NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '');
  SELECT correction."id", correction."enrollmentId", correction.xmin::TEXT AS transaction_id,
         correction.cmin::TEXT::BIGINT AS command_id
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."id" = correction_id;

  SELECT MAX(correction.cmin::TEXT::BIGINT) INTO newest_command_id
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."enrollmentId" = OLD."id"
    AND correction.xmin::TEXT = pg_current_xact_id()::TEXT;

  IF NOT FOUND OR correction_record."enrollmentId" <> OLD."id" OR
     correction_record.transaction_id <> pg_current_xact_id()::TEXT OR
     correction_record.command_id IS DISTINCT FROM newest_command_id THEN
    RAISE EXCEPTION 'Enrollment placement changes require the newest Student Enrollment Correction event in the current transaction';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Enrollment_01_require_newest_student_correction_event_trigger"
BEFORE UPDATE OF "sectionId" ON "Enrollment"
FOR EACH ROW EXECUTE FUNCTION "Enrollment_require_newest_student_correction_event"();
