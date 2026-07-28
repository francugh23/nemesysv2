# Prisma

## Preferred Patterns
- Prisma access is repository-only.
- Select only fields required by the caller.
- Pass `Prisma.TransactionClient` to repository methods used in service transactions.
- Verify schema and Client APIs using Prisma MCP, installed types, or CLI output.

## Schema Work
- Treat uniqueness, referential actions, and lifecycle behavior as domain decisions.
- Validate with `npx prisma validate`; generate or migrate only when approved.

## Pitfalls
- Hidden business rules in query filters.
- Global Prisma calls inside a transaction callback.
- Hard deletion or cascading changes without lifecycle analysis.
