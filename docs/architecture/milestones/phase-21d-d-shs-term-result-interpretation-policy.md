# Phase 21D-D: SHS Term Result Interpretation Policy Foundation

## Scope And Outcome

Phase 21D-D adds an explicit Academic Year adoption boundary for interpreting trustworthy finalized SHS Term Result evidence. It does not alter `ShsTermResult`, participation, completion, credits, prerequisites, progression, or legacy grading. A published policy supplies read-time `PASSED` or `FAILED` meaning while the underlying finalized evidence remains unchanged.

## Policy Contract

- Each Academic Year may have one `ShsTermResultInterpretationPolicy`.
- The approved passing threshold is exactly `75.00`. Interpretation compares the stored `DECIMAL(5,2)` result directly with `finalResult >= passingThreshold`; no rounding or transmutation occurs.
- The policy applies uniformly to Grade 11 and 12 Core, Academic Elective, and TechPro Term Results in its Academic Year. No grade, Term, classification, Subject, or Offering override exists.
- A school-approved documentary or reference basis is required.
- Policy lifecycle is DRAFT or PUBLISHED. Draft creation, editing, and publication are allowed only while the Academic Year is ACTIVE.
- A published policy requires publisher and publication timestamp and is database-immutable and non-deletable. Correction and revision remain deferred.
- Policy writes and audits use service-owned serializable transactions with bounded retry and deterministic Academic Year then policy locking.

## Interpretation Contract

- Only a FINALIZED SHS Term Result with a numeric value and a PUBLISHED policy receives a derived outcome.
- Values at or above `75.00` are `PASSED`; values below `75.00` are `FAILED`.
- DRAFT results, absent results, and finalized results without a published policy have no interpretation.
- Missing policy does not block result entry or finalization.
- Publication retrospectively interprets existing finalized results in the Academic Year without updating or backfilling any result.
- Interpretation is a read projection, not a persisted result field or a Student Subject Enrollment lifecycle state.
- Term interpretation does not establish subject completion, credits, prerequisite satisfaction, promotion, progression, or graduation.

## Authority And UI

- Existing `Permissions.GRADES` protects policy reads and mutations independently at Server Action and Service boundaries and remains Super Admin-only.
- Academic Year Details exposes fixed-threshold policy drafting, source-reference editing, and irreversible publication confirmation only to Super Admin.
- Enrollment Details displays PASSED or FAILED beside exact finalized Term evidence when a policy is published and displays a neutral unavailable state otherwise.
- Draft saves invalidate only the Academic Year policy query. Publication also invalidates Student Subject Enrollment result reads because every finalized result in that Academic Year may gain an interpretation.
- The source reference remains within the GRADES-authorized policy read and is not exposed through Enrollment reads.

## Migration And Verification

- Migrations `20260821000000_phase21d_d_shs_result_interpretation_policy` and `20260821001000_phase21d_d_policy_guard_completion` are additive and perform no backfill or existing-data mutation.
- PostgreSQL enforces the fixed threshold, nonblank source, one policy per Academic Year, publication consistency, ACTIVE-year writes, immutable Academic Year ownership, and published update/delete protection.
- The complete repository suite passes 219 of 224 tests with five existing environment-gated tests skipped.
- The focused Phase 21D-D suite passes 14 tests, and the Phase 21D-B through D focused regression suite passes 53 tests.
- A real two-connection create/publish race passes in a disposable isolated PostgreSQL database, which is removed afterward.
- Targeted ESLint, TypeScript, Prisma validation and generation, migration status, live drift comparison, production build, and `git diff --check` pass.
- Protected Enrollment, Student Subject Enrollment, Term membership, legacy Grade, SHS Term Result, and Subject Assignment counts and hashes remain unchanged. No policy was seeded.

## Deferred

Subject completion, credits, prerequisites, equivalence, remediation, repeated subjects, transferred credits, result correction/revision, policy correction/revision, teacher-owned grading, Subject Assignment modernization, progression, promotion, graduation, report cards, transcripts, JHS result modernization, legacy Grade migration, Term Enrollment, and automated progression remain separately deferred.
