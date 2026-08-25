CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  source_record "StudentSubjectEnrollment"%ROWTYPE;
  replacement_record "StudentSubjectEnrollment"%ROWTYPE;
  source_term_year_id TEXT;
  replacement_term_year_id TEXT;
  source_term_end_date DATE;
  replacement_xmin_status TEXT;
BEGIN
  IF "ShsStudentParticipationCorrection_context_id"() IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires its exact transaction context';
  END IF;
  IF NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '') IS NOT NULL
    OR "StudentEnrollmentGradeCorrection_context_id"() IS NOT NULL
    OR NULLIF(current_setting('nemesys.shs_progressive_core_replacement_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Student Participation Correction capabilities cannot be composed across domains';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_locks transaction_lock
    WHERE transaction_lock.locktype = 'advisory'
      AND transaction_lock.pid = pg_backend_pid()
      AND transaction_lock.granted
      AND transaction_lock.classid = 2108::OID
      AND transaction_lock.objid = NEW."sequence"::OID
      AND transaction_lock.objsubid = 2
  ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires its sequence advisory membership';
  END IF;
  IF ABS(EXTRACT(EPOCH FROM (NEW."correctedAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) > 300 THEN
    RAISE EXCEPTION 'SHS Student Participation Correction timestamp must represent the current transaction';
  END IF;

  SELECT enrollment.*, academic_year."status" AS "academicYearStatus", section."gradeLevel" AS "sectionGradeLevel"
  INTO enrollment_record
  FROM "Enrollment" enrollment
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  JOIN "Section" section ON section."id" = enrollment."sectionId"
  WHERE enrollment."id" = NEW."enrollmentId"
  FOR UPDATE OF enrollment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHS Student Participation Correction Enrollment does not exist';
  END IF;
  IF enrollment_record."status" <> 'ACTIVE' OR enrollment_record."deletedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires an active Enrollment';
  END IF;
  IF enrollment_record."academicYearStatus" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires the active Academic Year';
  END IF;
  IF enrollment_record."sectionGradeLevel" NOT IN ('11', '12') THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires a Grade 11 or 12 Enrollment';
  END IF;

  SELECT * INTO source_record FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."sourceStudentSubjectEnrollmentId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation does not exist';
  END IF;

  SELECT * INTO replacement_record FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."replacementStudentSubjectEnrollmentId" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation does not exist';
  END IF;

  IF source_record."id" = replacement_record."id" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source and replacement participations must be distinct';
  END IF;
  IF source_record."enrollmentId" IS DISTINCT FROM NEW."enrollmentId" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation does not belong to the Enrollment';
  END IF;
  IF replacement_record."enrollmentId" IS DISTINCT FROM NEW."enrollmentId" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation does not belong to the Enrollment';
  END IF;
  IF source_record."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation must be ACTIVE';
  END IF;
  IF replacement_record."status" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation must be ACTIVE';
  END IF;
  IF source_record."gradeLevel" NOT IN ('11', '12') THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation must be Grade 11 or 12';
  END IF;
  IF source_record."gradeLevel" IS DISTINCT FROM enrollment_record."sectionGradeLevel" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation grade must match the Enrollment grade';
  END IF;
  IF replacement_record."gradeLevel" IS DISTINCT FROM source_record."gradeLevel" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation must have the source grade level';
  END IF;
  IF source_record."shsCurriculumStatus" <> 'SCHOOL_APPROVED'
    OR NULLIF(BTRIM(source_record."shsSourceReference", E' \t\n\r\f\v'), '') IS NULL
    OR NULLIF(BTRIM(source_record."shsApprovalReference", E' \t\n\r\f\v'), '') IS NULL THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation must retain school-approved SHS evidence';
  END IF;
  IF source_record."shsClassification"::TEXT IS DISTINCT FROM NEW."kind"::TEXT THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation kind does not match the correction kind';
  END IF;
  IF replacement_record."shsClassification"::TEXT IS DISTINCT FROM NEW."kind"::TEXT THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation kind does not match the correction kind';
  END IF;
  IF replacement_record."createdById" IS DISTINCT FROM NEW."correctedById" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation actor does not match the correction actor';
  END IF;

  replacement_xmin_status := pg_xact_status(replacement_record.xmin::TEXT::xid8)::TEXT;
  IF replacement_xmin_status <> 'in progress' THEN
    RAISE EXCEPTION '%', format(
      'SHS Student Participation Correction replacement participation must be new: xmin=%s, pg_xact_status=%s, txid_current_if_assigned=%s, pg_backend_pid=%s',
      replacement_record.xmin::TEXT,
      replacement_xmin_status,
      COALESCE(txid_current_if_assigned()::TEXT, 'NULL'),
      pg_backend_pid()
    );
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ShsTermResult"
    WHERE "studentSubjectEnrollmentId" = source_record."id"
  ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation has immutable result evidence';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "ShsTermResult"
    WHERE "studentSubjectEnrollmentId" = replacement_record."id"
  ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation has immutable result evidence';
  END IF;

  SELECT "academicYearId", "endDate" INTO source_term_year_id, source_term_end_date
  FROM "AcademicTerm" WHERE "id" = NEW."sourceAcademicTermId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source Academic Term does not exist';
  END IF;
  SELECT "academicYearId" INTO replacement_term_year_id
  FROM "AcademicTerm" WHERE "id" = NEW."replacementAcademicTermId";
  IF NOT FOUND THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement Academic Term does not exist';
  END IF;
  IF source_term_year_id IS DISTINCT FROM enrollment_record."academicYearId" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source Academic Term must belong to the Enrollment Academic Year';
  END IF;
  IF replacement_term_year_id IS DISTINCT FROM enrollment_record."academicYearId" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement Academic Term must belong to the Enrollment Academic Year';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollmentTerm"
    WHERE "studentSubjectEnrollmentId" = source_record."id"
      AND "academicTermId" = NEW."sourceAcademicTermId"
  ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation lacks its source Academic Term membership';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "StudentSubjectEnrollmentTerm"
    WHERE "studentSubjectEnrollmentId" = replacement_record."id"
      AND "academicTermId" = NEW."replacementAcademicTermId"
  ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation lacks its replacement Academic Term membership';
  END IF;
  IF source_term_end_date < (NEW."correctedAt" AT TIME ZONE 'Asia/Manila')::DATE THEN
    RAISE EXCEPTION 'SHS Student Participation Correction cannot create retrospective Term membership';
  END IF;

  IF NEW."kind" = 'CORE' AND (
       source_record."selectionAcademicTermId" IS NOT NULL
       OR replacement_record."selectionAcademicTermId" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'SHS Core correction participation cannot have a selection Academic Term';
  ELSIF NEW."kind" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') AND (
        source_record."selectionAcademicTermId" IS DISTINCT FROM NEW."sourceAcademicTermId"
        OR replacement_record."selectionAcademicTermId" IS DISTINCT FROM NEW."replacementAcademicTermId"
        OR source_record."shsClusterCode" IS NULL OR source_record."shsClusterName" IS NULL
      ) THEN
    RAISE EXCEPTION 'SHS elective correction participation must retain its exact selection Academic Term';
  END IF;

  IF NEW."sourceParticipationSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_participation_snapshot"(source_record."id") THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source participation snapshot does not match current database facts';
  END IF;
  IF NEW."replacementParticipationSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_participation_snapshot"(replacement_record."id") THEN
    RAISE EXCEPTION 'SHS Student Participation Correction replacement participation snapshot does not match current database facts';
  END IF;
  IF NEW."plannedTermScopeSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_term_scope_snapshot"(
         source_record."id", NEW."sourceAcademicTermId",
         replacement_record."id", NEW."replacementAcademicTermId"
       ) THEN
    RAISE EXCEPTION 'SHS Student Participation Correction Term scope snapshot does not match current membership facts';
  END IF;
  IF NEW."sourceResultStateSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_result_state_snapshot"(source_record."id") THEN
    RAISE EXCEPTION 'SHS Student Participation Correction source result snapshot does not match current result facts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
