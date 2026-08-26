# Phase 21E-D: DepEd Reference Catalog Retirement From User Workflow

## Scope And Outcome

Phase 21E-D removes the DepEd reference catalog from routine Super Admin and Registrar workflows while preserving its schema, rows, migrations, source definitions, reconciliation infrastructure, and historical provenance. Curriculum remains the only operational surface where administrators configure what the school offers.

This decision supersedes earlier deferred wording that proposed moving the catalog to a dedicated user-facing placement. No replacement route or hidden administrative catalog screen exists.

## User Workflow

- The embedded DepEd Reference Catalog table and its independent pagination were removed from `/dashboard/subject-offerings`.
- Catalog list schemas, repository reads, Service/Action endpoints, hook, query invalidation, and table component were removed after their final runtime consumer was removed.
- Subject list/detail no longer queries or displays DepEd-reference availability.
- Canonical Academic Years, Subjects, and Curriculum routes remain unchanged.
- Curriculum explicitly retains Academic Year, Grade, reusable Subject, SHS classification, school-facing elective cluster, exact Terms, source/provenance text, and controlled school approval.
- The form uses **Source / Provenance Reference** rather than catalog-specific wording.
- The persisted `PROVISIONAL_DEPED -> SCHOOL_APPROVED` lifecycle remains unchanged, but the operational UI presents it as **Pending School Approval -> School Approved**.
- JHS remains full-year; SHS Terms remain explicit; no Grade 12 TechPro placement or reusable Subject classification is inferred.

## Retained Catalog Infrastructure

- `ShsCurriculumReference`, related enums/relations, all 171 rows, constraints, triggers, and migrations remain intact.
- DepEd source definitions, population scripts, catalog repository, and idempotent reconciliation Service remain available for historical/reference compatibility outside normal workflows.
- Offering `sourceReference`, school approval facts, Student Subject Enrollment provenance snapshots, audit history, and finalized evidence remain unchanged.
- There is no catalog foreign key on Offering, adoption, student participation, or result records.
- Catalog reconciliation continues to maintain catalog-defined identities and evidence but no longer demotes newly school-managed Academic categories to source-only status.

## Operational Clusters

- New school-facing Academic and TechPro categories are both supported by the existing cluster create path.
- Hidden source-only clusters remain excluded from operational options and are still rejected by generic Offering validation and PostgreSQL triggers.
- Source-backed historical school-facing clusters remain selectable for existing operational continuity but are read-only in cluster management.
- Newly school-managed clusters may be renamed or archived under the existing lifecycle, but their Academic/TechPro track is immutable after creation to prevent invalidating linked Offering contexts.
- The existing database active-code uniqueness constraint spans both school-facing and hidden source-only clusters. Codes already occupied by hidden source-only rows therefore remain unavailable; changing that requires a separately approved schema decision.

## Adoption Parity

- Adoption source projection now includes `cluster.isSchoolFacing`.
- Source-only elective clusters receive `SHS_CLUSTER_NOT_SCHOOL_FACING` and appear ineligible during preview.
- Commit reruns the same eligibility calculation inside the existing serializable transaction before any Offering write.
- Subject reuse, exact Term mapping, destination approval reset, audit provenance, and atomic rollback remain unchanged.
- Adoption copy and confirmation text explicitly state that copied SHS Curriculum does not carry school approval and requires destination-year review before student use.
- Offering and cluster mutations invalidate cached adoption previews; Offering/adoption mutations also refresh Subject usage counts.

## Permissions

- Permission mappings are unchanged.
- Super Admin retains generic Curriculum and operational-cluster create/edit/archive authority through `Permissions.SUBJECTS`.
- Registrar retains Curriculum read and school-approval authority through `Permissions.SHS_CURRICULUM_APPROVAL` and does not gain generic Offering or cluster mutation authority.

## Preserved Boundaries

- No Prisma schema, migration, database-record, canonical-route, approval lifecycle, Offering Term, Enrollment, Student Subject Enrollment, SSE Term, result, policy, Assignment, Grade, JHS, or audit-history change.
- No catalog record was deleted, archived, renamed, or backfilled.
- No direct `SCHOOL_APPROVED` creation, new school-owned status, Curriculum locking, prerequisite, completion, progression, scheduling, or grading behavior was introduced.

## Verification

- Focused Phase 21E-D and adoption contracts pass.
- Phase 20A through Phase 21E-C, Academic Year, Subject Offering, and Phase 21D regression boundary: 168 passed, five environment-gated tests skipped, zero failed.
- Targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and `npm run build` pass.
- `npx prisma validate` passes; 24 migrations remain applied with no schema drift.
- Prisma schema hash remains `cfdeea5eabbfb8f117cc6deaba4f5c11bf42b338`.
- Protected reference, cluster, Subject, Offering, Offering Term/context, Enrollment, participation, result, policy, Assignment, and Grade counts/hashes remain unchanged.

## Deferred Work

- Replacement of the persisted `PROVISIONAL_DEPED` lifecycle.
- Destructive catalog/schema cleanup or catalog archival/supersession.
- Direct `SCHOOL_APPROVED` creation.
- Revising active cluster-code uniqueness across hidden and school-facing categories.
- Phase 21E-E Curriculum locking/finalization and controlled overrides.
- Assignment modernization, prerequisites, completion/progression, scheduling, grading expansion, transferred credits, JHS modernization, and `TermEnrollment`.
