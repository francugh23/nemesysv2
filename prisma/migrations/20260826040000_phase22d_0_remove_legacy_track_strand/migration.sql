-- Phase 22D-0 removes the legacy free-text track/strand identity. SHS authority
-- remains on Enrollment and SubjectOfferingShsContext; no legacy value is mapped.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Section" WHERE "trackStrand" IS NOT NULL)
     OR EXISTS (SELECT 1 FROM "Subject" WHERE "trackStrand" IS NOT NULL) THEN
    RAISE EXCEPTION 'Phase 22D-0 requires an approved retention decision for non-null legacy trackStrand data.';
  END IF;
  IF EXISTS (SELECT 1 FROM "Section" WHERE "deletedAt" IS NULL GROUP BY BTRIM("gradeLevel"), UPPER(BTRIM("sectionName")) HAVING COUNT(*) > 1)
     OR EXISTS (SELECT 1 FROM "Subject" WHERE "deletedAt" IS NULL GROUP BY UPPER(BTRIM("code")), BTRIM("gradeLevel") HAVING COUNT(*) > 1) THEN
    RAISE EXCEPTION 'Phase 22D-0 is blocked by post-removal normalized identity collisions.';
  END IF;
END $$;

-- Preserve all established trigger behavior while omitting the retired key from
-- newly created correction snapshots. Existing JSON evidence is never updated.
DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'StudentEnrollmentCorrection_assert_intent';
  definition := replace(definition, 'SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"', 'SELECT "id", "gradeLevel", "sectionName", "deletedAt"');
  definition := replace(definition, E'    ''trackStrand'', source_section."trackStrand",\n', '');
  definition := replace(definition, E'    ''trackStrand'', destination_section."trackStrand",\n', '');
  IF position('trackStrand' IN definition) > 0 THEN RAISE EXCEPTION 'Could not safely rewrite StudentEnrollmentCorrection_assert_intent'; END IF;
  EXECUTE definition;
END $$;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'StudentEnrollmentGradeCorrection_placement_snapshot';
  definition := replace(definition, E'    ''trackStrand'', section."trackStrand",\n', '');
  IF position('trackStrand' IN definition) > 0 THEN RAISE EXCEPTION 'Could not safely rewrite StudentEnrollmentGradeCorrection_placement_snapshot'; END IF;
  EXECUTE definition;
END $$;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'StudentEnrollmentGradeCorrection_assert_intent';
  definition := replace(definition, 'SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"', 'SELECT "id", "gradeLevel", "sectionName", "deletedAt"');
  definition := replace(definition, '    OR source_section."trackStrand" IS NOT NULL', '');
  definition := replace(definition, '    OR destination_section."trackStrand" IS NOT NULL', '');
  definition := replace(definition, '        OR subject."trackStrand" IS NOT NULL', '');
  definition := replace(definition, 'requires distinct active regular JHS grades and null Track / Strand', 'requires distinct active regular JHS grades');
  IF position('trackStrand' IN definition) > 0 THEN RAISE EXCEPTION 'Could not safely rewrite StudentEnrollmentGradeCorrection_assert_intent'; END IF;
  EXECUTE definition;
END $$;

DO $$
DECLARE definition TEXT;
BEGIN
  SELECT pg_get_functiondef(p.oid) INTO definition FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.proname = 'StudentEnrollmentGradeCorrection_validate_completion';
  definition := regexp_replace(definition, E'\\n\\s+source_section\."trackStrand" AS "sourceTrackStrand",', '', 'g');
  definition := regexp_replace(definition, E'\\n\\s+destination_section\."trackStrand" AS "destinationTrackStrand",', '', 'g');
  definition := regexp_replace(definition, E'\\n\\s+OR correction_record\."sourceTrackStrand" IS NOT NULL', '', 'g');
  definition := regexp_replace(definition, E'\\n\\s+OR correction_record\."destinationTrackStrand" IS NOT NULL', '', 'g');
  definition := regexp_replace(definition, E'\\n\\s+OR subject\."trackStrand" IS NOT NULL', '', 'g');
  IF position('trackStrand' IN definition) > 0 THEN RAISE EXCEPTION 'Could not safely rewrite StudentEnrollmentGradeCorrection_validate_completion'; END IF;
  EXECUTE definition;
END $$;

DROP INDEX "Section_active_identity_key";
DROP INDEX "Subject_active_identity_key";

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_depend d JOIN pg_attribute a ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
    WHERE a.attrelid IN ('"Section"'::regclass, '"Subject"'::regclass) AND a.attname = 'trackStrand'
  ) THEN
    RAISE EXCEPTION 'Phase 22D-0 found dependent database objects after function/index replacement.';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_views WHERE schemaname = 'public' AND definition ILIKE '%trackStrand%')
     OR EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace WHERE n.nspname = 'public' AND p.prokind = 'f' AND pg_get_functiondef(p.oid) ILIKE '%trackStrand%') THEN
    RAISE EXCEPTION 'Phase 22D-0 found dependent database source after function/index replacement.';
  END IF;
END $$;

ALTER TABLE "Section" DROP COLUMN "trackStrand" RESTRICT;
ALTER TABLE "Subject" DROP COLUMN "trackStrand" RESTRICT;

CREATE UNIQUE INDEX "Section_active_identity_key"
ON "Section" (BTRIM("gradeLevel"), UPPER(BTRIM("sectionName")))
WHERE "deletedAt" IS NULL;

CREATE UNIQUE INDEX "Subject_active_identity_key"
ON "Subject" (UPPER(BTRIM("code")), BTRIM("gradeLevel"))
WHERE "deletedAt" IS NULL;
