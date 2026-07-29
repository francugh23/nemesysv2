# Phase 08: Subject Assignment

## Scope And Outcome

Phase 8 delivered the Subject Assignment foundation, read path, creation flow, and a shared DataTable sorting correction. The read-only Assignment page is available at `/dashboard/assignments`; creation is available through its dialog.

Completed subphases:

- Phase 8A: Subject Assignment Foundation
- Phase 8A.1: Shared DataTable Sorting Fix
- Phase 8B: Subject Assignment Creation

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

## Verification And Deferred Work

- Phase verification passed.
- At delivery, an Assignment could not be completed against real data because no Section records existed. This was expected until Section Management populated the active Section selector, not a Phase 8B defect.
- Editing, archiving, import/export, scheduling, room, shift, timetable, curriculum, grades, and attendance were deferred.

## Dependencies

- Section Management supplies the active Section records required for Assignment creation.
- Assignment behavior is a prerequisite for later scheduling, class-list, attendance, and grade workflows.
