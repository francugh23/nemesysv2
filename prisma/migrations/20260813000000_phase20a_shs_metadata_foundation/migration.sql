BEGIN;

CREATE TYPE "ShsSubjectClassification" AS ENUM ('CORE', 'ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE');
CREATE TYPE "ShsCurriculumStatus" AS ENUM ('PROVISIONAL_DEPED', 'SCHOOL_APPROVED');
CREATE TYPE "ShsCurriculumClusterTrack" AS ENUM ('ACADEMIC', 'TECHPRO');

CREATE TABLE "ShsCurriculumCluster" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "track" "ShsCurriculumClusterTrack" NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  "deletedAt" TIMESTAMP(3),
  CONSTRAINT "ShsCurriculumCluster_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SubjectOfferingShsContext" (
  "subjectOfferingId" TEXT NOT NULL,
  "classification" "ShsSubjectClassification" NOT NULL,
  "curriculumStatus" "ShsCurriculumStatus" NOT NULL,
  "clusterId" TEXT,
  "sourceReference" TEXT,
  "approvalReference" TEXT,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SubjectOfferingShsContext_pkey" PRIMARY KEY ("subjectOfferingId")
);

ALTER TABLE "StudentSubjectEnrollment"
  ADD COLUMN "shsClassification" "ShsSubjectClassification",
  ADD COLUMN "shsClusterCode" TEXT,
  ADD COLUMN "shsClusterName" TEXT,
  ADD COLUMN "shsCurriculumStatus" "ShsCurriculumStatus",
  ADD COLUMN "shsSourceReference" TEXT,
  ADD COLUMN "shsApprovalReference" TEXT;

CREATE UNIQUE INDEX "ShsCurriculumCluster_active_code_key"
  ON "ShsCurriculumCluster" (UPPER(BTRIM("code")))
  WHERE "deletedAt" IS NULL;
CREATE INDEX "ShsCurriculumCluster_track_idx" ON "ShsCurriculumCluster"("track");
CREATE INDEX "ShsCurriculumCluster_createdById_idx" ON "ShsCurriculumCluster"("createdById");
CREATE INDEX "SubjectOfferingShsContext_clusterId_idx" ON "SubjectOfferingShsContext"("clusterId");
CREATE INDEX "SubjectOfferingShsContext_curriculumStatus_idx" ON "SubjectOfferingShsContext"("curriculumStatus");
CREATE INDEX "SubjectOfferingShsContext_createdById_idx" ON "SubjectOfferingShsContext"("createdById");

ALTER TABLE "ShsCurriculumCluster"
  ADD CONSTRAINT "ShsCurriculumCluster_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_subjectOfferingId_fkey"
  FOREIGN KEY ("subjectOfferingId") REFERENCES "SubjectOffering"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_clusterId_fkey"
  FOREIGN KEY ("clusterId") REFERENCES "ShsCurriculumCluster"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_createdById_fkey"
  FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SubjectOfferingShsContext"
  ADD CONSTRAINT "SubjectOfferingShsContext_provenance_check"
  CHECK (
    ("curriculumStatus" = 'PROVISIONAL_DEPED' AND NULLIF(BTRIM("sourceReference"), '') IS NOT NULL AND "approvalReference" IS NULL)
    OR
    ("curriculumStatus" = 'SCHOOL_APPROVED' AND NULLIF(BTRIM("approvalReference"), '') IS NOT NULL)
  );

CREATE FUNCTION "SubjectOfferingShsContext_assert_valid"() RETURNS TRIGGER AS $$
DECLARE
  offering_grade TEXT;
  cluster_track "ShsCurriculumClusterTrack";
  cluster_deleted_at TIMESTAMP(3);
BEGIN
  SELECT "gradeLevel" INTO offering_grade FROM "SubjectOffering" WHERE "id" = NEW."subjectOfferingId";
  IF offering_grade NOT IN ('11', '12') THEN
    RAISE EXCEPTION 'SHS context is only valid for Grade 11 or 12 Subject Offerings';
  END IF;

  IF NEW."classification" = 'CORE' AND NEW."clusterId" IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Core Subject Offerings cannot have a curriculum cluster';
  END IF;
  IF NEW."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') AND NEW."clusterId" IS NULL THEN
    RAISE EXCEPTION 'SHS elective Subject Offerings require a curriculum cluster';
  END IF;

  IF NEW."clusterId" IS NOT NULL THEN
    SELECT "track", "deletedAt" INTO cluster_track, cluster_deleted_at FROM "ShsCurriculumCluster" WHERE "id" = NEW."clusterId";
    IF cluster_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Archived SHS curriculum clusters cannot be used by Subject Offerings';
    END IF;
    IF NEW."classification" = 'ACADEMIC_ELECTIVE' AND cluster_track <> 'ACADEMIC' THEN
      RAISE EXCEPTION 'Academic elective Subject Offerings require an Academic curriculum cluster';
    END IF;
    IF NEW."classification" = 'TECHPRO_ELECTIVE' AND cluster_track <> 'TECHPRO' THEN
      RAISE EXCEPTION 'TechPro elective Subject Offerings require a TechPro curriculum cluster';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "SubjectOfferingShsContext_assert_valid_trigger"
  BEFORE INSERT OR UPDATE ON "SubjectOfferingShsContext"
  FOR EACH ROW EXECUTE FUNCTION "SubjectOfferingShsContext_assert_valid"();

CREATE FUNCTION "StudentSubjectEnrollment_assert_shs_snapshot"() RETURNS TRIGGER AS $$
DECLARE
  source_context "SubjectOfferingShsContext"%ROWTYPE;
BEGIN
  SELECT * INTO source_context FROM "SubjectOfferingShsContext" WHERE "subjectOfferingId" = NEW."subjectOfferingId";
  IF FOUND THEN
    IF source_context."curriculumStatus" = 'PROVISIONAL_DEPED' THEN
      RAISE EXCEPTION 'Provisional DepEd Subject Offerings cannot materialize Student Subject Enrollments';
    END IF;
    IF NEW."shsClassification" IS DISTINCT FROM source_context."classification"
      OR NEW."shsCurriculumStatus" IS DISTINCT FROM source_context."curriculumStatus"
      OR NEW."shsSourceReference" IS DISTINCT FROM source_context."sourceReference"
      OR NEW."shsApprovalReference" IS DISTINCT FROM source_context."approvalReference"
      OR NEW."shsClusterCode" IS DISTINCT FROM (SELECT "code" FROM "ShsCurriculumCluster" WHERE "id" = source_context."clusterId")
      OR NEW."shsClusterName" IS DISTINCT FROM (SELECT "name" FROM "ShsCurriculumCluster" WHERE "id" = source_context."clusterId") THEN
      RAISE EXCEPTION 'Student Subject Enrollment SHS snapshots must match the source Offering context';
    END IF;
  ELSIF NEW."shsClassification" IS NOT NULL OR NEW."shsClusterCode" IS NOT NULL OR NEW."shsClusterName" IS NOT NULL
    OR NEW."shsCurriculumStatus" IS NOT NULL OR NEW."shsSourceReference" IS NOT NULL OR NEW."shsApprovalReference" IS NOT NULL THEN
    RAISE EXCEPTION 'Student Subject Enrollment SHS snapshots require a source Offering SHS context';
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollment_assert_shs_snapshot_trigger"
  BEFORE INSERT OR UPDATE ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_assert_shs_snapshot"();

COMMIT;
