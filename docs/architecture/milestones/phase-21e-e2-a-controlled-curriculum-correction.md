# Phase 21E-E2-A: Controlled Curriculum Correction Foundation

## Scope And Outcome

Phase 21E-E2-A adds a focused append-only archive-and-replace correction workflow for finalized or Student Subject Enrollment-dependent Curriculum Offerings. Corrections preserve the predecessor as the permanent owner of existing participation, Term membership, results, Enrollment history, finalization, and approval history while making one active same-year successor available prospectively.

The phase establishes correction lineage and transaction safety only. It does not add subject completion, prerequisite, promotion, split/merge correction, cross-year replacement, policy revision, or generalized historical rewriting.

## Persistence

- `SubjectOffering.replacesSubjectOfferingId` records immutable one-to-one predecessor lineage.
- `CurriculumCorrection` records the exact source and replacement, Academic Year, effective Term, actor, reason, evidence/reference, and database-validated source/replacement snapshots.
- Correction records and lineage are immutable. Restrictive foreign keys preserve every related historical identity.
- Three additive migrations establish the models, stable constraint naming, scoped database protocol, and authoritative completion guards. No existing Curriculum or student record was backfilled.

## Correction Rules

- Existing `Permissions.SUBJECTS` authority is enforced independently at Action and Service boundaries.
- Corrections require an `ACTIVE` Academic Year and an inter-Term gap. The effective Term must be unstarted under the transaction timestamp.
- The source must be finalized or dependency-locked. Ordinary configurable Offering changes continue through the E1 workflow.
- Replacement is one-to-one, same-year, same-grade, and distinct from its source. Self-reference, split/merge, cross-year replacement, and retire-without-successor are rejected.
- JHS correction is permitted only before Term 1 and retains every configured Term.
- SHS replacement is created atomically as `SCHOOL_APPROVED` with complete classification, provenance, approval reference, actor, timestamp, exact Terms, and a valid active elective cluster when applicable.
- Nonblank reason, evidence/reference, and explicit source-code confirmation are mandatory.

## Transactions And Database Enforcement

- The Service owns a serializable transaction with bounded retry for Prisma `P2034`, PostgreSQL serialization failure, and deadlock codes.
- Deterministic lock order is Academic Year, predecessor Offering, successor identity conflicts, Terms/clusters/policies, then predecessor participation impact.
- One transaction archives the predecessor, creates the successor and context/Terms, creates the immutable correction event, and writes source, successor, and correction audits.
- A transaction-local correction identity scopes the E1 exception to the exact source and replacement. There is no generic bypass flag.
- PostgreSQL validates the immutable correction intent and completion at commit, including lifecycle, current timestamp, inter-Term gap, effective Term, same year/grade, JHS/SHS rules, approval facts, lineage, archive state, and database-generated snapshots.
- Direct E2-shaped writes without a complete valid correction transaction fail.

## Historical Safety And Adoption

- Existing Student Subject Enrollment rows, their Term memberships, results, and parent Enrollments remain attached to the predecessor and are never moved, replaced, or rewritten by correction.
- Progressive SHS Core materialization treats active ancestor Terms as covered but materializes the active successor for uncovered current/future Terms.
- Current corrected elective participation maps to the active successor identity for additive UI submission; policy counts continue to include immutable predecessor participation.
- Curriculum adoption remains active-only. Archived predecessors are excluded and neither lineage nor correction identities are copied.

## UI

- Eligible rows expose `Correct / Replace Curriculum Offering`; ordinary Edit and Archive actions remain hidden when E1 guards apply.
- The focused dialog shows source facts, effective Term, successor configuration, participation/result impact counts, reason, evidence/reference, historical-safety explanation, and typed confirmation.
- Curriculum rows expose replacement lineage and authorized correction details.
- Academic Year Details displays the controlled-correction count without changing lifecycle or readiness semantics.

## Verification

- Focused E2-A and Phase 21D-B progression/drop regression boundary: 33 passed, one disposable-database concurrency test skipped, zero failed.
- Complete sequential repository suite: 277 passed, six environment-gated concurrency tests skipped, zero failed.
- `npx prisma validate`, migration status, and live schema drift checks pass with 31 applied migrations and no drift.
- `npx tsc --noEmit`, targeted ESLint, `npm run build`, and `git diff --check` pass.
- Protected counts remain 3 Academic Terms, 204 Subjects, 139 Offerings, 261 Offering Terms, 107 SHS contexts, 4 Enrollments, 28 Student Subject Enrollments, and 84 Student Subject Enrollment Terms.
- Protected legacy projections remain stable. The additive nullable lineage column changes only a full-row Offering hash; zero correction or lineage rows persist after rollback verification.
- Authenticated browser verification remains pending because no authenticated browser harness is available.

## Deferred Work

- Detailed multi-Term correction workflows beyond the safe prospective E2-A boundary.
- Split/merge correction, cross-year replacement, retire-without-successor, policy revision/versioning, and correction reversal.
- Subject prerequisites, completion, progression, promotion, graduation, transferred credits, partial-Term withdrawal, and reinstatement.
