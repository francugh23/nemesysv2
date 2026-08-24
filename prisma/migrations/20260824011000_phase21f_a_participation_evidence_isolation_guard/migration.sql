CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_has_active_enrollment"(target_enrollment_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentEnrollmentCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE correction."enrollmentId" = target_enrollment_id
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_id TEXT;
  participation_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'StudentSubjectEnrollment' THEN
    enrollment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."enrollmentId" ELSE NEW."enrollmentId" END;
  ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollmentTerm' THEN
    participation_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."studentSubjectEnrollmentId" ELSE NEW."studentSubjectEnrollmentId" END;
    SELECT "enrollmentId" INTO enrollment_id
    FROM "StudentSubjectEnrollment" WHERE "id" = participation_id;
  ELSIF TG_TABLE_NAME = 'ShsTermResult' THEN
    participation_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."studentSubjectEnrollmentId" ELSE NEW."studentSubjectEnrollmentId" END;
    SELECT "enrollmentId" INTO enrollment_id
    FROM "StudentSubjectEnrollment" WHERE "id" = participation_id;
  ELSIF TG_TABLE_NAME = 'Grade' THEN
    enrollment_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."enrollmentId" ELSE NEW."enrollmentId" END;
  END IF;

  IF enrollment_id IS NOT NULL AND "StudentEnrollmentCorrection_has_active_enrollment"(enrollment_id) THEN
    RAISE EXCEPTION 'Student Enrollment Correction cannot mutate participation, Term, result, or Grade evidence';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_reject_sse_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "StudentSubjectEnrollment"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"();

CREATE TRIGGER "StudentEnrollmentCorrection_reject_sse_term_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "StudentSubjectEnrollmentTerm"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"();

CREATE TRIGGER "StudentEnrollmentCorrection_reject_result_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "ShsTermResult"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"();

CREATE TRIGGER "StudentEnrollmentCorrection_reject_grade_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "Grade"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"();
