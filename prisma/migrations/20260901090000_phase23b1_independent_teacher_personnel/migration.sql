BEGIN;

CREATE TYPE "TeacherStatus" AS ENUM ('ACTIVE', 'INACTIVE');

ALTER TABLE "Teacher"
  ADD COLUMN "employeeNumber" TEXT,
  ADD COLUMN "firstName" TEXT,
  ADD COLUMN "middleName" TEXT,
  ADD COLUMN "lastName" TEXT,
  ADD COLUMN "gender" "Gender",
  ADD COLUMN "email" TEXT,
  ADD COLUMN "status" "TeacherStatus" NOT NULL DEFAULT 'ACTIVE';

-- Legacy Teacher rows were credential-coupled. Preserve their personnel facts
-- before making the User link optional.
UPDATE "Teacher" AS teacher
SET
  "employeeNumber" = upper(btrim("user"."employeeNumber")),
  "firstName" = "user"."firstName",
  "middleName" = "user"."middleName",
  "lastName" = "user"."lastName",
  "gender" = "user"."gender",
  "email" = NULLIF(lower(btrim("user"."email")), ''),
  "status" = CASE WHEN "user"."status" = 'INACTIVE' THEN 'INACTIVE'::"TeacherStatus" ELSE 'ACTIVE'::"TeacherStatus" END
FROM "User" AS "user"
WHERE "user"."id" = teacher."userId";

DO $$
DECLARE
  missing_identity_count INTEGER;
  duplicate_identity TEXT;
BEGIN
  SELECT count(*) INTO missing_identity_count
  FROM "Teacher"
  WHERE "employeeNumber" IS NULL OR "employeeNumber" = '' OR "firstName" IS NULL OR "lastName" IS NULL OR "gender" IS NULL;
  IF missing_identity_count <> 0 THEN
    RAISE EXCEPTION 'Phase 23-B1 migration aborted: % Teacher rows lack required linked User personnel identity', missing_identity_count;
  END IF;

  SELECT "employeeNumber" INTO duplicate_identity
  FROM "Teacher"
  GROUP BY "employeeNumber"
  HAVING count(*) > 1
  LIMIT 1;
  IF duplicate_identity IS NOT NULL THEN
    RAISE EXCEPTION 'Phase 23-B1 migration aborted: canonical employee number collision for %', duplicate_identity;
  END IF;
END $$;

ALTER TABLE "Teacher"
  ALTER COLUMN "employeeNumber" SET NOT NULL,
  ALTER COLUMN "firstName" SET NOT NULL,
  ALTER COLUMN "lastName" SET NOT NULL,
  ALTER COLUMN "gender" SET NOT NULL,
  ALTER COLUMN "userId" DROP NOT NULL,
  DROP COLUMN "isAdviser";

ALTER TABLE "Teacher"
  ADD CONSTRAINT "Teacher_employeeNumber_key" UNIQUE ("employeeNumber");

CREATE INDEX "Teacher_status_idx" ON "Teacher"("status");
CREATE INDEX "Teacher_email_idx" ON "Teacher"("email");

COMMIT;
