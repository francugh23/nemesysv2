# Phase 20B: Provisional DepEd Reference Catalog

Phase 20B adds a controlled, source-backed SSHS reference catalog for Academic Year 2026-2027. It is reference/candidate configuration only and does not establish NVGCHS school availability, program availability, pilot participation, or student eligibility.

## Official Sources

- [DepEd DO 017, s. 2026: Strengthened Senior High School Curriculum](https://www.deped.gov.ph/wp-content/uploads/DO-017-s.-2026-%E2%80%93-Strengthened-Senior-High-School-Curriculum.pdf)
- [DepEd DM 012, s. 2026: Full Implementation of the Strengthened Senior High School Curriculum in SY 2026-2027](https://www.deped.gov.ph/wp-content/uploads/DM-12-s.-2026_Full-Implementation-of-the-Strengthened-Senior-High-School-Curriculum-in-School-Year-2026-2027.pdf)
- [DepEd DM 036, s. 2026: Pilot Implementation of SSHS for Grade 12 in SY 2026-2027](https://www.deped.gov.ph/wp-content/uploads/DM_s2026_036r-UPDATED.pdf)
- [DepEd Strengthened SHS Program curriculum-guide catalog](https://www.deped.gov.ph/strengthened-shs-program/)

## Catalog Decision

- Every `ShsCurriculumReference` is database-constrained to `PROVISIONAL_DEPED`, Grade 11 or 12, and a nonblank DepEd source reference.
- The catalog contains the six DepEd Core Subjects, five Academic Elective clusters, and ten TechPro clusters. Grade-specific Subjects remain on the existing `Subject` model because `Subject.gradeLevel` is required and Phase 20A retained that design.
- Grade 11 Core and Grade 11 TechPro BOW guides establish three-term applicability, so they have provisional `SubjectOffering` and `SubjectOfferingShsContext` records for all configured 2026-2027 Terms.
- Grade 12 TechPro BOW guides are retained only as `PROVISIONAL_DEPED` candidates with DM 036 pilot provenance. They do not indicate that NVGCHS is a pilot school or offers the programs.
- Academic Elective guides are explicitly term-based and do not assign a universal Term 1, 2, or 3. They are retained as `ShsCurriculumReference` records with `UNSPECIFIED` term applicability and deliberately have no Offering rows.
- The population path is idempotent, requires an active audit actor and the existing active 2026-2027 three-term Academic Year, and writes Subjects, clusters, references, Offerings, contexts, and audits in one transaction.

## Preserved Boundaries

- No `SCHOOL_APPROVED` records, StudentSubjectEnrollment rows, Enrollment rows, Assignments, Grades, teacher assignment, scheduling, grading, strand inference, or elective selection are created.
- Existing Grade 7-10 Subjects and Offerings are not modified. Existing historical Subjects are neither merged nor migrated.
- Provisional Subject Offerings remain blocked by the Phase 20A PostgreSQL trigger from materializing Student Subject Enrollments.
- A future explicit approval workflow is required before any candidate can become school-authorized curriculum.
