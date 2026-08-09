DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM "AcademicYear"
    WHERE "id" = 'academic-year-2026-2027'
      AND "label" = '2026-2027'
      AND "startDate" = DATE '2026-06-08'
      AND "endDate" = DATE '2027-04-08'
      AND "status" = 'ACTIVE'
  ) THEN
    RAISE EXCEPTION 'Approved Academic Year mapping was not preserved';
  END IF;

  IF (SELECT count(*) FROM "Enrollment" WHERE "id" = 'enrollment-1' AND "academicYearId" = 'academic-year-2026-2027') <> 1 THEN
    RAISE EXCEPTION 'Enrollment identity or Academic Year relation was not preserved';
  END IF;

  IF (SELECT count(*) FROM "SubjectAssignment" WHERE "id" = 'assignment-1' AND "academicYearId" = 'academic-year-2026-2027') <> 1 THEN
    RAISE EXCEPTION 'Subject Assignment identity or Academic Year relation was not preserved';
  END IF;

  IF (SELECT count(*) FROM "Grade" WHERE "id" = 'grade-1' AND "enrollmentId" = 'enrollment-1') <> 1 THEN
    RAISE EXCEPTION 'Grade relation was not preserved';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name IN ('Enrollment', 'SubjectAssignment')
      AND column_name = 'academicYear'
  ) THEN
    RAISE EXCEPTION 'A legacy free-text Academic Year column remains';
  END IF;
END $$;

DO $$
BEGIN
  BEGIN
    INSERT INTO "AcademicYear" (
      "id", "label", "startDate", "endDate", "status", "updatedAt"
    ) VALUES (
      'overlap-test', '2027-2028', DATE '2027-04-08', DATE '2028-04-08',
      'DRAFT', CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'Overlapping Academic Year was accepted';
  EXCEPTION WHEN exclusion_violation THEN
    NULL;
  END;

  BEGIN
    INSERT INTO "AcademicYear" (
      "id", "label", "startDate", "endDate", "status", "updatedAt"
    ) VALUES (
      'canonical-test', '2027/2028', DATE '2027-06-01', DATE '2028-04-01',
      'DRAFT', CURRENT_TIMESTAMP
    );
    RAISE EXCEPTION 'Non-canonical Academic Year label was accepted';
  EXCEPTION WHEN check_violation THEN
    NULL;
  END;

  INSERT INTO "AcademicYear" (
    "id", "label", "startDate", "endDate", "status", "updatedAt"
  ) VALUES (
    'single-active-test', '2027-2028', DATE '2027-06-01', DATE '2028-04-01',
    'DRAFT', CURRENT_TIMESTAMP
  );

  BEGIN
    UPDATE "AcademicYear" SET "status" = 'ACTIVE' WHERE "id" = 'single-active-test';
    RAISE EXCEPTION 'A second ACTIVE Academic Year was accepted';
  EXCEPTION WHEN unique_violation THEN
    NULL;
  END;

  DELETE FROM "AcademicYear" WHERE "id" = 'single-active-test';
END $$;
