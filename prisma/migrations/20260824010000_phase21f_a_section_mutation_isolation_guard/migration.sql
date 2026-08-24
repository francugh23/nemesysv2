CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_reject_section_mutation"()
RETURNS TRIGGER AS $$
BEGIN
  IF (NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel" OR
      NEW."deletedAt" IS DISTINCT FROM OLD."deletedAt") AND EXISTS (
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
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentEnrollmentCorrection_section_mutation_isolation_trigger"
AFTER UPDATE OF "gradeLevel", "deletedAt" ON "Section"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentCorrection_reject_section_mutation"();
