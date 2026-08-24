CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_active_transaction_event_id"()
RETURNS TEXT AS $$
  SELECT correction."id"
  FROM "StudentEnrollmentCorrection" correction
  JOIN pg_locks transaction_lock
    ON transaction_lock.locktype = 'advisory'
   AND transaction_lock.pid = pg_backend_pid()
   AND transaction_lock.granted
   AND transaction_lock.classid = 2106::OID
   AND transaction_lock.objid = correction."sequence"::OID
   AND transaction_lock.objsubid = 2
  WHERE pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
  ORDER BY correction."sequence" DESC
  LIMIT 1;
$$ LANGUAGE sql STABLE;

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
      AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
  );
$$ LANGUAGE sql STABLE;

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
  JOIN pg_locks transaction_lock
    ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
   AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
   AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
  WHERE correction."id" = correction_id
    AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress';

  SELECT MAX(correction."sequence") INTO newest_sequence
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."enrollmentId" = OLD."id";

  IF correction_record."enrollmentId" <> OLD."id" OR
     correction_record."sequence" IS DISTINCT FROM newest_sequence THEN
    RAISE EXCEPTION 'Enrollment placement changes require the newest in-transaction Student Enrollment Correction event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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

  IF old_enrollment_id IS NOT NULL THEN
    PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('evidence', old_enrollment_id);
  END IF;
  IF new_enrollment_id IS NOT NULL AND new_enrollment_id IS DISTINCT FROM old_enrollment_id THEN
    PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('evidence', new_enrollment_id);
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_mark_section_delete"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "StudentEnrollmentCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE OLD."id" IN (correction."sourceSectionId", correction."destinationSectionId")
  ) THEN
    RAISE EXCEPTION 'Sections in a Student Enrollment Correction transaction cannot be deleted';
  END IF;

  PERFORM "StudentEnrollmentCorrection_mark_prior_mutation"('section', OLD."id");
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_00_mark_section_delete_trigger"
BEFORE DELETE ON "Section"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_mark_section_delete"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_active_participants"()
RETURNS TRIGGER AS $$
DECLARE
  source_deleted_at TIMESTAMP(3);
  student_status "StudentStatus";
  student_section_id TEXT;
  student_deleted_at TIMESTAMP(3);
BEGIN
  SELECT source_section."deletedAt", student."status", student."currentSectionId", student."deletedAt"
  INTO source_deleted_at, student_status, student_section_id, student_deleted_at
  FROM "Enrollment" enrollment
  JOIN "Student" student ON student."id" = enrollment."studentId"
  JOIN "Section" source_section ON source_section."id" = NEW."sourceSectionId"
  WHERE enrollment."id" = NEW."enrollmentId";

  IF NOT FOUND OR source_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Correction source Section must be active';
  END IF;
  IF student_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Correction requires an active Student';
  END IF;
  IF student_status IS DISTINCT FROM 'ENROLLED' OR
     student_section_id IS DISTINCT FROM NEW."sourceSectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Correction requires the Student summary to match the source placement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_zz_assert_active_participants_trigger"
BEFORE INSERT ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_assert_active_participants"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_revalidate_active_participants"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  source_deleted_at TIMESTAMP(3);
  student_status "StudentStatus";
  student_section_id TEXT;
  student_deleted_at TIMESTAMP(3);
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN
    correction_id := NEW."id";
  ELSE
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
      AND (
        (TG_TABLE_NAME = 'Student' AND enrollment."studentId" = NEW."id") OR
        (TG_TABLE_NAME = 'Section' AND correction."sourceSectionId" = NEW."id")
      )
    ORDER BY correction."sequence" DESC
    LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT source_section."deletedAt", student."status", student."currentSectionId", student."deletedAt"
  INTO source_deleted_at, student_status, student_section_id, student_deleted_at
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "Student" student ON student."id" = enrollment."studentId"
  JOIN "Section" source_section ON source_section."id" = correction."sourceSectionId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR source_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Correction source Section must remain active';
  END IF;
  IF student_deleted_at IS NOT NULL OR student_status <> 'ENROLLED' THEN
    RAISE EXCEPTION 'Student Enrollment Correction Student must remain active and enrolled';
  END IF;

  SELECT correction."destinationSectionId" INTO student_section_id
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "Student" student ON student."id" = enrollment."studentId"
  WHERE correction."id" = correction_id
    AND student."currentSectionId" = correction."destinationSectionId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Student Enrollment Correction did not preserve the destination Student summary';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_active_participants_completion_trigger"
AFTER INSERT ON "StudentEnrollmentCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_revalidate_active_participants"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_student_active_revalidation_trigger"
AFTER UPDATE OF "status", "currentSectionId", "deletedAt" ON "Student"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_revalidate_active_participants"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_source_section_active_revalidation_trigger"
AFTER UPDATE OF "deletedAt" ON "Section"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_revalidate_active_participants"();
