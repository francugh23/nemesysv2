UPDATE "AcademicYear"
SET "status" = 'LOCKED'
WHERE "id" = 'academic-year-2026-2027';

INSERT INTO "AcademicYear" (
  "id", "label", "startDate", "endDate", "status", "updatedAt"
) VALUES
  ('activation-a', '2027-2028', DATE '2027-06-01', DATE '2028-04-01', 'DRAFT', CURRENT_TIMESTAMP),
  ('activation-b', '2028-2029', DATE '2028-06-01', DATE '2029-04-01', 'DRAFT', CURRENT_TIMESTAMP);
