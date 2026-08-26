BEGIN;

-- No safe reusable-Subject-to-Offering backfill exists. Stop before altering
-- identity if this deployment contains any legacy assignment rows.
DO $$
DECLARE
  assignment_count INTEGER;
  unexpected_constraints TEXT;
  unexpected_indexes TEXT;
  unexpected_triggers TEXT;
  dependent_functions TEXT;
BEGIN
  SELECT count(*) INTO assignment_count FROM "SubjectAssignment";
  IF assignment_count <> 0 THEN
    RAISE EXCEPTION 'Phase 23A migration aborted: expected zero SubjectAssignment rows, found %', assignment_count;
  END IF;

  SELECT string_agg(conname, ', ' ORDER BY conname)
  INTO unexpected_constraints
  FROM pg_constraint
  WHERE conrelid = '"SubjectAssignment"'::regclass
    AND conname NOT IN (
      'SubjectAssignment_pkey',
      'SubjectAssignment_subjectId_fkey',
      'SubjectAssignment_teacherId_fkey',
      'SubjectAssignment_sectionId_fkey',
      'SubjectAssignment_academicYearId_fkey'
    );
  IF unexpected_constraints IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 23A migration aborted: unexpected SubjectAssignment constraints: %', unexpected_constraints;
  END IF;

  SELECT string_agg(indexname, ', ' ORDER BY indexname)
  INTO unexpected_indexes
  FROM pg_indexes
  WHERE schemaname = current_schema()
    AND tablename = 'SubjectAssignment'
    AND indexname NOT IN (
      'SubjectAssignment_pkey',
      'SubjectAssignment_academicYearId_idx',
      'SubjectAssignment_subjectId_teacherId_sectionId_academicYea_key'
    );
  IF unexpected_indexes IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 23A migration aborted: unexpected SubjectAssignment indexes: %', unexpected_indexes;
  END IF;

  SELECT string_agg(tgname, ', ' ORDER BY tgname)
  INTO unexpected_triggers
  FROM pg_trigger
  WHERE tgrelid = '"SubjectAssignment"'::regclass
    AND NOT tgisinternal;
  IF unexpected_triggers IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 23A migration aborted: unexpected SubjectAssignment triggers: %', unexpected_triggers;
  END IF;

  SELECT string_agg(proc.proname, ', ' ORDER BY proc.proname)
  INTO dependent_functions
  FROM pg_depend dependency
  JOIN pg_proc proc ON proc.oid = dependency.objid
  WHERE dependency.refobjid = '"SubjectAssignment"'::regclass
    AND dependency.classid = 'pg_proc'::regclass;
  IF dependent_functions IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 23A migration aborted: dependent functions require review: %', dependent_functions;
  END IF;
END $$;

ALTER TABLE "SubjectAssignment"
  ADD COLUMN "subjectOfferingId" TEXT,
  ADD COLUMN "academicTermId" TEXT;

ALTER TABLE "SubjectAssignment"
  ADD CONSTRAINT "SubjectAssignment_subjectOfferingId_academicTermId_fkey"
  FOREIGN KEY ("subjectOfferingId", "academicTermId")
  REFERENCES "SubjectOfferingTerm"("subjectOfferingId", "academicTermId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP INDEX "SubjectAssignment_academicYearId_idx";
DROP INDEX "SubjectAssignment_subjectId_teacherId_sectionId_academicYea_key";

ALTER TABLE "SubjectAssignment"
  DROP CONSTRAINT "SubjectAssignment_subjectId_fkey",
  DROP CONSTRAINT "SubjectAssignment_academicYearId_fkey",
  DROP COLUMN "subjectId",
  DROP COLUMN "academicYearId",
  ALTER COLUMN "subjectOfferingId" SET NOT NULL,
  ALTER COLUMN "academicTermId" SET NOT NULL;

CREATE INDEX "SubjectAssignment_subjectOfferingId_academicTermId_idx"
  ON "SubjectAssignment"("subjectOfferingId", "academicTermId");
CREATE INDEX "SubjectAssignment_teacherId_idx" ON "SubjectAssignment"("teacherId");
CREATE INDEX "SubjectAssignment_sectionId_idx" ON "SubjectAssignment"("sectionId");
CREATE UNIQUE INDEX "SubjectAssignment_active_slot_key"
  ON "SubjectAssignment"("subjectOfferingId", "academicTermId", "sectionId")
  WHERE "deletedAt" IS NULL;

COMMIT;
