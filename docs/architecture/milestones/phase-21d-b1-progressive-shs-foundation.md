# Phase 21D-B1: Progressive SHS Foundation

## Scope And Outcome

Phase 21D-B1 adds only the backend and database foundation for progressive current-Term SHS participation. Enrollment remains one Student and Academic Year record, no Term Enrollment model exists, JHS derivation remains unchanged, and the Phase 20C selection workflow remains operational pending Phase 21D-B2.

## Student Subject Enrollment Integrity

- `StudentSubjectEnrollmentStatus` now includes `DROPPED` alongside `ACTIVE` and `REPLACED`.
- Lifecycle checks require mutually valid replacement/drop timestamps and a trimmed nonblank drop reason of at most 500 characters.
- Only `ACTIVE -> REPLACED` and `ACTIVE -> DROPPED` transitions are valid. Terminal status, timestamps, and drop reason are immutable.
- Student Subject Enrollment Term identities are immutable after insert, remain protected from hard deletion, and retain their existing Offering and Academic Year validation.
- Nullable `selectionAcademicTermId` provides a legacy-safe progressive identity. Active progressive rows are unique by Enrollment, Offering, and selection Term, while active legacy-null rows retain their previous Enrollment and Offering uniqueness.
- Deferred database checks require a populated elective selection Term to match exactly one Term membership, prohibit a selection Term on Core rows, and prevent overlapping active Enrollment, Offering, and Term coverage under a serialized parent Enrollment lock.
- Existing rows remain null for the new selection identity and were not rewritten. Phase 20C continues creating legacy-shaped null-identity rows until its replacement in Phase 21D-B2; B2 must require `selectionAcademicTermId` for every new progressive elective command.

## Elective Policy

- `ShsElectiveEnrollmentPolicy` configures minimum and maximum electives per Academic Year, Academic Term, and Grade 11/12.
- PostgreSQL enforces a unique scope, same-year composite Term relation, Grade 11/12, each bound within 1 through 3, and minimum not exceeding maximum.
- No policy rows are automatically created.
- List, create, and update actions and services independently require `SHS_CURRICULUM_APPROVAL`.
- Policy mutations lock their Academic Year scope, commit with audit history in one transaction, and expose repository row locks for later B2 enforcement.

## Current Term Resolution

- The reusable pure resolver uses the `Asia/Manila` calendar date and an injectable clock.
- It considers only the single active Academic Year and matches inclusive configured Term start/end dates.
- Gaps and absence of an active year return no current Term. Multiple active years or multiple date matches are configuration-integrity failures.
- Term position and legacy Semester, creation timestamps, Section Track/Strand, Enrollment Track, and client-provided current-Term values are not authoritative inputs.

## Migration And Legacy Safety

- Read-only preflight found three Enrollments, 20 Student Subject Enrollments, and 60 Term memberships with no active Offering duplicates, Term coverage duplicates, lifecycle anomalies, or invalid Term joins.
- Two legacy SHS Enrollments lack entry facts and three active SHS rows have multiple Terms. They remain untouched exceptions.
- The migration created no policy or progression rows and changed no Enrollment facts, snapshots, Term memberships, catalog/reference data, Grades, Subjects, Offerings, or Assignments.
- Post-migration counts and protected legacy projections/hashes match the preflight exactly. No provisional materialization, cross-year Term relationships, invalid lifecycle rows, or duplicate active Term coverage exist.

## Verification

- Focused current-Term and B1 database/backend suite: 12 passed.
- Phase 18C through 21D-A regression group: 70 passed and two known parallel rollback deadlocks; Phase 20C then passed 7/7 and Phase 21C passed 11/11 in isolation.
- Prisma validation/generation/migration status, live schema drift, targeted ESLint, TypeScript, `git diff --check`, production build, rollback/reapply simulation, and read-only safety audit passed.
- A disposable blank-database migration chain remains blocked by the pre-existing Phase 18C Academic Term approved-2026-2027 seed guard before reaching B1.

## Deferred To Phase 21D-B2 Or Later

Progressive selection commands and UI, current-Term policy enforcement, subject-drop action/UI, Phase 20C replacement, prerequisites, results/grades, transferred credits, completion, scheduling, automated progression, Strand migration, catalog redesign, and Term Enrollment remain out of scope.
