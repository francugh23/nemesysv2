# Phase 19B: JHS Student Subject Enrollment Derivation

## Scope And Outcome

Creating a regular Grade 7 through 10 Enrollment now materializes Student Subject Enrollments from the approved Phase 18C-3 regular JHS Offering matrix in the same transaction. Each derived record preserves the immutable Offering snapshots and exact ordered Offering Terms established in Phase 19A.

## Derivation And Audit

- Only Grades 7 through 10 are eligible.
- Resolution includes only active Offering codes in the documented regular baseline matrix: Filipino, English, Mathematics, Science, Araling Panlipunan, MAPEH, TLE, and GMRC / Values Education for the Enrollment grade.
- Enrollment creation, Student Subject Enrollment creation, Term copying, Enrollment audit, and one audit record per derived Student Subject Enrollment commit or roll back together.
- No records are fabricated when an eligible Enrollment has no matching active baseline Offering.

## Preserved Boundaries

- STE, SPED, SPA, SPS, SPFL, SHS, and other specialized Sections do not derive Student Subject Enrollments.
- Existing Enrollments are not backfilled.
- Enrollment current-placement synchronization remains unchanged.
- Grades, TermGrade, assessments, scheduling, teacher assignment, Subject Offering, Academic Term, and Subject Assignment architecture remain unchanged.
- Academic Terms remain children of the canonical `/dashboard/academic-years` view. The existing detail dialog already exposes each Term and its dates, so no separate Terms module or redundant flow was added.
