BEGIN;

CREATE TABLE "StudentEnrollmentGradeCorrection" (
  "id" TEXT NOT NULL,
  "sequence" BIGSERIAL NOT NULL,
  "enrollmentId" TEXT NOT NULL,
  "sourceSectionId" TEXT NOT NULL,
  "destinationSectionId" TEXT NOT NULL,
  "sourcePlacementSnapshot" JSONB NOT NULL,
  "destinationPlacementSnapshot" JSONB NOT NULL,
  "enrollmentCreatedAtSnapshot" TIMESTAMP(3) NOT NULL,
  "reason" TEXT NOT NULL,
  "evidenceReference" TEXT NOT NULL,
  "sourceParticipationCount" INTEGER NOT NULL,
  "replacementParticipationCount" INTEGER NOT NULL,
  "correctedById" TEXT NOT NULL,
  "correctedAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentEnrollmentGradeCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentEnrollmentGradeCorrection_distinct_sections_check"
    CHECK ("sourceSectionId" <> "destinationSectionId"),
  CONSTRAINT "StudentEnrollmentGradeCorrection_counts_check"
    CHECK (
      "sourceParticipationCount" IN (0, 8)
      AND "replacementParticipationCount" = 8
    ),
  CONSTRAINT "StudentEnrollmentGradeCorrection_reason_check"
    CHECK (
      NULLIF(BTRIM("reason", E' \t\n\r\f\v'), '') IS NOT NULL
      AND "reason" = BTRIM("reason", E' \t\n\r\f\v')
      AND CHAR_LENGTH("reason") <= 500
    ),
  CONSTRAINT "StudentEnrollmentGradeCorrection_evidence_check"
    CHECK (
      NULLIF(BTRIM("evidenceReference", E' \t\n\r\f\v'), '') IS NOT NULL
      AND "evidenceReference" = BTRIM("evidenceReference", E' \t\n\r\f\v')
      AND CHAR_LENGTH("evidenceReference") <= 500
    )
);

CREATE TABLE "StudentParticipationCorrection" (
  "id" TEXT NOT NULL,
  "studentEnrollmentGradeCorrectionId" TEXT NOT NULL,
  "sourceStudentSubjectEnrollmentId" TEXT NOT NULL,
  "replacementStudentSubjectEnrollmentId" TEXT NOT NULL,
  "canonicalSubjectPrefix" TEXT NOT NULL,
  "sourceParticipationSnapshot" JSONB NOT NULL,
  "replacementParticipationSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "StudentParticipationCorrection_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "StudentParticipationCorrection_distinct_participation_check"
    CHECK ("sourceStudentSubjectEnrollmentId" <> "replacementStudentSubjectEnrollmentId"),
  CONSTRAINT "StudentParticipationCorrection_prefix_check"
    CHECK ("canonicalSubjectPrefix" IN ('FIL', 'ENG', 'MATH', 'SCI', 'AP', 'MAPEH', 'TLE', 'GMRC'))
);

CREATE UNIQUE INDEX "StudentEnrollmentGradeCorrection_sequence_key"
  ON "StudentEnrollmentGradeCorrection"("sequence");
CREATE INDEX "StudentEnrollmentGradeCorrection_enrollmentId_correctedAt_idx"
  ON "StudentEnrollmentGradeCorrection"("enrollmentId", "correctedAt");
CREATE INDEX "StudentEnrollmentGradeCorrection_sourceSectionId_idx"
  ON "StudentEnrollmentGradeCorrection"("sourceSectionId");
CREATE INDEX "StudentEnrollmentGradeCorrection_destinationSectionId_idx"
  ON "StudentEnrollmentGradeCorrection"("destinationSectionId");
CREATE INDEX "StudentEnrollmentGradeCorrection_correctedById_idx"
  ON "StudentEnrollmentGradeCorrection"("correctedById");

CREATE UNIQUE INDEX "StudentParticipationCorrection_sourceStudentSubjectEnrollmentId_key"
  ON "StudentParticipationCorrection"("sourceStudentSubjectEnrollmentId");
CREATE UNIQUE INDEX "StudentParticipationCorrection_replacementStudentSubjectEnrollmentId_key"
  ON "StudentParticipationCorrection"("replacementStudentSubjectEnrollmentId");
CREATE UNIQUE INDEX "StudentParticipationCorrection_correction_prefix_key"
  ON "StudentParticipationCorrection"("studentEnrollmentGradeCorrectionId", "canonicalSubjectPrefix");
CREATE INDEX "StudentParticipationCorrection_studentEnrollmentGradeCorrectionId_idx"
  ON "StudentParticipationCorrection"("studentEnrollmentGradeCorrectionId");

ALTER TABLE "StudentEnrollmentGradeCorrection"
  ADD CONSTRAINT "StudentEnrollmentGradeCorrection_enrollmentId_fkey"
  FOREIGN KEY ("enrollmentId") REFERENCES "Enrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentGradeCorrection"
  ADD CONSTRAINT "StudentEnrollmentGradeCorrection_sourceSectionId_fkey"
  FOREIGN KEY ("sourceSectionId") REFERENCES "Section"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentGradeCorrection"
  ADD CONSTRAINT "StudentEnrollmentGradeCorrection_destinationSectionId_fkey"
  FOREIGN KEY ("destinationSectionId") REFERENCES "Section"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentEnrollmentGradeCorrection"
  ADD CONSTRAINT "StudentEnrollmentGradeCorrection_correctedById_fkey"
  FOREIGN KEY ("correctedById") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "StudentParticipationCorrection"
  ADD CONSTRAINT "StudentParticipationCorrection_gradeCorrectionId_fkey"
  FOREIGN KEY ("studentEnrollmentGradeCorrectionId")
  REFERENCES "StudentEnrollmentGradeCorrection"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentParticipationCorrection"
  ADD CONSTRAINT "StudentParticipationCorrection_sourceSseId_fkey"
  FOREIGN KEY ("sourceStudentSubjectEnrollmentId")
  REFERENCES "StudentSubjectEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "StudentParticipationCorrection"
  ADD CONSTRAINT "StudentParticipationCorrection_replacementSseId_fkey"
  FOREIGN KEY ("replacementStudentSubjectEnrollmentId")
  REFERENCES "StudentSubjectEnrollment"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_context_id"()
RETURNS TEXT AS $$
  SELECT NULLIF(current_setting('nemesys.student_enrollment_grade_correction_id', true), '');
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_event_is_active"(correction_id TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory'
     AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted
     AND transaction_lock.classid = 2107::OID
     AND transaction_lock.objid = correction."sequence"::OID
     AND transaction_lock.objsubid = 2
    WHERE correction."id" = correction_id
      AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_has_active_enrollment"(
  target_enrollment_id TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory'
     AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted
     AND transaction_lock.classid = 2107::OID
     AND transaction_lock.objid = correction."sequence"::OID
     AND transaction_lock.objsubid = 2
    WHERE correction."enrollmentId" = target_enrollment_id
      AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_active_context_event_id"(
  target_enrollment_id TEXT
)
RETURNS TEXT AS $$
  SELECT correction."id"
  FROM "StudentEnrollmentGradeCorrection" correction
  JOIN pg_locks transaction_lock
    ON transaction_lock.locktype = 'advisory'
   AND transaction_lock.pid = pg_backend_pid()
   AND transaction_lock.granted
   AND transaction_lock.classid = 2107::OID
   AND transaction_lock.objid = correction."sequence"::OID
   AND transaction_lock.objsubid = 2
  WHERE correction."id" = "StudentEnrollmentGradeCorrection_context_id"()
    AND correction."enrollmentId" = target_enrollment_id
    AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress'
    AND correction."sequence" = (
      SELECT MAX(newest."sequence")
      FROM "StudentEnrollmentGradeCorrection" newest
      WHERE newest."enrollmentId" = target_enrollment_id
    );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_mark_prior_mutation"(
  mutation_kind TEXT,
  target_id TEXT
)
RETURNS VOID AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtextextended('nemesys:phase21f-b:' || mutation_kind || ':' || target_id, 0)
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_has_prior_mutation"(
  mutation_kind TEXT,
  target_id TEXT
)
RETURNS BOOLEAN AS $$
DECLARE
  marker_key BIGINT;
BEGIN
  marker_key := hashtextextended(
    'nemesys:phase21f-b:' || mutation_kind || ':' || target_id,
    0
  );

  RETURN EXISTS (
    SELECT 1
    FROM pg_locks transaction_lock
    WHERE transaction_lock.locktype = 'advisory'
      AND transaction_lock.pid = pg_backend_pid()
      AND transaction_lock.granted
      AND transaction_lock.objsubid = 1
      AND transaction_lock.classid::BIGINT = ((marker_key >> 32) & 4294967295)
      AND transaction_lock.objid::BIGINT = (marker_key & 4294967295)
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_placement_snapshot"(
  target_enrollment_id TEXT,
  target_section_id TEXT
)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'enrollmentId', enrollment."id",
    'studentId', enrollment."studentId",
    'academicYearId', enrollment."academicYearId",
    'enrollmentStatus', enrollment."status",
    'entryAcademicTermId', enrollment."entryAcademicTermId",
    'shsTrack', enrollment."shsTrack",
    'semester', enrollment."semester",
    'createdById', enrollment."createdById",
    'sectionId', section."id",
    'gradeLevel', section."gradeLevel",
    'trackStrand', section."trackStrand",
    'sectionName', section."sectionName"
  )
  FROM "Enrollment" enrollment
  JOIN "Section" section ON section."id" = target_section_id
  WHERE enrollment."id" = target_enrollment_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_participation_snapshot"(
  participation_id TEXT
)
RETURNS JSONB AS $$
  SELECT jsonb_build_object(
    'id', participation."id",
    'subjectOfferingId', participation."subjectOfferingId",
    'subjectCode', participation."subjectCode",
    'subjectDescription', participation."subjectDescription",
    'gradeLevel', participation."gradeLevel",
    'academicTermIds', COALESCE((
      SELECT jsonb_agg(term_membership."academicTermId" ORDER BY term."position", term."id")
      FROM "StudentSubjectEnrollmentTerm" term_membership
      JOIN "AcademicTerm" term ON term."id" = term_membership."academicTermId"
      WHERE term_membership."studentSubjectEnrollmentId" = participation."id"
    ), '[]'::JSONB),
    'status', participation."status"
  )
  FROM "StudentSubjectEnrollment" participation
  WHERE participation."id" = participation_id;
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_lock_transaction"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."sequence" > 2147483647 THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction sequence exceeds transaction lock capacity';
  END IF;
  PERFORM pg_advisory_xact_lock(2107, NEW."sequence"::INTEGER);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_00_lock_transaction_trigger"
BEFORE INSERT ON "StudentEnrollmentGradeCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_lock_transaction"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_domain_context"()
RETURNS TRIGGER AS $$
BEGIN
  IF "StudentEnrollmentGradeCorrection_context_id"() IS DISTINCT FROM NEW."id" THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires its exact transaction context';
  END IF;
  IF NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment correction capabilities cannot be composed across domains';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_01_assert_domain_context_trigger"
BEFORE INSERT ON "StudentEnrollmentGradeCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_assert_domain_context"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_no_prior_mutation"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_student_id TEXT;
BEGIN
  SELECT "studentId" INTO enrollment_student_id
  FROM "Enrollment" WHERE "id" = NEW."enrollmentId";

  IF "StudentEnrollmentGradeCorrection_has_prior_mutation"('enrollment', NEW."enrollmentId")
    OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('evidence', NEW."enrollmentId")
    OR (enrollment_student_id IS NOT NULL AND
        "StudentEnrollmentGradeCorrection_has_prior_mutation"('student', enrollment_student_id)) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction cannot follow Enrollment, Student, participation, result, or Grade mutation in the same transaction';
  END IF;
  IF "StudentEnrollmentGradeCorrection_has_prior_mutation"('section', NEW."sourceSectionId")
    OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('section', NEW."destinationSectionId") THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction cannot follow participating Section mutation in the same transaction';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_02_assert_no_prior_mutation_trigger"
BEFORE INSERT ON "StudentEnrollmentGradeCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_assert_no_prior_mutation"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  enrollment_record RECORD;
  student_record RECORD;
  source_section RECORD;
  destination_section RECORD;
  total_source_count INTEGER;
  actual_source_count INTEGER;
  actual_prefix_count INTEGER;
  destination_offering_count INTEGER;
  destination_code_count INTEGER;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_locks transaction_lock
    WHERE transaction_lock.locktype = 'advisory'
      AND transaction_lock.pid = pg_backend_pid()
      AND transaction_lock.granted
      AND transaction_lock.classid = 2107::OID
      AND transaction_lock.objid = NEW."sequence"::OID
      AND transaction_lock.objsubid = 2
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires its sequence advisory membership';
  END IF;
  IF ABS(EXTRACT(EPOCH FROM (NEW."correctedAt" - (CURRENT_TIMESTAMP AT TIME ZONE 'UTC')))) > 300 THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction timestamp must represent the current transaction';
  END IF;

  SELECT enrollment.*, academic_year."status" AS "academicYearStatus"
  INTO enrollment_record
  FROM "Enrollment" enrollment
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  WHERE enrollment."id" = NEW."enrollmentId"
  FOR UPDATE OF enrollment;

  IF NOT FOUND OR enrollment_record."status" <> 'ACTIVE'
    OR enrollment_record."deletedAt" IS NOT NULL
    OR enrollment_record."academicYearStatus" <> 'ACTIVE' THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires an active Enrollment and Academic Year';
  END IF;
  IF enrollment_record."sectionId" IS DISTINCT FROM NEW."sourceSectionId"
    OR enrollment_record."entryAcademicTermId" IS NOT NULL
    OR enrollment_record."shsTrack" IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires the exact regular JHS source Enrollment';
  END IF;

  SELECT "status", "currentSectionId", "deletedAt"
  INTO student_record
  FROM "Student"
  WHERE "id" = enrollment_record."studentId"
  FOR UPDATE;
  IF NOT FOUND OR student_record."status" <> 'ENROLLED'
    OR student_record."deletedAt" IS NOT NULL
    OR student_record."currentSectionId" IS DISTINCT FROM NEW."sourceSectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires an active Student at the source Section';
  END IF;

  PERFORM "id" FROM "Section"
  WHERE "id" IN (NEW."sourceSectionId", NEW."destinationSectionId")
  ORDER BY "id" FOR SHARE;
  SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
  INTO source_section FROM "Section" WHERE "id" = NEW."sourceSectionId";
  SELECT "id", "gradeLevel", "trackStrand", "sectionName", "deletedAt"
  INTO destination_section FROM "Section" WHERE "id" = NEW."destinationSectionId";

  IF source_section."id" IS NULL OR destination_section."id" IS NULL
    OR source_section."deletedAt" IS NOT NULL OR destination_section."deletedAt" IS NOT NULL
    OR source_section."gradeLevel" NOT IN ('7', '8', '9', '10')
    OR destination_section."gradeLevel" NOT IN ('7', '8', '9', '10')
    OR source_section."gradeLevel" = destination_section."gradeLevel"
    OR source_section."trackStrand" IS NOT NULL
    OR destination_section."trackStrand" IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires distinct active regular JHS grades and null Track / Strand';
  END IF;

  IF NEW."sourcePlacementSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_placement_snapshot"(NEW."enrollmentId", NEW."sourceSectionId")
    OR NEW."destinationPlacementSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_placement_snapshot"(NEW."enrollmentId", NEW."destinationSectionId")
    OR NEW."enrollmentCreatedAtSnapshot" IS DISTINCT FROM enrollment_record."createdAt" THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction placement snapshots do not match current database facts';
  END IF;

  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT offering."subjectCode")::INTEGER
  INTO destination_offering_count, destination_code_count
  FROM "SubjectOffering" offering
  WHERE offering."academicYearId" = enrollment_record."academicYearId"
    AND offering."gradeLevel" = destination_section."gradeLevel"
    AND offering."subjectCode" IN (
      'FIL' || destination_section."gradeLevel", 'ENG' || destination_section."gradeLevel",
      'MATH' || destination_section."gradeLevel", 'SCI' || destination_section."gradeLevel",
      'AP' || destination_section."gradeLevel", 'MAPEH' || destination_section."gradeLevel",
      'TLE' || destination_section."gradeLevel", 'GMRC' || destination_section."gradeLevel"
    )
    AND offering."deletedAt" IS NULL;

  IF destination_offering_count <> 8 OR destination_code_count <> 8 OR EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    LEFT JOIN "Subject" subject ON subject."id" = offering."subjectId"
    WHERE offering."academicYearId" = enrollment_record."academicYearId"
      AND offering."gradeLevel" = destination_section."gradeLevel"
      AND offering."subjectCode" IN (
        'FIL' || destination_section."gradeLevel", 'ENG' || destination_section."gradeLevel",
        'MATH' || destination_section."gradeLevel", 'SCI' || destination_section."gradeLevel",
        'AP' || destination_section."gradeLevel", 'MAPEH' || destination_section."gradeLevel",
        'TLE' || destination_section."gradeLevel", 'GMRC' || destination_section."gradeLevel"
      )
      AND offering."deletedAt" IS NULL
      AND (
        subject."id" IS NULL
        OR subject."code" IS DISTINCT FROM offering."subjectCode"
        OR subject."description" IS DISTINCT FROM offering."subjectDescription"
        OR subject."gradeLevel" IS DISTINCT FROM destination_section."gradeLevel"
        OR subject."trackStrand" IS NOT NULL
        OR subject."deletedAt" IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM "SubjectOfferingShsContext" context
          WHERE context."subjectOfferingId" = offering."id"
        )
        OR EXISTS (
          SELECT 1 FROM "SubjectOffering" downstream
          WHERE downstream."replacesSubjectOfferingId" = offering."id"
            AND downstream."deletedAt" IS NULL
        )
        OR (SELECT COUNT(*) FROM "SubjectOfferingTerm" offering_term
            WHERE offering_term."subjectOfferingId" = offering."id")
           <> (SELECT COUNT(*) FROM "AcademicTerm" term
               WHERE term."academicYearId" = enrollment_record."academicYearId")
        OR EXISTS (
          SELECT 1
          FROM "AcademicTerm" term
          WHERE term."academicYearId" = enrollment_record."academicYearId"
            AND NOT EXISTS (
              SELECT 1 FROM "SubjectOfferingTerm" offering_term
              WHERE offering_term."subjectOfferingId" = offering."id"
                AND offering_term."academicTermId" = term."id"
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "SubjectOfferingTerm" offering_term
          JOIN "AcademicTerm" term ON term."id" = offering_term."academicTermId"
          WHERE offering_term."subjectOfferingId" = offering."id"
            AND term."academicYearId" IS DISTINCT FROM enrollment_record."academicYearId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction requires exactly eight valid destination baseline Offerings';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "SubjectOffering" offering
    WHERE offering."academicYearId" = enrollment_record."academicYearId"
      AND offering."gradeLevel" = destination_section."gradeLevel"
      AND offering."subjectCode" IN (
        'FIL' || destination_section."gradeLevel", 'ENG' || destination_section."gradeLevel",
        'MATH' || destination_section."gradeLevel", 'SCI' || destination_section."gradeLevel",
        'AP' || destination_section."gradeLevel", 'MAPEH' || destination_section."gradeLevel",
        'TLE' || destination_section."gradeLevel", 'GMRC' || destination_section."gradeLevel"
      )
      AND (
        "StudentEnrollmentGradeCorrection_has_prior_mutation"('offering', offering."id")
        OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('subject', offering."subjectId")
        OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('offering-terms', offering."id")
        OR EXISTS (
          SELECT 1
          FROM "AcademicTerm" term
          WHERE term."academicYearId" = enrollment_record."academicYearId"
            AND "StudentEnrollmentGradeCorrection_has_prior_mutation"(
              'offering-term', offering."id" || ':' || term."id"
            )
        )
      )
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction cannot follow destination Subject Offering configuration mutation in the same transaction';
  END IF;

  SELECT COUNT(*)::INTEGER,
         COUNT(*) FILTER (WHERE participation."status" = 'ACTIVE')::INTEGER,
         COUNT(DISTINCT LEFT(
           participation."subjectCode",
           CHAR_LENGTH(participation."subjectCode") - CHAR_LENGTH(source_section."gradeLevel")
         )) FILTER (WHERE participation."status" = 'ACTIVE')::INTEGER
  INTO total_source_count, actual_source_count, actual_prefix_count
  FROM "StudentSubjectEnrollment" participation
  WHERE participation."enrollmentId" = NEW."enrollmentId";

  IF total_source_count IS DISTINCT FROM actual_source_count
    OR actual_source_count NOT IN (0, 8)
    OR NEW."sourceParticipationCount" IS DISTINCT FROM actual_source_count
    OR NEW."replacementParticipationCount" <> 8
    OR actual_prefix_count IS DISTINCT FROM actual_source_count
    OR EXISTS (
      SELECT 1
      FROM "StudentSubjectEnrollment" participation
      WHERE participation."enrollmentId" = NEW."enrollmentId"
        AND participation."status" = 'ACTIVE'
        AND (
          participation."gradeLevel" IS DISTINCT FROM source_section."gradeLevel"
          OR participation."selectionAcademicTermId" IS NOT NULL
          OR participation."shsClassification" IS NOT NULL
          OR participation."shsClusterCode" IS NOT NULL
          OR participation."shsClusterName" IS NOT NULL
          OR participation."shsCurriculumStatus" IS NOT NULL
          OR participation."shsSourceReference" IS NOT NULL
          OR participation."shsApprovalReference" IS NOT NULL
          OR participation."subjectCode" NOT IN (
            'FIL' || source_section."gradeLevel", 'ENG' || source_section."gradeLevel",
            'MATH' || source_section."gradeLevel", 'SCI' || source_section."gradeLevel",
            'AP' || source_section."gradeLevel", 'MAPEH' || source_section."gradeLevel",
            'TLE' || source_section."gradeLevel", 'GMRC' || source_section."gradeLevel"
          )
        )
    ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction source participation set is not exact regular JHS evidence';
  END IF;

  IF actual_source_count = 8 AND EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    WHERE participation."enrollmentId" = NEW."enrollmentId"
      AND participation."status" = 'ACTIVE'
      AND (
        (SELECT COUNT(*) FROM "StudentSubjectEnrollmentTerm" membership
         WHERE membership."studentSubjectEnrollmentId" = participation."id")
          <> (SELECT COUNT(*) FROM "AcademicTerm" term
              WHERE term."academicYearId" = enrollment_record."academicYearId")
        OR EXISTS (
          SELECT 1
          FROM "AcademicTerm" term
          WHERE term."academicYearId" = enrollment_record."academicYearId"
            AND NOT EXISTS (
              SELECT 1
              FROM "StudentSubjectEnrollmentTerm" membership
              WHERE membership."studentSubjectEnrollmentId" = participation."id"
                AND membership."academicTermId" = term."id"
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "StudentSubjectEnrollmentTerm" membership
          JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
          WHERE membership."studentSubjectEnrollmentId" = participation."id"
            AND term."academicYearId" IS DISTINCT FROM enrollment_record."academicYearId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Every source Student Subject Enrollment must cover exactly every configured Academic Term';
  END IF;

  IF actual_source_count = 8 AND EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    LEFT JOIN "SubjectOffering" offering ON offering."id" = participation."subjectOfferingId"
    WHERE participation."enrollmentId" = NEW."enrollmentId"
      AND participation."status" = 'ACTIVE'
      AND (
        offering."id" IS NULL
        OR offering."academicYearId" IS DISTINCT FROM enrollment_record."academicYearId"
        OR offering."gradeLevel" IS DISTINCT FROM source_section."gradeLevel"
        OR offering."subjectCode" IS DISTINCT FROM participation."subjectCode"
        OR offering."subjectDescription" IS DISTINCT FROM participation."subjectDescription"
        OR EXISTS (
          SELECT 1 FROM "SubjectOfferingShsContext" context
          WHERE context."subjectOfferingId" = offering."id"
        )
        OR (SELECT COUNT(*) FROM "SubjectOfferingTerm" offering_term
            WHERE offering_term."subjectOfferingId" = offering."id")
           <> (SELECT COUNT(*) FROM "AcademicTerm" term
               WHERE term."academicYearId" = enrollment_record."academicYearId")
        OR EXISTS (
          SELECT 1
          FROM "AcademicTerm" term
          WHERE term."academicYearId" = enrollment_record."academicYearId"
            AND NOT EXISTS (
              SELECT 1 FROM "SubjectOfferingTerm" offering_term
              WHERE offering_term."subjectOfferingId" = offering."id"
                AND offering_term."academicTermId" = term."id"
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "SubjectOfferingTerm" offering_term
          JOIN "AcademicTerm" term ON term."id" = offering_term."academicTermId"
          WHERE offering_term."subjectOfferingId" = offering."id"
            AND term."academicYearId" IS DISTINCT FROM enrollment_record."academicYearId"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Every source Student Subject Enrollment must match exact historical baseline Offering evidence';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    JOIN "ShsTermResult" result
      ON result."studentSubjectEnrollmentId" = participation."id"
    WHERE participation."enrollmentId" = NEW."enrollmentId"
      AND participation."status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction cannot replace participation with DRAFT or FINALIZED SHS Term Results';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_zz_assert_intent_trigger"
BEFORE INSERT ON "StudentEnrollmentGradeCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_assert_intent"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_assert_immutable"()
RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Student Enrollment Grade Correction records are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_assert_immutable_trigger"
BEFORE UPDATE OR DELETE ON "StudentEnrollmentGradeCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_assert_immutable"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_reject_placement_domain_composition"()
RETURNS TRIGGER AS $$
BEGIN
  IF "StudentEnrollmentGradeCorrection_context_id"() IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment correction capabilities cannot be composed across domains';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentCorrection_00_reject_grade_domain_composition_trigger"
BEFORE INSERT ON "StudentEnrollmentCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_reject_placement_domain_composition"();

CREATE OR REPLACE FUNCTION "StudentParticipationCorrection_assert_intent"()
RETURNS TRIGGER AS $$
DECLARE
  correction_record RECORD;
  source_record RECORD;
  replacement_record RECORD;
BEGIN
  SELECT correction.*, source_section."gradeLevel" AS "sourceGradeLevel",
         destination_section."gradeLevel" AS "destinationGradeLevel"
  INTO correction_record
  FROM "StudentEnrollmentGradeCorrection" correction
  JOIN "Section" source_section ON source_section."id" = correction."sourceSectionId"
  JOIN "Section" destination_section ON destination_section."id" = correction."destinationSectionId"
  WHERE correction."id" = NEW."studentEnrollmentGradeCorrectionId";

  IF NOT FOUND
    OR "StudentEnrollmentGradeCorrection_context_id"() IS DISTINCT FROM correction_record."id"
    OR NOT "StudentEnrollmentGradeCorrection_event_is_active"(correction_record."id")
    OR NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '') IS NOT NULL THEN
    RAISE EXCEPTION 'Student Participation Correction requires its exact active grade-correction capability';
  END IF;

  SELECT * INTO source_record
  FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."sourceStudentSubjectEnrollmentId";
  SELECT * INTO replacement_record
  FROM "StudentSubjectEnrollment"
  WHERE "id" = NEW."replacementStudentSubjectEnrollmentId";

  IF source_record."id" IS NULL
    OR source_record."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
    OR source_record."status" <> 'ACTIVE'
    OR source_record."gradeLevel" IS DISTINCT FROM correction_record."sourceGradeLevel"
    OR source_record."subjectCode" IS DISTINCT FROM NEW."canonicalSubjectPrefix" || correction_record."sourceGradeLevel"
    OR source_record."selectionAcademicTermId" IS NOT NULL
    OR source_record."shsClassification" IS NOT NULL
    OR EXISTS (
      SELECT 1 FROM "ShsTermResult"
      WHERE "studentSubjectEnrollmentId" = source_record."id"
    )
    OR NEW."sourceParticipationSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_participation_snapshot"(source_record."id") THEN
    RAISE EXCEPTION 'Student Participation Correction source does not match exact active regular JHS evidence';
  END IF;

  IF replacement_record."id" IS NULL
    OR replacement_record."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
    OR replacement_record."status" <> 'ACTIVE'
    OR replacement_record."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
    OR replacement_record."subjectCode" IS DISTINCT FROM NEW."canonicalSubjectPrefix" || correction_record."destinationGradeLevel"
    OR replacement_record."selectionAcademicTermId" IS NOT NULL
    OR replacement_record."shsClassification" IS NOT NULL
    OR replacement_record."shsClusterCode" IS NOT NULL
    OR replacement_record."shsClusterName" IS NOT NULL
    OR replacement_record."shsCurriculumStatus" IS NOT NULL
    OR replacement_record."shsSourceReference" IS NOT NULL
    OR replacement_record."shsApprovalReference" IS NOT NULL
    OR replacement_record."createdById" IS DISTINCT FROM correction_record."correctedById"
    OR pg_xact_status(replacement_record.xmin::TEXT::xid8) <> 'in progress'
    OR NEW."replacementParticipationSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_participation_snapshot"(replacement_record."id") THEN
    RAISE EXCEPTION 'Student Participation Correction replacement does not match exact new regular JHS evidence';
  END IF;

  IF "StudentEnrollmentGradeCorrection_has_prior_mutation"('offering', replacement_record."subjectOfferingId")
    OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('subject', (
      SELECT offering."subjectId" FROM "SubjectOffering" offering
      WHERE offering."id" = replacement_record."subjectOfferingId"
    ))
    OR "StudentEnrollmentGradeCorrection_has_prior_mutation"('offering-terms', replacement_record."subjectOfferingId")
    OR EXISTS (
      SELECT 1
      FROM "SubjectOfferingTerm" offering_term
      WHERE offering_term."subjectOfferingId" = replacement_record."subjectOfferingId"
        AND "StudentEnrollmentGradeCorrection_has_prior_mutation"(
          'offering-term',
          offering_term."subjectOfferingId" || ':' || offering_term."academicTermId"
        )
    ) THEN
    RAISE EXCEPTION 'Student Participation Correction cannot use a destination Offering mutated earlier in the transaction';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentParticipationCorrection_assert_intent_trigger"
BEFORE INSERT ON "StudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentParticipationCorrection_assert_intent"();

CREATE TRIGGER "StudentParticipationCorrection_assert_immutable_trigger"
BEFORE UPDATE OR DELETE ON "StudentParticipationCorrection"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_assert_immutable"();

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
    AND OLD."gradeLevel" IN ('7', '8', '9', '10')
    AND OLD."selectionAcademicTermId" IS NULL
    AND OLD."shsClassification" IS NULL
    AND OLD."shsClusterCode" IS NULL
    AND OLD."shsClusterName" IS NULL
    AND OLD."shsCurriculumStatus" IS NULL
    AND OLD."shsSourceReference" IS NULL
    AND OLD."shsApprovalReference" IS NULL THEN
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

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"()
RETURNS TRIGGER AS $$
DECLARE
  old_enrollment_id TEXT;
  new_enrollment_id TEXT;
  old_participation_id TEXT;
  new_participation_id TEXT;
  correction_id TEXT;
  correction_record RECORD;
  mapped_replacement_id TEXT;
BEGIN
  IF TG_TABLE_NAME = 'StudentSubjectEnrollment' THEN
    IF TG_OP <> 'INSERT' THEN old_enrollment_id := OLD."enrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_enrollment_id := NEW."enrollmentId"; END IF;
  ELSIF TG_TABLE_NAME IN ('StudentSubjectEnrollmentTerm', 'ShsTermResult') THEN
    IF TG_OP <> 'INSERT' THEN old_participation_id := OLD."studentSubjectEnrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_participation_id := NEW."studentSubjectEnrollmentId"; END IF;
    IF old_participation_id IS NOT NULL THEN
      SELECT "enrollmentId" INTO old_enrollment_id
      FROM "StudentSubjectEnrollment" WHERE "id" = old_participation_id;
    END IF;
    IF new_participation_id IS NOT NULL THEN
      SELECT "enrollmentId" INTO new_enrollment_id
      FROM "StudentSubjectEnrollment" WHERE "id" = new_participation_id;
    END IF;
  ELSIF TG_TABLE_NAME = 'Grade' THEN
    IF TG_OP <> 'INSERT' THEN old_enrollment_id := OLD."enrollmentId"; END IF;
    IF TG_OP <> 'DELETE' THEN new_enrollment_id := NEW."enrollmentId"; END IF;
  END IF;

  IF old_enrollment_id IS NOT NULL
    AND "StudentEnrollmentGradeCorrection_has_active_enrollment"(old_enrollment_id) THEN
    correction_id := "StudentEnrollmentGradeCorrection_active_context_event_id"(old_enrollment_id);
  ELSIF new_enrollment_id IS NOT NULL
    AND "StudentEnrollmentGradeCorrection_has_active_enrollment"(new_enrollment_id) THEN
    correction_id := "StudentEnrollmentGradeCorrection_active_context_event_id"(new_enrollment_id);
  END IF;

  IF correction_id IS NULL AND (
    (old_enrollment_id IS NOT NULL AND
      "StudentEnrollmentGradeCorrection_has_active_enrollment"(old_enrollment_id))
    OR (new_enrollment_id IS NOT NULL AND
      "StudentEnrollmentGradeCorrection_has_active_enrollment"(new_enrollment_id))
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction evidence mutation requires its exact active context';
  END IF;

  IF correction_id IS NOT NULL THEN
    SELECT correction.*, destination_section."gradeLevel" AS "destinationGradeLevel"
    INTO correction_record
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "Section" destination_section ON destination_section."id" = correction."destinationSectionId"
    WHERE correction."id" = correction_id;

    IF TG_TABLE_NAME = 'StudentSubjectEnrollment' AND TG_OP = 'INSERT' THEN
      IF NEW."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
        OR NEW."status" <> 'ACTIVE'
        OR NEW."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
        OR NEW."subjectCode" NOT IN (
          'FIL' || correction_record."destinationGradeLevel", 'ENG' || correction_record."destinationGradeLevel",
          'MATH' || correction_record."destinationGradeLevel", 'SCI' || correction_record."destinationGradeLevel",
          'AP' || correction_record."destinationGradeLevel", 'MAPEH' || correction_record."destinationGradeLevel",
          'TLE' || correction_record."destinationGradeLevel", 'GMRC' || correction_record."destinationGradeLevel"
        )
        OR NEW."selectionAcademicTermId" IS NOT NULL
        OR NEW."shsClassification" IS NOT NULL
        OR NEW."shsClusterCode" IS NOT NULL
        OR NEW."shsClusterName" IS NOT NULL
        OR NEW."shsCurriculumStatus" IS NOT NULL
        OR NEW."shsSourceReference" IS NOT NULL
        OR NEW."shsApprovalReference" IS NOT NULL
        OR NEW."replacedAt" IS NOT NULL
        OR NEW."droppedAt" IS NOT NULL
        OR NEW."dropReason" IS NOT NULL
        OR NEW."createdById" IS DISTINCT FROM correction_record."correctedById" THEN
        RAISE EXCEPTION 'Student Enrollment Grade Correction permits only exact active destination-grade replacement insertion';
      END IF;
      RETURN NEW;
    ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollment' AND TG_OP = 'UPDATE' THEN
      SELECT child."replacementStudentSubjectEnrollmentId"
      INTO mapped_replacement_id
      FROM "StudentParticipationCorrection" child
      WHERE child."studentEnrollmentGradeCorrectionId" = correction_id
        AND child."sourceStudentSubjectEnrollmentId" = OLD."id";

      IF OLD."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
        OR OLD."status" <> 'ACTIVE' OR NEW."status" <> 'REPLACED'
        OR NEW."replacedAt" IS DISTINCT FROM correction_record."correctedAt"
        OR NEW."droppedAt" IS NOT NULL OR NEW."dropReason" IS NOT NULL
        OR mapped_replacement_id IS NULL
        OR NEW."id" IS DISTINCT FROM OLD."id"
        OR NEW."enrollmentId" IS DISTINCT FROM OLD."enrollmentId"
        OR NEW."subjectOfferingId" IS DISTINCT FROM OLD."subjectOfferingId"
        OR NEW."selectionAcademicTermId" IS DISTINCT FROM OLD."selectionAcademicTermId"
        OR NEW."subjectCode" IS DISTINCT FROM OLD."subjectCode"
        OR NEW."subjectDescription" IS DISTINCT FROM OLD."subjectDescription"
        OR NEW."gradeLevel" IS DISTINCT FROM OLD."gradeLevel"
        OR NEW."shsClassification" IS DISTINCT FROM OLD."shsClassification"
        OR NEW."shsClusterCode" IS DISTINCT FROM OLD."shsClusterCode"
        OR NEW."shsClusterName" IS DISTINCT FROM OLD."shsClusterName"
        OR NEW."shsCurriculumStatus" IS DISTINCT FROM OLD."shsCurriculumStatus"
        OR NEW."shsSourceReference" IS DISTINCT FROM OLD."shsSourceReference"
        OR NEW."shsApprovalReference" IS DISTINCT FROM OLD."shsApprovalReference"
        OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
        OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
        RAISE EXCEPTION 'Student Enrollment Grade Correction permits only exact listed ACTIVE to REPLACED transitions';
      END IF;
      RETURN NEW;
    ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollmentTerm' AND TG_OP = 'INSERT' THEN
      IF new_enrollment_id IS DISTINCT FROM correction_record."enrollmentId"
        OR NOT EXISTS (
          SELECT 1
          FROM "StudentSubjectEnrollment" replacement
          WHERE replacement."id" = NEW."studentSubjectEnrollmentId"
            AND replacement."enrollmentId" = correction_record."enrollmentId"
            AND replacement."status" = 'ACTIVE'
            AND replacement."gradeLevel" = correction_record."destinationGradeLevel"
            AND pg_xact_status(replacement.xmin::TEXT::xid8) = 'in progress'
        ) THEN
        RAISE EXCEPTION 'Student Enrollment Grade Correction permits Term insertion only for exact new replacements';
      END IF;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION 'Student Enrollment Grade Correction cannot mutate old Terms, results, Grades, DROPPED lifecycle, or unlisted participation';
  END IF;

  IF old_enrollment_id IS NOT NULL THEN
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('evidence', old_enrollment_id);
  END IF;
  IF new_enrollment_id IS NOT NULL AND new_enrollment_id IS DISTINCT FROM old_enrollment_id THEN
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('evidence', new_enrollment_id);
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_reject_sse_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "StudentSubjectEnrollment"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"();
CREATE TRIGGER "StudentEnrollmentGradeCorrection_reject_sse_term_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "StudentSubjectEnrollmentTerm"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"();
CREATE TRIGGER "StudentEnrollmentGradeCorrection_reject_result_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "ShsTermResult"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"();
CREATE TRIGGER "StudentEnrollmentGradeCorrection_reject_grade_mutation_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "Grade"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_reject_evidence_mutation"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_enrollment"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF "StudentEnrollmentGradeCorrection_has_active_enrollment"(OLD."id") THEN
      RAISE EXCEPTION 'Enrollment in a Student Enrollment Grade Correction cannot be deleted';
    END IF;
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('enrollment', OLD."id");
    RETURN OLD;
  END IF;

  IF "StudentEnrollmentGradeCorrection_has_active_enrollment"(OLD."id") THEN
    correction_id := "StudentEnrollmentGradeCorrection_active_context_event_id"(OLD."id");
    SELECT * INTO correction_record
    FROM "StudentEnrollmentGradeCorrection" WHERE "id" = correction_id;
    IF correction_id IS NULL
      OR NEW."sectionId" IS DISTINCT FROM correction_record."destinationSectionId"
      OR (to_jsonb(NEW) - ARRAY['sectionId', 'updatedAt'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['sectionId', 'updatedAt']) THEN
      RAISE EXCEPTION 'Student Enrollment Grade Correction permits only its exact Enrollment destination update';
    END IF;
    RETURN NEW;
  END IF;

  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('enrollment', OLD."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_enrollment_trigger"
BEFORE UPDATE OR DELETE ON "Enrollment"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_enrollment"();

CREATE OR REPLACE FUNCTION "Enrollment_require_student_correction_context"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  grade_correction_id TEXT;
  correction_record RECORD;
BEGIN
  IF NEW."sectionId" IS NOT DISTINCT FROM OLD."sectionId" THEN
    RETURN NEW;
  END IF;

  correction_id := NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '');
  grade_correction_id := "StudentEnrollmentGradeCorrection_context_id"();
  IF correction_id IS NOT NULL AND grade_correction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment correction capabilities cannot be composed across domains';
  END IF;

  IF grade_correction_id IS NOT NULL THEN
    SELECT correction."id", correction."enrollmentId", correction."sourceSectionId",
           correction."destinationSectionId"
    INTO correction_record
    FROM "StudentEnrollmentGradeCorrection" correction
    WHERE correction."id" = "StudentEnrollmentGradeCorrection_active_context_event_id"(OLD."id");

    IF NOT FOUND OR correction_record."id" IS DISTINCT FROM grade_correction_id
      OR correction_record."enrollmentId" <> OLD."id"
      OR correction_record."sourceSectionId" <> OLD."sectionId"
      OR correction_record."destinationSectionId" <> NEW."sectionId" THEN
      RAISE EXCEPTION 'Student Enrollment Grade Correction context does not match the placement update';
    END IF;
  ELSE
    IF correction_id IS NULL THEN
      RAISE EXCEPTION 'Enrollment placement changes require an exact Student Enrollment Correction context';
    END IF;

    SELECT "id", "enrollmentId", "sourceSectionId", "destinationSectionId"
    INTO correction_record
    FROM "StudentEnrollmentCorrection"
    WHERE "id" = correction_id;

    IF NOT FOUND OR correction_record."enrollmentId" <> OLD."id"
      OR correction_record."sourceSectionId" <> OLD."sectionId"
      OR correction_record."destinationSectionId" <> NEW."sectionId" THEN
      RAISE EXCEPTION 'Student Enrollment Correction context does not match the placement update';
    END IF;
  END IF;

  IF OLD."status" <> 'ACTIVE' OR NEW."status" <> 'ACTIVE'
    OR OLD."deletedAt" IS NOT NULL OR NEW."deletedAt" IS NOT NULL
    OR NEW."studentId" IS DISTINCT FROM OLD."studentId"
    OR NEW."academicYearId" IS DISTINCT FROM OLD."academicYearId"
    OR NEW."entryAcademicTermId" IS DISTINCT FROM OLD."entryAcademicTermId"
    OR NEW."shsTrack" IS DISTINCT FROM OLD."shsTrack"
    OR NEW."semester" IS DISTINCT FROM OLD."semester"
    OR NEW."createdById" IS DISTINCT FROM OLD."createdById"
    OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Student Enrollment Correction may change only the active Enrollment placement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "Enrollment_require_newest_student_correction_event"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  grade_correction_id TEXT;
  correction_record RECORD;
  newest_sequence BIGINT;
BEGIN
  IF NEW."sectionId" IS NOT DISTINCT FROM OLD."sectionId" THEN
    RETURN NEW;
  END IF;

  correction_id := NULLIF(current_setting('nemesys.student_enrollment_correction_id', true), '');
  grade_correction_id := "StudentEnrollmentGradeCorrection_context_id"();
  IF correction_id IS NOT NULL AND grade_correction_id IS NOT NULL THEN
    RAISE EXCEPTION 'Student Enrollment correction capabilities cannot be composed across domains';
  END IF;

  IF grade_correction_id IS NOT NULL THEN
    SELECT correction."id", correction."enrollmentId", correction."sequence"
    INTO correction_record
    FROM "StudentEnrollmentGradeCorrection" correction
    WHERE correction."id" = "StudentEnrollmentGradeCorrection_active_context_event_id"(OLD."id");

    IF NOT FOUND OR correction_record."id" IS DISTINCT FROM grade_correction_id
      OR correction_record."enrollmentId" <> OLD."id" THEN
      RAISE EXCEPTION 'Enrollment grade changes require the newest in-transaction Student Enrollment Grade Correction event';
    END IF;
    RETURN NEW;
  END IF;

  SELECT correction."id", correction."enrollmentId", correction."sequence"
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  JOIN pg_locks transaction_lock
    ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
   AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
   AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
  WHERE correction."id" = correction_id
    AND pg_xact_status(correction.xmin::TEXT::xid8) = 'in progress';

  SELECT MAX(correction."sequence") INTO newest_sequence
  FROM "StudentEnrollmentCorrection" correction
  WHERE correction."enrollmentId" = OLD."id";

  IF correction_record."enrollmentId" <> OLD."id" OR
     correction_record."sequence" IS DISTINCT FROM newest_sequence THEN
    RAISE EXCEPTION 'Enrollment placement changes require the newest in-transaction Student Enrollment Correction event';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_student"()
RETURNS TRIGGER AS $$
DECLARE
  correction_record RECORD;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF EXISTS (
      SELECT 1 FROM "Enrollment" enrollment
      WHERE enrollment."studentId" = OLD."id"
        AND "StudentEnrollmentGradeCorrection_has_active_enrollment"(enrollment."id")
    ) THEN
      RAISE EXCEPTION 'Student in a Student Enrollment Grade Correction cannot be deleted';
    END IF;
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('student', OLD."id");
    RETURN OLD;
  END IF;

  SELECT correction.* INTO correction_record
  FROM "StudentEnrollmentGradeCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  WHERE enrollment."studentId" = OLD."id"
    AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
  ORDER BY correction."sequence" DESC LIMIT 1;

  IF FOUND THEN
    IF "StudentEnrollmentGradeCorrection_context_id"() IS DISTINCT FROM correction_record."id"
      OR NEW."currentSectionId" IS DISTINCT FROM correction_record."destinationSectionId"
      OR (to_jsonb(NEW) - ARRAY['currentSectionId', 'updatedAt'])
         IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['currentSectionId', 'updatedAt']) THEN
      RAISE EXCEPTION 'Student Enrollment Grade Correction permits only exact Student destination synchronization';
    END IF;
    RETURN NEW;
  END IF;

  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('student', OLD."id");
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_student_trigger"
BEFORE UPDATE OR DELETE ON "Student"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_student"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_section"()
RETURNS TRIGGER AS $$
DECLARE
  section_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    WHERE section_id IN (correction."sourceSectionId", correction."destinationSectionId")
      AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
  ) THEN
    RAISE EXCEPTION 'Sections participating in a Student Enrollment Grade Correction cannot be mutated';
  END IF;
  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('section', section_id);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_section_trigger"
BEFORE UPDATE OR DELETE ON "Section"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_section"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_offering_is_destination"(
  target_offering_id TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    JOIN "SubjectOffering" offering
      ON offering."id" = target_offering_id
     AND offering."academicYearId" = enrollment."academicYearId"
     AND offering."gradeLevel" = correction."destinationPlacementSnapshot"->>'gradeLevel'
     AND offering."subjectCode" IN (
       'FIL' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'ENG' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'MATH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'SCI' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'AP' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'MAPEH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'TLE' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'GMRC' || (correction."destinationPlacementSnapshot"->>'gradeLevel')
     )
    WHERE "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_offering"()
RETURNS TRIGGER AS $$
DECLARE
  offering_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  IF "StudentEnrollmentGradeCorrection_offering_is_destination"(offering_id)
    OR (TG_OP <> 'DELETE' AND EXISTS (
      SELECT 1
      FROM "StudentEnrollmentGradeCorrection" correction
      JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
      WHERE "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
        AND NEW."academicYearId" = enrollment."academicYearId"
        AND NEW."gradeLevel" = correction."destinationPlacementSnapshot"->>'gradeLevel'
        AND NEW."subjectCode" IN (
          'FIL' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'ENG' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'MATH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'SCI' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'AP' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'MAPEH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'TLE' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
          'GMRC' || (correction."destinationPlacementSnapshot"->>'gradeLevel')
        )
    )) THEN
    RAISE EXCEPTION 'Destination Offering in a Student Enrollment Grade Correction cannot be mutated';
  END IF;
  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('offering', offering_id);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_offering_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "SubjectOffering"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_offering"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_offering_term"()
RETURNS TRIGGER AS $$
DECLARE
  offering_id TEXT := CASE WHEN TG_OP = 'INSERT' THEN NEW."subjectOfferingId" ELSE OLD."subjectOfferingId" END;
  term_id TEXT := CASE WHEN TG_OP = 'INSERT' THEN NEW."academicTermId" ELSE OLD."academicTermId" END;
BEGIN
  IF "StudentEnrollmentGradeCorrection_offering_is_destination"(offering_id) THEN
    RAISE EXCEPTION 'Destination Offering Terms in a Student Enrollment Grade Correction cannot be mutated';
  END IF;
  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"(
    'offering-term', offering_id || ':' || term_id
  );
  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('offering-terms', offering_id);
  IF TG_OP = 'UPDATE' AND (
    NEW."subjectOfferingId" IS DISTINCT FROM OLD."subjectOfferingId"
    OR NEW."academicTermId" IS DISTINCT FROM OLD."academicTermId"
  ) THEN
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"(
      'offering-term', NEW."subjectOfferingId" || ':' || NEW."academicTermId"
    );
    PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"(
      'offering-terms', NEW."subjectOfferingId"
    );
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_offering_term_trigger"
BEFORE INSERT OR UPDATE OR DELETE ON "SubjectOfferingTerm"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_offering_term"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_subject_is_destination"(
  target_subject_id TEXT
)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    JOIN "SubjectOffering" offering
      ON offering."subjectId" = target_subject_id
     AND offering."academicYearId" = enrollment."academicYearId"
     AND offering."gradeLevel" = correction."destinationPlacementSnapshot"->>'gradeLevel'
     AND offering."subjectCode" IN (
       'FIL' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'ENG' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'MATH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'SCI' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'AP' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'MAPEH' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'TLE' || (correction."destinationPlacementSnapshot"->>'gradeLevel'),
       'GMRC' || (correction."destinationPlacementSnapshot"->>'gradeLevel')
     )
    WHERE "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
  );
$$ LANGUAGE sql STABLE;

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_subject"()
RETURNS TRIGGER AS $$
DECLARE
  subject_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  IF "StudentEnrollmentGradeCorrection_subject_is_destination"(subject_id) THEN
    RAISE EXCEPTION 'Destination Subject in a Student Enrollment Grade Correction cannot be mutated';
  END IF;
  PERFORM "StudentEnrollmentGradeCorrection_mark_prior_mutation"('subject', subject_id);
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_subject_trigger"
BEFORE UPDATE OR DELETE ON "Subject"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_subject"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_academic_term"()
RETURNS TRIGGER AS $$
DECLARE
  term_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "SubjectOfferingTerm" offering_term
    WHERE offering_term."academicTermId" = term_id
      AND "StudentEnrollmentGradeCorrection_offering_is_destination"(offering_term."subjectOfferingId")
  ) THEN
    RAISE EXCEPTION 'Academic Terms used by a Student Enrollment Grade Correction destination Offering cannot be mutated';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_academic_term_trigger"
BEFORE UPDATE OR DELETE ON "AcademicTerm"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_academic_term"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_guard_academic_year"()
RETURNS TRIGGER AS $$
DECLARE
  academic_year_id TEXT := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    WHERE enrollment."academicYearId" = academic_year_id
      AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
  ) THEN
    RAISE EXCEPTION 'Academic Year in a Student Enrollment Grade Correction cannot be mutated';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "StudentEnrollmentGradeCorrection_guard_academic_year_trigger"
BEFORE UPDATE OR DELETE ON "AcademicYear"
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_guard_academic_year"();

CREATE OR REPLACE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  child_count INTEGER;
  source_count INTEGER;
  replacement_count INTEGER;
  replacement_code_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentGradeCorrection' THEN
    correction_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'StudentParticipationCorrection' THEN
    correction_id := NEW."studentEnrollmentGradeCorrectionId";
  ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollment' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentGradeCorrection" correction
    WHERE correction."enrollmentId" = NEW."enrollmentId"
      AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'StudentSubjectEnrollmentTerm' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentGradeCorrection" correction
    JOIN "StudentSubjectEnrollment" participation
      ON participation."enrollmentId" = correction."enrollmentId"
    WHERE participation."id" = NEW."studentSubjectEnrollmentId"
      AND "StudentEnrollmentGradeCorrection_event_is_active"(correction."id")
    ORDER BY correction."sequence" DESC LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT correction.*, enrollment."studentId", enrollment."academicYearId",
         enrollment."sectionId", enrollment."status" AS "enrollmentStatus",
         enrollment."deletedAt" AS "enrollmentDeletedAt",
         enrollment."entryAcademicTermId", enrollment."shsTrack", enrollment."semester",
         enrollment."createdById" AS "enrollmentCreatedById",
         enrollment."createdAt" AS "enrollmentCreatedAt",
         academic_year."status" AS "academicYearStatus",
         student."status" AS "studentStatus", student."currentSectionId",
         student."deletedAt" AS "studentDeletedAt",
         source_section."gradeLevel" AS "sourceGradeLevel",
         source_section."trackStrand" AS "sourceTrackStrand",
         source_section."deletedAt" AS "sourceDeletedAt",
         destination_section."gradeLevel" AS "destinationGradeLevel",
         destination_section."trackStrand" AS "destinationTrackStrand",
         destination_section."deletedAt" AS "destinationDeletedAt"
  INTO correction_record
  FROM "StudentEnrollmentGradeCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  JOIN "Student" student ON student."id" = enrollment."studentId"
  JOIN "Section" source_section ON source_section."id" = correction."sourceSectionId"
  JOIN "Section" destination_section ON destination_section."id" = correction."destinationSectionId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR NOT "StudentEnrollmentGradeCorrection_event_is_active"(correction_id)
    OR correction_record."sectionId" IS DISTINCT FROM correction_record."destinationSectionId"
    OR correction_record."enrollmentStatus" <> 'ACTIVE'
    OR correction_record."enrollmentDeletedAt" IS NOT NULL
    OR correction_record."entryAcademicTermId" IS NOT NULL
    OR correction_record."shsTrack" IS NOT NULL
    OR correction_record."academicYearStatus" <> 'ACTIVE'
    OR correction_record."studentStatus" <> 'ENROLLED'
    OR correction_record."studentDeletedAt" IS NOT NULL
    OR correction_record."currentSectionId" IS DISTINCT FROM correction_record."destinationSectionId"
    OR correction_record."sourceDeletedAt" IS NOT NULL
    OR correction_record."destinationDeletedAt" IS NOT NULL
    OR correction_record."sourceGradeLevel" NOT IN ('7', '8', '9', '10')
    OR correction_record."destinationGradeLevel" NOT IN ('7', '8', '9', '10')
    OR correction_record."sourceGradeLevel" = correction_record."destinationGradeLevel"
    OR correction_record."sourceTrackStrand" IS NOT NULL
    OR correction_record."destinationTrackStrand" IS NOT NULL
    OR correction_record."enrollmentCreatedAtSnapshot" IS DISTINCT FROM correction_record."enrollmentCreatedAt"
    OR correction_record."sourcePlacementSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_placement_snapshot"(correction_record."enrollmentId", correction_record."sourceSectionId")
    OR correction_record."destinationPlacementSnapshot" IS DISTINCT FROM
      "StudentEnrollmentGradeCorrection_placement_snapshot"(correction_record."enrollmentId", correction_record."destinationSectionId") THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction did not preserve exact active placement facts';
  END IF;

  SELECT COUNT(*)::INTEGER INTO child_count
  FROM "StudentParticipationCorrection"
  WHERE "studentEnrollmentGradeCorrectionId" = correction_id;
  SELECT COUNT(*)::INTEGER INTO source_count
  FROM "StudentSubjectEnrollment" source
  JOIN "StudentParticipationCorrection" child
    ON child."sourceStudentSubjectEnrollmentId" = source."id"
   AND child."studentEnrollmentGradeCorrectionId" = correction_id
  WHERE source."enrollmentId" = correction_record."enrollmentId"
    AND source."status" = 'REPLACED'
    AND source."replacedAt" = correction_record."correctedAt";
  SELECT COUNT(*)::INTEGER, COUNT(DISTINCT replacement."subjectCode")::INTEGER
  INTO replacement_count, replacement_code_count
  FROM "StudentSubjectEnrollment" replacement
  WHERE replacement."enrollmentId" = correction_record."enrollmentId"
    AND replacement."status" = 'ACTIVE'
    AND replacement."gradeLevel" = correction_record."destinationGradeLevel"
    AND pg_xact_status(replacement.xmin::TEXT::xid8) = 'in progress';

  IF child_count IS DISTINCT FROM correction_record."sourceParticipationCount"
    OR source_count IS DISTINCT FROM correction_record."sourceParticipationCount"
    OR replacement_count IS DISTINCT FROM correction_record."replacementParticipationCount"
    OR replacement_count <> 8
    OR replacement_code_count <> 8
    OR EXISTS (
      SELECT 1
      FROM "StudentParticipationCorrection" child
      JOIN "StudentSubjectEnrollment" source
        ON source."id" = child."sourceStudentSubjectEnrollmentId"
      JOIN "StudentSubjectEnrollment" replacement
        ON replacement."id" = child."replacementStudentSubjectEnrollmentId"
      JOIN "SubjectOffering" offering ON offering."id" = replacement."subjectOfferingId"
      WHERE child."studentEnrollmentGradeCorrectionId" = correction_id
        AND (
          source."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
          OR source."status" <> 'REPLACED'
          OR source."replacedAt" IS DISTINCT FROM correction_record."correctedAt"
          OR source."droppedAt" IS NOT NULL OR source."dropReason" IS NOT NULL
          OR source."gradeLevel" IS DISTINCT FROM correction_record."sourceGradeLevel"
          OR source."subjectCode" IS DISTINCT FROM child."canonicalSubjectPrefix" || correction_record."sourceGradeLevel"
          OR child."sourceParticipationSnapshot" IS DISTINCT FROM (
            "StudentEnrollmentGradeCorrection_participation_snapshot"(source."id")
            || jsonb_build_object('status', 'ACTIVE')
          )
          OR replacement."enrollmentId" IS DISTINCT FROM correction_record."enrollmentId"
          OR replacement."status" <> 'ACTIVE'
          OR replacement."replacedAt" IS NOT NULL
          OR replacement."droppedAt" IS NOT NULL OR replacement."dropReason" IS NOT NULL
          OR replacement."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
          OR replacement."subjectCode" IS DISTINCT FROM child."canonicalSubjectPrefix" || correction_record."destinationGradeLevel"
          OR replacement."createdById" IS DISTINCT FROM correction_record."correctedById"
          OR child."replacementParticipationSnapshot" IS DISTINCT FROM
            "StudentEnrollmentGradeCorrection_participation_snapshot"(replacement."id")
          OR offering."academicYearId" IS DISTINCT FROM correction_record."academicYearId"
          OR offering."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
          OR offering."subjectCode" IS DISTINCT FROM child."canonicalSubjectPrefix" || correction_record."destinationGradeLevel"
          OR replacement."subjectDescription" IS DISTINCT FROM offering."subjectDescription"
          OR offering."deletedAt" IS NOT NULL
          OR EXISTS (
            SELECT 1 FROM "SubjectOfferingShsContext" context
            WHERE context."subjectOfferingId" = offering."id"
          )
          OR EXISTS (
            SELECT 1 FROM "ShsTermResult" result
            WHERE result."studentSubjectEnrollmentId" = source."id"
          )
          OR (SELECT COUNT(*) FROM "StudentSubjectEnrollmentTerm" membership
              WHERE membership."studentSubjectEnrollmentId" = replacement."id")
             <> (SELECT COUNT(*) FROM "AcademicTerm" term
                 WHERE term."academicYearId" = correction_record."academicYearId")
          OR EXISTS (
            SELECT 1
            FROM "AcademicTerm" term
            WHERE term."academicYearId" = correction_record."academicYearId"
              AND (
                NOT EXISTS (
                  SELECT 1 FROM "SubjectOfferingTerm" offering_term
                  WHERE offering_term."subjectOfferingId" = offering."id"
                    AND offering_term."academicTermId" = term."id"
                )
                OR NOT EXISTS (
                  SELECT 1 FROM "StudentSubjectEnrollmentTerm" membership
                  WHERE membership."studentSubjectEnrollmentId" = replacement."id"
                    AND membership."academicTermId" = term."id"
                )
              )
          )
        )
    ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction did not complete exact one-to-one regular JHS participation replacement';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" replacement
    LEFT JOIN "SubjectOffering" offering ON offering."id" = replacement."subjectOfferingId"
    LEFT JOIN "Subject" subject ON subject."id" = offering."subjectId"
    WHERE replacement."enrollmentId" = correction_record."enrollmentId"
      AND replacement."gradeLevel" = correction_record."destinationGradeLevel"
      AND pg_xact_status(replacement.xmin::TEXT::xid8) = 'in progress'
      AND (
        replacement."status" <> 'ACTIVE'
        OR replacement."replacedAt" IS NOT NULL
        OR replacement."droppedAt" IS NOT NULL
        OR replacement."dropReason" IS NOT NULL
        OR replacement."selectionAcademicTermId" IS NOT NULL
        OR replacement."shsClassification" IS NOT NULL
        OR replacement."shsClusterCode" IS NOT NULL
        OR replacement."shsClusterName" IS NOT NULL
        OR replacement."shsCurriculumStatus" IS NOT NULL
        OR replacement."shsSourceReference" IS NOT NULL
        OR replacement."shsApprovalReference" IS NOT NULL
        OR replacement."createdById" IS DISTINCT FROM correction_record."correctedById"
        OR replacement."subjectCode" NOT IN (
          'FIL' || correction_record."destinationGradeLevel",
          'ENG' || correction_record."destinationGradeLevel",
          'MATH' || correction_record."destinationGradeLevel",
          'SCI' || correction_record."destinationGradeLevel",
          'AP' || correction_record."destinationGradeLevel",
          'MAPEH' || correction_record."destinationGradeLevel",
          'TLE' || correction_record."destinationGradeLevel",
          'GMRC' || correction_record."destinationGradeLevel"
        )
        OR offering."id" IS NULL
        OR offering."academicYearId" IS DISTINCT FROM correction_record."academicYearId"
        OR offering."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
        OR offering."subjectCode" IS DISTINCT FROM replacement."subjectCode"
        OR offering."subjectDescription" IS DISTINCT FROM replacement."subjectDescription"
        OR offering."deletedAt" IS NOT NULL
        OR subject."id" IS NULL
        OR subject."code" IS DISTINCT FROM offering."subjectCode"
        OR subject."description" IS DISTINCT FROM offering."subjectDescription"
        OR subject."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
        OR subject."trackStrand" IS NOT NULL
        OR subject."deletedAt" IS NOT NULL
        OR EXISTS (
          SELECT 1 FROM "SubjectOfferingShsContext" context
          WHERE context."subjectOfferingId" = offering."id"
        )
        OR EXISTS (
          SELECT 1 FROM "SubjectOffering" downstream
          WHERE downstream."replacesSubjectOfferingId" = offering."id"
            AND downstream."deletedAt" IS NULL
        )
        OR (SELECT COUNT(*) FROM "SubjectOfferingTerm" offering_term
            WHERE offering_term."subjectOfferingId" = offering."id")
           <> (SELECT COUNT(*) FROM "AcademicTerm" term
               WHERE term."academicYearId" = correction_record."academicYearId")
        OR (SELECT COUNT(*) FROM "StudentSubjectEnrollmentTerm" membership
            WHERE membership."studentSubjectEnrollmentId" = replacement."id")
           <> (SELECT COUNT(*) FROM "AcademicTerm" term
               WHERE term."academicYearId" = correction_record."academicYearId")
        OR EXISTS (
          SELECT 1
          FROM "AcademicTerm" term
          WHERE term."academicYearId" = correction_record."academicYearId"
            AND (
              NOT EXISTS (
                SELECT 1 FROM "SubjectOfferingTerm" offering_term
                WHERE offering_term."subjectOfferingId" = offering."id"
                  AND offering_term."academicTermId" = term."id"
              )
              OR NOT EXISTS (
                SELECT 1 FROM "StudentSubjectEnrollmentTerm" membership
                WHERE membership."studentSubjectEnrollmentId" = replacement."id"
                  AND membership."academicTermId" = term."id"
              )
            )
        )
        OR EXISTS (
          SELECT 1
          FROM "SubjectOfferingTerm" offering_term
          JOIN "AcademicTerm" term ON term."id" = offering_term."academicTermId"
          WHERE offering_term."subjectOfferingId" = offering."id"
            AND term."academicYearId" IS DISTINCT FROM correction_record."academicYearId"
        )
        OR EXISTS (
          SELECT 1
          FROM "StudentSubjectEnrollmentTerm" membership
          JOIN "AcademicTerm" term ON term."id" = membership."academicTermId"
          WHERE membership."studentSubjectEnrollmentId" = replacement."id"
            AND term."academicYearId" IS DISTINCT FROM correction_record."academicYearId"
        )
        OR EXISTS (
          SELECT 1 FROM "ShsTermResult" result
          WHERE result."studentSubjectEnrollmentId" = replacement."id"
        )
      )
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction destination replacement set is not exact active regular JHS evidence';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" participation
    WHERE participation."enrollmentId" = correction_record."enrollmentId"
      AND participation."status" = 'ACTIVE'
      AND participation."gradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel"
  ) OR EXISTS (
    SELECT 1
    FROM "StudentSubjectEnrollment" replacement
    WHERE correction_record."sourceParticipationCount" = 8
      AND replacement."enrollmentId" = correction_record."enrollmentId"
      AND pg_xact_status(replacement.xmin::TEXT::xid8) = 'in progress'
      AND replacement."gradeLevel" = correction_record."destinationGradeLevel"
      AND NOT EXISTS (
        SELECT 1 FROM "StudentParticipationCorrection" child
        WHERE child."studentEnrollmentGradeCorrectionId" = correction_id
          AND child."replacementStudentSubjectEnrollmentId" = replacement."id"
      )
  ) THEN
    RAISE EXCEPTION 'Student Enrollment Grade Correction left unlisted source or replacement participation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "StudentEnrollmentGradeCorrection_completion_trigger"
AFTER INSERT ON "StudentEnrollmentGradeCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "StudentParticipationCorrection_completion_trigger"
AFTER INSERT ON "StudentParticipationCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentGradeCorrection_sse_revalidation_trigger"
AFTER INSERT OR UPDATE ON "StudentSubjectEnrollment"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"();

CREATE CONSTRAINT TRIGGER "StudentEnrollmentGradeCorrection_sse_term_revalidation_trigger"
AFTER INSERT ON "StudentSubjectEnrollmentTerm"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "StudentEnrollmentGradeCorrection_validate_completion"();

COMMIT;
