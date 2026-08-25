# Phase 21F-C1: Controlled SHS Participation Correction

## Scope And Outcome

Phase 21F-C1 provides an immutable, one-to-one controlled correction for active Grade 11 or 12 SHS Core, Academic Elective, and TechPro Elective participation. It preserves source participation and exact Term history while creating replacement participation only for the safe correction scope.

## Evidence And Safety

- The command is authorized at Action and Service boundaries through `Permissions.STUDENT_CORRECTIONS` and uses a serializable retrying Service transaction.
- PostgreSQL enforces an exact transaction-local C1 capability, advisory membership in namespace `2108`, immutable correction evidence, result and Term isolation, replay prevention, and cross-domain capability isolation.
- Replacement transaction-newness remains a strict `xmin` invariant. The check reads `xmin` by exact replacement ID directly from `StudentSubjectEnrollment`; `%ROWTYPE.xmin` is not a tuple system-column read.
- The function-backed transaction boundary performs all related writes and forced validation in one PostgreSQL invocation.

## Verification

- C1 contract and integration/adversarial tests pass, including Core, Academic Elective, TechPro Elective, result, policy, duplicate, replay, capability, Term, and result-mutation boundaries.
- PostgreSQL 17.10 rollback-only controls confirmed direct newly inserted tuple `xmin` is `in progress` in plain SQL and PL/pgSQL. The previous anomaly was the `%ROWTYPE.xmin` lookup defect, not committed new data.
- C1 disposable concurrency remains implemented/environment-gated but was not executed: repository concurrency suites require an externally supplied disposable `DATABASE_URL`, and none is configured. Shared development was intentionally not used.
- Shared dialog overflow uses bounded outer dialogs and shrinkable body scroll regions while retaining Base UI focus and dismissal behavior.

## Deferred Work

- Repeat, cross-year, generic reconciliation, result revision, and other SHS correction expansions remain separately approved work. C2's authorized read/UI workflow is recorded separately in `phase-21f-c2-shs-participation-correction-ui.md`.
