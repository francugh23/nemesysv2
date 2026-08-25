CREATE OR REPLACE FUNCTION "enforce_shs_term_result_revision"()
RETURNS TRIGGER AS $$
DECLARE
  root RECORD;
  predecessor RECORD;
  correction_exists BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'SHS Term Result Revisions are immutable';
  END IF;
  SELECT result.*, sse."enrollmentId", sse."status" AS "participationStatus", sse."gradeLevel", sse."shsCurriculumStatus"
  INTO root
  FROM "ShsTermResult" result
  JOIN "StudentSubjectEnrollment" sse ON sse."id" = result."studentSubjectEnrollmentId"
  JOIN "StudentSubjectEnrollmentTerm" membership ON membership."studentSubjectEnrollmentId" = result."studentSubjectEnrollmentId" AND membership."academicTermId" = result."academicTermId"
  WHERE result."id" = NEW."shsTermResultId"
  FOR UPDATE OF result, sse, membership;
  IF NOT FOUND OR root."status" <> 'FINALIZED' OR root."finalResult" IS NULL OR root."participationStatus" <> 'ACTIVE' OR root."gradeLevel" NOT IN ('11', '12') OR root."shsCurriculumStatus" IS NULL THEN
    RAISE EXCEPTION 'SHS Term Result Revision requires an active finalized SHS Term Result with exact Term membership';
  END IF;
  IF NEW."originalFinalResultSnapshot" IS DISTINCT FROM root."finalResult" THEN RAISE EXCEPTION 'SHS Term Result Revision original snapshot does not match immutable result evidence'; END IF;
  IF NEW."revisedFinalResult" = NEW."priorAuthoritativeResult" THEN RAISE EXCEPTION 'SHS Term Result Revision must change the authoritative result'; END IF;
  SELECT EXISTS (SELECT 1 FROM "ShsStudentParticipationCorrection" correction WHERE correction."sourceStudentSubjectEnrollmentId" = root."studentSubjectEnrollmentId" OR correction."replacementStudentSubjectEnrollmentId" = root."studentSubjectEnrollmentId") INTO correction_exists;
  IF correction_exists THEN RAISE EXCEPTION 'SHS Term Result Revision cannot be composed with participation correction history'; END IF;
  IF NEW."sequence" = 1 THEN
    IF NEW."predecessorRevisionId" IS NOT NULL OR NEW."priorAuthoritativeResult" IS DISTINCT FROM root."finalResult" THEN RAISE EXCEPTION 'First SHS Term Result Revision must begin from immutable result evidence'; END IF;
  ELSE
    SELECT * INTO predecessor FROM "ShsTermResultRevision" WHERE "id" = NEW."predecessorRevisionId" FOR UPDATE;
    IF NOT FOUND OR predecessor."shsTermResultId" <> NEW."shsTermResultId" OR predecessor."sequence" <> NEW."sequence" - 1 OR predecessor."revisedFinalResult" IS DISTINCT FROM NEW."priorAuthoritativeResult" THEN RAISE EXCEPTION 'SHS Term Result Revision predecessor chain is invalid'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
