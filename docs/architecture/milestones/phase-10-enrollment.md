# Phase 10: Enrollment Management

## Scope And Outcome

Phase 10A delivered the Enrollment module foundation and read path at `/dashboard/enrollment`. Phase 10B added placement-based Enrollment creation. Phase 10C added details, placement editing, and status transitions.

Completed subphases:

- Phase 10A: Enrollment Module Foundation and Read Path
- Phase 10B: Enrollment Creation
- Phase 10C: Enrollment Details, Edit, and Status Lifecycle

## Read Model Decisions

- Enrollment reads require an authenticated `SUPER_ADMIN` at both Server Action and service boundaries.
- The list includes every Enrollment with `deletedAt: null`, regardless of Enrollment status.
- Non-archived Enrollment records remain visible when a related Student or Section has been archived so historical relationships are preserved.
- The flat read model contains Student LRN and name, Section grade level, track/strand and name, academic year, semester, and Enrollment status.
- Student status is not included because it is stored independently from Enrollment status.
- Nullable semester and track/strand values display as an em dash. Academic year values display unchanged.

## Architecture

- The read path follows `Components -> Server Actions -> Services -> Repositories -> Prisma -> PostgreSQL`.
- The repository explicitly filters `Enrollment.deletedAt: null`, selects only list fields and required Student and Section relations, and performs no authorization or business policy.
- The service repeats authorization and maps the nested Prisma result into the Zod-inferred flat list item.
- The input-free Server Action repeats authorization and returns the list directly to the Enrollment query hook.
- TanStack Query owns the stable `['enrollments']` query key and loading, error, retry, and data state.
- No transaction or audit record is required because Phase 10A performs no mutation.

## Creation Decisions

- Creation requires an authenticated `SUPER_ADMIN` at both Server Action and service boundaries.
- Enrollment represents Student placement into one Section; subject enrollment and per-student subject materialization are not part of this milestone.
- Creation accepts a Student, Section, trimmed academic year, and optional semester. Enrollment status uses the Prisma `ACTIVE` default.
- Active Student and Section eligibility means `deletedAt: null`. Enrollment creation does not read or update `Student.status`.
- Duplicate identity follows the existing physical `Enrollment(studentId, academicYear)` uniqueness constraint, including archived records. The service checks this identity and maps concurrent Prisma `P2002` conflicts to the same safe domain error.
- The service revalidates Student and Section eligibility, creates the Enrollment, and writes its `CREATE` AuditLog in one Prisma transaction.
- The audit record identifies the actor, Enrollment, Student, academic year, and destination Section without changing related records.
- No Prisma schema or migration change was required.

## Creation UI

- The Enrollment toolbar opens a shared form dialog containing React Hook Form fields validated by Zod.
- Student and Section use the shared SearchableSelect with non-archived form options; Academic Year uses a text input and Semester is optional.
- The Enrollment hook owns the options query and create mutation. Successful creation invalidates only `['enrollments']` and `['enrollment-form-options']`.
- The form reports structured action errors, resets only after success, and closes its dialog after the successful invalidations complete.

## UI Decisions

- The page uses the shared CrudToolbar and DataTable conventions, with no toolbar actions or row interactions in Phase 10A.
- Sortable columns present LRN, Student, Grade, Track / Strand, Section, Academic Year, Semester, and Status.
- The page provides loading, empty, error, retry, sorting, and pagination states.
- A dedicated table skeleton is used by both the route fallback and query loading state.
- Enrollment status uses the existing Badge primitive. The Student-specific status badge was not broadened to cover a separate domain enum.

## Details And Update Decisions

- Row selection opens a read-only details dialog containing Student identity, Section identity, academic year, semester, status, and Enrollment timestamps.
- Enrollment identity is immutable. Student and academic year are displayed as context in the edit dialog but are not part of `UpdateEnrollmentSchema` and cannot be updated.
- Only Section, semester, and status are editable, and only while the Enrollment is `ACTIVE`.
- Section changes require a non-archived destination Section with the same grade level and compatible track/strand. Compatibility follows the Subject Assignment rule: a non-null source track/strand must equal the destination track/strand.
- Status follows an explicit state machine: `ACTIVE` may transition to `COMPLETED`, `DROPPED`, or `TRANSFERRED`; all three resulting statuses are terminal. Reopening is not supported.
- The Server Action and service independently enforce `Permissions.ENROLLMENT`. The service revalidates the active Enrollment and destination Section inside its transaction.
- The Enrollment update and one `UPDATE` AuditLog commit or roll back together. Audit metadata records changed Section, semester, and status values when applicable.
- Successful updates invalidate only `['enrollments']`. Form options and unrelated domain queries are unchanged.
- No Prisma schema or migration change was required.

## Verification

- Targeted ESLint passed for all Phase 10C TypeScript and TSX files.
- `npx prisma validate` passed.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/enrollment`.
- Browser and database-backed behavioral verification were not run.

## Manual Verification Checklist

- Confirm row selection opens details with identity, placement, status, and timestamps.
- Confirm only active Enrollment rows expose Edit and identity fields are read-only context.
- Confirm Section and semester updates succeed without changing Student or academic year.
- Confirm archived, grade-mismatched, and track/strand-incompatible Sections are rejected.
- Confirm `ACTIVE` can transition to `COMPLETED`, `DROPPED`, or `TRANSFERRED`.
- Confirm terminal Enrollment records cannot be edited or reopened.
- Confirm each successful update creates exactly one transactional `UPDATE` Enrollment audit record with changed-field metadata.
- Confirm Student status and all deferred subject, grade, archive, import, and academic-year workflows remain unchanged.
- Confirm successful updates refresh only the `['enrollments']` query.

## Deferred Work

- Enrollment archive and restore behavior, and related Student status policy.
- Subject enrollment and automatic materialization of Section Subject Assignments into per-student Enrollment Subjects.
- SHS irregular and transferee workflows.
- Bulk enrollment, import/export, and academic-year governance.
- Grade-aware completion and placement-change policy.

## Dependencies

- Student records and Section Management provide the required Enrollment relationships.
- Enrollment records are a prerequisite for class lists, grades, attendance, promotion, and graduation workflows.
