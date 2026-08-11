# Service Layer

## Responsibilities
- Own business rules, authorization orchestration, transactions, and audit coordination.
- Call repositories for all persistence.
- Produce domain-specific errors that actions can safely map.

## Preferred Pattern
`authenticate → normalize → transact → load/validate → mutate → audit → return`

## Source-Backed Reconciliation
- Match the exact legacy signature before correcting generated catalog data; do not treat every record sharing a Subject as catalog-owned.
- Preserve approved or operational records and report unresolved conflicts instead of rewriting their history.
- Make reconciliation idempotent and audit the before/after configuration in the same transaction.

## Pitfalls
- Splitting related writes across transactions.
- Trusting client-provided eligibility or identity data.
- Calling Prisma directly instead of repositories.
