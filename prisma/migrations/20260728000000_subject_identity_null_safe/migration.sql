-- Normalize and enforce Subject identity for active JHS and SHS catalog records.
-- This migration intentionally aborts before changing data when manual cleanup is required.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Subject"
    WHERE "deletedAt" IS NULL
      AND (
        BTRIM("code") = ''
        OR UPPER(BTRIM("gradeLevel")) NOT IN (
          '7', '8', '9', '10', '11', '12',
          'GRADE 7', 'GRADE 8', 'GRADE 9',
          'GRADE 10', 'GRADE 11', 'GRADE 12'
        )
      )
  ) THEN
    RAISE EXCEPTION 'Subject identity migration blocked: active records have blank codes or unsupported grade levels.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        UPPER(BTRIM("code")) AS "normalizedCode",
        CASE UPPER(BTRIM("gradeLevel"))
          WHEN 'GRADE 7' THEN '7'
          WHEN 'GRADE 8' THEN '8'
          WHEN 'GRADE 9' THEN '9'
          WHEN 'GRADE 10' THEN '10'
          WHEN 'GRADE 11' THEN '11'
          WHEN 'GRADE 12' THEN '12'
          ELSE BTRIM("gradeLevel")
        END AS "normalizedGradeLevel",
        COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '') AS "normalizedTrackStrand"
      FROM "Subject"
      WHERE "deletedAt" IS NULL
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    ) AS "duplicates"
  ) THEN
    RAISE EXCEPTION 'Subject identity migration blocked: active duplicate normalized identities require manual cleanup.';
  END IF;
END $$;

UPDATE "Subject"
SET
  "code" = UPPER(BTRIM("code")),
  "gradeLevel" = CASE UPPER(BTRIM("gradeLevel"))
    WHEN 'GRADE 7' THEN '7'
    WHEN 'GRADE 8' THEN '8'
    WHEN 'GRADE 9' THEN '9'
    WHEN 'GRADE 10' THEN '10'
    WHEN 'GRADE 11' THEN '11'
    WHEN 'GRADE 12' THEN '12'
    ELSE BTRIM("gradeLevel")
  END,
  "trackStrand" = NULLIF(UPPER(BTRIM("trackStrand")), '');

DROP INDEX "Subject_code_gradeLevel_trackStrand_key";

CREATE UNIQUE INDEX "Subject_active_identity_key"
ON "Subject" (
  UPPER(BTRIM("code")),
  BTRIM("gradeLevel"),
  COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '')
)
WHERE "deletedAt" IS NULL;
