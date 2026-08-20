BEGIN;

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

  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" IN (source_offering_id, target_offering_id)
  ORDER BY "id" FOR UPDATE;

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

  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" IN (source_offering_id, target_offering_id)
  ORDER BY "id" FOR UPDATE;

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

  IF TG_OP = 'INSERT' THEN
    IF "ShsElectiveEnrollmentPolicy_scope_has_participation"(
      NEW."academicYearId", NEW."academicTermId", NEW."gradeLevel"
    ) THEN
      RAISE EXCEPTION 'SHS elective policy scope used by student participation cannot be changed';
    END IF;
  ELSE
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

CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_lock_source_offering"() RETURNS TRIGGER AS $$
BEGIN
  PERFORM 1
  FROM "AcademicYear" academic_year
  JOIN "SubjectOffering" offering
    ON offering."academicYearId" = academic_year."id"
  WHERE offering."id" = NEW."subjectOfferingId"
  ORDER BY academic_year."id" FOR UPDATE OF academic_year;

  PERFORM 1 FROM "SubjectOffering"
  WHERE "id" = NEW."subjectOfferingId"
  FOR SHARE;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

COMMIT;
