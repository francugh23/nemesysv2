BEGIN;

CREATE TYPE "EnrollmentShsTrack" AS ENUM ('ACADEMIC', 'TECHPRO');

ALTER TABLE "Enrollment"
  ADD COLUMN "shsTrack" "EnrollmentShsTrack",
  ADD COLUMN "entryAcademicTermId" TEXT;

ALTER TABLE "AcademicTerm"
  ADD CONSTRAINT "AcademicTerm_id_academicYearId_key"
  UNIQUE ("id", "academicYearId");

CREATE INDEX "Enrollment_entryAcademicTermId_idx"
  ON "Enrollment"("entryAcademicTermId");

ALTER TABLE "Enrollment"
  ADD CONSTRAINT "Enrollment_entryAcademicTermId_academicYearId_fkey"
  FOREIGN KEY ("entryAcademicTermId", "academicYearId")
  REFERENCES "AcademicTerm"("id", "academicYearId")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "Enrollment_assert_entry_facts"() RETURNS TRIGGER AS $$
DECLARE
  section_grade_level TEXT;
BEGIN
  SELECT "gradeLevel"
  INTO section_grade_level
  FROM "Section"
  WHERE "id" = NEW."sectionId"
  FOR KEY SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment Section does not exist';
  END IF;

  IF TG_OP = 'INSERT' AND section_grade_level IN ('11', '12')
    AND (NEW."entryAcademicTermId" IS NULL OR NEW."shsTrack" IS NULL) THEN
    RAISE EXCEPTION 'Grade 11 or 12 Enrollment requires an entry Academic Term and SHS Track';
  END IF;

  IF section_grade_level NOT IN ('11', '12')
    AND (NEW."entryAcademicTermId" IS NOT NULL OR NEW."shsTrack" IS NOT NULL) THEN
    RAISE EXCEPTION 'JHS Enrollment cannot have an entry Academic Term or SHS Track';
  END IF;

  -- Populated entry facts identify records created or explicitly reviewed
  -- under this foundation and must remain compatible with placement grade.
  IF section_grade_level IN ('11', '12')
    AND ((NEW."entryAcademicTermId" IS NULL) <> (NEW."shsTrack" IS NULL)) THEN
    RAISE EXCEPTION 'SHS Enrollment entry Academic Term and Track must be populated together';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."entryAcademicTermId" IS NOT NULL
      AND NEW."entryAcademicTermId" IS DISTINCT FROM OLD."entryAcademicTermId" THEN
      RAISE EXCEPTION 'Enrollment entry Academic Term is immutable once populated';
    END IF;

    IF OLD."shsTrack" IS NOT NULL
      AND NEW."shsTrack" IS DISTINCT FROM OLD."shsTrack" THEN
      RAISE EXCEPTION 'Enrollment SHS Track is immutable once populated';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Enrollment_assert_entry_facts_trigger"
  BEFORE INSERT OR UPDATE OF "sectionId", "academicYearId", "entryAcademicTermId", "shsTrack"
  ON "Enrollment"
  FOR EACH ROW EXECUTE FUNCTION "Enrollment_assert_entry_facts"();

CREATE FUNCTION "Section_assert_enrollment_entry_facts"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."gradeLevel" IS NOT DISTINCT FROM OLD."gradeLevel" THEN
    RETURN NEW;
  END IF;

  IF NEW."gradeLevel" NOT IN ('11', '12') AND EXISTS (
    SELECT 1
    FROM "Enrollment"
    WHERE "sectionId" = NEW."id"
      AND "shsTrack" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Section grade cannot move Enrollments with an SHS Track to JHS';
  END IF;

  IF NEW."gradeLevel" IN ('11', '12') AND EXISTS (
    SELECT 1
    FROM "Enrollment"
    WHERE "sectionId" = NEW."id"
      AND ("entryAcademicTermId" IS NULL OR "shsTrack" IS NULL)
  ) THEN
    RAISE EXCEPTION 'Section grade cannot move Enrollments to SHS without entry Terms and SHS Tracks';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "Section_assert_enrollment_entry_facts_trigger"
  BEFORE UPDATE OF "gradeLevel" ON "Section"
  FOR EACH ROW EXECUTE FUNCTION "Section_assert_enrollment_entry_facts"();

COMMIT;
