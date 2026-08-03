# Phase 10: Enrollment Management

## Scope And Outcome

Phase 10A delivered the Enrollment module foundation and read path at `/dashboard/enrollment`. Phase 10B added placement-based Enrollment creation. Phase 10C added details, placement editing, and status transitions. Phase 10D completed lifecycle synchronization and controlled cross-grade placement correction. Phase 10E established Enrollment as the reference URL-driven server-table implementation.

Completed subphases:

- Phase 10A: Enrollment Module Foundation and Read Path
- Phase 10B: Enrollment Creation
- Phase 10C: Enrollment Details, Edit, and Status Lifecycle
- Phase 10D: Enrollment Lifecycle Completion
- Phase 10E: Enrollment Search, Filters, Sorting, and Table UX

## Read Model Decisions

- Enrollment reads require an authenticated `SUPER_ADMIN` at both Server Action and service boundaries.
- The list includes every Enrollment with `deletedAt: null`, regardless of Enrollment status.
- Non-archived Enrollment records remain visible when a related Student or Section has been archived so historical relationships are preserved.
- The flat read model contains Student LRN and name, Section grade level, track/strand and name, academic year, semester, and Enrollment status.
- Student status is not included in the Enrollment list because Enrollment status is the operational lifecycle value. Student status is a synchronized summary.
- Nullable semester and track/strand values display as an em dash. Academic year values display unchanged.

## Architecture

- The read path follows `Components -> Server Actions -> Services -> Repositories -> Prisma -> PostgreSQL`.
- The repository explicitly filters `Enrollment.deletedAt: null`, selects only list fields and required Student and Section relations, and performs no authorization or business policy.
- The service repeats authorization and maps the nested Prisma result into the Zod-inferred flat list item.
- The Server Action repeats authorization, validates the table query with Zod, and delegates to the service.
- TanStack Query keys each server result by `['enrollments', query]` and preserves prior rows during page, sort, search, and filter transitions.
- No transaction or audit record is required because Phase 10A performs no mutation.

## Creation Decisions

- Creation requires an authenticated `SUPER_ADMIN` at both Server Action and service boundaries.
- Enrollment represents Student placement into one Section; subject enrollment and per-student subject materialization are not part of this milestone.
- Creation accepts a Student, Section, trimmed academic year, and optional semester. Enrollment status uses the Prisma `ACTIVE` default.
- Active Student and Section eligibility means `deletedAt: null`. Enrollment creation synchronizes `Student.status` to `ENROLLED` and `Student.currentSectionId` to the Enrollment Section.
- Duplicate identity follows the existing physical `Enrollment(studentId, academicYear)` uniqueness constraint, including archived records. The service checks this identity and maps concurrent Prisma `P2002` conflicts to the same safe domain error.
- The service revalidates Student and Section eligibility, creates the Enrollment, and writes its `CREATE` AuditLog in one Prisma transaction.
- The audit record identifies the actor, Enrollment, Student, academic year, and destination Section without changing related records.
- No Prisma schema or migration change was required.

## Creation UI

- The Enrollment page header opens a shared form dialog containing React Hook Form fields validated by Zod.
- Student and Section use the shared SearchableSelect with non-archived form options; Academic Year uses a text input and Semester is optional.
- The Enrollment hook owns the options query and create mutation. Successful creation invalidates the Enrollment query family, form options, filter options, and synchronized Student data.
- The form reports structured action errors, resets only after success, and closes its dialog after the successful invalidations complete.

## UI Decisions

- The page uses the shared CrudToolbar and DataTable conventions. Row selection opens Enrollment details and active rows expose editing.
- Sortable columns present LRN, Student, Grade, Track / Strand, Section, Academic Year, Semester, and Status.
- The page provides loading, empty, error, retry, sorting, and pagination states.
- A dedicated table skeleton is used by both the route fallback and query loading state.
- The table toolbar contains a disabled Export placeholder and performs no partial export.
- Enrollment status uses the existing Badge primitive. The Student-specific status badge was not broadened to cover a separate domain enum.

## Server Table Architecture

- Enrollment is the reference implementation for reusable URL-driven server tables. Existing modules remain on backward-compatible client-mode DataTable behavior until separately migrated.
- Shared infrastructure owns only URL table state, debounced search, optional controlled server pagination and sorting, toolbar layout, faceted selects, reset behavior, pagination controls, and generic loading/error/empty rendering.
- Enrollment owns its Zod query schema, filters, filter-option provider, sort allowlist, Prisma query construction, authorization, and service mapping.
- URL parameters cover search, status, grade level, academic year, Section, semester, sort field/direction, page, and page size. Search, filter, sort, and page-size changes reset pagination.
- Global search tokenizes input and matches Student LRN/name, Section name, and academic year case-insensitively. Filters combine with logical AND.
- Filter options come from non-archived Enrollment history, so archived related Sections remain available for historical filtering.
- Repository reads always exclude archived Enrollment rows, count the filtered result, apply server pagination, and use stable ID tie-breaking for every sort.
- The service clamps an out-of-range requested page and the client reconciles the URL only after the new query result replaces placeholder data.
- Initial loading uses the Enrollment skeleton, errors remain retryable, background fetches keep prior rows visible, and empty copy distinguishes no records from no matches.

## Details And Update Decisions

- Row selection opens a read-only details dialog containing Student identity, Section identity, academic year, semester, status, and Enrollment timestamps.
- Enrollment identity is immutable. Student and academic year are displayed as context in the edit dialog but are not part of `UpdateEnrollmentSchema` and cannot be updated.
- Only Section, semester, and status are editable, and only while the Enrollment is `ACTIVE`.
- Section corrections may target any non-archived Section, including a different grade level or track/strand.
- Status follows an explicit state machine: `ACTIVE` may transition to `COMPLETED`, `DROPPED`, or `TRANSFERRED`; all three resulting statuses are terminal. Reopening is not supported.
- The Server Action and service independently enforce `Permissions.ENROLLMENT`. The service revalidates the active Enrollment and destination Section inside its transaction.
- The Enrollment update, synchronized Student summary, and one `UPDATE` AuditLog commit or roll back together. Audit metadata records Enrollment changes and changed Student status/current-Section values with readable Section context.
- Successful updates invalidate `['enrollments']` and `['students']`.
- Enrollment identity and academic year remain immutable.

## Lifecycle Synchronization

- Enrollment is the source of truth. `Student.status` and nullable `Student.currentSectionId` are synchronized summaries owned exclusively by `EnrollmentService`.
- Student stores no grade, Section name, track/strand, shift, adviser, homeroom, or other placement snapshot. Current placement is derived through `Student.currentSection`.
- Creation sets the Student to `ENROLLED` and points `currentSectionId` to the created active Enrollment's Section in the existing transaction.
- After an update, the latest non-archived active Enrollment is selected deterministically by `updatedAt DESC, id DESC`. Any active Enrollment results in `ENROLLED`, with its Section as the current Section.
- With no active Enrollment, `currentSectionId` is cleared and the latest non-archived terminal Enrollment determines the summary: `COMPLETED` maps to `ENROLLED`, `TRANSFERRED` maps to `TRANSFERRED`, and `DROPPED` maps to `DROPPED`. No Enrollment maps to `UNENROLLED`.
- Enrollment mutations lock the Student row before lifecycle reads and writes so concurrent mutations for one Student cannot overwrite the summary with stale state.
- Student profile actions and schemas do not accept `status` or `currentSectionId`.
- Migration `20260803063946_add_student_current_section` adds only the nullable Section relation and its index. Migration `20260803070000_backfill_student_enrollment_summary` initializes existing Student summaries from Enrollment using the same deterministic lifecycle rules. The previously pending Section identity migration was also applied successfully by Prisma before these migrations.

## Verification

- Targeted ESLint passed for all Phase 10E TypeScript and TSX files.
- `npx prisma validate` passed.
- `npx prisma migrate dev --name add_student_current_section` created and applied the relation migration, and `npx prisma migrate dev` applied the summary backfill migration. `npx prisma migrate status` reports the database is up to date.
- `git diff --check` passed with LF-to-CRLF workspace warnings.
- `npm run build` passed and includes `/dashboard/enrollment`.
- Direct PostgreSQL verification confirmed unfiltered and status-filtered counts, paginated reads, and historical filter-option reads. Browser verification was not run.

## Manual Verification Checklist

- Confirm row selection opens details with identity, placement, status, and timestamps.
- Confirm only active Enrollment rows expose Edit and identity fields are read-only context.
- Confirm Section and semester updates preserve Student identity and academic year.
- Confirm archived Sections are rejected and cross-grade or cross-track/strand corrections succeed.
- Confirm `ACTIVE` can transition to `COMPLETED`, `DROPPED`, or `TRANSFERRED`.
- Confirm terminal Enrollment records cannot be edited or reopened.
- Confirm each successful update creates exactly one transactional `UPDATE` Enrollment audit record with Enrollment and synchronized Student changed-field metadata.
- Confirm Student current placement displays through the related Section and no placement snapshots exist.
- Confirm successful creation and updates refresh `['enrollments']` and `['students']`.
- Confirm global search matches LRN, each Student name part, Section name, and academic year.
- Confirm status, grade, academic year, Section, and semester filters work independently and together.
- Confirm sorting, pagination, page size, reset, refresh, copied URLs, and browser back/forward navigation preserve correct URL state and results.
- Confirm initial loading, background fetching, retryable errors, no-records state, and no-matches state render correctly on desktop and mobile.

## Deferred Work

- Enrollment archive and restore behavior, and related Student status policy.
- Subject enrollment and automatic materialization of Section Subject Assignments into per-student Enrollment Subjects.
- SHS irregular and transferee workflows.
- Bulk enrollment, import/export, and academic-year governance.

## Dependencies

- Student records and Section Management provide the required Enrollment relationships.
- Enrollment records are a prerequisite for class lists, grades, attendance, promotion, and graduation workflows.
