-- Synchronize existing Student summaries from non-archived Enrollment records.
UPDATE "Student" AS "student"
SET
  "currentSectionId" = (
    SELECT "enrollment"."sectionId"
    FROM "Enrollment" AS "enrollment"
    WHERE "enrollment"."studentId" = "student"."id"
      AND "enrollment"."status" = 'ACTIVE'
      AND "enrollment"."deletedAt" IS NULL
    ORDER BY "enrollment"."updatedAt" DESC, "enrollment"."id" DESC
    LIMIT 1
  ),
  "status" = COALESCE(
    (
      SELECT 'ENROLLED'::"StudentStatus"
      FROM "Enrollment" AS "enrollment"
      WHERE "enrollment"."studentId" = "student"."id"
        AND "enrollment"."status" = 'ACTIVE'
        AND "enrollment"."deletedAt" IS NULL
      ORDER BY "enrollment"."updatedAt" DESC, "enrollment"."id" DESC
      LIMIT 1
    ),
    (
      SELECT CASE "enrollment"."status"
        WHEN 'COMPLETED' THEN 'ENROLLED'::"StudentStatus"
        WHEN 'TRANSFERRED' THEN 'TRANSFERRED'::"StudentStatus"
        WHEN 'DROPPED' THEN 'DROPPED'::"StudentStatus"
      END
      FROM "Enrollment" AS "enrollment"
      WHERE "enrollment"."studentId" = "student"."id"
        AND "enrollment"."status" IN ('COMPLETED', 'TRANSFERRED', 'DROPPED')
        AND "enrollment"."deletedAt" IS NULL
      ORDER BY "enrollment"."updatedAt" DESC, "enrollment"."id" DESC
      LIMIT 1
    ),
    'UNENROLLED'::"StudentStatus"
  ),
  "updatedAt" = CURRENT_TIMESTAMP;
