BEGIN;

CREATE OR REPLACE FUNCTION "CurriculumCorrection_validate_completion"() RETURNS TRIGGER AS $$
DECLARE
  operational_date DATE := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE;
  immediate_next_term_id TEXT;
  effective_term_start DATE;
  effective_position INTEGER;
  source_year_id TEXT;
  source_deleted_at TIMESTAMP(3);
  source_grade TEXT;
  source_source_reference TEXT;
  source_approval_reference TEXT;
  replacement_year_id TEXT;
  replacement_deleted_at TIMESTAMP(3);
  replacement_source_id TEXT;
  replacement_grade TEXT;
  replacement_status "ShsCurriculumStatus";
  replacement_classification "ShsSubjectClassification";
  replacement_cluster_id TEXT;
  replacement_source_reference TEXT;
  replacement_approval_reference TEXT;
  replacement_approved_by_id TEXT;
  replacement_approved_at TIMESTAMP(3);
  cluster_track "ShsCurriculumClusterTrack";
  cluster_deleted_at TIMESTAMP(3);
  cluster_is_school_facing BOOLEAN;
  configured_term_count INTEGER;
  replacement_term_count INTEGER;
BEGIN
  SELECT offering."academicYearId", offering."deletedAt", offering."gradeLevel",
    context."sourceReference", context."approvalReference"
  INTO source_year_id, source_deleted_at, source_grade,
    source_source_reference, source_approval_reference
  FROM "SubjectOffering" offering
  LEFT JOIN "SubjectOfferingShsContext" context ON context."subjectOfferingId" = offering."id"
  WHERE offering."id" = NEW."sourceOfferingId";

  SELECT offering."academicYearId", offering."deletedAt", offering."replacesSubjectOfferingId",
    offering."gradeLevel", context."curriculumStatus", context."classification", context."clusterId",
    context."sourceReference", context."approvalReference", context."approvedById", context."approvedAt"
  INTO replacement_year_id, replacement_deleted_at, replacement_source_id,
    replacement_grade, replacement_status, replacement_classification, replacement_cluster_id,
    replacement_source_reference, replacement_approval_reference, replacement_approved_by_id, replacement_approved_at
  FROM "SubjectOffering" offering
  LEFT JOIN "SubjectOfferingShsContext" context ON context."subjectOfferingId" = offering."id"
  WHERE offering."id" = NEW."replacementOfferingId";

  IF source_deleted_at IS NULL OR replacement_year_id IS NULL OR replacement_deleted_at IS NOT NULL
    OR source_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_source_id IS DISTINCT FROM NEW."sourceOfferingId" THEN
    RAISE EXCEPTION 'Curriculum correction did not complete its exact archive-and-replace lineage';
  END IF;
  IF replacement_grade IS DISTINCT FROM source_grade THEN
    RAISE EXCEPTION 'Curriculum correction replacement must retain the source grade';
  END IF;

  SELECT term."id" INTO immediate_next_term_id
  FROM "AcademicTerm" term
  WHERE term."academicYearId" = NEW."academicYearId" AND term."startDate" > operational_date
  ORDER BY term."startDate", term."position", term."id" LIMIT 1;
  IF immediate_next_term_id IS NULL OR NEW."effectiveAcademicTermId" IS DISTINCT FROM immediate_next_term_id THEN
    RAISE EXCEPTION 'Curriculum correction effective Term must be the immediately next unstarted Academic Term';
  END IF;

  SELECT "startDate", "position" INTO effective_term_start, effective_position
  FROM "AcademicTerm"
  WHERE "id" = NEW."effectiveAcademicTermId" AND "academicYearId" = NEW."academicYearId";

  IF NOT EXISTS (
    SELECT 1 FROM "SubjectOfferingTerm"
    WHERE "subjectOfferingId" = NEW."sourceOfferingId"
      AND "academicTermId" = NEW."effectiveAcademicTermId"
  ) THEN
    RAISE EXCEPTION 'Curriculum correction source must apply in the immediately next Academic Term';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOfferingTerm" source_term
    JOIN "AcademicTerm" term ON term."id" = source_term."academicTermId"
    WHERE source_term."subjectOfferingId" = NEW."sourceOfferingId"
      AND term."academicYearId" = NEW."academicYearId"
      AND term."startDate" >= effective_term_start
      AND NOT EXISTS (
        SELECT 1 FROM "SubjectOfferingTerm" replacement_term
        WHERE replacement_term."subjectOfferingId" = NEW."replacementOfferingId"
          AND replacement_term."academicTermId" = source_term."academicTermId"
      )
  ) THEN
    RAISE EXCEPTION 'Curriculum correction replacement must retain every remaining source Academic Term';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOfferingTerm" replacement_term
    JOIN "AcademicTerm" term ON term."id" = replacement_term."academicTermId"
    WHERE replacement_term."subjectOfferingId" = NEW."replacementOfferingId"
      AND NOT (
        term."academicYearId" = NEW."academicYearId"
        AND term."startDate" >= effective_term_start
        AND EXISTS (
          SELECT 1 FROM "SubjectOfferingTerm" source_term
          WHERE source_term."subjectOfferingId" = NEW."sourceOfferingId"
            AND source_term."academicTermId" = replacement_term."academicTermId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Curriculum correction replacement Terms must exactly equal the remaining source Term set';
  END IF;

  IF replacement_grade IN ('7', '8', '9', '10') THEN
    SELECT COUNT(*)::INTEGER INTO configured_term_count FROM "AcademicTerm"
    WHERE "academicYearId" = NEW."academicYearId";
    SELECT COUNT(*)::INTEGER INTO replacement_term_count FROM "SubjectOfferingTerm"
    WHERE "subjectOfferingId" = NEW."replacementOfferingId";
    IF effective_position <> 1 OR replacement_term_count <> configured_term_count OR replacement_status IS NOT NULL THEN
      RAISE EXCEPTION 'JHS Curriculum correction must be effective before Term 1 and retain every configured Term';
    END IF;
  ELSIF replacement_grade IN ('11', '12') THEN
    IF replacement_status IS DISTINCT FROM 'SCHOOL_APPROVED' OR replacement_classification IS NULL THEN
      RAISE EXCEPTION 'SHS Curriculum correction replacement must be atomically school approved with complete context';
    END IF;
    IF NULLIF(BTRIM(replacement_source_reference), '') IS NULL
      OR BTRIM(replacement_source_reference) IS NOT DISTINCT FROM BTRIM(source_source_reference) THEN
      RAISE EXCEPTION 'SHS Curriculum correction replacement requires newly supplied provenance';
    END IF;
    IF NULLIF(BTRIM(replacement_approval_reference), '') IS NULL
      OR BTRIM(replacement_approval_reference) IS NOT DISTINCT FROM BTRIM(source_approval_reference) THEN
      RAISE EXCEPTION 'SHS Curriculum correction replacement requires independent approval evidence';
    END IF;
    IF replacement_approved_by_id IS DISTINCT FROM NEW."correctedById"
      OR replacement_approved_at IS DISTINCT FROM NEW."correctedAt" THEN
      RAISE EXCEPTION 'SHS Curriculum correction approval facts must match the correction actor and timestamp';
    END IF;
    IF replacement_classification = 'CORE' AND replacement_cluster_id IS NOT NULL THEN
      RAISE EXCEPTION 'SHS Core Curriculum correction replacement cannot have a cluster';
    ELSIF replacement_classification IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') THEN
      IF replacement_cluster_id IS NULL THEN
        RAISE EXCEPTION 'SHS elective Curriculum correction replacement requires a cluster';
      END IF;
      SELECT "track", "deletedAt", "isSchoolFacing"
      INTO cluster_track, cluster_deleted_at, cluster_is_school_facing
      FROM "ShsCurriculumCluster" WHERE "id" = replacement_cluster_id;
      IF cluster_track IS NULL OR cluster_deleted_at IS NOT NULL OR cluster_is_school_facing IS DISTINCT FROM TRUE THEN
        RAISE EXCEPTION 'SHS elective Curriculum correction replacement requires an active school-facing cluster';
      END IF;
      IF replacement_classification = 'ACADEMIC_ELECTIVE' AND cluster_track IS DISTINCT FROM 'ACADEMIC' THEN
        RAISE EXCEPTION 'Academic elective Curriculum correction replacement requires an Academic cluster';
      END IF;
      IF replacement_classification = 'TECHPRO_ELECTIVE' AND cluster_track IS DISTINCT FROM 'TECHPRO' THEN
        RAISE EXCEPTION 'TechPro elective Curriculum correction replacement requires a TechPro cluster';
      END IF;
      IF EXISTS (
        SELECT 1 FROM "SubjectOfferingTerm" replacement_term
        WHERE replacement_term."subjectOfferingId" = NEW."replacementOfferingId"
          AND NOT EXISTS (
            SELECT 1 FROM "ShsElectiveEnrollmentPolicy" policy
            WHERE policy."academicYearId" = NEW."academicYearId"
              AND policy."academicTermId" = replacement_term."academicTermId"
              AND policy."gradeLevel" = replacement_grade
          )
      ) THEN
        RAISE EXCEPTION 'SHS elective Curriculum correction requires an existing policy for every replacement Term';
      END IF;
    END IF;
  ELSE
    RAISE EXCEPTION 'Curriculum correction replacement has an unsupported grade level';
  END IF;

  IF NEW."replacementConfigurationSnapshot" IS DISTINCT FROM "CurriculumCorrection_offering_snapshot"(NEW."replacementOfferingId") THEN
    RAISE EXCEPTION 'Curriculum correction replacement snapshot must match the replacement Offering';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
