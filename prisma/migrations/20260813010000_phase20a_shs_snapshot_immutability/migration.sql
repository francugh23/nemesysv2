BEGIN;

CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_assert_shs_snapshot"() RETURNS TRIGGER AS $$
DECLARE
  source_context "SubjectOfferingShsContext"%ROWTYPE;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."shsClassification" IS DISTINCT FROM OLD."shsClassification"
      OR NEW."shsClusterCode" IS DISTINCT FROM OLD."shsClusterCode"
      OR NEW."shsClusterName" IS DISTINCT FROM OLD."shsClusterName"
      OR NEW."shsCurriculumStatus" IS DISTINCT FROM OLD."shsCurriculumStatus"
      OR NEW."shsSourceReference" IS DISTINCT FROM OLD."shsSourceReference"
      OR NEW."shsApprovalReference" IS DISTINCT FROM OLD."shsApprovalReference" THEN
      RAISE EXCEPTION 'Student Subject Enrollment SHS snapshots are immutable';
    END IF;
    RETURN NEW;
  END IF;

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

COMMIT;
