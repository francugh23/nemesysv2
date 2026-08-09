INSERT INTO "User" (
  "id", "username", "email", "passwordHash", "firstName", "lastName",
  "gender", "role", "status", "isFirstLogin", "createdAt", "updatedAt"
) VALUES
  ('u-admin', 'admin', 'admin@example.test', 'hash', 'Admin', 'User', 'MALE', 'SUPER_ADMIN', 'ACTIVE', false, now(), now()),
  ('u-teacher', 'teacher', 'teacher@example.test', 'hash', 'Test', 'Teacher', 'FEMALE', 'TEACHER', 'ACTIVE', false, now(), now());

INSERT INTO "Teacher" ("id", "userId", "createdAt", "updatedAt")
VALUES ('teacher-1', 'u-teacher', now(), now());

INSERT INTO "Student" (
  "id", "lrn", "firstName", "lastName", "gender", "barangay",
  "municipality", "province", "createdById", "createdAt", "updatedAt"
) VALUES (
  'student-1', '123456789012', 'Test', 'Student', 'MALE', 'Barangay',
  'Municipality', 'Province', 'u-admin', now(), now()
);

INSERT INTO "Section" (
  "id", "gradeLevel", "sectionName", "createdById", "createdAt", "updatedAt"
) VALUES ('section-1', '7', 'Integrity', 'u-admin', now(), now());

INSERT INTO "Subject" (
  "id", "code", "description", "gradeLevel", "createdById", "createdAt", "updatedAt"
) VALUES ('subject-1', 'MATH7', 'Mathematics', '7', 'u-admin', now(), now());

INSERT INTO "Enrollment" (
  "id", "studentId", "sectionId", "academicYear", "status",
  "createdById", "createdAt", "updatedAt"
) VALUES (
  'enrollment-1', 'student-1', 'section-1', '2026-2027', 'ACTIVE',
  'u-admin', now(), now()
);

INSERT INTO "SubjectAssignment" (
  "id", "subjectId", "teacherId", "sectionId", "academicYear",
  "createdAt", "updatedAt"
) VALUES (
  'assignment-1', 'subject-1', 'teacher-1', 'section-1', '2026-2027',
  now(), now()
);

INSERT INTO "Grade" (
  "id", "enrollmentId", "subjectId", "createdById", "createdAt", "updatedAt"
) VALUES ('grade-1', 'enrollment-1', 'subject-1', 'u-admin', now(), now());
