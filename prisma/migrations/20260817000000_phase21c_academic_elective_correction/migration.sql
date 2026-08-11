ALTER TYPE "ShsCurriculumReferenceTermApplicability"
  ADD VALUE IF NOT EXISTS 'EXACT_CONFIGURED_TERMS';

BEGIN;

CREATE TYPE "ShsAcademicSchoolCategory" AS ENUM (
  'ARTS_SOCIAL_SCIENCE_HUMANITIES',
  'BUSINESS_ENTREPRENEURSHIP',
  'SCIENCE_TECHNOLOGY_ENGINEERING_MATHEMATICS',
  'ICT_SUPPORT_COMPUTER_PROGRAMMING_TECHNOLOGIES'
);

ALTER TABLE "ShsCurriculumCluster"
  ADD COLUMN "isSchoolFacing" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ShsCurriculumReference"
  ADD COLUMN "termPositions" INTEGER[] NOT NULL DEFAULT ARRAY[]::INTEGER[],
  ADD COLUMN "schoolCategories" "ShsAcademicSchoolCategory"[] NOT NULL DEFAULT ARRAY[]::"ShsAcademicSchoolCategory"[];

ALTER TABLE "ShsCurriculumReference"
  ADD CONSTRAINT "ShsCurriculumReference_exact_terms_check"
  CHECK (
    (
      "termApplicability" = 'EXACT_CONFIGURED_TERMS'
      AND CARDINALITY("termPositions") > 0
      AND "termPositions" <@ ARRAY[1, 2, 3]::INTEGER[]
    )
    OR (
      "termApplicability" <> 'EXACT_CONFIGURED_TERMS'
      AND CARDINALITY("termPositions") = 0
    )
  ),
  ADD CONSTRAINT "ShsCurriculumReference_school_categories_check"
  CHECK (
    "classification" = 'ACADEMIC_ELECTIVE'
    OR CARDINALITY("schoolCategories") = 0
  );

CREATE OR REPLACE FUNCTION "SubjectOfferingShsContext_assert_valid"() RETURNS TRIGGER AS $$
DECLARE
  offering_grade TEXT;
  cluster_track "ShsCurriculumClusterTrack";
  cluster_deleted_at TIMESTAMP(3);
  cluster_is_school_facing BOOLEAN;
BEGIN
  SELECT "gradeLevel" INTO offering_grade FROM "SubjectOffering" WHERE "id" = NEW."subjectOfferingId";
  IF offering_grade NOT IN ('11', '12') THEN
    RAISE EXCEPTION 'SHS context is only valid for Grade 11 or 12 Subject Offerings';
  END IF;

  IF NEW."classification" = 'CORE' AND NEW."clusterId" IS NOT NULL THEN
    RAISE EXCEPTION 'SHS Core Subject Offerings cannot have a curriculum cluster';
  END IF;
  IF NEW."classification" IN ('ACADEMIC_ELECTIVE', 'TECHPRO_ELECTIVE') AND NEW."clusterId" IS NULL THEN
    RAISE EXCEPTION 'SHS elective Subject Offerings require a curriculum cluster';
  END IF;

  IF NEW."clusterId" IS NOT NULL THEN
    SELECT "track", "deletedAt", "isSchoolFacing"
      INTO cluster_track, cluster_deleted_at, cluster_is_school_facing
      FROM "ShsCurriculumCluster"
      WHERE "id" = NEW."clusterId";
    IF cluster_deleted_at IS NOT NULL THEN
      RAISE EXCEPTION 'Archived SHS curriculum clusters cannot be used by Subject Offerings';
    END IF;
    IF NOT cluster_is_school_facing THEN
      RAISE EXCEPTION 'Source-only SHS curriculum clusters cannot be used by Subject Offerings';
    END IF;
    IF NEW."classification" = 'ACADEMIC_ELECTIVE' AND cluster_track <> 'ACADEMIC' THEN
      RAISE EXCEPTION 'Academic elective Subject Offerings require an Academic curriculum cluster';
    END IF;
    IF NEW."classification" = 'TECHPRO_ELECTIVE' AND cluster_track <> 'TECHPRO' THEN
      RAISE EXCEPTION 'TechPro elective Subject Offerings require a TechPro curriculum cluster';
    END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;

COMMIT;
