BEGIN;

CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE TABLE "AcademicTerm" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  "startDate" DATE NOT NULL,
  "endDate" DATE NOT NULL,
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AcademicTerm_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "AcademicTerm_chronological_dates_check" CHECK ("startDate" < "endDate"),
  CONSTRAINT "AcademicTerm_position_positive_check" CHECK ("position" > 0)
);

CREATE UNIQUE INDEX "AcademicTerm_academicYearId_position_key"
  ON "AcademicTerm"("academicYearId", "position");
CREATE UNIQUE INDEX "AcademicTerm_academicYearId_normalized_name_key"
  ON "AcademicTerm"("academicYearId", lower(btrim("name")));
CREATE INDEX "AcademicTerm_academicYearId_idx" ON "AcademicTerm"("academicYearId");
CREATE INDEX "AcademicTerm_createdById_idx" ON "AcademicTerm"("createdById");

ALTER TABLE "AcademicTerm"
  ADD CONSTRAINT "AcademicTerm_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm"
  ADD CONSTRAINT "AcademicTerm_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AcademicTerm"
  ADD CONSTRAINT "AcademicTerm_non_overlapping_dates_excl"
  EXCLUDE USING GIST (
    "academicYearId" WITH =,
    daterange("startDate", "endDate", '[]') WITH &&
  );

CREATE FUNCTION "AcademicTerm_assert_within_academic_year"()
RETURNS TRIGGER AS $$
DECLARE
  academic_year_start DATE;
  academic_year_end DATE;
BEGIN
  SELECT "startDate", "endDate"
  INTO academic_year_start, academic_year_end
  FROM "AcademicYear"
  WHERE "id" = NEW."academicYearId"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Academic Term academic year does not exist';
  END IF;

  IF NEW."startDate" < academic_year_start OR NEW."endDate" > academic_year_end THEN
    RAISE EXCEPTION 'Academic Term dates must fall within the Academic Year dates';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AcademicTerm_assert_within_academic_year_trigger"
BEFORE INSERT OR UPDATE OF "academicYearId", "startDate", "endDate" ON "AcademicTerm"
FOR EACH ROW EXECUTE FUNCTION "AcademicTerm_assert_within_academic_year"();

CREATE FUNCTION "AcademicYear_assert_contains_terms"()
RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "AcademicTerm"
    WHERE "academicYearId" = NEW."id"
      AND ("startDate" < NEW."startDate" OR "endDate" > NEW."endDate")
  ) THEN
    RAISE EXCEPTION 'Academic Year dates cannot exclude existing Academic Terms';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "AcademicYear_assert_contains_terms_trigger"
BEFORE UPDATE OF "startDate", "endDate" ON "AcademicYear"
FOR EACH ROW EXECUTE FUNCTION "AcademicYear_assert_contains_terms"();

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "AcademicYear"
    WHERE "id" = 'academic-year-2026-2027'
      AND "label" = '2026-2027'
      AND "startDate" = DATE '2026-06-08'
      AND "endDate" = DATE '2027-04-08'
  ) THEN
    RAISE EXCEPTION 'Phase 18C migration aborted: approved 2026-2027 Academic Year is missing or has unexpected dates';
  END IF;
END $$;

INSERT INTO "AcademicTerm" (
  "id", "academicYearId", "name", "position", "startDate", "endDate", "createdAt", "updatedAt"
) VALUES
  ('academic-term-2026-2027-1', 'academic-year-2026-2027', 'Term 1', 1, DATE '2026-06-08', DATE '2026-09-15', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('academic-term-2026-2027-2', 'academic-year-2026-2027', 'Term 2', 2, DATE '2026-09-16', DATE '2026-12-18', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('academic-term-2026-2027-3', 'academic-year-2026-2027', 'Term 3', 3, DATE '2027-01-04', DATE '2027-04-08', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);

COMMIT;
