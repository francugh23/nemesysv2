# Phase 09: Section Management

## Scope And Outcome

Phase 9 delivered full Section CRUD at `/dashboard/sections`: active-list reads, creation, view, edit, and soft archive.

Completed subphases:

- Phase 9A: Section Foundation and Read Path
- Phase 9B: Section Creation and Adviser Management
- Phase 9C: Section View, Edit, and Archive
- Phase 9D: Verification and Knowledge Promotion

## Domain Decisions

- Section fields are grade level, track/strand, section name, optional adviser, optional room, and optional shift. No model attributes were added.
- Active identity is normalized grade level, null-safe normalized track/strand, and normalized section name. Archived identities may be reused by a newly active Section.
- Grade levels use canonical values `7` through `12`. Grades 7 through 10 require null track/strand; grades 11 and 12 may omit a track/strand or use a trimmed uppercase value.
- Section names are trimmed, non-empty, and compared case-insensitively for active identity. Blank optional values normalize to null.
- Room is informational only, with no scheduling or uniqueness rules. Capacity remains deferred.
- Adviser is optional and must reference an active Teacher. Adviser status is derived from active Section relationships only; Section mutations do not read, write, or synchronize `Teacher.isAdviser`.

## Data And Mutation Architecture

- Reads and mutations follow `Components -> Server Actions -> Services -> Repositories -> Prisma -> PostgreSQL`.
- Section reads require an authenticated `SUPER_ADMIN` at both Server Action and service boundaries. The repository explicitly filters active records with `deletedAt: null`.
- The flat list contains grade level, track/strand, section name, optional adviser name, optional room, and optional shift.
- Creation reloads and validates active relationships in the service-owned transaction, checks normalized active identity, creates the Section, and writes a CREATE audit record atomically.
- Update reloads the active Section inside its transaction, normalizes and checks the identity excluding the current record, validates an optional active adviser, updates the record, and writes an UPDATE audit record atomically.
- Mutations are restricted to `SUPER_ADMIN`; navigation visibility is not authorization.

## Identity Migration

- Migration `20260729000000_section_identity_null_safe` normalizes Section identity values, rejects invalid or duplicate active data before modification, and defines a PostgreSQL partial unique expression index for active grade level + track/strand + section name identities.
- The migration was applied successfully during Phase 10D before migration `20260803063946_add_student_current_section`.
- Source-level checks and database-level concurrency enforcement are both active.

## Archive Lifecycle And Audit

- Archive never hard-deletes or cascades lifecycle changes. It sets `deletedAt` and preserves historical relationships and audit records.
- Archive requires an active Section with no active SubjectAssignments and no non-deleted Enrolments in `ACTIVE` status.
- Archive and its ARCHIVE audit record commit or roll back together.
- Active Section lists, Section form options, and Subject Assignment Section options exclude archived Sections.

## UI And Client-State Decisions

- The page uses the existing CrudToolbar, DataTable, loading skeleton, dialog-manager, React Hook Form, Zod, toast, confirmation-dialog, and SearchableSelect patterns.
- The page provides loading, empty, error, and retry states. Clicking a row opens read-only details; row actions open edit and archive dialogs.
- Create and Edit forms use `Controller`-bound Base UI Selects and primitive active-Teacher IDs in SearchableSelect. The optional shift can be cleared and normalizes to null.
- Dialog state uses a per-open instance token. A stale mutation completion can close only its originating dialog instance, including when a dialog is reopened for the same Section.
- Successful create, update, and archive mutations invalidate only `['sections']`, `['section-form-options']`, and `['subject-assignment-options']`. Dashboard data is not invalidated.

## Verification

- Phase 9B browser verification confirmed that selecting Grade 7 produces no controlled-state warnings or console errors.
- Phase 9C targeted ESLint, `npx prisma validate`, `git diff --check`, and `npm run build` passed.
- Phase 9D reran targeted ESLint across the Section feature, `npx prisma validate`, `git diff --check`, and `npm run build`; all passed.
- The production build includes `/dashboard/sections`.
- Database-backed Section behavior was not rerun after the migration was applied.

## Reusable Implementation Knowledge

- Normalize business identity values once at the schema boundary, repeat identity checks in the service transaction, and use a database constraint for concurrency-safe enforcement when deployment is available.
- Partial unique expression indexes are the PostgreSQL mechanism for active-only, normalized, null-safe identities when archived identities may be reused.
- Treat relationship-derived state as authoritative when a legacy boolean can drift. Section adviser status is derived from active Section relationships rather than synchronized to `Teacher.isAdviser`.
- Reload mutable records and referenced active relationships inside the service-owned transaction before enforcing business rules or writing audit records.
- Use per-open dialog instance tokens when asynchronous mutation completion must not close a newer dialog instance.
- Invalidate feature lists and dependent option queries after mutations, but do not invalidate unrelated dashboard data.

## Deferred Work And Residual Risks

- Restore, capacity, import/export, scheduling, timetables, Student Enrolment workflows, and Subject Assignment feature changes remain deferred.
- Archive dependency checks have a residual race with concurrent Subject Assignment or future Enrolment creation. Coordinated locking across those creation paths is outside Phase 9 scope.
- Deployment of the identity migration remains an environment blocker for database-level concurrency-safe identity enforcement and database-backed behavioral verification. It does not block completion of the implemented Phase 9 application scope.

## Dependencies

- Section Management enables active Section selection for Subject Assignment, Student Enrolment placement, adviser assignment, class lists, attendance, and grades.
