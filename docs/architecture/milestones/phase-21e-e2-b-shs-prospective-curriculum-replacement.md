# Phase 21E-E2-B: SHS Prospective Curriculum Replacement Rules

## Scope And Outcome

Phase 21E-E2-B completes the SHS prospective behavior built on the controlled E2-A archive-and-replace foundation. It derives the only valid effective Term and successor Term set, validates every supported SHS classification transition, and resolves compatible correction lineage for future student participation without moving or rewriting historical records.

Curriculum correction changes school Curriculum configuration only. It does not repair a student's Enrollment placement, grade level, elective selection, Student Subject Enrollment, Term membership, result, or participation mistake. Those student-specific corrections remain separate deferred work.

## Prospective Correction Rules

- The Academic Year must be `ACTIVE`, and correction is available only during an `Asia/Manila` inter-Term gap.
- The effective Term is derived as the immediately next unstarted configured Term.
- An SHS successor receives exactly the predecessor Terms at or after the effective Term. Added, omitted, foreign, and pre-effective Terms are rejected.
- Every prospective `CORE`, `ACADEMIC_ELECTIVE`, and `TECHPRO_ELECTIVE` source-to-successor classification transition is supported when the target configuration is valid.
- Core has no cluster. Academic and TechPro elective successors require matching active school-facing clusters.
- An elective successor requires an existing policy for every successor Term. Correction locks and revalidates those scopes but never creates, updates, or deletes policy rows.
- The successor is created atomically as `SCHOOL_APPROVED` with newly supplied nonblank provenance, independent nonblank approval evidence, and approval actor/timestamp equal to the correction event.
- Correction does not re-finalize Curriculum or change the existing finalization event.

## Lineage And Student Safety

- Existing Enrollment, Student Subject Enrollment, Student Subject Enrollment Term, result, approval, finalization, and audit history stays attached to its original identities.
- Uncovered-Term continuation traverses only `CORE -> CORE` lineage. Core ancestry is not reused after a classification change.
- Elective identity mapping traverses only elective-to-elective lineage and preserves historical predecessor participation.
- Compatible repeated lineage chains resolve every ancestor needed for prospective coverage checks.
- A `DROPPED` ancestor blocks every compatible replacement descendant for the Academic Year. No dropped row is reinstated or replaced.
- Student-specific enrollment, grade-placement, elective-selection, participation, and result corrections must use separately approved student workflows, not Curriculum replacement.

## Adoption

- A partial-year correction successor is excluded from Curriculum adoption when its predecessor covered more Terms.
- An ordinary one-Term successor remains eligible under the existing adoption rules.
- Adoption never copies correction lineage, Curriculum finalization, school approval, or student-specific records.

## PostgreSQL Enforcement

- One additive migration strengthens the E2-A deferred completion guard; no lifecycle record or operational data is migrated.
- PostgreSQL independently validates the immediately next effective Term, exact remaining predecessor Term set, SHS classification and cluster rules, elective policy coverage, new provenance, independent approval evidence, and approval actor/timestamp.
- Direct writes with reused or absent evidence, mismatched approval facts, or a missing transaction-scoped correction identity are rejected.
- The E1 exception remains bound to the exact correction intent and exact source/replacement identities. Existing finalization, dependency, and correction-linked immutability guards are not weakened.

## UI

- The correction dialog displays the derived effective Term and successor Terms as read-only facts.
- Classification-aware cluster controls and policy compatibility explain whether the prospective successor is valid.
- Provenance and approval evidence start as new correction inputs rather than copied predecessor values.
- The lineage preview and warnings distinguish future school Curriculum behavior from immutable student history and direct users away from student-specific correction misuse.

## Verification

- Focused E2-B contract and integration boundary: 19 passed, zero failed.
- Affected E2-A, SHS progression/drop, and Curriculum adoption regression boundary: 63 passed, zero failed.
- Disposable cloned-database correction race: one passed, zero failed; the temporary database was removed.
- Complete sequential repository suite: 296 passed, six expected environment-gated skips, zero failed.
- `npx prisma validate`, `npx prisma generate`, migration status, and live Prisma schema drift checks pass with 32 applied migrations and no drift.
- `npx tsc --noEmit`, targeted ESLint, `npm run build`, and `git diff --check` pass.
- Protected counts remain 3 Academic Terms, 204 Subjects, 139 Offerings, 261 Offering Terms, 107 SHS contexts, 4 Enrollments, 28 Student Subject Enrollments, and 84 Student Subject Enrollment Terms.
- Protected Offering and participation projections remain at `44b0869a89e5c14d633d35107f4b25cf8593368b72a46258d11eaa4de8d59e08` and `e775508efa14339b40eca27539965ea7fe22b9f7091dacdcec275f38841b4e1e`; zero correction or lineage rows persist after verification.
- Authenticated browser verification remains pending because no authenticated browser harness is available.

## Deferred Work

- JHS E2-C expansion.
- Student Enrollment or grade-level correction, student elective correction/replacement, Student Subject Enrollment migration or reinstatement, and result correction.
- Policy revision/versioning, cross-year Curriculum lineage, split/merge correction, and retire-without-successor.
- Assignments, scheduling, prerequisites, completion, progression, promotion, graduation, and `TermEnrollment`.
- Cluster-code uniqueness redesign, destructive DepEd catalog cleanup, and lifecycle vocabulary replacement.
