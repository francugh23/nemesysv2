BEGIN;

ALTER TABLE "SubjectOffering"
  ADD COLUMN "replacesSubjectOfferingId" TEXT;

CREATE UNIQUE INDEX "SubjectOffering_replacesSubjectOfferingId_key"
  ON "SubjectOffering"("replacesSubjectOfferingId");

ALTER TABLE "SubjectOffering"
  ADD CONSTRAINT "SubjectOffering_replacesSubjectOfferingId_fkey"
  FOREIGN KEY ("replacesSubjectOfferingId") REFERENCES "SubjectOffering"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "CurriculumCorrection" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "sourceOfferingId" TEXT NOT NULL,
  "replacementOfferingId" TEXT NOT NULL,
  "effectiveAcademicTermId" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "sourceWasFinalized" BOOLEAN NOT NULL,
  "sourceParticipationCount" INTEGER NOT NULL,
  "sourceConfigurationSnapshot" JSONB NOT NULL,
  "replacementConfigurationSnapshot" JSONB NOT NULL,
  "correctedById" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CurriculumCorrection_distinct_offerings_check"
    CHECK ("sourceOfferingId" <> "replacementOfferingId"),
  CONSTRAINT "CurriculumCorrection_reason_check"
    CHECK (NULLIF(BTRIM("reason"), '') IS NOT NULL),
  CONSTRAINT "CurriculumCorrection_evidence_check"
    CHECK (NULLIF(BTRIM("evidenceReference"), '') IS NOT NULL),
  CONSTRAINT "CurriculumCorrection_participation_count_check"
    CHECK ("sourceParticipationCount" >= 0)
);

CREATE UNIQUE INDEX "CurriculumCorrection_sourceOfferingId_key"
  ON "CurriculumCorrection"("sourceOfferingId");
CREATE UNIQUE INDEX "CurriculumCorrection_replacementOfferingId_key"
  ON "CurriculumCorrection"("replacementOfferingId");
CREATE INDEX "CurriculumCorrection_academicYearId_effectiveAcademicTermId_idx"
  ON "CurriculumCorrection"("academicYearId", "effectiveAcademicTermId");
CREATE INDEX "CurriculumCorrection_correctedById_idx"
  ON "CurriculumCorrection"("correctedById");

ALTER TABLE "CurriculumCorrection"
  ADD CONSTRAINT "CurriculumCorrection_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CurriculumCorrection_sourceOfferingId_fkey"
  FOREIGN KEY ("sourceOfferingId") REFERENCES "SubjectOffering"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CurriculumCorrection_replacementOfferingId_fkey"
  FOREIGN KEY ("replacementOfferingId") REFERENCES "SubjectOffering"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE DEFERRABLE INITIALLY DEFERRED,
  ADD CONSTRAINT "CurriculumCorrection_effectiveAcademicTermId_academicYearId_fkey"
  FOREIGN KEY ("effectiveAcademicTermId", "academicYearId")
  REFERENCES "AcademicTerm"("id", "academicYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "CurriculumCorrection_correctedById_fkey"
  FOREIGN KEY ("correctedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "CurriculumCorrection_context_id"() RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('nemesys.curriculum_correction_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "CurriculumCorrection_enforce_intent"() RETURNS TRIGGER AS $$
DECLARE
  source_year_id TEXT;
  source_deleted_at TIMESTAMP(3);
  actual_participation_count INTEGER;
  actual_finalized BOOLEAN;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Curriculum correction records are immutable';
  END IF;

  IF "CurriculumCorrection_context_id"() IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'Curriculum correction requires its dedicated transaction context';
  END IF;

  SELECT offering."academicYearId", offering."deletedAt",
    EXISTS (
      SELECT 1 FROM "CurriculumFinalization" finalization
      WHERE finalization."academicYearId" = offering."academicYearId"
    ),
    (SELECT COUNT(*)::INTEGER FROM "StudentSubjectEnrollment" participation
      WHERE participation."subjectOfferingId" = offering."id")
  INTO source_year_id, source_deleted_at, actual_finalized, actual_participation_count
  FROM "SubjectOffering" offering
  WHERE offering."id" = NEW."sourceOfferingId";

  IF source_year_id IS NULL OR source_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Curriculum correction source Offering must be active';
  END IF;
  IF source_year_id IS DISTINCT FROM NEW."academicYearId" THEN
    RAISE EXCEPTION 'Curriculum correction must remain in the source Academic Year';
  END IF;
  IF NEW."sourceWasFinalized" IS DISTINCT FROM actual_finalized
    OR NEW."sourceParticipationCount" IS DISTINCT FROM actual_participation_count THEN
    RAISE EXCEPTION 'Curriculum correction source facts changed';
  END IF;
  IF NOT actual_finalized AND actual_participation_count = 0 THEN
    RAISE EXCEPTION 'Unlocked Curriculum must use the ordinary configuration workflow';
  END IF;
  IF EXISTS (SELECT 1 FROM "SubjectOffering" WHERE "id" = NEW."replacementOfferingId") THEN
    RAISE EXCEPTION 'Curriculum correction replacement identity must be new';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CurriculumCorrection_enforce_intent_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "CurriculumCorrection"
  FOR EACH ROW EXECUTE FUNCTION "CurriculumCorrection_enforce_intent"();

CREATE FUNCTION "CurriculumCorrection_validate_completion"() RETURNS TRIGGER AS $$
DECLARE
  source_year_id TEXT;
  source_deleted_at TIMESTAMP(3);
  replacement_year_id TEXT;
  replacement_deleted_at TIMESTAMP(3);
  replacement_source_id TEXT;
  replacement_grade TEXT;
  replacement_status "ShsCurriculumStatus";
BEGIN
  SELECT "academicYearId", "deletedAt"
  INTO source_year_id, source_deleted_at
  FROM "SubjectOffering" WHERE "id" = NEW."sourceOfferingId";

  SELECT offering."academicYearId", offering."deletedAt",
    offering."replacesSubjectOfferingId", offering."gradeLevel", context."curriculumStatus"
  INTO replacement_year_id, replacement_deleted_at,
    replacement_source_id, replacement_grade, replacement_status
  FROM "SubjectOffering" offering
  LEFT JOIN "SubjectOfferingShsContext" context
    ON context."subjectOfferingId" = offering."id"
  WHERE offering."id" = NEW."replacementOfferingId";

  IF source_deleted_at IS NULL
    OR replacement_year_id IS NULL
    OR replacement_deleted_at IS NOT NULL
    OR source_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_source_id IS DISTINCT FROM NEW."sourceOfferingId" THEN
    RAISE EXCEPTION 'Curriculum correction did not complete its exact archive-and-replace lineage';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM "SubjectOfferingTerm"
    WHERE "subjectOfferingId" = NEW."replacementOfferingId"
      AND "academicTermId" = NEW."effectiveAcademicTermId"
  ) THEN
    RAISE EXCEPTION 'Curriculum correction replacement must include its effective Academic Term';
  END IF;

  IF replacement_grade IN ('11', '12') AND replacement_status IS DISTINCT FROM 'SCHOOL_APPROVED' THEN
    RAISE EXCEPTION 'SHS Curriculum correction replacement must be atomically school approved';
  END IF;
  IF replacement_grade NOT IN ('11', '12') AND replacement_status IS NOT NULL THEN
    RAISE EXCEPTION 'JHS Curriculum correction replacement cannot have SHS context';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "CurriculumCorrection_validate_completion_trigger"
  AFTER INSERT ON "CurriculumCorrection"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "CurriculumCorrection_validate_completion"();

CREATE OR REPLACE FUNCTION "SubjectOffering_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  source_academic_year_id TEXT;
  target_offering_id TEXT;
  correction_id TEXT;
  authorized_source_archive BOOLEAN := false;
  authorized_successor_create BOOLEAN := false;
  correction_linked BOOLEAN := false;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."academicYearId" ELSE OLD."academicYearId" END;
  target_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."id" ELSE OLD."id" END;
  correction_id := "CurriculumCorrection_context_id"();

  PERFORM 1 FROM "AcademicYear"
  WHERE "id" IN (source_academic_year_id, target_academic_year_id)
  ORDER BY "id" FOR SHARE;

  IF TG_OP = 'INSERT' AND NEW."replacesSubjectOfferingId" IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM "CurriculumCorrection" correction
      WHERE correction."id" = correction_id
        AND correction."academicYearId" = NEW."academicYearId"
        AND correction."sourceOfferingId" = NEW."replacesSubjectOfferingId"
        AND correction."replacementOfferingId" = NEW."id"
    ) INTO authorized_successor_create;
    IF NOT authorized_successor_create THEN
      RAISE EXCEPTION 'Replacement Offering creation requires its dedicated correction transaction';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW."replacesSubjectOfferingId" IS DISTINCT FROM OLD."replacesSubjectOfferingId" THEN
      RAISE EXCEPTION 'Curriculum replacement lineage is immutable';
    END IF;

    SELECT EXISTS (
      SELECT 1 FROM "CurriculumCorrection" correction
      WHERE correction."id" = correction_id
        AND correction."sourceOfferingId" = OLD."id"
        AND correction."academicYearId" = OLD."academicYearId"
    ) AND OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL
      AND NEW."subjectId" IS NOT DISTINCT FROM OLD."subjectId"
      AND NEW."academicYearId" IS NOT DISTINCT FROM OLD."academicYearId"
      AND NEW."gradeLevel" IS NOT DISTINCT FROM OLD."gradeLevel"
      AND NEW."subjectCode" IS NOT DISTINCT FROM OLD."subjectCode"
      AND NEW."subjectDescription" IS NOT DISTINCT FROM OLD."subjectDescription"
      AND NEW."createdById" IS NOT DISTINCT FROM OLD."createdById"
      AND NEW."createdAt" IS NOT DISTINCT FROM OLD."createdAt"
    INTO authorized_source_archive;
  END IF;

  IF TG_OP <> 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM "CurriculumCorrection" correction
      WHERE correction."sourceOfferingId" = OLD."id"
        OR correction."replacementOfferingId" = OLD."id"
    ) INTO correction_linked;
    IF correction_linked AND NOT authorized_source_archive THEN
      RAISE EXCEPTION 'Correction-linked Curriculum Offerings are immutable';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" IN (source_academic_year_id, target_academic_year_id)
  ) AND NOT authorized_source_archive AND NOT authorized_successor_create THEN
    RAISE EXCEPTION 'Finalized Curriculum cannot be changed';
  END IF;

  IF TG_OP = 'UPDATE'
    AND EXISTS (SELECT 1 FROM "StudentSubjectEnrollment" WHERE "subjectOfferingId" = target_offering_id)
    AND NOT authorized_source_archive
    AND (
      NEW."subjectId" IS DISTINCT FROM OLD."subjectId"
      OR NEW."academicYearId" IS DISTINCT FROM OLD."academicYearId"
      OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
      OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
      OR NEW."subjectDescription" IS DISTINCT FROM OLD."subjectDescription"
    ) THEN
    RAISE EXCEPTION 'Curriculum used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "SubjectOfferingTerm_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  source_offering_id TEXT;
  target_offering_id TEXT;
  authorized_successor_child BOOLEAN := false;
  correction_linked BOOLEAN := false;
BEGIN
  source_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."subjectOfferingId" ELSE OLD."subjectOfferingId" END;
  target_offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  PERFORM 1
  FROM "AcademicYear" academic_year
  WHERE academic_year."id" IN (
    SELECT offering."academicYearId" FROM "SubjectOffering" offering
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  )
  ORDER BY academic_year."id" FOR SHARE;

  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" IN (source_offering_id, target_offering_id)
  ORDER BY "id" FOR UPDATE;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM "CurriculumCorrection" correction
      WHERE correction."id" = "CurriculumCorrection_context_id"()
        AND correction."replacementOfferingId" = target_offering_id
    ) INTO authorized_successor_child;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "CurriculumCorrection" correction
    WHERE correction."sourceOfferingId" IN (source_offering_id, target_offering_id)
      OR correction."replacementOfferingId" IN (source_offering_id, target_offering_id)
  ) INTO correction_linked;
  IF correction_linked AND NOT authorized_successor_child THEN
    RAISE EXCEPTION 'Correction-linked Curriculum Term applicability is immutable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = offering."academicYearId"
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  ) AND NOT authorized_successor_child THEN
    RAISE EXCEPTION 'Finalized Curriculum Term applicability cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'Curriculum Term applicability used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "SubjectOfferingShsContext_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  source_offering_id TEXT;
  target_offering_id TEXT;
  authorized_successor_child BOOLEAN := false;
  correction_linked BOOLEAN := false;
BEGIN
  source_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."subjectOfferingId" ELSE OLD."subjectOfferingId" END;
  target_offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  PERFORM 1
  FROM "AcademicYear" academic_year
  WHERE academic_year."id" IN (
    SELECT offering."academicYearId" FROM "SubjectOffering" offering
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  )
  ORDER BY academic_year."id" FOR SHARE;

  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" IN (source_offering_id, target_offering_id)
  ORDER BY "id" FOR UPDATE;

  IF TG_OP = 'INSERT' THEN
    SELECT EXISTS (
      SELECT 1 FROM "CurriculumCorrection" correction
      WHERE correction."id" = "CurriculumCorrection_context_id"()
        AND correction."replacementOfferingId" = target_offering_id
    ) INTO authorized_successor_child;
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "CurriculumCorrection" correction
    WHERE correction."sourceOfferingId" IN (source_offering_id, target_offering_id)
      OR correction."replacementOfferingId" IN (source_offering_id, target_offering_id)
  ) INTO correction_linked;
  IF correction_linked AND NOT authorized_successor_child THEN
    RAISE EXCEPTION 'Correction-linked SHS Curriculum context is immutable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = offering."academicYearId"
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  ) AND NOT authorized_successor_child THEN
    RAISE EXCEPTION 'Finalized SHS Curriculum context cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'SHS Curriculum context used by student participation cannot be changed';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."curriculumStatus" = 'SCHOOL_APPROVED' AND (
      NEW."curriculumStatus" IS DISTINCT FROM OLD."curriculumStatus"
      OR NEW."approvalReference" IS DISTINCT FROM OLD."approvalReference"
      OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
      OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    ) THEN
      RAISE EXCEPTION 'School-approved SHS Curriculum approval is immutable';
    END IF;

    IF NEW."curriculumStatus" IS DISTINCT FROM OLD."curriculumStatus" THEN
      IF OLD."curriculumStatus" <> 'PROVISIONAL_DEPED'
        OR NEW."curriculumStatus" <> 'SCHOOL_APPROVED' THEN
        RAISE EXCEPTION 'SHS Curriculum approval may only transition from pending to school approved';
      END IF;
      IF NEW."classification" IS DISTINCT FROM OLD."classification"
        OR NEW."clusterId" IS DISTINCT FROM OLD."clusterId"
        OR NEW."sourceReference" IS DISTINCT FROM OLD."sourceReference" THEN
        RAISE EXCEPTION 'SHS Curriculum context cannot change during approval';
      END IF;
    ELSIF OLD."curriculumStatus" = 'PROVISIONAL_DEPED' AND (
      NEW."approvalReference" IS DISTINCT FROM OLD."approvalReference"
      OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
      OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    ) THEN
      RAISE EXCEPTION 'SHS approval facts require school approval transition';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

COMMIT;
