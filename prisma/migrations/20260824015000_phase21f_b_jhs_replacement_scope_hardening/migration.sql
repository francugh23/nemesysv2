CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
BEGIN
  IF OLD."status" <> 'ACTIVE' THEN
    IF NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."replacedAt" IS DISTINCT FROM OLD."replacedAt"
      OR NEW."droppedAt" IS DISTINCT FROM OLD."droppedAt"
      OR NEW."dropReason" IS DISTINCT FROM OLD."dropReason" THEN
      RAISE EXCEPTION 'Terminal Student Subject Enrollment lifecycle is immutable';
    END IF;
  ELSIF NEW."status" NOT IN ('ACTIVE', 'REPLACED', 'DROPPED') THEN
    RAISE EXCEPTION 'Invalid Student Subject Enrollment lifecycle transition';
  END IF;

  IF OLD."status" = 'ACTIVE' AND NEW."status" = 'REPLACED'
    AND OLD."gradeLevel" IN ('7', '8', '9', '10') THEN
    correction_id := "StudentEnrollmentGradeCorrection_active_context_event_id"(OLD."enrollmentId");

    IF correction_id IS NULL OR NOT EXISTS (
      SELECT 1
      FROM "StudentEnrollmentGradeCorrection" correction
      JOIN "StudentParticipationCorrection" child
        ON child."studentEnrollmentGradeCorrectionId" = correction."id"
       AND child."sourceStudentSubjectEnrollmentId" = OLD."id"
      WHERE correction."id" = correction_id
        AND correction."enrollmentId" = OLD."enrollmentId"
        AND correction."correctedAt" = NEW."replacedAt"
        AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
    ) THEN
      RAISE EXCEPTION 'Regular JHS Student Subject Enrollment replacement requires its exact active Student Enrollment Grade Correction mapping';
    END IF;
  END IF;

  IF NEW."selectionAcademicTermId" IS DISTINCT FROM OLD."selectionAcademicTermId" THEN
    RAISE EXCEPTION 'Student Subject Enrollment selection Academic Term is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
