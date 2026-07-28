# Service Layer

## Responsibilities
- Own business rules, authorization orchestration, transactions, and audit coordination.
- Call repositories for all persistence.
- Produce domain-specific errors that actions can safely map.

## Preferred Pattern
`authenticate → normalize → transact → load/validate → mutate → audit → return`

## Pitfalls
- Splitting related writes across transactions.
- Trusting client-provided eligibility or identity data.
- Calling Prisma directly instead of repositories.
