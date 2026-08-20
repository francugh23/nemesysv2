BEGIN;

CREATE TABLE "CurriculumFinalization" (
  "id" TEXT NOT NULL,
  "academicYearId" TEXT NOT NULL,
  "finalizedById" TEXT NOT NULL,
  "finalizedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CurriculumFinalization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CurriculumFinalization_academicYearId_key"
  ON "CurriculumFinalization"("academicYearId");
CREATE INDEX "CurriculumFinalization_finalizedById_idx"
  ON "CurriculumFinalization"("finalizedById");

ALTER TABLE "CurriculumFinalization"
  ADD CONSTRAINT "CurriculumFinalization_academicYearId_fkey"
  FOREIGN KEY ("academicYearId") REFERENCES "AcademicYear"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "CurriculumFinalization"
  ADD CONSTRAINT "CurriculumFinalization_finalizedById_fkey"
  FOREIGN KEY ("finalizedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "CurriculumFinalization_enforce_lifecycle"() RETURNS TRIGGER AS $$
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
    JOIN "SubjectOfferingShsContext" context
      ON context."subjectOfferingId" = offering."id"
    WHERE offering."academicYearId" = NEW."academicYearId"
      AND offering."deletedAt" IS NULL
      AND context."curriculumStatus" = 'PROVISIONAL_DEPED'
  ) THEN
    RAISE EXCEPTION 'Pending SHS Offerings must be approved or archived before Curriculum finalization';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "CurriculumFinalization_enforce_lifecycle_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "CurriculumFinalization"
  FOR EACH ROW EXECUTE FUNCTION "CurriculumFinalization_enforce_lifecycle"();

CREATE FUNCTION "SubjectOffering_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  source_academic_year_id TEXT;
  target_offering_id TEXT;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."academicYearId" ELSE OLD."academicYearId" END;
  target_offering_id := CASE WHEN TG_OP = 'INSERT' THEN NEW."id" ELSE OLD."id" END;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" IN (source_academic_year_id, target_academic_year_id)
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum cannot be changed';
  END IF;

  IF TG_OP = 'UPDATE'
    AND EXISTS (SELECT 1 FROM "StudentSubjectEnrollment" WHERE "subjectOfferingId" = target_offering_id)
    AND (
      NEW."subjectId" IS DISTINCT FROM OLD."subjectId"
      OR NEW."academicYearId" IS DISTINCT FROM OLD."academicYearId"
      OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
      OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
      OR NEW."subjectDescription" IS DISTINCT FROM OLD."subjectDescription"
    ) THEN
    RAISE EXCEPTION 'Curriculum used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SubjectOffering_enforce_curriculum_lock_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "SubjectOffering"
  FOR EACH ROW EXECUTE FUNCTION "SubjectOffering_enforce_curriculum_lock"();

CREATE FUNCTION "SubjectOfferingTerm_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  offering_id TEXT;
  academic_year_id TEXT;
BEGIN
  offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  SELECT "academicYearId" INTO academic_year_id
  FROM "SubjectOffering"
  WHERE "id" = offering_id;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" = academic_year_id
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum Term applicability cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" = offering_id
  ) THEN
    RAISE EXCEPTION 'Curriculum Term applicability used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "SubjectOfferingTerm_enforce_curriculum_lock_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "SubjectOfferingTerm"
  FOR EACH ROW EXECUTE FUNCTION "SubjectOfferingTerm_enforce_curriculum_lock"();

CREATE FUNCTION "SubjectOfferingShsContext_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  offering_id TEXT;
  academic_year_id TEXT;
BEGIN
  offering_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."subjectOfferingId" ELSE NEW."subjectOfferingId" END;

  SELECT "academicYearId" INTO academic_year_id
  FROM "SubjectOffering"
  WHERE "id" = offering_id;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" = academic_year_id
  ) THEN
    RAISE EXCEPTION 'Finalized SHS Curriculum context cannot be changed';
  END IF;

  IF EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollment"
    WHERE "subjectOfferingId" = offering_id
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

CREATE TRIGGER "SubjectOfferingShsContext_enforce_curriculum_lock_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "SubjectOfferingShsContext"
  FOR EACH ROW EXECUTE FUNCTION "SubjectOfferingShsContext_enforce_curriculum_lock"();

CREATE FUNCTION "ShsElectiveEnrollmentPolicy_scope_has_participation"(
  target_academic_year_id TEXT,
  target_academic_term_id TEXT,
  target_grade_level TEXT
) RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    JOIN "Enrollment" enrollment ON enrollment."id" = participation."enrollmentId"
    JOIN "StudentSubjectEnrollmentTerm" participation_term
      ON participation_term."studentSubjectEnrollmentId" = participation."id"
    WHERE enrollment."academicYearId" = target_academic_year_id
      AND participation."gradeLevel" = target_grade_level
      AND participation_term."academicTermId" = target_academic_term_id
      AND participation."shsClassification" IS NOT NULL
  );
$$ LANGUAGE sql STABLE;

CREATE FUNCTION "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  target_academic_term_id TEXT;
  target_grade_level TEXT;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  target_academic_term_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicTermId" ELSE NEW."academicTermId" END;
  target_grade_level := CASE WHEN TG_OP = 'DELETE' THEN OLD."gradeLevel" ELSE NEW."gradeLevel" END;

  IF EXISTS (
    SELECT 1 FROM "CurriculumFinalization"
    WHERE "academicYearId" IN (
      target_academic_year_id,
      CASE WHEN TG_OP = 'INSERT' THEN target_academic_year_id ELSE OLD."academicYearId" END
    )
  ) THEN
    RAISE EXCEPTION 'Finalized Curriculum elective policies cannot be changed';
  END IF;

  IF "ShsElectiveEnrollmentPolicy_scope_has_participation"(
    target_academic_year_id,
    target_academic_term_id,
    target_grade_level
  ) OR (
    TG_OP = 'UPDATE'
    AND "ShsElectiveEnrollmentPolicy_scope_has_participation"(
      OLD."academicYearId",
      OLD."academicTermId",
      OLD."gradeLevel"
    )
  ) THEN
    RAISE EXCEPTION 'SHS elective policy scope used by student participation cannot be changed';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "ShsElectiveEnrollmentPolicy"
  FOR EACH ROW EXECUTE FUNCTION "ShsElectiveEnrollmentPolicy_enforce_curriculum_lock"();

CREATE FUNCTION "AcademicTerm_enforce_draft_year"() RETURNS TRIGGER AS $$
DECLARE
  target_academic_year_id TEXT;
  source_academic_year_id TEXT;
BEGIN
  target_academic_year_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."academicYearId" ELSE NEW."academicYearId" END;
  source_academic_year_id := CASE WHEN TG_OP = 'INSERT' THEN target_academic_year_id ELSE OLD."academicYearId" END;

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

CREATE TRIGGER "AcademicTerm_enforce_draft_year_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "AcademicTerm"
  FOR EACH ROW EXECUTE FUNCTION "AcademicTerm_enforce_draft_year"();

CREATE FUNCTION "ShsCurriculumCluster_enforce_operational_lock"() RETURNS TRIGGER AS $$
BEGIN
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

CREATE TRIGGER "ShsCurriculumCluster_enforce_operational_lock_trigger"
  BEFORE UPDATE ON "ShsCurriculumCluster"
  FOR EACH ROW EXECUTE FUNCTION "ShsCurriculumCluster_enforce_operational_lock"();

COMMIT;
