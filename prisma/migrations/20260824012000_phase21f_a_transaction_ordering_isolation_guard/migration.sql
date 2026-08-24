CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_mark_prior_mutation"(
  mutation_kind TEXT,
  target_id TEXT
)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('nemesys:phase21f-a:' || mutation_kind || ':' || target_id, 0)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_has_prior_mutation"(
  mutation_kind TEXT,
  target_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  marker_key BIGINT;
BEGIN
  marker_key := hashtextextended(
    'nemesys:phase21f-a:' || mutation_kind || ':' || target_id,
    0
  );

  RETURN EXISTS (
    SELECT 1
    FROM pg_locks transaction_lock
    WHERE transaction_lock.locktype = 'advisory'
      AND transaction_lock.pid = pg_backend_pid()
      AND transaction_lock.granted
      AND transaction_lock.objsubid = 1
      AND transaction_lock.classid::BIGINT = ((marker_key >> 32) & 4294967295)
      AND transaction_lock.objid::BIGINT = (marker_key & 4294967295)
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_reject_evidence_mutation"()
RETURNS TRIGGER AS $$
DECLARE
  old_enrollment_id TEXT;
  new_enrollment_id TEXT;
  old_participation_id TEXT;
  new_participation_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'StudentSubjectEnrollment' THEN
    IF TG_OP <> 'INSERT' THEN old_enrollment_id := OLD."enrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_enrollment_id := NEW."enrollmentId"; END IF;
  ELSIF TG_TABLE_NAME IN ('StudentSubjectEnrollmentTerm', 'ShsTermResult') THEN
    IF TG_OP <> 'INSERT' THEN old_participation_id := OLD."studentSubjectEnrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_participation_id := NEW."studentSubjectEnrollmentId"; END IF;

    IF old_participation_id IS NOT NULL THEN
      SELECT "enrollmentId" INTO old_enrollment_id
      FROM "StudentSubjectEnrollment" WHERE "id" = old_participation_id;
    END IF;
    IF new_participation_id IS NOT NULL THEN
      SELECT "enrollmentId" INTO new_enrollment_id
      FROM "StudentSubjectEnrollment" WHERE "id" = new_participation_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'Grade' THEN
    IF TG_OP <> 'INSERT' THEN old_enrollment_id := OLD."enrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_enrollment_id := NEW."enrollmentId"; END IF;
  END IF;

  IF (old_enrollment_id IS NOT NULL AND
      "StudentEnrollmentCorrection_has_active_enrollment"(old_enrollment_id)) OR
     (new_enrollment_id IS NOT NULL AND
      new_enrollment_id IS DISTINCT FROM old_enrollment_id AND
      "StudentEnrollmentCorrection_has_active_enrollment"(new_enrollment_id)) THEN
    RAISE EXCEPTION 'Student Enrollment Correction cannot mutate participation, Term, result, or Grade evidence';
  END IF;

  -- Atomic creation may materialize evidence before a new Enrollment has ever committed;
  -- there is no prior history for a later same-transaction correction to rewrite.
  IF TG_OP = 'INSERT' AND new_enrollment_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM "Enrollment"
    WHERE "id" = new_enrollment_id
      AND xmin::TEXT = pg_current_xact_id()::TEXT
  ) THEN
    RETURN NEW;
  END IF;

  IF old_enrollment_id IS NOT NULL THEN
    PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('evidence', old_enrollment_id);
  END IF;
  IF new_enrollment_id IS NOT NULL AND new_enrollment_id IS DISTINCT FROM old_enrollment_id THEN
    PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('evidence', new_enrollment_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_mark_section_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel" OR
     NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt" THEN
    IF EXISTS (
      SELECT 1
      FROM "StudentEnrollmentCorrection" correction
      JOIN pg_locks transaction_lock
        ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
       AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
       AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
      WHERE OLD."id" IN (correction."sourceSectionId", correction."destinationSectionId")
    ) THEN
      RAISE EXCEPTION 'Sections in a Student Enrollment Correction transaction cannot change grade or archive state';
    END IF;

    PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('section', OLD."id");
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_00_mark_section_mutation_trigger"
BEFORE UPDATE OF "gradeLevel", "deletedAt" ON "Section"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_mark_section_mutation"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_no_prior_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF "StudentEnrollmentCorrection_has_prior_mutation"('evidence', NEW."enrollmentId") THEN
    RAISE EXCEPTION 'Student Enrollment Correction cannot follow participation, Term, result, or Grade evidence mutation in the same transaction';
  END IF;
  IF "StudentEnrollmentCorrection_has_prior_mutation"('section', NEW."sourceSectionId") OR
     "StudentEnrollmentCorrection_has_prior_mutation"('section', NEW."destinationSectionId") THEN
    RAISE EXCEPTION 'Student Enrollment Correction cannot follow source or destination Section mutation in the same transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_01_assert_no_prior_mutation_trigger"
BEFORE INSERT ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_no_prior_mutation"();
