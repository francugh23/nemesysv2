# Phase 21A: Academic Curriculum Configuration Hierarchy

## Scope And Outcome

Phase 21A clarifies the existing academic configuration hierarchy without changing database models, canonical routes, permissions, lifecycle rules, or persistence behavior. The user-facing Subject Offerings module is now named **Curriculum**, while `SubjectOffering` remains the domain and Prisma model name.

## Configuration Hierarchy

The user-facing hierarchy is:

1. **Academic Years** own the school period and lifecycle.
2. **Academic Terms** remain children of an Academic Year.
3. **Subjects** are reusable, grade-specific definitions.
4. **Curriculum** connects a Subject definition to an Academic Year, grade level, and applicable Terms through a Subject Offering.
5. **Enrollment** materializes or explicitly selects student-specific curriculum snapshots.

Subjects are not children of an Academic Year and do not become operational merely by existing. Curriculum is the year-specific configuration boundary.

## UI Terminology

- Super Admin and Registrar navigation now labels `/dashboard/subject-offerings` as **Curriculum**.
- The route remains `/dashboard/subject-offerings`; no duplicate `/dashboard/curriculum` implementation or redirect was introduced.
- The navbar breadcrumb maps the existing route to **Curriculum**.
- The Subjects page and form explain that Subject creation does not add the definition to an Academic Year or enroll students.
- Record-level actions retain the precise domain term **Subject Offering**, including create, edit, archive, and SSHS approval dialogs.

## Curriculum Surface

The Curriculum table exposes:

- Subject code and description snapshots
- Grade level
- Academic Year label and lifecycle status
- Applicable Academic Terms
- SSHS classification, cluster, and provisional or school-approved status
- Subject Offering active/archive state

The current list remains active-only because the established repository explicitly excludes archived Offerings. The UI states that archiving removes an Offering from active Curriculum while preserving historical records. Archived-history browsing remains a separate future query-contract decision.

## SSHS Integration

Phase 20A-20C remains authoritative. Curriculum continues using:

- `ShsCurriculumCluster`
- `SubjectOfferingShsContext`
- provisional DepEd references
- controlled `SCHOOL_APPROVED` promotion
- immutable Student Subject Enrollment snapshots and replacement history

No separate SSHS Subject or Curriculum module was added. Existing Phase 20B Subjects and references remain in their canonical models. No records were promoted, copied, randomized, or re-termed.

## Explicit Curriculum Adoption

The existing architecture supports a future explicit adoption workflow without rewriting source-year records: Subjects are reusable, Offerings are year-specific, Terms are year-owned, and Offering creation and audit are transactional.

Implementation is deferred to proposed **Phase 21B** because the following domain rules require approval:

- Whether destination Curriculum can be prepared while an Academic Year is DRAFT, since current Offering writes require ACTIVE years
- Explicit source-to-destination Term mapping because Term IDs are year-specific
- Conflict handling for existing destination Offerings
- Archived Subject and archived source Offering policy
- Whether copied SSHS configuration returns to provisional review and how school approval provenance behaves per year
- Atomic preview, selection, creation, and audit semantics
- Whether audit metadata is sufficient copy provenance or queryable lineage requires a future schema decision

Phase 21B should provide an explicit preview-and-adopt action. It must create new destination-year Offerings, preserve source-year records unchanged, map destination Terms deliberately, and never carry forward school approval implicitly.

## Preserved Boundaries

- No Prisma schema or migration change
- No Subject, Subject Offering, Academic Year, Academic Term, Enrollment, or Student Subject Enrollment write change
- No route, permission, action, service, repository, hook, query-key, audit-module, or cache invalidation change
- No automatic Curriculum copy or rollover
- No changes to JHS full-year Offering behavior
- No changes to SSHS provisional/approved lifecycle or student selection
- No changes to Enrollment lifecycle or Student Subject Enrollment history

## Verification

- Focused hierarchy tests cover terminology, canonical route preservation, breadcrumb mapping, and permission scope.
- A read-only integrity test verifies Subject and Offering counts, Offering-to-Term Academic Year relationships, active Offering uniqueness, JHS three-Term configuration, SSHS provenance, and downstream Enrollment/Student Subject Enrollment counts.
- Academic Year/Term and Phase 19-21 regression suites pass without persistent fixtures.
- Authenticated browser verification remains required for sidebar labels, breadcrumbs, responsive Curriculum columns, and role-scoped controls.
