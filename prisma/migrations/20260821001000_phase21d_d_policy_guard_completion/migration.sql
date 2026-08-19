CREATE OR REPLACE FUNCTION enforce_shs_term_result_interpretation_policy()
RETURNS TRIGGER AS $$
DECLARE
  academic_year_status "AcademicYearStatus";
  target_academic_year_id TEXT;
BEGIN
  IF TG_OP = 'DELETE' AND OLD."status" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published SHS Term Result interpretation policies are immutable and cannot be deleted.';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF OLD."status" = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published SHS Term Result interpretation policies are immutable.';
    END IF;
    IF OLD."academicYearId" <> NEW."academicYearId" THEN
      RAISE EXCEPTION 'SHS Term Result interpretation policy Academic Year identity is immutable.';
    END IF;
  END IF;

  target_academic_year_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."academicYearId"
    ELSE NEW."academicYearId"
  END;

  SELECT "status"
  INTO academic_year_status
  FROM "AcademicYear"
  WHERE "id" = target_academic_year_id
  FOR KEY SHARE;

  IF academic_year_status IS DISTINCT FROM 'ACTIVE'::"AcademicYearStatus" THEN
    RAISE EXCEPTION 'SHS Term Result interpretation policies may be changed only for an active Academic Year.';
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;
