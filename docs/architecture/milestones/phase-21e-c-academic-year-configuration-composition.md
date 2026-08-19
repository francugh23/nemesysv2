# Phase 21E-C: Academic Year Configuration Composition

## Scope And Outcome

Phase 21E-C reorganizes Academic Year Details into a bounded configuration overview without merging Academic Year, Academic Term, Subject Offering, SHS elective-policy, or SHS result-interpretation-policy domains. The existing modal and canonical routes remain unchanged.

The final modal hierarchy is:

1. Overview
2. Academic Terms
3. Curriculum
4. SHS Configuration
5. Operational Readiness

Academic Terms remain the primary fully embedded child configuration. Curriculum and SHS policy domains expose concise factual summaries and retain their existing dedicated route or focused dialogs for full interaction.

## Read-Only Configuration Summary

- A validated Academic Year configuration read path follows `Component -> Server Action -> Service -> Repository -> Prisma -> PostgreSQL`.
- The Action and Service independently require `Permissions.ACADEMIC_YEARS` and `Permissions.SHS_CURRICULUM_APPROVAL`.
- The Service reads the Academic Year, ordered Terms, active Offering aggregates, elective-policy scopes, and authorized result-policy facts in one repeatable-read transaction.
- Curriculum aggregates exclude archived Offerings and include active Offering count, represented grades, provisional SHS count, and school-approved SHS count.
- Represented grades are factual and do not assert Curriculum completeness.
- Elective-policy coverage compares configured policies with the existing configured Term x Grade 11/12 scopes. Missing scopes remain operational warnings, not activation requirements.
- Result interpretation policy is queried, returned, and summarized only when the caller has `Permissions.GRADES`. Registrar receives no result-policy status or facts.
- Readiness is computed in the Service and is never persisted.

## Readiness Semantics

The only activation blocker is the existing requirement for exactly three chronological Academic Terms. The Academic Year lifecycle service remains authoritative and unchanged.

Warnings for DRAFT and ACTIVE years are limited to:

- no active Curriculum;
- provisional SHS Offerings remaining;
- missing SHS elective-policy scopes.

Informational facts include:

- active Curriculum count;
- represented grades;
- school-approved SHS count;
- complete elective-policy scope coverage;
- authorized missing, DRAFT, or PUBLISHED result-policy status.

LOCKED and ARCHIVED configuration gaps are historical information rather than actionable warnings. A malformed non-draft Term configuration is also informational and does not imply lifecycle reopening or reactivation.

No Curriculum-complete, adoption-complete, Grade 12 TechPro-ready, or global operational-ready state is inferred.

## Modal Composition

- The modal uses the established constrained large-dialog pattern with a fixed header and scrollable body.
- Overview shows canonical label, lifecycle, dates, historical orientation, and subdued record metadata.
- Academic Terms remain fully embedded with existing DRAFT-only create/edit/remove behavior and canonical `AcademicTermBadge` presentation.
- Term query failure has an explicit retryable error state; a successful zero-row query retains the distinct empty state.
- Curriculum shows factual metrics and retains `/dashboard/subject-offerings?academicYearId=<id>`.
- Curriculum adoption remains a compact DRAFT-only action that opens the unchanged focused Phase 21B dialog.
- Elective-policy coverage is summarized in Academic Year Details; the unchanged full manager opens in a focused responsive dialog.
- Authorized result-policy status, threshold, and reference are summarized; the unchanged full manager opens in a focused dialog. Published policy access is labeled read-only.
- Fresh summary lifecycle data is carried into focused dialogs so their initial presentation is not based on a stale table row.

## Permissions And Lifecycle

- UI visibility uses the centralized `hasPermission` catalog rather than direct role comparisons.
- Super Admin receives the full authorized configuration surface.
- Registrar receives Terms, Curriculum summary/link, and elective-policy management.
- Registrar receives no result-interpretation-policy status, reference, threshold, or controls.
- DRAFT retains Term management and authorized adoption.
- ACTIVE retains read-only Terms and the existing operational policy capabilities.
- LOCKED and ARCHIVED use historical/read-only presentation.
- All existing Actions and Services remain authoritative for writes.

## Query Coherence

- The configuration summary query is enabled only while Academic Year Details is open.
- Focused policy reads are enabled only while their dialogs are open.
- The summary replaces duplicate Term reads in the main details modal.
- Successful Academic Year lifecycle, Term, Curriculum, adoption, elective-policy, and result-policy mutations invalidate the narrow Academic Year configuration-summary query family.
- Existing operational invalidations required by Phase 21B and Phase 21D remain unchanged.

## Preserved Boundaries

- No Prisma schema, migration, database-record, route, permission mapping, lifecycle, Term, Curriculum, adoption, elective-policy, result-policy, Enrollment, JHS/SHS runtime, SubjectAssignment, or DepEd catalog-placement change.
- No persisted readiness state.
- No Curriculum locking, finalization, override, prerequisite, completion, progression, scheduling, Assignment modernization, or grading expansion.

## Verification

- Focused Phase 21E-C suite: 11 passed.
- Phase 21A through Phase 21E-C, Academic Year, Subject Offering, and Phase 21D regression boundary: 146 passed, five environment-gated tests skipped, zero failed.
- Targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and `npm run build` pass.
- Prisma schema hash remains `cfdeea5eabbfb8f117cc6deaba4f5c11bf42b338`.
- Migration count remains 24 and the database schema is current.
- Protected Academic Year, Term, Subject, Offering, policy, Assignment, Enrollment, participation, Grade, and result counts/hashes remain unchanged.
- Authenticated desktop, laptop/tablet, mobile, keyboard, and focus verification remains pending because this environment has no browser automation or authenticated browser session.

## Deferred Work

- Phase 21E-D: dedicated DepEd reference-catalog placement.
- Phase 21E-E: Curriculum finalization, first-operational-Enrollment locking, and controlled override decisions.
- Route-addressable Academic Year details unless later workflows establish a strong deep-linking requirement.
- Expected Curriculum matrices or persisted configuration-completeness policy.
- Assignment modernization and all prerequisite, completion, progression, scheduling, attendance, promotion, graduation, and grading expansion.
