BEGIN;

-- Stop before schema changes if any legacy value is not the approved exact mapping.
DO $$
DECLARE
  unexpected_values TEXT;
  enrollment_collisions INTEGER;
  assignment_collisions INTEGER;
BEGIN
  SELECT string_agg(quote_literal(value), ', ' ORDER BY value)
  INTO unexpected_values
  FROM (
    SELECT DISTINCT "academicYear" AS value FROM "Enrollment"
    UNION
    SELECT DISTINCT "academicYear" AS value FROM "SubjectAssignment"
  ) legacy_values
  WHERE value <> '2026-2027';

  IF unexpected_values IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 18B migration aborted: unexpected or ambiguous academic-year values: %', unexpected_values;
  END IF;

  SELECT count(*)
  INTO enrollment_collisions
  FROM (
    SELECT "studentId"
    FROM "Enrollment"
    WHERE "academicYear" = '2026-2027'
    GROUP BY "studentId"
    HAVING count(*) > 1
  ) collisions;

  IF enrollment_collisions > 0 THEN
    RAISE EXCEPTION 'Phase 18B migration aborted: % Enrollment identities would collide', enrollment_collisions;
  END IF;

  SELECT count(*)
  INTO assignment_collisions
  FROM (
    SELECT "subjectId", "teacherId", "sectionId"
    FROM "SubjectAssignment"
    WHERE "academicYear" = '2026-2027'
    GROUP BY "subjectId", "teacherId", "sectionId"
    HAVING count(*) > 1
  ) collisions;

  IF assignment_collisions > 0 THEN
    RAISE EXCEPTION 'Phase 18B migration aborted: % Subject Assignment identities would collide', assignment_collisions;
  END IF;
END $$;

CREATE TYPE "AcademicYearStatus" AS ENUM ('DRAFT', 'ACTIVE', 'LOCKED', 'ARCHIVED');

CREATE TABLE "AcademicYear" (
  "id" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "status" "AcademicYearStatus" NOT NULL DEFAULT 'DRAFT',
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AcademicYear_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicYear_chronological_dates_check" CHECK ("startDate" < "endDate"),
  CONSTRAINT "AcademicYear_canonical_label_check" CHECK (
    CASE
      WHEN "label" ~ '^[0-9]{4}-[0-9]{4}$'
      THEN CAST(substring("label" FROM 6 FOR 4) AS INTEGER) = CAST(substring("label" FROM 1 FOR 4) AS INTEGER) + 1
        AND "label" = to_char("startDate", 'YYYY') || '-' || to_char("endDate", 'YYYY')
      ELSE FALSE
    END
  )
);

CREATE UNIQUE INDEX "AcademicYear_label_key" ON "AcademicYear"("label");
CREATE INDEX "AcademicYear_status_idx" ON "AcademicYear"("status");
CREATE INDEX "AcademicYear_startDate_idx" ON "AcademicYear"("startDate");
CREATE INDEX "AcademicYear_createdById_idx" ON "AcademicYear"("createdById");
CREATE UNIQUE INDEX "AcademicYear_single_active_key" ON "AcademicYear"("status") WHERE "status" = 'ACTIVE';

ALTER TABLE "AcademicYear"
  ADD CONSTRAINT "AcademicYear_non_overlapping_dates_excl"
  EXCLUDE USING GIST (daterange("startDate", "endDate", '[]') WITH &&);

ALTER TABLE "AcademicYear"
  ADD CONSTRAINT "AcademicYear_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "AcademicYear" (
  "id",
  "label",
  "startDate",
  "endDate",
  "status",
  "createdById",
  "createdAt",
  "updatedAt"
)
SELECT
  'academic-year-2026-2027',
  '2026-2027',
  DATE '2026-06-08',
  DATE '2027-04-08',
  'ACTIVE',
  NULL,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE EXISTS (
  SELECT 1 FROM "Enrollment" WHERE "academicYear" = '2026-2027'
  UNION ALL
  SELECT 1 FROM "SubjectAssignment" WHERE "academicYear" = '2026-2027'
);

ALTER TABLE "Enrollment" ADD COLUMN "academicYearId" TEXT;
ALTER TABLE "SubjectAssignment" ADD COLUMN "academicYearId" TEXT;

UPDATE "Enrollment"
SET "academicYearId" = 'academic-year-2026-2027'
WHERE "academicYear" = '2026-2027';

UPDATE "SubjectAssignment"
SET "academicYearId" = 'academic-year-2026-2027'
WHERE "academicYear" = '2026-2027';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "Enrollment" WHERE "academicYearId" IS NULL) THEN
    RAISE EXCEPTION 'Phase 18B migration aborted: an Enrollment row was not mapped';
  END IF;

  IF EXISTS (SELECT 1 FROM "SubjectAssignment" WHERE "academicYearId" IS NULL) THEN
    RAISE EXCEPTION 'Phase 18B migration aborted: a Subject Assignment row was not mapped';
  END IF;
END $$;

DROP INDEX "Enrollment_academicYear_idx";
DROP INDEX "Enrollment_studentId_academicYear_key";
DROP INDEX "SubjectAssignment_academicYear_idx";
DROP INDEX "SubjectAssignment_subjectId_teacherId_sectionId_academicYea_key";

ALTER TABLE "Enrollment" ALTER COLUMN "academicYearId" SET NOT NULL;
ALTER TABLE "SubjectAssignment" ALTER COLUMN "academicYearId" SET NOT NULL;

CREATE INDEX "Enrollment_academicYearId_idx" ON "Enrollment"("academicYearId");
CREATE UNIQUE INDEX "Enrollment_studentId_academicYearId_key" ON "Enrollment"("studentId", "academicYearId");
CREATE INDEX "SubjectAssignment_academicYearId_idx" ON "SubjectAssignment"("academicYearId");
CREATE UNIQUE INDEX "SubjectAssignment_subjectId_teacherId_sectionId_academicYearId_key"
  ON "SubjectAssignment"("subjectId", "teacherId", "sectionId", "academicYearId");

ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectAssignment"
  ADD CONSTRAINT "SubjectAssignment_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Enrollment" DROP COLUMN "academicYear";
ALTER TABLE "SubjectAssignment" DROP COLUMN "academicYear";

COMMIT;
