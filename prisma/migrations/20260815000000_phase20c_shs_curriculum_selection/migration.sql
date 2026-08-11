BEGIN;

ALTER TABLE "SubjectOfferingShsContext"
  ADD COLUMN "approvedById" TEXT,
  ADD COLUMN "approvedAt" TIMESTAMP(3);

ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_approvedById_fkey"
  FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "SubjectOfferingShsContext_approvedById_idx"
  ON "SubjectOfferingShsContext"("approvedById");

ALTER TABLE "SubjectOfferingShsContext"
  DROP CONSTRAINT "SubjectOfferingShsContext_provenance_check";

ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_provenance_check"
  CHECK (
    ("curriculumStatus" = 'PROVISIONAL_DEPED'
      AND NULLIF(BTRIM("sourceReference"), '') IS NOT NULL
      AND "approvalReference" IS NULL
      AND "approvedById" IS NULL
      AND "approvedAt" IS NULL)
    OR
    ("curriculumStatus" = 'SCHOOL_APPROVED'
      AND NULLIF(BTRIM("sourceReference"), '') IS NOT NULL
      AND NULLIF(BTRIM("approvalReference"), '') IS NOT NULL
      AND "approvedById" IS NOT NULL
      AND "approvedAt" IS NOT NULL)
  );

COMMIT;
