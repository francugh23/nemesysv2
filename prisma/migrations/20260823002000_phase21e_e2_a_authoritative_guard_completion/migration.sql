BEGIN;

CREATE FUNCTION "CurriculumCorrection_offering_snapshot"(offering_id TEXT) RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'subjectId', offering."subjectId",
    'subjectCode', offering."subjectCode",
    'subjectDescription', offering."subjectDescription",
    'gradeLevel', offering."gradeLevel",
    'terms', COALESCE((
      SELECT jsonb_agg(
        jsonb_build_object('id', term."id", 'name', term."name", 'position', term."position")
        ORDER BY term."position", term."id"
      )
      FROM "SubjectOfferingTerm" offering_term
      JOIN "AcademicTerm" term ON term."id" = offering_term."academicTermId"
      WHERE offering_term."subjectOfferingId" = offering."id"
    ), '[]'::JSONB),
    'shsContext', CASE WHEN context."subjectOfferingId" IS NULL THEN NULL ELSE jsonb_build_object(
      'classification', context."classification",
      'curriculumStatus', context."curriculumStatus",
      'clusterId', context."clusterId",
      'clusterCode', cluster."code",
      'clusterName', cluster."name",
      'sourceReference', context."sourceReference",
      'approvalReference', context."approvalReference",
      'approvedById', context."approvedById",
      'approvedAt', CASE WHEN context."approvedAt" IS NULL THEN NULL
        ELSE to_char(context."approvedAt", 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') END
    ) END
  )
  FROM "SubjectOffering" offering
  LEFT JOIN "SubjectOfferingShsContext" context
    ON context."subjectOfferingId" = offering."id"
  LEFT JOIN "ShsCurriculumCluster" cluster ON cluster."id" = context."clusterId"
  WHERE offering."id" = offering_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "CurriculumCorrection_enforce_intent"() RETURNS TRIGGER AS $$
DECLARE
  source_year_id TEXT;
  source_deleted_at TIMESTAMP(3);
  actual_participation_count INTEGER;
  actual_finalized BOOLEAN;
  academic_year_status "AcademicYearStatus";
  effective_term_start DATE;
  operational_date DATE;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Curriculum correction records are immutable';
  END IF;

  IF "CurriculumCorrection_context_id"() IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'Curriculum correction requires its dedicated transaction context';
  END IF;

  operational_date := (CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Manila')::DATE;
  IF ABS(EXTRACT(EPOCH FROM (NEW."correctedAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) > 300 THEN
    RAISE EXCEPTION 'Curriculum correction timestamp must represent the current transaction';
  END IF;

  SELECT offering."academicYearId", offering."deletedAt",
    EXISTS (
      SELECT 1 FROM "CurriculumFinalization" finalization
      WHERE finalization."academicYearId" = offering."academicYearId"
    ),
    (SELECT COUNT(*)::INTEGER FROM "StudentSubjectEnrollment" participation
      WHERE participation."subjectOfferingId" = offering."id")
  INTO source_year_id, source_deleted_at, actual_finalized, actual_participation_count
  FROM "SubjectOffering" offering
  WHERE offering."id" = NEW."sourceOfferingId";

  IF source_year_id IS NULL OR source_deleted_at IS NOT NULL THEN
    RAISE EXCEPTION 'Curriculum correction source Offering must be active';
  END IF;
  IF source_year_id IS DISTINCT FROM NEW."academicYearId" THEN
    RAISE EXCEPTION 'Curriculum correction must remain in the source Academic Year';
  END IF;
  SELECT "status" INTO academic_year_status FROM "AcademicYear"
  WHERE "id" = NEW."academicYearId";
  IF academic_year_status IS DISTINCT FROM 'ACTIVE'::"AcademicYearStatus" THEN
    RAISE EXCEPTION 'Curriculum correction requires an active Academic Year';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "AcademicTerm"
    WHERE "academicYearId" = NEW."academicYearId"
      AND "startDate" <= operational_date
      AND operational_date <= "endDate"
  ) THEN
    RAISE EXCEPTION 'Curriculum correction is unavailable during an active Academic Term';
  END IF;
  SELECT "startDate" INTO effective_term_start FROM "AcademicTerm"
  WHERE "id" = NEW."effectiveAcademicTermId"
    AND "academicYearId" = NEW."academicYearId";
  IF effective_term_start IS NULL OR effective_term_start <= operational_date THEN
    RAISE EXCEPTION 'Curriculum correction effective Term must be future and unstarted';
  END IF;
  IF NEW."sourceWasFinalized" IS DISTINCT FROM actual_finalized
    OR NEW."sourceParticipationCount" IS DISTINCT FROM actual_participation_count THEN
    RAISE EXCEPTION 'Curriculum correction source facts changed';
  END IF;
  IF NOT actual_finalized AND actual_participation_count = 0 THEN
    RAISE EXCEPTION 'Unlocked Curriculum must use the ordinary configuration workflow';
  END IF;
  IF NEW."sourceConfigurationSnapshot" IS DISTINCT FROM "CurriculumCorrection_offering_snapshot"(NEW."sourceOfferingId") THEN
    RAISE EXCEPTION 'Curriculum correction source snapshot must match the source Offering';
  END IF;
  IF EXISTS (SELECT 1 FROM "SubjectOffering" WHERE "id" = NEW."replacementOfferingId") THEN
    RAISE EXCEPTION 'Curriculum correction replacement identity must be new';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "CurriculumCorrection_validate_completion"() RETURNS TRIGGER AS $$
DECLARE
  source_year_id TEXT;
  source_deleted_at TIMESTAMP(3);
  source_grade TEXT;
  replacement_year_id TEXT;
  replacement_deleted_at TIMESTAMP(3);
  replacement_source_id TEXT;
  replacement_grade TEXT;
  replacement_status "ShsCurriculumStatus";
  effective_position INTEGER;
  configured_term_count INTEGER;
  replacement_term_count INTEGER;
BEGIN
  SELECT "academicYearId", "deletedAt", "gradeLevel"
  INTO source_year_id, source_deleted_at, source_grade
  FROM "SubjectOffering" WHERE "id" = NEW."sourceOfferingId";

  SELECT offering."academicYearId", offering."deletedAt",
    offering."replacesSubjectOfferingId", offering."gradeLevel", context."curriculumStatus"
  INTO replacement_year_id, replacement_deleted_at,
    replacement_source_id, replacement_grade, replacement_status
  FROM "SubjectOffering" offering
  LEFT JOIN "SubjectOfferingShsContext" context
    ON context."subjectOfferingId" = offering."id"
  WHERE offering."id" = NEW."replacementOfferingId";

  IF source_deleted_at IS NULL
    OR replacement_year_id IS NULL
    OR replacement_deleted_at IS NOT NULL
    OR source_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_year_id IS DISTINCT FROM NEW."academicYearId"
    OR replacement_source_id IS DISTINCT FROM NEW."sourceOfferingId" THEN
    RAISE EXCEPTION 'Curriculum correction did not complete its exact archive-and-replace lineage';
  END IF;
  IF replacement_grade IS DISTINCT FROM source_grade THEN
    RAISE EXCEPTION 'Curriculum correction replacement must retain the source grade';
  END IF;

  SELECT "position" INTO effective_position FROM "AcademicTerm"
  WHERE "id" = NEW."effectiveAcademicTermId"
    AND "academicYearId" = NEW."academicYearId";
  IF NOT EXISTS (
    SELECT 1 FROM "SubjectOfferingTerm"
    WHERE "subjectOfferingId" = NEW."replacementOfferingId"
      AND "academicTermId" = NEW."effectiveAcademicTermId"
  ) THEN
    RAISE EXCEPTION 'Curriculum correction replacement must include its effective Academic Term';
  END IF;

  IF replacement_grade IN ('7', '8', '9', '10') THEN
    SELECT COUNT(*)::INTEGER INTO configured_term_count FROM "AcademicTerm"
    WHERE "academicYearId" = NEW."academicYearId";
    SELECT COUNT(*)::INTEGER INTO replacement_term_count FROM "SubjectOfferingTerm"
    WHERE "subjectOfferingId" = NEW."replacementOfferingId";
    IF effective_position <> 1 OR replacement_term_count <> configured_term_count OR EXISTS (
      SELECT 1 FROM "AcademicTerm" term
      WHERE term."academicYearId" = NEW."academicYearId"
        AND NOT EXISTS (
          SELECT 1 FROM "SubjectOfferingTerm" offering_term
          WHERE offering_term."subjectOfferingId" = NEW."replacementOfferingId"
            AND offering_term."academicTermId" = term."id"
        )
    ) THEN
      RAISE EXCEPTION 'JHS Curriculum correction must be effective before Term 1 and retain every configured Term';
    END IF;
  ELSIF EXISTS (
    SELECT 1
    FROM "SubjectOfferingTerm" offering_term
    JOIN "AcademicTerm" term ON term."id" = offering_term."academicTermId"
    WHERE offering_term."subjectOfferingId" = NEW."replacementOfferingId"
      AND term."position" < effective_position
  ) THEN
    RAISE EXCEPTION 'SHS Curriculum correction Terms cannot precede the effective Term';
  END IF;

  IF replacement_grade IN ('11', '12') AND replacement_status IS DISTINCT FROM 'SCHOOL_APPROVED' THEN
    RAISE EXCEPTION 'SHS Curriculum correction replacement must be atomically school approved';
  END IF;
  IF replacement_grade NOT IN ('11', '12') AND replacement_status IS NOT NULL THEN
    RAISE EXCEPTION 'JHS Curriculum correction replacement cannot have SHS context';
  END IF;
  IF NEW."replacementConfigurationSnapshot" IS DISTINCT FROM "CurriculumCorrection_offering_snapshot"(NEW."replacementOfferingId") THEN
    RAISE EXCEPTION 'Curriculum correction replacement snapshot must match the replacement Offering';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

COMMIT;
