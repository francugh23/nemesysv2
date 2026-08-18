# Phase 21D-B2: Progressive SHS Current-Term Enrollment

## Scope And Outcome

Phase 21D-B2 replaces the Phase 20C desired-state mutation with server-resolved, additive current-Term SHS progression and explicit whole-row subject DROP. It also exposes the B1 elective-policy backend in Academic Year Details. Enrollment remains the annual parent, no Term Enrollment model exists, JHS derivation is unchanged, and historical Phase 20C snapshots remain readable without backfill.

## Current-Term Progression

- The server resolves the single active Academic Year and current Term from the Philippine calendar date in `Asia/Manila`; clients submit only Enrollment and Offering identities.
- Progression requires an active Grade 11/12 Enrollment in the active year with populated entry Academic Term and SHS Track. Initial local SHS materialization is permitted only when entry Term equals current Term.
- The exact Academic Year, current Term, and grade elective policy is mandatory. Academic and TechPro electives count together, while SHS Track never filters Offering eligibility.
- Selection is additive. Omission never replaces or drops participation, identical requests are idempotent, and future-Term electives are rejected.
- New elective rows carry `selectionAcademicTermId` and exactly one matching current-Term membership. An Offering dropped for that Enrollment and selection Term cannot be selected again without a future reinstatement workflow.
- Missing approved Core Offerings materialize automatically from the student's actual local participation point through their configured year-end Terms. No prior local participation is fabricated.
- Explicit progression may replace an incomplete active legacy Core snapshot while preserving its original Terms and audit history. A dropped Core row is never recreated automatically.
- Active SHS snapshots from another grade block progression pending a separately approved cross-grade reconciliation decision.

## Subject DROP

- DROP requires an active SHS row covering the server-resolved current Term, an active parent Enrollment/year, and a trimmed reason of 1 through 500 characters.
- `ACTIVE -> DROPPED` applies to the entire Student Subject Enrollment row. Every snapshot and prior/future Term membership remains immutable history.
- DROP never mutates Enrollment or Student and never creates a replacement.
- An elective drop may put the student below the current policy minimum. The mutation still commits and returns a structured policy exception for the UI.
- Terminal mutation and normal same-Term re-selection after DROP remain prohibited.

## Policy Administration

- Academic Year Details provides a minimal Term-by-Term Grade 11/12 manager for combined elective minimum and maximum values.
- Values remain within one through three and minimum cannot exceed maximum.
- Super Admin and Registrar continue using `SHS_CURRICULUM_APPROVAL`; locked and archived years are read-only at both UI and service boundaries.
- Policies are never seeded, inferred, adopted, copied, or deleted automatically.

## Transactions And Concurrency

- Progression and DROP use serializable transactions with at most three retries for recognized serialization/deadlock conflicts at the service boundary only.
- Mutations lock Enrollment first, then revalidate the active Academic Year/current Term, policy, active children, and affected Offerings in deterministic ID order.
- Offering year, grade, archive state, school approval, SSHS context, cluster, and configured Terms are revalidated after locks.
- Elective count validation occurs only after policy, child, and Offering locks. Participation and audit writes commit or roll back together.
- A disposable complete-migration database test confirmed concurrent selections cannot exceed the configured maximum.

## UI And Cache Coherence

- Enrollment Details has one active SHS mutation surface: current-Term additive selection. There is no client Term selector or Phase 20C mutation entry point.
- The UI displays current and entry Terms, policy range, combined count, Core state, eligible electives, selected/dropped states, and explicit blocked reasons.
- Active, replaced, and dropped participation are presented separately. Dropped history includes timestamp, reason, and immutable Terms.
- DROP confirmation explains the whole-row consequence, including retention of prior/future Terms and no parent Enrollment change or replacement.
- Successful selection/drop invalidates only the Enrollment-scoped participation and progression contexts. Policy, Offering, Academic Year, placement, and Enrollment lifecycle changes invalidate affected progression contexts.

## Verification And Safety

- Focused B2 rollback suites cover all three entry Terms, transferee-safe Core coverage, current-only electives, policy behavior, additive/idempotent semantics, legacy Core progression, Offering revalidation, audit rollback, DROP behavior, authorization/source contracts, UI retirement, and cache coherence.
- The true two-connection maximum test passed on a disposable database built through the full migration chain, and the disposable database was removed afterward.
- Phase 18C through 21D-B1 regressions, Prisma validation/generation/status, live drift, TypeScript, targeted ESLint, production build, and protected-data audits passed.
- B2 adds no Prisma migration, backfill, policy seed, provisional materialization, or operational production-data mutation.

## Deferred

Prerequisites, results and passing rules, transferred credits, completed subject status, partial-Term Core withdrawal, reinstatement, automated progression, cross-grade SHS reconciliation, scheduling, attendance, catalog redesign, and Term Enrollment remain deferred.
