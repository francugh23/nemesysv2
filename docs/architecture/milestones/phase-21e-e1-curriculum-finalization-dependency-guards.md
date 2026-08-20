# Phase 21E-E1: Curriculum Finalization And Dependency Guards

## Scope And Outcome

Phase 21E-E1 adds explicit Curriculum finalization without changing the `AcademicYear` lifecycle. It combines a deliberate immutable finalization event with automatic Offering- and policy-scope dependency protection so student participation cannot be reinterpreted by later configuration changes.

`AcademicYear.LOCKED` remains the existing whole-year operational/historical lock. Curriculum finalization does not close Enrollment, SHS progression, subject DROP, Term Results, result interpretation, or the Academic Year.

## Persistence

- Added one optional `CurriculumFinalization` per Academic Year with `academicYearId`, `finalizedById`, `finalizedAt`, and `createdAt`.
- Finalization rows are immutable and use restrictive Academic Year and User foreign keys.
- No status enum, readiness state, inferred finalization, normalization, or backfill was added.
- Four additive migrations create the event and complete PostgreSQL lifecycle, dependency, race, and trigger-order guards.

## Finalization

- Only a Super Admin with existing `Permissions.SUBJECTS` authority may finalize.
- Action and Service boundaries authorize independently.
- The Service locks the Academic Year first, requires `ACTIVE`, rejects repeat finalization, and writes finalization plus audit atomically.
- Any active Grade 11/12 Offering that is missing SHS context or remains `PROVISIONAL_DEPED` blocks finalization.
- Missing grade coverage and missing elective-policy scopes remain warnings.
- Finalization does not mutate `AcademicYear.status`.

## Dependency Protection

- Finalized years reject ordinary Offering create/update/archive, Offering Term changes, SHS context/approval changes, and elective-policy changes in Services and PostgreSQL.
- Any Student Subject Enrollment dependency freezes Offering identity semantics, exact Term applicability, SHS classification, cluster, provenance, and approval facts before finalization.
- A depended Offering may still be archived before finalization to stop future use without rewriting preserved participation.
- Student Subject Enrollment insertion and child Term/context mutation serialize through Academic Year-first and parent Offering locks. The insertion lock trigger is ordered before source and SHS snapshot validation.
- `PROVISIONAL_DEPED -> SCHOOL_APPROVED` remains the only approval transition; approved status, reference, actor, and timestamp are immutable.
- Elective-policy create/update/delete is rejected once SHS participation exists in its Academic Year, Grade, and Term scope. Existing DROP below-minimum exception behavior is unchanged.
- PostgreSQL now enforces the existing Service rule that Academic Terms may be created, updated, or deleted only while their parent Academic Year is DRAFT.
- A school-facing cluster cannot be archived while an active Offering in an ACTIVE year references it. Code/name changes are rejected while active finalized Curriculum references it.

## Concurrency

- Finalization and ordinary Curriculum mutations serialize on deterministic Academic Year row locks.
- Approval/archive and SHS selection serialize on Offering locks and revalidate after locking.
- Policy mutation and selection serialize on the Academic Year/policy scope.
- Direct participation creation locks Academic Year then source Offering, closing races with Term/context mutation.
- Curriculum adoption retains its existing serializable source/destination locking and never copies finalization or SHS approval.

## UI

- Academic Year Details displays `Configurable`, `Finalized`, or `Historical` Curriculum state.
- Finalized state displays finalizer and timestamp.
- The focused confirmation explains the permanent Curriculum freeze and explicitly excludes Enrollment, progression, results, and Academic Year closure.
- Pending SHS Offerings are displayed as a blocker; incomplete coverage remains warning-only.
- Curriculum rows display `Finalized`, `Locked by Student Participation`, and `Pending School Approval` where applicable.
- Ordinary edit/archive/approval actions are omitted when finalization or dependency rules block them.
- Finalized Academic Years are excluded from new Offering options; elective-policy UI becomes read-only.

## Verification

- Focused finalization, database, authorization, UI, rollback, operational-continuity, and concurrency contracts pass.
- Complete repository regression boundary: 263 passed, five environment-gated tests skipped, zero failed.
- Targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and `npm run build` pass.
- `npx prisma validate`, `npx prisma generate`, migration status, and schema drift checks pass with 28 applied migrations.
- Protected application records and hashes remained stable across the final regression/verification run.

## Deferred Work

- Phase 21E-E2 controlled archive-and-replace correction and lineage.
- Policy revision/versioning.
- Teaching Assignment modernization, scheduling, prerequisites, completion/progression/promotion, graduation, grading expansion, transferred credits, and `TermEnrollment`.
- Destructive DepEd catalog cleanup and replacement of `PROVISIONAL_DEPED` lifecycle vocabulary.
- Cluster-code uniqueness redesign.
