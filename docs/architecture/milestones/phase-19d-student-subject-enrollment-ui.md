# Phase 19D: Student Subject Enrollment UI

## Scope And Outcome

Enrollment Details exposes a read-only, Enrollment-scoped Student Subject Enrollment view. ACTIVE rows are the primary operational list, while REPLACED rows remain available as explicit replacement history in the same dialog.

## Read Surface

- The existing Enrollment Details dialog displays the Enrollment's student, Academic Year, Section, and Enrollment status context above its Student Subject Enrollment rows.
- Each row displays immutable Subject code, description, grade snapshot, ordered Academic Terms, and ACTIVE or REPLACED status.
- The read path uses `Permissions.ENROLLMENT` at both the Server Action and Service boundaries, with a narrow `['student-subject-enrollments', enrollmentId]` React Query key.
- Successful Enrollment updates invalidate only the affected Enrollment's Student Subject Enrollment query. Offering and Academic Term changes do not invalidate or rewrite Student Subject Enrollment history.

## Preserved Boundaries

- The view has no create, edit, replace, delete, grading, TermGrade, assessment, teacher assignment, scheduling, curriculum-selection, SHS, or specialized-program behavior.
- Student Subject Enrollment history remains immutable and is never hard-deleted.
- No Subject, Subject Offering, Academic Term, Subject Assignment, Grade, schema, migration, seed, or data change is required.
