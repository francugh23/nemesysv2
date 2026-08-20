BEGIN;

CREATE OR REPLACE FUNCTION "CurriculumFinalization_enforce_lifecycle"() RETURNS TRIGGER AS $$
DECLARE
  academic_year_status "AcademicYearStatus";
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'Curriculum finalization is immutable';
  END IF;

  SELECT "status" INTO academic_year_status
  FROM "AcademicYear"
  WHERE "id" = NEW."academicYearId"
  FOR UPDATE;

  IF academic_year_status IS DISTINCT FROM 'ACTIVE'::"AcademicYearStatus" THEN
    RAISE EXCEPTION 'Curriculum may be finalized only for an active Academic Year';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    LEFT JOIN "SubjectOfferingShsContext" context
      ON context."subjectOfferingId" = offering."id"
    WHERE offering."academicYearId" = NEW."academicYearId"
      AND offering."deletedAt" IS NULL
      AND offering."gradeLevel" IN ('11', '12')
      AND (context."subjectOfferingId" IS NULL OR context."curriculumStatus" = 'PROVISIONAL_DEPED')
  ) THEN
    RAISE EXCEPTION 'Pending or invalid SHS Offerings must be resolved before Curriculum finalization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "SubjectOffering_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  source_academic_year_id TEXT;
  target_offering_id TEXT;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."academicYearId" ELSE OLD."academicYearId" END;
  target_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."id" ELSE OLD."id" END;

  PERFORM 1 FROM "AcademicYear"
  WHERE "id" IN (source_academic_year_id, target_academic_year_id)
  ORDER BY "id" FOR SHARE;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" IN (source_academic_year_id, target_academic_year_id)
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum cannot be changed';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF EXISTS (SELECT 1 FROM "StudentSubjectEnrollment" WHERE "subjectOfferingId" = target_offering_id)
      AND (
        NEW."subjectId" IS DISTINCT FROM OLD."subjectId"
        OR NEW."academicYearId" IS DISTINCT FROM OLD."academicYearId"
        OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
        OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
        OR NEW."subjectDescription" IS DISTINCT FROM OLD."subjectDescription"
      ) THEN
      RAISE EXCEPTION 'Curriculum used by student participation cannot be changed';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "SubjectOfferingTerm_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  source_offering_id TEXT;
  target_offering_id TEXT;
BEGIN
  source_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."subjectOfferingId" ELSE OLD."subjectOfferingId" END;
  target_offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  PERFORM 1
  FROM "AcademicYear" academic_year
  WHERE academic_year."id" IN (
    SELECT offering."academicYearId" FROM "SubjectOffering" offering
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  )
  ORDER BY academic_year."id" FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = offering."academicYearId"
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum Term applicability cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'Curriculum Term applicability used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "SubjectOfferingShsContext_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  source_offering_id TEXT;
  target_offering_id TEXT;
BEGIN
  source_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."subjectOfferingId" ELSE OLD."subjectOfferingId" END;
  target_offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  PERFORM 1
  FROM "AcademicYear" academic_year
  WHERE academic_year."id" IN (
    SELECT offering."academicYearId" FROM "SubjectOffering" offering
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  )
  ORDER BY academic_year."id" FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    JOIN "CurriculumFinalization" finalization
      ON finalization."academicYearId" = offering."academicYearId"
    WHERE offering."id" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'Finalized SHS Curriculum context cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" IN (source_offering_id, target_offering_id)
  ) THEN
    RAISE EXCEPTION 'SHS Curriculum context used by student participation cannot be changed';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."curriculumStatus" = 'SCHOOL_APPROVED' AND (
      NEW."curriculumStatus" IS DISTINCT FROM OLD."curriculumStatus"
      OR NEW."approvalReference" IS DISTINCT FROM OLD."approvalReference"
      OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
      OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    ) THEN
      RAISE EXCEPTION 'School-approved SHS Curriculum approval is immutable';
    END IF;

    IF NEW."curriculumStatus" IS DISTINCT FROM OLD."curriculumStatus" THEN
      IF OLD."curriculumStatus" <> 'PROVISIONAL_DEPED'
        OR NEW."curriculumStatus" <> 'SCHOOL_APPROVED' THEN
        RAISE EXCEPTION 'SHS Curriculum approval may only transition from pending to school approved';
      END IF;
      IF NEW."classification" IS DISTINCT FROM OLD."classification"
        OR NEW."clusterId" IS DISTINCT FROM OLD."clusterId"
        OR NEW."sourceReference" IS DISTINCT FROM OLD."sourceReference" THEN
        RAISE EXCEPTION 'SHS Curriculum context cannot change during approval';
      END IF;
    ELSIF OLD."curriculumStatus" = 'PROVISIONAL_DEPED' AND (
      NEW."approvalReference" IS DISTINCT FROM OLD."approvalReference"
      OR NEW."approvedById" IS DISTINCT FROM OLD."approvedById"
      OR NEW."approvedAt" IS DISTINCT FROM OLD."approvedAt"
    ) THEN
      RAISE EXCEPTION 'SHS approval facts require school approval transition';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  source_academic_year_id TEXT;
  target_academic_year_id TEXT;
BEGIN
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."academicYearId" ELSE OLD."academicYearId" END;
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;

  PERFORM 1 FROM "AcademicYear"
  WHERE "id" IN (source_academic_year_id, target_academic_year_id)
  ORDER BY "id" FOR SHARE;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" IN (source_academic_year_id, target_academic_year_id)
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum elective policies cannot be changed';
  END IF;

  IF TG_OP <> 'INSERT' THEN
    IF "ShsElectiveEnrollmentPolicy_scope_has_participation"(
      OLD."academicYearId", OLD."academicTermId", OLD."gradeLevel"
    ) THEN
      RAISE EXCEPTION 'SHS elective policy scope used by student participation cannot be changed';
    END IF;

    IF TG_OP = 'UPDATE' AND "ShsElectiveEnrollmentPolicy_scope_has_participation"(
      NEW."academicYearId", NEW."academicTermId", NEW."gradeLevel"
    ) THEN
      RAISE EXCEPTION 'SHS elective policy scope used by student participation cannot be changed';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "AcademicTerm_enforce_draft_year"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  source_academic_year_id TEXT;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN target_academic_year_id ELSE OLD."academicYearId" END;

  PERFORM 1 FROM "AcademicYear"
  WHERE "id" IN (source_academic_year_id, target_academic_year_id)
  ORDER BY "id" FOR SHARE;

  IF EXISTS (
    SELECT 1 FROM "AcademicYear"
    WHERE "id" IN (source_academic_year_id, target_academic_year_id)
      AND "status" <> 'DRAFT'
  ) THEN
    RAISE EXCEPTION 'Academic Terms may be changed only for a draft Academic Year';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ShsCurriculumCluster_enforce_operational_lock"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "AcademicYear" academic_year
  WHERE academic_year."id" IN (
    SELECT offering."academicYearId"
    FROM "SubjectOfferingShsContext" context
    JOIN "SubjectOffering" offering ON offering."id" = context."subjectOfferingId"
    WHERE context."clusterId" = OLD."id" AND offering."deletedAt" IS NULL
  )
  ORDER BY academic_year."id" FOR SHARE;

  IF OLD."isSchoolFacing" AND OLD."deletedAt" IS NULL AND NEW."deletedAt" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "SubjectOfferingShsContext" context
      JOIN "SubjectOffering" offering ON offering."id" = context."subjectOfferingId"
      JOIN "AcademicYear" academic_year ON academic_year."id" = offering."academicYearId"
      WHERE context."clusterId" = OLD."id"
        AND offering."deletedAt" IS NULL
        AND academic_year."status" = 'ACTIVE'
    ) THEN
    RAISE EXCEPTION 'A cluster used by active Curriculum cannot be archived';
  END IF;

  IF (NEW."code" IS DISTINCT FROM OLD."code" OR NEW."name" IS DISTINCT FROM OLD."name")
    AND EXISTS (
      SELECT 1
      FROM "SubjectOfferingShsContext" context
      JOIN "SubjectOffering" offering ON offering."id" = context."subjectOfferingId"
      JOIN "CurriculumFinalization" finalization
        ON finalization."academicYearId" = offering."academicYearId"
      WHERE context."clusterId" = OLD."id"
        AND offering."deletedAt" IS NULL
    ) THEN
    RAISE EXCEPTION 'A cluster used by finalized Curriculum cannot be renamed';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "StudentSubjectEnrollment_lock_source_offering"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" = NEW."subjectOfferingId"
  FOR SHARE;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentSubjectEnrollment_lock_source_offering_trigger"
  BEFORE INSERT OR UPDATE OF "subjectOfferingId" ON "StudentSubjectEnrollment"
  FOR EACH ROW EXECUTE FUNCTION "StudentSubjectEnrollment_lock_source_offering"();

COMMIT;
