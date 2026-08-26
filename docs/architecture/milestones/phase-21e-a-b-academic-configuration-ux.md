# Phase 21E-A/B: Academic Configuration Navigation And Curriculum UX

## Scope And Outcome

Phase 21E-A/B clarifies the administrative configuration hierarchy without changing persistence, canonical routes, permissions, lifecycle rules, or operational behavior. Academic Years, Subjects, and Curriculum now form one route-linked **Academic Configuration** group, while Enrollment remains operational and legacy Assignments remain outside configuration.

## Navigation And Terminology

- Canonical routes remain `/dashboard/academic-years`, `/dashboard/subjects`, and `/dashboard/subject-offerings`; no `/dashboard/curriculum` route exists.
- Super Admin navigation orders Academic Years, Subjects, and Curriculum under Academic Configuration. Registrar retains only the Academic Years and Curriculum links permitted by the existing authorization model.
- The three configuration pages use a compact related-navigation surface, filtered to the links available to the current role.
- Subject remains a reusable academic definition. Curriculum remains the user-facing name for an Academic-Year-specific `SubjectOffering`.
- Sections and legacy Assignments remain outside Academic Configuration. Enrollment appears under Operations.

## Subjects

- The Subjects page and form state that Subject creation does not add the definition to an Academic Year, place it in Curriculum, or enroll students.
- Read-only JHS/SHS grouping uses existing Grade 7-10 and Grade 11-12 identities. The server query supports a validated JHS/SHS filter and rejects contradictory school-level and grade combinations.
- SHS definitions show existing relational facts only: whether a DepEd reference exists and how many active Curriculum entries use the Subject.
- Core, Academic Elective, and TechPro Elective classification remains Offering context; reusable Subject identity is not repurposed.

## Curriculum

- The create/edit form presents Academic Year, Grade, reusable Subject, SHS context where applicable, exact Terms, and provenance in domain order without changing its mutation contract.
- JHS Grade 7-10 is presented as **Full Academic Year**. Selecting a JHS grade supplies all configured Terms in the form, matching the existing server requirement; no partial-Term JHS choice is presented.
- Grade 11/12 retains explicit Term selection. The UI states that no all-Term or Grade 12 TechPro placement is inferred.
- Core, Academic Elective, TechPro Elective, school-facing cluster, Provisional DepEd, and School Approved meanings remain Offering-specific.
- The Curriculum table exposes Academic Year, Grade, Offering identity, exact Terms, SHS context/approval, and active state for future Assignment readiness without changing Assignment behavior.
- SHS approval filtering appears only for a selected SHS grade. Grade options identify JHS and SHS explicitly.
- The DepEd catalog remains on the Curriculum route but is collapsed and labeled as reference/provenance only, not operational Curriculum.

## Academic Year And Policy Context

- Academic Year Details links to the canonical Curriculum route with its existing `academicYearId` filter applied.
- Academic Year Details otherwise retains its existing composition for the later Phase 21E-C boundary.
- SHS Elective Policy copy now distinguishes selection-count policy from the separate list of school-offered Curriculum entries.

## Term Presentation

- `AcademicTermBadge` remains authoritative for visible `Term 1`, `Term 2`, and `Term 3` labels.
- Configured names appear only as accessible or secondary context when they differ from the canonical position label.
- Redundant labels such as `Term 1: Term 1`, `1. Term 1`, and `Term 1 - Term 1` are not rendered.

## Preserved Boundaries

- No Prisma schema, migration, database-record, canonical-route, permission, lifecycle, adoption, elective-policy, result, Enrollment, JHS derivation, DepEd data, or SubjectAssignment behavior change.
- No prerequisite, completion, progression, scheduling, Assignment modernization, or grading expansion.
- Subject usage indicators are read-only projections from existing references and active Offerings.

## Verification

- Focused Phase 21A/21D-A/21E hierarchy and Curriculum UX suite: 14 passed.
- Relevant Phase 21A through Phase 21D-D regression boundary: 129 passed, three environment-gated concurrency tests skipped, zero failed.
- Targeted ESLint, `npx tsc --noEmit`, `git diff --check`, and `npm run build` pass.
- Prisma schema hash, migration count, and protected Subject, Offering, Assignment, Enrollment, Student Subject Enrollment, and Student Subject Enrollment Term hashes remain unchanged.
- Authenticated responsive browser verification remains pending before production.

## Deferred Work

- Phase 21E-C: Academic Year Details composition and broader readiness summaries.
- Phase 21E-D: dedicated DepEd reference-catalog placement.
- Phase 21E-E: Curriculum finalization, first-operational-Enrollment locking, and controlled override decisions.
- Teacher Assignment modernization remains a separate later phase.
