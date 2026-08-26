ALTER TABLE "ShsElectiveEnrollmentPolicy"
  DROP CONSTRAINT "ShsElectiveEnrollmentPolicy_counts_check";

ALTER TABLE "ShsElectiveEnrollmentPolicy"
  ADD CONSTRAINT "ShsElectiveEnrollmentPolicy_counts_check" CHECK (
    "minimumElectives" BETWEEN 0 AND 3
    AND "maximumElectives" BETWEEN 0 AND 3
    AND "minimumElectives" <= "maximumElectives"
  );
