BEGIN;

ALTER TABLE "Teacher"
  DROP CONSTRAINT "Teacher_userId_fkey",
  ADD CONSTRAINT "Teacher_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;

COMMIT;
