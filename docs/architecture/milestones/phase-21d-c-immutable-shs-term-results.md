# Phase 21D-C: Immutable SHS Term Result Foundation

## Scope And Outcome

Phase 21D-C adds trustworthy SHS Term-level final-result evidence without interpreting that evidence. One `ShsTermResult` belongs directly to one immutable `StudentSubjectEnrollmentTerm` composite identity. Enrollment remains the annual parent, progressive Student Subject Enrollment remains the participation model, no Term Enrollment exists, JHS behavior is unchanged, and legacy `Grade` remains untouched.

## Result Contract

- `finalResult` is nullable `DECIMAL(5,2)` evidence from 0.00 through 100.00. A DRAFT may be blank; FINALIZED requires a value.
- Result lifecycle is DRAFT or FINALIZED. Authorized DRAFT records may be edited. FINALIZED rows cannot be updated or deleted at either the application or PostgreSQL boundary.
- Finalization facts are present only for FINALIZED records. Database checks enforce range and lifecycle consistency.
- Exactly one result may exist for each `(studentSubjectEnrollmentId, academicTermId)` membership. The composite foreign key prevents results for non-member Terms.
- A FINALIZED result does not mean pass, completion, credit, prerequisite satisfaction, progression, promotion, or graduation.

## Eligibility And Time

- Only ACTIVE Grade 11/12 SHS Student Subject Enrollment rows with an exact immutable Term membership may receive a result.
- REPLACED and DROPPED history remains readable but has no result controls and cannot receive a new result.
- Draft creation and editing begins on the applicable Term start date and remains available afterward. Finalization begins on the applicable Term end date.
- Date eligibility uses the target Academic Term's configured date and the Philippine operational calendar date. It does not use current-Term resolution and does not require the Academic Year to remain active.
- Result entry is never inferred from Enrollment alone, an ended Term, Subject Assignment, Curriculum/catalog data, or legacy Grade.

## Authority, Transactions, And UI

- Existing `Permissions.GRADES` authority is enforced independently by Server Actions and Services; it remains Super Admin-only.
- Writes use serializable transactions with bounded retry for recognized serialization/deadlock conflicts.
- Lock order is Enrollment, Student Subject Enrollment, exact Student Subject Enrollment Term, then an existing result. Ownership and eligibility are revalidated after locks.
- Draft/finalization changes and Audit Logs commit or roll back together.
- Enrollment Details displays result status/value under the exact Term. Only Super Admin receives DRAFT controls; FINALIZED and terminal-participation evidence is read-only.
- Successful writes invalidate only the affected Enrollment-scoped Student Subject Enrollment query.

## Migration And Verification

- Migration `20260820000000_phase21d_c_shs_term_results` is additive and performs no backfill or existing-data mutation.
- Existing Enrollment, Student Subject Enrollment, Term membership, and legacy Grade records were not converted or rewritten.
- Focused tests cover schema validation, composite ownership, cross-Enrollment rejection, ACTIVE eligibility, terminal-history rejection, DRAFT creation/update, date-gated finalization, finalized immutability, audit rollback, authority, UI, cache scope, legacy Grade isolation, and JHS isolation.
- A two-connection create/finalize race passed against a disposable logical clone and the clone was removed.
- A clean blank-database migration-chain attempt remains blocked by the recorded pre-existing Phase 18C seed guard before reaching this migration. The fully migrated disposable clone and live database both report all 22 migrations applied, and live schema drift is empty.

## Deferred

Passing policy, completed-subject status, prerequisites, credits, remediation, repeated subjects, result correction/revision/reopening, transferred credits, teacher-owned grading, Subject Assignment modernization, promotion, progression, graduation, report cards, transcripts, JHS result modernization, and legacy Grade migration remain separately deferred.
