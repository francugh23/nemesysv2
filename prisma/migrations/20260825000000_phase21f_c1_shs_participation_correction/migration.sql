CREATE TYPE "ShsStudentParticipationCorrectionKind" AS ENUM (
  'CORE',
  'ACADEMIC_ELECTIVE',
  'TECHPRO_ELECTIVE'
);

CREATE TABLE "ShsStudentParticipationCorrection" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "sourceStudentSubjectEnrollmentId" TEXT NOT NULL,
  "sourceAcademicTermId" TEXT NOT NULL,
  "replacementStudentSubjectEnrollmentId" TEXT NOT NULL,
  "replacementAcademicTermId" TEXT NOT NULL,
  "kind" "ShsStudentParticipationCorrectionKind" NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "sourceParticipationSnapshot" JSONB NOT NULL,
  "replacementParticipationSnapshot" JSONB NOT NULL,
  "plannedTermScopeSnapshot" JSONB NOT NULL,
  "sourceResultStateSnapshot" JSONB NOT NULL,
  "correctedById" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ShsStudentParticipationCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ShsStudentParticipationCorrection_distinct_participations_check"
    CHECK ("sourceStudentSubjectEnrollmentId" <> "replacementStudentSubjectEnrollmentId"),
  CONSTRAINT "ShsStudentParticipationCorrection_same_term_check"
    CHECK ("sourceAcademicTermId" = "replacementAcademicTermId"),
  CONSTRAINT "ShsStudentParticipationCorrection_reason_check"
    CHECK (
      NULLIF(BTRIM("reason", E' \t\n\r\f\v'), '') IS NOT NULL
      AND "reason" = BTRIM("reason", E' \t\n\r\f\v')
      AND CHAR_LENGTH("reason") <= 500
    ),
  CONSTRAINT "ShsStudentParticipationCorrection_evidence_check"
    CHECK (
      NULLIF(BTRIM("evidenceReference", E' \t\n\r\f\v'), '') IS NOT NULL
      AND "evidenceReference" = BTRIM("evidenceReference", E' \t\n\r\f\v')
      AND CHAR_LENGTH("evidenceReference") <= 500
    )
);

CREATE UNIQUE INDEX "ShsStudentParticipationCorrection_sequence_key"
  ON "ShsStudentParticipationCorrection"("sequence");
CREATE UNIQUE INDEX "ShsStudentParticipationCorrection_source_sse_key"
  ON "ShsStudentParticipationCorrection"("sourceStudentSubjectEnrollmentId");
CREATE UNIQUE INDEX "ShsStudentParticipationCorrection_replacement_sse_key"
  ON "ShsStudentParticipationCorrection"("replacementStudentSubjectEnrollmentId");
CREATE UNIQUE INDEX "ShsStudentParticipationCorrection_source_term_key"
  ON "ShsStudentParticipationCorrection"("sourceStudentSubjectEnrollmentId", "sourceAcademicTermId");
CREATE UNIQUE INDEX "ShsStudentParticipationCorrection_replacement_term_key"
  ON "ShsStudentParticipationCorrection"("replacementStudentSubjectEnrollmentId", "replacementAcademicTermId");
CREATE INDEX "ShsStudentParticipationCorrection_enrollmentId_correctedAt_idx"
  ON "ShsStudentParticipationCorrection"("enrollmentId", "correctedAt");
CREATE INDEX "ShsStudentParticipationCorrection_correctedById_idx"
  ON "ShsStudentParticipationCorrection"("correctedById");

ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_sourceSseId_fkey"
  FOREIGN KEY ("sourceStudentSubjectEnrollmentId") REFERENCES "StudentSubjectEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_replacementSseId_fkey"
  FOREIGN KEY ("replacementStudentSubjectEnrollmentId") REFERENCES "StudentSubjectEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_sourceTerm_fkey"
  FOREIGN KEY ("sourceAcademicTermId") REFERENCES "AcademicTerm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_replacementTerm_fkey"
  FOREIGN KEY ("replacementAcademicTermId") REFERENCES "AcademicTerm"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_sourceMembership_fkey"
  FOREIGN KEY ("sourceStudentSubjectEnrollmentId", "sourceAcademicTermId")
  REFERENCES "StudentSubjectEnrollmentTerm"("studentSubjectEnrollmentId", "academicTermId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_replacementMembership_fkey"
  FOREIGN KEY ("replacementStudentSubjectEnrollmentId", "replacementAcademicTermId")
  REFERENCES "StudentSubjectEnrollmentTerm"("studentSubjectEnrollmentId", "academicTermId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ShsStudentParticipationCorrection"
  ADD CONSTRAINT "ShsStudentParticipationCorrection_correctedById_fkey"
  FOREIGN KEY ("correctedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_context_id"()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('nemesys.shs_student_participation_correction_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_event_is_active"(correction_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "ShsStudentParticipationCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory'
     AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted
     AND transaction_lock.classid = 2108::OID
     AND transaction_lock.objid = correction."sequence"::OID
     AND transaction_lock.objsubid = 2
    WHERE correction."id" = correction_id
      AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_participation_snapshot"(
  participation_id TEXT
)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'id', participation."id",
    'enrollmentId', participation."enrollmentId",
    'subjectOfferingId', participation."subjectOfferingId",
    'selectionAcademicTermId', participation."selectionAcademicTermId",
    'subjectCode', participation."subjectCode",
    'subjectDescription', participation."subjectDescription",
    'gradeLevel', participation."gradeLevel",
    'shsClassification', participation."shsClassification",
    'shsClusterCode', participation."shsClusterCode",
    'shsClusterName', participation."shsClusterName",
    'shsCurriculumStatus', participation."shsCurriculumStatus",
    'shsSourceReference', participation."shsSourceReference",
    'shsApprovalReference', participation."shsApprovalReference",
    'status', participation."status",
    'academicTermIds', COALESCE((
      SELECT jsonb_agg(membership."academicTermId" ORDER BY term."position", term."id")
      FROM "StudentSubjectEnrollmentTerm" membership
      JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
      WHERE membership."studentSubjectEnrollmentId" = participation."id"
    ), '[]'::JSONB)
  )
  FROM "StudentSubjectEnrollment" participation
  WHERE participation."id" = participation_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_term_scope_snapshot"(
  source_participation_id TEXT,
  source_term_id TEXT,
  replacement_participation_id TEXT,
  replacement_term_id TEXT
)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'sourceAcademicTermId', source_term_id,
    'replacementAcademicTermId', replacement_term_id,
    'sourceAcademicTermIds', COALESCE((
      SELECT jsonb_agg(membership."academicTermId" ORDER BY term."position", term."id")
      FROM "StudentSubjectEnrollmentTerm" membership
      JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
      WHERE membership."studentSubjectEnrollmentId" = source_participation_id
    ), '[]'::JSONB),
    'replacementAcademicTermIds', COALESCE((
      SELECT jsonb_agg(membership."academicTermId" ORDER BY term."position", term."id")
      FROM "StudentSubjectEnrollmentTerm" membership
      JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
      WHERE membership."studentSubjectEnrollmentId" = replacement_participation_id
    ), '[]'::JSONB)
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_result_state_snapshot"(
  participation_id TEXT
)
RETURNS JSONB AS $$
  SELECT COALESCE(jsonb_agg(
    jsonb_build_object(
      'id', result."id",
      'academicTermId', result."academicTermId",
      'finalResult', result."finalResult",
      'status', result."status",
      'createdById', result."createdById",
      'finalizedById', result."finalizedById",
      'finalizedAt', result."finalizedAt",
      'createdAt', result."createdAt",
      'updatedAt', result."updatedAt"
    ) ORDER BY term."position", result."academicTermId", result."id"
  ), '[]'::JSONB)
  FROM "ShsTermResult" result
  JOIN "AcademicTerm" term ON term."id" = result."academicTermId"
  WHERE result."studentSubjectEnrollmentId" = participation_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_lock_transaction"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."sequence" > 2147483647 THEN
    RAISE EXCEPTION 'SHS Student Participation Correction sequence exceeds transaction lock capacity';
  END IF;
  PERFORM pg_advisory_xact_lock(2108, NEW."sequence"::INTEGER);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsStudentParticipationCorrection_00_lock_transaction_trigger"
BEFORE INSERT ON "ShsStudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_lock_transaction"();

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_assert_context"()
RETURNS TRIGGER AS $$
BEGIN
  IF "ShsStudentParticipationCorrection_context_id"() IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires its exact transaction context';
  END IF;
  IF NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '') IS NOT NULL
    OR "StudentEnrollmentGradeCorrection_context_id"() IS NOT NULL
    OR NULLIF(current_setting('nemesys.shs_progressive_core_replacement_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Student Participation Correction capabilities cannot be composed across domains';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsStudentParticipationCorrection_01_assert_context_trigger"
BEFORE INSERT ON "ShsStudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_assert_context"();

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  source_record "StudentSubjectEnrollment"%ROWTYPE;
  replacement_record "StudentSubjectEnrollment"%ROWTYPE;
  source_term_year_id TEXT;
  replacement_term_year_id TEXT;
  source_term_end_date DATE;
BEGIN
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
  IF NOT FOUND OR enrollment_record."status" <> 'ACTIVE'
    OR enrollment_record."deletedAt" IS NOT NULL
    OR enrollment_record."academicYearStatus" <> 'ACTIVE'
    OR enrollment_record."sectionGradeLevel" NOT IN ('11', '12') THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires an active Grade 11 or 12 Enrollment in the active Academic Year';
  END IF;

  SELECT * INTO source_record FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."sourceStudentSubjectEnrollmentId" FOR UPDATE;
  SELECT * INTO replacement_record FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."replacementStudentSubjectEnrollmentId" FOR UPDATE;
  SELECT "academicYearId" INTO source_term_year_id FROM "AcademicTerm" WHERE "id" = NEW."sourceAcademicTermId";
  SELECT "academicYearId" INTO replacement_term_year_id FROM "AcademicTerm" WHERE "id" = NEW."replacementAcademicTermId";
  SELECT "endDate" INTO source_term_end_date FROM "AcademicTerm" WHERE "id" = NEW."sourceAcademicTermId";

  IF source_record."id" IS NULL OR replacement_record."id" IS NULL
    OR source_record."enrollmentId" IS DISTINCT FROM NEW."enrollmentId"
    OR replacement_record."enrollmentId" IS DISTINCT FROM NEW."enrollmentId"
     OR source_record."status" <> 'ACTIVE' OR replacement_record."status" <> 'ACTIVE'
     OR source_record."gradeLevel" NOT IN ('11', '12')
     OR replacement_record."gradeLevel" IS DISTINCT FROM source_record."gradeLevel"
     OR source_record."shsCurriculumStatus" <> 'SCHOOL_APPROVED'
     OR NULLIF(BTRIM(source_record."shsSourceReference", E' \t\n\r\f\v'), '') IS NULL
     OR NULLIF(BTRIM(source_record."shsApprovalReference", E' \t\n\r\f\v'), '') IS NULL
     OR source_record."shsClassification"::TEXT IS DISTINCT FROM NEW."kind"::TEXT
    OR replacement_record."shsClassification"::TEXT IS DISTINCT FROM NEW."kind"::TEXT
    OR replacement_record."createdById" IS DISTINCT FROM NEW."correctedById"
    OR pg_xact_status(replacement_record.xmin::TEXT::xid8) <> 'in progress'
    OR source_term_year_id IS DISTINCT FROM enrollment_record."academicYearId"
     OR replacement_term_year_id IS DISTINCT FROM enrollment_record."academicYearId" THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires exact active same-year source and new replacement participation';
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
       "ShsStudentParticipationCorrection_participation_snapshot"(source_record."id")
    OR NEW."replacementParticipationSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_participation_snapshot"(replacement_record."id")
    OR NEW."plannedTermScopeSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_term_scope_snapshot"(
         source_record."id", NEW."sourceAcademicTermId",
         replacement_record."id", NEW."replacementAcademicTermId"
       )
    OR NEW."sourceResultStateSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_result_state_snapshot"(source_record."id") THEN
    RAISE EXCEPTION 'SHS Student Participation Correction snapshots do not match current database facts';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsStudentParticipationCorrection_zz_assert_intent_trigger"
BEFORE INSERT ON "ShsStudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_assert_intent"();

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_assert_active_event"()
RETURNS TRIGGER AS $$
BEGIN
  IF NOT "ShsStudentParticipationCorrection_event_is_active"(NEW."id") THEN
    RAISE EXCEPTION 'SHS Student Participation Correction requires an in-progress event';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsStudentParticipationCorrection_assert_active_event_trigger"
AFTER INSERT ON "ShsStudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_assert_active_event"();

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_assert_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'SHS Student Participation Correction records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "ShsStudentParticipationCorrection_assert_immutable_trigger"
BEFORE UPDATE OR DELETE ON "ShsStudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_assert_immutable"();

CREATE OR REPLACE FUNCTION "StudentSubjectEnrollment_assert_lifecycle_transition"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  progressive_replacement_id TEXT;
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
      SELECT 1 FROM "StudentEnrollmentGradeCorrection" correction
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
  ELSIF OLD."status" = 'ACTIVE' AND NEW."status" = 'REPLACED'
    AND OLD."gradeLevel" IN ('11', '12') THEN
    progressive_replacement_id := NULLIF(current_setting('nemesys.shs_progressive_core_replacement_id', true), '');
    IF OLD."shsClassification" = 'CORE' AND progressive_replacement_id = OLD."id" THEN
      NULL;
    ELSE
      correction_id := "ShsStudentParticipationCorrection_context_id"();
      IF correction_id IS NULL OR NOT EXISTS (
        SELECT 1 FROM "ShsStudentParticipationCorrection" correction
        WHERE correction."id" = correction_id
          AND correction."enrollmentId" = OLD."enrollmentId"
          AND correction."sourceStudentSubjectEnrollmentId" = OLD."id"
          AND correction."correctedAt" = NEW."replacedAt"
          AND correction."kind"::TEXT = OLD."shsClassification"::TEXT
          AND "ShsStudentParticipationCorrection_event_is_active"(correction."id")
      ) THEN
        RAISE EXCEPTION 'SHS Student Subject Enrollment replacement requires its exact active participation correction mapping';
      END IF;
    END IF;
  END IF;

  IF NEW."selectionAcademicTermId" IS DISTINCT FROM OLD."selectionAcademicTermId" THEN
    RAISE EXCEPTION 'Student Subject Enrollment selection Academic Term is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "ShsStudentParticipationCorrection_validate_completion"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
BEGIN
  IF TG_TABLE_NAME = 'ShsStudentParticipationCorrection' THEN
    correction_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollment' THEN
    SELECT correction."id" INTO correction_id
    FROM "ShsStudentParticipationCorrection" correction
    WHERE NEW."id" IN (correction."sourceStudentSubjectEnrollmentId", correction."replacementStudentSubjectEnrollmentId")
      AND "ShsStudentParticipationCorrection_event_is_active"(correction."id")
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollmentTerm' THEN
    SELECT correction."id" INTO correction_id
    FROM "ShsStudentParticipationCorrection" correction
    WHERE (
        (correction."sourceStudentSubjectEnrollmentId" = NEW."studentSubjectEnrollmentId"
         AND correction."sourceAcademicTermId" = NEW."academicTermId")
        OR (correction."replacementStudentSubjectEnrollmentId" = NEW."studentSubjectEnrollmentId"
            AND correction."replacementAcademicTermId" = NEW."academicTermId")
      )
      AND "ShsStudentParticipationCorrection_event_is_active"(correction."id")
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'ShsTermResult' THEN
    SELECT correction."id" INTO correction_id
    FROM "ShsStudentParticipationCorrection" correction
    WHERE (
        correction."sourceStudentSubjectEnrollmentId" = NEW."studentSubjectEnrollmentId"
        OR correction."replacementStudentSubjectEnrollmentId" = NEW."studentSubjectEnrollmentId"
      )
      AND "ShsStudentParticipationCorrection_event_is_active"(correction."id")
    ORDER BY correction."sequence" DESC LIMIT 1;
  END IF;
  IF correction_id IS NULL THEN RETURN NULL; END IF;

  SELECT correction.*, enrollment."academicYearId", enrollment."status" AS "enrollmentStatus",
         enrollment."deletedAt" AS "enrollmentDeletedAt", section."gradeLevel" AS "sectionGradeLevel",
         source."enrollmentId" AS "sourceEnrollmentId", source."status" AS "sourceStatus",
         source."gradeLevel" AS "sourceGradeLevel", source."shsClassification" AS "sourceKind",
         source."replacedAt" AS "sourceReplacedAt", source."droppedAt" AS "sourceDroppedAt",
         replacement."enrollmentId" AS "replacementEnrollmentId", replacement."status" AS "replacementStatus",
         replacement."gradeLevel" AS "replacementGradeLevel", replacement."shsClassification" AS "replacementKind",
         replacement."droppedAt" AS "replacementDroppedAt", replacement."createdById" AS "replacementCreatedById"
  INTO correction_record
  FROM "ShsStudentParticipationCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "Section" section ON section."id" = enrollment."sectionId"
  JOIN "StudentSubjectEnrollment" source ON source."id" = correction."sourceStudentSubjectEnrollmentId"
  JOIN "StudentSubjectEnrollment" replacement ON replacement."id" = correction."replacementStudentSubjectEnrollmentId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR NOT "ShsStudentParticipationCorrection_event_is_active"(correction_id)
    OR correction_record."enrollmentStatus" <> 'ACTIVE'
    OR correction_record."enrollmentDeletedAt" IS NOT NULL
    OR correction_record."sectionGradeLevel" NOT IN ('11', '12')
    OR correction_record."sourceEnrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
    OR correction_record."replacementEnrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
    OR correction_record."sourceStatus" <> 'REPLACED'
    OR correction_record."sourceReplacedAt" IS DISTINCT FROM correction_record."correctedAt"
    OR correction_record."sourceDroppedAt" IS NOT NULL
    OR correction_record."replacementStatus" <> 'ACTIVE'
    OR correction_record."replacementDroppedAt" IS NOT NULL
    OR correction_record."sourceGradeLevel" NOT IN ('11', '12')
    OR correction_record."replacementGradeLevel" IS DISTINCT FROM correction_record."sourceGradeLevel"
    OR correction_record."sourceKind"::TEXT IS DISTINCT FROM correction_record."kind"::TEXT
    OR correction_record."replacementKind"::TEXT IS DISTINCT FROM correction_record."kind"::TEXT
    OR correction_record."replacementCreatedById" IS DISTINCT FROM correction_record."correctedById"
    OR (
      correction_record."kind" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE')
      AND (
        (SELECT COUNT(*) FROM "StudentSubjectEnrollmentTerm" WHERE "studentSubjectEnrollmentId" = correction_record."sourceStudentSubjectEnrollmentId") <> 1
        OR (SELECT COUNT(*) FROM "StudentSubjectEnrollmentTerm" WHERE "studentSubjectEnrollmentId" = correction_record."replacementStudentSubjectEnrollmentId") <> 1
      )
    )
    OR EXISTS (
      SELECT 1 FROM "StudentSubjectEnrollmentTerm" replacement_membership
      WHERE replacement_membership."studentSubjectEnrollmentId" = correction_record."replacementStudentSubjectEnrollmentId"
        AND NOT EXISTS (
          SELECT 1 FROM "StudentSubjectEnrollmentTerm" source_membership
          WHERE source_membership."studentSubjectEnrollmentId" = correction_record."sourceStudentSubjectEnrollmentId"
            AND source_membership."academicTermId" = replacement_membership."academicTermId"
        )
    )
    OR (
      correction_record."kind" = 'CORE'
      AND EXISTS (
        SELECT 1
        FROM "StudentSubjectEnrollmentTerm" replacement_membership
        JOIN "AcademicTerm" replacement_term ON replacement_term."id" = replacement_membership."academicTermId"
        JOIN "AcademicTerm" affected_term ON affected_term."id" = correction_record."sourceAcademicTermId"
        WHERE replacement_membership."studentSubjectEnrollmentId" = correction_record."replacementStudentSubjectEnrollmentId"
          AND replacement_term."position" < affected_term."position"
      )
    )
    OR correction_record."sourceParticipationSnapshot" IS DISTINCT FROM
       ("ShsStudentParticipationCorrection_participation_snapshot"(correction_record."sourceStudentSubjectEnrollmentId")
        || jsonb_build_object('status', 'ACTIVE'))
    OR correction_record."replacementParticipationSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_participation_snapshot"(correction_record."replacementStudentSubjectEnrollmentId")
    OR correction_record."plannedTermScopeSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_term_scope_snapshot"(
         correction_record."sourceStudentSubjectEnrollmentId", correction_record."sourceAcademicTermId",
         correction_record."replacementStudentSubjectEnrollmentId", correction_record."replacementAcademicTermId"
       )
    OR correction_record."sourceResultStateSnapshot" IS DISTINCT FROM
       "ShsStudentParticipationCorrection_result_state_snapshot"(correction_record."sourceStudentSubjectEnrollmentId")
    OR correction_record."sourceResultStateSnapshot" IS DISTINCT FROM '[]'::JSONB
    OR EXISTS (
      SELECT 1 FROM "ShsTermResult" result
      WHERE result."studentSubjectEnrollmentId" = correction_record."replacementStudentSubjectEnrollmentId"
    )
    OR pg_xact_status((SELECT replacement.xmin::TEXT::xid8 FROM "StudentSubjectEnrollment" replacement
                       WHERE replacement."id" = correction_record."replacementStudentSubjectEnrollmentId")) <> 'in progress' THEN
    RAISE EXCEPTION 'SHS Student Participation Correction did not complete exact source, replacement, Term, and result evidence';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "ShsStudentParticipationCorrection_completion_trigger"
AFTER INSERT ON "ShsStudentParticipationCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "ShsStudentParticipationCorrection_revalidation_trigger"
AFTER INSERT OR UPDATE ON "StudentSubjectEnrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "ShsStudentParticipationCorrection_term_revalidation_trigger"
AFTER INSERT OR UPDATE ON "StudentSubjectEnrollmentTerm"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "ShsStudentParticipationCorrection_result_revalidation_trigger"
AFTER INSERT OR UPDATE ON "ShsTermResult"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "ShsStudentParticipationCorrection_validate_completion"();
