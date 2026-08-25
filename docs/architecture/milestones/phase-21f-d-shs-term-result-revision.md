# Phase 21F-D: SHS Term Result Revision

## Scope And Outcome

Phase 21F-D preserves ordinary DRAFT result editing and adds governed numeric revision for FINALIZED SHS Term Results. The original `ShsTermResult` remains immutable evidence for its exact `StudentSubjectEnrollmentTerm`; an append-only `ShsTermResultRevision` chain supplies the latest authoritative value.

## Contract

- Revisions require existing Super Admin-only `Permissions.GRADES` authority at Action and Service boundaries.
- A revision requires reason, evidence/reference, a changed `DECIMAL(5,2)` value, exact typed confirmation, and a fresh expected chain/value preview.
- Root result identity, FINALIZED evidence, revision actor/reason/evidence, predecessor, sequence, and values are immutable at PostgreSQL.
- PostgreSQL accepts only contiguous chains whose original snapshot equals the root evidence and whose prior authority equals the immediate predecessor/root value.
- Result reads expose original and authoritative values, authority source, and latest revision facts. Published interpretation uses authoritative FINALIZED value.
- C1 continues treating any root result evidence as a participation-correction blocker. Revision never voids, moves, or permits correction of participation.

## Verification

- Migrations `20260826000000_phase21f_d_shs_term_result_revision`, `20260826000100_phase21f_d_revision_guard_alias_fix`, and `20260826000200_phase21f_d_revision_constraint_names` are applied; 56 migrations are current and Prisma drift is empty.
- Focused 21F-D, 21D-C/D, and C1 checks pass 31/31. Result-revision concurrency is skipped because `C_RUN_CONCURRENCY` is not enabled against a disposable cloned database.
- Prisma validation/generation, TypeScript, targeted ESLint, production build, and diff checks pass.
- Protected counts remain unchanged: Enrollment 4, Student 4, StudentSubjectEnrollment 28, StudentSubjectEnrollmentTerm 84, ShsTermResult 0, ShsTermResultRevision 0, Grade 0, CurriculumCorrection 0.

## Deferred

Result voiding, reopening, cancellation, a combined result-disposition plus participation-correction workflow, report cards/transcripts, promotion/graduation, prerequisites/completion, transferee credit, cross-program correction, TermEnrollment, and JHS result modernization remain separately approved work.
