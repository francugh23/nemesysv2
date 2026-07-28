# Repository Pattern

## Responsibilities
- Perform Prisma reads and writes only.
- Express caller-requested filters, selections, ordering, and persistence operations.
- Accept an optional transaction client for transaction-aware operations.

## Preferred Patterns
- Use explicit names such as `findActive...`, `create...`, and `hasActive...`.
- Return narrow data shapes needed by services.

## Pitfalls
- Authentication, authorization, business eligibility, audit orchestration, or transactions in repositories.
- Implicitly including archived records in active reads.
