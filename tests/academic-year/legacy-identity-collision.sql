DROP INDEX "Enrollment_studentId_academicYear_key";

INSERT INTO "Enrollment" (
  "id", "studentId", "sectionId", "academicYear", "status",
  "createdById", "createdAt", "updatedAt"
) VALUES (
  'enrollment-collision', 'student-1', 'section-1', '2026-2027', 'ACTIVE',
  'u-admin', now(), now()
);
