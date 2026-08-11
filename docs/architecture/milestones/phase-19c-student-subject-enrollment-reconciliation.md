# Phase 19C: Student Subject Enrollment Reconciliation Lifecycle

## Scope And Outcome

Correcting an active Enrollment Section now reconciles Student Subject Enrollment history inside the existing Enrollment transaction. Eligibility context is the approved regular JHS status and grade only; specialized-program curriculum is never inferred.

## Reconciliation Lifecycle

- Same-context Section changes retain existing Student Subject Enrollment rows unchanged.
- A context change marks every ACTIVE Student Subject Enrollment as REPLACED with a timestamp, preserves its immutable snapshots and Terms, and records an UPDATE audit.
- A regular Grade 7 through 10 destination materializes replacement ACTIVE rows only from the approved baseline Offering matrix, copies exact Offering Terms, and records the existing CREATE audits.
- Regular-to-specialized changes retain REPLACED history without creating specialized rows. Specialized-to-regular changes derive the approved regular baseline. Specialized-to-specialized same-grade changes retain existing state.
- Terminal Enrollment updates do not operationally reconcile Student Subject Enrollments. Parent Enrollment placement and its existing Student summary synchronization remain authoritative and unchanged.

## Preserved Boundaries

- No migration or changes to Subject, Subject Offering, Academic Term, Subject Assignment, Grade, SHS, scheduling, or specialized-program architecture were required.
- Student Subject Enrollment history is never hard-deleted. ACTIVE uniqueness remains protected by the existing partial database constraint.
- Reconciliation, replacement audits, derivation, creation audits, and Enrollment correction commit or roll back together.
