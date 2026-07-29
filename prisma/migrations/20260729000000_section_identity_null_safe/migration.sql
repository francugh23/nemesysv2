-- Normalize and enforce Section identity for active JHS and SHS records.
-- This migration intentionally aborts before changing data when manual cleanup is required.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "Section"
    WHERE "deletedAt" IS NULL
      AND (
        BTRIM("sectionName") = ''
        OR UPPER(BTRIM("gradeLevel")) NOT IN (
          '7', '8', '9', '10', '11', '12',
          'GRADE 7', 'GRADE 8', 'GRADE 9',
          'GRADE 10', 'GRADE 11', 'GRADE 12'
        )
        OR (
          UPPER(BTRIM("gradeLevel")) IN (
            '7', '8', '9', '10',
            'GRADE 7', 'GRADE 8', 'GRADE 9', 'GRADE 10'
          )
          AND NULLIF(BTRIM("trackStrand"), '') IS NOT NULL
        )
      )
  ) THEN
    RAISE EXCEPTION 'Section identity migration blocked: active records have blank names, unsupported grade levels, or JHS track/strand values.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM (
      SELECT
        CASE UPPER(BTRIM("gradeLevel"))
          WHEN 'GRADE 7' THEN '7'
          WHEN 'GRADE 8' THEN '8'
          WHEN 'GRADE 9' THEN '9'
          WHEN 'GRADE 10' THEN '10'
          WHEN 'GRADE 11' THEN '11'
          WHEN 'GRADE 12' THEN '12'
          ELSE BTRIM("gradeLevel")
        END AS "normalizedGradeLevel",
        COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), '') AS "normalizedTrackStrand",
        UPPER(BTRIM("sectionName")) AS "normalizedSectionName"
      FROM "Section"
      WHERE "deletedAt" IS NULL
      GROUP BY 1, 2, 3
      HAVING COUNT(*) > 1
    ) AS "duplicates"
  ) THEN
    RAISE EXCEPTION 'Section identity migration blocked: active duplicate normalized identities require manual cleanup.';
  END IF;
END $$;

UPDATE "Section"
SET
  "gradeLevel" = CASE UPPER(BTRIM("gradeLevel"))
    WHEN 'GRADE 7' THEN '7'
    WHEN 'GRADE 8' THEN '8'
    WHEN 'GRADE 9' THEN '9'
    WHEN 'GRADE 10' THEN '10'
    WHEN 'GRADE 11' THEN '11'
    WHEN 'GRADE 12' THEN '12'
    ELSE BTRIM("gradeLevel")
  END,
  "trackStrand" = NULLIF(UPPER(BTRIM("trackStrand")), ''),
  "sectionName" = BTRIM("sectionName");

CREATE UNIQUE INDEX "Section_active_identity_key"
ON "Section" (
  BTRIM("gradeLevel"),
  COALESCE(NULLIF(UPPER(BTRIM("trackStrand")), ''), ''),
  UPPER(BTRIM("sectionName"))
)
WHERE "deletedAt" IS NULL;
