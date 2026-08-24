CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_assert_complete"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  correction_record RECORD;
  student_record RECORD;
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN
    correction_id := NEW."id";
  ELSIF TG_TABLE_NAME = 'Student' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE enrollment."studentId" = NEW."id"
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Enrollment' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE correction."enrollmentId" = NEW."id"
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'AcademicYear' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE enrollment."academicYearId" = NEW."id"
    ORDER BY correction."sequence" DESC LIMIT 1;
  ELSIF TG_TABLE_NAME = 'Section' THEN
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE NEW."id" IN (correction."sourceSectionId", correction."destinationSectionId")
    ORDER BY correction."sequence" DESC LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."id", correction."enrollmentId", correction."destinationSectionId",
         correction."sourcePlacementSnapshot", correction."destinationPlacementSnapshot",
         enrollment."studentId", enrollment."academicYearId", enrollment."sectionId",
         enrollment."status", enrollment."deletedAt", enrollment."entryAcademicTermId",
         enrollment."shsTrack", enrollment."semester", enrollment."createdById",
         academic_year."status" AS "academicYearStatus",
         source_section."gradeLevel" AS "sourceGradeLevel",
         destination_section."gradeLevel" AS "destinationGradeLevel",
         destination_section."deletedAt" AS "destinationDeletedAt"
  INTO correction_record
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  JOIN "AcademicYear" academic_year ON academic_year."id" = enrollment."academicYearId"
  JOIN "Section" source_section ON source_section."id" = correction."sourceSectionId"
  JOIN "Section" destination_section ON destination_section."id" = correction."destinationSectionId"
  WHERE correction."id" = correction_id;

  IF NOT FOUND OR correction_record."sectionId" <> correction_record."destinationSectionId" OR
     correction_record."status" <> 'ACTIVE' OR correction_record."deletedAt" IS NOT NULL OR
     correction_record."academicYearStatus" <> 'ACTIVE' OR
     correction_record."destinationDeletedAt" IS NOT NULL OR
     correction_record."sourceGradeLevel" IS DISTINCT FROM correction_record."destinationGradeLevel" OR
     correction_record."sourcePlacementSnapshot"->>'gradeLevel' IS DISTINCT FROM correction_record."sourceGradeLevel" OR
     correction_record."destinationPlacementSnapshot"->>'gradeLevel' IS DISTINCT FROM correction_record."destinationGradeLevel" OR
     correction_record."sourcePlacementSnapshot"->>'enrollmentId' IS DISTINCT FROM correction_record."enrollmentId" OR
     correction_record."sourcePlacementSnapshot"->>'studentId' IS DISTINCT FROM correction_record."studentId" OR
     correction_record."sourcePlacementSnapshot"->>'academicYearId' IS DISTINCT FROM correction_record."academicYearId" OR
     correction_record."sourcePlacementSnapshot"->>'enrollmentStatus' IS DISTINCT FROM correction_record."status"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'entryAcademicTermId' IS DISTINCT FROM correction_record."entryAcademicTermId" OR
     correction_record."sourcePlacementSnapshot"->>'shsTrack' IS DISTINCT FROM correction_record."shsTrack"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'semester' IS DISTINCT FROM correction_record."semester"::TEXT OR
     correction_record."sourcePlacementSnapshot"->>'createdById' IS DISTINCT FROM correction_record."createdById" THEN
    RAISE EXCEPTION 'Student Enrollment Correction changed protected Enrollment or same-grade placement facts';
  END IF;

  SELECT "status", "currentSectionId" INTO student_record
  FROM "Student" WHERE "id" = correction_record."studentId";
  IF NOT FOUND OR student_record."status" <> 'ENROLLED' OR
     student_record."currentSectionId" <> correction_record."destinationSectionId" THEN
    RAISE EXCEPTION 'Student Enrollment Correction did not synchronize the Student placement';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "StudentEnrollmentCorrection_revalidate_enrollment_created_at"()
RETURNS TRIGGER AS $$
DECLARE
  correction_id TEXT;
  expected_created_at TIMESTAMP(3);
  actual_created_at TIMESTAMP(3);
BEGIN
  IF TG_TABLE_NAME = 'StudentEnrollmentCorrection' THEN
    correction_id := NEW."id";
  ELSE
    SELECT correction."id" INTO correction_id
    FROM "StudentEnrollmentCorrection" correction
    JOIN pg_locks transaction_lock
      ON transaction_lock.locktype = 'advisory' AND transaction_lock.pid = pg_backend_pid()
     AND transaction_lock.granted AND transaction_lock.classid = 2106::OID
     AND transaction_lock.objid = correction."sequence"::OID AND transaction_lock.objsubid = 2
    WHERE correction."enrollmentId" = NEW."id"
    ORDER BY correction."sequence" DESC LIMIT 1;
  END IF;

  IF correction_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT correction."enrollmentCreatedAtSnapshot", enrollment."createdAt"
  INTO expected_created_at, actual_created_at
  FROM "StudentEnrollmentCorrection" correction
  JOIN "Enrollment" enrollment ON enrollment."id" = correction."enrollmentId"
  WHERE correction."id" = correction_id;

  IF expected_created_at IS DISTINCT FROM actual_created_at THEN
    RAISE EXCEPTION 'Student Enrollment Correction changed protected Enrollment creation time';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
