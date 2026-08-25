CREATE TABLE "ShsTermResultRevision" (
  "id" TEXT NOT NULL,
  "shsTermResultId" TEXT NOT NULL,
  "sequence" INTEGER NOT NULL,
  "predecessorRevisionId" TEXT,
  "originalFinalResultSnapshot" DECIMAL(5,2) NOT NULL,
  "priorAuthoritativeResult" DECIMAL(5,2) NOT NULL,
  "revisedFinalResult" DECIMAL(5,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "revisedById" TEXT NOT NULL,
  "revisedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ShsTermResultRevision_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShsTermResultRevision_result_range_check" CHECK (
    "originalFinalResultSnapshot" >= 0.00 AND "originalFinalResultSnapshot" <= 100.00
    AND "priorAuthoritativeResult" >= 0.00 AND "priorAuthoritativeResult" <= 100.00
    AND "revisedFinalResult" >= 0.00 AND "revisedFinalResult" <= 100.00
  ),
  CONSTRAINT "ShsTermResultRevision_reason_check" CHECK (length(btrim("reason")) BETWEEN 1 AND 500),
  CONSTRAINT "ShsTermResultRevision_evidence_check" CHECK (length(btrim("evidenceReference")) BETWEEN 1 AND 500)
);

CREATE UNIQUE INDEX "ShsTermResultRevision_result_sequence_key" ON "ShsTermResultRevision"("shsTermResultId", "sequence");
CREATE UNIQUE INDEX "ShsTermResultRevision_predecessorRevisionId_key" ON "ShsTermResultRevision"("predecessorRevisionId");
CREATE INDEX "ShsTermResultRevision_result_sequence_idx" ON "ShsTermResultRevision"("shsTermResultId", "sequence");
CREATE INDEX "ShsTermResultRevision_revisedById_idx" ON "ShsTermResultRevision"("revisedById");

ALTER TABLE "ShsTermResultRevision" ADD CONSTRAINT "ShsTermResultRevision_result_fkey"
  FOREIGN KEY ("shsTermResultId") REFERENCES "ShsTermResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsTermResultRevision" ADD CONSTRAINT "ShsTermResultRevision_predecessor_fkey"
  FOREIGN KEY ("predecessorRevisionId") REFERENCES "ShsTermResultRevision"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsTermResultRevision" ADD CONSTRAINT "ShsTermResultRevision_actor_fkey"
  FOREIGN KEY ("revisedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "enforce_shs_term_result_revision"()
RETURNS TRIGGER AS $$
DECLARE
  root RECORD;
  predecessor RECORD;
  participation RECORD;
  correction_exists BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'SHS Term Result Revisions are immutable';
  END IF;

  SELECT result.*, participation."enrollmentId", participation."status" AS "participationStatus",
    participation."gradeLevel", participation."shsCurriculumStatus"
  INTO root
  FROM "ShsTermResult" result
  JOIN "StudentSubjectEnrollment" participation ON participation."id" = result."studentSubjectEnrollmentId"
  JOIN "StudentSubjectEnrollmentTerm" membership
    ON membership."studentSubjectEnrollmentId" = result."studentSubjectEnrollmentId"
    AND membership."academicTermId" = result."academicTermId"
  WHERE result."id" = NEW."shsTermResultId"
  FOR UPDATE OF result, participation, membership;

  IF NOT FOUND OR root."status" <> 'FINALIZED' OR root."finalResult" IS NULL
    OR root."participationStatus" <> 'ACTIVE' OR root."gradeLevel" NOT IN ('11', '12')
    OR root."shsCurriculumStatus" IS NULL THEN
    RAISE EXCEPTION 'SHS Term Result Revision requires an active finalized SHS Term Result with exact Term membership';
  END IF;
  IF NEW."originalFinalResultSnapshot" IS DISTINCT FROM root."finalResult" THEN
    RAISE EXCEPTION 'SHS Term Result Revision original snapshot does not match immutable result evidence';
  END IF;
  IF NEW."revisedFinalResult" = NEW."priorAuthoritativeResult" THEN
    RAISE EXCEPTION 'SHS Term Result Revision must change the authoritative result';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "ShsStudentParticipationCorrection" correction
    WHERE correction."sourceStudentSubjectEnrollmentId" = root."studentSubjectEnrollmentId"
       OR correction."replacementStudentSubjectEnrollmentId" = root."studentSubjectEnrollmentId"
  ) INTO correction_exists;
  IF correction_exists THEN
    RAISE EXCEPTION 'SHS Term Result Revision cannot be composed with participation correction history';
  END IF;

  IF NEW."sequence" = 1 THEN
    IF NEW."predecessorRevisionId" IS NOT NULL OR NEW."priorAuthoritativeResult" IS DISTINCT FROM root."finalResult" THEN
      RAISE EXCEPTION 'First SHS Term Result Revision must begin from immutable result evidence';
    END IF;
  ELSE
    SELECT * INTO predecessor FROM "ShsTermResultRevision"
    WHERE "id" = NEW."predecessorRevisionId" FOR UPDATE;
    IF NOT FOUND OR predecessor."shsTermResultId" <> NEW."shsTermResultId"
      OR predecessor."sequence" <> NEW."sequence" - 1
      OR predecessor."revisedFinalResult" IS DISTINCT FROM NEW."priorAuthoritativeResult" THEN
      RAISE EXCEPTION 'SHS Term Result Revision predecessor chain is invalid';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsTermResultRevision_integrity"
BEFORE INSERT OR UPDATE OR DELETE ON "ShsTermResultRevision"
FOR EACH ROW EXECUTE FUNCTION "enforce_shs_term_result_revision"();

CREATE OR REPLACE FUNCTION "protect_shs_term_result_identity"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."studentSubjectEnrollmentId" IS DISTINCT FROM OLD."studentSubjectEnrollmentId"
    OR NEW."academicTermId" IS DISTINCT FROM OLD."academicTermId" THEN
    RAISE EXCEPTION 'SHS Term Result identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsTermResult_identity_immutable"
BEFORE UPDATE ON "ShsTermResult"
FOR EACH ROW EXECUTE FUNCTION "protect_shs_term_result_identity"();
