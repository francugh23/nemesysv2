BEGIN;

DROP TRIGGER "StudentSubjectEnrollment_lock_source_offering_trigger"
  ON "StudentSubjectEnrollment";

-- PostgreSQL runs same-event triggers by name. Lock before snapshot validators read the source.
CREATE TRIGGER "StudentSubjectEnrollment_00_lock_source_offering_trigger"
  BEFORE INSERT OR UPDATE ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_lock_source_offering"();

COMMIT;
