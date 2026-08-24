# Phase 21F-A: Controlled Enrollment Placement Correction

## Scope And Outcome

Phase 21F-A replaces ordinary Enrollment placement editing with a focused, evidence-backed same-grade Section correction. It preserves the existing Enrollment identity and every participation, Term membership, result, Grade, Curriculum, and audit identity while synchronizing the Student's current Section and recording immutable correction history.

The workflow corrects only Section placement. It does not change grade level, Enrollment lifecycle or entry facts, JHS or SHS participation, elective selection, results, Curriculum, Academic Terms, or `TermEnrollment`.

## Correction Rules

- Correction requires an `ACTIVE` Enrollment in the `ACTIVE` Academic Year.
- Source and destination Sections must be distinct, active, and in the same grade level.
- The caller supplies the expected source Section so a stale correction is rejected rather than silently applied.
- A trimmed nonblank reason and evidence reference plus explicit confirmation are mandatory.
- `Permissions.STUDENT_CORRECTIONS` is available only to Super Admin and Registrar. The Server Action and authorized Service enforce it independently; Principal and Teacher are denied.
- The Enrollment keeps its identity, status, lifecycle timestamps, Academic Year, entry Academic Term, SHS Track, creation timestamp, and participation records.
- `Student.currentSectionId` is synchronized to the destination in the same transaction. Enrollment and Student status remain otherwise unchanged.
- Each success creates one immutable `StudentEnrollmentCorrection` event and two atomic Audit Log records: the correction event and the Enrollment placement update.

## Transaction And Database Safety

- The Service owns a `SERIALIZABLE` transaction with deterministic locks and a bounded three-attempt retry for serialization or deadlock conflicts.
- PostgreSQL permits the placement update only when an exact transaction-local correction capability matches a newly inserted correction event and the Enrollment's source, destination, identity, lifecycle, and entry snapshots.
- Deferred completion checks require the Enrollment and Student summary to reach the recorded destination before commit.
- A monotonic correction sequence plus transaction-scoped advisory locks prevents event replay, forced early validation, savepoint escape, and reuse across sequential corrections.
- Participating source and destination Sections cannot change grade or archive in the correction transaction.
- The corrected Enrollment's Student Subject Enrollments, Term memberships, SHS Term Results, and legacy Grades cannot be inserted, changed, or deleted in the correction transaction.
- Correction events are append-only. Direct, partial, forged, stale, replayed, and out-of-scope writes fail without weakening the existing E1/E2 Curriculum or Enrollment evidence guards.

## Application Surface

- Enrollment Details exposes a focused `Correct Placement` dialog only when the caller is authorized and the Enrollment is eligible.
- The dialog presents the current and destination Sections, fixed grade level, informational participation count, mandatory reason/evidence, and explicit confirmation that Student Subject Enrollments, their Terms, and results remain unchanged.
- Enrollment Details presents compact immutable correction history with source, destination, actor, reason, evidence, and timestamp.
- Super Admin and Registrar see the correction surface; Principal and Teacher do not. Action and Service authorization remain authoritative.
- Enrollment Details and Correct Placement use bounded, fixed-header, scrollable-body dialog layouts with accessible actions on narrow or short viewports.
- Successful correction invalidates only Enrollment, Student, correction-history, and Enrollment filter-option query families.
- The legacy general-purpose placement-edit form and dialog are retired.

## Verification

- Focused 21F-A contract and PostgreSQL integration boundary: 19 passed, zero failed.
- Disposable cloned-database correction race and committed-event advisory-lock forgery check: one passed, zero failed; the temporary database was removed.
- Complete sequential repository suite: 315 passed, seven expected environment-gated skips, zero failed.
- `npx prisma validate`, `npx prisma generate`, migration status, and live schema drift checks pass with 46 applied migrations and no drift.
- `npx tsc --noEmit`, targeted ESLint, `npm run build`, and `git diff --check` pass.
- Protected projections remain exactly unchanged: 4 Enrollments, 4 Students, 28 Student Subject Enrollments, 84 Student Subject Enrollment Terms, zero SHS Term Results, zero legacy Grades, 139 Subject Offerings, zero Curriculum Corrections, and 3 Academic Terms.
- Protected hashes remain exactly equal to their pre-change baseline. Zero correction events, fixture Students, fixture Sections, or temporary databases remain.
- Authenticated browser verification remains pending because no authenticated browser harness is available.

## Deferred Work

- Grade-level, cross-program, transferee-history, Enrollment reopening, archive/restore, and terminal-state correction.
- JHS derived-participation correction; SHS Core or elective correction; Term-specific participation correction; and Student Subject Enrollment migration or reinstatement.
- DRAFT result correction and FINALIZED result revision.
- Curriculum changes, prerequisites, completion, promotion, graduation, `TermEnrollment`, scheduling, attendance, and legacy Grade migration.
