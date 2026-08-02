# Phase 10: Enrollment Management

## Scope And Outcome

Phase 10A delivered the Enrollment module foundation and read path at `/dashboard/enrollment`.

Completed subphases:

- Phase 10A: Enrollment Module Foundation and Read Path

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

## UI Decisions

- The page uses the shared CrudToolbar and DataTable conventions, with no toolbar actions or row interactions in Phase 10A.
- Sortable columns present LRN, Student, Grade, Track / Strand, Section, Academic Year, Semester, and Status.
- The page provides loading, empty, error, retry, sorting, and pagination states.
- A dedicated table skeleton is used by both the route fallback and query loading state.
- Enrollment status uses the existing Badge primitive. The Student-specific status badge was not broadened to cover a separate domain enum.

## Verification

- Targeted ESLint passed for all Phase 10A TypeScript and TSX files.
- `npx prisma validate` passed.
- `git diff --check` passed with an LF-to-CRLF workspace warning for `schemas/index.ts`.
- `npm run build` passed and includes `/dashboard/enrollment`.
- Browser and database-backed behavioral verification were not run.

## Deferred Phase 10B Work

- Enrollment creation and its domain eligibility rules.
- Form dialogs, React Hook Form, Controller bindings, and SearchableSelect options.
- Enrollment status transitions, lifecycle management, archive behavior, and related Student status policy.
- Transactional audit logging for material Enrollment mutations.
- Import/export and academic-year governance.

## Dependencies

- Student records and Section Management provide the required Enrollment relationships.
- Enrollment records are a prerequisite for class lists, grades, attendance, promotion, and graduation workflows.
