CREATE TYPE "ShsTermResultStatus" AS ENUM ('DRAFT', 'FINALIZED');

CREATE TABLE "ShsTermResult" (
    "id" TEXT NOT NULL,
    "studentSubjectEnrollmentId" TEXT NOT NULL,
    "academicTermId" TEXT NOT NULL,
    "finalResult" DECIMAL(5,2),
    "status" "ShsTermResultStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT NOT NULL,
    "finalizedById" TEXT,
    "finalizedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShsTermResult_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ShsTermResult_finalResult_range_check"
      CHECK ("finalResult" IS NULL OR ("finalResult" >= 0.00 AND "finalResult" <= 100.00)),
    CONSTRAINT "ShsTermResult_finalization_check"
      CHECK (
        ("status" = 'DRAFT' AND "finalizedAt" IS NULL AND "finalizedById" IS NULL)
        OR
        ("status" = 'FINALIZED' AND "finalResult" IS NOT NULL AND "finalizedAt" IS NOT NULL AND "finalizedById" IS NOT NULL)
      )
);

CREATE UNIQUE INDEX "ShsTermResult_studentSubjectEnrollmentId_academicTermId_key"
ON "ShsTermResult"("studentSubjectEnrollmentId", "academicTermId");

CREATE INDEX "ShsTermResult_academicTermId_idx" ON "ShsTermResult"("academicTermId");
CREATE INDEX "ShsTermResult_createdById_idx" ON "ShsTermResult"("createdById");
CREATE INDEX "ShsTermResult_finalizedById_idx" ON "ShsTermResult"("finalizedById");

ALTER TABLE "ShsTermResult"
ADD CONSTRAINT "ShsTermResult_studentSubjectEnrollmentId_academicTermId_fkey"
FOREIGN KEY ("studentSubjectEnrollmentId", "academicTermId")
REFERENCES "StudentSubjectEnrollmentTerm"("studentSubjectEnrollmentId", "academicTermId")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShsTermResult"
ADD CONSTRAINT "ShsTermResult_createdById_fkey"
FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShsTermResult"
ADD CONSTRAINT "ShsTermResult_finalizedById_fkey"
FOREIGN KEY ("finalizedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "protect_finalized_shs_term_result"()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'Finalized SHS Term Results are immutable';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."status" = 'FINALIZED' THEN
    RAISE EXCEPTION 'Finalized SHS Term Results are immutable';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsTermResult_finalized_immutable"
BEFORE UPDATE OR DELETE ON "ShsTermResult"
FOR EACH ROW EXECUTE FUNCTION "protect_finalized_shs_term_result"();
