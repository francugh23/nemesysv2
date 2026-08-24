ALTER TABLE "StudentEnrollmentCorrection"
  ADD COLUMN "enrollmentCreatedAtSnapshot" TIMESTAMP(3) NOT NULL;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_enrollment_created_at"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_created_at TIMESTAMP(3);
BEGIN
  SELECT "createdAt" INTO enrollment_created_at
  FROM "Enrollment" WHERE "id" = NEW."enrollmentId";
  IF NOT FOUND OR NEW."enrollmentCreatedAtSnapshot" IS DISTINCT FROM enrollment_created_at THEN
    RAISE EXCEPTION 'Student Enrollment Correction Enrollment creation snapshot does not match';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_assert_enrollment_created_at_trigger"
BEFORE INSERT ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_enrollment_created_at"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_revalidate_enrollment_created_at"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  expected_created_at TIMESTAMP(3);
  actual_created_at TIMESTAMP(3);
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN
    correction_id := NEW."id";
  ELSE
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    WHERE correction."enrollmentId" = NEW."id"
      AND correction.xmin::TEXT = pg_current_xact_id()::TEXT
    ORDER BY correction."correctedAt" DESC, correction."id" DESC LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."enrollmentCreatedAtSnapshot", enrollment."createdAt"
  INTO expected_created_at, actual_created_at
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  WHERE correction."id" = correction_id;

  IF expected_created_at IS DISTINCT FROM actual_created_at THEN
    RAISE EXCEPTION 'Student Enrollment Correction changed protected Enrollment creation time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_created_at_completion_trigger"
AFTER INSERT ON "StudentEnrollmentCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_revalidate_enrollment_created_at"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_created_at_revalidation_trigger"
AFTER UPDATE OF "createdAt" ON "Enrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_revalidate_enrollment_created_at"();
