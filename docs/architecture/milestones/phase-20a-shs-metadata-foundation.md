# Phase 20A: SSHS Metadata Foundation

Phase 20A extends the existing year-specific Subject Offering architecture without creating a separate SHS Offering model, importing curriculum data, or materializing Student Subject Enrollments.

## Scope And Outcome

- Grade 11 and 12 Offerings created through the application require a one-to-one SSHS context with `CORE`, `ACADEMIC_ELECTIVE`, or `TECHPRO_ELECTIVE` classification and `PROVISIONAL_DEPED` or `SCHOOL_APPROVED` curriculum status.
- SHS curriculum clusters are soft-archivable reference records on the existing Subject Offerings route. They have Academic or TechPro track context, but Phase 20A does not populate national or school clusters.
- Core contexts cannot reference a cluster. Academic and TechPro electives require an active cluster of their matching track.
- Provisional contexts require a source reference. School-approved contexts require an approval reference.
- Student Subject Enrollment now has nullable immutable SSHS snapshot columns. PostgreSQL rejects Student Subject Enrollment materialization from provisional SHS Offerings; no SHS materialization service or UI exists in this phase.

## Preserved Boundaries

- Existing Grade 7 through 10 Subject and Offering validation, full-year Terms policy, baseline data, and derivation remain unchanged.
- `Subject.gradeLevel` remains required and grade-specific. No reusable cross-grade SHS Subject change was required while Phase 20A creates no SHS Subject or Offering records.
- `trackStrand` is not read, inferred, or migrated into SSHS metadata.
- Legacy Semester behavior, Grade 12 student workflows, elective selection, grades, scheduling, prerequisites, progression, and Subject Assignment modernization remain deferred.
- Cluster and Offering archive operations preserve historical relations through `RESTRICT` foreign keys and soft deletion.
