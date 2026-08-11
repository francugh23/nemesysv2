# Phase 19A: Student Subject Enrollment Foundation

## Scope And Outcome

Student Subject Enrollment now has an additive persistence foundation only. It records immutable Subject Offering snapshots and exact applicable Academic Terms for a Student's Academic Year Enrollment. No Enrollment automatically creates these rows in this phase.

## Integrity And History

- `StudentSubjectEnrollment` references Enrollment and Subject Offering with `RESTRICT` foreign keys and stores Subject code, description, and grade snapshots.
- `StudentSubjectEnrollmentTerm` records the exact Terms applicable to a Student Subject Enrollment.
- Database protections require the Offering and Terms to belong to the Enrollment Academic Year, prevent duplicate ACTIVE Enrollment/Offering combinations, preserve immutable source and snapshot fields, and reject hard deletion.
- `ACTIVE` and `REPLACED` statuses support future replacement history. Creation actors, timestamps, and later transactional Audit Log integration are structurally available.

## Preserved Boundaries

- The migration creates no Student Subject Enrollment rows and does not alter existing Enrollment, Offering, Subject, Term, Assignment, or Grade records.
- JHS materialization, SHS individualized selection, UI, Grades, assessments, scheduling, and Subject Assignment modernization remain deferred.
