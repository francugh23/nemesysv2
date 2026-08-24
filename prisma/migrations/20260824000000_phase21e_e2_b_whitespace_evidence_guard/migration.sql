BEGIN;

CREATE OR REPLACE FUNCTION "CurriculumCorrection_validate_evidence_whitespace"() RETURNS TRIGGER AS $$
DECLARE
  replacement_grade TEXT;
  source_reference TEXT;
  source_approval_reference TEXT;
  replacement_reference TEXT;
  replacement_approval_reference TEXT;
  whitespace_characters TEXT := E' \t\n\r\f' || CHR(11);
BEGIN
  SELECT replacement."gradeLevel", source_context."sourceReference", source_context."approvalReference",
    replacement_context."sourceReference", replacement_context."approvalReference"
  INTO replacement_grade, source_reference, source_approval_reference,
    replacement_reference, replacement_approval_reference
  FROM "SubjectOffering" replacement
  LEFT JOIN "SubjectOfferingShsContext" replacement_context
    ON replacement_context."subjectOfferingId" = replacement."id"
  LEFT JOIN "SubjectOfferingShsContext" source_context
    ON source_context."subjectOfferingId" = NEW."sourceOfferingId"
  WHERE replacement."id" = NEW."replacementOfferingId";

  IF replacement_grade IN ('11', '12') THEN
    IF NULLIF(BTRIM(replacement_reference, whitespace_characters), '') IS NULL
      OR BTRIM(replacement_reference, whitespace_characters)
        IS NOT DISTINCT FROM BTRIM(source_reference, whitespace_characters) THEN
      RAISE EXCEPTION 'SHS Curriculum correction replacement requires newly supplied provenance';
    END IF;
    IF NULLIF(BTRIM(replacement_approval_reference, whitespace_characters), '') IS NULL
      OR BTRIM(replacement_approval_reference, whitespace_characters)
        IS NOT DISTINCT FROM BTRIM(source_approval_reference, whitespace_characters) THEN
      RAISE EXCEPTION 'SHS Curriculum correction replacement requires independent approval evidence';
    END IF;
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "CurriculumCorrection_validate_evidence_whitespace_trigger"
AFTER INSERT ON "CurriculumCorrection"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "CurriculumCorrection_validate_evidence_whitespace"();

CREATE OR REPLACE FUNCTION "CurriculumCorrection_revalidate_replacement_snapshot"() RETURNS TRIGGER AS $$
DECLARE
  correction_snapshot JSONB;
BEGIN
  SELECT correction."replacementConfigurationSnapshot"
  INTO correction_snapshot
  FROM "CurriculumCorrection" correction
  WHERE correction."replacementOfferingId" = NEW."subjectOfferingId";

  IF correction_snapshot IS NOT NULL
    AND correction_snapshot IS DISTINCT FROM "CurriculumCorrection_offering_snapshot"(NEW."subjectOfferingId") THEN
    RAISE EXCEPTION 'Correction-linked replacement configuration is immutable after completion validation';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "SubjectOfferingTerm_revalidate_correction_snapshot_trigger"
AFTER INSERT ON "SubjectOfferingTerm"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "CurriculumCorrection_revalidate_replacement_snapshot"();

CREATE CONSTRAINT TRIGGER "SubjectOfferingShsContext_revalidate_correction_snapshot_trigger"
AFTER INSERT ON "SubjectOfferingShsContext"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION "CurriculumCorrection_revalidate_replacement_snapshot"();

COMMIT;
