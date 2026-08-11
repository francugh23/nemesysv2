BEGIN;

CREATE TYPE "ShsCurriculumReferenceTermApplicability" AS ENUM ('UNSPECIFIED', 'ALL_CONFIGURED_TERMS');

ALTER TABLE "ShsCurriculumCluster" ADD COLUMN "sourceReference" TEXT;

CREATE TABLE "ShsCurriculumReference" (
  "id" TEXT NOT NULL,
  "subjectId" TEXT NOT NULL,
  "gradeLevel" TEXT NOT NULL,
  "classification" "ShsSubjectClassification" NOT NULL,
  "curriculumStatus" "ShsCurriculumStatus" NOT NULL DEFAULT 'PROVISIONAL_DEPED',
  "clusterId" TEXT,
  "sourceReference" TEXT NOT NULL,
  "termApplicability" "ShsCurriculumReferenceTermApplicability" NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ShsCurriculumReference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ShsCurriculumReference_subjectId_key" ON "ShsCurriculumReference"("subjectId");
CREATE INDEX "ShsCurriculumReference_gradeLevel_classification_idx" ON "ShsCurriculumReference"("gradeLevel", "classification");
CREATE INDEX "ShsCurriculumReference_clusterId_idx" ON "ShsCurriculumReference"("clusterId");
CREATE INDEX "ShsCurriculumReference_curriculumStatus_idx" ON "ShsCurriculumReference"("curriculumStatus");
CREATE INDEX "ShsCurriculumReference_createdById_idx" ON "ShsCurriculumReference"("createdById");

ALTER TABLE "ShsCurriculumReference"
  ADD CONSTRAINT "ShsCurriculumReference_subjectId_fkey"
  FOREIGN KEY ("subjectId") REFERENCES "Subject"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsCurriculumReference"
  ADD CONSTRAINT "ShsCurriculumReference_clusterId_fkey"
  FOREIGN KEY ("clusterId") REFERENCES "ShsCurriculumCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsCurriculumReference"
  ADD CONSTRAINT "ShsCurriculumReference_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ShsCurriculumReference"
  ADD CONSTRAINT "ShsCurriculumReference_provisional_check"
  CHECK (
    "gradeLevel" IN ('11', '12')
    AND "curriculumStatus" = 'PROVISIONAL_DEPED'
    AND NULLIF(BTRIM("sourceReference"), '') IS NOT NULL
    AND (
      ("classification" = 'CORE' AND "clusterId" IS NULL)
      OR ("classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') AND "clusterId" IS NOT NULL)
    )
  );

CREATE FUNCTION "ShsCurriculumReference_assert_valid"() RETURNS TRIGGER AS $$
DECLARE
  subject_grade TEXT;
  cluster_track "ShsCurriculumClusterTrack";
  cluster_deleted_at TIMESTAMP(3);
BEGIN
  SELECT "gradeLevel" INTO subject_grade FROM "Subject" WHERE "id" = NEW."subjectId";
  IF subject_grade IS DISTINCT FROM NEW."gradeLevel" THEN
    RAISE EXCEPTION 'SHS curriculum reference grade level must match the Subject grade level';
  END IF;

  IF NEW."clusterId" IS NOT NULL THEN
    SELECT "track", "deletedAt" INTO cluster_track, cluster_deleted_at FROM "ShsCurriculumCluster" WHERE "id" = NEW."clusterId";
    IF cluster_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Archived SHS curriculum clusters cannot be used by curriculum references';
    END IF;
    IF NEW."classification" = 'ACADEMIC_ELECTIVE' AND cluster_track <> 'ACADEMIC' THEN
      RAISE EXCEPTION 'Academic elective curriculum references require an Academic curriculum cluster';
    END IF;
    IF NEW."classification" = 'TECHPRO_ELECTIVE' AND cluster_track <> 'TECHPRO' THEN
      RAISE EXCEPTION 'TechPro elective curriculum references require a TechPro curriculum cluster';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsCurriculumReference_assert_valid_trigger"
  BEFORE INSERT OR UPDATE ON "ShsCurriculumReference"
  FOR EACH ROW EXECUTE FUNCTION "ShsCurriculumReference_assert_valid"();

COMMIT;
