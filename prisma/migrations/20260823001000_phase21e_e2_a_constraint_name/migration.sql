ALTER TABLE "CurriculumCorrection"
  RENAME CONSTRAINT "CurriculumCorrection_effectiveAcademicTermId_academicYearId_fke"
  TO "CurriculumCorrection_effectiveTerm_year_fkey";
