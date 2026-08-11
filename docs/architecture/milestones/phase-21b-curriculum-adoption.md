# Phase 21B: Curriculum Adoption And Rollover

## Scope And Outcome

Phase 21B adds an explicit Curriculum adoption workflow to Academic Year Details. A Super Admin can preview and atomically copy selected valid Subject Offerings from an ACTIVE, LOCKED, or ARCHIVED source Academic Year into a different DRAFT destination Academic Year without changing the source Curriculum or duplicating reusable Subjects.

This is Curriculum configuration rollover only. It does not roll over students, Enrollments, Student Subject Enrollments, Grades, Subject Assignments, or any student-specific history.

## Lifecycle Policy

- The destination Academic Year must be DRAFT.
- The source Academic Year must be ACTIVE, LOCKED, or ARCHIVED; a DRAFT source is not an approved Curriculum source.
- Generic Subject Offering create, edit, approval, and archive lifecycle rules remain unchanged. Adoption is the only narrow path that creates Offerings in a DRAFT year.
- The source and destination must be different records.
- The service locks both Academic Years in deterministic ID order with `FOR UPDATE`, then revalidates all lifecycle, mapping, eligibility, and conflict rules inside a serializable transaction.

## Academic Term Mapping

Academic Term IDs are owned by their Academic Year and are never inferred across years.

- Source and destination years must have the same number of configured Terms.
- Every configured source Term must be explicitly mapped to one unique destination Term.
- Every configured destination Term must be used exactly once.
- Term names and positions are displayed as guidance but do not establish identity or automatic mapping.
- JHS Offerings remain valid only when they apply to every configured source Term; the bijection therefore preserves full-destination-year applicability.
- SSHS Offering Term subsets are copied exactly through the approved mapping.
- Legacy Semester values are not read or mapped.

## Eligibility And Conflicts

The preview classifies every source Offering as eligible, conflicting, ineligible, or archived.

- Only active source Offerings backed by active, grade-compatible Subject definitions are eligible.
- Archived source Offerings remain visible in the preview result as excluded and are never copied.
- Archived Subjects and invalid or archived SSHS clusters make an Offering ineligible.
- An existing active destination identity `(subjectId, academicYearId, gradeLevel)` is a blocking conflict for that source Offering.
- Archived destination Offerings remain historical and do not prevent creation of a new active destination identity.
- Conflicting, ineligible, and archived rows cannot be selected.
- The commit revalidates every selected source ID. Any stale, invalid, archived, foreign, or newly conflicting selection rolls back the entire requested adoption.
- PostgreSQL's existing active-identity partial unique index remains the final duplicate and concurrency guard.

## Copied Configuration

Adoption creates new destination `SubjectOffering`, `SubjectOfferingTerm`, and, when applicable, `SubjectOfferingShsContext` records.

- The existing Subject ID is reused; no Subject is created or duplicated.
- Grade, Subject code snapshot, Subject description snapshot, and mapped Term applicability are preserved.
- SSHS classification, active cluster, and source reference are preserved.
- Every copied SSHS context is `PROVISIONAL_DEPED`, including a source Offering that was school-approved.
- School approval reference, approval actor, and approval timestamp are cleared in the destination.
- Adoption never promotes a destination Offering to `SCHOOL_APPROVED`; the existing dedicated approval workflow remains required.

## Transaction And Provenance

The service owns one transaction containing all selected Offering, Term, SSHS context, and audit writes.

- One batch `ADOPT` audit identifies the operation, source and destination Academic Years, complete Term mapping, actor, timestamp, and all source/destination Offering pairs.
- One `ADOPT` audit per destination Subject Offering records its source Offering, source and destination years, exact applicable-Term mappings, SSHS source status, and resulting destination status.
- Audit metadata is the approved Phase 21B provenance mechanism. No parallel Curriculum model or lineage schema was added.
- Audit persistence failure, uniqueness conflict, stale preview, or any invalid selected row rolls back all adoption writes.

## Authorization And UI

- Adoption uses `Permissions.SUBJECTS`, so only Super Admin can preview or commit it.
- Registrar retains existing Academic Year and Curriculum read/approval access but cannot adopt Curriculum.
- Academic Year Details exposes **Adopt Curriculum** only for a DRAFT destination and authorized user.
- The dedicated dialog makes source and destination years explicit, requires deliberate Term mapping, displays preview counts and row-level reasons, permits selection only from eligible rows, and uses a separate final confirmation state.
- Successful adoption invalidates only Curriculum adoption previews and Subject Offering list/option/filter query families.

## Preserved Boundaries

- No Prisma schema or migration change
- No Subject duplication or source Curriculum mutation
- No Enrollment, Student Subject Enrollment, Grade, Subject Assignment, or student-data writes
- No change to Enrollment, Student Subject Enrollment, Academic Year, Academic Term, generic Offering, or SSHS approval lifecycle behavior
- No automatic Academic Year activation or unattended rollover
- No Academic Term selector bug fix; that remains a separate later correction

## Verification

- Focused Phase 21B schema, contract, and rollback-only integration tests cover explicit mapping, authorization, successful copy behavior, Subject reuse, exact Terms, JHS semantics, SSHS provenance and approval reset, archive handling, conflicts, duplicate prevention, invalid mapping rejection, audit provenance, rollback, source immutability, and downstream-count preservation.
- The combined Phase 18-21B regression suite passes 92 tests with two pre-existing environment-guarded database tests skipped.
- Targeted ESLint, TypeScript, Prisma validation/generation/migration status, `git diff --check`, and the production build pass.
- A read-only database audit reports no Phase 21B fixtures, active Offering duplicates, Offering/Term Academic Year mismatches, or malformed SSHS contexts.
- Authenticated browser verification remains required for the complete responsive dialog flow and role-scoped visibility before production.
