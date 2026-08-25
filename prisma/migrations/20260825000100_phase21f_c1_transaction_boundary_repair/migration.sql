CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_execute"(
  p_enrollment_id TEXT,
  p_source_student_subject_enrollment_id TEXT,
  p_source_academic_term_id TEXT,
  p_replacement_subject_offering_id TEXT,
  p_reason TEXT,
  p_evidence_reference TEXT,
  p_actor_id TEXT,
  p_correction_id TEXT,
  p_correction_audit_id TEXT,
  p_source_audit_id TEXT,
  p_replacement_audit_id TEXT
)
RETURNS TABLE (
  "correctionId" TEXT,
  "replacementStudentSubjectEnrollmentId" TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_student_id TEXT;
  v_academic_year_id TEXT;
  v_grade_level TEXT;
  v_entry_academic_term_id TEXT;
  v_shs_track "EnrollmentShsTrack";
  v_enrollment_status "EnrollmentStatus";
  v_enrollment_deleted_at TIMESTAMP(3);
  v_academic_year_status "AcademicYearStatus";
  v_source "StudentSubjectEnrollment"%ROWTYPE;
  v_offering "SubjectOffering"%ROWTYPE;
  v_kind "ShsStudentParticipationCorrectionKind";
  v_source_term_position INTEGER;
  v_source_term_end_date DATE;
  v_replacement_id TEXT := 'c' || md5(clock_timestamp()::TEXT || random()::TEXT || pg_backend_pid()::TEXT);
  v_corrected_at TIMESTAMP(3) := CURRENT_TIMESTAMP;
  v_planned_term_ids TEXT[];
  v_source_term_ids TEXT[];
  v_source_snapshot JSONB;
  v_replacement_snapshot JSONB;
  v_term_scope_snapshot JSONB;
  v_result_snapshot JSONB;
  v_policy_minimum INTEGER;
  v_policy_maximum INTEGER;
  v_active_elective_count INTEGER;
BEGIN
  -- Keep this order aligned with C1 progression and result operations.
  SELECT enrollment."studentId"
  INTO v_student_id
  FROM "Enrollment" enrollment
  WHERE enrollment."id" = p_enrollment_id
  FOR SHARE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment not found';
  END IF;

  PERFORM 1 FROM "Student" WHERE "id" = v_student_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment changed. Refresh and try again.';
  END IF;

  SELECT enrollment."academicYearId", enrollment."status", enrollment."deletedAt",
         enrollment."entryAcademicTermId", enrollment."shsTrack", section."gradeLevel",
         academic_year."status"
  INTO v_academic_year_id, v_enrollment_status, v_enrollment_deleted_at,
       v_entry_academic_term_id, v_shs_track, v_grade_level, v_academic_year_status
  FROM "Enrollment" enrollment
  JOIN "Section" section ON section."id" = enrollment."sectionId"
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  WHERE enrollment."id" = p_enrollment_id
    AND enrollment."studentId" = v_student_id
  FOR UPDATE OF enrollment;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment changed. Refresh and try again.';
  END IF;

  PERFORM 1 FROM "AcademicYear" WHERE "id" = v_academic_year_id FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Enrollment changed. Refresh and try again.';
  END IF;

  SELECT * INTO v_source
  FROM "StudentSubjectEnrollment"
  WHERE "id" = p_source_student_subject_enrollment_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source participation or replacement Offering was not found.';
  END IF;

  SELECT term."position", term."endDate"
  INTO v_source_term_position, v_source_term_end_date
  FROM "StudentSubjectEnrollmentTerm" membership
  JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
  WHERE membership."studentSubjectEnrollmentId" = v_source."id"
    AND membership."academicTermId" = p_source_academic_term_id
  FOR UPDATE OF membership;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'The source participation does not contain the affected Academic Term.';
  END IF;

  PERFORM 1
  FROM "StudentSubjectEnrollmentTerm" membership
  JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
  WHERE membership."studentSubjectEnrollmentId" = v_source."id"
  ORDER BY term."position", membership."academicTermId"
  FOR UPDATE OF membership;

  PERFORM 1
  FROM "ShsTermResult"
  WHERE "studentSubjectEnrollmentId" = v_source."id"
  ORDER BY "academicTermId", "id"
  FOR UPDATE;

  SELECT * INTO v_offering
  FROM "SubjectOffering"
  WHERE "id" = p_replacement_subject_offering_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source participation or replacement Offering was not found.';
  END IF;

  PERFORM 1 FROM "SubjectOfferingShsContext"
  WHERE "subjectOfferingId" = v_offering."id" FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Replacement must be an active, school-approved SHS Offering with matching classification and active cluster context.';
  END IF;

  PERFORM 1
  FROM "ShsCurriculumCluster" cluster
  JOIN "SubjectOfferingShsContext" context ON context."clusterId" = cluster."id"
  WHERE context."subjectOfferingId" = v_offering."id"
  FOR UPDATE OF cluster;

  PERFORM 1
  FROM "SubjectOfferingTerm" membership
  JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
  WHERE membership."subjectOfferingId" = v_offering."id"
  ORDER BY term."position", membership."academicTermId"
  FOR SHARE OF membership, term;

  IF v_source."enrollmentId" IS DISTINCT FROM p_enrollment_id
    OR v_source."status" <> 'ACTIVE'
    OR v_source."gradeLevel" IS DISTINCT FROM v_grade_level
    OR v_source."shsClassification" IS NULL
    OR v_source."shsCurriculumStatus" <> 'SCHOOL_APPROVED'
    OR NULLIF(BTRIM(v_source."shsSourceReference", E' \t\n\r\f\v'), '') IS NULL
    OR NULLIF(BTRIM(v_source."shsApprovalReference", E' \t\n\r\f\v'), '') IS NULL
    OR v_enrollment_status <> 'ACTIVE'
    OR v_enrollment_deleted_at IS NOT NULL
    OR v_academic_year_status <> 'ACTIVE'
    OR v_grade_level NOT IN ('11', '12')
    OR v_entry_academic_term_id IS NULL
    OR v_shs_track IS NULL THEN
    RAISE EXCEPTION 'SHS participation correction requires an active Grade 11 or 12 Enrollment with immutable entry Term and track facts.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollmentTerm" membership
    JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
    WHERE membership."studentSubjectEnrollmentId" = v_source."id"
      AND term."academicYearId" <> v_academic_year_id
  ) OR EXISTS (
    SELECT 1 FROM "ShsTermResult" WHERE "studentSubjectEnrollmentId" = v_source."id"
  ) THEN
    RAISE EXCEPTION 'Source participation has immutable result evidence or an Academic Term outside the Enrollment year.';
  END IF;

  SELECT context."classification"::TEXT::"ShsStudentParticipationCorrectionKind"
  INTO v_kind
  FROM "SubjectOfferingShsContext" context
  LEFT JOIN "ShsCurriculumCluster" cluster ON cluster."id" = context."clusterId"
  WHERE context."subjectOfferingId" = v_offering."id"
    AND v_offering."deletedAt" IS NULL
    AND v_offering."academicYearId" = v_academic_year_id
    AND v_offering."gradeLevel" = v_grade_level
    AND context."curriculumStatus" = 'SCHOOL_APPROVED'
    AND NULLIF(BTRIM(context."sourceReference", E' \t\n\r\f\v'), '') IS NOT NULL
    AND NULLIF(BTRIM(context."approvalReference", E' \t\n\r\f\v'), '') IS NOT NULL
    AND context."classification" IS NOT DISTINCT FROM v_source."shsClassification"
    AND (context."classification" = 'CORE' OR (context."clusterId" IS NOT NULL AND cluster."deletedAt" IS NULL));

  IF NOT FOUND
    OR (v_source."shsClassification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
        AND (v_source."shsClusterCode" IS NULL OR v_source."shsClusterName" IS NULL)) THEN
    RAISE EXCEPTION 'Replacement must be an active, school-approved SHS Offering with matching classification and active cluster context.';
  END IF;

  SELECT array_agg(membership."academicTermId" ORDER BY term."position", membership."academicTermId")
  INTO v_source_term_ids
  FROM "StudentSubjectEnrollmentTerm" membership
  JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
  WHERE membership."studentSubjectEnrollmentId" = v_source."id";

  SELECT array_agg(membership."academicTermId" ORDER BY term."position", membership."academicTermId")
  INTO v_planned_term_ids
  FROM "StudentSubjectEnrollmentTerm" membership
  JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
  WHERE membership."studentSubjectEnrollmentId" = v_source."id"
    AND (v_kind <> 'CORE' OR term."position" >= v_source_term_position);

  IF v_kind <> 'CORE' AND (v_source."selectionAcademicTermId" IS DISTINCT FROM p_source_academic_term_id OR cardinality(v_source_term_ids) <> 1) THEN
    RAISE EXCEPTION 'Elective correction requires an exact one-Term source participation identity.';
  ELSIF v_kind = 'CORE' AND v_source."selectionAcademicTermId" IS NOT NULL THEN
    RAISE EXCEPTION 'Core correction cannot use a selected-elective Term identity.';
  END IF;

  IF cardinality(v_planned_term_ids) = 0 OR EXISTS (
    SELECT 1 FROM unnest(v_planned_term_ids) AS planned("academicTermId")
    WHERE NOT EXISTS (
      SELECT 1 FROM "SubjectOfferingTerm" offering_term
      WHERE offering_term."subjectOfferingId" = v_offering."id"
        AND offering_term."academicTermId" = planned."academicTermId"
    )
  ) THEN
    RAISE EXCEPTION 'Replacement Offering does not cover the exact safe correction Term scope.';
  END IF;

  IF (v_corrected_at AT TIME ZONE 'Asia/Manila')::DATE > v_source_term_end_date THEN
    RAISE EXCEPTION 'Correction cannot create replacement membership for a completed Academic Term.';
  END IF;

  IF v_kind IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') THEN
    SELECT "minimumElectives", "maximumElectives"
    INTO v_policy_minimum, v_policy_maximum
    FROM "ShsElectiveEnrollmentPolicy"
    WHERE "academicYearId" = v_academic_year_id
      AND "academicTermId" = p_source_academic_term_id
      AND "gradeLevel" = v_grade_level
    FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'An SHS elective policy is required for the affected Term and grade.';
    END IF;
  END IF;

  PERFORM 1 FROM "StudentSubjectEnrollment"
  WHERE "enrollmentId" = p_enrollment_id
    AND "shsCurriculumStatus" IS NOT NULL
  ORDER BY "id" FOR SHARE;
  PERFORM 1 FROM "ShsStudentParticipationCorrection"
  WHERE "enrollmentId" = p_enrollment_id
  ORDER BY "id" FOR SHARE;

  IF EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    JOIN "StudentSubjectEnrollmentTerm" membership ON membership."studentSubjectEnrollmentId" = participation."id"
    WHERE participation."enrollmentId" = p_enrollment_id
      AND participation."status" = 'ACTIVE'
      AND participation."subjectOfferingId" = v_offering."id"
      AND membership."academicTermId" = ANY(v_planned_term_ids)
  ) THEN
    RAISE EXCEPTION 'Replacement Offering already has active participation in the affected Term scope.';
  END IF;

  IF EXISTS (
    WITH RECURSIVE lineage AS (
      SELECT offering."replacesSubjectOfferingId" AS "ancestorOfferingId",
             CASE
               WHEN current_context."classification" = 'CORE' AND predecessor_context."classification" = 'CORE' THEN 'CORE'
               WHEN current_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
                AND predecessor_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') THEN 'ELECTIVE'
               ELSE NULL
             END AS "continuationKind"
      FROM "SubjectOffering" offering
      JOIN "SubjectOfferingShsContext" current_context ON current_context."subjectOfferingId" = offering."id"
      JOIN "SubjectOfferingShsContext" predecessor_context ON predecessor_context."subjectOfferingId" = offering."replacesSubjectOfferingId"
      WHERE offering."id" = v_offering."id" AND offering."replacesSubjectOfferingId" IS NOT NULL
      UNION ALL
      SELECT predecessor."replacesSubjectOfferingId", lineage."continuationKind"
      FROM lineage
      JOIN "SubjectOffering" predecessor ON predecessor."id" = lineage."ancestorOfferingId"
      JOIN "SubjectOfferingShsContext" next_context ON next_context."subjectOfferingId" = predecessor."replacesSubjectOfferingId"
      WHERE predecessor."replacesSubjectOfferingId" IS NOT NULL
        AND ((lineage."continuationKind" = 'CORE' AND next_context."classification" = 'CORE')
          OR (lineage."continuationKind" = 'ELECTIVE' AND next_context."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')))
    )
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    WHERE participation."enrollmentId" = p_enrollment_id
      AND participation."status" = 'DROPPED'
      AND (participation."subjectOfferingId" = v_offering."id"
        OR participation."subjectOfferingId" IN (SELECT "ancestorOfferingId" FROM lineage WHERE "continuationKind" IS NOT NULL))
  ) OR EXISTS (
    SELECT 1 FROM "ShsStudentParticipationCorrection"
    WHERE "sourceStudentSubjectEnrollmentId" = v_source."id"
  ) THEN
    RAISE EXCEPTION 'A DROPPED Offering, compatible ancestor, or already-corrected participation cannot be corrected.';
  END IF;

  IF v_kind IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') THEN
    SELECT COUNT(*) INTO v_active_elective_count
    FROM "StudentSubjectEnrollment" participation
    JOIN "StudentSubjectEnrollmentTerm" membership ON membership."studentSubjectEnrollmentId" = participation."id"
    WHERE participation."enrollmentId" = p_enrollment_id
      AND participation."status" = 'ACTIVE'
      AND participation."shsClassification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
      AND membership."academicTermId" = p_source_academic_term_id;
    IF v_active_elective_count < v_policy_minimum OR v_active_elective_count > v_policy_maximum THEN
      RAISE EXCEPTION 'Existing affected-Term elective participation is outside the approved policy range.';
    END IF;
  END IF;

  v_source_snapshot := "ShsStudentParticipationCorrection_participation_snapshot"(v_source."id");
  v_result_snapshot := "ShsStudentParticipationCorrection_result_state_snapshot"(v_source."id");

  INSERT INTO "StudentSubjectEnrollment" (
    "id", "enrollmentId", "subjectOfferingId", "selectionAcademicTermId", "subjectCode", "subjectDescription",
    "gradeLevel", "shsClassification", "shsClusterCode", "shsClusterName", "shsCurriculumStatus",
    "shsSourceReference", "shsApprovalReference", "status", "createdById", "createdAt", "updatedAt"
  )
  SELECT v_replacement_id, p_enrollment_id, v_offering."id",
         CASE WHEN v_kind = 'CORE' THEN NULL ELSE p_source_academic_term_id END,
         v_offering."subjectCode", v_offering."subjectDescription", v_offering."gradeLevel", context."classification",
         cluster."code", cluster."name", context."curriculumStatus", context."sourceReference", context."approvalReference",
         'ACTIVE', p_actor_id, v_corrected_at, v_corrected_at
  FROM "SubjectOfferingShsContext" context
  LEFT JOIN "ShsCurriculumCluster" cluster ON cluster."id" = context."clusterId"
  WHERE context."subjectOfferingId" = v_offering."id";

  INSERT INTO "StudentSubjectEnrollmentTerm" ("studentSubjectEnrollmentId", "academicTermId")
  SELECT v_replacement_id, unnest(v_planned_term_ids);

  v_replacement_snapshot := "ShsStudentParticipationCorrection_participation_snapshot"(v_replacement_id);
  v_term_scope_snapshot := "ShsStudentParticipationCorrection_term_scope_snapshot"(
    v_source."id", p_source_academic_term_id, v_replacement_id, p_source_academic_term_id
  );

  PERFORM set_config('nemesys.shs_student_participation_correction_id', p_correction_id, true);

  INSERT INTO "ShsStudentParticipationCorrection" (
    "id", "enrollmentId", "sourceStudentSubjectEnrollmentId", "sourceAcademicTermId",
    "replacementStudentSubjectEnrollmentId", "replacementAcademicTermId", "kind", "reason", "evidenceReference",
    "sourceParticipationSnapshot", "replacementParticipationSnapshot", "plannedTermScopeSnapshot", "sourceResultStateSnapshot",
    "correctedById", "correctedAt", "createdAt"
  ) VALUES (
    p_correction_id, p_enrollment_id, v_source."id", p_source_academic_term_id,
    v_replacement_id, p_source_academic_term_id, v_kind, p_reason, p_evidence_reference,
    v_source_snapshot, v_replacement_snapshot, v_term_scope_snapshot, v_result_snapshot,
    p_actor_id, v_corrected_at, v_corrected_at
  );

  UPDATE "StudentSubjectEnrollment"
  SET "status" = 'REPLACED', "replacedAt" = v_corrected_at, "updatedAt" = v_corrected_at
  WHERE "id" = v_source."id" AND "status" = 'ACTIVE';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Source participation changed. Refresh and try again.';
  END IF;

  INSERT INTO "AuditLog" ("id", "userId", "action", "module", "recordId", "recordName", "description", "metadata", "createdAt")
  VALUES
    (p_correction_audit_id, p_actor_id, 'CREATE', 'ShsStudentParticipationCorrection', p_correction_id,
      p_enrollment_id || ' - ' || v_source."subjectCode", 'Recorded a controlled SHS student participation correction.',
      jsonb_build_object('enrollmentId', p_enrollment_id, 'sourceStudentSubjectEnrollmentId', v_source."id", 'replacementStudentSubjectEnrollmentId', v_replacement_id, 'academicTermIds', to_jsonb(v_planned_term_ids), 'kind', v_kind, 'reason', p_reason, 'evidenceReference', p_evidence_reference), v_corrected_at),
    (p_source_audit_id, p_actor_id, 'UPDATE', 'StudentSubjectEnrollment', v_source."id", v_source."subjectCode",
      'Replaced SHS source participation through a controlled student correction.',
      jsonb_build_object('correctionId', p_correction_id, 'status', jsonb_build_object('from', 'ACTIVE', 'to', 'REPLACED')), v_corrected_at),
    (p_replacement_audit_id, p_actor_id, 'CREATE', 'StudentSubjectEnrollment', v_replacement_id, v_offering."subjectCode",
      'Created replacement SHS participation through a controlled student correction.',
      jsonb_build_object('correctionId', p_correction_id, 'sourceStudentSubjectEnrollmentId', v_source."id", 'academicTermIds', to_jsonb(v_planned_term_ids)), v_corrected_at);

  SET CONSTRAINTS "ShsStudentParticipationCorrection_completion_trigger", "ShsStudentParticipationCorrection_revalidation_trigger", "ShsStudentParticipationCorrection_term_revalidation_trigger", "ShsStudentParticipationCorrection_result_revalidation_trigger" IMMEDIATE;
  SET CONSTRAINTS "ShsStudentParticipationCorrection_completion_trigger", "ShsStudentParticipationCorrection_revalidation_trigger", "ShsStudentParticipationCorrection_term_revalidation_trigger", "ShsStudentParticipationCorrection_result_revalidation_trigger" DEFERRED;

  RETURN QUERY SELECT p_correction_id, v_replacement_id;
END;
$$;
