CREATE TYPE "ShsTermResultInterpretationPolicyStatus" AS ENUM ('DRAFT', 'PUBLISHED');

CREATE TABLE "ShsTermResultInterpretationPolicy" (
    "id" TEXT NOT NULL,
    "academicYearId" TEXT NOT NULL,
    "passingThreshold" DECIMAL(5,2) NOT NULL,
    "sourceReference" TEXT NOT NULL,
    "status" "ShsTermResultInterpretationPolicyStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "publishedById" TEXT,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShsTermResultInterpretationPolicy_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShsTermResultInterpretationPolicy_threshold_check"
      CHECK ("passingThreshold" = 75.00),
    CONSTRAINT "ShsTermResultInterpretationPolicy_source_check"
      CHECK (btrim("sourceReference") <> ''),
    CONSTRAINT "ShsTermResultInterpretationPolicy_publication_check"
      CHECK (
        ("status" = 'DRAFT' AND "publishedById" IS NULL AND "publishedAt" IS NULL)
        OR
        ("status" = 'PUBLISHED' AND "publishedById" IS NOT NULL AND "publishedAt" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "ShsTermResultInterpretationPolicy_academicYearId_key"
ON "ShsTermResultInterpretationPolicy"("academicYearId");

CREATE INDEX "ShsTermResultInterpretationPolicy_createdById_idx"
ON "ShsTermResultInterpretationPolicy"("createdById");

CREATE INDEX "ShsTermResultInterpretationPolicy_publishedById_idx"
ON "ShsTermResultInterpretationPolicy"("publishedById");

ALTER TABLE "ShsTermResultInterpretationPolicy"
ADD CONSTRAINT "ShsTermResultInterpretationPolicy_academicYearId_fkey"
FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShsTermResultInterpretationPolicy"
ADD CONSTRAINT "ShsTermResultInterpretationPolicy_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShsTermResultInterpretationPolicy"
ADD CONSTRAINT "ShsTermResultInterpretationPolicy_publishedById_fkey"
FOREIGN KEY ("publishedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_shs_term_result_interpretation_policy()
RETURNS TRIGGER AS $$
DECLARE
  academic_year_status "AcademicYearStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."status" = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published SHS Term Result interpretation policies are immutable and cannot be deleted.';
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published SHS Term Result interpretation policies are immutable.';
    END IF;
    IF OLD."academicYearId" <> NEW."academicYearId" THEN
      RAISE EXCEPTION 'SHS Term Result interpretation policy Academic Year identity is immutable.';
    END IF;
  END IF;

  SELECT "status"
  INTO academic_year_status
  FROM "AcademicYear"
  WHERE "id" = NEW."academicYearId";

  IF academic_year_status IS DISTINCT FROM 'ACTIVE'::"AcademicYearStatus" THEN
    RAISE EXCEPTION 'SHS Term Result interpretation policies may be changed only for an active Academic Year.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsTermResultInterpretationPolicy_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "ShsTermResultInterpretationPolicy"
FOR EACH ROW EXECUTE FUNCTION enforce_shs_term_result_interpretation_policy();
