# Phase 08: Subject Assignment

## Scope And Outcome

Phase 8 delivered the Subject Assignment foundation, read path, creation flow, view/edit/archive lifecycle, and a shared DataTable sorting correction. The Assignment page is available at `/dashboard/assignments`.

Completed subphases:

- Phase 8A: Subject Assignment Foundation
- Phase 8A.1: Shared DataTable Sorting Fix
- Phase 8B: Subject Assignment Creation
- Phase 8C: Subject Assignment View and Edit
- Phase 8D: Subject Assignment Archive

## Architecture And Read Model

- The read path follows `schema -> repository -> service -> server action -> React Query hook -> page`.
- The flat Assignment list presents Teacher employee number and full name; Subject code and description; Section grade level, track/strand, and name; and academic year.
- The page uses the shared DataTable, sortable `DataTableColumnHeader` columns, and a dedicated loading skeleton.
- DataTable renders visible rows through `table.getRowModel().rows`, so filtering, sorting, and pagination compose correctly across Students, Teachers, Subjects, and Subject Assignments.
- Empty-state behavior continues to use filtered-row state. Student export intentionally uses `table.getFilteredRowModel().rows` to include all filtered records rather than only the current page.
- The existing shared empty-state and pagination behavior remains in use; feature-specific empty-state configuration was deferred pending an approved shared enhancement.

## Creation Rules

- Creation follows `schema -> action -> service -> repository` and requires an authenticated user.
- The related Teacher, Subject, and Section must be active.
- Subject and Section grade levels must match.
- When the Subject specifies a track/strand, it must match the Section track/strand.
- An active duplicate Teacher + Subject + Section + academic year assignment is rejected.
- Assignment creation and its CREATE audit log are committed atomically in the service-owned transaction.

## UI And Client-State Decisions

- The Create Assignment dialog uses reusable searchable selectors for active Teachers, Subjects, and Sections.
- Searchable selectors expose primitive string IDs to React Hook Form and Base UI Combobox controls. Option objects are used only for display labels and filtering text.
- `SubjectAssignmentForm` uses React Hook Form `Controller` bindings rather than `form.watch` and `form.setValue` adapters. This isolates controlled-field subscriptions and mutation lifecycles during dropdown selection and popup unmounting, retaining selected Teacher and Subject labels and IDs.
- Successful creation invalidates `['subject-assignments']` only.

## View And Edit Rules

- Clicking an Assignment row opens a read-only details dialog; the row action menu opens Edit without triggering the view dialog.
- Dialog state follows the Section Management per-open instance token pattern so stale mutation completion cannot close a newer dialog instance.
- Edit reuses `SubjectAssignmentForm` and the existing active Teacher, Subject, and Section option query.
- Update preserves the existing authenticated-user authorization policy at both action and service boundaries and validates the Assignment and all selected relationships inside the service-owned transaction.
- Subject and Section grade levels must match. When the Subject specifies a track/strand, it must match the Section track/strand.
- Active duplicate identity checks exclude the Assignment being edited.
- Assignment update and its UPDATE audit log commit or roll back together.
- Successful updates invalidate only `['subject-assignments']` and `['subject-assignment-options']`.
- Schedule, room, and shift remain outside the Assignment form and read model.

## Archive Lifecycle And Audit

- Archive preserves the existing authenticated-user authorization policy at both action and service boundaries.
- The service reloads the active Assignment inside its transaction and rejects missing or already archived records.
- Archive only sets `SubjectAssignment.deletedAt`; it never hard-deletes or cascades lifecycle changes.
- Enrollment and Grade do not directly reference SubjectAssignment in the current schema. Phase 8D therefore adds no dependency checks or changes to related records, and future dependency policy remains deferred.
- The soft archive and one ARCHIVE audit record commit or roll back together. The audit identity includes Teacher, Subject, Section, and Academic Year.
- The row action opens a shared confirmation dialog that requires typing `ARCHIVE` and uses the existing per-open instance token protection.
- Successful archive invalidates only `['subject-assignments']` and `['subject-assignment-options']`.

## Verification And Deferred Work

- Phase 8C targeted ESLint, `npx prisma validate`, `git diff --check`, and `npm run build` passed.
- Phase 8D targeted ESLint, `npx prisma validate`, `git diff --check`, and `npm run build` passed. The first build identified an incorrect repository selection placement; the selection was corrected and the final build passed.
- At delivery, an Assignment could not be completed against real data because no Section records existed. This was expected until Section Management populated the active Section selector, not a Phase 8B defect.
- Phase 8E final verification and knowledge promotion remains deferred. Import/export, scheduling, room, shift, timetable, curriculum, grades, and attendance remain outside the active Subject Assignment milestone.

## Dependencies

- Section Management supplies the active Section records required for Assignment creation.
- Assignment behavior is a prerequisite for later scheduling, class-list, attendance, and grade workflows.
