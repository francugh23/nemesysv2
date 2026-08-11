# Phase 18C-1: Academic Terms And Semester Write Retirement

## Scope And Outcome

Phase 18C-1 introduces configurable `AcademicTerm` rows beneath `AcademicYear` and retires the legacy nullable `FIRST | SECOND` Semester fields from new Subject and Enrollment workflows. It does not create Subject Offerings, Student Subject Enrollments, Grade records, or Assignment changes.

## Academic Terms

- Terms have a name, positive ordinal, inclusive date-only start and end dates, timestamps, and optional creator.
- PostgreSQL enforces unique ordinals, unique normalized names, chronological dates, non-overlap within an Academic Year, and containment within the parent Academic Year.
- Terms are managed in the Academic Year detail view and can be created, edited, or removed only while the parent year is DRAFT.
- Terms have no separate lifecycle. ACTIVE, LOCKED, and ARCHIVED parent years expose their Terms as immutable historical calendar records.
- Academic Year activation requires exactly three Terms in ordinal chronological order. This is service policy, not a permanent database cardinality constraint.
- The migration seeds the approved 2026-2027 calendar: Term 1 (2026-06-08 through 2026-09-15), Term 2 (2026-09-16 through 2026-12-18), and Term 3 (2027-01-04 through 2027-04-08).

## Semester Retirement

- The physical `Semester` enum and nullable Subject and Enrollment columns remain unchanged for historical preservation.
- Subject and Enrollment create/update schemas, services, imports, operational list projections, filters, sorting, and UI no longer accept, write, query, or display Semester.
- Legacy Semester input is stripped at the Zod boundary, so it cannot overwrite preserved values.
- Semester is not mapped to or interpreted as an Academic Term.

## Authorization, Auditing, And Cache

- Academic Term reads and mutations use the existing `Permissions.ACADEMIC_YEARS` authorization boundary; no permission or route expansion was introduced.
- Term create, update, and draft removal write transactional `AcademicTerm` audit records. Audit Log navigation routes those records to Academic Year management.
- Term mutations invalidate only the parent Academic Year management query and the affected `['academic-terms', academicYearId]` detail query.

## Migration Safety

- The migration aborts unless the canonical `academic-year-2026-2027` row has the approved label and Academic Year boundaries.
- Parent and child date-containment triggers preserve the Academic Year/Term boundary in both mutation directions.
- Existing Subject, Enrollment, SubjectAssignment, Grade, and AuditLog rows, IDs, timestamps, and Semester values are unchanged.

## Verification

- The migration deployed successfully to the configured PostgreSQL database and `npx prisma migrate status` reports the schema up to date.
- Focused Academic Term, Academic Year, Semester retirement, import-template, and query-cache tests passed.
- Targeted ESLint passed.
- `npx prisma validate` and `npx prisma generate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings only.
- `npm run build` passed.
- Authenticated browser verification remains unavailable in this environment and is required before production release.

## Deferred Work

- Subject Offering foundation and JHS curriculum mapping.
- Explicit SHS Academic, TechPro, and elective-cluster mapping.
- Student Subject Enrollment, TermGrade, manual final-grade entry, and legacy Grade migration.
- Subject Assignment modernization, including any Offering or Term applicability.
- Scheduling, automatic rollover, and destructive Semester retirement.
