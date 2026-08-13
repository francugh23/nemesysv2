# Phase 21D-A: SHS Enrollment Foundation

## Scope And Outcome

Phase 21D-A keeps one Enrollment per Student and Academic Year while adding Enrollment-owned actual entry Academic Term and SHS Track facts for Grade 11/12. No `TermEnrollment` model was introduced. New JHS Enrollments keep both fields null and continue deriving their full-year Terms through Student Subject Enrollment, while new Grade 11/12 Enrollments require an explicit same-year entry Term and `ACADEMIC` or `TECHPRO` Track.

## Data Integrity

- `Enrollment.entryAcademicTermId` is a nullable legacy-safe relation to Academic Term. A composite foreign key with `Enrollment.academicYearId` guarantees that the Term belongs to the same Academic Year.
- `Enrollment.shsTrack` uses the dedicated nullable `EnrollmentShsTrack` enum. It is not inferred from Section `trackStrand`, curriculum clusters, Subjects, catalog data, Semester, or timestamps.
- PostgreSQL requires entry Term and Track together for new Grade 11/12 rows and rejects either field for Grades 7-10.
- Section grade changes are database-blocked when they would bypass those populated Enrollment facts.
- Populated entry Term and Track are write-once facts. Existing null legacy rows remain valid and were not backfilled.
- Placement correction remains Section-only. It preserves both facts and rejects a destination grade that would make populated SHS facts invalid.

## Application Flow

- Enrollment create validation loads and locks the Student, Section, Academic Year, and entry Academic Term in the existing transaction.
- Super Admin and Registrar retain the existing `Permissions.ENROLLMENT` boundary at both Server Action and Service layers.
- Enrollment form options expose position-ordered Terms nested under the active Academic Year. Entry Term and Track selectors appear only for Grade 11/12 Sections, and changing Academic Year clears a selected SHS entry Term. Server validation remains authoritative.
- Enrollment Details distinguishes Section Track / Strand from Enrollment-owned SHS Track and displays the entry Academic Term.
- Enrollment lifecycle transitions and Student synchronization remain unchanged and preserve Student Subject Enrollment history.

## Migration And Legacy Safety

The additive migration creates the Track enum, nullable Enrollment fields, Academic Term composite identity, foreign key, index, and invariant trigger. It contains no Enrollment update or historical inference. The three existing Enrollments remain null for both new fields, and their content hashes are unchanged. New JHS rows also store both fields as null.

## Verification

- Focused Phase 21D-A and Semester-retirement suite: 22 passed, including JHS null entry facts with all-three-Term subject derivation.
- Phase 18C-21C Enrollment, Student Subject Enrollment, Curriculum, and lifecycle regression coverage: 62 behaviors passed. The combined parallel run passed 60 and produced one known rollback-test deadlock plus one corrected fixture omission; the affected Phase 20C file then passed 7/7 in isolation.
- Prisma validation and generation, migration status, zero-drift comparison, targeted ESLint, TypeScript checking, `git diff --check`, and the production build passed.
- Read-only safety audit confirmed 3 Enrollments, 20 Student Subject Enrollments, 0 Grades, 0 Assignments, 203 Subjects, 138 Offerings, 171 references, and 16 clusters with pre/post hashes unchanged.
- The audit found zero cross-year populated entry Terms, zero JHS populated entry facts, zero partial SHS entry fact pairs, zero populated production entry facts, and all three legacy Enrollments still null.
- Authenticated browser verification remains required for Super Admin and Registrar create/detail flows.

## Deferred Work

Progressive current-Term SHS subject selection, prerequisites, elective policies, subject-level `DROPPED` lifecycle, transferred credits, grading and final-result logic, Subject Assignment modernization, Scheduling, Curriculum locking, historical entry-fact remediation, and DepEd catalog disposition remain deferred to separately approved phases.
